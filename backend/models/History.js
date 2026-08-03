/**
 * File: backend/models/History.js
 * Description: Watch history model for tracking user viewing progress
 * Allows resuming videos from where user left off
 */

const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    // For series: track specific season and episode
    seasonNumber: {
      type: Number,
      default: null,
    },
    episodeNumber: {
      type: Number,
      default: null,
    },
    // Resume position in seconds
    progress: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Total duration for percentage calculation
    duration: {
      type: Number,
      default: 0,
    },
    // Percentage watched (0-100)
    percentWatched: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Whether user completed the video
    completed: {
      type: Boolean,
      default: false,
    },
    // Last watched timestamp
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
    // Watch count for this video
    watchCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one history entry per user per video (and per episode for series)
HistorySchema.index({ user: 1, video: 1, seasonNumber: 1, episodeNumber: 1 }, { unique: true });

// Index for sorting by last watched
HistorySchema.index({ user: 1, lastWatchedAt: -1 });

// Index for completed filtering
HistorySchema.index({ user: 1, completed: 1 });

// Method to check if video is near completion (90% or more)
HistorySchema.methods.isNearCompletion = function() {
  return this.percentWatched >= 90;
};

// Method to check if should resume (watched > 5 seconds and not completed)
HistorySchema.methods.shouldResume = function() {
  return this.progress > 5 && !this.completed && this.percentWatched < 90;
};

// Static method to get continue watching list
HistorySchema.statics.getContinueWatching = async function(userId, limit = 10) {
  return this.find({ 
    user: userId, 
    completed: false,
    progress: { $gt: 5 } // More than 5 seconds watched
  })
  .populate('video', 'title thumbnailUrl duration type creator')
  .sort({ lastWatchedAt: -1 })
  .limit(limit)
  .lean();
};

// Static method to get watch history
HistorySchema.statics.getWatchHistory = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [history, total] = await Promise.all([
    this.find({ user: userId })
      .populate('video', 'title thumbnailUrl duration type creator isPaid price')
      .sort({ lastWatchedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ user: userId })
  ]);
  
  return { history, total, page, totalPages: Math.ceil(total / limit) };
};

module.exports = mongoose.model('History', HistorySchema);