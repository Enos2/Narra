/**
 * File: backend/models/Conversation.js
 * Description: Conversation model for messaging between users
 */

const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    // Participants in the conversation
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],

    // Conversation type
    type: {
      type: String,
      enum: ['direct', 'support', 'admin-group'],
      default: 'direct',
      required: true,
    },

    // For group chats or support tickets
    title: {
      type: String,
      trim: true,
    },

    // Who created the conversation
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Last message preview for conversation list
    lastMessage: {
      content: String,
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      senderName: String,
      createdAt: Date,
      isRead: { type: Boolean, default: false },
    },

    // For support tickets
    supportMetadata: {
      status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open',
      },
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      category: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },

    // For minor protection - track if this conversation involves a minor
    hasMinor: {
      type: Boolean,
      default: false,
    },

    // For admin monitoring
    isMonitored: {
      type: Boolean,
      default: false,
    },

    // Muted by participants
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Blocked by participants
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ 'supportMetadata.status': 1 });
ConversationSchema.index({ hasMinor: 1, isMonitored: 1 });
ConversationSchema.index({ updatedAt: -1 });

// Ensure unique conversation between two users for direct messages
ConversationSchema.index(
  {
    participants: 1,
    type: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      type: 'direct',
      'participants.2': { $exists: false }, // Only for 2-participant direct messages
    },
  }
);

// Virtual for participant count
ConversationSchema.virtual('participantCount').get(function () {
  return this.participants.length;
});

// Method to check if user is participant
ConversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some((p) => p.toString() === userId.toString());
};

// Method to add participant (for group/support)
ConversationSchema.methods.addParticipant = async function (userId) {
  if (!this.isParticipant(userId)) {
    this.participants.push(userId);
    await this.save();
  }
  return this;
};

// Method to remove participant
ConversationSchema.methods.removeParticipant = async function (userId) {
  this.participants = this.participants.filter(
    (p) => p.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Method to mute conversation
ConversationSchema.methods.mute = function (userId) {
  if (!this.mutedBy.includes(userId)) {
    this.mutedBy.push(userId);
  }
  return this;
};

// Method to unmute conversation
ConversationSchema.methods.unmute = function (userId) {
  this.mutedBy = this.mutedBy.filter((id) => id.toString() !== userId.toString());
  return this;
};

// Method to block conversation
ConversationSchema.methods.block = function (userId) {
  if (!this.blockedBy.includes(userId)) {
    this.blockedBy.push(userId);
  }
  return this;
};

// Method to unblock conversation
ConversationSchema.methods.unblock = function (userId) {
  this.blockedBy = this.blockedBy.filter((id) => id.toString() !== userId.toString());
  return this;
};

module.exports = mongoose.model('Conversation', ConversationSchema);