/**
 * File: backend/models/Ad.js
 * Description: Ad model for NARRA platform with age-based targeting
 * Age Rating System: G, PG, PG-13, 13+, 16+, 18+
 * Admin Hierarchy: Super Admin (full), Platform Admin (create/manage), Support Admin (view-only)
 */

const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema(
  {
    /*
    ========================================
    BASIC AD INFO
    ========================================
    */
    title: { 
      type: String, 
      required: [true, 'Ad title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: { 
      type: String, 
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    /*
    ========================================
    AD TYPE & PLACEMENT
    ========================================
    */
    type: {
      type: String,
      enum: {
        values: ['video', 'banner', 'sponsored'],
        message: '{VALUE} is not a valid ad type'
      },
      required: [true, 'Ad type is required']
    },
    
    placement: {
      type: String,
      enum: {
        values: ['pre-roll', 'mid-roll', 'sidebar', 'between-rows', 'home-banner'],
        message: '{VALUE} is not a valid placement'
      },
      required: [true, 'Ad placement is required']
    },

    /*
    ========================================
    MEDIA ASSETS
    ========================================
    */
    mediaUrl: { 
      type: String, 
      required: [true, 'Media URL is required']
    },
    thumbnailUrl: { 
      type: String,
      default: null 
    },
    targetUrl: { 
      type: String, 
      required: [true, 'Target URL is required'],
      validate: {
        validator: function(v) {
          return /^(https?:\/\/)/.test(v);
        },
        message: 'Target URL must start with http:// or https://'
      }
    },
    
    /*
    ========================================
    AGE RATING & CONTENT MATCHING
    ========================================
    */
    ageRating: {
      type: String,
      enum: {
        values: ['G', 'PG', 'PG-13', '13+', '16+', '18+', 'ALL'],
        message: '{VALUE} is not a valid age rating'
      },
      required: [true, 'Age rating is required'],
      default: 'ALL'
    },
    
    // Match with video content flags for contextual targeting
    contentFlags: {
      violence: { type: Boolean, default: false },
      sex: { type: Boolean, default: false },
      language: { type: Boolean, default: false },
      graphic: { type: Boolean, default: false }
    },

    /*
    ========================================
    TARGETING OPTIONS
    ========================================
    */
    targetCountries: [{ 
      type: String,
      uppercase: true
    }],
    targetContinents: [{ 
      type: String,
      enum: ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA']
    }],
    
    // Age range targeting (overrides ageRating if set)
    minAge: { type: Number, min: 0, max: 120 },
    maxAge: { type: Number, min: 0, max: 120 },
    
    // Gender targeting (optional)
    targetGender: {
      type: String,
      enum: ['male', 'female', 'other', 'all'],
      default: 'all'
    },

    /*
    ========================================
    CAMPAIGN SCHEDULE & BUDGET
    ========================================
    */
    startDate: { 
      type: Date, 
      required: [true, 'Start date is required'],
      validate: {
        validator: function(v) {
          return v >= new Date(new Date().setHours(0,0,0,0));
        },
        message: 'Start date cannot be in the past'
      }
    },
    endDate: { 
      type: Date, 
      required: [true, 'End date is required'],
      validate: {
        validator: function(v) {
          return v > this.startDate;
        },
        message: 'End date must be after start date'
      }
    },
    
    // Budget controls
    totalBudget: { 
      type: Number, 
      required: [true, 'Total budget is required'],
      min: [1, 'Budget must be at least 1']
    },
    dailyBudget: { 
      type: Number,
      validate: {
        validator: function(v) {
          return v <= this.totalBudget;
        },
        message: 'Daily budget cannot exceed total budget'
      }
    },
    currency: { 
      type: String, 
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'KES']
    },
    
    // Frequency capping
    maxImpressionsPerUser: { 
      type: Number, 
      default: 3,
      min: 1,
      max: 100
    },
    maxClicksPerUser: { 
      type: Number, 
      default: 1,
      min: 1,
      max: 10
    },

    /*
    ========================================
    PERFORMANCE TRACKING
    ========================================
    */
    impressions: { 
      type: Number, 
      default: 0 
    },
    uniqueImpressions: { 
      type: Number, 
      default: 0 
    },
    clicks: { 
      type: Number, 
      default: 0 
    },
    uniqueClicks: { 
      type: Number, 
      default: 0 
    },
    ctr: { 
      type: Number, 
      default: 0,  // Click-through rate (clicks/impressions)
      min: 0,
      max: 100
    },
    
    // Revenue tracking
    spentAmount: { 
      type: Number, 
      default: 0 
    },
    remainingBudget: { 
      type: Number,
      default: function() {
        return this.totalBudget;
      }
    },

    /*
    ========================================
    ADMINISTRATION
    ========================================
    */
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    
    status: {
      type: String,
      enum: {
        values: ['pending', 'active', 'paused', 'ended', 'rejected'],
        message: '{VALUE} is not a valid status'
      },
      default: 'pending'
    },
    
    // Approval workflow (matching video approval pattern)
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    
    rejected: { type: Boolean, default: false },
    rejectionReason: { type: String },
    
    // Pause/Resume tracking
    pausedAt: { type: Date },
    pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumedAt: { type: Date },
    resumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /*
    ========================================
    REVENUE SHARING
    ========================================
    */
    platformShare: { 
      type: Number, 
      default: 20,  // 20% to platform
      min: 0,
      max: 100
    },
    creatorShare: { 
      type: Number, 
      default: 80,  // 80% to content creators (distributed based on impressions)
      min: 0,
      max: 100
    },

    /*
    ========================================
    METADATA & TRACKING
    ========================================
    */
    tags: [{ type: String }],
    notes: { type: String },
    
    // For programmatic ads
    isProgrammatic: { type: Boolean, default: false },
    bidPrice: { type: Number }, // For programmatic bidding
    
    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/*
========================================
INDEXES
========================================
*/
AdSchema.index({ status: 1, startDate: 1, endDate: 1 });
AdSchema.index({ ageRating: 1 });
AdSchema.index({ targetCountries: 1 });
AdSchema.index({ createdBy: 1 });
AdSchema.index({ isDeleted: 1 });
AdSchema.index({ type: 1, placement: 1 });
AdSchema.index({ totalBudget: 1, spentAmount: 1 });

/*
========================================
VIRTUALS
========================================
*/
AdSchema.virtual('isActive').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    now >= this.startDate &&
    now <= this.endDate &&
    !this.isDeleted &&
    this.remainingBudget > 0
  );
});

