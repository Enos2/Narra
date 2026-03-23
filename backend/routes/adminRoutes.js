/**
 * File: backend/routes/adminRoutes.js
 * COMPLETE FIXED VERSION - ALL ROUTES INCLUDED
 * ADDED: Admin Profile routes for self-management
 * ADDED: Get admins created by admin route for Super Admin profile
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const liveController = require('../controllers/liveController');
const Video = require('../models/Video');
const User = require('../models/User');

/* ========================
   MIDDLEWARE
======================== */
const { protect } = require('../middleware/authMiddleware');

// Helper middleware for role checks
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role === 'superadmin') return next();
  res.status(403).json({ success: false, message: 'Super admin access required' });
};

const requireSuperOrPlatformAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin'].includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Super or platform admin access required' });
};

const requireAnyAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
};

const requirePlatformAdmin = (req, res, next) => {
  if (req.user.role === 'platformadmin') return next();
  res.status(403).json({ success: false, message: 'Platform admin access required' });
};

/* ========================
   LOGGING HELPER
======================== */
const logAdminAction = async ({ admin, actionType, actionLabel, targetType, targetId, targetName, targetEmail, description, reason, ipAddress, userAgent, metadata = {} }) => {
  try {
    let AdminAuditLog;
    try {
      AdminAuditLog = require('../models/AdminAuditLog');
    } catch (e) {
      console.warn('AdminAuditLog model not found, skipping audit log');
      return;
    }

    const logEntry = new AdminAuditLog({
      adminId: admin._id,
      adminName: admin.name || admin.username || 'Unknown',
      adminRole: admin.role,
      adminEmail: admin.email,
      actionType,
      actionLabel,
      targetType,
      targetId,
      targetName,
      targetEmail,
      description,
      reason,
      ipAddress,
      userAgent,
      metadata
    });

    await logEntry.save();
    console.log(`[AUDIT] ${actionLabel} by ${admin.email}`);
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

/* =====================================================
   VIDEO MODERATION ROUTES - COMPLETE WITH ALL ACTIONS
===================================================== */

// GET VIDEOS FOR MODERATION
router.get('/videos/moderation', protect, requireAnyAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    let query = { isDeleted: { $ne: true } };
    
    if (status === 'pending') {
      query.status = 'pending';
      query.approved = false;
    } else if (status === 'approved') {
      query.status = 'approved';
      query.approved = true;
    } else if (status === 'rejected') {
      query.status = 'rejected';
      query.approved = false;
    } else if (status === 'all') {
      // For all videos, just apply isDeleted filter
    } else {
      query.status = status;
    }

    const videos = await Video.find(query)
      .populate('creator', 'name email username avatar')
      .sort({ uploadedAt: -1 });

    try {
      await logAdminAction({
        admin: req.user,
        actionType: 'VIEW_MODERATION',
        actionLabel: 'View Moderation Queue',
        targetType: 'Video',
        description: `Viewed ${status} videos for moderation (${videos.length} videos)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { status, count: videos.length }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    return res.status(200).json({
      success: true,
      count: videos.length,
      videos
    });

  } catch (error) {
    console.error('Error fetching videos for moderation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch videos for moderation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET VIDEO STATISTICS
router.get('/videos/statistics', protect, requireAnyAdmin, async (req, res) => {
  try {
    const [pending, approved, rejected, total, flagged, restricted, shadowBanned, removed] = await Promise.all([
      Video.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'approved', isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'rejected', isDeleted: { $ne: true } }),
      Video.countDocuments({ isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'flagged', isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'restricted', isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'shadowBanned', isDeleted: { $ne: true } }),
      Video.countDocuments({ status: 'removed', isDeleted: { $ne: true } })
    ]);

    const movies = await Video.countDocuments({ 
      type: 'movie', 
      isDeleted: { $ne: true } 
    });
    
    const series = await Video.countDocuments({ 
      type: 'series', 
      isDeleted: { $ne: true } 
    });

    return res.status(200).json({
      success: true,
      statistics: {
        pending,
        approved,
        rejected,
        flagged,
        restricted,
        shadowBanned,
        removed,
        total,
        movies,
        series,
        byStatus: {
          pending,
          approved,
          rejected,
          flagged,
          restricted,
          shadowBanned,
          removed,
          total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching video statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch video statistics'
    });
  }
});

// APPROVE VIDEO
router.put('/videos/:id/approve', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.approved = true;
    video.rejected = false;
    video.rejectionReason = null;
    video.rejectionDetails = null;
    video.approvedBy = req.user._id;
    video.approvedAt = new Date();
    
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'APPROVE_VIDEO',
      actionLabel: 'Approve Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Approved video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        approvedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video approved successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('APPROVE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve video' 
    });
  }
});

// REJECT VIDEO
router.put('/videos/:id/reject', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rejection reason is required' 
      });
    }

    video.status = 'rejected';
    video.approved = false;
    video.rejected = true;
    video.rejectionReason = reason.trim();
    video.rejectionDetails = reason.trim();
    
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REJECT_VIDEO',
      actionLabel: 'Reject Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Rejected video "${video.title}"`,
      reason: reason.trim(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        rejectedBy: req.user.email,
        rejectionReason: reason.trim()
      }
    });

    res.json({ 
      success: true, 
      message: 'Video rejected successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        rejectionReason: video.rejectionReason
      }
    });
  } catch (err) {
    console.error('REJECT VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject video' 
    });
  }
});

