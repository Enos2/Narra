/**
 * File: backend/controllers/userController.js
 * Description: Handles user profile, admin actions, RBAC, shadow ban, search, JWT
 * UPDATED: Added enhanced profile updates with bio, location, website, preferences
 * ADDED: Follow/unfollow functionality with twin detection
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ================================
// GET CURRENT USER PROFILE
// ================================
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -loginHistory')
      .populate('uploadedVideos', 'title thumbnailUrl views createdAt status')
      .populate('uploadedLives', 'title thumbnailUrl viewers isLive')
      .populate('purchasedVideos', 'title thumbnailUrl price')
      .populate('followers', 'name avatar isVerified')
      .populate('following', 'name avatar isVerified')
      .populate('twins', 'name avatar isVerified');
      
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Add computed fields
    const userObject = user.toObject();
    userObject.followerCount = user.followers.length;
    userObject.followingCount = user.following.length;
    userObject.twinCount = user.twins.length;
    userObject.profileComplete = !!(user.avatar && user.bio && user.location);

    res.status(200).json({ 
      success: true, 
      user: userObject 
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// UPDATE PROFILE (ENHANCED)
// ================================
exports.updateProfile = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      currentPassword,
      bio, 
      location, 
      website,
      phoneNumber,
      avatar,
      notificationPreferences,
      privacySettings,
      theme,
      preferredLanguage,
      dateOfBirth
    } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // If trying to change password, verify current password
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Current password is required to change password' 
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ 
          success: false, 
          message: 'Current password is incorrect' 
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      user.lastPasswordChange = new Date();
      
      // Increment token version to force logout from other devices
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    // Update basic info
    if (name) user.name = name;
    
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already in use' 
        });
      }
      user.email = email;
    }

    if (dateOfBirth) user.dateOfBirth = dateOfBirth;

    // Update profile fields
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (avatar !== undefined) user.avatar = avatar;

    // Update preferences
    if (notificationPreferences) {
      user.notificationPreferences = {
        ...user.notificationPreferences.toObject(),
        ...notificationPreferences
      };
    }

    if (privacySettings) {
      user.privacySettings = {
        ...user.privacySettings.toObject(),
        ...privacySettings
      };
    }

    if (theme) user.theme = theme;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = await User.findById(user._id)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -loginHistory')
      .populate('followers', 'name avatar isVerified')
      .populate('following', 'name avatar isVerified')
      .populate('twins', 'name avatar isVerified');

    // Add computed fields
    const userObject = updatedUser.toObject();
    userObject.followerCount = updatedUser.followers.length;
    userObject.followingCount = updatedUser.following.length;
    userObject.twinCount = updatedUser.twins.length;

    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: userObject 
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// FOLLOW A USER
// ================================
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
    await currentUser.save();

    // Add to target user's followers
    targetUser.followers.push(currentUserId);
    
    // Check if it's a twin (mutual follow)
    const isTwin = targetUser.following.includes(currentUserId);
    if (isTwin) {
      // Add to twins for both users
      if (!currentUser.twins.includes(userId)) {
        currentUser.twins.push(userId);
        await currentUser.save();
      }
      if (!targetUser.twins.includes(currentUserId)) {
        targetUser.twins.push(currentUserId);
      }
      
      // Create notification for twin
      targetUser.notifications.push({
        type: 'follow',
        message: `${currentUser.name} started following you back! You are now twins! 🎉`,
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

    // Get updated user data for response
    await currentUser.populate('following', 'name avatar isVerified');
    await currentUser.populate('twins', 'name avatar isVerified');

    res.status(200).json({
      success: true,
      message: isTwin 
        ? `You and ${targetUser.name} are now twins! 🎉` 
        : `You are now following ${targetUser.name}`,
      isTwin,
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

// ================================
// UNFOLLOW A USER
// ================================
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

    // Get updated user data for response
    await currentUser.populate('following', 'name avatar isVerified');
    await currentUser.populate('twins', 'name avatar isVerified');

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

// ================================
// GET USER'S FOLLOWERS
// ================================
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?._id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowers && 
        (!currentUserId || currentUserId.toString() !== userId)) {
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
    .select('name avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check follow status for current user
    let followersWithStatus = followers;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      followersWithStatus = followers.map(f => {
        const fObj = f.toObject();
        return {
          ...fObj,
          isFollowing: currentUser.following.includes(f._id),
          isFollowedBy: currentUser.followers.includes(f._id),
          isTwin: currentUser.twins.includes(f._id)
        };
      });
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

// ================================
// GET USER'S FOLLOWING
// ================================
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?._id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowing && 
        (!currentUserId || currentUserId.toString() !== userId)) {
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
    .select('name avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check follow status for current user
    let followingWithStatus = following;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      followingWithStatus = following.map(f => {
        const fObj = f.toObject();
        return {
          ...fObj,
          isFollowing: true, // They are in following list
          isFollowedBy: currentUser.followers.includes(f._id),
          isTwin: currentUser.twins.includes(f._id)
        };
      });
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

// ================================
// GET USER'S TWINS (MUTUAL FOLLOWERS)
// ================================
exports.getTwins = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?._id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    if (!user.privacySettings?.showFollowers && 
        (!currentUserId || currentUserId.toString() !== userId)) {
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
    .select('name avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Check follow status for current user
    let twinsWithStatus = twins;
    if (currentUserId && currentUserId.toString() !== userId) {
      const currentUser = await User.findById(currentUserId);
      twinsWithStatus = twins.map(t => {
        const tObj = t.toObject();
        return {
          ...tObj,
          isFollowing: currentUser.following.includes(t._id),
          isFollowedBy: currentUser.followers.includes(t._id),
          isTwin: currentUser.twins.includes(t._id)
        };
      });
    }

    res.status(200).json({
      success: true,
      twins: twinsWithStatus,
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

// ================================
// CHECK FOLLOW STATUS WITH A USER
// ================================
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
      },
      targetUser: {
        id: targetUser._id,
        name: targetUser.name,
        avatar: targetUser.avatar,
        isVerified: targetUser.isVerified,
        privacySettings: targetUser.privacySettings
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

// ================================
// GET FOLLOW SUGGESTIONS
// ================================
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
      'privacySettings.profileVisibility': { $ne: 'private' }
    })
    .sort({ followerCount: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .select('name avatar bio isVerified followerCount createdAt');

    // Mark if they follow the current user
    const suggestionsWithStatus = suggestions.map(s => {
      const sObj = s.toObject();
      return {
        ...sObj,
        followsYou: s.followers.includes(currentUserId)
      };
    });

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

// ================================
// SEARCH USERS
// ================================
exports.searchUsers = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?._id;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query required' 
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      $and: [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } }
          ]
        },
        { isBanned: false },
        { isDeleted: false }
      ]
    };

    // Don't show private profiles to non-followers
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      filter.$and.push({
        $or: [
          { 'privacySettings.profileVisibility': { $ne: 'private' } },
          { followers: currentUserId },
          { _id: currentUserId }
        ]
      });
    } else {
      filter.$and.push({
        'privacySettings.profileVisibility': { $ne: 'private' }
      });
    }

    const users = await User.find(filter)
      .select('name avatar bio isVerified followerCount location privacySettings')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ followerCount: -1 });

    const total = await User.countDocuments(filter);

    // Add follow status for authenticated users
    let usersWithStatus = users;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      usersWithStatus = users.map(u => {
        const uObj = u.toObject();
        return {
          ...uObj,
          isFollowing: currentUser.following.includes(u._id),
          isFollowedBy: currentUser.followers.includes(u._id),
          isTwin: currentUser.twins.includes(u._id)
        };
      });
    }

    res.status(200).json({
      success: true,
      users: usersWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// GET USER BY ID (PUBLIC PROFILE)
// ================================
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?._id;

    const user = await User.findById(id)
      .select('-password -email -passwordResetToken -passwordResetExpires -twoFactorSecret -loginHistory -adminActions -auditLogs -tokenVersion')
      .populate('uploadedVideos', 'title thumbnailUrl views createdAt')
      .populate('uploadedLives', 'title thumbnailUrl viewers isLive');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check privacy settings
    if (user.privacySettings?.profileVisibility === 'private') {
      if (!currentUserId || currentUserId.toString() !== id) {
        // Check if current user is a follower
        const isFollower = user.followers.includes(currentUserId);
        if (!isFollower) {
          return res.status(403).json({
            success: false,
            message: 'This profile is private'
          });
        }
      }
    }

    const userObject = user.toObject();
    userObject.followerCount = user.followers.length;
    userObject.followingCount = user.following.length;
    userObject.twinCount = user.twins.length;

    // Add follow status for authenticated users
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      userObject.isFollowing = currentUser.following.includes(user._id);
      userObject.isFollowedBy = currentUser.followers.includes(user._id);
      userObject.isTwin = currentUser.twins.includes(user._id);
    }

    // Remove followers/following lists if privacy settings require
    if (!user.privacySettings?.showFollowers && (!currentUserId || currentUserId.toString() !== id)) {
      delete userObject.followers;
    }
    if (!user.privacySettings?.showFollowing && (!currentUserId || currentUserId.toString() !== id)) {
      delete userObject.following;
    }

    res.status(200).json({ 
      success: true, 
      user: userObject 
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: GET ALL USERS
// ================================
exports.getAllUsers = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const { page = 1, limit = 20, role, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { isDeleted: false };

    if (role) filter.role = role;
    if (status === 'banned') filter.isBanned = true;
    if (status === 'active') filter.isBanned = false;
    if (status === 'verified') filter.isVerified = true;
    if (status === 'deactivated') filter.isDeactivated = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({ 
      success: true, 
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// DELETE OWN ACCOUNT
// ================================
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);

    if (req.user.isShadowBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Shadow banned users cannot delete accounts' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Soft delete instead of permanent deletion
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = userId;
    user.deleteReason = 'User requested deletion';
    user.email = `deleted_${user._id}_${user.email}`; // Anonymize email
    user.name = 'Deleted User';
    
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: BAN USER
// ================================
exports.banUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    if (req.user.isShadowBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Shadow banned users cannot perform this action' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.isFounder) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder cannot be banned' 
      });
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedBy = req.user._id;
    user.banReason = req.body.reason || 'No reason provided';
    
    user.adminActions.push({
      actionType: 'BAN_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} banned ${user.name}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been banned`, 
      user 
    });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: UNBAN USER
// ================================
exports.unbanUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    if (req.user.isShadowBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Shadow banned users cannot perform this action' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isBanned = false;
    user.bannedAt = null;
    user.bannedBy = null;
    user.banReason = null;
    
    user.adminActions.push({
      actionType: 'UNBAN_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} unbanned ${user.name}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been unbanned`, 
      user 
    });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: VERIFY USER
// ================================
exports.verifyUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifiedBy = req.user._id;
    
    user.adminActions.push({
      actionType: 'VERIFY_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} verified ${user.name}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been verified`, 
      user 
    });
  } catch (err) {
    console.error('Verify user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: UNVERIFY USER
// ================================
exports.unverifyUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isVerified = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
    
    user.adminActions.push({
      actionType: 'UNVERIFY_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} unverified ${user.name}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been unverified`, 
      user 
    });
  } catch (err) {
    console.error('Unverify user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: DEACTIVATE USER
// ================================
exports.deactivateUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    user.deactivationReason = req.body.reason || 'Deactivated by admin';
    
    user.adminActions.push({
      actionType: 'DEACTIVATE_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} deactivated ${user.name}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been deactivated`, 
      user 
    });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: ACTIVATE USER
// ================================
exports.activateUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isDeactivated = false;
    user.deactivatedAt = null;
    user.deactivationReason = null;
    
    user.adminActions.push({
      actionType: 'ACTIVATE_USER',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} activated ${user.name}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been activated`, 
      user 
    });
  } catch (err) {
    console.error('Activate user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: SHADOW BAN USER
// ================================
exports.applyShadowBanUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const { reason = '', countries = [], continents = [] } = req.body;

    user.isShadowBanned = true;
    user.shadowBannedCountries = countries;
    user.shadowBannedContinents = continents;
    user.shadowBanAppliedBy = req.user._id;
    user.shadowBanAppliedAt = new Date();
    
    user.adminActions.push({
      actionType: 'SHADOW_BAN',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} shadow banned ${user.name}`,
      performedBy: req.user._id,
      details: { reason, countries, continents }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.name} has been shadow banned`, 
      user 
    });
  } catch (err) {
    console.error('Shadow ban user error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// ADMIN: REMOVE SHADOW BAN
// ================================
exports.removeShadowBanUser = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isShadowBanned = false;
    user.shadowBannedCountries = [];
    user.shadowBannedContinents = [];
    user.shadowBanAppliedBy = null;
    user.shadowBanAppliedAt = null;
    
    user.adminActions.push({
      actionType: 'UNSHADOW_BAN',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} removed shadow ban from ${user.name}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `Shadow ban removed from ${user.name}`, 
      user 
    });
  } catch (err) {
    console.error('Remove shadow ban error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ================================
// GENERATE JWT
// ================================
exports.generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role,
      tokenVersion: user.tokenVersion || 0
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '30d' }
  );
};