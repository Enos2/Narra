/**
 * File: backend/routes/adRoutes.js
 * Description: Ad management routes with role-based access control
 * Admin Levels:
 * - Super Admin: Full CRUD, approve/reject, analytics
 * - Platform Admin: Create, manage own ads, view analytics
 * - Support Admin: View-only access
 */

const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const adController = require('../controllers/adController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* ======================================================
   MULTER CONFIGURATION FOR AD MEDIA UPLOAD
====================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/ads';
    
    if (file.fieldname === 'video') {
      folder = 'uploads/ads/videos';
    } else if (file.fieldname === 'thumbnail' || file.fieldname === 'image') {
      folder = 'uploads/ads/images';
    }
    
    // Ensure directory exists
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, uniqueName + '-' + safeName);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for video ads
  }
});

/* ======================================================
   ROLE-BASED ACCESS MIDDLEWARE
====================================================== */
const requireAdmin = (req, res, next) => {
  if (req.user && ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Admin access required' 
  });
};

const requireAdManager = (req, res, next) => {
  if (req.user && ['superadmin', 'platformadmin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Ad management access required (Super Admin or Platform Admin)' 
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Super Admin access required' 
  });
};

/* ======================================================
   PUBLIC ROUTES (Age-filtered, no auth required)
====================================================== */

// GET active ads for current user (based on age/country)
router.get('/active', adController.getActiveAds);

// GET a specific ad by ID (public info only)
router.get('/:id', adController.getAdById);

/* ======================================================
   PROTECTED ROUTES (All require authentication)
====================================================== */

// TRACK ad impression (called when ad is shown)
router.post('/:id/impression', protect, adController.trackImpression);

// TRACK ad click (called when user clicks ad)
router.post('/:id/click', protect, adController.trackClick);

/* ======================================================
   ADMIN ROUTES - AD MANAGEMENT
====================================================== */

// GET all ads for admin (with filters)
router.get('/admin/all', protect, requireAdmin, adController.getAllAds);

// GET ad for editing (full details)
router.get('/admin/:id', protect, requireAdmin, adController.getAdForEdit);

// CREATE new ad (Super Admin or Platform Admin only)
router.post(
  '/admin/create',
  protect,
  requireAdManager,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]),
  adController.createAd
);

// UPDATE ad (Super Admin or Platform Admin only)
router.put(
  '/admin/:id',
  protect,
  requireAdManager,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]),
  adController.updateAd
);

// APPROVE ad (Super Admin or Platform Admin only)
router.put('/admin/:id/approve', protect, requireAdManager, adController.approveAd);

// REJECT ad (Super Admin or Platform Admin only)
router.put('/admin/:id/reject', protect, requireAdManager, adController.rejectAd);

// PAUSE ad campaign
router.put('/admin/:id/pause', protect, requireAdManager, adController.pauseAd);

// RESUME ad campaign
router.put('/admin/:id/resume', protect, requireAdManager, adController.resumeAd);

// DELETE ad (soft delete - Super Admin only)
router.delete('/admin/:id', protect, requireSuperAdmin, adController.deleteAd);

// PERMANENT DELETE ad (Super Admin only)
router.delete('/admin/:id/permanent', protect, requireSuperAdmin, adController.permanentDeleteAd);

/* ======================================================
   ANALYTICS ROUTES
====================================================== */

// GET ad performance analytics
router.get('/admin/:id/analytics', protect, requireAdmin, adController.getAdAnalytics);

// GET overall ad revenue analytics (Super Admin only)
router.get('/admin/analytics/overview', protect, requireSuperAdmin, adController.getOverallAnalytics);

// GET creator earnings from ads (for creators)
router.get('/analytics/creator-earnings', protect, adController.getCreatorEarnings);

// GET ad stats for dashboard
router.get('/admin/stats/summary', protect, requireAdmin, adController.getAdStats);

/* ======================================================
   HEALTH CHECK
====================================================== */
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ad routes are working',
    timestamp: new Date()
  });
});

module.exports = router;