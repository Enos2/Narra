/**
 * File: backend/controllers/liveController.js
 * Purpose: All live-streaming endpoints — qualification, create, public feed,
 *   status / join / access, host start / stop / rotate-key, and admin moderation.
 *
 * SECURITY CHANGES IN THIS VERSION
 *   - The secret RTMP stream key is returned ONLY to the host (create, status,
 *     join, start, rotate, my-lives). The public feed, viewers, admins and the
 *     Socket.IO events now receive the public `playbackId` instead.
 *   - Responses are built from a whitelist (serializeLive), never `...live`.
 *   - Public routes work for guests AND logged-in users (optionalAuth).
 *   - Age-rating and regional blocks are enforced when joining.
 *   - Hidden streams (shadow-banned / removed / rejected / unapproved) are 404
 *     for everyone except the host and admins.
 *   - Admin "end", delete, ban and reject now actually cut the RTMP publisher
 *     and FFmpeg/HLS output (previously only a database flag changed).
 *   - Input validation + creation rate limit on createLive; regex-escaped and
 *     capped admin search; ObjectId checks; strict boolean for privileges.
 *   - NEW: POST /lives/:id/rotate-key lets a host replace a leaked key.
 */

const Live = require('../models/Live');
const User = require('../models/User');
const Video = require('../models/Video');
const NotificationService = require('../services/notificationService');
const AdminAuditLog = require('../models/AdminAuditLog');
const {
  generateStreamKey,
  generatePlaybackId,
  buildHlsUrl,
  buildRtmpUrl,
  getRtmpBase,
  evaluateAccess,
  serializeLive,
  trackGuestViewer,
  getGuestViewerCount,
  clearGuestViewers,
} = require('../utils/liveAccess');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const ADMIN_ROLES = ['superadmin', 'platformadmin', 'supportadmin'];
const HOST_FIELDS = 'username firstName lastName avatar isVerified';
const LIVE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', '13+', '16+', '18+'];
const MAX_LIVES_PER_HOUR = 5;

const isAdmin = (user) => ADMIN_ROLES.includes(user?.role);

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);
const sameId = (a, b) => !!a && !!b && String(a) === String(b);

const clampInt = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getStreamingServer = () => {
  try {
    return require('../streaming-server');
  } catch {
    return null; // streaming server is optional
  }
};

/** Cut the live pipeline (RTMP publisher + FFmpeg + HLS output) for a stream. */
const killPipeline = async (liveId) => {
  try {
    const doc = await Live.findById(liveId).select('+streamKey').lean();
    const streamingServer = getStreamingServer();
    if (doc?.streamKey && streamingServer?.forceStop) streamingServer.forceStop(doc.streamKey);
    clearGuestViewers(liveId);
  } catch (err) {
    console.error('[Live] killPipeline failed:', err.message);
  }
};

/** Streams created before playbackId existed get one on first access. */
const backfillPlaybackId = async (live) => {
  if (live.playbackId) return live.playbackId;
  await Live.updateOne(
    { _id: live._id, $or: [{ playbackId: { $exists: false } }, { playbackId: null }, { playbackId: '' }] },
    { $set: { playbackId: generatePlaybackId() } }
  );
  const fresh = await Live.findById(live._id).select('playbackId').lean();
  live.playbackId = fresh?.playbackId || null;
  return live.playbackId;
};

const loadHostSecrets = async (liveId) => {
  const s = await Live.findById(liveId).select('+streamKey +rtmpUrl').lean();
  return { streamKey: s?.streamKey || undefined, rtmpUrl: s?.rtmpUrl || undefined };
};

const isHiddenFromPublic = (live) =>
  !!(live.isShadowBanned || live.isRemoved || live.rejected || !live.approved);

/** Is the host still allowed to broadcast? */
const hostMayStream = async (hostId) => {
  const host = await User.findById(hostId)
    .select('isBanned isDeactivated canGoLive restrictions')
    .lean();
  return !!(host && !host.isBanned && !host.isDeactivated && host.canGoLive && host.restrictions?.goLive !== true);
};

const buildObsSettings = (streamKey) => {
  const server = getRtmpBase();
  return {
    server,
    streamKey,
    fullUrl: buildRtmpUrl(streamKey),
    instructions: [
      'Open OBS Studio → Settings → Stream',
      'Service: Custom',
      `Server: ${server}`,
      `Stream Key: ${streamKey}`,
      'Click OK → Start Streaming',
    ],
  };
};

// ── Input validation ──────────────────────────
const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseTags = (tags) => {
  let arr = tags;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = arr.split(',');
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    if (typeof t !== 'string') continue;
    const v = t.trim();
    if (!v || v.length > 30 || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= 10) break;
  }
  return out;
};

