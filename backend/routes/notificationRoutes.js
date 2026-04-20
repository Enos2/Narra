/**
 * File: backend/routes/notificationRoutes.js
 * Description: Routes for notification management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} = require('../controllers/notificationController');

// All routes require authentication
router.use(protect);

// Get all notifications for current user (main endpoint)
router.get('/', getNotifications);

// Alias for /user for backward compatibility with frontend
router.get('/user', getNotifications);

// Get unread count only
router.get('/unread-count', getUnreadCount);

// Mark a specific notification as read
router.put('/:notificationId/read', markAsRead);

// Mark all notifications as read
router.put('/read/all', markAllAsRead);

// Delete a notification
router.delete('/:notificationId', deleteNotification);

module.exports = router;