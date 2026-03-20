/**
 * File: backend/models/AdRevenue.js
 * Description: Track ad revenue and payments to creators
 * Follows existing 80/20 split (80% creator, 20% platform)
 */

const mongoose = require('mongoose');

const AdRevenueSchema = new mongoose.Schema(
  {
    adId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Ad', 
      required: true,
      index: true
    },
    
    videoId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Video',
      required: true,
      index: true
    },
    
    creatorId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    
    // Revenue calculation period
    periodStart: { 
      type: Date, 
      required: true 
    },
    periodEnd: { 
      type: Date, 
      required: true 
    },
    
    // Impression data for this period
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
    
    // Revenue breakdown
    totalRevenue: { 
      type: Number, 
      default: 0 
    },
    platformShare: { 
      type: Number, 
      default: 20  // 20% to platform
    },
    creatorShare: { 
      type: Number, 
      default: 80  // 80% to creator
    },
    creatorEarnings: { 
      type: Number, 
      default: 0 
    },
    platformEarnings: { 
      type: Number, 
      default: 0 
    },
    
    // Payment tracking
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed'],
      default: 'pending'
    },
    paidAt: { 
      type: Date 
    },
    transactionId: { 
      type: String 
    },
    
    // Calculation metadata
    calculationMethod: {
      type: String,
      enum: ['cpm', 'cpc', 'flat'],
      default: 'cpm'
    },
    rate: { 
      type: Number  // e.g., $5 per 1000 impressions
    },
    
    // Audit
    calculatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    calculatedAt: { 
      type: Date, 
      default: Date.now 
    }
  },
  { 
    timestamps: true 
  }
);

/*
========================================
INDEXES
========================================
*/
AdRevenueSchema.index({ creatorId: 1, status: 1 });
AdRevenueSchema.index({ videoId: 1, periodStart: -1 });
AdRevenueSchema.index({ adId: 1, periodStart: -1 });
AdRevenueSchema.index({ status: 1, periodEnd: 1 });

/*
========================================
VIRTUALS
========================================
*/
AdRevenueSchema.virtual('eCPM').get(function() {
  if (this.impressions === 0) return 0;
  return (this.totalRevenue / this.impressions) * 1000;
});

AdRevenueSchema.virtual('displayPeriod').get(function() {
  const start = this.periodStart.toLocaleDateString();
  const end = this.periodEnd.toLocaleDateString();
  return `${start} - ${end}`;
});

/*
========================================
METHODS
========================================
*/

/**
 * Mark as paid
 */
AdRevenueSchema.methods.markAsPaid = async function(transactionId) {
  this.status = 'paid';
  this.paidAt = new Date();
  if (transactionId) this.transactionId = transactionId;
  await this.save();
  return this;
};

/**
 * Calculate creator's total earnings
 */
AdRevenueSchema.statics.getCreatorEarnings = async function(creatorId, startDate, endDate) {
  const query = { creatorId };
  
  if (startDate || endDate) {
    query.periodEnd = {};
    if (startDate) query.periodEnd.$gte = startDate;
    if (endDate) query.periodEnd.$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$creatorEarnings' },
        totalImpressions: { $sum: '$impressions' },
        totalClicks: { $sum: '$clicks' },
        paidEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'paid'] }, '$creatorEarnings', 0]
          }
        },
        pendingEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, '$creatorEarnings', 0]
          }
        }
      }
    }
  ]);
  
  return result[0] || {
    totalEarnings: 0,
    totalImpressions: 0,
    totalClicks: 0,
    paidEarnings: 0,
    pendingEarnings: 0
  };
};

module.exports = mongoose.model('AdRevenue', AdRevenueSchema);