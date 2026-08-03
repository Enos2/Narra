/**
 * File: backend/models/Flag.js
 * Description: Stores flags/issues raised by users or admins for content moderation.
 */

const mongoose = require('mongoose');

const FlagSchema = new mongoose.Schema(
  {
    // Who raised the flag
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Type of content being flagged: video, live, comment, user
    targetModel: {
      type: String,
      required: true,
      enum: ['Video', 'Live', 'Comment', 'User'],
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'targetModel' },

    // Reason and description for the flag
    reason: { type: String, required: true },
    details: { type: String },

    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'escalated', 'resolved'],
      default: 'pending',
    },

    // Which admin is assigned to handle it
    assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Audit trail: who escalated, who resolved
    escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: { type: String },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Flag', FlagSchema);
