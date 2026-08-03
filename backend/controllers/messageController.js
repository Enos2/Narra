/**
 * controllers/messageController.js
 *
 * All endpoints normalise to req.actor (set by messagingMiddleware.resolveActor).
 *
 * Routes:
 *   POST   /api/messages/conversations          — start or retrieve a conversation
 *   GET    /api/messages/conversations          — list my conversations
 *   GET    /api/messages/conversations/:id      — get one conversation + messages
 *   POST   /api/messages/conversations/:id      — send a message
 *   PUT    /api/messages/conversations/:id/read — mark conversation as read
 *   PUT    /api/messages/:messageId             — edit a message (sender only, 10 min window)
 *   DELETE /api/messages/:messageId             — delete a message (scope: 'me' | 'everyone')
 *
 *   — Admin moderation (platform/super admin) —
 *   GET    /api/messages/admin/user-conversations       — list all user conversations
 *   GET    /api/messages/admin/user-conversations/:id   — read a user conversation
 *
 *   — Super admin only —
 *   GET    /api/messages/admin/admin-conversations      — list all admin conversations
 *   GET    /api/messages/admin/admin-conversations/:id  — read an admin conversation
 *
 * FIXED: Added debug logging for startConversation
 * FIXED: Better error handling in findOrCreate
 * NEW: editMessage — 10 minute edit window, sender only
 * NEW: deleteMessage now supports scope 'me' (hide for self, any time) vs
 *      'everyone' (soft-delete for all participants, sender only, 10 min window)
 * NEW: getConversation excludes messages the actor personally deleted, and
 *      masks content for messages deleted-for-everyone instead of hiding them
 */

const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');
const User         = require('../models/User');
const Admin        = require('../models/Admin');

let _io = null;
exports.setSocketIO = (io) => { _io = io; };

// Window (ms) within which a message can be edited, or deleted-for-everyone.
const EDIT_DELETE_WINDOW_MS = 10 * 60 * 1000;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/**
 * Populate the "other participant" info onto a conversation object.
 * Returns a plain object with the other participant's display data attached.
 */
async function attachOtherParticipant(conv, actorId) {
  const plain = conv.toObject ? conv.toObject() : { ...conv };
  const other = conv.participants.find(
    (p) => p.participantId.toString() !== actorId.toString()
  );
  if (!other) return plain;

  let profile = null;
  if (other.participantModel === 'User') {
    profile = await User.findById(other.participantId)
      .select('firstName lastName username avatar isVerified')
      .lean();
    if (profile) {
      profile.displayName = profile.username || `${profile.firstName} ${profile.lastName}`;
      profile.type = 'user';
    }
  } else {
    profile = await Admin.findById(other.participantId)
      .select('fullName role')
      .lean();
    if (profile) {
      profile.displayName = profile.fullName;
      profile.type = 'admin';
    }
  }

  plain.otherParticipant = profile;
  return plain;
}

/**
 * Determine the lane for the current actor.
 */
function laneFor(actor) {
  return actor.model === 'Admin' ? 'admin' : 'user';
}

function personalRoomFor(actor) {
  return `${actor.model === 'Admin' ? 'admin' : 'user'}:${actor.id}`;
}

