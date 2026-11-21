/**
 * File: backend/models/Live.js
 * Purpose: Mongoose model for a live stream.
 *
 * SECURITY CHANGES
 *   - `streamKey` (secret RTMP ingest key), `rtmpUrl` and `streamUrl` are now
 *     `select: false`. No query returns them unless the code explicitly asks
 *     with `.select('+streamKey')`. Every admin/list/populate query that was
 *     leaking them is therefore safe without further changes.
 *   - New public `playbackId` is the ONLY token used in HLS URLs, so viewers
 *     never learn the ingest key.
 *   - toJSON/toObject strip the secret fields as a second line of defence.
 *
 * NOTE: all streams are intentionally free (isPaid is forced false below).
 */

const mongoose = require('mongoose');

// Defence in depth: even if a document that has secrets selected is serialised
// by mistake, they are removed from the output.
const stripSecrets = (_doc, ret) => {
  delete ret.streamKey;
  delete ret.rtmpUrl;
  delete ret.streamUrl;
  return ret;
};

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

    // ── Stream credentials ────────────────────────────────────────────────
    // PUBLIC: the only token that appears in HLS URLs. Generated explicitly in
    // the controller (no schema default, so legacy documents never get a
    // different random value on every load).
    playbackId: { type: String, unique: true, sparse: true },

    // SECRET: hidden from every query unless explicitly selected with '+'.
    streamKey: { type: String, default: '', select: false, index: true },
    rtmpUrl: { type: String, default: '', select: false },
    streamUrl: { type: String, default: '', select: false },

    // Public playback URL (derived from playbackId; safe to expose).
    hlsUrl: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { transform: stripSecrets },
    toObject: { transform: stripSecrets },
  }
);

// Sync hook (no `next`) — Mongoose 8 safe.
LiveSchema.pre('save', function () {
  // Prevent conflicting monetization types
  if (this.isSponsored && this.isFundraiser) {
    throw new Error('Live stream cannot be both sponsored and fundraiser');
  }

  // Force all streams to be free
  this.isPaid = false;
  this.price = 0;

  // Auto-fill streamUrl from rtmpUrl if missing (only when both are loaded)
  if (this.rtmpUrl && !this.streamUrl) {
    this.streamUrl = this.rtmpUrl;
  }
});

module.exports = mongoose.model('Live', LiveSchema);

// ═══ END OF FILE: backend/models/Live.js ═══