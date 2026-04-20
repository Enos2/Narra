/**
 * FILE: backend/models/Comment.js
 */

const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    // null = top-level comment, ObjectId = this is a reply
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    // The user this reply is directed at
    replyToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, default: '' },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// Virtual for like count
CommentSchema.virtual('likeCount').get(function () {
  return this.likes ? this.likes.length : 0;
});

// Virtual for dislike count
CommentSchema.virtual('dislikeCount').get(function () {
  return this.dislikes ? this.dislikes.length : 0;
});

// Indexes
CommentSchema.index({ video: 1, parentComment: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });
CommentSchema.index({ user: 1 });
CommentSchema.index({ isDeleted: 1 });

const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);
module.exports = Comment;