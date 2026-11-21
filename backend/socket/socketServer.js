/**
 * File: backend/socket/socketServer.js
 * Purpose: Creates and secures the Socket.IO server — authentication, direct
 *   messaging events, live-stream rooms, live chat and WebRTC signaling.
 *
 * SECURITY MODEL (every rule below was previously missing)
 *   - Auth: role is taken from the DATABASE, not the token; banned, deactivated
 *     and revoked sessions (tokenVersion) are refused for admins as well.
 *   - live:join   → verifies the stream exists, is not hidden/cancelled, and the
 *                   viewer passes age-rating + region rules (same as the REST API).
 *   - live:chat   → sender must have joined the room; stream must be live with
 *                   chat enabled; slow-mode + per-socket rate limit; muted /
 *                   shadow-banned users are ghosted; account state is re-checked.
 *   - live:chat:delete / live:heartbeat → admin or the stream's host only.
 *   - webrtc:*    → payload size capped; targets must be sockets inside the same
 *                   live room; broadcast offers only from the host.
 *   - typing / mark-read / subscribe-conversations → conversation membership is
 *                   verified before anything is emitted or written.
 *   - Every event is rate limited per socket; all ids are validated.
 *   - CORS uses the same allow-list as the REST API.
 */

'use strict';

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const Admin = require('../models/Admin');
const Live = require('../models/Live');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { evaluateAccess } = require('../utils/liveAccess');

// ─────────────────────────────────────────────
// CONSTANTS + SMALL HELPERS
// ─────────────────────────────────────────────

const ADMIN_ROLES = ['superadmin', 'platformadmin', 'supportadmin'];
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const MAX_LIVE_ROOMS_PER_SOCKET = 5;
const MAX_SUBSCRIBE_CONVERSATIONS = 100;
const MAX_SIGNAL_BYTES = 32 * 1024;
const MAX_CHAT_LENGTH = 300;
const LIVE_META_TTL_MS = 15 * 1000;
const CHAT_FLAGS_TTL_MS = 60 * 1000;

const USER_FIELDS =
  'username firstName lastName avatar role isBanned isDeactivated adminDeactivated status ' +
  'tokenVersion dateOfBirth country continent fullName name email';

const isId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);
const normRole = (r) => String(r || '').toLowerCase().replace(/_/g, '');
const isAdminRole = (r) => ADMIN_ROLES.includes(normRole(r));

/** Sliding-window limiter stored on the socket. Returns true if allowed. */
const allow = (socket, key, max, windowMs) => {
  const now = Date.now();
  const buckets = socket.data.buckets || (socket.data.buckets = {});
  const hits = buckets[key] || (buckets[key] = []);
  while (hits.length && hits[0] <= now - windowMs) hits.shift();
  if (hits.length >= max) return false;
  hits.push(now);
  return true;
};

const signalOk = (payload) => {
  try {
    return JSON.stringify(payload).length <= MAX_SIGNAL_BYTES;
  } catch {
    return false;
  }
};

/** Strip tags + control characters, collapse whitespace, cap length. */
const cleanChatText = (text) =>
  String(text)
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MAX_CHAT_LENGTH);

// ─────────────────────────────────────────────
// LIVE METADATA CACHE (avoids a DB hit for every chat message)
// ─────────────────────────────────────────────

const liveMetaCache = new Map(); // liveId -> { meta, ts }

const getLiveMeta = async (liveId, { fresh = false } = {}) => {
  const hit = liveMetaCache.get(liveId);
  if (!fresh && hit && Date.now() - hit.ts < LIVE_META_TTL_MS) return hit.meta;

  const live = await Live.findById(liveId)
    .select(
      'host status approved rejected isRemoved isShadowBanned isDeleted ageRating ' +
        'blockedCountries blockedContinents chatEnabled chatSlowMode'
    )
    .lean();

  const meta = live && !live.isDeleted ? live : null;
  liveMetaCache.set(liveId, { meta, ts: Date.now() });
  return meta;
};

setInterval(() => {
  const cutoff = Date.now() - LIVE_META_TTL_MS * 4;
  for (const [id, entry] of liveMetaCache.entries()) {
    if (entry.ts < cutoff) liveMetaCache.delete(id);
  }
}, 60 * 1000).unref();

const isHiddenLive = (meta) =>
  !!(meta.isShadowBanned || meta.isRemoved || meta.rejected || !meta.approved);

