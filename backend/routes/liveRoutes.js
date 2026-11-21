/**
 * File: backend/routes/liveRoutes.js
 * Purpose: All HTTP routes for live streaming — public/guest, host, and admin.
 *
 * CHANGES IN THIS VERSION
 *   - Public routes use `optionalAuth` so a logged-in host/viewer is recognised
 *     and joins no longer crash (they used to read req.user without any auth).
 *   - `:id`, `:userId`, `:strikeId` params are validated as ObjectIds.
 *   - NEW: POST /:id/rotate-key (host replaces a leaked stream key).
 *
 * Mounted at /api/lives (see server.js).
 */

const express = require('express');
const router = express.Router();

const {
  checkLiveQualification,
  createLive,
  getLiveFeed,
  getStreamStatus,
  joinLive,
  checkLiveAccess,
  startStream,
  stopStream,
  rotateStreamKey,
  getMyLives,
  purchaseLive,
  updateLiveStatus,
  shadowBanLive,
  deleteLive,
  setLivePrivilege,
  addLiveStrike,
  removeStrike,
  getUserLiveDetails,
  getAdminLiveStreams,
  getAdminLiveStreamDetails,
  endLiveStreamAdmin,
  sendStreamWarning,
  getLiveStreamReports,
  applyShadowBanToLive,
  removeShadowBanFromLive,
  banUserFromStreaming,
} = require('../controllers/liveController');

const { protect, requireRole } = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const { guestAuth, guestRateLimiter } = require('../middleware/guestMiddleware');

const ADMIN = ['superadmin', 'platformadmin', 'supportadmin'];

// ─────────────────────────────────────────────
// PARAM VALIDATION (reject malformed ids with 400 instead of a 500 CastError)
// ─────────────────────────────────────────────
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const validateObjectId = (_req, res, next, value) =>
  OBJECT_ID_RE.test(value) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' });

router.param('id', validateObjectId);
router.param('userId', validateObjectId);
router.param('strikeId', validateObjectId);

// ─────────────────────────────────────────────
// PUBLIC — guests and logged-in users
// ─────────────────────────────────────────────

// Live feed
router.get('/', optionalAuth, guestAuth, guestRateLimiter(60, 60000), getLiveFeed);

// ─────────────────────────────────────────────
// AUTHENTICATED USER ROUTES
// ─────────────────────────────────────────────

router.get('/check-qualification', protect, checkLiveQualification);
router.get('/my', protect, getMyLives);
router.post('/', protect, createLive);

// ─────────────────────────────────────────────
// ADMIN MANAGEMENT ROUTES (before :id param routes)
// ─────────────────────────────────────────────

router.get('/admin/all', protect, requireRole(...ADMIN), getAdminLiveStreams);
router.post('/privileges', protect, requireRole(...ADMIN), setLivePrivilege);
router.post('/strikes', protect, requireRole(...ADMIN), addLiveStrike);
router.delete('/strikes/:id/:strikeId', protect, requireRole(...ADMIN), removeStrike);
router.get('/user/:userId', protect, requireRole(...ADMIN), getUserLiveDetails);
router.post('/ban-streaming/:id', protect, requireRole(...ADMIN), banUserFromStreaming);

// ─────────────────────────────────────────────
// SPECIFIC STREAM ROUTES  (/lives/:id/...)
// ─────────────────────────────────────────────

// Stream details / status (guests allowed, rate limited)
router.get('/:id', optionalAuth, guestAuth, guestRateLimiter(30, 60000), getStreamStatus);
router.get('/:id/status', optionalAuth, guestAuth, guestRateLimiter(30, 60000), getStreamStatus);

// Join / watch (guests allowed, rate limited)
router.post('/:id/join', optionalAuth, guestAuth, guestRateLimiter(20, 60000), joinLive);

// Access check — age rating / region (guests allowed, rate limited)
router.get('/:id/access', optionalAuth, guestAuth, guestRateLimiter(30, 60000), checkLiveAccess);

// Purchase (no-op — all streams are free)
router.post('/:id/purchase', protect, purchaseLive);

// Host controls
router.post('/:id/start', protect, startStream);
router.post('/:id/stop', protect, stopStream);
router.post('/:id/rotate-key', protect, rotateStreamKey);

// ─────────────────────────────────────────────
// ADMIN STREAM MODERATION
// ─────────────────────────────────────────────

router.patch('/:id/status', protect, requireRole(...ADMIN), updateLiveStatus);
router.patch('/:id/shadow-ban', protect, requireRole(...ADMIN), shadowBanLive);
router.post('/:id/apply-shadow-ban', protect, requireRole(...ADMIN), applyShadowBanToLive);
router.post('/:id/remove-shadow-ban', protect, requireRole(...ADMIN), removeShadowBanFromLive);
router.post('/:id/admin-end', protect, requireRole(...ADMIN), endLiveStreamAdmin);
router.post('/:id/warn', protect, requireRole(...ADMIN), sendStreamWarning);
router.get('/:id/reports', protect, requireRole(...ADMIN), getLiveStreamReports);
router.get('/:id/admin-details', protect, requireRole(...ADMIN), getAdminLiveStreamDetails);
router.delete('/:id', protect, requireRole(...ADMIN), deleteLive);

module.exports = router;

// ═══ END OF FILE: backend/routes/liveRoutes.js ═══