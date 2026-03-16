const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema(
  {
    /*
    ========================================
    BASIC INFO
    ========================================
    */
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, required: true },
    videoUrl: { type: String },
    filePath: { type: String },
    duration: { type: Number, default: 0 },

    /*
    ========================================
    CREATOR
    ========================================
    */
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /*
    ========================================
    CONTENT TYPE & CLASSIFICATION
    ========================================
    */
    type: {
      type: String,
      enum: ['movie', 'series'],
      required: true,
      default: 'movie',
    },
    genre: [{ type: String }],
    tags: [{ type: String }],
    ageRating: {
      type: String,
      enum: ['G', 'PG', '13+', '16+', '18+', 'PG-13'],
      default: 'G',
      required: true,
    },
    contentFlags: {
      violence: { type: Boolean, default: false },
      sex: { type: Boolean, default: false },
      language: { type: Boolean, default: false },
      graphic: { type: Boolean, default: false },
    },
    language: { type: String, default: 'English' },
    subtitles: [{ type: String }],

    /*
    ========================================
    SERIES STRUCTURE
    ========================================
    */
    seasons: [{
      title: { type: String, required: true },
      description: { type: String, default: '' },
      trailerUrl: { type: String },
      seasonNumber: { type: Number, required: true },
      isPublished: { type: Boolean, default: false },
      publishedAt: { type: Date },
      order: { type: Number, default: 0 },
      episodes: [{
        title: { type: String, required: true },
        description: { type: String, default: '' },
        videoUrl: { type: String, required: true },
        trailerUrl: { type: String },
        filePath: { type: String },
        duration: { type: Number, default: 0 },
        episodeNumber: { type: Number, required: true },
        order: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
        thumbnailUrl: { type: String },
        views: { type: Number, default: 0 },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        published: { type: Boolean, default: false },
        publishedAt: { type: Date },
        price: { type: Number, default: 0 },
      }],
    }],

    /*
    ========================================
    TRAILER FOR MOVIES
    ========================================
    */
    trailerUrl: { type: String },

    /*
    ========================================
    MONETIZATION
    ========================================
    */
    isPaid: { type: Boolean, default: false },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    releasePrice: { type: Number, default: 0 },
    releaseCurrency: { type: String, default: 'USD' },
    purchases: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        purchasedAt: { type: Date, default: Date.now },
      },
    ],

    /*
    ========================================
    SPONSORED / FUNDRAISER
    ========================================
    */
    isSponsored: { type: Boolean, default: false },
    isFundraiser: { type: Boolean, default: false },
    sponsorDescription: { type: String },
    fundraiserDescription: { type: String },
    fundraiserGoal: { type: Number, default: 0 },
    fundraiserRaised: { type: Number, default: 0 },

    /*
    ========================================
    RELEASE OPTIONS
    ========================================
    */
    releaseOption: {
      type: String,
      enum: ['immediate', 'schedule'],
      default: 'immediate'
    },
    releaseDate: { type: Date },
    scheduledReleaseDate: { type: Date },

    /*
    ========================================
    MODERATION & RELEASE WORKFLOW
    ========================================
    */
    status: {
      type: String,
      enum: [
        'draft', 
        'pending', 
        'approved', 
        'rejected', 
        'released',
        'flagged',        // Added for flagging
        'restricted',     // Added for restriction
        'shadowBanned',   // Added for shadow ban/suppression
        'removed'         // Added for soft delete
      ],
      default: 'pending'
    },
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    released: { type: Boolean, default: false },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    releasedAt: { type: Date },
    rejected: { type: Boolean, default: false },
    rejectionReason: { type: String },
    rejectionDetails: { type: String },

    /*
    ========================================
    MODERATION FIELDS
    ========================================
    */
    // Flag fields
    flagged: { type: Boolean, default: false },
    flaggedReason: { type: String },
    flaggedAt: { type: Date },
    flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Restriction fields
    restricted: { type: Boolean, default: false },
    restrictedReason: { type: String },
    restrictedAt: { type: Date },
    restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Shadow ban fields
    shadowBanned: { type: Boolean, default: false },
    shadowBanReason: { type: String },
    shadowBannedAt: { type: Date },
    shadowBannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Removal fields
    removed: { type: Boolean, default: false },
    removedAt: { type: Date },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /*
    ========================================
    VISIBILITY
    ========================================
    */
    isPrivate: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    publishedAt: { type: Date },
    uploadedAt: { type: Date, default: Date.now },

    /*
    ========================================
    ENGAGEMENT
    ========================================
    */
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ratings: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 0, max: 10 },
      },
    ],
    averageRating: { type: Number, default: 0 },
    hideEngagement: { type: Boolean, default: false },

    /*
    ========================================
    COMMENTS
    ========================================
    */
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    commentsDisabled: { type: Boolean, default: false },

    /*
    ========================================
    GEO / SHADOW
    ========================================
    */
    blockedCountries: [{ type: String }],
    blockedContinents: [{ type: String }],
    isShadowBanned: { type: Boolean, default: false }, // Kept for backward compatibility

    /*
    ========================================
    STATISTICS
    ========================================
    */
    totalEpisodes: { type: Number, default: 0 },
    totalSeasons: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },

    /*
    ========================================
    SYSTEM
    ========================================
    */
    imported: { type: Boolean, default: false },
    sourcePlatform: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