/* ─────────────────────────────────────────────
   START OR RETRIEVE A CONVERSATION
   POST /api/messages/conversations
   body: { recipientId }
───────────────────────────────────────────── */
exports.startConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const actor = req.actor;

    console.log('🔍 [startConversation] Actor:', actor.id, 'Recipient:', recipientId);

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'recipientId is required' });
    }

    if (recipientId.toString() === actor.id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start a conversation with yourself' });
    }

    const lane = laneFor(actor);

    // Verify the recipient exists in the right collection
    let recipient;
    if (lane === 'user') {
      recipient = await User.findById(recipientId).select('firstName lastName username avatar isVerified');
      if (!recipient) {
        console.log('❌ [startConversation] User not found:', recipientId);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    } else {
      recipient = await Admin.findById(recipientId).select('fullName role status');
      if (!recipient) {
        console.log('❌ [startConversation] Admin not found:', recipientId);
        return res.status(404).json({ success: false, message: 'Admin not found' });
      }
      if (recipient.status === 'inactive') {
        return res.status(403).json({ success: false, message: 'That admin account is inactive' });
      }
    }

    console.log('✅ [startConversation] Recipient found, finding or creating conversation...');

    const recipientModel = lane === 'user' ? 'User' : 'Admin';

    // FIXED: Use the updated findOrCreate method
    const result = await Conversation.findOrCreate({
      lane,
      participantA: { id: actor.id, model: actor.model },
      participantB: { id: recipientId, model: recipientModel },
    });

    if (!result || !result.conversation) {
      console.error('❌ [startConversation] Failed to create conversation');
      return res.status(500).json({ success: false, message: 'Failed to create conversation' });
    }

    console.log('✅ [startConversation] Conversation:', result.conversation._id, 'Created:', result.created);

    const enriched = await attachOtherParticipant(result.conversation, actor.id);

    return res.status(result.created ? 201 : 200).json({
      success: true,
      conversation: enriched,
      created: result.created,
    });
  } catch (err) {
    console.error('❌ [startConversation] Error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/* ─────────────────────────────────────────────
   LIST MY CONVERSATIONS
   GET /api/messages/conversations
───────────────────────────────────────────── */
exports.listConversations = async (req, res) => {
  try {
    const actor = req.actor;
    const lane  = laneFor(actor);

    const conversations = await Conversation.find({
      lane,
      'participants.participantId': actor.id,
      isActive: true,
    }).sort({ updatedAt: -1 });

    const enriched = await Promise.all(
      conversations.map((c) => attachOtherParticipant(c, actor.id))
    );

    return res.json({ success: true, conversations: enriched });
  } catch (err) {
    console.error('listConversations error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   GET ONE CONVERSATION + MESSAGES
   GET /api/messages/conversations/:id
───────────────────────────────────────────── */
exports.getConversation = async (req, res) => {
  try {
    const actor = req.actor;
    const { id }  = req.params;
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 50;
    const skip    = (page - 1) * limit;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Must be a participant
    if (!conversation.hasParticipant(actor.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // NOTE: we no longer filter out isDeleted (deleted-for-everyone) messages —
    // they stay in the list so the placeholder "message deleted" renders for
    // everyone. We DO filter out messages this actor personally deleted-for-me.
    const filter = { conversationId: id, deletedFor: { $ne: actor.id } };

    const [rawMessages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments(filter),
    ]);

    // Mask content on messages deleted-for-everyone — don't leak original text.
    const messages = rawMessages.map((m) =>
      m.isDeleted ? { ...m, content: '' } : m
    );

    const enriched = await attachOtherParticipant(conversation, actor.id);

    return res.json({
      success: true,
      conversation: enriched,
      messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getConversation error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   SEND A MESSAGE
   POST /api/messages/conversations/:id
   body: { content }
───────────────────────────────────────────── */
exports.sendMessage = async (req, res) => {
  try {
    const actor   = req.actor;
    const { id }  = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.hasParticipant(actor.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Create message
    const message = await Message.create({
      conversationId: id,
      senderId:       actor.id,
      senderModel:    actor.model,
      content:        content.trim(),
    });

    // Update conversation snapshot
    conversation.lastMessage = {
      content:  content.trim().substring(0, 100),
      senderId: actor.id,
      sentAt:   new Date(),
    };
    conversation.incrementUnread(actor.id);
    await conversation.save();

    // Real-time delivery via Socket.IO
    if (_io) {
      // NOTE: this broadcasts to the whole room, including the sender's own
      // socket (they're subscribed to the room too). The frontend is
      // responsible for ignoring its own messages here, since the sender
      // already has the saved message from this HTTP response — otherwise
      // you get a duplicate bubble.
      _io.to(`conversation:${id}`).emit('new-message', {
        message,
        conversationId: id,
      });

      // Notify the other participant's personal room
      const other = conversation.getOtherParticipant(actor.id);
      if (other) {
        const roomPrefix = other.participantModel === 'Admin' ? 'admin' : 'user';
        _io.to(`${roomPrefix}:${other.participantId}`).emit('conversation-updated', {
          conversationId: id,
          lastMessage: conversation.lastMessage,
        });
      }
    }

    return res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   MARK AS READ
   PUT /api/messages/conversations/:id/read
───────────────────────────────────────────── */
exports.markAsRead = async (req, res) => {
  try {
    const actor  = req.actor;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.hasParticipant(actor.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Mark all unread messages in this conversation
    await Message.updateMany(
      {
        conversationId: id,
        senderId: { $ne: actor.id },
        'readBy.readerId': { $ne: actor.id },
        isDeleted: false,
      },
      {
        $push: {
          readBy: { readerId: actor.id, readerModel: actor.model, readAt: new Date() },
        },
      }
    );

    conversation.clearUnread(actor.id);
    await conversation.save();

    if (_io) {
      _io.to(`conversation:${id}`).emit('messages-read', {
        conversationId: id,
        readerId:       actor.id,
        readerModel:    actor.model,
        readAt:         new Date(),
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   EDIT A MESSAGE
   PUT /api/messages/:messageId
   body: { content }
   — Sender only, only within the 10 minute edit window, not deleted.
───────────────────────────────────────────── */
exports.editMessage = async (req, res) => {
  try {
    const actor = req.actor;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.senderId.toString() !== actor.id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'This message was deleted and can no longer be edited' });
    }

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > EDIT_DELETE_WINDOW_MS) {
      return res.status(403).json({ success: false, message: 'This message can only be edited within 10 minutes of sending' });
    }

    message.content  = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    if (_io) {
      _io.to(`conversation:${message.conversationId}`).emit('message-edited', {
        messageId,
        conversationId: message.conversationId.toString(),
        content:  message.content,
        editedAt: message.editedAt,
      });
    }

    return res.json({ success: true, message });
  } catch (err) {
    console.error('editMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   DELETE A MESSAGE
   DELETE /api/messages/:messageId
   body: { scope: 'me' | 'everyone' }
   — 'me'       → hides the message from the actor's own view only, any time,
                  any participant.
   — 'everyone' → soft-deletes for all participants. Sender only, and only
                  within the 10 minute window; after that, only 'me' is allowed.
───────────────────────────────────────────── */
exports.deleteMessage = async (req, res) => {
  try {
    const actor = req.actor;
    const { messageId } = req.params;
    const scope = req.body?.scope === 'everyone' ? 'everyone' : 'me';

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || !conversation.hasParticipant(actor.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    const withinWindow = ageMs <= EDIT_DELETE_WINDOW_MS;

    if (scope === 'everyone') {
      if (message.senderId.toString() !== actor.id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only delete your own messages for everyone' });
      }
      if (message.isDeleted) {
        return res.status(400).json({ success: false, message: 'Message already deleted' });
      }
      if (!withinWindow) {
        return res.status(403).json({
          success: false,
          message: 'This message can only be deleted for everyone within 10 minutes of sending. You can still delete it for yourself.',
        });
      }

      message.isDeleted      = true;
      message.deletedAt      = new Date();
      message.deletedBy      = actor.id;
      message.deletedByModel = actor.model;
      await message.save();

      if (_io) {
        _io.to(`conversation:${message.conversationId}`).emit('message-deleted', {
          messageId,
          conversationId: message.conversationId.toString(),
          scope: 'everyone',
        });
      }

      return res.json({ success: true, scope: 'everyone' });
    }

    // scope === 'me' — hide only for the requesting actor, no time limit,
    // works whether or not the actor sent the message.
    const alreadyHidden = message.deletedFor.some(
      (uid) => uid.toString() === actor.id.toString()
    );
    if (!alreadyHidden) {
      message.deletedFor.push(actor.id);
      await message.save();
    }

    if (_io) {
      // Only the actor's own other sessions/tabs need to know, not the
      // other participant — 'delete for me' doesn't affect them.
      _io.to(personalRoomFor(actor)).emit('message-deleted', {
        messageId,
        conversationId: message.conversationId.toString(),
        scope: 'me',
      });
    }

    return res.json({ success: true, scope: 'me' });
  } catch (err) {
    console.error('deleteMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   SEARCH USERS TO MESSAGE (user lane)
   GET /api/messages/search-users?q=
───────────────────────────────────────────── */
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, users: [] });
    }

    const regex = new RegExp(q.trim(), 'i');
    const users = await User.find({
      isDeleted: false,
      isBanned: false,
      _id: { $ne: req.actor.id },
      $or: [{ username: regex }, { firstName: regex }, { lastName: regex }],
    })
      .select('firstName lastName username avatar isVerified')
      .limit(20)
      .lean();

    return res.json({ success: true, users });
  } catch (err) {
    console.error('searchUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────
   SEARCH ADMINS TO MESSAGE (admin lane)
   GET /api/messages/search-admins?q=
───────────────────────────────────────────── */
exports.searchAdmins = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, admins: [] });
    }

    const regex = new RegExp(q.trim(), 'i');
    const admins = await Admin.find({
      status: 'active',
      _id: { $ne: req.actor.id },
      $or: [
        { fullName: regex },
        { email: regex },
      ],
    })
      .select('fullName email role status')
      .limit(20)
      .lean();

    return res.json({ success: true, admins });
  } catch (err) {
    console.error('searchAdmins error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════
   ADMIN MODERATION — view user conversations
   Platform admin + super admin
═══════════════════════════════════════════════ */

exports.adminListUserConversations = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip  = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find({ lane: 'user', isActive: true })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments({ lane: 'user', isActive: true }),
    ]);

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const plain = conv.toObject();
        plain.participantProfiles = await Promise.all(
          conv.participants.map(async (p) => {
            const u = await User.findById(p.participantId)
              .select('firstName lastName username avatar isVerified isBanned')
              .lean();
            return u ? { ...u, displayName: u.username || `${u.firstName} ${u.lastName}` } : null;
          })
        );
        return plain;
      })
    );

    return res.json({
      success: true,
      conversations: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('adminListUserConversations error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.adminGetUserConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation || conversation.lane !== 'user') {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    const participantProfiles = await Promise.all(
      conversation.participants.map(async (p) => {
        const u = await User.findById(p.participantId)
          .select('firstName lastName username avatar isVerified isBanned')
          .lean();
        return u ? { ...u, displayName: u.username || `${u.firstName} ${u.lastName}` } : null;
      })
    );

    return res.json({
      success: true,
      conversation: { ...conversation.toObject(), participantProfiles },
      messages,
    });
  } catch (err) {
    console.error('adminGetUserConversation error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════
   SUPER ADMIN — view admin conversations
═══════════════════════════════════════════════ */

exports.superAdminListAdminConversations = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip  = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find({ lane: 'admin', isActive: true })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments({ lane: 'admin', isActive: true }),
    ]);

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const plain = conv.toObject();
        plain.participantProfiles = await Promise.all(
          conv.participants.map(async (p) => {
            const a = await Admin.findById(p.participantId)
              .select('fullName role status')
              .lean();
            return a ? { ...a, displayName: a.fullName } : null;
          })
        );
        return plain;
      })
    );

    return res.json({
      success: true,
      conversations: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('superAdminListAdminConversations error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.superAdminGetAdminConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation || conversation.lane !== 'admin') {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    const participantProfiles = await Promise.all(
      conversation.participants.map(async (p) => {
        const a = await Admin.findById(p.participantId)
          .select('fullName role status')
          .lean();
        return a ? { ...a, displayName: a.fullName } : null;
      })
    );

    return res.json({
      success: true,
      conversation: { ...conversation.toObject(), participantProfiles },
      messages,
    });
  } catch (err) {
    console.error('superAdminGetAdminConversation error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};