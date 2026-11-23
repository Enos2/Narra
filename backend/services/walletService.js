/**
 * File: backend/services/walletService.js
 * Purpose: All money movement. Controllers never touch `User.balance` directly.
 *
 * GUARANTEES
 *   - A debit only happens if the balance is sufficient, in ONE atomic database
 *     operation (`balance >= price` is part of the update filter). Two requests
 *     can no longer spend the same money twice (the old code read the balance,
 *     subtracted in memory and saved).
 *   - A video can only be purchased once per user: the purchase is claimed with
 *     an atomic "push if not present".
 *   - The buyer's debit, the creator's credit, the purchase record and the
 *     ledger entries succeed or fail TOGETHER (MongoDB transaction). On a
 *     database without transaction support (a standalone local mongod) the same
 *     steps run in a safe order with manual compensation — use a replica set /
 *     Atlas in production.
 *   - Every balance change writes an immutable WalletTransaction row. The
 *     ledger `reference` is unique, so one M-Pesa receipt can never credit a
 *     wallet twice, even if the callback is delivered repeatedly.
 *   - The creator now actually receives their share (80% by default). Before,
 *     the buyer was charged and nobody was paid.
 *
 * CONFIGURATION
 *   PLATFORM_FEE_PERCENT  default 20
 *   WALLET_CURRENCY       e.g. KES. If unset, prices are used as plain numbers
 *                         (legacy behaviour). If set, videos priced in another
 *                         currency need a rate in FX_RATES, e.g. {"USD":129}.
 */

'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const Payment = require('../models/Payment');
const WalletTransaction = require('../models/WalletTransaction');

class WalletError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'WalletError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// ─────────────────────────────────────────────
// MONEY HELPERS
// ─────────────────────────────────────────────

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const platformFeePercent = () => {
  const n = Number(process.env.PLATFORM_FEE_PERCENT);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 90) : 20;
};

const walletCurrency = () => (process.env.WALLET_CURRENCY ? process.env.WALLET_CURRENCY.toUpperCase() : null);

const fxRates = () => {
  try {
    const parsed = JSON.parse(process.env.FX_RATES || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** Price of a video expressed in the wallet's currency, or null if it cannot be converted. */
const priceInWalletCurrency = (video) => {
  const videoCurrency = String(video.currency || 'USD').toUpperCase();
  const wallet = walletCurrency();

  if (!wallet) return { price: round2(video.price), currency: videoCurrency }; // legacy mode
  if (videoCurrency === wallet) return { price: round2(video.price), currency: wallet };

  const rate = Number(fxRates()[videoCurrency]);
  if (rate > 0) return { price: round2(video.price * rate), currency: wallet };
  return null;
};

const ledgerCurrency = () => walletCurrency() || 'KES';

// ─────────────────────────────────────────────
// TRANSACTION RUNNER
// ─────────────────────────────────────────────

const isTransactionUnsupported = (err) =>
  !!err &&
  (err.code === 20 ||
    /Transaction numbers are only allowed|replica set member|transactions? (are|is) not supported/i.test(err.message || ''));

/**
 * Runs `work(session)` inside a MongoDB transaction. On a deployment without
 * transaction support it runs `work(null)` instead (the work function then
 * compensates manually on failure).
 */
const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isTransactionUnsupported(err)) return work(null);
    throw err;
  } finally {
    session.endSession();
  }
};

const optsFor = (session) => (session ? { session } : {});

// ─────────────────────────────────────────────
// PURCHASE A VIDEO
// ─────────────────────────────────────────────

/**
 * @returns {Promise<{ newBalance:number, price:number, creatorCut:number, platformFee:number, currency:string }>}
 * @throws {WalletError}
 */