const parseLiveInput = (body = {}) => {
  const {
    title,
    description = '',
    thumbnailUrl = '',
    scheduledAt = null,
    category = 'general',
    tags = [],
    ageRating = 'PG',
  } = body;

  if (typeof title !== 'string' || !title.trim()) return { error: 'Title is required.' };
  if (title.trim().length > 200) return { error: 'Title must be 200 characters or fewer.' };
  if (typeof description !== 'string') return { error: 'Description must be text.' };
  if (description.length > 5000) return { error: 'Description must be 5000 characters or fewer.' };
  if (
    typeof thumbnailUrl !== 'string' ||
    thumbnailUrl.length > 2048 ||
    (thumbnailUrl && !isHttpUrl(thumbnailUrl) && !thumbnailUrl.startsWith('/uploads/'))
  ) {
    return { error: 'Thumbnail must be a valid http(s) URL.' };
  }
  if (typeof category !== 'string' || category.length > 50) return { error: 'Invalid category.' };
  if (!LIVE_RATINGS.includes(ageRating)) return { error: 'Invalid age rating.' };

  let when = null;
  if (scheduledAt) {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return { error: 'Invalid scheduled date.' };
    if (d.getTime() < Date.now() - 5 * 60 * 1000) return { error: 'Scheduled time must be in the future.' };
    if (d.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) return { error: 'Scheduled time is too far ahead.' };
    when = d;
  }

  return {
    value: {
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl,
      scheduledAt: when,
      category: category.trim() || 'general',
      tags: parseTags(tags),
      ageRating,
    },
  };
};

const logAdminAction = async ({
  admin, actionType, actionLabel, targetType, targetId,
  targetName, targetEmail, description, reason, ipAddress, userAgent, metadata = {},
}) => {
  try {
    await new AdminAuditLog({
      adminId: admin._id,
      adminName: admin.name || admin.username || 'Admin',
      adminRole: admin.role,
      adminEmail: admin.email,
      actionType, actionLabel, targetType, targetId,
      targetName, targetEmail, description, reason,
      ipAddress, userAgent, metadata,
    }).save();
  } catch (err) {
    console.error('[AuditLog] Failed to save:', err.message);
  }
};

const getUserVideoStats = async (userId) => {
  try {
    const videos = await Video.find({
      creator: userId,
      approved: true,
      isDeleted: { $ne: true },
    }).select('views');
    return {
      approvedVideoCount: videos.length,
      totalVideoViews: videos.reduce((s, v) => s + (v.views || 0), 0),
    };
  } catch {
    return { approvedVideoCount: 0, totalVideoViews: 0 };
  }
};

const calcActiveStrikes = (strikes) => {
  if (!Array.isArray(strikes)) return 0;
  const cutoff = new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000);
  return strikes.filter((s) => new Date(s.date) > cutoff).length;
};

const calcAccountAgeDays = (createdAt) =>
  createdAt ? Math.floor((Date.now() - new Date(createdAt)) / 86400000) : 0;

/**
 * Full qualification check — returns a structured result object
 */
const resolveQualification = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { qualified: false, reason: 'user_not_found' };

  // Manual admin approval always wins
  if (user.canGoLive && user.canGoLiveReason === 'manual_admin_approval') {
    return { qualified: true, reason: 'manual_admin_approval' };
  }

  // Revoked
  if (!user.canGoLive && user.canGoLiveReason === 'revoked') {
    return {
      qualified: false,
      reason: 'revoked',
      message: 'Your live streaming privileges have been revoked by an admin.',
    };
  }

  const accountAgeDays = calcAccountAgeDays(user.createdAt);
  const activeStrikes = calcActiveStrikes(user.liveStrikes);
  const { approvedVideoCount, totalVideoViews } = await getUserVideoStats(userId);

  const needs = { videos: 3, views: 500, days: 30 };

  const met = {
    videos: approvedVideoCount >= needs.videos,
    views: totalVideoViews >= needs.views,
    days: accountAgeDays >= needs.days,
    noStrikes: activeStrikes === 0,
  };

  const qualified = met.videos && met.views && met.days && met.noStrikes;

  if (qualified && !user.canGoLive) {
    // Auto-qualify
    user.canGoLive = true;
    user.canGoLiveReason = 'auto_qualified';
    user.canGoLiveGrantedAt = new Date();
    user.canGoLiveGrantedBy = null;
    user.approvedVideoCount = approvedVideoCount;
    user.totalVideoViews = totalVideoViews;
    user.liveQualificationCheckedAt = new Date();
    await user.save({ validateBeforeSave: false });
  }

  return {
    qualified,
    reason: qualified ? 'auto_qualified' : 'requirements_not_met',
    stats: { approvedVideoCount, totalVideoViews, accountAgeDays, activeStrikes },
    requirements: needs,
    met,
    missing: {
      videos: Math.max(0, needs.videos - approvedVideoCount),
      views: Math.max(0, needs.views - totalVideoViews),
      days: Math.max(0, needs.days - accountAgeDays),
      strikes: activeStrikes,
    },
    message: qualified
      ? 'You are qualified to go live!'
      : buildUnqualifiedMessage(met, { approvedVideoCount, totalVideoViews, accountAgeDays, activeStrikes }, needs),
  };
};

const buildUnqualifiedMessage = (met, stats, needs) => {
  const parts = [];
  if (!met.videos)
    parts.push(`${needs.videos - stats.approvedVideoCount} more approved video(s) needed`);
  if (!met.views)
    parts.push(`${needs.views - stats.totalVideoViews} more total views needed`);
  if (!met.days)
    parts.push(`account must be ${needs.days - stats.accountAgeDays} more day(s) old`);
  if (!met.noStrikes)
    parts.push(`${stats.activeStrikes} active strike(s) must be resolved`);
  return parts.length
    ? `To go live you need: ${parts.join(', ')}.`
    : 'Requirements not met.';
};


