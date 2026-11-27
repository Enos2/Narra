/**
 * File: backend/routes/videoRoutes.js
 * Purpose: Video routes (mounted at /api/videos): public browsing and watching,
 *   viewer interactions, creator release / trash, and admin moderation.
 *
 * CHANGES IN THIS VERSION
 *   - Public routes now use `optionalAuth`. Before, they only ran the guest
 *     middleware, which never identifies a logged-in user, so everyone was
 *     treated as a guest (paid / purchased viewing could not work and the
 *     access checks had nothing to check).
 *   - Viewing, interaction and edit handlers moved to videoPublicController.js,
 *     which returns whitelisted responses (no creator / liker e-mails, no buyer
 *     lists, no stream URL unless the viewer may watch).
 *   - REMOVED the legacy POST /upload. It saved files to this server's own disk
 *     with only a login check — no age / restriction / quota checks, served
 *     publicly through /uploads. Use POST /api/uploads/video (or the direct
 *     /api/uploads/sign + /video/finalize flow). The route now answers 410.
 *   - `/health` is registered BEFORE `/:id` (it was unreachable).
 *   - Ids in the path are validated (400 instead of a 500 CastError).
 *   - POST /:id/purchase is served by the wallet code registered in server.js
 *     ahead of this router.
 */

const express = require('express');
const router = express.Router();

const videoController = require('../controllers/videoController');
const videoPublic = require('../controllers/videoPublicController');
const { protect } = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const { guestAuth, guestRateLimiter } = require('../middleware/guestMiddleware');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const validateId = (_req, res, next, value) =>
  OBJECT_ID_RE.test(value) ? next() : res.status(400).json({ success: false, message: 'Invalid video ID format' });
router.param('id', validateId);
router.param('videoId', validateId);

/* ================================
   BASIC ROUTES (before /:id)
================================ */

// Simple health check for video routes
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Video routes are working',
    timestamp: new Date(),
  });
});

/* ================================
   PUBLIC ROUTES (guests and logged-in users)
================================ */

// GET ALL VIDEOS (only released, age-appropriate videos; guests see free ones)
router.get('/', optionalAuth, guestAuth, guestRateLimiter(100, 60000), videoPublic.getVideoFeed);

// GET RECOMMENDED VIDEOS - must be BEFORE /:id
router.get('/recommended', optionalAuth, guestAuth, guestRateLimiter(50, 60000), videoPublic.getRecommendedVideos);

// GET VIDEO BY ID
router.get('/:id', optionalAuth, guestAuth, guestRateLimiter(30, 60000), videoPublic.getVideoById);

// GET SERIES EPISODE
router.get(
  '/:videoId/seasons/:seasonNumber/episodes/:episodeNumber',
  optionalAuth,
  guestAuth,
  guestRateLimiter(30, 60000),
  videoPublic.getSeriesEpisode
);

// CHECK VIDEO ACCESS
router.get('/:id/access', optionalAuth, guestAuth, guestRateLimiter(60, 60000), videoPublic.checkVideoAccess);

// WATCH VIDEO
router.get('/:id/watch', optionalAuth, guestAuth, guestRateLimiter(60, 60000), videoPublic.watchVideo);

// TRACK VIDEO SHARE
router.post('/:id/share', optionalAuth, guestAuth, guestRateLimiter(20, 60000), videoPublic.trackShare);

/* ================================
   PROTECTED VIEWER ROUTES (require login)
================================ */

// PURCHASE VIDEO — handled by the wallet service (see server.js)

// RATE VIDEO
router.post('/:id/rate', protect, videoPublic.rateVideo);

// EDIT VIDEO (creator only)
router.put('/:id/edit', protect, videoPublic.editVideo);

// LIKE / DISLIKE (toggle) + status
router.post('/:id/like', protect, videoPublic.likeVideo);
router.post('/:id/dislike', protect, videoPublic.dislikeVideo);
router.get('/:id/interaction-status', protect, videoPublic.getVideoInteractionStatus);

// WATCH HISTORY WITH RESUME
router.post('/:id/progress', protect, videoPublic.recordWatchProgress);
router.get('/:id/resume', protect, videoPublic.getResumePosition);

/* ================================
   USER DASHBOARD ROUTES (require login)
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
   USER DELETE ROUTES
   Users can only soft delete and restore — no permanent delete.
================================ */

// SOFT DELETE VIDEO (move own video to trash)
router.delete('/:id/delete', protect, videoController.userSoftDeleteVideo);

// RESTORE VIDEO (restore own video from trash)
router.put('/:id/restore', protect, videoController.userRestoreVideo);

// PERMANENT DELETE — not available to users. Videos in trash are deleted automatically after 30 days.
router.delete('/:id/permanent', protect, (req, res) => {
  res.status(403).json({
    success: false,
    message:
      'Users cannot permanently delete videos. Use soft delete (move to trash) instead. Videos in trash are automatically deleted after 30 days.',
  });
});

/* ================================
   UPLOAD — legacy route removed
================================ */
router.post('/upload', protect, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This upload endpoint has been replaced. Use POST /api/uploads/video, or the direct upload flow (POST /api/uploads/sign then POST /api/uploads/video/finalize).',
  });
});

/* ================================
   ADMIN ROUTES (require login + admin role)
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

// ADMIN APPROVE / REJECT
router.put('/admin/:id/approve', protect, requireAdmin, videoController.adminApproveVideo);
router.put('/admin/:id/reject', protect, requireAdmin, videoController.adminRejectVideo);

// ADMIN REMOVE / RESTORE (soft delete — admin version)
router.delete('/admin/:id/remove', protect, requireAdmin, videoController.adminRemoveVideo);
router.put('/admin/:id/restore', protect, requireAdmin, videoController.adminRestoreVideo);

// ADMIN PERMANENT DELETE
router.delete('/admin/:id/permanent', protect, requireAdmin, videoController.adminPermanentDeleteVideo);

// ADMIN RESTRICT / REMOVE RESTRICTION
router.put('/admin/:id/restrict', protect, requireAdmin, videoController.adminRestrictVideo);
router.put('/admin/:id/remove-restriction', protect, requireAdmin, videoController.adminRemoveRestriction);

// ADMIN FLAG / REMOVE FLAG
router.put('/admin/:id/flag', protect, requireAdmin, videoController.adminFlagVideo);
router.put('/admin/:id/remove-flag', protect, requireAdmin, videoController.adminRemoveFlag);

// ADMIN SHADOW BAN / REMOVE SHADOW BAN
router.put('/admin/:id/shadow-ban', protect, requireAdmin, videoController.adminShadowBanVideo);
router.put('/admin/:id/remove-shadow-ban', protect, requireAdmin, videoController.adminRemoveShadowBan);

// ADMIN: UPDATE VIDEO FLAGS (age rating, content flags)
router.put('/:id/admin/flags', protect, requireAdmin, videoController.adminUpdateVideoFlags);

// ADMIN: UPDATE VIDEO STATUS (approve/reject) - legacy support
router.put('/:id/admin/status', protect, requireAdmin, videoController.updateVideoStatus);

// ADMIN: SHADOW BAN VIDEO (legacy)
router.post('/:id/admin/shadowban', protect, requireAdmin, videoController.shadowBanVideo);

// ADMIN: DELETE VIDEO (soft delete - legacy)
router.delete('/:id/admin/delete', protect, requireAdmin, videoController.deleteVideo);

module.exports = router;

// ═══ END OF FILE: backend/routes/videoRoutes.js ═══