// REMOVE VIDEO (Soft Delete)
router.delete('/videos/:id/remove', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'removed';
    video.isDeleted = true;
    video.deletedAt = new Date();
    video.deletedBy = req.user._id;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_VIDEO',
      actionLabel: 'Remove Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Removed video "${video.title}"`,
      reason: req.body.reason || 'Removed by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        removedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('REMOVE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video' 
    });
  }
});

// RESTORE VIDEO
router.put('/videos/:id/restore', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.isDeleted = false;
    video.deletedAt = null;
    video.deletedBy = null;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'RESTORE_VIDEO',
      actionLabel: 'Restore Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Restored video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        restoredBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video restored successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('RESTORE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore video' 
    });
  }
});

// RESTRICT VIDEO
router.put('/videos/:id/restrict', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    const { reason } = req.body;
    video.status = 'restricted';
    video.restricted = true;
    video.restrictedAt = new Date();
    video.restrictedBy = req.user._id;
    video.restrictionReason = reason || 'Restricted by admin';
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'RESTRICT_VIDEO',
      actionLabel: 'Restrict Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Restricted video "${video.title}"`,
      reason: video.restrictionReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        restrictedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video restricted successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('RESTRICT VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restrict video' 
    });
  }
});

// REMOVE VIDEO RESTRICTION
router.put('/videos/:id/remove-restriction', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.restricted = false;
    video.restrictedAt = null;
    video.restrictedBy = null;
    video.restrictionReason = null;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_RESTRICTION',
      actionLabel: 'Remove Restriction',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Removed restriction from video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        restrictionRemovedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video restriction removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('REMOVE RESTRICTION ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video restriction' 
    });
  }
});

// FLAG VIDEO
router.put('/videos/:id/flag', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    const { reason } = req.body;
    video.status = 'flagged';
    video.flagged = true;
    video.flaggedAt = new Date();
    video.flaggedBy = req.user._id;
    video.flagReason = reason || 'Flagged by admin';
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'FLAG_VIDEO',
      actionLabel: 'Flag Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Flagged video "${video.title}"`,
      reason: video.flagReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        flaggedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video flagged successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('FLAG VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to flag video' 
    });
  }
});

// REMOVE VIDEO FLAG
router.put('/videos/:id/remove-flag', protect, requireAnyAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.flagged = false;
    video.flaggedAt = null;
    video.flaggedBy = null;
    video.flagReason = null;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_FLAG',
      actionLabel: 'Remove Flag',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Removed flag from video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        flagRemovedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video flag removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('REMOVE FLAG ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video flag' 
    });
  }
});

// SHADOW BAN VIDEO
router.put('/videos/:id/shadow-ban', protect, requireSuperOrPlatformAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    const { reason, countries = [], continents = [] } = req.body;
    video.status = 'shadowBanned';
    video.isShadowBanned = true;
    video.shadowBannedCountries = countries;
    video.shadowBannedContinents = continents;
    video.shadowBanAppliedBy = req.user._id;
    video.shadowBanAppliedAt = new Date();
    video.shadowBanReason = reason || 'Shadow banned by admin';
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'SHADOW_BAN_VIDEO',
      actionLabel: 'Shadow Ban Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Shadow banned video "${video.title}"`,
      reason: video.shadowBanReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        countries,
        continents,
        shadowBannedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video shadow banned successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isShadowBanned: true
      }
    });
  } catch (err) {
    console.error('SHADOW BAN VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to shadow ban video' 
    });
  }
});

