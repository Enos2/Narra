/**
 * File: backend/controllers/userController.js
 * Description: Handles user profile, admin actions, RBAC, shadow ban, search, JWT
 * UPDATED: Added enhanced profile updates with firstName, lastName, middleName, username, gender
 * ADDED: Follow/unfollow functionality with twin detection
 * ADDED: Get following content feed to fetch videos from followed users
 */

const mongoose = require('mongoose');
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
      .populate('followers', 'firstName lastName username avatar isVerified')
      .populate('following', 'firstName lastName username avatar isVerified')
      .populate('twins', 'firstName lastName username avatar isVerified');
      
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const userObject = user.toObject();
    userObject.followerCount = user.followers.length;
    userObject.followingCount = user.following.length;
    userObject.twinCount = user.twins.length;
    userObject.profileComplete = !!(user.avatar && user.bio && user.location);
    userObject.name = user.fullName;
    userObject.formattedAccountAge = user.getFormattedAccountAge();

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
// UPDATE PROFILE (ENHANCED with new fields)
// ================================
exports.updateProfile = async (req, res) => {
  try {
    const { 
      firstName,
      lastName,
      middleName,
      username,
      email, 
      password, 
      currentPassword,
      bio, 
      location, 
      website,
      phoneNumber,
      avatar,
      gender,
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

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      user.lastPasswordChange = new Date();
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    if (firstName) {
      if (firstName.length < 2) {
        return res.status(400).json({ 
          success: false, 
          message: 'First name must be at least 2 characters' 
        });
      }
      user.firstName = firstName;
    }
    
    if (lastName) {
      if (lastName.length < 2) {
        return res.status(400).json({ 
          success: false, 
          message: 'Last name must be at least 2 characters' 
        });
      }
      user.lastName = lastName;
    }
    
    if (middleName !== undefined) user.middleName = middleName;
    
    if (username && username !== user.username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores' 
        });
      }
      
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(), 
        _id: { $ne: user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username already taken' 
        });
      }
      user.username = username.toLowerCase();
    }
    
    if (email && email !== user.email) {
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
    if (gender !== undefined) user.gender = gender;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (avatar !== undefined) user.avatar = avatar;

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

    const updatedUser = await User.findById(user._id)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret -loginHistory')
      .populate('followers', 'firstName lastName username avatar isVerified')
      .populate('following', 'firstName lastName username avatar isVerified')
      .populate('twins', 'firstName lastName username avatar isVerified');

    const userObject = updatedUser.toObject();
    userObject.followerCount = updatedUser.followers.length;
    userObject.followingCount = updatedUser.following.length;
    userObject.twinCount = updatedUser.twins.length;
    userObject.name = updatedUser.fullName;
    userObject.formattedAccountAge = updatedUser.getFormattedAccountAge();

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
// CHECK USERNAME AVAILABILITY
// ================================
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.json({ available: true });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase(),
      _id: { $ne: req.user?._id }
    });
    
    res.json({ available: !existingUser });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check username' 
    });
  }
};