/*
========================================
VIRTUALS
========================================
*/
VideoSchema.virtual('moderationStatus').get(function () {
  if (this.released) return 'released';
  if (this.approved) return 'approved';
  if (this.flagged) return 'flagged';
  if (this.restricted) return 'restricted';
  if (this.shadowBanned) return 'shadowBanned';
  if (this.removed) return 'removed';
  if (this.rejected) return 'rejected';
  return 'pending';
});

VideoSchema.virtual('releaseStatus').get(function () {
  if (this.status === 'released') return 'released';
  if (this.status === 'approved') return 'approved_for_release';
  if (this.status === 'pending') return 'pending_approval';
  if (this.status === 'rejected') return 'rejected';
  if (this.status === 'flagged') return 'flagged_for_review';
  if (this.status === 'restricted') return 'restricted';
  if (this.status === 'shadowBanned') return 'shadow_banned';
  if (this.status === 'removed') return 'removed';
  return 'draft';
});

VideoSchema.virtual('seriesDuration').get(function () {
  if (this.type !== 'series') return this.duration || 0;
  
  let totalDuration = 0;
  this.seasons?.forEach(season => {
    season.episodes?.forEach(episode => {
      totalDuration += episode.duration || 0;
    });
  });
  return totalDuration;
});

VideoSchema.virtual('seriesViews').get(function () {
  if (this.type !== 'series') return this.views || 0;
  
  let totalViews = 0;
  this.seasons?.forEach(season => {
    season.episodes?.forEach(episode => {
      totalViews += episode.views || 0;
    });
  });
  return totalViews;
});

VideoSchema.virtual('publishedEpisodesCount').get(function () {
  if (this.type !== 'series') return 0;
  
  let count = 0;
  this.seasons?.forEach(season => {
    season.episodes?.forEach(episode => {
      if (episode.published) count++;
    });
  });
  return count;
});

VideoSchema.virtual('totalEpisodesCount').get(function () {
  if (this.type !== 'series') return 0;
  
  let count = 0;
  this.seasons?.forEach(season => {
    count += season.episodes?.length || 0;
  });
  return count;
});

