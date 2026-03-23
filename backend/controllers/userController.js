/**
 * File: backend/controllers/userController.js
 * Description: User controller with all CRUD operations, follow functionality, and admin actions
 * FIXED: updateProfile returns proper user data with all fields
 */

const User = require('../models/User');
const Video = require('../models/Video');
const Live = require('../models/Live');
const mongoose = require('mongoose');

// ================================
// PUBLIC ROUTES
// ================================

/**
 * @desc    Get public user profile by ID (with privacy checks)
 * @route   GET /api/users/:id/public
 * @access  Public
 */
exports.getPublicUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id).select('-password -tokenVersion -loginHistory');
    
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.privacySettings?.profileVisibility === 'private') {
      return res.status(403).json({ success: false, message: 'This profile is private' });
    }
    
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Search users (public with privacy filters)
 * @route   GET /api/users/search/public
 * @access  Public
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query, limit = 20, page = 1 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }
    
    const skip = (page - 1) * limit;
    
    const searchCondition = {
      isDeleted: false,
      isBanned: false,
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } }
      ]
    };
    
    const users = await User.find(searchCondition)
      .select('firstName lastName username avatar bio followerCount isVerified privacySettings')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ followerCount: -1 });
    
    // Filter out private profiles for public search
    const filteredUsers = users.filter(user => 
      user.privacySettings?.profileVisibility !== 'private'
    );
    
    const total = await User.countDocuments(searchCondition);
    
    res.status(200).json({
      success: true,
      data: filteredUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// PROTECTED ROUTES
// ================================

/**
 * @desc    Get current logged-in profile
 * @route   GET /api/users/me
 * @access  Private
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -tokenVersion')
      .populate('followers', 'firstName lastName username avatar')
      .populate('following', 'firstName lastName username avatar')
      .populate('twins', 'firstName lastName username avatar');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update own profile - FIXED to return complete user data
 * @route   PUT /api/users/me
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      'firstName', 'lastName', 'middleName', 'bio', 'avatar', 
      'phoneNumber', 'location', 'website', 'gender', 'dateOfBirth',
      'notificationPreferences', 'privacySettings', 'preferredLanguage', 'theme',
      'username', 'email'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Check username uniqueness if being updated
    if (req.body.username && req.body.username !== req.user.username) {
      const existingUser = await User.findOne({ username: req.body.username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
      updates.username = req.body.username.toLowerCase();
    }
    
    // Check email uniqueness if being updated
    if (req.body.email && req.body.email !== req.user.email) {
      const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already taken' });
      }
      updates.email = req.body.email.toLowerCase();
    }
    
    // Handle password change if provided
    if (req.body.password) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to change password' });
      }
      
      const user = await User.findById(req.user.id);
      const isMatch = await user.comparePassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      
      updates.password = req.body.password;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -tokenVersion')
     .populate('followers', 'firstName lastName username avatar')
     .populate('following', 'firstName lastName username avatar')
     .populate('twins', 'firstName lastName username avatar');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Return complete user data
    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: user 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete own account (soft delete)
 * @route   DELETE /api/users/me
 * @access  Private
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await user.softDelete(req.user.id, req.body.reason || 'User requested deletion');
    
    res.status(200).json({ 
      success: true, 
      message: 'Account deleted successfully. Your data will be permanently removed in 30 days.'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Check username availability
 * @route   GET /api/users/check-username
 * @access  Public/Private
 */
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    const isAvailable = !existingUser;
    
    res.status(200).json({ success: true, isAvailable });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get upload status/quota
 * @route   GET /api/users/upload-status
 * @access  Private
 */
exports.getUploadStatus = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const videoCount = await Video.countDocuments({
      user: req.user.id,
      createdAt: { $gte: thirtyDaysAgo },
      isDeleted: false
    });
    
    const totalStorageUsed = await Video.aggregate([
      { $match: { user: req.user._id, isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    
    const quotaLimit = 10 * 1024 * 1024 * 1024; // 10GB
    const used = totalStorageUsed[0]?.total || 0;
    
    res.status(200).json({
      success: true,
      data: {
        videoCount,
        quotaUsed: used,
        quotaLimit,
        quotaRemaining: quotaLimit - used,
        canUpload: used < quotaLimit
      }
    });
  } catch (error) {
    console.error('Get upload status error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// FOLLOW/UNFOLLOW ROUTES
// ================================

/**
 * @desc    Follow a user
 * @route   POST /api/users/:userId/follow
 * @access  Private
 */
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }
    
    const targetUser = await User.findById(userId);
    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const currentUser = await User.findById(req.user.id);
    const result = await currentUser.follow(userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/users/:userId/follow
 * @access  Private
 */
exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const currentUser = await User.findById(req.user.id);
    const result = await currentUser.unfollow(userId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Check follow status with a user
 * @route   GET /api/users/:userId/follow-status
 * @access  Private
 */
exports.checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isFollowing = currentUser.isFollowing(userId);
    const isFollowedBy = currentUser.isFollowedBy(userId);
    const isTwin = currentUser.isTwin(userId);
    
    res.status(200).json({
      success: true,
      isFollowing,
      isFollowedBy,
      isTwin
    });
  } catch (error) {
    console.error('Check follow status error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get follow suggestions (who to follow)
 * @route   GET /api/users/suggestions
 * @access  Private
 */
exports.getFollowSuggestions = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'User not found'
      });
    }
    
    const followingIds = (currentUser.following || []).map(id => id.toString());
    
    const suggestions = await User.find({
      _id: { $ne: req.user.id, $nin: followingIds },
      isDeleted: false,
      isBanned: false,
      privacySettings: { profileVisibility: 'public' }
    })
    .sort({ followerCount: -1 })
    .limit(10)
    .select('firstName lastName username avatar bio followerCount isVerified');
    
    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// GET FOLLOWERS/FOLLOWING/TWINS
// ================================

/**
 * @desc    Get user's followers (with pagination)
 * @route   GET /api/users/:userId/followers
 * @access  Private
 */
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const populatedUser = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'firstName lastName username avatar bio isVerified',
        options: {
          skip: parseInt(skip),
          limit: parseInt(limit)
        }
      });
    
    res.status(200).json({
      success: true,
      data: populatedUser.followers || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.followerCount || 0
      }
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get users that a user is following (with pagination)
 * @route   GET /api/users/:userId/following
 * @access  Private
 */
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const populatedUser = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'firstName lastName username avatar bio isVerified',
        options: {
          skip: parseInt(skip),
          limit: parseInt(limit)
        }
      });
    
    res.status(200).json({
      success: true,
      data: populatedUser.following || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.followingCount || 0
      }
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get user's twins (mutual followers) (with pagination)
 * @route   GET /api/users/:userId/twins
 * @access  Private
 */
exports.getTwins = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const populatedUser = await User.findById(userId)
      .populate({
        path: 'twins',
        select: 'firstName lastName username avatar bio isVerified',
        options: {
          skip: parseInt(skip),
          limit: parseInt(limit)
        }
      });
    
    res.status(200).json({
      success: true,
      data: populatedUser.twins || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.twinCount || 0
      }
    });
  } catch (error) {
    console.error('Get twins error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// FOLLOWING CONTENT FEED
// ================================

/**
 * @desc    Get content (videos/lives) from users the current user follows
 * @route   GET /api/users/following-content
 * @access  Private
 */
exports.getFollowingContent = async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'all' } = req.query;
    const skip = (page - 1) * limit;
    
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(200).json({ success: true, data: [] });
    }
    
    const followingIds = currentUser.following || [];
    
    let content = [];
    
    if (type === 'videos' || type === 'all') {
      const videos = await Video.find({
        user: { $in: followingIds },
        isDeleted: false,
        approved: true,
        scheduledFor: { $lte: new Date() }
      })
      .populate('user', 'firstName lastName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
      content = [...content, ...videos.map(v => ({ ...v.toObject(), contentType: 'video' }))];
    }
    
    if (type === 'lives' || type === 'all') {
      const lives = await Live.find({
        user: { $in: followingIds },
        status: 'live',
        isDeleted: false
      })
      .populate('user', 'firstName lastName username avatar')
      .sort({ startedAt: -1 });
      
      content = [...content, ...lives.map(l => ({ ...l.toObject(), contentType: 'live' }))];
    }
    
    content.sort((a, b) => new Date(b.createdAt || b.startedAt) - new Date(a.createdAt || a.startedAt));
    
    res.status(200).json({
      success: true,
      data: content.slice(0, parseInt(limit)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get following content error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// GET USER BY ID
// ================================

/**
 * @desc    Get user by ID (authenticated - respects privacy settings)
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id)
      .select('-password -tokenVersion -loginHistory')
      .populate('followers', 'firstName lastName username avatar')
      .populate('following', 'firstName lastName username avatar')
      .populate('twins', 'firstName lastName username avatar');
    
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check privacy settings
    if (user.privacySettings?.profileVisibility === 'private') {
      const isFollower = user.followers.some(f => f._id.toString() === req.user.id);
      if (!isFollower && req.user.id !== id) {
        return res.status(403).json({ success: false, message: 'This profile is private' });
      }
    }
    
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ================================
// ADMIN ROUTES
// ================================

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role, isVerified, isBanned, search } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { isDeleted: false };
    
    if (role) filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (isBanned !== undefined) filter.isBanned = isBanned === 'true';
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password -tokenVersion')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Ban a user
 * @route   POST /api/users/:id/ban
 * @access  Private/Admin
 */
exports.banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedBy = req.user.id;
    user.banReason = reason || 'No reason provided';
    
    await user.invalidateTokens();
    await user.save();
    
    res.status(200).json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Unban a user
 * @route   POST /api/users/:id/unban
 * @access  Private/Admin
 */
exports.unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isBanned = false;
    user.bannedAt = null;
    user.bannedBy = null;
    user.banReason = null;
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Verify a user
 * @route   POST /api/users/:id/verify
 * @access  Private/Admin
 */
exports.verifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifiedBy = req.user.id;
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'User verified successfully' });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Unverify a user
 * @route   POST /api/users/:id/unverify
 * @access  Private/Admin
 */
exports.unverifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isVerified = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'User unverified successfully' });
  } catch (error) {
    console.error('Unverify user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Deactivate a user
 * @route   PUT /api/users/:id/deactivate
 * @access  Private/Admin
 */
exports.deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || 'Deactivated by admin';
    user.adminDeactivated = true;
    user.adminDeactivatedAt = new Date();
    user.adminDeactivationReason = reason || 'Deactivated by admin';
    
    await user.invalidateTokens();
    await user.save();
    
    res.status(200).json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Activate a user
 * @route   PUT /api/users/:id/activate
 * @access  Private/Admin
 */
exports.activateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isDeactivated = false;
    user.deactivatedAt = null;
    user.deactivationReason = null;
    user.adminDeactivated = false;
    user.adminDeactivatedAt = null;
    user.adminDeactivationReason = null;
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Apply shadow ban to a user
 * @route   POST /api/users/:id/shadow-ban
 * @access  Private/Admin
 */
exports.applyShadowBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { countries = [], continents = [] } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isShadowBanned = true;
    user.shadowBannedCountries = countries;
    user.shadowBannedContinents = continents;
    user.shadowBanAppliedBy = req.user.id;
    user.shadowBanAppliedAt = new Date();
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'Shadow ban applied successfully' });
  } catch (error) {
    console.error('Apply shadow ban error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Remove shadow ban from a user
 * @route   POST /api/users/:id/remove-shadow-ban
 * @access  Private/Admin
 */
exports.removeShadowBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isShadowBanned = false;
    user.shadowBannedCountries = [];
    user.shadowBannedContinents = [];
    user.shadowBanAppliedBy = null;
    user.shadowBanAppliedAt = null;
    
    await user.save();
    
    res.status(200).json({ success: true, message: 'Shadow ban removed successfully' });
  } catch (error) {
    console.error('Remove shadow ban error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = exports;