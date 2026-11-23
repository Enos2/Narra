/**
 * File: backend/controllers/paymentController.js
 * Purpose: HTTP layer for the wallet — balance, transaction history, creator
 *   earnings, M-Pesa top-ups (STK push + callback + status), and buying a video
 *   with wallet balance. All money movement is delegated to
 *   services/walletService.js.
 *
 * WHAT WAS WRONG BEFORE
 *   - paymentRoutes.js imported purchaseVideo / purchaseLive / addBalance, which
 *     did not exist (and the router was never mounted), so none of it ran.
 *   - The code path that actually charged users (videoController.purchaseVideo)
 *     read the balance, subtracted in memory and saved: two simultaneous
 *     requests could spend the same money twice, and the creator was NEVER paid.
 *   - There was no way to put money into a wallet.
 *
 * ENDPOINTS (mounted at /api/payments; purchase also at /api/videos/:id/purchase)
 *   GET  /wallet                  balance + recent transactions + top-up limits
 *   GET  /transactions            paginated ledger
 *   GET  /earnings                creator earnings summary
 *   POST /topup                   { amount, phone }  → STK push to the phone
 *   GET  /topup/:paymentId        poll the status of a top-up
 *   POST /mpesa/callback/:secret  Safaricom → us (authenticated by the URL secret)
 *   POST /video/:id               buy a video with wallet balance
 */

const Payment = require('../models/Payment');
const mpesa = require('../utils/mpesa');
const wallet = require('../services/walletService');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);

const topUpLimits = () => {
  const min = Math.max(1, parseInt(process.env.TOPUP_MIN, 10) || 10);
  const max = Math.max(min, parseInt(process.env.TOPUP_MAX, 10) || 150000);
  return { min, max };
};

const sendWalletError = (res, err, fallbackMessage) => {
  if (err instanceof wallet.WalletError) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code, ...err.extra });
  }
  console.error(`[Payments] ${fallbackMessage}:`, err.message);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

/*
========================================
WALLET OVERVIEW
========================================
*/
exports.getWallet = async (req, res) => {
  try {
    const [{ balance, lifetimeEarnings, currency }, recent] = await Promise.all([
      wallet.getBalance(req.user._id),
      wallet.listTransactions(req.user._id, { page: 1, limit: 10 }),
    ]);

    res.json({
      success: true,
      balance,
      lifetimeEarnings,
      currency,
      transactions: recent.items,
      topUp: { enabled: mpesa.isConfigured(), method: 'mpesa', ...topUpLimits() },
    });
  } catch (err) {
    sendWalletError(res, err, 'Failed to load wallet');
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const result = await wallet.listTransactions(req.user._id, { page, limit, type });
    res.json({ success: true, ...result });
  } catch (err) {
    sendWalletError(res, err, 'Failed to load transactions');
  }
};

exports.getEarnings = async (req, res) => {
  try {
    res.json({ success: true, ...(await wallet.getEarnings(req.user._id)) });
  } catch (err) {
    sendWalletError(res, err, 'Failed to load earnings');
  }
};

/*
========================================
M-PESA TOP-UP — START
========================================
*/
exports.initiateTopUp = async (req, res) => {
  try {
    if (!mpesa.isConfigured()) {
      return res.status(503).json({ success: false, message: 'Top-ups are not available right now.' });
    }

    const { min, max } = topUpLimits();
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount < min || amount > max) {
      return res.status(400).json({
        success: false,
        message: `Enter a whole amount between ${min} and ${max}.`,
      });
    }

    const phone = mpesa.normalizePhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Enter a valid Safaricom number, e.g. 0712345678.' });
    }

    // One prompt at a time: stops people (or scripts) stacking up pending requests.
    const waiting = await Payment.findOne({
      user: req.user._id,
      type: 'balance',
      status: 'pending',
      createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) },
    })
      .select('_id')
      .lean();
    if (waiting) {
      return res.status(409).json({
        success: false,
        message: 'You already have a top-up waiting for confirmation. Check your phone.',
        paymentId: waiting._id,
      });
    }

    const payment = await Payment.create({
      user: req.user._id,
      type: 'balance',
      amount,
      currency: wallet.ledgerCurrency(),
      phone,
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    try {
      const push = await mpesa.stkPush({
        phone,
        amount,
        reference: `NARRA${String(payment._id).slice(-6)}`,
        description: 'Narra wallet',
      });

      await Payment.updateOne(
        { _id: payment._id },
        { $set: { checkoutRequestId: push.checkoutRequestId, merchantRequestId: push.merchantRequestId } }
      );

      return res.status(202).json({
        success: true,
        message: push.customerMessage || 'Check your phone and enter your M-Pesa PIN to complete the payment.',
        paymentId: payment._id,
        status: 'pending',
      });
    } catch (err) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: 'failed', failureReason: 'stk_push_failed', resultDesc: String(err.message).slice(0, 300) } }
      );
      console.error('[Payments] STK push failed:', err.message);
      return res.status(502).json({
        success: false,
        message: 'Could not start the M-Pesa payment. Please try again in a moment.',
      });
    }
  } catch (err) {
    sendWalletError(res, err, 'Failed to start top-up');
  }
};