/*
========================================
PRE SAVE HOOK - FIXED to prevent status override
========================================
*/
VideoSchema.pre('save', async function() {
  console.log('Video pre-save hook called for:', this.title);
  
  // Set uploadedAt if not set
  if (!this.uploadedAt) {
    this.uploadedAt = new Date();
  }

  // Calculate totals for series
  if (this.type === 'series') {
    this.totalSeasons = this.seasons?.length || 0;
    this.totalEpisodes = this.seasons?.reduce((total, season) => {
      return total + (season.episodes?.length || 0);
    }, 0) || 0;
  } else {
    this.totalSeasons = 0;
    this.totalEpisodes = 0;
  }

  // Sync boolean flags with status
  if (this.status === 'approved') {
    this.approved = true;
    this.rejected = false;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = false;
    this.isDeleted = false;
  } else if (this.status === 'rejected') {
    this.approved = false;
    this.rejected = true;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = false;
    this.isDeleted = false;
  } else if (this.status === 'flagged') {
    this.approved = false;
    this.rejected = false;
    this.flagged = true;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = false;
    this.isDeleted = false;
  } else if (this.status === 'restricted') {
    this.approved = false;
    this.rejected = false;
    this.flagged = false;
    this.restricted = true;
    this.shadowBanned = false;
    this.removed = false;
    this.isDeleted = false;
  } else if (this.status === 'shadowBanned') {
    this.approved = false;
    this.rejected = false;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = true;
    this.isShadowBanned = true; // Keep backward compatibility
    this.removed = false;
    this.isDeleted = false;
  } else if (this.status === 'removed') {
    this.approved = false;
    this.rejected = false;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = true;
    this.isDeleted = true;
  }

  // Handle released status - ensure consistency
  if (this.status === 'released') {
    this.released = true;
    this.releasedAt = this.releasedAt || new Date();
    this.releasedBy = this.releasedBy || this.creator;
    this.publishedAt = this.publishedAt || new Date();
    this.approved = true; // Keep approved true for released videos
    this.rejected = false;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = false;
    this.isDeleted = false;
  }

  // If this is a new video and no status is set, default to pending
  if (this.isNew && !this.status) {
    this.status = 'pending';
    this.approved = false;
    this.rejected = false;
    this.flagged = false;
    this.restricted = false;
    this.shadowBanned = false;
    this.removed = false;
  }
});

/*
========================================
PRE VALIDATE HOOK
========================================
*/
VideoSchema.pre('validate', async function() {
  console.log('Video pre-validate hook called for:', this.title);
  
  // Required fields for movies
  if (this.type === 'movie') {
    if (!this.videoUrl && !this.filePath) {
      throw new Error('Video URL or file path is required for movies');
    }
  }
  
  // Series: unique season/episode numbers
  if (this.type === 'series' && Array.isArray(this.seasons)) {
    const seasonNumbers = this.seasons.map(s => s.seasonNumber);
    if (new Set(seasonNumbers).size !== seasonNumbers.length) {
      throw new Error('Season numbers must be unique');
    }
    
    this.seasons.forEach((season, sIdx) => {
      if (Array.isArray(season.episodes)) {
        const epNumbers = season.episodes.map(ep => ep.episodeNumber);
        if (new Set(epNumbers).size !== epNumbers.length) {
          throw new Error(`Episode numbers must be unique within season ${season.seasonNumber}`);
        }
      }
    });
  }
});

/*
========================================
METHODS
========================================
*/
VideoSchema.methods.getEpisode = function (seasonNumber, episodeNumber) {
  if (this.type !== 'series') return null;
  
  const season = this.seasons?.find(s => s.seasonNumber === parseInt(seasonNumber));
  if (!season) return null;
  
  return season.episodes?.find(ep => ep.episodeNumber === parseInt(episodeNumber));
};

VideoSchema.methods.addEpisodeView = function (seasonNumber, episodeNumber) {
  if (this.type !== 'series') return;
  
  const episode = this.getEpisode(seasonNumber, episodeNumber);
  if (episode) {
    episode.views = (episode.views || 0) + 1;
  }
};

VideoSchema.methods.isAccessible = function () {
  if (this.isDeleted || this.status !== 'released') return false;
  if (this.removed || this.shadowBanned) return false;
  
  if (this.releaseOption === 'schedule' && this.scheduledReleaseDate) {
    return new Date() >= this.scheduledReleaseDate;
  }
  
  return true;
};

VideoSchema.methods.isPubliclyVisible = function () {
  if (this.isDeleted || this.removed) return false;
  if (this.shadowBanned) return false;
  if (this.restricted) return false;
  if (this.status !== 'released') return false;
  
  return true;
};

