/**
 * File: backend/models/AdImpression.js
 * Description: Track individual ad impressions for analytics and billing
 */

const mongoose = require('mongoose');

const AdImpressionSchema = new mongoose.Schema(
  {
    adId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Ad', 
      required: true,
      index: true
    },
    
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      index: true
    },
    
    // Session ID for non-logged in users
    sessionId: { 
      type: String,
      index: true
    },
    
    // Where the ad was shown
    placement: {
      type: String,
      enum: ['pre-roll', 'mid-roll', 'sidebar', 'between-rows', 'home-banner'],
      required: true
    },
    
    // Content context
    videoId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Video' 
    },
    
    // Interaction data
    viewedAt: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    watchedSeconds: { 
      type: Number, 
      default: 0 
    },
    completed: { 
      type: Boolean, 
      default: false 
    },
    
    // Click tracking
    clicked: { 
      type: Boolean, 
      default: false 
    },
    clickedAt: { 
      type: Date 
    },
    
    // Revenue data
    revenue: { 
      type: Number, 
      default: 0 
    },
    
    // User data at time of impression (for analytics)
    userAge: { 
      type: Number 
    },
    userCountry: { 
      type: String 
    },
    userContinent: { 
      type: String 
    },
    
    // IP and user agent (for fraud detection)
    ipAddress: { 
      type: String 
    },
    userAgent: { 
      type: String 
    },
    
    // Unique tracking
    isUnique: { 
      type: Boolean, 
      default: true 
    },
    
    // Fraud detection
    flagged: { 
      type: Boolean, 
      default: false 
    },
    flagReason: { 
      type: String 
    }
  },
  { 
    timestamps: true 
  }
);

/*
========================================
COMPOUND INDEXES
========================================
*/
AdImpressionSchema.index({ adId: 1, viewedAt: -1 });
AdImpressionSchema.index({ userId: 1, adId: 1, viewedAt: -1 });
AdImpressionSchema.index({ sessionId: 1, adId: 1 });
AdImpressionSchema.index({ videoId: 1, viewedAt: -1 });
AdImpressionSchema.index({ clicked: 1, clickedAt: -1 });

/*
========================================
STATICS
========================================
*/

/**
 * Get unique impressions for an ad
 */
AdImpressionSchema.statics.getUniqueImpressions = async function(adId, startDate, endDate) {
  const query = { adId };
  
  if (startDate || endDate) {
    query.viewedAt = {};
    if (startDate) query.viewedAt.$gte = startDate;
    if (endDate) query.viewedAt.$lte = endDate;
  }
  
  const uniqueUserIds = await this.distinct('userId', {
    ...query,
    userId: { $ne: null }
  });
  
  const uniqueSessionIds = await this.distinct('sessionId', {
    ...query,
    sessionId: { $ne: null },
    userId: null
  });
  
  return uniqueUserIds.length + uniqueSessionIds.length;
};

/**
 * Get click-through rate for an ad
 */
AdImpressionSchema.statics.getCTR = async function(adId, startDate, endDate) {
  const query = { adId };
  
  if (startDate || endDate) {
    query.viewedAt = {};
    if (startDate) query.viewedAt.$gte = startDate;
    if (endDate) query.viewedAt.$lte = endDate;
  }
  
  const [impressions, clicks] = await Promise.all([
    this.countDocuments(query),
    this.countDocuments({ ...query, clicked: true })
  ]);
  
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0
  };
};

/**
 * Get hourly breakdown for an ad
 */
AdImpressionSchema.statics.getHourlyBreakdown = async function(adId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const pipeline = [
    {
      $match: {
        adId: mongoose.Types.ObjectId(adId),
        viewedAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: { $hour: '$viewedAt' },
        impressions: { $sum: 1 },
        clicks: { $sum: { $cond: ['$clicked', 1, 0] } },
        unique: { $addToSet: { $ifNull: ['$userId', '$sessionId'] } }
      }
    },
    {
      $project: {
        hour: '$_id',
        impressions: 1,
        clicks: 1,
        uniqueImpressions: { $size: '$unique' },
        _id: 0
      }
    },
    { $sort: { hour: 1 } }
  ];
  
  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('AdImpression', AdImpressionSchema);