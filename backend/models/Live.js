const mongoose = require('mongoose');

const LiveSchema = new mongoose.Schema(
  {
    /*
    ========================================
    BASIC INFO
    ========================================
    */
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    thumbnailUrl: { type: String },

    /*
    ========================================
    HOST / CREATOR
    ========================================
    */
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /*
    ========================================
    STATUS & TIMING
    ========================================
    */
    status: { 
      type: String, 
      enum: ['pending', 'scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled', 
      index: true 
    },
    scheduledAt: Date,
    startedAt: Date,
    endedAt: Date,
    duration: Number, // seconds, calculated when ended
    forceClosed: { type: Boolean, default: false }, // admin can force-close live

    /*
    ========================================
    CLASSIFICATION
    ========================================
    */
    category: { type: String }, // talk, concert, sports, podcast, etc
    tags: [{ type: String, index: true }],
    ageRating: { type: String, enum: ['G', 'PG', 'PG-13', 'R', 'NC-17'], default: 'PG' },

    /*
    ========================================
    PAYWALL & MONETIZATION
    ========================================
    */
    isPaid: { type: Boolean, default: false, index: true },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
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
    sponsorDescription: { type: String, required: function () { return this.isSponsored; } },
    fundraiserDescription: { type: String, required: function () { return this.isFundraiser; } },
    fundraiserGoal: { type: Number },
    fundraiserRaised: { type: Number, default: 0 },

    /*
    ========================================
    VIEWERS & CHAT
    ========================================
    */
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    peakViewers: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    chatEnabled: { type: Boolean, default: true },
    chatSlowMode: { type: Boolean, default: false },

    /*
    ========================================
    GEO RESTRICTIONS
    ========================================
    */
    blockedCountries: [{ type: String }],
    blockedContinents: [{ type: String }],

    /*
    ========================================
    MODERATION
    ========================================
    */
    approved: { type: Boolean, default: false, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isRemoved: { type: Boolean, default: false },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    removalReason: { type: String },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String },
    adminNotes: { type: String },
    violationReports: [
      {
        admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    /*
    ========================================
    REPLAY HANDLING
    ========================================
    */
    saveReplay: { type: Boolean, default: true },
    replayVideo: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },

    /*
    ========================================
    SYSTEM
    ========================================
    */
    isDeleted: { type: Boolean, default: false },

    /*
    ========================================
    STREAM KEYS / HLS
    ========================================
    */
    rtmpUrl: { type: String },
    streamKey: { type: String },
    hlsUrl: { type: String },
  },
  { timestamps: true }
);

/*
========================================
PRE SAVE HOOK - FIXED VERSION
========================================
*/
LiveSchema.pre('save', function (next) {
  // Check if both sponsored and fundraiser
  if (this.isSponsored && this.isFundraiser) {
    const error = new Error('Live stream cannot be both sponsored and fundraiser');
    return next(error);
  }
  
  // If not paid, ensure price is 0
  if (!this.isPaid) {
    this.price = 0;
  }
  
  next(); // Call next without error to proceed
});

module.exports = mongoose.model('Live', LiveSchema);