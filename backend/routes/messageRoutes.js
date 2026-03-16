/**
 * File: backend/routes/messageRoutes.js
 * Description: Routes for messaging functionality
 */

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const notificationController = require('../controllers/notificationController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');
const messagingMiddleware = require('../middleware/messagingMiddleware');

/*
|---------------------------------------------------------------------------
| ALL ROUTES REQUIRE AUTHENTICATION
|---------------------------------------------------------------------------
*/
router.use(protect);

/*
|---------------------------------------------------------------------------
| CONVERSATION ROUTES
|---------------------------------------------------------------------------
*/

// Get all conversations for current user
router.get('/conversations', messageController.getConversations);

// Get or create a direct conversation
router.post('/conversations/direct', 
  messagingMiddleware.canMessageUser,
  messageController.getOrCreateConversation
);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages',
  messagingMiddleware.canAccessConversation,
  messageController.getMessages
);

// Send a message
router.post('/conversations/:conversationId/messages',
  messagingMiddleware.canAccessConversation,
  messagingMiddleware.basicContentFilter,
  messageController.sendMessage
);

// Mark messages as read
router.put('/conversations/:conversationId/read',
  messagingMiddleware.canAccessConversation,
  messageController.markAsRead
);

// Block/unblock conversation
router.put('/conversations/:conversationId/block',
  messagingMiddleware.canAccessConversation,
  messageController.blockConversation
);

router.put('/conversations/:conversationId/unblock',
  messagingMiddleware.canAccessConversation,
  messageController.unblockConversation
);

// Delete a message
router.delete('/messages/:messageId',
  messageController.deleteMessage
);

/*
|---------------------------------------------------------------------------
| NOTIFICATION ROUTES
|---------------------------------------------------------------------------
*/

// Get notifications for current user
router.get('/notifications', notificationController.getNotifications);

// Get unread count only
router.get('/notifications/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.put('/notifications/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/notifications/read-all', notificationController.markAllAsRead);

// Delete a notification
router.delete('/notifications/:notificationId', notificationController.deleteNotification);

/*
|---------------------------------------------------------------------------
| ADMIN ROUTES - Message moderation
|---------------------------------------------------------------------------
*/

// Get flagged messages (admin only)
router.get('/admin/flagged', adminOnly, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const flaggedMessages = await Message.find({
      moderationStatus: { $in: ['flagged', 'pending'] }
    })
      .populate('senderId', 'name email')
      .populate('conversationId')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      messages: flaggedMessages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve flagged message
router.put('/admin/messages/:messageId/approve', adminOnly, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    await message.approve(req.user._id, req.body.notes);
    
    res.json({
      success: true,
      message: 'Message approved'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Block message
router.put('/admin/messages/:messageId/block', adminOnly, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    await message.block(req.user._id, req.body.reason);
    
    res.json({
      success: true,
      message: 'Message blocked'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get minor-adult communication attempts (super/platform admin only)
router.get('/admin/minor-attempts', adminOnly, async (req, res) => {
  try {
    // This would log attempts that were blocked by age verification
    // For now, return empty array - we'll implement logging later
    res.json({
      success: true,
      attempts: []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;