const purchaseVideo = async ({ buyerId, videoId }) => {
  const video = await Video.findById(videoId)
    .select('creator isPaid price currency status isDeleted title')
    .lean();

  if (!video || video.isDeleted || video.status !== 'released') {
    throw new WalletError(400, 'INVALID_PURCHASE', 'Invalid purchase');
  }
  if (!video.isPaid) throw new WalletError(400, 'FREE_VIDEO', 'Video is free');
  if (String(video.creator) === String(buyerId)) {
    throw new WalletError(400, 'OWN_VIDEO', 'You cannot purchase your own video');
  }

  const priced = priceInWalletCurrency(video);
  if (!priced) throw new WalletError(400, 'CURRENCY_UNSUPPORTED', 'This video cannot be purchased with a wallet balance');
  const { price, currency } = priced;
  if (!(price > 0)) throw new WalletError(400, 'INVALID_PRICE', 'This video has no valid price');

  const creatorExists = await User.exists({ _id: video.creator });
  if (!creatorExists) throw new WalletError(409, 'CREATOR_UNAVAILABLE', 'The creator of this video is unavailable');

  const platformFee = round2((price * platformFeePercent()) / 100);
  const creatorCut = round2(price - platformFee);
  const nonce = new mongoose.Types.ObjectId().toString();
  const title = String(video.title || 'video').slice(0, 120);

  const work = async (session) => {
    const opts = optsFor(session);
    const done = []; // for manual compensation when there is no transaction

    const undo = async () => {
      if (session) return; // the transaction rolls everything back by itself
      if (done.includes('credit')) {
        await User.updateOne({ _id: video.creator }, { $inc: { balance: -creatorCut, lifetimeEarnings: -creatorCut } });
      }
      if (done.includes('debit')) await User.updateOne({ _id: buyerId }, { $inc: { balance: price } });
      if (done.includes('claim')) await Video.updateOne({ _id: videoId }, { $pull: { purchases: { user: buyerId } } });
    };

    try {
      // 1) Claim the purchase — atomic "add if this user is not already in the list".
      const claim = await Video.updateOne(
        { _id: videoId, 'purchases.user': { $ne: buyerId } },
        { $push: { purchases: { user: buyerId, purchasedAt: new Date() } } },
        opts
      );
      if (claim.modifiedCount !== 1) throw new WalletError(400, 'ALREADY_PURCHASED', 'Already purchased');
      done.push('claim');

      // 2) Debit the buyer — only succeeds if the balance covers the price.
      const buyer = await User.findOneAndUpdate(
        { _id: buyerId, balance: { $gte: price } },
        { $inc: { balance: -price } },
        { new: true, projection: { balance: 1 }, ...opts }
      );
      if (!buyer) {
        const current = await User.findById(buyerId).select('balance').lean();
        throw new WalletError(402, 'INSUFFICIENT_BALANCE', 'Insufficient balance', {
          required: price,
          balance: current?.balance ?? 0,
        });
      }
      done.push('debit');

      // 3) Pay the creator their share.
      const creator = await User.findOneAndUpdate(
        { _id: video.creator },
        { $inc: { balance: creatorCut, lifetimeEarnings: creatorCut } },
        { new: true, projection: { balance: 1 }, ...opts }
      );
      if (!creator) throw new WalletError(409, 'CREATOR_UNAVAILABLE', 'The creator of this video is unavailable');
      done.push('credit');

      // 4) Ledger.
      const entries = [
        {
          user: buyerId,
          type: 'purchase',
          amount: -price,
          balanceAfter: buyer.balance,
          currency,
          reference: `purchase:${nonce}`,
          description: `Purchased "${title}"`,
          video: videoId,
          counterparty: video.creator,
        },
        {
          user: video.creator,
          type: 'earning',
          amount: creatorCut,
          balanceAfter: creator.balance,
          currency,
          reference: `earning:${nonce}`,
          description: `Sale of "${title}"`,
          video: videoId,
          counterparty: buyerId,
        },
      ];
      if (platformFee > 0) {
        entries.push({
          user: null,
          type: 'platform_fee',
          amount: platformFee,
          currency,
          reference: `fee:${nonce}`,
          description: `Platform fee on "${title}"`,
          video: videoId,
          counterparty: buyerId,
        });
      }
      await WalletTransaction.insertMany(entries, { ordered: true, ...opts });

      return { newBalance: buyer.balance, price, creatorCut, platformFee, currency };
    } catch (err) {
      await undo().catch((e) => console.error('[Wallet] COMPENSATION FAILED — manual review needed:', e.message));
      throw err;
    }
  };

  return runInTransaction(work);
};

// ─────────────────────────────────────────────
// TOP-UP COMPLETION / FAILURE (called from the M-Pesa callback or reconciliation)
// ─────────────────────────────────────────────

/**
 * Credits the wallet for a successful M-Pesa payment. Idempotent: calling it
 * again for the same CheckoutRequestID does nothing.
 * @returns {Promise<{ credited: boolean, reason?: string, balance?: number, amount?: number }>}
 */
