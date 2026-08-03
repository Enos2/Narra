const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['video', 'live', 'balance'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, refPath: 'type' }, // videoId or liveId
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    method: { type: String, enum: ['mpesa', 'manual'], default: 'mpesa' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PaymentSchema.index({ user: 1, type: 1 });
PaymentSchema.index({ targetId: 1, status: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