VideoSchema.methods.canRelease = function (userId) {
  if (this.creator.toString() !== userId.toString()) return false;
  if (this.status !== 'approved') return false;
  if (this.isDeleted || this.removed) return false;
  return true;
};

VideoSchema.methods.releaseEpisode = function (seasonNumber, episodeNumber, price) {
  if (this.type !== 'series') return false;
  
  const episode = this.getEpisode(seasonNumber, episodeNumber);
  if (!episode) return false;
  
  episode.published = true;
  episode.publishedAt = new Date();
  if (price !== undefined) {
    episode.price = price;
  }
  
  const season = this.seasons?.find(s => s.seasonNumber === parseInt(seasonNumber));
  if (season) {
    const allEpisodesPublished = season.episodes?.every(ep => ep.published);
    if (allEpisodesPublished) {
      season.isPublished = true;
      season.publishedAt = new Date();
    }
    
    const allSeasonsPublished = this.seasons?.every(s => s.isPublished);
    if (allSeasonsPublished && this.status === 'approved') {
      this.status = 'released';
      this.released = true;
      this.releasedAt = new Date();
      this.releasedBy = this.creator;
      this.publishedAt = new Date();
    }
  }
  
  return true;
};

/*
========================================
STATICS
========================================
*/
VideoSchema.statics.getVideosByStatus = async function (userId, status) {
  console.log(`🔍 Video.getVideosByStatus called - User: ${userId}, Status: ${status}`);
  
  const query = { creator: userId };
  
  switch (status) {
    case 'pending':
      query.status = 'pending';
      break;
    case 'approved':
      query.status = 'approved';
      break;
    case 'released':
      query.status = 'released';
      break;
    case 'rejected':
      query.status = 'rejected';
      break;
    default:
      console.warn(`⚠️ Unknown status requested: ${status}`);
      return [];
  }
  
  console.log(`🔍 Query:`, JSON.stringify(query));
  
  const results = await this.find(query)
    .populate('creator', 'name email avatar')
    .sort({ updatedAt: -1 });
  
  console.log(`🔍 Found ${results.length} videos with status: ${status}`);
  
  return results;
};

VideoSchema.statics.createVideo = async function(videoData) {
  try {
    console.log('Creating video with data:', videoData);
    
    // Ensure required fields are present
    if (!videoData.title || !videoData.creator) {
      throw new Error('Title and creator are required');
    }
    
    // Ensure status is set to pending
    videoData.status = 'pending';
    videoData.approved = false;
    videoData.rejected = false;
    videoData.released = false;
    videoData.flagged = false;
    videoData.restricted = false;
    videoData.shadowBanned = false;
    videoData.removed = false;
    
    // Create the video
    const video = new this(videoData);
    
    // Save the video (this will trigger the pre-save hook)
    await video.save();
    
    console.log('Video created successfully:', video._id);
    return video;
  } catch (error) {
    console.error('Error creating video:', error);
    throw error;
  }
};

/*
========================================
INDEXES
========================================
*/
VideoSchema.index({ creator: 1 });
VideoSchema.index({ type: 1 });
VideoSchema.index({ genre: 1 });
VideoSchema.index({ tags: 1 });
VideoSchema.index({ status: 1 });
VideoSchema.index({ uploadedAt: -1 });
VideoSchema.index({ publishedAt: -1 });
VideoSchema.index({ 'seasons.episodes.videoUrl': 1 });
VideoSchema.index({ title: 'text', description: 'text' });
// Add indexes for moderation fields
VideoSchema.index({ flagged: 1 });
VideoSchema.index({ restricted: 1 });
VideoSchema.index({ shadowBanned: 1 });
VideoSchema.index({ removed: 1 });
VideoSchema.index({ flaggedBy: 1 });
VideoSchema.index({ restrictedBy: 1 });
VideoSchema.index({ shadowBannedBy: 1 });
VideoSchema.index({ removedBy: 1 });

module.exports = mongoose.model('Video', VideoSchema);