// ─────────────────────────────────────────────
// CHECK LIVE QUALIFICATION (GET /lives/check-qualification)
// ─────────────────────────────────────────────
const checkLiveQualification = async (req, res) => {
  try {
    const qualification = await resolveQualification(req.user._id);
    const user = await User.findById(req.user._id).select(
      'canGoLive canGoLiveReason approvedVideoCount totalVideoViews liveStrikes'
    );

    res.json({
      success: true,
      qualification,
      user: {
        _id: user._id,
        canGoLive: user.canGoLive,
        canGoLiveReason: user.canGoLiveReason,
        approvedVideoCount: user.approvedVideoCount,
        totalVideoViews: user.totalVideoViews,
        strikeCount: calcActiveStrikes(user.liveStrikes),
      },
    });
  } catch (err) {
    console.error('checkLiveQualification error:', err);
    res.status(500).json({ success: false, message: 'Failed to check qualification' });
  }
};


// ─────────────────────────────────────────────
// CREATE LIVE  (POST /lives)
// ─────────────────────────────────────────────
const createLive = async (req, res) => {
  try {
    if (req.user.isShadowBanned) {
      return res.status(403).json({ success: false, message: 'Shadow banned users cannot create live streams.' });
    }
    if (req.user.restrictions?.goLive === true) {
      return res.status(403).json({ success: false, message: 'Your account is restricted from going live.' });
    }

    const qualification = await resolveQualification(req.user._id);
    if (!qualification.qualified) {
      return res.status(403).json({
        success: false,
        message: qualification.message || 'You do not have live streaming privileges.',
        qualification,
        notQualified: true,
      });
    }

    const parsed = parseLiveInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const input = parsed.value;

    // Abuse guard: a host can only create a handful of streams per hour.
    const recent = await Live.countDocuments({
      host: req.user._id,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recent >= MAX_LIVES_PER_HOUR) {
      return res.status(429).json({
        success: false,
        message: 'You are creating live streams too quickly. Please try again later.',
      });
    }

    // Two SEPARATE tokens: secret ingest key (host only) + public playback id.
    const streamKey = generateStreamKey();
    const playbackId = generatePlaybackId();
    const rtmpUrl = buildRtmpUrl(streamKey);
    const hlsUrl = buildHlsUrl(playbackId);

    // NOTE: kept from the previous version — a non-scheduled stream starts as
    // 'live' immediately. The new frontend should move it to 'live' only when
    // the encoder connects (the RTMP server already does this in postPublish).
    const live = await Live.create({
      title: input.title,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl,
      host: req.user._id,
      status: input.scheduledAt ? 'scheduled' : 'live',
      scheduledAt: input.scheduledAt,
      isPaid: false,
      price: 0,
      currency: 'USD',
      purchases: [],
      isSponsored: false,
      isFundraiser: false,
      category: input.category,
      tags: input.tags,
      ageRating: input.ageRating,
      viewers: [],
      peakViewers: 0,
      totalViews: 0,
      chatEnabled: true,
      chatSlowMode: false,
      approved: true,
      isDeleted: false,
      playbackId,
      streamKey,
      rtmpUrl,
      hlsUrl,
    });

    console.log(`🎬 Live created: "${live.title}" by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Live stream created successfully.',
      live: {
        ...serializeLive(live, { isHost: true, streamKey, rtmpUrl, viewerCount: 0 }),
        obsSettings: buildObsSettings(streamKey),
        browserStreamUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/live/broadcast/${live._id}`,
      },
    });
  } catch (err) {
    console.error('createLive error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create live stream.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// ─────────────────────────────────────────────
// GET LIVE FEED  (GET /lives)  — PUBLIC, never contains secrets
// ─────────────────────────────────────────────
const getLiveFeed = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 50);

    const filter = {
      isDeleted: false,
      isShadowBanned: { $ne: true },
      isRemoved: { $ne: true },
      rejected: { $ne: true },
      approved: true,
      status: { $in: ['live', 'scheduled'] },
    };
    if (req.user?.country) filter.blockedCountries = { $ne: req.user.country };
    if (req.user?.continent) filter.blockedContinents = { $ne: req.user.continent };

    const lives = await Live.find(filter)
      .select(
        'title description thumbnailUrl host status scheduledAt startedAt endedAt duration category tags ' +
          'ageRating viewers peakViewers totalViews chatEnabled chatSlowMode approved playbackId createdAt ' +
          'blockedCountries blockedContinents'
      )
      .populate('host', HOST_FIELDS)
      .sort({ status: -1, startedAt: -1, scheduledAt: 1 })
      .limit(limit)
      .lean();

    const result = lives.map((live) => {
      const access = evaluateAccess(live, req.user);
      return serializeLive(live, {
        viewerCount: (live.viewers?.length || 0) + getGuestViewerCount(live._id),
        allowPlayback: access.allowed,
      });
    });

    res.json({ success: true, lives: result, count: result.length });
  } catch (err) {
    console.error('getLiveFeed error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch live streams.' });
  }
};

// ─────────────────────────────────────────────
// GET STREAM STATUS  (GET /lives/:id or /lives/:id/status)
// ─────────────────────────────────────────────
const getStreamStatus = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).populate('host', HOST_FIELDS).lean();
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    const isHostUser = !!req.user && sameId(live.host?._id, req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (isHiddenFromPublic(live) && !isHostUser && !isAdminUser) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    const access = evaluateAccess(live, req.user, { bypass: isHostUser || isAdminUser });
    if (live.status === 'live' || isHostUser) await backfillPlaybackId(live);

    const secrets = isHostUser ? await loadHostSecrets(live._id) : {};
    const viewerCount = (live.viewers?.length || 0) + getGuestViewerCount(live._id);

    res.json({
      success: true,
      live: {
        ...serializeLive(live, { isHost: isHostUser, viewerCount, allowPlayback: access.allowed, ...secrets }),
        access,
      },
    });
  } catch (err) {
    console.error('getStreamStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to get stream status.' });
  }
};