// REMOVE SHADOW BAN VIDEO
router.put('/videos/:id/remove-shadow-ban', protect, requireSuperOrPlatformAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.isShadowBanned = false;
    video.shadowBannedCountries = [];
    video.shadowBannedContinents = [];
    video.shadowBanAppliedBy = null;
    video.shadowBanAppliedAt = null;
    video.shadowBanReason = null;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_SHADOW_BAN_VIDEO',
      actionLabel: 'Remove Shadow Ban',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Removed shadow ban from video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        shadowBanRemovedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Shadow ban removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isShadowBanned: false
      }
    });
  } catch (err) {
    console.error('REMOVE SHADOW BAN VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove shadow ban from video' 
    });
  }
});

// PERMANENTLY DELETE VIDEO
router.delete('/videos/:id/permanent', protect, requireSuperAdmin, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'PERMANENT_DELETE_VIDEO',
      actionLabel: 'Permanently Delete Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Permanently deleted video "${video.title}"`,
      reason: req.body.reason || 'Permanently deleted by superadmin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        permanentlyDeletedBy: req.user.email
      }
    });

    await video.deleteOne();

    res.json({ 
      success: true, 
      message: 'Video permanently deleted successfully',
      deletedVideo: {
        _id: video._id,
        title: video.title
      }
    });
  } catch (err) {
    console.error('PERMANENT DELETE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to permanently delete video: ' + err.message 
    });
  }
});

// FEATURE VIDEO
router.put('/videos/:id/feature', protect, requireAnyAdmin, adminController.featureVideo);

// UNFEATURE VIDEO
router.put('/videos/:id/unfeature', protect, requireAnyAdmin, adminController.unfeatureVideo);

/* =====================================================
   LIVE STREAM MODERATION ROUTES
===================================================== */

router.get('/live-streams', protect, requireAnyAdmin, liveController.getAdminLiveStreams);
router.get('/live-streams/:id', protect, requireAnyAdmin, liveController.getAdminLiveStreamDetails);
router.post('/live-streams/:id/end', protect, requireSuperOrPlatformAdmin, liveController.endLiveStreamAdmin);
router.post('/live-streams/:id/warning', protect, requireSuperOrPlatformAdmin, liveController.sendStreamWarning);
router.get('/live-streams/:id/reports', protect, requireAnyAdmin, liveController.getLiveStreamReports);
router.post('/live-streams/:id/shadow-ban', protect, requireSuperOrPlatformAdmin, liveController.applyShadowBanToLive);
router.post('/live-streams/:id/remove-shadow-ban', protect, requireSuperOrPlatformAdmin, liveController.removeShadowBanFromLive);
router.post('/users/:id/strikes/:strikeId/remove', protect, requireSuperOrPlatformAdmin, liveController.removeStrike);
router.post('/users/:id/ban-streaming', protect, requireSuperAdmin, liveController.banUserFromStreaming);

/* =====================================================
   ADMIN MANAGEMENT (SUPER ADMIN ONLY)
===================================================== */

router.post('/admins', protect, requireSuperAdmin, adminController.createAdmin);
router.get('/admins', protect, requireSuperOrPlatformAdmin, adminController.getAllAdmins);
router.get('/admins/inactive', protect, requireSuperOrPlatformAdmin, adminController.getInactiveAdmins);
router.put('/admins/:id/promote', protect, requireSuperAdmin, adminController.promoteAdmin);
router.put('/admins/:id/demote', protect, requireSuperAdmin, adminController.demoteAdmin);
router.put('/admins/:id/deactivate', protect, requireSuperOrPlatformAdmin, adminController.deactivateAdmin);
router.put('/admins/:id/reactivate', protect, requireSuperOrPlatformAdmin, adminController.reactivateAdmin);
router.delete('/admins/:id', protect, requireSuperAdmin, adminController.deleteAdmin);
router.delete('/admins/:id/permanent', protect, requireSuperAdmin, adminController.permanentlyDeleteAccount);
router.put('/admins/:id/toggle-support', protect, requirePlatformAdmin, adminController.toggleSupportAdmin);
router.post('/admins/:id/force-logout', protect, requireAnyAdmin, adminController.forceAdminLogout);

/* =====================================================
   NEW ROUTE: GET ADMINS CREATED BY A SPECIFIC ADMIN
   (Super Admin only - for profile page)
===================================================== */
router.get('/admins/created-by/:adminId', protect, requireSuperAdmin, adminController.getAdminsCreatedByAdmin);

/* =====================================================
   USER MANAGEMENT
===================================================== */

