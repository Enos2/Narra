/**
 * File: backend/routes/liveQualificationRoutes.js
 * Description: Routes for live streaming qualification system
 */

const express = require('express');
const router = express.Router();

const {
  checkLiveQualification,
  getUserLiveDetails,
  setLivePrivilege,
  addLiveStrike
} = require('../controllers/liveController');

const { protect } = require('../middleware/authMiddleware');

// Helper middleware for role checks
const requireSuperOrPlatformAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin'].includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Super or platform admin access required' });
};

const requireAnyAdmin = (req, res, next) => {
  if (['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
};

/**
 * ================================
 * PUBLIC & USER ROUTES
 * ================================
 */

// Check user's own live qualification (users can check their own status)
router.get('/my-qualification', protect, checkLiveQualification);

/**
 * ================================
 * ADMIN ROUTES
 * ================================
 */

// Get user live details (ADMIN ONLY)
router.get('/user/:userId', protect, requireAnyAdmin, getUserLiveDetails);

// Grant/revoke live privileges (SUPER + PLATFORM ADMIN ONLY)
router.post('/privileges', protect, requireSuperOrPlatformAdmin, setLivePrivilege);

// Add live strike to user (SUPER + PLATFORM ADMIN ONLY)
router.post('/strikes', protect, requireSuperOrPlatformAdmin, addLiveStrike);

// Get users needing live approval (ADMIN ONLY)
router.get('/pending-approval', protect, requireAnyAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Find users who might need manual approval
    const users = await User.find({
      role: 'user',
      isDeleted: false,
      isBanned: false,
      $or: [
        { canGoLive: false },
        { canGoLive: { $exists: false } }
      ]
    })
    .select('name email createdAt approvedVideoCount totalVideoViews canGoLive canGoLiveReason liveStrikes')
    .sort({ createdAt: -1 })
    .lean();

    // Enhance with qualification details
    const enhancedUsers = await Promise.all(users.map(async (user) => {
      // Check if user qualifies automatically
      const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
      const activeStrikes = user.liveStrikes?.filter(s => {
        const nineMonthsAgo = new Date(Date.now() - (9 * 30 * 24 * 60 * 60 * 1000));
        return new Date(s.date) > nineMonthsAgo;
      }).length || 0;

      const qualifiesAutomatically = 
        (user.approvedVideoCount || 0) >= 3 && 
        (user.totalVideoViews || 0) >= 500 && 
        accountAge >= 30 && 
        activeStrikes === 0;

      return {
        ...user,
        accountAgeDays: accountAge,
        activeStrikes: activeStrikes,
        qualifiesAutomatically: qualifiesAutomatically,
        missingRequirements: {
          approvedVideos: Math.max(0, 3 - (user.approvedVideoCount || 0)),
          totalViews: Math.max(0, 500 - (user.totalVideoViews || 0)),
          accountAgeDays: Math.max(0, 30 - accountAge),
          noActiveStrikes: activeStrikes === 0
        }
      };
    }));

    res.json({
      success: true,
      users: enhancedUsers,
      count: enhancedUsers.length
    });
  } catch (err) {
    console.error('Get pending approval error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users needing approval',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;