AdSchema.virtual('progress').get(function() {
  if (!this.totalBudget) return 0;
  return Math.min(100, (this.spentAmount / this.totalBudget) * 100);
});

AdSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  if (now > this.endDate) return 0;
  const diffTime = this.endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

/*
========================================
PRE-SAVE HOOKS
========================================
*/
AdSchema.pre('save', function(next) {
  // Update CTR
  if (this.impressions > 0) {
    this.ctr = (this.clicks / this.impressions) * 100;
  }
  
  // Update remaining budget
  this.remainingBudget = this.totalBudget - this.spentAmount;
  
  // Auto-end if budget exhausted or end date passed
  const now = new Date();
  if (this.status === 'active') {
    if (this.remainingBudget <= 0 || now > this.endDate) {
      this.status = 'ended';
    }
  }
  
  next();
});

/*
========================================
METHODS
========================================
*/

/**
 * Check if ad is eligible for a user based on age
 */
AdSchema.methods.isEligibleForUser = function(user) {
  // If ad is not active, not eligible
  if (!this.isActive) return false;
  
  // If no user, check if ad is safe for all ages
  if (!user) {
    return ['G', 'PG', 'ALL'].includes(this.ageRating);
  }
  
  // Calculate user age from dateOfBirth
  const userAge = user.dateOfBirth ? 
    Math.floor((new Date() - new Date(user.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25)) : 
    null;
  
  // If we have user age, check age rating
  if (userAge !== null) {
    const ageAllowed = (rating) => {
      switch(rating) {
        case 'G': return userAge >= 0;
        case 'PG': return userAge >= 8;
        case 'PG-13': return userAge >= 13;
        case '13+': return userAge >= 13;
        case '16+': return userAge >= 16;
        case '18+': return userAge >= 18;
        case 'ALL': return true;
        default: return true;
      }
    };
    
    if (!ageAllowed(this.ageRating)) return false;
  }
  
  // Check age range targeting
  if (this.minAge && userAge < this.minAge) return false;
  if (this.maxAge && userAge > this.maxAge) return false;
  
  // Check gender targeting
  if (this.targetGender !== 'all' && user.gender !== this.targetGender) return false;
  
  // Check country targeting
  if (this.targetCountries && this.targetCountries.length > 0) {
    if (!user.country || !this.targetCountries.includes(user.country)) return false;
  }
  
  // Check continent targeting
  if (this.targetContinents && this.targetContinents.length > 0) {
    if (!user.continent || !this.targetContinents.includes(user.continent)) return false;
  }
  
  return true;
};

/**
 * Track an impression
 */
AdSchema.methods.trackImpression = async function(userId, isUnique = false) {
  this.impressions += 1;
  if (isUnique) this.uniqueImpressions += 1;
  
  // Calculate cost per impression (CPM model - cost per 1000 impressions)
  // For now, we'll use a simple model: budget spent proportionally to impressions
  const impressionValue = this.dailyBudget ? 
    this.dailyBudget / 1000 : // Assume 1000 impressions per day
    this.totalBudget / (this.impressions + 1000); // Fallback
  
  this.spentAmount = Math.min(this.totalBudget, this.spentAmount + impressionValue);
  
  await this.save();
  return this;
};

/**
 * Track a click
 */
AdSchema.methods.trackClick = async function(userId, isUnique = false) {
  this.clicks += 1;
  if (isUnique) this.uniqueClicks += 1;
  
  // Update CTR
  if (this.impressions > 0) {
    this.ctr = (this.clicks / this.impressions) * 100;
  }
  
  await this.save();
  return this;
};

/**
 * Pause the ad campaign
 */
AdSchema.methods.pause = async function(userId) {
  if (this.status !== 'active') {
    throw new Error('Can only pause active ads');
  }
  
  this.status = 'paused';
  this.pausedAt = new Date();
  this.pausedBy = userId;
  
  await this.save();
  return this;
};

/**
 * Resume the ad campaign
 */
AdSchema.methods.resume = async function(userId) {
  if (this.status !== 'paused') {
    throw new Error('Can only resume paused ads');
  }
  
  this.status = 'active';
  this.resumedAt = new Date();
  this.resumedBy = userId;
  
  await this.save();
  return this;
};

/**
 * Approve the ad (admin action)
 */
AdSchema.methods.approve = async function(userId) {
  this.status = 'active';
  this.approved = true;
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.rejected = false;
  this.rejectionReason = null;
  
  await this.save();
  return this;
};

/**
 * Reject the ad (admin action)
 */
AdSchema.methods.reject = async function(userId, reason) {
  this.status = 'rejected';
  this.approved = false;
  this.rejected = true;
  this.rejectionReason = reason || 'Rejected by admin';
  this.approvedBy = null;
  this.approvedAt = null;
  
  await this.save();
  return this;
};

/**
 * Soft delete the ad
 */
AdSchema.methods.softDelete = async function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  
  await this.save();
  return this;
};

