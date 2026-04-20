/**
 * File: backend/controllers/followController.js
 * Description: Handles follow/unfollow functionality and twin relationships
 * UPDATED: Added proper notification service integration for new followers
 * UPDATED: Fixed follow notification type from 'system' to 'follow'
 * UPDATED: Added twin notification when mutual follow occurs
 */

const NotificationService = require('../services/notificationService');
const User = require('../models/User');

// Helper function to get display name
const getDisplayName = (user) => {
  if (user.name) return user.name;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.username) return user.username;
  return user.email ? user.email.split('@')[0] : 'Someone';
};

// @desc    Follow a user
// @route   POST /api/users/:userId/follow
// @access  Private
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Prevent self-follow
    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if target user is banned/deleted
    if (targetUser.isBanned || targetUser.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'Cannot follow this user'
      });
    }

    // Check privacy settings
    if (targetUser.privacySettings?.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This user has a private profile'
      });
    }

    const currentUser = await User.findById(currentUserId);

    // Check if already following
    if (currentUser.following.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Add to following
    currentUser.following.push(userId);
    await currentUser.save({ validateBeforeSave: false });

    // Add to target user's followers
    targetUser.followers.push(currentUserId);
    
    let isTwin = false;
    const currentUserName = getDisplayName(currentUser);
    const targetUserName = getDisplayName(targetUser);
    
    // Check if it's a twin (mutual follow)
    if (targetUser.following.includes(currentUserId)) {
      isTwin = true;
      // Add to twins for both users
      if (!currentUser.twins.includes(userId)) {
        currentUser.twins.push(userId);
      }
      if (!targetUser.twins.includes(currentUserId)) {
        targetUser.twins.push(currentUserId);
      }
      
      // Create notification for twin - using 'follow' type
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'follow',
        title: 'New Twin',
        message: `${currentUserName} started following you back! You are now twins!`,
        priority: 'high',
        link: { url: `/profile/${currentUserId}`, text: 'View Profile' },
        reference: { model: 'User', id: currentUserId },
        triggeredBy: currentUserId,
        data: { isTwin: true, followerName: currentUserName, followerId: currentUserId }
      });
    } else {
      // Send new follower notification - using 'follow' type (not 'system')
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'follow',
        title: 'New Follower',
        message: `${currentUserName} started following you!`,
        priority: 'normal',
        link: { url: `/profile/${currentUserId}`, text: 'View Profile' },
        reference: { model: 'User', id: currentUserId },
        triggeredBy: currentUserId,
        data: { followerName: currentUserName, followerId: currentUserId, isTwin: false }
      });
    }

    await targetUser.save({ validateBeforeSave: false });
    await currentUser.save({ validateBeforeSave: false });

    // Populate user data for response
    await currentUser.populate('following', 'name avatar isVerified');
    await currentUser.populate('twins', 'name avatar isVerified');

    res.status(200).json({
      success: true,
      message: isTwin 
        ? `You and ${targetUserName} are now twins!` 
        : `You are now following ${targetUserName}`,
      isTwin: isTwin,
      following: currentUser.following,
      twins: currentUser.twins,
      stats: {
        followingCount: currentUser.following.length,
        followersCount: currentUser.followers.length,
        twinCount: currentUser.twins.length
      }
    });
  } catch (err) {
    console.error('Follow user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:userId/follow
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Find users
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if actually following
    if (!currentUser.following.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    const currentUserName = getDisplayName(currentUser);
    const targetUserName = getDisplayName(targetUser);

    // Remove from following
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userId
    );

    // Remove from twins if present
    if (currentUser.twins.includes(userId)) {
      currentUser.twins = currentUser.twins.filter(
        id => id.toString() !== userId
      );
    }

    await currentUser.save({ validateBeforeSave: false });

    // Remove from target user's followers
    targetUser.followers = targetUser.followers.filter(
      id => id.toString() !== currentUserId.toString()
    );

    // Remove from target user's twins if present
    if (targetUser.twins.includes(currentUserId)) {
      targetUser.twins = targetUser.twins.filter(
        id => id.toString() !== currentUserId.toString()
      );
    }

    // Create notification for unfollow - using 'follow' type
    await NotificationService.createNotification({
      userId: targetUser._id,
      type: 'follow',
      title: 'Unfollowed',
      message: `${currentUserName} unfollowed you`,
      priority: 'low',
      link: { url: `/profile/${currentUserId}`, text: 'View Profile' },
      reference: { model: 'User', id: currentUserId },
      triggeredBy: currentUserId,
      data: { unfollowerName: currentUserName, unfollowerId: currentUserId }
    });

    await targetUser.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `You have unfollowed ${targetUserName}`,
      following: currentUser.following,
      twins: currentUser.twins,
      stats: {
        followingCount: currentUser.following.length,
        followersCount: currentUser.followers.length,
        twinCount: currentUser.twins.length
      }
    });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's followers
