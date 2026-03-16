/**
 * File: backend/models/Notification.js
 * Description: Notification model for in-app notifications
 */

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Type of notification
    type: {
      type: String,
      enum: [
        'message',
        'admin',
        'system',
        'moderation',
        'support',
        'live',
        'upload',
        'comment',
        'flag',
        'minor_alert',
      ],
      required: true,
      index: true,
    },

    // Importance level
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Notification content
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Link to relevant page
    link: {
      url: String,
      text: String,
    },

    // Reference to related data
    reference: {
      model: {
        type: String,
        enum: ['User', 'Conversation', 'Message', 'Video', 'Live', 'Comment'],
      },
      id: mongoose.Schema.Types.ObjectId,
    },

    // Who triggered this notification (if user)
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Read status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,

    // Delivery status
    delivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,

    // For email/push notifications (future)
    emailSent: { type: Boolean, default: false },
    pushSent: { type: Boolean, default: false },

    // Custom data for UI rendering
    data: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Expiry - notifications older than 30 days can be auto-deleted
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000),
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ priority: 1 });

// Virtual for time ago
NotificationSchema.virtual('timeAgo').get(function () {
  const diff = Date.now() - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
});

// Method to mark as read
NotificationSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Method to mark as delivered
NotificationSchema.methods.markAsDelivered = async function () {
  if (!this.delivered) {
    this.delivered = true;
    this.deliveredAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to create notification
NotificationSchema.statics.createNotification = async function (data) {
  return this.create(data);
};

// Static method to mark multiple as read
NotificationSchema.statics.markManyAsRead = async function (userId, notificationIds) {
  return this.updateMany(
    { _id: { $in: notificationIds }, userId },
    { $set: { read: true, readAt: new Date() } }
  );
};

// Static method to mark all as read for user
NotificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, read: false });
};

module.exports = mongoose.model('Notification', NotificationSchema);