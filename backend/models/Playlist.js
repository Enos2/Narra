/**
 * File: backend/models/Playlist.js
 * Description: Playlist model for users to save and organize videos
 */

const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    videos: [
      {
        video: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Video',
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          default: '',
          maxlength: 200,
        },
      },
    ],
    // For series: track specific season/episode
    isSeriesPlaylist: {
      type: Boolean,
      default: false,
    },
    // Privacy setting
    isPublic: {
      type: Boolean,
      default: false,
    },
    // Thumbnail (first video's thumbnail)
    thumbnailUrl: {
      type: String,
      default: '',
    },
    videoCount: {
      type: Number,
      default: 0,
    },
    // Total views across all videos in playlist
    totalViews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for user's playlists
PlaylistSchema.index({ user: 1, createdAt: -1 });

// Index for public playlists
PlaylistSchema.index({ isPublic: 1, createdAt: -1 });

// Pre-save middleware to update videoCount
PlaylistSchema.pre('save', function(next) {
  this.videoCount = this.videos.length;
  next();
});

// Method to check if video exists in playlist
PlaylistSchema.methods.hasVideo = function(videoId) {
  return this.videos.some(v => v.video.toString() === videoId.toString());
};

// Method to add video to playlist
PlaylistSchema.methods.addVideo = function(videoId, notes = '') {
  if (!this.hasVideo(videoId)) {
    this.videos.push({ video: videoId, notes, addedAt: new Date() });
    this.videoCount = this.videos.length;
    return true;
  }
  return false;
};

// Method to remove video from playlist
PlaylistSchema.methods.removeVideo = function(videoId) {
  const initialLength = this.videos.length;
  this.videos = this.videos.filter(v => v.video.toString() !== videoId.toString());
  this.videoCount = this.videos.length;
  return initialLength !== this.videos.length;
};

// Static method to get user's default "Watch Later" playlist
PlaylistSchema.statics.getOrCreateWatchLater = async function(userId) {
  let watchLater = await this.findOne({ 
    user: userId, 
    name: { $regex: /^Watch Later$/i } 
  });
  
  if (!watchLater) {
    watchLater = await this.create({
      name: 'Watch Later',
      description: 'Videos you want to watch later',
      user: userId,
      isPublic: false,
    });
  }
  
  return watchLater;
};

module.exports = mongoose.model('Playlist', PlaylistSchema);