// @route   GET /api/users/:userId/followers
// @access  Public/Private based on privacy
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowers && 
        (!req.user || req.user._id.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden their followers'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get followers with pagination
    const followers = await User.find({
      _id: { $in: user.followers }
    })
    .select('firstName lastName username name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check twin status for current user
    let followersWithStatus = followers;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      followersWithStatus = followers.map(f => ({
        ...f.toObject(),
        displayName: getDisplayName(f),
        isFollowing: currentUser.following.includes(f._id),
        isTwin: currentUser.twins.includes(f._id)
      }));
    }

    res.status(200).json({
      success: true,
      followers: followersWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.followers.length,
        pages: Math.ceil(user.followers.length / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's following
// @route   GET /api/users/:userId/following
// @access  Public/Private based on privacy
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowing && 
        (!req.user || req.user._id.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden who they follow'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get following with pagination
    const following = await User.find({
      _id: { $in: user.following }
    })
    .select('firstName lastName username name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check twin status for current user
    let followingWithStatus = following;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      followingWithStatus = following.map(f => ({
        ...f.toObject(),
        displayName: getDisplayName(f),
        isFollowing: true,
        isTwin: currentUser.twins.includes(f._id)
      }));
    }

    res.status(200).json({
      success: true,
      following: followingWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.following.length,
        pages: Math.ceil(user.following.length / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's twins (mutual followers)
// @route   GET /api/users/:userId/twins
// @access  Public/Private based on privacy
exports.getTwins = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowers && 
        (!req.user || req.user._id.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden their twins'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get twins with pagination
    const twins = await User.find({
      _id: { $in: user.twins }
    })
    .select('firstName lastName username name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    const twinsWithDisplayName = twins.map(t => ({
      ...t.toObject(),
      displayName: getDisplayName(t)
    }));

    res.status(200).json({
      success: true,
      twins: twinsWithDisplayName,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.twins.length,
        pages: Math.ceil(user.twins.length / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get twins error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Check follow status with a user
// @route   GET /api/users/:userId/follow-status
// @access  Private
exports.checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isFollowing = currentUser.following.includes(userId);
    const isFollowedBy = currentUser.followers.includes(userId);
    const isTwin = currentUser.twins.includes(userId);

    res.status(200).json({
      success: true,
      status: {
        isFollowing,
        isFollowedBy,
        isTwin,
        canFollow: !isFollowing && !targetUser.isBanned && !targetUser.isDeleted
      }
    });
  } catch (err) {
    console.error('Check follow status error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get follow suggestions (users to follow)
// @route   GET /api/users/suggestions
// @access  Private
exports.getFollowSuggestions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);

    // Get popular users that the current user doesn't follow
    const suggestions = await User.find({
      _id: { 
        $ne: currentUserId,
        $nin: currentUser.following 
      },
      isBanned: false,
      isDeleted: false,
      privacySettings: { $ne: { profileVisibility: 'private' } }
    })
    .sort({ followerCount: -1 })
    .limit(parseInt(limit))
    .select('firstName lastName username name avatar bio isVerified followerCount');

    // Mark if they follow the current user
    const suggestionsWithStatus = suggestions.map(s => ({
      ...s.toObject(),
      displayName: getDisplayName(s),
      followsYou: s.followers.includes(currentUserId)
    }));

    res.status(200).json({
      success: true,
      suggestions: suggestionsWithStatus
    });
  } catch (err) {
    console.error('Get follow suggestions error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};