// ─────────────────────────────────────────────
// JOIN / WATCH LIVE  (POST /lives/:id/join)  — guests and users
// ─────────────────────────────────────────────
const joinLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).populate('host', HOST_FIELDS);
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    const isHostUser = !!req.user && sameId(live.host?._id, req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (isHiddenFromPublic(live) && !isHostUser && !isAdminUser) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    if (live.status !== 'live') {
      return res.status(400).json({
        success: false,
        message:
          live.status === 'scheduled'
            ? `This stream is scheduled for ${live.scheduledAt ? new Date(live.scheduledAt).toLocaleString() : 'later'}.`
            : live.status === 'ended'
              ? 'This stream has ended.'
              : 'Stream is not yet live.',
        status: live.status,
        scheduledAt: live.scheduledAt,
      });
    }

    const access = evaluateAccess(live, req.user, { bypass: isHostUser || isAdminUser });
    if (!access.allowed) {
      return res.status(403).json({ success: false, code: access.code, message: access.message });
    }

    await backfillPlaybackId(live);

    // Track the viewer atomically (no read-modify-write race).
    let userViewers = live.viewers?.length || 0;
    if (req.user) {
      const updated = await Live.findOneAndUpdate(
        { _id: live._id, viewers: { $ne: req.user._id } },
        { $addToSet: { viewers: req.user._id }, $inc: { totalViews: 1 } },
        { new: true, projection: { viewers: 1 } }
      ).lean();
      if (updated) userViewers = updated.viewers.length;
    } else if (req.isGuest && req.guestId) {
      const { isNew } = trackGuestViewer(live._id, req.guestId);
      if (isNew) await Live.updateOne({ _id: live._id }, { $inc: { totalViews: 1 } });
    }

    const viewerCount = userViewers + getGuestViewerCount(live._id);
    await Live.updateOne({ _id: live._id, peakViewers: { $lt: viewerCount } }, { $set: { peakViewers: viewerCount } });

    const io = req.app.get('io');
    if (io) io.to(`live:${live._id}`).emit('viewer:update', { viewerCount });

    const secrets = isHostUser ? await loadHostSecrets(live._id) : {};

    res.json({
      success: true,
      live: serializeLive(live, { isHost: isHostUser, viewerCount, ...secrets }),
    });
  } catch (err) {
    console.error('joinLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to join live stream.' });
  }
};

// ─────────────────────────────────────────────
// CHECK LIVE ACCESS  (GET /lives/:id/access)
// ─────────────────────────────────────────────
const checkLiveAccess = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).lean();
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    const isHostUser = !!req.user && sameId(live.host, req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (isHiddenFromPublic(live) && !isHostUser && !isAdminUser) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    const access = evaluateAccess(live, req.user, { bypass: isHostUser || isAdminUser });
    if (live.status === 'live' || isHostUser) await backfillPlaybackId(live);

    const secrets = isHostUser ? await loadHostSecrets(live._id) : {};
    const ser = serializeLive(live, { isHost: isHostUser, allowPlayback: access.allowed, ...secrets });

    res.json({
      success: true,
      hasAccess: access.allowed,
      code: access.code,
      message: access.message,
      isHost: isHostUser,
      isAdmin: isAdminUser,
      playbackUrl: ser.playbackUrl,
      hlsUrl: ser.hlsUrl,
      streamKey: live.status === 'live' || isHostUser ? ser.streamKey : undefined,
      status: live.status,
      title: live.title,
      chatEnabled: live.chatEnabled,
    });
  } catch (err) {
    console.error('checkLiveAccess error:', err);
    res.status(500).json({ success: false, message: 'Failed to check live access.' });
  }
};

