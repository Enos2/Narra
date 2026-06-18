/**
 * File: backend/routes/videoRoutes.js
 * Description: Handles video-related endpoints with proper Express router
 * FULLY UPDATED: Added like/dislike, share tracking, and watch history routes
 * UPDATED: Added /recommended route before /:id to fix CastError
 * FIXED: Removed userPermanentDeleteVideo - users cannot permanently delete
 */

const express = require('express');
const router = express.Router();
const Video = require('../models/Video'); // Video model
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import video controller
const videoController = require('../controllers/videoController');

/* --------------------------
   MULTER CONFIGURATION
-------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/videos';
    
    if (file.fieldname === 'thumbnail') {
      folder = 'uploads/thumbnails';
    } else if (file.fieldname.includes('trailer')) {
      folder = 'uploads/trailers';
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
    fileSize: 200 * 1024 * 1024, // 200MB limit per file
  }
});

// Function to generate dynamic fields for series
const getSeriesFields = () => {
  const fields = [
    { name: 'video', maxCount: 1 },
    { name: 'trailer', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ];
  
  // Add dynamic fields for series (up to 10 seasons, 20 episodes each)
  for (let s = 0; s < 10; s++) {
    fields.push({ name: `season-${s}-trailer`, maxCount: 1 });
    for (let e = 0; e < 20; e++) {
      fields.push({ name: `season-${s}-episode-${e}-video`, maxCount: 1 });
      fields.push({ name: `season-${s}-episode-${e}-trailer`, maxCount: 1 });
    }
  }
  
  return fields;
};

/* ================================
   PUBLIC ROUTES (Limited access)
================================ */

// GET ALL VIDEOS (Public - Only RELEASED videos that are free/public)
router.get('/', videoController.getVideoFeed);

// GET RECOMMENDED VIDEOS - MUST be BEFORE the /:id route to avoid CastError
router.get('/recommended', videoController.getRecommendedVideos);

// GET VIDEO BY ID (Public - But with access checks)
router.get('/:id', videoController.getVideoById);

// GET SERIES EPISODE (Public - But with access checks)
router.get('/:videoId/seasons/:seasonNumber/episodes/:episodeNumber', videoController.getSeriesEpisode);

/* ================================
   PROTECTED ROUTES (Require Authentication)
================================ */

// CHECK VIDEO ACCESS (requires login for paid/private videos)
router.get('/:id/access', videoController.checkVideoAccess); // This now handles both auth and non-auth cases

// WATCH VIDEO (requires login for paid/private videos)
router.get('/:id/watch', videoController.watchVideo); // This now handles both auth and non-auth cases

// PURCHASE VIDEO (requires login)
router.post('/:id/purchase', protect, videoController.purchaseVideo);

// RATE VIDEO (requires login)
router.post('/:id/rate', protect, videoController.rateVideo);

// EDIT VIDEO (Creator only)
router.put('/:id/edit', protect, videoController.editVideo);

/* ================================
   🆕 NEW: LIKE / DISLIKE ROUTES
================================ */

// LIKE VIDEO (toggle like/unlike)
router.post('/:id/like', protect, videoController.likeVideo);

// DISLIKE VIDEO (toggle dislike/undislike)
router.post('/:id/dislike', protect, videoController.dislikeVideo);

// GET USER'S LIKE/DISLIKE STATUS
router.get('/:id/interaction-status', protect, videoController.getVideoInteractionStatus);

/* ================================
   🆕 NEW: SHARE TRACKING ROUTE
================================ */

// TRACK VIDEO SHARE
router.post('/:id/share', protect, videoController.trackShare);

/* ================================
   🆕 NEW: WATCH HISTORY WITH RESUME
================================ */

// RECORD WATCH PROGRESS (call periodically while watching)
router.post('/:id/progress', protect, videoController.recordWatchProgress);

// GET RESUME POSITION (call when loading video)
router.get('/:id/resume', protect, videoController.getResumePosition);

/* ================================
   USER DASHBOARD ROUTES (Require Authentication)
================================ */

// GET VIDEOS BY STATUS (for user dashboard)
router.get('/status/:status', protect, videoController.getVideosByStatus);

// GET APPROVED VIDEOS FOR RELEASE (user dashboard)
router.get('/creator/approved', protect, videoController.getApprovedForRelease);

// RELEASE VIDEO (set price and publish)
router.post('/:id/release', protect, videoController.releaseVideo);

// RELEASE SERIES EPISODE
router.post('/:id/release-episode', protect, videoController.releaseSeriesEpisode);