/*
========================================
M-PESA TOP-UP — STATUS (the app polls this)
========================================
*/
exports.getTopUpStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!isObjectId(paymentId)) return res.status(400).json({ success: false, message: 'Invalid payment id.' });

    let payment = await Payment.findOne({ _id: paymentId, user: req.user._id });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    if (payment.status === 'pending') {
      const now = Date.now();
      const age = now - new Date(payment.createdAt).getTime();
      const sinceCheck = payment.lastCheckedAt ? now - new Date(payment.lastCheckedAt).getTime() : Infinity;

      // The callback normally arrives within seconds. If it has not, ask Safaricom directly.
      if (payment.checkoutRequestId && age > 30 * 1000 && sinceCheck > 15 * 1000 && mpesa.isConfigured()) {
        await Payment.updateOne({ _id: payment._id }, { $set: { lastCheckedAt: new Date() } });
        try {
          const q = await mpesa.stkQuery(payment.checkoutRequestId);
          if (!q.pending && q.resultCode === 0) {
            await wallet.completeTopUp({ checkoutRequestId: payment.checkoutRequestId, resultDesc: q.resultDesc });
          } else if (!q.pending) {
            await wallet.failTopUp({
              checkoutRequestId: payment.checkoutRequestId,
              resultCode: q.resultCode,
              resultDesc: q.resultDesc,
            });
          }
        } catch (err) {
          console.error('[Payments] STK query failed:', err.message);
        }
        payment = await Payment.findById(payment._id);
      }

      if (payment.status === 'pending' && payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
        await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'expired' } });
        payment = await Payment.findById(payment._id);
      }
    }

    const body = {
      success: true,
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };

    if (payment.status === 'completed') {
      body.balance = (await wallet.getBalance(req.user._id)).balance;
      body.message = 'Top-up successful.';
    } else if (payment.status === 'cancelled') {
      body.message = 'The payment was cancelled on your phone.';
    } else if (payment.status === 'failed' || payment.status === 'expired') {
      body.message = 'The payment did not go through. You have not been charged.';
    } else {
      body.message = 'Waiting for you to confirm on your phone.';
    }

    res.json(body);
  } catch (err) {
    sendWalletError(res, err, 'Failed to check payment status');
  }
};

/*
========================================
M-PESA CALLBACK (Safaricom → us)
Authenticated by the secret in the URL; always answers 200 so Safaricom is satisfied.
========================================
*/
const ACK = { ResultCode: 0, ResultDesc: 'Accepted' };

exports.mpesaCallback = async (req, res) => {
  if (!mpesa.verifyCallbackSecret(req.params.secret)) return res.sendStatus(404);

  // Optional extra layer: restrict to Safaricom's published callback IPs.
  const allowedIps = (process.env.MPESA_CALLBACK_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowedIps.length && !allowedIps.includes(req.ip)) {
    console.warn('[Payments] M-Pesa callback from a non-allowed IP rejected');
    return res.sendStatus(404);
  }

  try {
    const cb = mpesa.parseCallback(req.body);
    if (!cb) return res.json(ACK);

    // Only act on requests WE created, and only if the merchant request id matches.
    const payment = await Payment.findOne({ checkoutRequestId: cb.checkoutRequestId })
      .select('merchantRequestId')
      .lean();
    if (!payment) return res.json(ACK);
    if (payment.merchantRequestId && cb.merchantRequestId && payment.merchantRequestId !== cb.merchantRequestId) {
      console.warn('[Payments] Callback merchantRequestId mismatch — ignored');
      return res.json(ACK);
    }

    if (cb.resultCode === 0) {
      const result = await wallet.completeTopUp({
        checkoutRequestId: cb.checkoutRequestId,
        receipt: cb.receipt,
        amountPaid: cb.amount,
        resultDesc: cb.resultDesc,
      });
      if (result.credited) console.log(`[Payments] Top-up credited (${result.amount})`);
    } else {
      await wallet.failTopUp({
        checkoutRequestId: cb.checkoutRequestId,
        resultCode: cb.resultCode,
        resultDesc: cb.resultDesc,
      });
    }
  } catch (err) {
    // Safaricom will not retry, but the status endpoint reconciles via STK query.
    console.error('[Payments] Callback processing error:', err.message);
  }

  return res.json(ACK);
};

/*
========================================
BUY A VIDEO WITH WALLET BALANCE
(also mounted at POST /api/videos/:id/purchase — same response shape as before)
========================================
*/
exports.purchaseVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    if (!isObjectId(videoId)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase' });
    }

    const result = await wallet.purchaseVideo({ buyerId: req.user._id, videoId });

    res.json({
      success: true,
      message: 'Purchase successful',
      newBalance: result.newBalance,
      price: result.price,
      currency: result.currency,
    });
  } catch (err) {
    sendWalletError(res, err, 'Payment failed');
  }
};

exports.purchaseLive = (_req, res) =>
  res.status(400).json({ success: false, message: 'All live streams are free.' });

// ═══ END OF FILE: backend/controllers/paymentController.js ═══