/**
 * models/Conversation.js
 * Supports two lanes:
 *   "user"       — user ↔ user
 *   "admin"      — admin ↔ admin (any role)
 *
 * participantModel distinguishes which collection each participant lives in.
 */

const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema(
  {
    participantId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    participantModel: { type: String, enum: ['User', 'Admin'], required: true },
    unreadCount:      { type: Number, default: 0 },
    lastReadAt:       { type: Date, default: null },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    lane: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
      index: true,
    },

    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (v) => v.length === 2,
        message: 'A conversation must have exactly 2 participants.',
      },
    },

    lastMessage: {
      content:   { type: String, default: '' },
      senderId:  { type: mongoose.Schema.Types.ObjectId, default: null },
      sentAt:    { type: Date, default: null },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ── indexes ── */
ConversationSchema.index({ 'participants.participantId': 1 });
ConversationSchema.index({ lane: 1, updatedAt: -1 });

/* ── helpers ── */
ConversationSchema.methods.hasParticipant = function (userId) {
  return this.participants.some(
    (p) => p.participantId.toString() === userId.toString()
  );
};

ConversationSchema.methods.getOtherParticipant = function (userId) {
  return this.participants.find(
    (p) => p.participantId.toString() !== userId.toString()
  );
};

ConversationSchema.methods.incrementUnread = function (senderId) {
  this.participants.forEach((p) => {
    if (p.participantId.toString() !== senderId.toString()) {
      p.unreadCount = (p.unreadCount || 0) + 1;
    }
  });
};

ConversationSchema.methods.clearUnread = function (userId) {
  const p = this.participants.find(
    (p) => p.participantId.toString() === userId.toString()
  );
  if (p) {
    p.unreadCount = 0;
    p.lastReadAt = new Date();
  }
};

/* ── static: find or create a 1-on-1 conversation ── */
ConversationSchema.statics.findOrCreate = async function ({
  lane,
  participantA,   // { id, model }
  participantB,   // { id, model }
}) {
  // FIXED: Find conversation where both participants exist
  const existing = await this.findOne({
    lane,
    'participants.participantId': participantA.id,
  }).then(async (conv) => {
    if (!conv) return null;
    const hasB = conv.participants.some(
      (p) => p.participantId.toString() === participantB.id.toString()
    );
    return hasB ? conv : null;
  });

  if (existing) return { conversation: existing, created: false };

  // Create new conversation
  const conversation = await this.create({
    lane,
    participants: [
      { participantId: participantA.id, participantModel: participantA.model },
      { participantId: participantB.id, participantModel: participantB.model },
    ],
  });
  return { conversation, created: true };
};

module.exports =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', ConversationSchema);