/**
 * File: backend/routes/adRoutes.js
 * Description: All ad routes — public, tracking, and admin.
 * FIXED: Route ordering corrected — specific routes (/admin/*, /analytics/*)
 *        MUST be declared before wildcard routes (/:id) so Express does not
 *        swallow "admin" or "analytics" as an ObjectId param, which caused the 500.
 */

const express      = require('express');
const router       = express.Router();
const adController = require('../controllers/adController');
const { protect }  = require('../middleware/authMiddleware');

/* ─────────────────────────────────────────────
   ROLE-GUARD HELPERS
───────────────────────────────────────────── */
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'superadmin') return next();
  res.status(403).json({ success: false, message: 'Super admin access required' });
};

const requireSuperOrPlatformAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin'].includes(req.user?.role)) return next();
  res.status(403).json({ success: false, message: 'Super or platform admin access required' });
};

const requireAnyAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin', 'supportadmin'].includes(req.user?.role)) return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
};

/* ─────────────────────────────────────────────
   MULTER — file upload middleware
   Handles optional file uploads for ad creation.
   Falls back gracefully if multer is not installed.
───────────────────────────────────────────── */
let uploadMiddleware;
try {
  const multer = require('multer');
  const path   = require('path');
  const fs     = require('fs');

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const isVideo = file.mimetype.startsWith('video/');
      const dir     = isVideo ? 'uploads/ads/videos' : 'uploads/ads/images';
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext      = path.extname(file.originalname);
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|ogg|mov/;
    const ext     = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} is not allowed`), false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max
  });

  // Accept video OR image + optional thumbnail
  uploadMiddleware = upload.fields([
    { name: 'video',     maxCount: 1 },
    { name: 'image',     maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]);
} catch (e) {
  // multer not installed — media uploads will rely on URL strings in req.body
  console.warn('[adRoutes] multer not found — file upload disabled. Pass mediaUrl as a string.');
  uploadMiddleware = (req, res, next) => next();
}

/* ══════════════════════════════════════════════
   ⚠️  ROUTE ORDER IS CRITICAL IN EXPRESS ⚠️
   Always register specific paths BEFORE wildcard
   paths like /:id — otherwise Express treats the
   literal string "admin" or "analytics" as an id.
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   1. CREATOR EARNINGS  (specific — must be first)
══════════════════════════════════════════════ */
router.get('/analytics/creator-earnings', protect, adController.getCreatorEarnings);

/* ══════════════════════════════════════════════
   2. ADMIN — ANALYTICS  (specific — before /:id)
══════════════════════════════════════════════ */

// Overall platform analytics
router.get(
  '/admin/analytics/overview',
  protect,
  requireSuperOrPlatformAdmin,
  adController.getOverallAnalytics
);

// Quick stats for admin dashboard
router.get(
  '/admin/stats/summary',
  protect,
  requireAnyAdmin,
  adController.getAdStats
);

/* ══════════════════════════════════════════════
   3. ADMIN — AD MANAGEMENT  (specific — before /:id)
══════════════════════════════════════════════ */

// List all ads
router.get(
  '/admin/all',
  protect,
  requireAnyAdmin,
  adController.getAllAds
);

// Create a new ad campaign (supports file upload OR mediaUrl string)
router.post(
  '/admin/create',
  protect,
  requireAnyAdmin,
  uploadMiddleware,
  adController.createAd
);

// Per-ad analytics  ← note: uses /admin/:id/analytics (still before bare /:id)
router.get(
  '/admin/:id/analytics',
  protect,
  requireAnyAdmin,
  adController.getAdAnalytics
);

// Approve ad → sets status to 'active'
router.put(
  '/admin/:id/approve',
  protect,
  requireSuperOrPlatformAdmin,
  adController.approveAd
);

// Reject ad
router.put(
  '/admin/:id/reject',
  protect,
  requireSuperOrPlatformAdmin,
  adController.rejectAd
);

// Pause active ad
router.put(
  '/admin/:id/pause',
  protect,
  requireAnyAdmin,
  adController.pauseAd
);

// Resume paused ad
router.put(
  '/admin/:id/resume',
  protect,
  requireAnyAdmin,
  adController.resumeAd
);

// Update an existing ad
router.put(
  '/admin/:id',
  protect,
  requireAnyAdmin,
  uploadMiddleware,
  adController.updateAd
);

// Get single ad for editing (full details)
router.get(
  '/admin/:id',
  protect,
  requireAnyAdmin,
  adController.getAdForEdit
);

// Permanently delete ad + impressions/revenue records
router.delete(
  '/admin/:id/permanent',
  protect,
  requireSuperAdmin,
  adController.permanentDeleteAd
);

// Soft delete ad
router.delete(
  '/admin/:id',
  protect,
  requireSuperAdmin,
  adController.deleteAd
);

/* ══════════════════════════════════════════════
   4. PUBLIC ROUTES  (wildcard /:id goes LAST)
══════════════════════════════════════════════ */

// Get active ads for display (optionally auth'd to apply age targeting)
router.get('/active', adController.getActiveAds);

// Tracking routes (auth optional)
router.post('/:id/impression', adController.trackImpression);
router.post('/:id/click',      adController.trackClick);

// Get single ad public info — MUST be absolutely last GET route
router.get('/:id', adController.getAdById);

/* ══════════════════════════════════════════════
   MULTER ERROR HANDLER — must be last middleware
   in this router so multer file-type/size errors
   return a clean JSON response instead of crashing.
══════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.message?.includes('File type')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;