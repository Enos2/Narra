/**
 * File: backend/routes/promotionRoutes.js
 * Internal name: promotion (displayed as "Campaign" to users/admins)
 * Replaces: adRoutes.js
 * Mounted at: /api/promotions  AND  /api/ads (alias for backward compat)
 *
 * IMPORTANT: Admin.js uses role values: super_admin, platform_admin, support_admin
 * This middleware verifies the JWT and looks up the Admin document directly,
 * so role checks use the Admin model's role values.
 */

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/promotionController');
const jwt        = require('jsonwebtoken');
const Admin      = require('../models/Admin');
const User       = require('../models/User');

/* ─────────────────────────────────────────────
   MULTER — file upload middleware
───────────────────────────────────────────── */
let uploadMiddleware;
try {
  const multer = require('multer');
  const path   = require('path');
  const fs     = require('fs');

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const isVideo = file.mimetype.startsWith('video/');
      const dir     = isVideo
        ? 'uploads/campaigns/videos'
        : 'uploads/campaigns/images';
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|ogg|mov/;
    const ext     = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error(`File type .${ext} is not allowed`), false);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 }
  });

  uploadMiddleware = upload.fields([
    { name: 'video',     maxCount: 1 },
    { name: 'image',     maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]);
} catch {
  console.warn('[promotionRoutes] multer not found — file uploads disabled');
  uploadMiddleware = (req, res, next) => next();
}

/* ─────────────────────────────────────────────
   AUTH MIDDLEWARE FOR ADMINS
   Looks up the Admin document (not User).
   Handles both underscore and no-underscore role formats.
───────────────────────────────────────────── */
const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Normalize role for comparison
    const role = (decoded.role || '').toLowerCase().replace(/_/g, '');
    const adminRoles = ['superadmin', 'platformadmin', 'supportadmin'];

    if (!adminRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Try Admin model first, fall back to User model
    let admin = await Admin.findById(decoded.id).select('-password').lean();

    if (!admin) {
      // Some admins may be stored in the User collection
      const user = await User.findById(decoded.id).select('-password').lean();
      if (user && adminRoles.includes((user.role || '').toLowerCase().replace(/_/g, ''))) {
        admin = {
          _id:      user._id,
          id:       user._id,
          fullName: user.firstName ? `${user.firstName} ${user.lastName}` : user.username,
          email:    user.email,
          role:     user.role
        };
      }
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account not found' });
    }

    if (admin.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Admin account inactive' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('[requireAdminAuth]', err.message);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/* ─────────────────────────────────────────────
   OPTIONAL USER AUTH — for serving targeted promotions
───────────────────────────────────────────── */
const optionalUserAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id).select(
      'dateOfBirth gender country continent _id isBanned isDeactivated'
    ).lean();

    req.user = (!user || user.isBanned || user.isDeactivated) ? null : user;
    next();
  } catch {
    req.user = null;
    next();
  }
};

/* ─────────────────────────────────────────────
   ROLE GUARDS
───────────────────────────────────────────── */
const requireSuperOrPlatform = (req, res, next) => {
  const role = (req.admin?.role || '').toLowerCase().replace(/_/g, '');
  if (['superadmin', 'platformadmin'].includes(role)) return next();
  return res.status(403).json({ success: false, message: 'Super or platform admin access required' });
};

const requireSuperAdmin = (req, res, next) => {
  const role = (req.admin?.role || '').toLowerCase().replace(/_/g, '');
  if (role === 'superadmin') return next();
  return res.status(403).json({ success: false, message: 'Super admin access required' });
};

/* ══════════════════════════════════════════════
   ROUTE ORDERING: specific before wildcard /:id
══════════════════════════════════════════════ */

/* ── Admin analytics & stats (no :id) ── */
router.get('/manage/analytics/overview', requireAdminAuth, requireSuperOrPlatform, controller.getOverallAnalytics);
router.get('/manage/stats/summary',      requireAdminAuth, controller.getStats);

/* ── Admin CRUD ── */
router.get('/manage/all',    requireAdminAuth, controller.getAllPromotions);
router.post('/manage/create', requireAdminAuth, requireSuperOrPlatform, uploadMiddleware, controller.createPromotion);

/* ── Admin per-campaign actions (with :id) ── */
router.get('/manage/:id/analytics', requireAdminAuth, controller.getPromotionAnalytics);
router.put('/manage/:id/approve',   requireAdminAuth, requireSuperOrPlatform, controller.approvePromotion);
router.put('/manage/:id/reject',    requireAdminAuth, requireSuperOrPlatform, controller.rejectPromotion);
router.put('/manage/:id/pause',     requireAdminAuth, controller.pausePromotion);
router.put('/manage/:id/resume',    requireAdminAuth, controller.resumePromotion);
router.post('/manage/:id/block-user', requireAdminAuth, controller.blockUserFromCampaign);
router.put('/manage/:id',           requireAdminAuth, requireSuperOrPlatform, uploadMiddleware, controller.updatePromotion);
router.get('/manage/:id',           requireAdminAuth, controller.getPromotionForEdit);
router.delete('/manage/:id/permanent', requireAdminAuth, requireSuperAdmin, controller.permanentDeletePromotion);
router.delete('/manage/:id',        requireAdminAuth, requireSuperAdmin, controller.deletePromotion);

/* ── BACKWARD-COMPAT aliases for /admin/* routes used by existing frontend ── */
router.get('/admin/all',                   requireAdminAuth, controller.getAllPromotions);
router.post('/admin/create',               requireAdminAuth, requireSuperOrPlatform, uploadMiddleware, controller.createPromotion);
router.get('/admin/analytics/overview',    requireAdminAuth, requireSuperOrPlatform, controller.getOverallAnalytics);
router.get('/admin/stats/summary',         requireAdminAuth, controller.getStats);
router.get('/admin/:id/analytics',         requireAdminAuth, controller.getPromotionAnalytics);
router.put('/admin/:id/approve',           requireAdminAuth, requireSuperOrPlatform, controller.approvePromotion);
router.put('/admin/:id/reject',            requireAdminAuth, requireSuperOrPlatform, controller.rejectPromotion);
router.put('/admin/:id/pause',             requireAdminAuth, controller.pausePromotion);
router.put('/admin/:id/resume',            requireAdminAuth, controller.resumePromotion);
router.put('/admin/:id',                   requireAdminAuth, requireSuperOrPlatform, uploadMiddleware, controller.updatePromotion);
router.get('/admin/:id',                   requireAdminAuth, controller.getPromotionForEdit);
router.delete('/admin/:id/permanent',      requireAdminAuth, requireSuperAdmin, controller.permanentDeletePromotion);
router.delete('/admin/:id',                requireAdminAuth, requireSuperAdmin, controller.deletePromotion);

/* ── Public routes ── */
router.get('/active',          optionalUserAuth, controller.getActivePromotions);
router.post('/:id/view',       optionalUserAuth, controller.trackView);
router.post('/:id/engage',     optionalUserAuth, controller.trackEngage);

/* Backward compat tracking aliases */
router.post('/:id/impression', optionalUserAuth, controller.trackView);
router.post('/:id/click',      optionalUserAuth, controller.trackEngage);

/* Single public promotion */
router.get('/:id', controller.getPromotionById);

/* ── Multer error handler ── */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.message?.includes('File type')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;