// ─────────────────────────────────────────────
// START STREAM  (POST /lives/:id/start)
// ─────────────────────────────────────────────
const startStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).select('+streamKey +rtmpUrl');
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    const isHostUser = sameId(live.host, req.user._id);
    if (!isHostUser && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to start this stream.' });
    }

    if (live.isRemoved || live.rejected || live.adminEnded || live.forceClosed || live.status === 'cancelled') {
      return res.status(403).json({ success: false, message: 'This stream can no longer be started.' });
    }
    if (!live.approved) {
      return res.status(403).json({ success: false, message: 'This stream is awaiting approval.' });
    }
    if (isHostUser && !(await hostMayStream(live.host))) {
      return res.status(403).json({ success: false, message: 'You are not allowed to go live right now.' });
    }

    await backfillPlaybackId(live);
    const hlsUrl = buildHlsUrl(live.playbackId);
    const hostView = isHostUser ? { streamKey: live.streamKey, rtmpUrl: live.rtmpUrl } : {};

    if (live.status === 'live') {
      return res.json({
        success: true,
        message: 'Stream is already live.',
        live: serializeLive(live, { isHost: isHostUser, ...hostView }),
      });
    }

    live.status = 'live';
    live.startedAt = new Date();
    live.endedAt = null;
    live.viewers = [];
    live.hlsUrl = hlsUrl;
    await live.save({ validateBeforeSave: false });
    clearGuestViewers(live._id);

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:started', {
        liveId: live._id,
        title: live.title,
        hlsUrl,
        playbackId: live.playbackId,
        streamKey: live.playbackId, // LEGACY COMPAT: public id under the old field name — never the secret
        startedAt: live.startedAt,
      });
      io.emit('feed:stream:started', { liveId: live._id, title: live.title });
    }

    console.log(`📡 Stream started: "${live.title}" by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Stream started.',
      live: serializeLive(live, { isHost: isHostUser, ...hostView }),
    });
  } catch (err) {
    console.error('startStream error:', err);
    res.status(500).json({ success: false, message: 'Failed to start stream.' });
  }
};

// ─────────────────────────────────────────────
// STOP STREAM  (POST /lives/:id/stop)
// ─────────────────────────────────────────────
const stopStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).select('+streamKey');
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    const isHostUser = sameId(live.host, req.user._id);
    if (!isHostUser && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to stop this stream.' });
    }

    if (live.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Stream is not currently live.', status: live.status });
    }

    const endedAt = new Date();
    const duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;

    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = duration;
    await live.save({ validateBeforeSave: false });

    // Actually cut the encoder + HLS output (previously only the DB flag changed).
    const streamingServer = getStreamingServer();
    if (live.streamKey && streamingServer?.forceStop) streamingServer.forceStop(live.streamKey);
    clearGuestViewers(live._id);

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:ended', {
        liveId: live._id,
        duration,
        endedAt,
        message: 'The streamer has ended this broadcast.',
      });
      io.emit('feed:stream:ended', { liveId: live._id });
    }

    console.log(`🛑 Stream stopped: "${live.title}" — ${duration}s`);

    res.json({
      success: true,
      message: 'Stream stopped.',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        duration,
        peakViewers: live.peakViewers,
        totalViews: live.totalViews,
        endedAt,
      },
    });
  } catch (err) {
    console.error('stopStream error:', err);
    res.status(500).json({ success: false, message: 'Failed to stop stream.' });
  }
};

// ─────────────────────────────────────────────
// ROTATE STREAM KEY  (POST /lives/:id/rotate-key)  — NEW, host only
// Replaces a leaked/compromised key and kicks whoever is using the old one.
// ─────────────────────────────────────────────
const rotateStreamKey = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id).select('+streamKey +rtmpUrl');
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }
    if (!sameId(live.host, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the host can rotate the stream key.' });
    }
    if (live.isRemoved || live.rejected || live.adminEnded || live.forceClosed || live.status === 'cancelled') {
      return res.status(403).json({ success: false, message: 'This stream can no longer be modified.' });
    }

    const oldKey = live.streamKey;
    const newKey = generateStreamKey();
    live.streamKey = newKey;
    live.rtmpUrl = buildRtmpUrl(newKey);
    live.streamUrl = live.rtmpUrl;
    await live.save({ validateBeforeSave: false });

    // Kick any publisher still using the old key.
    const streamingServer = getStreamingServer();
    if (oldKey && streamingServer?.forceStop) streamingServer.forceStop(oldKey);

    await backfillPlaybackId(live);

    res.json({
      success: true,
      message: 'Stream key rotated. Update your encoder with the new key.',
      live: {
        ...serializeLive(live, { isHost: true, streamKey: newKey, rtmpUrl: live.rtmpUrl }),
        obsSettings: buildObsSettings(newKey),
      },
    });
  } catch (err) {
    console.error('rotateStreamKey error:', err);
    res.status(500).json({ success: false, message: 'Failed to rotate stream key.' });
  }
};

// ─────────────────────────────────────────────
// GET USER'S OWN LIVE STREAMS  (GET /lives/my)
// ─────────────────────────────────────────────
const getMyLives = async (req, res) => {
  try {
    const lives = await Live.find({ host: req.user._id, isDeleted: false })
      .select('+streamKey +rtmpUrl')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const result = lives.map((live) => {
      const stillUsable = !['ended', 'cancelled'].includes(live.status);
      return serializeLive(live, {
        isHost: true,
        streamKey: stillUsable ? live.streamKey : undefined,
        rtmpUrl: stillUsable ? live.rtmpUrl : undefined,
      });
    });

    res.json({ success: true, lives: result, count: result.length });
  } catch (err) {
    console.error('getMyLives error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch your streams.' });
  }
};

// ─────────────────────────────────────────────
// PURCHASE LIVE — DISABLED (all free)
// ─────────────────────────────────────────────
const purchaseLive = async (req, res) => {
  res.json({ success: true, message: 'All live streams are currently free. Enjoy!' });
};


// ─────────────────────────────────────────────
// ADMIN: UPDATE LIVE STATUS  (PATCH /lives/:id/status)
// ─────────────────────────────────────────────
const updateLiveStatus = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const { status, removalReason } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    const wasLive = live.status === 'live';
    live.approved = status === 'approved';
    live.rejected = status === 'rejected';
    if (status === 'cancelled') live.status = 'cancelled';
    live.removalReason = status === 'rejected' ? removalReason || 'No reason provided' : '';
    live.approvedBy = req.user._id;

    // Rejecting/cancelling a stream that is on air must actually take it off air.
    const stopNow = wasLive && (status === 'rejected' || status === 'cancelled');
    if (stopNow) {
      if (status === 'rejected') live.status = 'ended';
      live.endedAt = new Date();
      live.duration = live.startedAt ? Math.floor((live.endedAt - live.startedAt) / 1000) : 0;
      live.forceClosed = true;
    }

    await live.save({ validateBeforeSave: false });

    if (stopNow) {
      await killPipeline(live._id);
      const ioStop = req.app.get('io');
      if (ioStop) {
        ioStop.to(`live:${live._id}`).emit('stream:ended', {
          liveId: live._id,
          message: 'This stream has been ended by an admin.',
          adminEnded: true,
        });
      }
    }

    // Notify host
    const notifMap = {
      approved: {
        title: 'Live Stream Approved ✅',
        message: `Your stream "${live.title}" has been approved. You can now go live!`,
        priority: 'high',
      },
      rejected: {
        title: 'Live Stream Rejected',
        message: `Your stream "${live.title}" was rejected. Reason: ${removalReason || 'Content guidelines violation'}.`,
        priority: 'high',
      },
      cancelled: {
        title: 'Live Stream Cancelled',
        message: `Your stream "${live.title}" has been cancelled by an admin.`,
        priority: 'normal',
      },
    };

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host,
        type: 'admin',
        ...notifMap[status],
        triggeredBy: req.user._id,
        data: { liveId: live._id, liveTitle: live.title },
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: `LIVE_${status.toUpperCase()}`,
      actionLabel: `${status.charAt(0).toUpperCase() + status.slice(1)} Live Stream`,
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `${status} live stream "${live.title}"`,
      reason: removalReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { liveId: live._id },
    });

    // Notify via socket if approved
    const io = req.app.get('io');
    if (io && status === 'approved') {
      io.to(`user:${live.host}`).emit('live:approved', { liveId: live._id, title: live.title });
    }

    res.json({ success: true, message: `Live stream ${status}.`, live: live.toObject() });
  } catch (err) {
    console.error('updateLiveStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SHADOW BAN LIVE  (PATCH /lives/:id/shadow-ban)
// ─────────────────────────────────────────────
const shadowBanLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    live.isShadowBanned = !live.isShadowBanned;
    await live.save({ validateBeforeSave: false });

    await logAdminAction({
      admin: req.user,
      actionType: live.isShadowBanned ? 'SHADOW_BAN_LIVE' : 'REMOVE_SHADOW_BAN_LIVE',
      actionLabel: live.isShadowBanned ? 'Shadow Ban Live' : 'Remove Shadow Ban',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `${live.isShadowBanned ? 'Applied' : 'Removed'} shadow ban on "${live.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: `Shadow ban ${live.isShadowBanned ? 'applied' : 'removed'}.`, isShadowBanned: live.isShadowBanned });
  } catch (err) {
    console.error('shadowBanLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle shadow ban.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: DELETE LIVE  (DELETE /lives/:id)
// ─────────────────────────────────────────────
const deleteLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    live.isDeleted = true;
    if (live.status === 'live') {
      live.status = 'ended';
      live.endedAt = new Date();
      const io = req.app.get('io');
      if (io) {
        io.to(`live:${live._id}`).emit('stream:ended', {
          liveId: live._id,
          message: 'This stream has been removed by an admin.',
        });
      }
    }
    await live.save({ validateBeforeSave: false });
    await killPipeline(live._id);

    await logAdminAction({
      admin: req.user,
      actionType: 'DELETE_LIVE',
      actionLabel: 'Delete Live Stream',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `Deleted live stream "${live.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Live stream deleted.' });
  } catch (err) {
    console.error('deleteLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete live stream.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SET LIVE PRIVILEGE  (POST /lives/privileges)
// ─────────────────────────────────────────────
const setLivePrivilege = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (req.user.role === 'supportadmin') {
      return res.status(403).json({ success: false, message: 'Support admins cannot modify live privileges.' });
    }

    const { userId, reason } = req.body;
    const canGoLive = req.body.canGoLive === true || req.body.canGoLive === 'true';
    if (!isObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' });
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    if (canGoLive) {
      await targetUser.grantLivePrivilege(req.user._id);
    } else {
      await targetUser.revokeLivePrivilege(req.user._id, reason || 'Revoked by admin');
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'admin',
        title: canGoLive ? '🎬 Live Streaming Access Granted' : '🚫 Live Streaming Access Revoked',
        message: canGoLive
          ? 'Admin has granted you live streaming privileges! You can now go live.'
          : `Admin has revoked your live streaming privileges. Reason: ${reason || 'Policy violation'}.`,
        priority: 'high',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: canGoLive ? 'GRANT_LIVE_PRIVILEGE' : 'REVOKE_LIVE_PRIVILEGE',
      actionLabel: canGoLive ? 'Grant Live Privilege' : 'Revoke Live Privilege',
      targetType: 'User',
      targetId: targetUser._id,
      targetName: targetUser.name || targetUser.email,
      targetEmail: targetUser.email,
      description: `${canGoLive ? 'Granted' : 'Revoked'} live privileges for ${targetUser.email}`,
      reason: reason || (canGoLive ? 'Manual approval' : 'Revoked by admin'),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: `Live privileges ${canGoLive ? 'granted' : 'revoked'}.`,
      user: {
        _id: targetUser._id,
        canGoLive: targetUser.canGoLive,
        canGoLiveReason: targetUser.canGoLiveReason,
      },
    });
  } catch (err) {
    console.error('setLivePrivilege error:', err);
    res.status(500).json({ success: false, message: 'Failed to update live privilege.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: ADD LIVE STRIKE  (POST /lives/strikes)
// ─────────────────────────────────────────────
const addLiveStrike = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { userId, reason } = req.body;
    if (!isObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid user id.' });
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    await targetUser.addLiveStrike(reason, req.user._id);
    const strikeCount = calcActiveStrikes(targetUser.liveStrikes);

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'admin',
        title: '⚠️ Live Streaming Strike',
        message: `You have received a live streaming strike (${strikeCount}/5). Reason: ${reason || 'Violation of guidelines'}.${strikeCount >= 5 ? ' Your live privileges have been revoked.' : ''}`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'ADD_LIVE_STRIKE',
      actionLabel: 'Add Live Strike',
      targetType: 'User',
      targetId: targetUser._id,
      targetName: targetUser.name || targetUser.email,
      targetEmail: targetUser.email,
      description: `Added live strike to ${targetUser.email}`,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { strikeCount },
    });

    res.json({
      success: true,
      message: 'Strike added.',
      strikeCount,
      canGoLive: targetUser.canGoLive,
    });
  } catch (err) {
    console.error('addLiveStrike error:', err);
    res.status(500).json({ success: false, message: 'Failed to add strike.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: REMOVE STRIKE  (DELETE /lives/strikes/:id/:strikeId)
// ─────────────────────────────────────────────
const removeStrike = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { id: userId, strikeId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const idx = user.liveStrikes.findIndex((s) => s._id.toString() === strikeId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Strike not found.' });

    const removed = user.liveStrikes.splice(idx, 1)[0];
    await user.save({ validateBeforeSave: false });

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: user._id,
        type: 'admin',
        title: '✅ Live Strike Removed',
        message: `Admin has removed a strike from your account. You now have ${calcActiveStrikes(user.liveStrikes)} active strike(s).`,
        priority: 'normal',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_LIVE_STRIKE',
      actionLabel: 'Remove Live Strike',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Removed live strike from ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Strike removed.', removedStrike: removed });
  } catch (err) {
    console.error('removeStrike error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove strike.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET USER LIVE DETAILS  (GET /lives/user/:userId)
// ─────────────────────────────────────────────
const getUserLiveDetails = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const targetUser = await User.findById(req.params.userId)
      .select('name email canGoLive canGoLiveReason canGoLiveGrantedAt approvedVideoCount totalVideoViews liveStrikes createdAt isShadowBanned')
      .lean();

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const videoStats = await getUserVideoStats(targetUser._id);
    const userLives = await Live.find({ host: req.params.userId })
      .select('title status startedAt endedAt viewers peakViewers totalViews createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const accountAgeDays = calcAccountAgeDays(targetUser.createdAt);
    const activeStrikes = calcActiveStrikes(targetUser.liveStrikes);

    res.json({
      success: true,
      user: {
        ...targetUser,
        approvedVideoCount: videoStats.approvedVideoCount,
        totalVideoViews: videoStats.totalVideoViews,
        accountAgeDays,
        activeStrikes,
        liveStreams: userLives,
        totalStreams: userLives.length,
        activeStreams: userLives.filter((l) => l.status === 'live').length,
        qualificationStatus: {
          approvedVideos: videoStats.approvedVideoCount,
          totalViews: videoStats.totalVideoViews,
          accountAgeDays,
          activeStrikes,
          meetsVideos: videoStats.approvedVideoCount >= 3,
          meetsViews: videoStats.totalVideoViews >= 500,
          meetsDays: accountAgeDays >= 30,
          meetsStrikes: activeStrikes === 0,
          qualifiesAutomatically:
            videoStats.approvedVideoCount >= 3 &&
            videoStats.totalVideoViews >= 500 &&
            accountAgeDays >= 30 &&
            activeStrikes === 0,
        },
      },
    });
  } catch (err) {
    console.error('getUserLiveDetails error:', err);
    res.status(500).json({ success: false, message: 'Failed to get user live details.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET ALL LIVE STREAMS  (GET /admin/lives)
// ─────────────────────────────────────────────
const getAdminLiveStreams = async (req, res) => {
  try {
    const LIVE_STATUSES = ['pending', 'scheduled', 'live', 'ended', 'cancelled'];
    const { status, search } = req.query;
    const page = clampInt(req.query.page, 1, 100000, 1);
    const limit = clampInt(req.query.limit, 1, 100, 20);

    const filter = { isDeleted: false };
    if (typeof status === 'string' && LIVE_STATUSES.includes(status)) filter.status = status;
    if (typeof search === 'string' && search.trim()) {
      filter.$or = [{ title: { $regex: escapeRegex(search.trim().slice(0, 100)), $options: 'i' } }];
    }

    const skip = (page - 1) * limit;
    const [lives, total] = await Promise.all([
      Live.find(filter)
        .populate('host', 'name email avatar isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Live.countDocuments(filter),
    ]);

    res.json({
      success: true,
      lives,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getAdminLiveStreams error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch live streams.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET LIVE STREAM DETAILS  (GET /admin/lives/:id)
// ─────────────────────────────────────────────
const getAdminLiveStreamDetails = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'name email avatar isVerified canGoLive liveStrikes')
      .lean();

    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    res.json({ success: true, live });
  } catch (err) {
    console.error('getAdminLiveStreamDetails error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch details.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: END LIVE STREAM  (POST /admin/lives/:id/end)
// ─────────────────────────────────────────────
const endLiveStreamAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });
    if (live.status !== 'live') return res.status(400).json({ success: false, message: 'Stream is not live.' });

    const endedAt = new Date();
    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;
    live.adminEnded = true;
    live.adminEndedBy = req.user._id;
    live.adminEndedReason = String(req.body.reason || 'Terminated by admin').slice(0, 500);
    live.forceClosed = true;
    await live.save({ validateBeforeSave: false });
    await killPipeline(live._id);

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:ended', {
        liveId: live._id,
        message: `Stream ended by admin: ${live.adminEndedReason}`,
        adminEnded: true,
      });
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host,
        type: 'admin',
        title: '🛑 Live Stream Ended by Admin',
        message: `Your stream "${live.title}" was ended by admin. Reason: ${live.adminEndedReason}`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    if (req.body.addStrike) {
      const host = await User.findById(live.host);
      if (host) await host.addLiveStrike(`Stream terminated: ${req.body.reason || 'Policy violation'}`, req.user._id);
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'END_LIVE_STREAM',
      actionLabel: 'Admin End Live Stream',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `Admin ended stream "${live.title}"`,
      reason: live.adminEndedReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Live stream terminated.', live: { _id: live._id, status: live.status } });
  } catch (err) {
    console.error('endLiveStreamAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to end stream.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SEND WARNING  (POST /admin/lives/:id/warn)
// ─────────────────────────────────────────────
const sendStreamWarning = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { warningType, reason, addStrike } = req.body;
    const live = await Live.findById(req.params.id).populate('host', 'name email');
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    const host = await User.findById(live.host._id);
    if (!host) return res.status(404).json({ success: false, message: 'Host not found.' });

    if (addStrike) {
      await host.addLiveStrike(reason || 'Live stream violation', req.user._id);
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host._id,
        type: 'admin',
        title: addStrike ? '⚠️ Live Strike Issued' : '⚠️ Live Stream Warning',
        message: `Your stream "${live.title}" received ${addStrike ? 'a strike' : 'a warning'}. Reason: ${reason || 'Violation of guidelines'}.`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:warning', {
        message: `Admin warning: ${reason || 'Review community guidelines.'}`,
        type: addStrike ? 'strike' : 'warning',
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: addStrike ? 'ADD_LIVE_STRIKE' : 'SEND_STREAM_WARNING',
      actionLabel: addStrike ? 'Strike via Warning' : 'Send Stream Warning',
      targetType: 'User',
      targetId: host._id,
      targetName: host.name || host.email,
      targetEmail: host.email,
      description: `${addStrike ? 'Added strike to' : 'Warned'} host of "${live.title}"`,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: addStrike ? 'Strike issued.' : 'Warning sent.' });
  } catch (err) {
    console.error('sendStreamWarning error:', err);
    res.status(500).json({ success: false, message: 'Failed to send warning.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: APPLY/REMOVE SHADOW BAN  (separate endpoints)
// ─────────────────────────────────────────────
const applyShadowBanToLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Not found.' });
    live.isShadowBanned = true;
    live.shadowBanReason = req.body.reason || 'Violation';
    live.shadowBannedBy = req.user._id;
    live.shadowBannedAt = new Date();
    await live.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Shadow ban applied.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

const removeShadowBanFromLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Not found.' });
    live.isShadowBanned = false;
    live.shadowBanReason = null;
    live.shadowBannedBy = null;
    live.shadowBannedAt = null;
    await live.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Shadow ban removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: BAN USER FROM STREAMING  (POST /admin/users/:id/ban-streaming)
// ─────────────────────────────────────────────
const banUserFromStreaming = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await user.revokeLivePrivilege(req.user._id, req.body.reason || 'Banned from streaming');

    // End any active streams
    const activeUserStreams = await Live.find({ host: user._id, status: 'live' });
    const io = req.app.get('io');
    for (const stream of activeUserStreams) {
      stream.status = 'ended';
      stream.endedAt = new Date();
      stream.forceClosed = true;
      await stream.save({ validateBeforeSave: false });
      await killPipeline(stream._id);
      if (io) {
        io.to(`live:${stream._id}`).emit('stream:ended', {
          liveId: stream._id,
          message: 'This stream has been ended by an admin.',
          adminEnded: true,
        });
      }
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: user._id,
        type: 'admin',
        title: '🚫 Banned from Live Streaming',
        message: `Admin has banned you from live streaming. Reason: ${req.body.reason || 'Policy violation'}.`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'BAN_FROM_STREAMING',
      actionLabel: 'Ban User from Streaming',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Banned ${user.email} from live streaming`,
      reason: req.body.reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'User banned from streaming.', activeStreamsEnded: activeUserStreams.length });
  } catch (err) {
    console.error('banUserFromStreaming error:', err);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// Stub for getLiveStreamReports
const getLiveStreamReports = async (req, res) => {
  res.json({ success: true, reports: [], count: 0 });
};


// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
module.exports = {
  checkLiveQualification,
  createLive,
  getLiveFeed,
  getStreamStatus,
  joinLive,
  checkLiveAccess,
  startStream,
  stopStream,
  rotateStreamKey,
  getMyLives,
  purchaseLive,
  updateLiveStatus,
  shadowBanLive,
  deleteLive,
  setLivePrivilege,
  addLiveStrike,
  removeStrike,
  getUserLiveDetails,
  getAdminLiveStreams,
  getAdminLiveStreamDetails,
  endLiveStreamAdmin,
  sendStreamWarning,
  getLiveStreamReports,
  applyShadowBanToLive,
  removeShadowBanFromLive,
  banUserFromStreaming,
};

// ═══ END OF FILE: backend/controllers/liveController.js ═══