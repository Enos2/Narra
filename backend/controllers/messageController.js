/**
 * File: backend/controllers/messageController.js
 * Description: Controllers for messaging functionality
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const messagingMiddleware = require('../middleware/messagingMiddleware');

/**
 * Helper function to emit socket events (will be connected later)
 */
let io = null;
exports.setSocketIO = (socketIO) => {
  io = socketIO;
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

const emitToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(`conversation:${conversationId.toString()}`).emit(event, data);
  }
};

/**
 * Get or create a direct conversation between two users
 */
exports.getOrCreateConversation = async (req, res) => {
  try {
    const currentUser = req.user;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required'
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [currentUser._id, recipientId], $size: 2 }
    }).populate('participants', 'name email role dateOfBirth avatar');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participants: [currentUser._id, recipientId],
        type: 'direct',
        createdBy: currentUser._id,
        hasMinor: messagingMiddleware.utils.isMinor(currentUser) || 
                  messagingMiddleware.utils.isMinor(await User.findById(recipientId))
      });

      // Populate participants
      await conversation.populate('participants', 'name email role dateOfBirth avatar');

      // Create system message for conversation start
      await Message.create({
        conversationId: conversation._id,
        senderId: currentUser._id,
        content: 'Conversation started',
        contentType: 'system',
        systemType: 'user-joined',
        moderationStatus: 'clean'
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('❌ getOrCreateConversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating conversation',
      error: error.message
    });
  }
};

/**
 * Send a message in a conversation
 */
exports.sendMessage = async (req, res) => {
  try {
    const sender = req.user;
    const { conversationId, content, contentType = 'text', attachments = [] } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID and content are required'
      });
    }

    // Get conversation and verify it exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Verify sender is a participant
    if (!conversation.isParticipant(sender._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }

    // Check if conversation is blocked by sender
    if (conversation.blockedBy.some(id => id.toString() === sender._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You have blocked this conversation'
      });
    }

    // Create message
    const message = await Message.create({
      conversationId,
      senderId: sender._id,
      content,
      contentType,
      attachments,
      moderationStatus: req.body.moderationFlags ? 'flagged' : 'pending',
      moderationDetails: req.body.moderationFlags ? {
        automatedFlags: [req.body.moderationFlags],
        flaggedAt: new Date()
      } : undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Update conversation's last message
    conversation.lastMessage = {
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      senderId: sender._id,
      senderName: sender.name,
      createdAt: new Date(),
      isRead: false
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate sender info
    await message.populate('senderId', 'name email role avatar');

    // Get all participants except sender
    const otherParticipants = conversation.participants.filter(
      p => p.toString() !== sender._id.toString()
    );

    // Create notifications for other participants
    const notificationPromises = otherParticipants.map(async (participantId) => {
      // Check if participant has muted this conversation
      if (conversation.mutedBy.some(id => id.toString() === participantId.toString())) {
        return null;
      }

      return Notification.create({
        userId: participantId,
        type: 'message',
        priority: 'normal',
        title: `New message from ${sender.name}`,
        message: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
        link: {
          url: `/messages?conversation=${conversationId}`,
          text: 'View Message'
        },
        reference: {
          model: 'Message',
          id: message._id
        },
        triggeredBy: sender._id,
        data: {
          conversationId,
          senderName: sender.name,
          senderId: sender._id
        }
      });
    });

    await Promise.all(notificationPromises.filter(Boolean));

    // Emit socket events
    emitToConversation(conversationId, 'new-message', {
      message,
      conversationId
    });

    // Emit to each participant's user room for notification
    otherParticipants.forEach(participantId => {
      emitToUser(participantId, 'message-notification', {
        conversationId,
        message: {
          id: message._id,
          sender: {
            id: sender._id,
            name: sender.name
          },
          preview: content.substring(0, 50)
        }
      });
    });

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('❌ sendMessage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

/**
 * Get messages for a conversation (paginated)
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ 
      conversationId,
      isDeleted: false 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('senderId', 'name email role avatar')
      .lean();

    const total = await Message.countDocuments({ 
      conversationId,
      isDeleted: false 
    });

    // Mark messages as delivered for current user
    const messageIds = messages.map(m => m._id);
    await Message.updateMany(
      { 
        _id: { $in: messageIds },
        'deliveredTo.userId': { $ne: req.user._id }
      },
      { 
        $push: { deliveredTo: { userId: req.user._id, deliveredAt: new Date() } }
      }
    );

    res.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ getMessages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

/**
 * Get all conversations for current user
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
      blockedBy: { $ne: userId } // Exclude blocked conversations
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'name email role dateOfBirth avatar')
      .populate('lastMessage.senderId', 'name')
      .lean();

    // For each conversation, get unread count
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          'readBy.userId': { $ne: userId },
          isDeleted: false
        });

        // Check if conversation involves a minor
        const participants = await User.find(
          { _id: { $in: conv.participants.map(p => p._id) } },
          'dateOfBirth'
        );
        
        const hasMinor = participants.some(p => 
          p.dateOfBirth && messagingMiddleware.utils.isMinor(p)
        );

        return {
          ...conv,
          unreadCount,
          hasMinor
        };
      })
    );

    res.json({
      success: true,
      conversations: conversationsWithUnread
    });
  } catch (error) {
    console.error('❌ getConversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
};

/**
 * Mark messages as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Update all unread messages in this conversation
    const result = await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        'readBy.userId': { $ne: userId }
      },
      {
        $push: { readBy: { userId, readAt: new Date() } }
      }
    );

    // Update conversation last message read status
    await Conversation.updateOne(
      { _id: conversationId },
      { 'lastMessage.isRead': true }
    );

    // Emit read receipts
    emitToConversation(conversationId, 'messages-read', {
      conversationId,
      userId,
      readAt: new Date()
    });

    res.json({
      success: true,
      markedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ markAsRead error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};

/**
 * Delete a message (soft delete)
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is sender or admin
    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);
    const isSender = message.senderId.toString() === userId.toString();

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await message.softDelete(userId);

    // Emit deletion event
    emitToConversation(message.conversationId.toString(), 'message-deleted', {
      messageId,
      conversationId: message.conversationId
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('❌ deleteMessage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
};

/**
 * Block a conversation
 */
exports.blockConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    conversation.block(userId);
    await conversation.save();

    res.json({
      success: true,
      message: 'Conversation blocked'
    });
  } catch (error) {
    console.error('❌ blockConversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking conversation',
      error: error.message
    });
  }
};

/**
 * Unblock a conversation
 */
exports.unblockConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    conversation.unblock(userId);
    await conversation.save();

    res.json({
      success: true,
      message: 'Conversation unblocked'
    });
  } catch (error) {
    console.error('❌ unblockConversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error unblocking conversation',
      error: error.message
    });
  }
};