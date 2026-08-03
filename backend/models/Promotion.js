/**
 * File: backend/models/Promotion.js
 * Internal name: Promotion (displayed as "Campaign" to users/admins)
 * Replaces: Ad.js
 * Purpose: Narra platform campaign/promotion system
 */

const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema(
  {
    /*
    ========================================
    BASIC INFO
    ========================================
    */
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
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
    TYPE & PLACEMENT
    ========================================
    */
    type: {
      type: String,
      enum: {
        values: ['video', 'banner', 'sponsored'],
        message: '{VALUE} is not a valid campaign type'
      },
      required: [true, 'Campaign type is required']
    },

    placement: {
      type: String,
      enum: {
        values: ['pre-roll', 'mid-roll', 'sidebar', 'between-rows', 'home-banner'],
        message: '{VALUE} is not a valid placement'
      },
      required: [true, 'Placement is required']
    },

    /*
    ========================================
    MEDIA
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
        validator: function (v) {
          return /^(https?:\/\/)/.test(v);
        },
        message: 'Target URL must start with http:// or https://'
      }
    },

    /*
    ========================================
    AGE & CONTENT
    ========================================
    */
    ageRating: {
      type: String,
      enum: {
        values: ['G', 'PG', 'PG-13', '13+', '16+', '18+', 'ALL'],
        message: '{VALUE} is not a valid age rating'
      },
      default: 'ALL'
    },

    contentFlags: {
      violence: { type: Boolean, default: false },
      sex:      { type: Boolean, default: false },
      language: { type: Boolean, default: false },
      graphic:  { type: Boolean, default: false }
    },

    /*
    ========================================
    TARGETING
    ========================================
    */
    targetCountries: [{ type: String, uppercase: true }],
    targetContinents: [{
      type: String,
      enum: ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA']
    }],

    minAge: { type: Number, min: 0, max: 120, default: null },
    maxAge: { type: Number, min: 0, max: 120, default: null },

    targetGender: {
      type: String,
      enum: ['male', 'female', 'other', 'all'],
      default: 'all'
    },

    /*
    ========================================
    SCHEDULE & BUDGET
    ========================================
    */
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (v) {
          return new Date(v) > new Date(this.startDate);
        },
        message: 'End date must be after start date'
      }
    },

    totalBudget: {
      type: Number,
      required: [true, 'Total budget is required'],
      min: [1, 'Budget must be at least 1']
    },
    dailyBudget: {
      type: Number,
      default: null
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'KES']
    },

    maxImpressionsPerUser: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    maxClicksPerUser: {
      type: Number,
      default: 5,
      min: 1,
      max: 50
    },

    /*
    ========================================
    PERFORMANCE TRACKING
    ========================================
    */
    impressions:       { type: Number, default: 0 },
    uniqueImpressions: { type: Number, default: 0 },
    clicks:            { type: Number, default: 0 },
    uniqueClicks:      { type: Number, default: 0 },
    ctr:               { type: Number, default: 0, min: 0, max: 100 },

    spentAmount:     { type: Number, default: 0 },
    remainingBudget: { type: Number, default: 0 },

    /*
    ========================================
    ADMINISTRATION
    ========================================
    */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
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

    approved:   { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    approvedAt: { type: Date, default: null },

    rejected:        { type: Boolean, default: false },
    rejectionReason: { type: String, default: null },

    pausedAt:  { type: Date, default: null },
    pausedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    resumedAt: { type: Date, default: null },
    resumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

    /*
    ========================================
    BLOCKED ACCOUNTS / REGIONS
    ========================================
    */
    blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedCountries: [{ type: String, uppercase: true }],
    blockedContinents: [{ type: String }],

    /*
    ========================================
    METADATA
    ========================================
    */
    tags:  [{ type: String }],
    notes: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true }
  }
);

/*
========================================
INDEXES
========================================
*/
PromotionSchema.index({ status: 1, startDate: 1, endDate: 1 });
PromotionSchema.index({ ageRating: 1 });
PromotionSchema.index({ targetCountries: 1 });
PromotionSchema.index({ createdBy: 1 });
PromotionSchema.index({ isDeleted: 1 });
PromotionSchema.index({ type: 1, placement: 1 });
PromotionSchema.index({ totalBudget: 1, spentAmount: 1 });

/*
========================================
VIRTUALS
========================================
*/
PromotionSchema.virtual('isActive').get(function () {
  const now = new Date();
  return (
    this.status === 'active' &&
    now >= this.startDate &&
    now <= this.endDate &&
    !this.isDeleted &&
    this.remainingBudget > 0
  );
});

