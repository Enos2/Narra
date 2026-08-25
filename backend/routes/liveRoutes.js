/**
 * File: backend/routes/liveRoutes.js
 * REBUILT FROM SCRATCH
 * All routes for live streaming — user, host, and admin
 * ADDED: Guest middleware support for guest mode
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
const { guestAuth, guestRateLimiter } = require('../middleware/guestMiddleware');

const ADMIN = ['superadmin', 'platformadmin', 'supportadmin'];

// ─────────────────────────────────────────────
// PUBLIC - WITH GUEST SUPPORT
// ─────────────────────────────────────────────

// Live feed (public — guests can view)
router.get('/', guestAuth, guestRateLimiter(60, 60000), getLiveFeed);

// ─────────────────────────────────────────────
// AUTHENTICATED USER ROUTES
// ─────────────────────────────────────────────

// Check if current user qualifies for live streaming
router.get('/check-qualification', protect, checkLiveQualification);

// Get all of the current user's live streams
router.get('/my', protect, getMyLives);

// Create a new live stream
router.post('/', protect, createLive);

// ─────────────────────────────────────────────
// ADMIN MANAGEMENT ROUTES (before :id param routes)
// ─────────────────────────────────────────────

// Admin: get all live streams
router.get('/admin/all', protect, requireRole(...ADMIN), getAdminLiveStreams);

// Admin: grant / revoke live privilege
router.post('/privileges', protect, requireRole(...ADMIN), setLivePrivilege);

// Admin: add live strike
router.post('/strikes', protect, requireRole(...ADMIN), addLiveStrike);

// Admin: remove live strike
router.delete('/strikes/:id/:strikeId', protect, requireRole(...ADMIN), removeStrike);

// Admin: get user live details
router.get('/user/:userId', protect, requireRole(...ADMIN), getUserLiveDetails);

// Admin: ban user from streaming
router.post('/ban-streaming/:id', protect, requireRole(...ADMIN), banUserFromStreaming);

// ─────────────────────────────────────────────
// SPECIFIC STREAM ROUTES  (/lives/:id/...)
// ─────────────────────────────────────────────

// Get stream status / details - guests can view with rate limiting
router.get('/:id', guestAuth, guestRateLimiter(30, 60000), getStreamStatus);

// Join / start watching a stream - guests can join with rate limiting
router.post('/:id/join', guestAuth, guestRateLimiter(20, 60000), joinLive);

// Check access (paywall / age) - guests can check with rate limiting
router.get('/:id/access', guestAuth, guestRateLimiter(30, 60000), checkLiveAccess);

// Purchase stream (no-op — all free)
router.post('/:id/purchase', protect, purchaseLive);

// Host: start broadcasting
router.post('/:id/start', protect, startStream);

// Host: stop broadcasting
router.post('/:id/stop', protect, stopStream);

// Status alias - guests can view with rate limiting
router.get('/:id/status', guestAuth, guestRateLimiter(30, 60000), getStreamStatus);

// ─────────────────────────────────────────────
// ADMIN STREAM MODERATION
// ─────────────────────────────────────────────

// Update status (approve / reject / cancel)
router.patch('/:id/status', protect, requireRole(...ADMIN), updateLiveStatus);

// Toggle shadow ban
router.patch('/:id/shadow-ban', protect, requireRole(...ADMIN), shadowBanLive);

// Apply shadow ban
router.post('/:id/apply-shadow-ban', protect, requireRole(...ADMIN), applyShadowBanToLive);

// Remove shadow ban
router.post('/:id/remove-shadow-ban', protect, requireRole(...ADMIN), removeShadowBanFromLive);

// Admin end stream
router.post('/:id/admin-end', protect, requireRole(...ADMIN), endLiveStreamAdmin);

// Send warning / strike to host
router.post('/:id/warn', protect, requireRole(...ADMIN), sendStreamWarning);

// Get stream reports
router.get('/:id/reports', protect, requireRole(...ADMIN), getLiveStreamReports);

// Get stream details (admin view)
router.get('/:id/admin-details', protect, requireRole(...ADMIN), getAdminLiveStreamDetails);

// Delete stream
router.delete('/:id', protect, requireRole(...ADMIN), deleteLive);

module.exports = router;