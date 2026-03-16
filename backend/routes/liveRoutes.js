/**
 * File: backend/routes/liveRoutes.js
 * Description: Handles live stream endpoints — create, join, purchase, access, admin moderation, shadow ban
 * UPDATED: Added streaming management endpoints
 */

const express = require('express');
const router = express.Router();

const {
  createLive,
  getLiveFeed,
  checkLiveAccess,
  joinLive,
  purchaseLive,
  updateLiveStatus,
  deleteLive,
  shadowBanLive,
  setLivePrivilege,
  addLiveStrike,
  getUserLiveDetails,
  startStream,
  stopStream,
  getStreamStatus,
  checkLiveQualification
} = require('../controllers/liveController');

const { protect, requireRole } = require('../middleware/authMiddleware');

/**
 * ================================
 * PUBLIC ROUTES
 * ================================
 */

// Get all live streams feed (public)
router.get('/', getLiveFeed);

// Check live qualification (protected)
router.get('/check-qualification', protect, checkLiveQualification);

/**
 * ================================
 * CREATOR ROUTES (PROTECTED)
 * ================================
 */

// Create a live stream
router.post('/', protect, createLive);

// Get specific live stream by ID
router.get('/:id', protect, getStreamStatus);

// Join/watch a live stream
router.post('/:id/join', protect, joinLive);

// Purchase access to a live stream
router.post('/:id/purchase', protect, purchaseLive);

// Check live access (age/paywall/admin)
router.get('/:id/access', protect, checkLiveAccess);

// Start streaming (when OBS connects)
router.post('/:id/start', protect, startStream);

// Stop streaming (when OBS disconnects)
router.post('/:id/stop', protect, stopStream);

// Get stream status
router.get('/:id/status', protect, getStreamStatus);

/**
 * ================================
 * ADMIN MODERATION ROUTES
 * ================================
 */

// Update live status (approve/reject/cancel)
router.patch(
  '/:id/status',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  updateLiveStatus
);

// Shadow ban a live stream
router.patch(
  '/:id/shadow-ban',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  shadowBanLive
);

// Delete a live stream
router.delete(
  '/:id',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  deleteLive
);

// Grant/revoke live privileges
router.post(
  '/privileges',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  setLivePrivilege
);

// Add live strike to user
router.post(
  '/strikes',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  addLiveStrike
);

// Get user live details
router.get(
  '/user/:userId',
  protect,
  requireRole('platformadmin', 'superadmin', 'supportadmin'),
  getUserLiveDetails
);

module.exports = router;