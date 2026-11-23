/**
 * File: backend/models/WalletTransaction.js
 * Purpose: Append-only wallet LEDGER. Every change to a user's balance writes
 *   one row here, so balances can always be explained and audited.
 *
 *   type          amount sign   meaning
 *   topup         +             M-Pesa top-up credited to the wallet
 *   purchase      −             buyer paid for a video
 *   earning       +             creator's share of a purchase
 *   platform_fee  +             platform's share (user = null; accounting only)
 *   refund        +             money returned to a user (admin/manual)
 *   adjustment    ±             manual correction (admin/manual)
 *
 *   `reference` is UNIQUE. It is the idempotency key: crediting the same M-Pesa
 *   receipt or recording the same purchase twice is rejected by the database
 *   itself, even if two requests race.
 *
 *   Rows can never be modified or deleted through Mongoose (hooks below).
 */

const mongoose = require('mongoose');

const TYPES = ['topup', 'purchase', 'earning', 'platform_fee', 'refund', 'adjustment'];

const WalletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: TYPES, required: true, index: true },
    amount: { type: Number, required: true }, // signed: credit +, debit −
    balanceAfter: { type: Number, default: null },
    currency: { type: String, default: 'KES' },
    reference: { type: String, required: true, unique: true },
    description: { type: String, default: '', maxlength: 300 },

    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', default: null },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    counterparty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

WalletTransactionSchema.index({ user: 1, createdAt: -1 });
WalletTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });

// Ledger rows are immutable.
const immutable = function (next) {
  const err = new Error('Wallet ledger entries are append-only and cannot be modified or deleted.');
  if (typeof next === 'function') return next(err);
  throw err;
};
[
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
].forEach((op) => WalletTransactionSchema.pre(op, immutable));

WalletTransactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    const err = new Error('Wallet ledger entries are append-only and cannot be modified.');
    return typeof next === 'function' ? next(err) : (() => { throw err; })();
  }
  return typeof next === 'function' ? next() : undefined;
});

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
module.exports.TYPES = TYPES;

// ═══ END OF FILE: backend/models/WalletTransaction.js ═══