/*
========================================
STATICS
========================================
*/

/**
 * Get active ads for a user based on age and targeting
 */
AdSchema.statics.getActiveAdsForUser = async function(user, limit = 5) {
  const now = new Date();
  
  const query = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    isDeleted: false,
    remainingBudget: { $gt: 0 }
  };
  
  // Age-based filtering
  if (user && user.dateOfBirth) {
    const userAge = Math.floor((now - new Date(user.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25));
    
    // Determine allowed age ratings based on user age
    const allowedRatings = ['G']; // Everyone gets G
    
    if (userAge >= 8) allowedRatings.push('PG');
    if (userAge >= 13) allowedRatings.push('PG-13', '13+');
    if (userAge >= 16) allowedRatings.push('16+');
    if (userAge >= 18) allowedRatings.push('18+');
    
    query.ageRating = { $in: allowedRatings };
  } else {
    // Non-logged in users only see G and PG ads
    query.ageRating = { $in: ['G', 'PG', 'ALL'] };
  }
  
  // Country/continent targeting
  if (user && user.country) {
    query.$or = [
      { targetCountries: { $in: [user.country] } },
      { targetCountries: { $size: 0 } },
      { targetCountries: null }
    ];
  }
  
  if (user && user.continent) {
    query.$or = [
      { targetContinents: { $in: [user.continent] } },
      { targetContinents: { $size: 0 } },
      { targetContinents: null }
    ];
  }
  
  // Get ads, prioritize by budget/performance
  const ads = await this.find(query)
    .sort({ 
      priority: -1,
      ctr: -1,
      remainingBudget: -1 
    })
    .limit(limit)
    .populate('createdBy', 'name email');
  
  return ads;
};

/**
 * Get ads for admin moderation (similar to video approval)
 */
AdSchema.statics.getForModeration = async function(status = 'pending', page = 1, limit = 20) {
  const query = { isDeleted: false };
  
  if (status !== 'all') {
    query.status = status;
  }
  
  const skip = (page - 1) * limit;
  
  const [ads, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email role'),
    this.countDocuments(query)
  ]);
  
  return {
    ads,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get ad analytics for reporting
 */
AdSchema.statics.getAnalytics = async function(period = 'week') {
  const now = new Date();
  let startDate;
  
  switch(period) {
    case 'day':
      startDate = new Date(now.setDate(now.getDate() - 1));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }
  
  const ads = await this.find({
    createdAt: { $gte: startDate },
    isDeleted: false
  });
  
  const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
  const totalSpent = ads.reduce((sum, ad) => sum + ad.spentAmount, 0);
  const totalBudget = ads.reduce((sum, ad) => sum + ad.totalBudget, 0);
  
  return {
    period,
    summary: {
      totalAds: ads.length,
      totalImpressions,
      totalClicks,
      totalSpent,
      totalBudget,
      averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    },
    byStatus: {
      active: ads.filter(ad => ad.status === 'active').length,
      paused: ads.filter(ad => ad.status === 'paused').length,
      ended: ads.filter(ad => ad.status === 'ended').length,
      pending: ads.filter(ad => ad.status === 'pending').length
    },
    byType: {
      video: ads.filter(ad => ad.type === 'video').length,
      banner: ads.filter(ad => ad.type === 'banner').length,
      sponsored: ads.filter(ad => ad.type === 'sponsored').length
    }
  };
};

module.exports = mongoose.model('Ad', AdSchema);