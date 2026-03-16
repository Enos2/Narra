/**
 * File: backend/models/Message.js
 * Description: Message model for storing individual messages with moderation
 */

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    // Which conversation this belongs to
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    // Who sent the message
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Sender info snapshot (in case user changes name later)
    senderInfo: {
      name: String,
      role: String,
      isMinor: Boolean,
    },

    // Message content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000, // Reasonable limit
    },

    // Content type
    contentType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text',
    },

    // File attachments (for image/file messages)
    attachments: [
      {
        url: String,
        filename: String,
        mimeType: String,
        size: Number,
        width: Number, // For images
        height: Number, // For images
      },
    ],

    // Moderation status
    moderationStatus: {
      type: String,
      enum: ['pending', 'clean', 'flagged', 'blocked'],
      default: 'pending',
    },

    // Moderation details
    moderationDetails: {
      flaggedBy: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      flaggedAt: Date,
      flagReasons: [String],
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewedAt: Date,
      reviewNotes: String,
      automatedFlags: [
        {
          rule: String,
          confidence: Number,
          matchedText: String,
        },
      ],
    },

    // Read receipts
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Delivery tracking
    deliveredTo: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // If message is deleted (soft delete)
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: Date,

    // For system messages (notifications, etc)
    systemType: {
      type: String,
      enum: ['user-joined', 'user-left', 'title-changed', null],
      default: null,
    },

    // IP for moderation/audit (optional)
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ moderationStatus: 1, createdAt: -1 });
MessageSchema.index({ 'moderationDetails.flaggedBy': 1 });
MessageSchema.index({ isDeleted: 1 });

// Virtual for read count
MessageSchema.virtual('readCount').get(function () {
  return this.readBy.length;
});

// Virtual for delivery count
MessageSchema.virtual('deliveredCount').get(function () {
  return this.deliveredTo.length;
});

// Method to mark as read by a user
MessageSchema.methods.markAsRead = async function (userId) {
  const alreadyRead = this.readBy.some((r) => r.userId.toString() === userId.toString());

  if (!alreadyRead) {
    this.readBy.push({ userId, readAt: new Date() });
    await this.save();
  }

  return this;
};

// Method to mark as delivered to a user
MessageSchema.methods.markAsDelivered = async function (userId) {
  const alreadyDelivered = this.deliveredTo.some(
    (d) => d.userId.toString() === userId.toString()
  );

  if (!alreadyDelivered) {
    this.deliveredTo.push({ userId, deliveredAt: new Date() });
    await this.save();
  }

  return this;
};

// Method to flag message for moderation
MessageSchema.methods.flag = async function (userId, reason) {
  if (!this.moderationDetails.flaggedBy.includes(userId)) {
    this.moderationDetails.flaggedBy.push(userId);
    this.moderationDetails.flaggedAt = new Date();
    this.moderationDetails.flagReasons.push(reason);
    
    // Update status if not already flagged
    if (this.moderationStatus === 'pending' || this.moderationStatus === 'clean') {
      this.moderationStatus = 'flagged';
    }
    
    await this.save();
  }
  return this;
};

// Method to approve message (clean)
MessageSchema.methods.approve = async function (adminId, notes = '') {
  this.moderationStatus = 'clean';
  this.moderationDetails.reviewedBy = adminId;
  this.moderationDetails.reviewedAt = new Date();
  this.moderationDetails.reviewNotes = notes;
  await this.save();
  return this;
};

// Method to block message
MessageSchema.methods.block = async function (adminId, reason) {
  this.moderationStatus = 'blocked';
  this.moderationDetails.reviewedBy = adminId;
  this.moderationDetails.reviewedAt = new Date();
  this.moderationDetails.reviewNotes = reason;
  await this.save();
  return this;
};

// Method to soft delete
MessageSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedBy = userId;
  this.deletedAt = new Date();
  await this.save();
  return this;
};

// Pre-save middleware to capture sender info
MessageSchema.pre('save', async function (next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const sender = await User.findById(this.senderId).select('name role dateOfBirth');
    
    if (sender) {
      // Calculate if sender is minor
      const age = sender.dateOfBirth ? 
        Math.floor((Date.now() - new Date(sender.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 18;
      
      this.senderInfo = {
        name: sender.name,
        role: sender.role,
        isMinor: age < 18,
      };
    }
  }
  next();
});

module.exports = mongoose.model('Message', MessageSchema);