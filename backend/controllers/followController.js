/**
 * File: backend/controllers/followController.js
 * Description: Handles follow/unfollow functionality and twin relationships
 */

const User = require('../models/User');

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
      // Send follow request instead of direct follow
      // This would need a follow requests collection - for now, just block
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
    await currentUser.save();

    // Add to target user's followers
    targetUser.followers.push(currentUserId);
    
    // Check if it's a twin (mutual follow)
    if (targetUser.following.includes(currentUserId)) {
      // Add to twins for both users
      if (!currentUser.twins.includes(userId)) {
        currentUser.twins.push(userId);
      }
      if (!targetUser.twins.includes(currentUserId)) {
        targetUser.twins.push(currentUserId);
      }
      
      // Create notification for twin
      targetUser.notifications.push({
        type: 'follow',
        message: `${currentUser.name} started following you back! You are now twins!`,
        relatedId: currentUserId,
        relatedModel: 'User'
      });
    } else {
      // Create notification for regular follow
      targetUser.notifications.push({
        type: 'follow',
        message: `${currentUser.name} started following you`,
        relatedId: currentUserId,
        relatedModel: 'User'
      });
    }

    await targetUser.save();
    await currentUser.save();

    // Populate user data for response
    await currentUser.populate('following', 'name avatar isVerified');
    await currentUser.populate('twins', 'name avatar isVerified');

    res.status(200).json({
      success: true,
      message: targetUser.following.includes(currentUserId) 
        ? `You and ${targetUser.name} are now twins! 🎉` 
        : `You are now following ${targetUser.name}`,
      isTwin: targetUser.following.includes(currentUserId),
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

    await currentUser.save();

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

    // Create notification for unfollow
    targetUser.notifications.push({
      type: 'follow',
      message: `${currentUser.name} unfollowed you`,
      relatedId: currentUserId,
      relatedModel: 'User'
    });

    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `You have unfollowed ${targetUser.name}`,
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
    .select('name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check twin status for current user
    let followersWithStatus = followers;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      followersWithStatus = followers.map(f => ({
        ...f.toObject(),
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
    .select('name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check twin status for current user
    let followingWithStatus = following;
    if (req.user) {
      const currentUser = await User.findById(req.user._id);
      followingWithStatus = following.map(f => ({
        ...f.toObject(),
        isFollowing: true, // They are in following list
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
    .select('name avatar bio isVerified followerCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      twins,
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
    .select('name avatar bio isVerified followerCount');

    // Mark if they follow the current user
    const suggestionsWithStatus = suggestions.map(s => ({
      ...s.toObject(),
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