// ================================
// GET UPLOAD STATUS (QUOTA)
// ================================
exports.getUploadStatus = async (req, res) => {
  try {
    const Video = require('../models/Video');
    
    const videoCount = await Video.countDocuments({ 
      user: req.user._id, 
      isDeleted: false 
    });
    
    const quotaGB = req.user.role === 'creator' ? 100 : 10;
    const currentStorageGB = Math.min(Math.floor(videoCount * 0.1), quotaGB);
    
    res.json({
      success: true,
      quota: {
        quotaGB,
        currentStorageGB,
        maxVideos: req.user.role === 'creator' ? 1000 : 100,
        currentVideos: videoCount
      }
    });
  } catch (err) {
    console.error('Get upload status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get upload status' 
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

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (targetUser.isBanned || targetUser.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'Cannot follow this user'
      });
    }

    if (targetUser.privacySettings?.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This user has a private profile'
      });
    }

    const currentUser = await User.findById(currentUserId);

    if (currentUser.following.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    currentUser.following.push(userId);
    await currentUser.save();

    targetUser.followers.push(currentUserId);
    
    const isTwin = targetUser.following.includes(currentUserId);
    if (isTwin) {
      if (!currentUser.twins.includes(userId)) {
        currentUser.twins.push(userId);
        await currentUser.save();
      }
      if (!targetUser.twins.includes(currentUserId)) {
        targetUser.twins.push(currentUserId);
      }
      
      targetUser.notifications.push({
        type: 'follow',
        message: `${currentUser.fullName} started following you back! You are now twins! 🎉`,
        relatedId: currentUserId,
        relatedModel: 'User'
      });
    } else {
      targetUser.notifications.push({
        type: 'follow',
        message: `${currentUser.fullName} started following you`,
        relatedId: currentUserId,
        relatedModel: 'User'
      });
    }

    await targetUser.save();

    await currentUser.populate('following', 'firstName lastName username avatar isVerified');
    await currentUser.populate('twins', 'firstName lastName username avatar isVerified');

    res.status(200).json({
      success: true,
      message: isTwin 
        ? `You and ${targetUser.fullName} are now twins! 🎉` 
        : `You are now following ${targetUser.fullName}`,
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

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!currentUser.following.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userId
    );

    if (currentUser.twins.includes(userId)) {
      currentUser.twins = currentUser.twins.filter(
        id => id.toString() !== userId
      );
    }

    await currentUser.save();

    targetUser.followers = targetUser.followers.filter(
      id => id.toString() !== currentUserId.toString()
    );

    if (targetUser.twins.includes(currentUserId)) {
      targetUser.twins = targetUser.twins.filter(
        id => id.toString() !== currentUserId.toString()
      );
    }

    targetUser.notifications.push({
      type: 'follow',
      message: `${currentUser.fullName} unfollowed you`,
      relatedId: currentUserId,
      relatedModel: 'User'
    });

    await targetUser.save();

    await currentUser.populate('following', 'firstName lastName username avatar isVerified');
    await currentUser.populate('twins', 'firstName lastName username avatar isVerified');

    res.status(200).json({
      success: true,
      message: `You have unfollowed ${targetUser.fullName}`,
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

    if (!user.privacySettings?.showFollowers && 
        (!currentUserId || currentUserId.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden their followers'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const followers = await User.find({
      _id: { $in: user.followers }
    })
    .select('firstName lastName username avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    let followersWithStatus = followers;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      followersWithStatus = followers.map(f => {
        const fObj = f.toObject();
        return {
          ...fObj,
          name: fObj.fullName || `${fObj.firstName} ${fObj.lastName}`,
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

    if (!user.privacySettings?.showFollowing && 
        (!currentUserId || currentUserId.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden who they follow'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const following = await User.find({
      _id: { $in: user.following }
    })
    .select('firstName lastName username avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    let followingWithStatus = following;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      followingWithStatus = following.map(f => {
        const fObj = f.toObject();
        return {
          ...fObj,
          name: fObj.fullName || `${fObj.firstName} ${fObj.lastName}`,
          isFollowing: true,
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

    if (!user.privacySettings?.showFollowers && 
        (!currentUserId || currentUserId.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'This user has hidden their twins'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const twins = await User.find({
      _id: { $in: user.twins }
    })
    .select('firstName lastName username avatar bio isVerified followerCount createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    let twinsWithStatus = twins;
    if (currentUserId && currentUserId.toString() !== userId) {
      const currentUser = await User.findById(currentUserId);
      twinsWithStatus = twins.map(t => {
        const tObj = t.toObject();
        return {
          ...tObj,
          name: tObj.fullName || `${tObj.firstName} ${tObj.lastName}`,
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
// GET CONTENT FROM FOLLOWED USERS
// ================================
exports.getFollowingContent = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const followedUserIds = currentUser.following;

    if (followedUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        videos: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    const Video = mongoose.model('Video');
    const Live = mongoose.model('Live');
    
    let videoQuery = {
      user: { $in: followedUserIds },
      isDeleted: false,
      $or: [
        { status: 'released' },
        { status: 'live' }
      ]
    };

    if (type === 'video') {
      videoQuery.type = { $in: ['movie', 'series'] };
    } else if (type === 'live') {
      videoQuery.status = 'live';
    }

    const videos = await Video.find(videoQuery)
      .populate('user', 'firstName lastName username avatar isVerified')
      .sort({ createdAt: -1, isLive: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Video.countDocuments(videoQuery);

    let lives = [];
    if (!type || type === 'live') {
      lives = await Live.find({
        user: { $in: followedUserIds },
        status: 'live',
        isDeleted: false
      })
      .populate('user', 'firstName lastName username avatar isVerified')
      .sort({ startedAt: -1 });
    }

    let allContent = [...videos];
    
    if (lives.length > 0) {
      const liveContent = lives.map(live => ({
        _id: live._id,
        title: live.title,
        description: live.description,
        thumbnailUrl: live.thumbnailUrl,
        status: 'live',
        type: 'live',
        isLive: true,
        user: live.user,
        viewerCount: live.viewerCount,
        startedAt: live.startedAt,
        createdAt: live.createdAt
      }));
      
      allContent = [...liveContent, ...videos];
      allContent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const formattedContent = allContent.map(item => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      thumbnailUrl: item.thumbnailUrl,
      status: item.status || (item.isLive ? 'live' : 'released'),
      type: item.type || 'video',
      isLive: item.isLive || false,
      creator: item.user,
      uploader: item.user?.fullName || item.user?.username || 'Unknown',
      uploaderAvatar: item.user?.avatar,
      viewerCount: item.viewerCount,
      views: item.views,
      createdAt: item.createdAt,
      isPaid: item.isPaid || false,
      price: item.price
    }));

    res.status(200).json({
      success: true,
      videos: formattedContent,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Get following content error:', err);
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
        name: targetUser.fullName,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        username: targetUser.username,
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
    .select('firstName lastName username avatar bio isVerified followerCount createdAt');

    const suggestionsWithStatus = suggestions.map(s => {
      const sObj = s.toObject();
      return {
        ...sObj,
        name: sObj.fullName || `${sObj.firstName} ${sObj.lastName}`,
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
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } }
          ]
        },
        { isBanned: false },
        { isDeleted: false }
      ]
    };

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
      .select('firstName lastName username avatar bio isVerified followerCount location privacySettings')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ followerCount: -1 });

    const total = await User.countDocuments(filter);

    let usersWithStatus = users;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      usersWithStatus = users.map(u => {
        const uObj = u.toObject();
        return {
          ...uObj,
          name: uObj.fullName || `${uObj.firstName} ${uObj.lastName}`,
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

    if (user.privacySettings?.profileVisibility === 'private') {
      if (!currentUserId || currentUserId.toString() !== id) {
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
    userObject.name = user.fullName;
    userObject.formattedAccountAge = user.getFormattedAccountAge();

    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      userObject.isFollowing = currentUser.following.includes(user._id);
      userObject.isFollowedBy = currentUser.followers.includes(user._id);
      userObject.isTwin = currentUser.twins.includes(user._id);
    }

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
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -passwordResetToken -passwordResetExpires -twoFactorSecret')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    const usersWithName = users.map(u => {
      const uObj = u.toObject();
      uObj.name = u.fullName;
      return uObj;
    });

    res.status(200).json({ 
      success: true, 
      users: usersWithName,
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

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = userId;
    user.deleteReason = 'User requested deletion';
    user.email = `deleted_${user._id}_${user.email}`;
    user.firstName = 'Deleted';
    user.lastName = 'User';
    user.username = `deleted_${user._id}`;
    
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
      description: `${req.user.fullName} banned ${user.fullName}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been banned`, 
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
      description: `${req.user.fullName} unbanned ${user.fullName}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been unbanned`, 
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
      description: `${req.user.fullName} verified ${user.fullName}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been verified`, 
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
      description: `${req.user.fullName} unverified ${user.fullName}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been unverified`, 
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
      description: `${req.user.fullName} deactivated ${user.fullName}`,
      performedBy: req.user._id,
      details: { reason: req.body.reason }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been deactivated`, 
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
      description: `${req.user.fullName} activated ${user.fullName}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been activated`, 
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
      description: `${req.user.fullName} shadow banned ${user.fullName}`,
      performedBy: req.user._id,
      details: { reason, countries, continents }
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `${user.fullName} has been shadow banned`, 
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
      description: `${req.user.fullName} removed shadow ban from ${user.fullName}`,
      performedBy: req.user._id
    });

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `Shadow ban removed from ${user.fullName}`, 
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