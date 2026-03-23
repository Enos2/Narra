/**
 * File: backend/routes/searchRoutes.js
 * Description: Unified search endpoint for videos and users
 * FIXED: Removed accidental code injection
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Video = require('../models/Video');

/**
 * GET /api/search
 * Unified search for videos and users
 * Query params:
 *   q - search query (required, min 2 chars)
 *   limit - max results per category (default: 10)
 */
router.get('/', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    // Validate search query
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        videos: [],
        users: [],
        total: 0
      });
    }
    
    const searchTerm = q.trim();
    // Escape special regex characters to prevent injection
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearchTerm, 'i');
    const maxLimit = Math.min(parseInt(limit), 20); // Cap at 20 per category
    
    // Search videos - only released, non-deleted videos
    const videos = await Video.find({
      status: 'released',
      isDeleted: false,
      isShadowBanned: false,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { genre: searchRegex }
      ]
    })
    .populate('creator', 'firstName lastName username email avatar isVerified')
    .sort({ views: -1, uploadedAt: -1 }) // Most viewed first, then newest
    .limit(maxLimit)
    .lean();
    
    // Search users - EXCLUDE ADMINS, only regular users
    // Admin roles: superadmin, platformadmin, supportadmin
    const users = await User.find({
      isDeleted: false,
      isBanned: false,
      role: { $nin: ['superadmin', 'platformadmin', 'supportadmin'] }, // EXCLUDE ADMINS
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { username: searchRegex }
        // DO NOT search by email - privacy concern
      ]
    })
    .select('firstName lastName username avatar isVerified role followerCount')
    .sort({ followerCount: -1, createdAt: -1 }) // Most followers first
    .limit(maxLimit)
    .lean();
    
    // Format video results
    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      type: video.type,
      ageRating: video.ageRating,
      views: video.views || 0,
      creator: video.creator ? {
        _id: video.creator._id,
        name: video.creator.fullName || video.creator.username,
        avatar: video.creator.avatar,
        isVerified: video.creator.isVerified
      } : null,
      status: video.status
    }));
    
    // Format user results
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.fullName || user.username,
      username: user.username,
      avatar: user.avatar,
      isVerified: user.isVerified,
      followerCount: user.followerCount || 0
    }));
    
    res.json({
      success: true,
      videos: formattedVideos,
      users: formattedUsers,
      total: formattedVideos.length + formattedUsers.length
    });
    
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      videos: [],
      users: [],
      total: 0
    });
  }
});

module.exports = router;