PromotionSchema.virtual('progress').get(function () {
  if (!this.totalBudget) return 0;
  return Math.min(100, (this.spentAmount / this.totalBudget) * 100);
});

PromotionSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  if (now > this.endDate) return 0;
  return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

/*
========================================
PRE-SAVE HOOK
========================================
*/
PromotionSchema.pre('save', async function () {
  if (this.impressions > 0) {
    this.ctr = parseFloat(((this.clicks / this.impressions) * 100).toFixed(4));
  }

  if (this.isNew) {
    this.remainingBudget = this.totalBudget;
  } else {
    this.remainingBudget = Math.max(0, this.totalBudget - this.spentAmount);
  }

  const now = new Date();
  if (this.status === 'active') {
    if (this.remainingBudget <= 0 || now > this.endDate) {
      this.status = 'ended';
    }
  }
});

/*
========================================
INSTANCE METHODS
========================================
*/

/**
 * Check if this promotion is eligible to be shown to a given user.
 * Checks age, gender, country, continent, and block lists.
 */
PromotionSchema.methods.isEligibleForUser = function (user) {
  if (!this.isActive) return false;

  // Check blocked user
  if (user && this.blockedUserIds && this.blockedUserIds.length > 0) {
    const userId = user._id || user.id;
    if (this.blockedUserIds.some(id => id.toString() === userId.toString())) return false;
  }

  const userAge = user && user.dateOfBirth
    ? Math.floor((new Date() - new Date(user.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  // Age rating check
  if (userAge !== null) {
    const ageAllowed = (rating) => {
      switch (rating) {
        case 'G':     return userAge >= 0;
        case 'PG':    return userAge >= 8;
        case 'PG-13': return userAge >= 13;
        case '13+':   return userAge >= 13;
        case '16+':   return userAge >= 16;
        case '18+':   return userAge >= 18;
        case 'ALL':   return true;
        default:      return true;
      }
    };
    if (!ageAllowed(this.ageRating)) return false;
  }

  if (this.minAge && userAge !== null && userAge < this.minAge) return false;
  if (this.maxAge && userAge !== null && userAge > this.maxAge) return false;

  // Gender check
  if (this.targetGender !== 'all' && user && user.gender && user.gender !== this.targetGender) return false;

  // Country block
  if (user && user.country && this.blockedCountries && this.blockedCountries.length > 0) {
    if (this.blockedCountries.includes(user.country)) return false;
  }

  // Continent block
  if (user && user.continent && this.blockedContinents && this.blockedContinents.length > 0) {
    if (this.blockedContinents.includes(user.continent)) return false;
  }

  // Country targeting (whitelist — if set, only show to these countries)
  if (this.targetCountries && this.targetCountries.length > 0) {
    if (!user || !user.country || !this.targetCountries.includes(user.country)) return false;
  }

  // Continent targeting (whitelist)
  if (this.targetContinents && this.targetContinents.length > 0) {
    if (!user || !user.continent || !this.targetContinents.includes(user.continent)) return false;
  }

  return true;
};

PromotionSchema.methods.trackImpression = async function (userId, isUnique = false) {
  this.impressions += 1;
  if (isUnique) this.uniqueImpressions += 1;

  const impressionValue = this.dailyBudget
    ? this.dailyBudget / 1000
    : this.totalBudget / (this.impressions + 1000);

  this.spentAmount = Math.min(this.totalBudget, this.spentAmount + impressionValue);
  await this.save();
  return this;
};

PromotionSchema.methods.trackClick = async function (userId, isUnique = false) {
  this.clicks += 1;
  if (isUnique) this.uniqueClicks += 1;
  if (this.impressions > 0) {
    this.ctr = (this.clicks / this.impressions) * 100;
  }
  await this.save();
  return this;
};

PromotionSchema.methods.pause = async function (adminId) {
  if (this.status !== 'active') throw new Error('Only active campaigns can be paused');
  this.status   = 'paused';
  this.pausedAt = new Date();
  this.pausedBy = adminId;
  await this.save();
  return this;
};

PromotionSchema.methods.resume = async function (adminId) {
  if (this.status !== 'paused') throw new Error('Only paused campaigns can be resumed');
  this.status    = 'active';
  this.resumedAt = new Date();
  this.resumedBy = adminId;
  await this.save();
  return this;
};

PromotionSchema.methods.approve = async function (adminId) {
  this.status          = 'active';
  this.approved        = true;
  this.approvedBy      = adminId;
  this.approvedAt      = new Date();
  this.rejected        = false;
  this.rejectionReason = null;
  await this.save();
  return this;
};

PromotionSchema.methods.reject = async function (adminId, reason) {
  this.status          = 'rejected';
  this.approved        = false;
  this.rejected        = true;
  this.rejectionReason = reason || 'Rejected by admin';
  this.approvedBy      = null;
  this.approvedAt      = null;
  await this.save();
  return this;
};

PromotionSchema.methods.softDelete = async function (adminId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  this.status    = 'ended';
  await this.save();
  return this;
};

/*
========================================
STATIC METHODS
========================================
*/

/**
 * Get active promotions eligible for a specific user.
 * Filters by age, gender, country, continent, and block lists server-side.
 */
PromotionSchema.statics.getActiveForUser = async function (user, placement = null, limit = 5) {
  const now = new Date();

  const query = {
    status:          'active',
    startDate:       { $lte: now },
    endDate:         { $gte: now },
    isDeleted:       false,
    remainingBudget: { $gt: 0 }
  };

  if (placement) query.placement = placement;

  // Age rating filter
  if (user && user.dateOfBirth) {
    const userAge = Math.floor(
      (now - new Date(user.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25)
    );
    const allowed = ['G', 'ALL'];
    if (userAge >= 8)  allowed.push('PG');
    if (userAge >= 13) allowed.push('PG-13', '13+');
    if (userAge >= 16) allowed.push('16+');
    if (userAge >= 18) allowed.push('18+');
    query.ageRating = { $in: allowed };
  } else {
    query.ageRating = { $in: ['G', 'PG', 'ALL'] };
  }

  // Exclude blocked users
  if (user) {
    const userId = user._id || user.id;
    query.blockedUserIds = { $nin: [userId] };

    // Country block
    if (user.country) {
      query.blockedCountries = { $nin: [user.country] };
    }

    // Continent block
    if (user.continent) {
      query.blockedContinents = { $nin: [user.continent] };
    }

    // Gender targeting — only include "all" or matching gender
    if (user.gender) {
      query.targetGender = { $in: ['all', user.gender] };
    }

    // Country targeting (whitelist) — show if no countries set, or user country is included
    if (user.country) {
      query.$or = [
        { targetCountries: { $size: 0 } },
        { targetCountries: user.country }
      ];
    }
  }

  const promotions = await this.find(query)
    .sort({ ctr: -1, remainingBudget: -1 })
    .limit(limit)
    .lean();

  return promotions;
};

PromotionSchema.statics.getAnalytics = async function (period = 'week') {
  const now = new Date();
  let startDate;
  switch (period) {
    case 'day':   startDate = new Date(now.getTime() - 86400000);       break;
    case 'week':  startDate = new Date(now.getTime() - 604800000);      break;
    case 'month': startDate = new Date(now.getTime() - 2592000000);     break;
    case 'year':  startDate = new Date(now.getTime() - 31536000000);    break;
    default:      startDate = new Date(now.getTime() - 604800000);
  }

  const items = await this.find({ createdAt: { $gte: startDate }, isDeleted: false });

  return {
    period,
    summary: {
      totalCampaigns:   items.length,
      totalImpressions: items.reduce((s, p) => s + p.impressions, 0),
      totalClicks:      items.reduce((s, p) => s + p.clicks, 0),
      totalSpent:       items.reduce((s, p) => s + p.spentAmount, 0),
      totalBudget:      items.reduce((s, p) => s + p.totalBudget, 0),
      averageCTR:
        items.reduce((s, p) => s + p.impressions, 0) > 0
          ? (items.reduce((s, p) => s + p.clicks, 0) /
             items.reduce((s, p) => s + p.impressions, 0)) * 100
          : 0
    },
    byStatus: {
      active:   items.filter(p => p.status === 'active').length,
      paused:   items.filter(p => p.status === 'paused').length,
      ended:    items.filter(p => p.status === 'ended').length,
      pending:  items.filter(p => p.status === 'pending').length,
      rejected: items.filter(p => p.status === 'rejected').length
    },
    byType: {
      video:     items.filter(p => p.type === 'video').length,
      banner:    items.filter(p => p.type === 'banner').length,
      sponsored: items.filter(p => p.type === 'sponsored').length
    }
  };
};

module.exports = mongoose.models.Promotion || mongoose.model('Promotion', PromotionSchema);