/* ================================
   USER DELETE ROUTES - FOR REGULAR USERS (Require Authentication)
   USERS CAN ONLY SOFT DELETE AND RESTORE - NO PERMANENT DELETE
================================ */

// SOFT DELETE VIDEO (User can move their own videos to trash)
router.delete('/:id/delete', protect, videoController.userSoftDeleteVideo);

// RESTORE VIDEO (User can restore their own deleted videos from trash)
router.put('/:id/restore', protect, videoController.userRestoreVideo);

// PERMANENT DELETE - REMOVED (Users cannot permanently delete videos)
// Videos auto-delete after 30 days in trash or when restore limit exceeded
// Admins can permanently delete from admin panel
router.delete('/:id/permanent', protect, (req, res) => {
  res.status(403).json({ 
    success: false, 
    message: 'Users cannot permanently delete videos. Use soft delete (move to trash) instead. Videos in trash are automatically deleted after 30 days.' 
  });
});

/* ================================
   UPLOAD ROUTES (Require Authentication)
================================ */

// UPLOAD VIDEO (Movies & Series) - using controller function
router.post(
  '/upload',
  protect,
  upload.fields(getSeriesFields()),
  videoController.uploadVideo
);

/* ================================
   ADMIN ROUTES - COMPLETE SET (Require Authentication + Admin)
================================ */

// Helper middleware for admin check
const requireAdmin = (req, res, next) => {
  if (req.user && ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

// ADMIN: GET ALL PENDING VIDEOS FOR APPROVAL
router.get('/admin/pending', protect, requireAdmin, videoController.getPendingVideosForAdmin);

// ADMIN: GET VIDEOS FOR MODERATION WITH FILTERS
router.get('/admin/moderation', protect, requireAdmin, videoController.getVideosForAdminModeration);

// ADMIN: GET VIDEO MODERATION STATS
router.get('/admin/stats', protect, requireAdmin, videoController.getVideoModerationStats);

// ✅ ADMIN APPROVE VIDEO
router.put('/admin/:id/approve', protect, requireAdmin, videoController.adminApproveVideo);

// ✅ ADMIN REJECT VIDEO
router.put('/admin/:id/reject', protect, requireAdmin, videoController.adminRejectVideo);

// ✅ ADMIN REMOVE VIDEO (soft delete - admin version)
router.delete('/admin/:id/remove', protect, requireAdmin, videoController.adminRemoveVideo);

// ✅ ADMIN RESTORE VIDEO (undo soft delete - admin version)
router.put('/admin/:id/restore', protect, requireAdmin, videoController.adminRestoreVideo);

// ✅ ADMIN PERMANENT DELETE VIDEO (admin version)
router.delete('/admin/:id/permanent', protect, requireAdmin, videoController.adminPermanentDeleteVideo);

// ✅ ADMIN RESTRICT VIDEO
router.put('/admin/:id/restrict', protect, requireAdmin, videoController.adminRestrictVideo);

// ✅ ADMIN REMOVE RESTRICTION
router.put('/admin/:id/remove-restriction', protect, requireAdmin, videoController.adminRemoveRestriction);

// ✅ ADMIN FLAG VIDEO
router.put('/admin/:id/flag', protect, requireAdmin, videoController.adminFlagVideo);

// ✅ ADMIN REMOVE FLAG
router.put('/admin/:id/remove-flag', protect, requireAdmin, videoController.adminRemoveFlag);

// ✅ ADMIN SHADOW BAN VIDEO
router.put('/admin/:id/shadow-ban', protect, requireAdmin, videoController.adminShadowBanVideo);

// ✅ ADMIN REMOVE SHADOW BAN
router.put('/admin/:id/remove-shadow-ban', protect, requireAdmin, videoController.adminRemoveShadowBan);

// ADMIN: UPDATE VIDEO FLAGS (age rating, content flags)
router.put('/:id/admin/flags', protect, requireAdmin, videoController.adminUpdateVideoFlags);

// ADMIN: UPDATE VIDEO STATUS (approve/reject) - Legacy support
router.put('/:id/admin/status', protect, requireAdmin, videoController.updateVideoStatus);

// ADMIN: SHADOW BAN VIDEO (legacy)
router.post('/:id/admin/shadowban', protect, requireAdmin, videoController.shadowBanVideo);

// ADMIN: DELETE VIDEO (soft delete - legacy)
router.delete('/:id/admin/delete', protect, requireAdmin, videoController.deleteVideo);

/* ================================
   BASIC VIDEO ROUTES
================================ */

// Simple health check for video routes
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Video routes are working',
    timestamp: new Date()
  });
});

module.exports = router;

/**
 * END OF FILE: backend/routes/videoRoutes.js
 */