// ─────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────

/**
 * @param {http.Server} httpServer
 * @param {{ allowedOrigins: string[] }} options
 * @returns {import('socket.io').Server}
 */
const createSocketServer = (httpServer, { allowedOrigins = [] } = {}) => {
  const io = socketIO(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e5, // 100 KB — plenty for chat and WebRTC signaling
  });

  // ── Authentication ─────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('No token provided'));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new Error('Invalid token'));
      }

      // Admins live in the User collection; fall back to the legacy Admin model.
      let account = await User.findById(decoded.id).select(USER_FIELDS).lean();
      let fromAdminModel = false;
      if (!account && isAdminRole(decoded.role)) {
        account = await Admin.findById(decoded.id).select('-password').lean();
        fromAdminModel = true;
      }
      if (!account) return next(new Error('Account not found'));

      if (
        account.isBanned ||
        account.isDeactivated ||
        account.adminDeactivated ||
        account.status === 'inactive'
      ) {
        return next(new Error('Account unavailable'));
      }
      if (!fromAdminModel && (account.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
        return next(new Error('Session expired'));
      }

      // Role comes from the database, never from the token.
      const isAdminActor = isAdminRole(account.role);

      socket.actor = {
        id: account._id,
        model: isAdminActor ? 'Admin' : 'User',
        role: account.role,
        name: isAdminActor
          ? account.fullName || account.username || account.name || account.email
          : account.username || account.firstName || 'Viewer',
        avatar: account.avatar || null,
      };
      socket.data.isAdmin = isAdminActor;
      socket.data.fromAdminModel = fromAdminModel;
      socket.data.tokenVersion = decoded.tokenVersion || 0;
      socket.data.viewer = {
        dateOfBirth: account.dateOfBirth,
        country: account.country,
        continent: account.continent,
      };

      return next();
    } catch (err) {
      console.error('[Socket] auth error:', err.message);
      return next(new Error('Authentication failed'));
    }
  });

  // Account-state refresh used by chat (cached for a minute).
  const getChatFlags = async (socket) => {
    const cached = socket.data.chatFlags;
    if (cached && Date.now() - cached.ts < CHAT_FLAGS_TTL_MS) return cached;

    if (socket.data.fromAdminModel) {
      return (socket.data.chatFlags = { ts: Date.now(), ghost: false });
    }

    const u = await User.findById(socket.actor.id)
      .select('isBanned isDeactivated tokenVersion isShadowBanned restrictions')
      .lean();

    if (!u || u.isBanned || u.isDeactivated || (u.tokenVersion || 0) !== socket.data.tokenVersion) {
      socket.disconnect(true); // account was banned / signed out while connected
      return null;
    }

    return (socket.data.chatFlags = {
      ts: Date.now(),
      ghost: !!(u.isShadowBanned || u.restrictions?.comment),
    });
  };

  const roomHasSocket = (room, socketId) => !!io.sockets.adapter.rooms.get(room)?.has(socketId);

  const sharesLiveRoom = (socket, otherId) => {
    const other = io.sockets.sockets.get(otherId);
    if (!other) return false;
    for (const room of socket.rooms) {
      if (room.startsWith('live:') && other.rooms.has(room)) return true;
    }
    return false;
  };

  // ── Connection ─────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { actor } = socket;
    console.log(`[Socket] Connected: ${actor.model} "${actor.name}"`);

    socket.join(`${actor.model === 'Admin' ? 'admin' : 'user'}:${actor.id}`);

    // ── MESSAGING ────────────────────────────────────────────────────────

    socket.on('subscribe-conversations', async (conversationIds) => {
      try {
        if (!Array.isArray(conversationIds) || !allow(socket, 'subscribe', 10, 60000)) return;
        const ids = [...new Set(conversationIds.filter(isId))].slice(0, MAX_SUBSCRIBE_CONVERSATIONS);
        if (!ids.length) return;

        // One query; only conversations the actor really belongs to are returned.
        const mine = await Conversation.find({
          _id: { $in: ids },
          'participants.participantId': actor.id,
        })
          .select('_id')
          .lean();

        mine.forEach((c) => socket.join(`conversation:${c._id}`));
      } catch (err) {
        console.error('[Socket] subscribe-conversations:', err.message);
      }
    });

    socket.on('typing', (payload) => {
      const { conversationId, isTyping } = payload || {};
      if (!isId(conversationId) || !allow(socket, 'typing', 20, 10000)) return;
      const room = `conversation:${conversationId}`;
      if (!socket.rooms.has(room)) return; // only members (joined via subscribe) may emit

      socket.to(room).emit('typing', {
        senderId: actor.id,
        senderName: actor.name,
        conversationId,
        isTyping: !!isTyping,
      });
    });

    socket.on('mark-read', async (payload) => {
      try {
        const { conversationId } = payload || {};
        if (!isId(conversationId) || !allow(socket, 'mark-read', 30, 60000)) return;

        const conv = await Conversation.findOne({
          _id: conversationId,
          'participants.participantId': actor.id,
        });
        if (!conv) return; // not a member — do nothing

        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: actor.id },
            'readBy.readerId': { $ne: actor.id },
            isDeleted: false,
          },
          { $push: { readBy: { readerId: actor.id, readerModel: actor.model, readAt: new Date() } } }
        );

        conv.clearUnread(actor.id);
        await conv.save();

        socket.to(`conversation:${conversationId}`).emit('messages-read', {
          conversationId,
          readerId: actor.id,
          readerModel: actor.model,
          readAt: new Date(),
        });
      } catch (err) {
        console.error('[Socket] mark-read error:', err.message);
      }
    });

    // ── LIVE ROOMS ───────────────────────────────────────────────────────

    const joinError = (liveId, code, message) =>
      socket.emit('live:error', { liveId: liveId || null, code, message });

    socket.on('live:join', async (payload) => {
      try {
        const { liveId } = payload || {};
        if (!isId(liveId)) return joinError(liveId, 'INVALID_ID', 'Invalid stream id.');
        if (!allow(socket, 'join', 10, 10000)) return joinError(liveId, 'RATE_LIMITED', 'Slow down.');

        const room = `live:${liveId}`;
        if (socket.rooms.has(room)) return socket.emit('live:joined', { liveId, room });

        const joined = [...socket.rooms].filter((r) => r.startsWith('live:')).length;
        if (joined >= MAX_LIVE_ROOMS_PER_SOCKET) {
          return joinError(liveId, 'TOO_MANY_ROOMS', 'Leave another stream first.');
        }

        const meta = await getLiveMeta(liveId, { fresh: true });
        if (!meta || meta.status === 'cancelled') return joinError(liveId, 'NOT_FOUND', 'Stream not found.');

        const isHost = String(meta.host) === String(actor.id);
        if (isHiddenLive(meta) && !isHost && !socket.data.isAdmin) {
          return joinError(liveId, 'NOT_FOUND', 'Stream not found.');
        }

        const access = evaluateAccess(meta, socket.data.viewer, { bypass: isHost || socket.data.isAdmin });
        if (!access.allowed) return joinError(liveId, access.code, access.message);

        socket.join(room);
        socket.to(room).emit('live:viewer:joined', {
          userId: actor.id,
          name: actor.name,
          avatar: actor.avatar,
        });
        socket.emit('live:joined', { liveId, room, isHost });
      } catch (err) {
        console.error('[Socket] live:join error:', err.message);
        joinError(null, 'SERVER_ERROR', 'Could not join the stream.');
      }
    });

    socket.on('live:leave', (payload) => {
      const { liveId } = payload || {};
      if (!isId(liveId)) return;
      const room = `live:${liveId}`;
      if (!socket.rooms.has(room)) return;
      socket.leave(room);
      socket.to(room).emit('live:viewer:left', { userId: actor.id, name: actor.name });
    });

    socket.on('live:chat', async (payload) => {
      try {
        const { liveId, text } = payload || {};
        if (!isId(liveId) || typeof text !== 'string') return;

        const room = `live:${liveId}`;
        if (!socket.rooms.has(room)) return; // must have passed live:join

        if (!allow(socket, 'chat', 5, 10000)) {
          return socket.emit('live:chat:error', {
            liveId,
            code: 'RATE_LIMITED',
            message: 'You are sending messages too fast.',
          });
        }

        const sanitized = cleanChatText(text);
        if (!sanitized) return;

        const meta = await getLiveMeta(liveId);
        if (!meta || meta.status !== 'live' || !meta.chatEnabled) {
          return socket.emit('live:chat:error', {
            liveId,
            code: 'CHAT_DISABLED',
            message: 'Chat is not available right now.',
          });
        }

        const isHost = String(meta.host) === String(actor.id);
        if (meta.chatSlowMode && !isHost && !socket.data.isAdmin && !allow(socket, 'chat-slow', 1, 5000)) {
          return socket.emit('live:chat:error', {
            liveId,
            code: 'SLOW_MODE',
            message: 'Slow mode is on — wait a few seconds.',
          });
        }

        const flags = await getChatFlags(socket);
        if (!flags) return; // socket was disconnected

        const message = {
          id: `${actor.id}-${crypto.randomBytes(6).toString('hex')}`,
          liveId,
          userId: actor.id,
          name: actor.name,
          avatar: actor.avatar,
          role: actor.role,
          text: sanitized,
          sentAt: new Date(),
        };

        if (flags.ghost) {
          // Shadow-banned / muted: only the sender sees their own message.
          return socket.emit('live:chat:message', { ...message, isOwn: true });
        }

        io.to(room).emit('live:chat:message', message);
      } catch (err) {
        console.error('[Socket] live:chat error:', err.message);
      }
    });

    socket.on('live:chat:delete', async (payload) => {
      try {
        const { liveId, messageId } = payload || {};
        if (!isId(liveId) || typeof messageId !== 'string' || messageId.length > 100) return;
        if (!allow(socket, 'chat-delete', 30, 10000)) return;

        const meta = await getLiveMeta(liveId);
        if (!meta) return;
        const isHost = String(meta.host) === String(actor.id);
        if (!socket.data.isAdmin && !isHost) return; // only admins or the stream's host

        io.to(`live:${liveId}`).emit('live:chat:deleted', { messageId });
      } catch (err) {
        console.error('[Socket] live:chat:delete error:', err.message);
      }
    });

    socket.on('live:heartbeat', async (payload) => {
      try {
        const { liveId } = payload || {};
        if (!isId(liveId) || !allow(socket, 'heartbeat', 10, 10000)) return;
        const room = `live:${liveId}`;
        if (!socket.rooms.has(room)) return;

        const meta = await getLiveMeta(liveId);
        if (!meta || String(meta.host) !== String(actor.id)) return; // host only

        socket.to(room).emit('live:heartbeat', { liveId, ts: Date.now() });
      } catch {
        /* ignore */
      }
    });

    // ── WEBRTC SIGNALING (browser-based streaming) ───────────────────────

    socket.on('webrtc:offer', async (payload) => {
      try {
        const { liveId, offer, targetId } = payload || {};
        if (!isId(liveId) || !offer || !signalOk(offer)) return;
        if (!allow(socket, 'webrtc', 60, 10000)) return;

        const room = `live:${liveId}`;
        if (!socket.rooms.has(room)) return;

        if (targetId !== undefined && targetId !== null) {
          // Targeted offer: the target must be a socket in this same live room.
          if (typeof targetId !== 'string' || !roomHasSocket(room, targetId)) return;
          io.to(targetId).emit('webrtc:offer', { offer, from: socket.id, liveId });
          return;
        }

        // Room-wide offer: only the stream's host may broadcast one.
        const meta = await getLiveMeta(liveId);
        if (!meta || String(meta.host) !== String(actor.id)) return;
        socket.to(room).emit('webrtc:offer', { offer, from: socket.id, liveId });
      } catch (err) {
        console.error('[Socket] webrtc:offer error:', err.message);
      }
    });

    socket.on('webrtc:answer', (payload) => {
      const { answer, to } = payload || {};
      if (!answer || typeof to !== 'string' || !signalOk(answer)) return;
      if (!allow(socket, 'webrtc', 60, 10000)) return;
      if (!sharesLiveRoom(socket, to)) return;
      io.to(to).emit('webrtc:answer', { answer, from: socket.id });
    });

    socket.on('webrtc:ice-candidate', (payload) => {
      const { candidate, to } = payload || {};
      if (!candidate || typeof to !== 'string' || !signalOk(candidate)) return;
      if (!allow(socket, 'ice', 200, 10000)) return;
      if (!sharesLiveRoom(socket, to)) return;
      io.to(to).emit('webrtc:ice-candidate', { candidate, from: socket.id });
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('live:')) {
          socket.to(room).emit('live:viewer:left', { userId: actor.id, name: actor.name });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${actor.model} "${actor.name}" — ${reason}`);
    });
  });

  return io;
};

module.exports = { createSocketServer };

// ═══ END OF FILE: backend/socket/socketServer.js ═══