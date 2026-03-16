const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    /*
    ========================================
    RELATIONS
    ========================================
    */
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

    /*
    ========================================
    CONTENT
    ========================================
    */
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    /*
    ========================================
    OPTIONAL RATING (ONE PER COMMENT)
    ========================================
    */
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },

    /*
    ========================================
    ENGAGEMENT
    ========================================
    */
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    likeCount: {
      type: Number,
      default: 0,
    },

    /*
    ========================================
    MODERATION & SAFETY
    ========================================
    */
    isEdited: { type: Boolean, default: false },
    editedAt: Date,

    isDeleted: { type: Boolean, default: false },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    deletionReason: String,

    isFlagged: { type: Boolean, default: false },
    flagReason: String,

    adminNote: String,
  },
  { timestamps: true }
);

/*
========================================
SMART LOGIC
========================================
*/
CommentSchema.pre('save', function (next) {
  // keep likeCount in sync
  if (this.isModified('likes')) {
    this.likeCount = this.likes.length;
  }

  // auto-mark edit time
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  next();
});

/*
========================================
INDEXES
========================================
*/
CommentSchema.index({ video: 1, createdAt: -1 });
CommentSchema.index({ user: 1 });
CommentSchema.index({ isDeleted: 1 });
CommentSchema.index({ isFlagged: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