const completeTopUp = async ({ checkoutRequestId, receipt = null, amountPaid = null, resultDesc = '' }) => {
  const work = async (session) => {
    const opts = optsFor(session);
    let flipped = null;

    try {
      // A late success callback may arrive after we marked the request "expired" — still honour it.
      const $set = {
        status: 'completed',
        completedAt: new Date(),
        resultCode: 0,
        resultDesc: String(resultDesc || '').slice(0, 300),
      };
      if (receipt) $set.mpesaReceipt = receipt;

      flipped = await Payment.findOneAndUpdate(
        { checkoutRequestId, status: { $in: ['pending', 'expired'] } },
        { $set },
        { new: true, ...opts }
      );
      if (!flipped) return { credited: false, reason: 'not_pending' };

      // Credit what was actually paid when Safaricom told us; otherwise what we asked for.
      const credit = round2(Number.isFinite(amountPaid) && amountPaid > 0 ? amountPaid : flipped.amount);

      const user = await User.findOneAndUpdate(
        { _id: flipped.user },
        { $inc: { balance: credit } },
        { new: true, projection: { balance: 1 }, ...opts }
      );
      if (!user) throw new WalletError(409, 'USER_UNAVAILABLE', 'Account unavailable');

      await WalletTransaction.create(
        [
          {
            user: flipped.user,
            type: 'topup',
            amount: credit,
            balanceAfter: user.balance,
            currency: flipped.currency || ledgerCurrency(),
            reference: `topup:${checkoutRequestId}`,
            description: receipt ? `M-Pesa top-up (${receipt})` : 'M-Pesa top-up',
            payment: flipped._id,
            meta: credit !== flipped.amount ? { requested: flipped.amount, paid: credit } : undefined,
          },
        ],
        opts
      );

      return { credited: true, balance: user.balance, amount: credit };
    } catch (err) {
      if (!session && flipped) {
        // No transaction available: put the payment back so a retry can credit it.
        await Payment.updateOne({ _id: flipped._id }, { $set: { status: 'pending' } }).catch(() => {});
      }
      if (err && err.code === 11000) return { credited: false, reason: 'already_credited' };
      throw err;
    }
  };

  return runInTransaction(work);
};

/** Marks a pending top-up as failed / cancelled. Never touches a completed one. */
const failTopUp = async ({ checkoutRequestId, resultCode, resultDesc }) => {
  const cancelled = Number(resultCode) === 1032; // customer pressed cancel
  const res = await Payment.updateOne(
    { checkoutRequestId, status: 'pending' },
    {
      $set: {
        status: cancelled ? 'cancelled' : 'failed',
        resultCode: Number.isFinite(Number(resultCode)) ? Number(resultCode) : null,
        resultDesc: String(resultDesc || '').slice(0, 300),
        failureReason: cancelled ? 'cancelled_by_user' : 'mpesa_failed',
      },
    }
  );
  return { updated: res.modifiedCount === 1, cancelled };
};

// ─────────────────────────────────────────────
// READ HELPERS
// ─────────────────────────────────────────────

const getBalance = async (userId) => {
  const u = await User.findById(userId).select('balance lifetimeEarnings').lean();
  return { balance: u?.balance ?? 0, lifetimeEarnings: u?.lifetimeEarnings ?? 0, currency: ledgerCurrency() };
};

const publicEntry = (t) => ({
  id: t._id,
  type: t.type,
  amount: t.amount,
  balanceAfter: t.balanceAfter,
  currency: t.currency,
  description: t.description,
  video: t.video || null,
  createdAt: t.createdAt,
});

const listTransactions = async (userId, { page = 1, limit = 20, type } = {}) => {
  const filter = { user: userId };
  if (type && WalletTransaction.TYPES.includes(type)) filter.type = type;

  const [items, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WalletTransaction.countDocuments(filter),
  ]);

  return { items: items.map(publicEntry), total, page, pages: Math.ceil(total / limit) };
};

const getEarnings = async (userId) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [{ balance, lifetimeEarnings, currency }, agg, recent] = await Promise.all([
    getBalance(userId),
    WalletTransaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)), type: 'earning', createdAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$amount' }, sales: { $sum: 1 } } },
    ]),
    WalletTransaction.find({ user: userId, type: 'earning' }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  return {
    balance,
    currency,
    lifetimeEarnings,
    last30Days: { total: round2(agg[0]?.total || 0), sales: agg[0]?.sales || 0 },
    recentSales: recent.map(publicEntry),
  };
};

module.exports = {
  WalletError,
  round2,
  runInTransaction,
  purchaseVideo,
  completeTopUp,
  failTopUp,
  getBalance,
  listTransactions,
  getEarnings,
  ledgerCurrency,
};

// ═══ END OF FILE: backend/services/walletService.js ═══