// GET ALL REGULAR USERS (NON-ADMINS)
router.get('/users', protect, requireAnyAdmin, adminController.getAllUsers);

// GET SINGLE USER
router.get('/users/:id', protect, requireAnyAdmin, adminController.getUserById);

// DEACTIVATE USER
router.put('/users/:id/deactivate', protect, requireSuperAdmin, adminController.deactivateUser);

// ACTIVATE USER
router.put('/users/:id/activate', protect, requireSuperAdmin, adminController.activateUser);

// DELETE USER (SOFT)
router.delete('/users/:id', protect, requireSuperAdmin, adminController.deleteUser);

// PERMANENT DELETE USER
router.delete('/users/:id/permanent', protect, requireSuperAdmin, adminController.permanentlyDeleteAccount);

/* =====================================================
   USER MODERATION
===================================================== */

router.post('/users/:id/ban', protect, requireAnyAdmin, adminController.banUser);
router.post('/users/:id/unban', protect, requireAnyAdmin, adminController.unbanUser);
router.post('/users/:id/verify', protect, requireAnyAdmin, adminController.verifyUser);
router.post('/users/:id/unverify', protect, requireAnyAdmin, adminController.unverifyUser);
router.post('/users/:id/shadow-ban', protect, requireAnyAdmin, adminController.applyShadowBanUser);
router.post('/users/:id/remove-shadow-ban', protect, requireAnyAdmin, adminController.removeShadowBanUser);

/* =====================================================
   CONTENT MODERATION
===================================================== */

router.put('/fundraisers/:id/approve', protect, requireAnyAdmin, adminController.approveFundraiser);
router.put('/fundraisers/:id/reject', protect, requireAnyAdmin, adminController.rejectFundraiser);
router.delete('/comments/:id', protect, requireAnyAdmin, adminController.removeComment);
router.delete('/live-streams/:id', protect, requireAnyAdmin, adminController.removeLiveStream);
router.post('/content/:id/shadow-ban', protect, requireAnyAdmin, adminController.applyShadowBanContent);
router.post('/content/:id/remove-shadow-ban', protect, requireAnyAdmin, adminController.removeShadowBanContent);

/* =====================================================
   AUDIT & ADMIN TOOLS
===================================================== */

router.get('/audit/logs', protect, requireAnyAdmin, adminController.getAuditLogs);
router.get('/audit/logs/recent', protect, requireAnyAdmin, adminController.getRecentAuditLogs);
router.get('/audit/filters', protect, requireAnyAdmin, adminController.getAuditFilterOptions);
router.get('/audit-logs', protect, requireAnyAdmin, adminController.getRecentAuditLogs);

/* =====================================================
   ADMIN PROFILE ROUTES (SELF-MANAGEMENT)
===================================================== */

// GET current admin profile
router.get('/profile/me', protect, requireAnyAdmin, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id)
      .select('-password -tokenVersion')
      .populate('followers', 'firstName lastName username avatar')
      .populate('following', 'firstName lastName username avatar')
      .populate('twins', 'firstName lastName username avatar');
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    
    // Add admin-specific fields
    const adminData = {
      ...admin.toObject(),
      isAdminActive: !admin.adminDeactivated,
      adminDeactivatedAt: admin.adminDeactivatedAt,
      adminDeactivationReason: admin.adminDeactivationReason,
      createdBy: admin.createdBy,
      adminCreatedAt: admin.adminCreatedAt
    };
    
    res.json({ success: true, data: adminData });
  } catch (err) {
    console.error('GET ADMIN PROFILE ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch admin profile' });
  }
});

