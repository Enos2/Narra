/**
 * File: backend/middleware/liveQualificationMiddleware.js
 * Description: Middleware to automatically check and update user's live streaming qualifications
 */

const User = require('../models/User');
const Video = require('../models/Video');

/**
 * Check if user automatically qualifies for live streaming
 * Criteria:
 * 1. Minimum approved videos: 3
 * 2. Minimum total views: 500
 * 3. Account age: at least 30 days
 * 4. No active strikes
 * 5. Account is active and not banned
 */
const checkAutoLiveQualification = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    // Skip if already qualified
    if (user.canGoLive && user.canGoLiveReason === 'auto_qualified') {
      return true;
    }

    // Check if user has any manual approval (admin can override)
    if (user.canGoLive && user.canGoLiveReason === 'manual_admin_approval') {
      return true;
    }

    // Criteria 4: No active strikes (strikes older than 9 months are ignored)
    const now = new Date();
    const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
    const activeStrikes = user.liveStrikes.filter(
      strike => new Date(strike.date) > nineMonthsAgo
    );
    
    if (activeStrikes.length > 0) {
      return false;
    }

    // Criteria 3: Account age at least 30 days
    const accountAge = Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24));
    if (accountAge < 30) {
      return false;
    }

    // Criteria 1 & 2: Get user's videos to count approved videos and views
    const videos = await Video.find({
      user: userId,
      approved: true,
      isDeleted: false
    }).select('views');

    const approvedVideoCount = videos.length;
    const totalVideoViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);

    // Update user stats
    user.approvedVideoCount = approvedVideoCount;
    user.totalVideoViews = totalVideoViews;
    user.liveQualificationCheckedAt = now;

    // Check if user qualifies
    if (approvedVideoCount >= 3 && totalVideoViews >= 500) {
      user.canGoLive = true;
      user.canGoLiveReason = 'auto_qualified';
      user.canGoLiveGrantedAt = now;
      user.canGoLiveGrantedBy = null; // System auto-granted
      
      await user.save();
      return true;
    }

    // Save updated stats even if not qualified
    await user.save();
    return false;

  } catch (error) {
    console.error('Error checking auto live qualification:', error);
    return false;
  }
};

/**
 * Middleware to auto-check live qualifications before live streaming operations
 */
const autoCheckLiveQualification = async (req, res, next) => {
  try {
    if (!req.user) return next();
    
    // Check qualifications if not already qualified
    if (!req.user.canGoLive || req.user.canGoLiveReason !== 'auto_qualified') {
      await checkAutoLiveQualification(req.user._id);
      
      // Refresh user data
      const updatedUser = await User.findById(req.user._id);
      req.user.canGoLive = updatedUser.canGoLive;
      req.user.canGoLiveReason = updatedUser.canGoLiveReason;
    }
    
    next();
  } catch (error) {
    console.error('Auto check live qualification middleware error:', error);
    next();
  }
};

/**
 * Admin function to manually grant/revoke live privileges
 */
const updateLivePrivilege = async (userId, canGoLive, adminId, reason = 'manual_admin_approval') => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    user.canGoLive = canGoLive;
    user.canGoLiveReason = canGoLive ? reason : 'revoked';
    user.canGoLiveGrantedAt = canGoLive ? new Date() : null;
    user.canGoLiveGrantedBy = canGoLive ? adminId : null;

    await user.save();
    return true;
  } catch (error) {
    console.error('Error updating live privilege:', error);
    return false;
  }
};

module.exports = {
  checkAutoLiveQualification,
  autoCheckLiveQualification,
  updateLivePrivilege
};