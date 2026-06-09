// File: backend/models/Live.js
const mongoose = require('mongoose');

const LiveSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000, default: '' },
    thumbnailUrl: { type: String, default: '' },

    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
      type: String,
      enum: ['pending', 'scheduled', 'live', 'ended', 'cancelled'],
      default: 'pending',
      index: true,
    },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    forceClosed: { type: Boolean, default: false },

    category: { type: String, default: 'general' },
    tags: [{ type: String }],
    ageRating: {
      type: String,
      enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', '13+', '16+', '18+'],
      default: 'PG',
    },

    isPaid: { type: Boolean, default: false },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    purchases: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        purchasedAt: { type: Date, default: Date.now },
      },
    ],

    isSponsored: { type: Boolean, default: false },
    isFundraiser: { type: Boolean, default: false },
    sponsorDescription: { type: String, default: '' },
    fundraiserDescription: { type: String, default: '' },
    fundraiserGoal: { type: Number, default: 0 },
    fundraiserRaised: { type: Number, default: 0 },

    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    peakViewers: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    chatEnabled: { type: Boolean, default: true },
    chatSlowMode: { type: Boolean, default: false },

    blockedCountries: [{ type: String }],
    blockedContinents: [{ type: String }],

    approved: { type: Boolean, default: false, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejected: { type: Boolean, default: false },
    isRemoved: { type: Boolean, default: false },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    removalReason: { type: String, default: '' },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    isShadowBanned: { type: Boolean, default: false },
    shadowBanReason: { type: String, default: '' },
    shadowBannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shadowBannedAt: { type: Date, default: null },
    violationReports: [
      {
        admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    adminEnded: { type: Boolean, default: false },
    adminEndedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminEndedReason: { type: String, default: '' },

    saveReplay: { type: Boolean, default: true },
    replayVideo: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },

    isDeleted: { type: Boolean, default: false },

    streamKey: { type: String, default: '' },
    rtmpUrl: { type: String, default: '' },
    streamUrl: { type: String, default: '' },
    hlsUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

// ✅ FIXED MIDDLEWARE (NO next, NO crash)
LiveSchema.pre('save', function () {
  // Prevent conflicting monetization types
  if (this.isSponsored && this.isFundraiser) {
    throw new Error('Live stream cannot be both sponsored and fundraiser');
  }

  // Force all streams to be free
  this.isPaid = false;
  this.price = 0;

  // Auto-fill streamUrl from rtmpUrl if missing
  if (this.rtmpUrl && !this.streamUrl) {
    this.streamUrl = this.rtmpUrl;
  }
});

module.exports = mongoose.model('Live', LiveSchema);