// UPDATE admin profile
router.put('/profile/me', protect, requireAnyAdmin, async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const allowedUpdates = [
      'firstName', 'lastName', 'middleName', 'username', 'email', 
      'bio', 'location', 'website', 'phoneNumber', 'avatar'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        admin[field] = req.body[field];
      }
    });

    // Handle password change
    if (req.body.password) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password required' });
      }
      const isMatch = await admin.comparePassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password incorrect' });
      }
      admin.password = req.body.password;
    }

    await admin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'UPDATE_PROFILE',
      actionLabel: 'Update Profile',
      targetType: 'Admin',
      targetId: admin._id,
      targetName: admin.name || admin.email,
      description: `Updated profile information`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        updatedFields: Object.keys(req.body).filter(k => allowedUpdates.includes(k))
      }
    });

    const updatedAdmin = await User.findById(admin._id).select('-password -tokenVersion');
    res.json({ success: true, message: 'Profile updated successfully', data: updatedAdmin });
  } catch (err) {
    console.error('UPDATE ADMIN PROFILE ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// GET admin statistics (actions count, etc.)
router.get('/profile/stats', protect, requireAnyAdmin, async (req, res) => {
  try {
    let AdminAuditLog;
    try {
      AdminAuditLog = require('../models/AdminAuditLog');
    } catch (e) {
      return res.json({ 
        success: true, 
        stats: { 
          totalActions: 0, 
          actionsThisWeek: 0, 
          actionsThisMonth: 0,
          approvedVideos: 0,
          rejectedVideos: 0,
          bannedUsers: 0,
          flaggedContent: 0
        } 
      });
    }

    // Get all actions by this admin
    const adminActions = await AdminAuditLog.find({
      $or: [
        { adminId: req.user._id },
        { adminEmail: req.user.email }
      ]
    }).sort({ createdAt: -1 });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const actionsThisWeek = adminActions.filter(a => new Date(a.createdAt) > weekAgo).length;
    const actionsThisMonth = adminActions.filter(a => new Date(a.createdAt) > monthAgo).length;
    
    // Count specific action types
    const approvedVideos = adminActions.filter(a => 
      a.actionType === 'APPROVE_VIDEO' || a.actionType?.includes('APPROVE')
    ).length;
    
    const rejectedVideos = adminActions.filter(a => 
      a.actionType === 'REJECT_VIDEO' || a.actionType?.includes('REJECT')
    ).length;
    
    const bannedUsers = adminActions.filter(a => 
      a.actionType === 'BAN_USER' || a.actionType?.includes('BAN')
    ).length;
    
    const flaggedContent = adminActions.filter(a => 
      a.actionType === 'FLAG_VIDEO' || a.actionType?.includes('FLAG')
    ).length;

    res.json({
      success: true,
      stats: {
        totalActions: adminActions.length,
        actionsThisWeek,
        actionsThisMonth,
        approvedVideos,
        rejectedVideos,
        bannedUsers,
        flaggedContent
      }
    });
  } catch (err) {
    console.error('GET ADMIN STATS ERROR:', err);
    res.json({ 
      success: true, 
      stats: { 
        totalActions: 0, 
        actionsThisWeek: 0, 
        actionsThisMonth: 0,
        approvedVideos: 0,
        rejectedVideos: 0,
        bannedUsers: 0,
        flaggedContent: 0
      } 
    });
  }
});

// GET recent actions by this admin
router.get('/profile/recent-actions', protect, requireAnyAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    let AdminAuditLog;
    try {
      AdminAuditLog = require('../models/AdminAuditLog');
    } catch (e) {
      return res.json({ success: true, actions: [] });
    }

    const recentActions = await AdminAuditLog.find({
      $or: [
        { adminId: req.user._id },
        { adminEmail: req.user.email }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      actions: recentActions
    });
  } catch (err) {
    console.error('GET RECENT ACTIONS ERROR:', err);
    res.json({ success: true, actions: [] });
  }
});

/* =====================================================
   ROUTE ALIASES FOR BACKWARD COMPATIBILITY
===================================================== */

router.put('/roles/promote/:id', protect, requireSuperAdmin, adminController.promoteAdmin);
router.put('/roles/demote/:id', protect, requireSuperAdmin, adminController.demoteAdmin);
router.put('/shadow-ban/user/:id', protect, requireAnyAdmin, adminController.applyShadowBanUser);
router.put('/shadow-ban/user/:id/remove', protect, requireAnyAdmin, adminController.removeShadowBanUser);
router.put('/shadow-ban/content/:id', protect, requireAnyAdmin, adminController.applyShadowBanContent);
router.put('/shadow-ban/content/:id/remove', protect, requireAnyAdmin, adminController.removeShadowBanContent);

// DEBUG ROUTE - Helpful for testing
router.get('/debug/users-test', protect, requireAnyAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG: /debug/users-test called by:', req.user.email);
    
    const regularUsers = await User.find({
      role: { $nin: ['superadmin', 'platformadmin', 'supportadmin'] },
      isDeleted: { $ne: true }
    }).select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      message: 'Debug info',
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role
      },
      counts: {
        totalUsers: await User.countDocuments({}),
        regularUsers: regularUsers.length
      },
      users: regularUsers.map(u => ({
        id: u._id,
        email: u.email,
        role: u.role,
        name: u.name,
        isVerified: u.isVerified,
        isBanned: u.isBanned
      }))
    });
  } catch (err) {
    console.error('Debug route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;