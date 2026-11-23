/**
 * File: backend/routes/paymentRoutes.js
 * Purpose: Wallet and payment routes. Mounted at /api/payments (server.js also
 *   exposes the video purchase handler at POST /api/videos/:id/purchase so the
 *   existing frontend keeps working).
 *
 * The previous router imported functions that did not exist and was never
 * mounted, so no payment route was reachable.
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { topupLimiter, purchaseLimiter } = require('../middleware/rateLimiters');
const {
  getWallet,
  getTransactions,
  getEarnings,
  initiateTopUp,
  getTopUpStatus,
  mpesaCallback,
  purchaseVideo,
  purchaseLive,
} = require('../controllers/paymentController');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
router.param('id', (_req, res, next, value) =>
  OBJECT_ID_RE.test(value) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' })
);
router.param('paymentId', (_req, res, next, value) =>
  OBJECT_ID_RE.test(value) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' })
);

// Public: called by Safaricom. Authenticated by the secret in the URL.
router.post('/mpesa/callback/:secret', mpesaCallback);

// Wallet
router.get('/wallet', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.get('/earnings', protect, getEarnings);

// Top-up
router.post('/topup', protect, topupLimiter, initiateTopUp);
router.get('/topup/:paymentId', protect, getTopUpStatus);

// Purchases
router.post('/video/:id', protect, purchaseLimiter, purchaseVideo);
router.post('/live/:id', protect, purchaseLive);

module.exports = router;

// ═══ END OF FILE: backend/routes/paymentRoutes.js ═══