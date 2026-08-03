/**
 * models/Message.js
 */

const mongoose = require('mongoose');

const ReadReceiptSchema = new mongoose.Schema(
  {
    readerId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    readerModel: { type: String, enum: ['User', 'Admin'], required: true },
    readAt:      { type: Date, default: Date.now },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderModel: {
      type: String,
      enum: ['User', 'Admin'],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    readBy: { type: [ReadReceiptSchema], default: [] },

    // ── Edit tracking ──
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    // ── Delete for everyone ──
    isDeleted:      { type: Boolean, default: false },
    deletedAt:      { type: Date, default: null },
    deletedBy:      { type: mongoose.Schema.Types.ObjectId, default: null },
    deletedByModel: { type: String, enum: ['User', 'Admin', null], default: null },

    // ── Delete for me only (per-participant hide list) ──
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ senderId: 1 });

module.exports =
  mongoose.models.Message || mongoose.model('Message', MessageSchema);