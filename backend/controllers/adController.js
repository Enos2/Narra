/**
 * File: backend/controllers/adController.js
 * Description: Complete ad management controller with age-based targeting
 */

const Ad = require('../models/Ad');
const AdImpression = require('../models/AdImpression');
const AdRevenue = require('../models/AdRevenue');
const User = require('../models/User');
const Video = require('../models/Video');
const mongoose = require('mongoose');

/* ======================================================
   HELPER FUNCTIONS
====================================================== */

/**
 * Calculate user age from dateOfBirth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Get client IP from request
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.ip;
};

/**
 * Log admin action (matching your existing pattern)
 */
const logAdminAction = async ({ admin, actionType, targetId, description, metadata = {} }) => {
  try {
    // You can integrate with your existing AdminActionLog here
    console.log(`[ADMIN ACTION] ${admin.email} - ${actionType} - ${description}`);
    
    // If you have an admin audit log model, you can log there
    // const AdminActionLog = require('../models/AdminActionLog');
    // await AdminActionLog.create({ ... });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

/* ======================================================
   PUBLIC ROUTES
====================================================== */

/**
 * GET /api/ads/active
 * Get active ads for current user based on age and targeting
 */
exports.getActiveAds = async (req, res) => {
  try {
    const { placement, limit = 5, videoId } = req.query;
    
    let user = null;
    if (req.user) {
      user = await User.findById(req.user._id);
    }
    
    // Get eligible ads
    const query = {
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      isDeleted: false,
      remainingBudget: { $gt: 0 }
    };
    
    // Filter by placement if specified
    if (placement) {
      query.placement = placement;
    }
    
    // Age-based filtering
    if (user && user.dateOfBirth) {
      const userAge = calculateAge(user.dateOfBirth);
      
      // Build age rating filter based on user age
      const allowedRatings = ['G', 'ALL'];
      if (userAge >= 8) allowedRatings.push('PG');
      if (userAge >= 13) allowedRatings.push('PG-13', '13+');
      if (userAge >= 16) allowedRatings.push('16+');
      if (userAge >= 18) allowedRatings.push('18+');
      
      query.ageRating = { $in: allowedRatings };
      
      // Age range targeting
      if (userAge !== null) {
        query.$and = [
          { $or: [{ minAge: null }, { minAge: { $lte: userAge } }] },
          { $or: [{ maxAge: null }, { maxAge: { $gte: userAge } }] }
        ];
      }
      
      // Gender targeting
      if (user.gender && user.gender !== 'all') {
        query.$or = [
          { targetGender: 'all' },
          { targetGender: user.gender }
        ];
      }
      
      // Country targeting
      if (user.country) {
        query.$or = [
          { targetCountries: { $in: [user.country] } },
          { targetCountries: { $size: 0 } },
          { targetCountries: null }
        ];
      }
      
      // Continent targeting
      if (user.continent) {
        query.$or = [
          { targetContinents: { $in: [user.continent] } },
          { targetContinents: { $size: 0 } },
          { targetContinents: null }
        ];
      }
    } else {
      // Non-logged in users only see G and PG ads
      query.ageRating = { $in: ['G', 'PG', 'ALL'] };
    }
    
    // Get ads, prioritize by CTR and remaining budget
    const ads = await Ad.find(query)
      .sort({ ctr: -1, remainingBudget: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name email');
    
    // Format response (remove sensitive budget info for public)
    const formattedAds = ads.map(ad => ({
      _id: ad._id,
      title: ad.title,
      description: ad.description,
      type: ad.type,
      placement: ad.placement,
      mediaUrl: ad.mediaUrl,
      thumbnailUrl: ad.thumbnailUrl,
      targetUrl: ad.targetUrl,
      ageRating: ad.ageRating
    }));
    
    res.json({
      success: true,
      ads: formattedAds
    });
    
  } catch (err) {
    console.error('Get active ads error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * GET /api/ads/:id
 * Get public info for a specific ad
 */
exports.getAdById = async (req, res) => {
  try {
    const ad = await Ad.findOne({
      _id: req.params.id,
      status: 'active',
      isDeleted: false
    }).populate('createdBy', 'name');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    res.json({
      success: true,
      ad: {
        _id: ad._id,
        title: ad.title,
        description: ad.description,
        type: ad.type,
        mediaUrl: ad.mediaUrl,
        thumbnailUrl: ad.thumbnailUrl,
        targetUrl: ad.targetUrl,
        ageRating: ad.ageRating
      }
    });
    
  } catch (err) {
    console.error('Get ad by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad'
    });
  }
};

/* ======================================================
   TRACKING ROUTES
====================================================== */

/**
 * POST /api/ads/:id/impression
 * Track when an ad is shown
 */
exports.trackImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const { videoId, placement, watchedSeconds = 0, completed = false } = req.body;
    
    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Check if this is a unique impression for this user/session
    let isUnique = true;
    
    if (req.user) {
      // Check if user has seen this ad before
      const existing = await AdImpression.findOne({
        adId: id,
        userId: req.user._id
      });
      isUnique = !existing;
    } else {
      // Use session ID from request (you'd need to pass this from frontend)
      const sessionId = req.body.sessionId || req.headers['x-session-id'];
      if (sessionId) {
        const existing = await AdImpression.findOne({
          adId: id,
          sessionId
        });
        isUnique = !existing;
      }
    }
    
    // Create impression record
    const impression = new AdImpression({
      adId: id,
      userId: req.user?._id,
      sessionId: req.body.sessionId,
      placement,
      videoId,
      viewedAt: new Date(),
      watchedSeconds,
      completed,
      userAge: req.user?.dateOfBirth ? calculateAge(req.user.dateOfBirth) : null,
      userCountry: req.user?.country,
      userContinent: req.user?.continent,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      isUnique
    });
    
    await impression.save();
    
    // Update ad statistics
    await ad.trackImpression(req.user?._id, isUnique);
    
    res.json({
      success: true,
      message: 'Impression tracked',
      isUnique
    });
    
  } catch (err) {
    console.error('Track impression error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to track impression'
    });
  }
};

/**
 * POST /api/ads/:id/click
 * Track when user clicks an ad
 */
exports.trackClick = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Find the most recent impression for this user
    let impression;
    
    if (req.user) {
      impression = await AdImpression.findOne({
        adId: id,
        userId: req.user._id,
        clicked: false
      }).sort({ viewedAt: -1 });
    } else {
      const sessionId = req.body.sessionId || req.headers['x-session-id'];
      if (sessionId) {
        impression = await AdImpression.findOne({
          adId: id,
          sessionId,
          clicked: false
        }).sort({ viewedAt: -1 });
      }
    }
    
    if (impression) {
      impression.clicked = true;
      impression.clickedAt = new Date();
      await impression.save();
    }
    
    // Check if this is a unique click
    let isUnique = true;
    if (req.user) {
      const existing = await AdImpression.findOne({
        adId: id,
        userId: req.user._id,
        clicked: true
      });
      isUnique = !existing;
    }
    
    // Update ad statistics
    await ad.trackClick(req.user?._id, isUnique);
    
    res.json({
      success: true,
      message: 'Click tracked',
      redirectUrl: ad.targetUrl
    });
    
  } catch (err) {
    console.error('Track click error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
};

/* ======================================================
   ADMIN ROUTES - AD MANAGEMENT
====================================================== */

/**
 * GET /api/ads/admin/all
 * Get all ads for admin with filters
 */
exports.getAllAds = async (req, res) => {
  try {
    const {
      status = 'all',
      type = 'all',
      search = '',
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = { isDeleted: false };
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (type !== 'all') {
      query.type = type;
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ];
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [ads, total] = await Promise.all([
      Ad.find(query)
        .populate('createdBy', 'name email role')
        .populate('approvedBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Ad.countDocuments(query)
    ]);
    
    // Add derived fields
    const formattedAds = ads.map(ad => ({
      ...ad,
      isActive: ad.status === 'active' && 
                new Date() >= ad.startDate && 
                new Date() <= ad.endDate &&
                ad.remainingBudget > 0,
      progress: ad.remainingBudget ? 
        ((ad.totalBudget - ad.remainingBudget) / ad.totalBudget) * 100 : 0
    }));
    
    res.json({
      success: true,
      ads: formattedAds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (err) {
    console.error('Get all ads error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads'
    });
  }
};

/**
 * GET /api/ads/admin/:id
 * Get ad for editing (full details)
 */
exports.getAdForEdit = async (req, res) => {
  try {
    const ad = await Ad.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('createdBy', 'name email role');
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    res.json({
      success: true,
      ad
    });
    
  } catch (err) {
    console.error('Get ad for edit error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad'
    });
  }
};

/**
 * POST /api/ads/admin/create
 * Create a new ad campaign
 */
exports.createAd = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      placement,
      targetUrl,
      ageRating,
      contentFlags,
      targetCountries,
      targetContinents,
      minAge,
      maxAge,
      targetGender,
      startDate,
      endDate,
      totalBudget,
      dailyBudget,
      currency,
      maxImpressionsPerUser,
      maxClicksPerUser,
      tags,
      notes
    } = req.body;
    
    // Validate required fields
    if (!title || !type || !placement || !targetUrl || !startDate || !endDate || !totalBudget) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Handle media files
    let mediaUrl = '';
    let thumbnailUrl = '';
    
    if (req.files) {
      if (req.files.video && req.files.video[0]) {
        mediaUrl = `/uploads/ads/videos/${req.files.video[0].filename}`;
      } else if (req.files.image && req.files.image[0]) {
        mediaUrl = `/uploads/ads/images/${req.files.image[0].filename}`;
      }
      
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        thumbnailUrl = `/uploads/ads/images/${req.files.thumbnail[0].filename}`;
      }
    }
    
    if (!mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Media file is required'
      });
    }
    
    // Parse JSON fields
    let parsedContentFlags = {};
    try {
      parsedContentFlags = contentFlags ? JSON.parse(contentFlags) : {
        violence: false,
        sex: false,
        language: false,
        graphic: false
      };
    } catch (err) {
      parsedContentFlags = {
        violence: false,
        sex: false,
        language: false,
        graphic: false
      };
    }
    
    let parsedTargetCountries = [];
    try {
      parsedTargetCountries = targetCountries ? JSON.parse(targetCountries) : [];
    } catch (err) {
      parsedTargetCountries = [];
    }
    
    let parsedTargetContinents = [];
    try {
      parsedTargetContinents = targetContinents ? JSON.parse(targetContinents) : [];
    } catch (err) {
      parsedTargetContinents = [];
    }
    
    let parsedTags = [];
    try {
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch (err) {
      parsedTags = [];
    }
    
    // Create ad
    const ad = new Ad({
      title,
      description,
      type,
      placement,
      mediaUrl,
      thumbnailUrl,
      targetUrl,
      ageRating: ageRating || 'ALL',
      contentFlags: parsedContentFlags,
      targetCountries: parsedTargetCountries,
      targetContinents: parsedTargetContinents,
      minAge: minAge ? parseInt(minAge) : null,
      maxAge: maxAge ? parseInt(maxAge) : null,
      targetGender: targetGender || 'all',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalBudget: parseFloat(totalBudget),
      dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
      currency: currency || 'USD',
      maxImpressionsPerUser: maxImpressionsPerUser ? parseInt(maxImpressionsPerUser) : 3,
      maxClicksPerUser: maxClicksPerUser ? parseInt(maxClicksPerUser) : 1,
      tags: parsedTags,
      notes,
      createdBy: req.user._id,
      status: 'pending' // Requires admin approval
    });
    
    await ad.save();
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'CREATE_AD',
      targetId: ad._id,
      description: `Created new ad campaign: ${title}`,
      metadata: { type, placement, budget: totalBudget }
    });
    
    res.status(201).json({
      success: true,
      message: 'Ad created successfully and pending approval',
      ad
    });
    
  } catch (err) {
    console.error('Create ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create ad',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * PUT /api/ads/admin/:id
 * Update an existing ad
 */
exports.updateAd = async (req, res) => {
  try {
    const ad = await Ad.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Check if ad can be edited (only pending or paused ads can be edited)
    if (!['pending', 'paused', 'rejected'].includes(ad.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending, paused, or rejected ads can be edited'
      });
    }
    
    const updatableFields = [
      'title', 'description', 'targetUrl', 'ageRating', 'contentFlags',
      'targetCountries', 'targetContinents', 'minAge', 'maxAge', 'targetGender',
      'startDate', 'endDate', 'totalBudget', 'dailyBudget', 'currency',
      'maxImpressionsPerUser', 'maxClicksPerUser', 'tags', 'notes'
    ];
    
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Parse JSON fields if needed
        if (field === 'contentFlags' && typeof req.body[field] === 'string') {
          try {
            ad[field] = JSON.parse(req.body[field]);
          } catch (err) {
            ad[field] = req.body[field];
          }
        } else if (field === 'targetCountries' && typeof req.body[field] === 'string') {
          try {
            ad[field] = JSON.parse(req.body[field]);
          } catch (err) {
            ad[field] = [];
          }
        } else if (field === 'targetContinents' && typeof req.body[field] === 'string') {
          try {
            ad[field] = JSON.parse(req.body[field]);
          } catch (err) {
            ad[field] = [];
          }
        } else if (field === 'tags' && typeof req.body[field] === 'string') {
          try {
            ad[field] = JSON.parse(req.body[field]);
          } catch (err) {
            ad[field] = [];
          }
        } else {
          ad[field] = req.body[field];
        }
      }
    });
    
    // Handle media updates
    if (req.files) {
      if (req.files.video && req.files.video[0]) {
        ad.mediaUrl = `/uploads/ads/videos/${req.files.video[0].filename}`;
      } else if (req.files.image && req.files.image[0]) {
        ad.mediaUrl = `/uploads/ads/images/${req.files.image[0].filename}`;
      }
      
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        ad.thumbnailUrl = `/uploads/ads/images/${req.files.thumbnail[0].filename}`;
      }
    }
    
    // Reset approval status if major changes
    const majorFields = ['title', 'targetUrl', 'mediaUrl', 'ageRating', 'totalBudget'];
    if (majorFields.some(field => req.body[field] !== undefined)) {
      ad.status = 'pending';
      ad.approved = false;
      ad.approvedBy = null;
      ad.approvedAt = null;
    }
    
    await ad.save();
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'UPDATE_AD',
      targetId: ad._id,
      description: `Updated ad campaign: ${ad.title}`
    });
    
    res.json({
      success: true,
      message: 'Ad updated successfully',
      ad
    });
    
  } catch (err) {
    console.error('Update ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update ad'
    });
  }
};

/**
 * PUT /api/ads/admin/:id/approve
 * Approve ad (Super Admin or Platform Admin)
 */
exports.approveAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    if (ad.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Ad is already active'
      });
    }
    
    await ad.approve(req.user._id);
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'APPROVE_AD',
      targetId: ad._id,
      description: `Approved ad campaign: ${ad.title}`
    });
    
    res.json({
      success: true,
      message: 'Ad approved and activated',
      ad
    });
    
  } catch (err) {
    console.error('Approve ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to approve ad'
    });
  }
};

/**
 * PUT /api/ads/admin/:id/reject
 * Reject ad (Super Admin or Platform Admin)
 */
exports.rejectAd = async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    await ad.reject(req.user._id, reason);
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'REJECT_AD',
      targetId: ad._id,
      description: `Rejected ad campaign: ${ad.title}`,
      metadata: { reason }
    });
    
    res.json({
      success: true,
      message: 'Ad rejected',
      ad
    });
    
  } catch (err) {
    console.error('Reject ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reject ad'
    });
  }
};

/**
 * PUT /api/ads/admin/:id/pause
 * Pause active ad campaign
 */
exports.pauseAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    if (ad.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active ads can be paused'
      });
    }
    
    await ad.pause(req.user._id);
    
    res.json({
      success: true,
      message: 'Ad paused',
      ad
    });
    
  } catch (err) {
    console.error('Pause ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to pause ad'
    });
  }
};

/**
 * PUT /api/ads/admin/:id/resume
 * Resume paused ad campaign
 */
exports.resumeAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    if (ad.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Only paused ads can be resumed'
      });
    }
    
    await ad.resume(req.user._id);
    
    res.json({
      success: true,
      message: 'Ad resumed',
      ad
    });
    
  } catch (err) {
    console.error('Resume ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to resume ad'
    });
  }
};

/**
 * DELETE /api/ads/admin/:id
 * Soft delete ad (Super Admin only)
 */
exports.deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    if (ad.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Ad is already deleted'
      });
    }
    
    await ad.softDelete(req.user._id);
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'DELETE_AD',
      targetId: ad._id,
      description: `Soft deleted ad campaign: ${ad.title}`
    });
    
    res.json({
      success: true,
      message: 'Ad soft deleted'
    });
    
  } catch (err) {
    console.error('Delete ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ad'
    });
  }
};

/**
 * DELETE /api/ads/admin/:id/permanent
 * Permanently delete ad (Super Admin only)
 */
exports.permanentDeleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    // Delete all related impressions and revenue records
    await Promise.all([
      AdImpression.deleteMany({ adId: ad._id }),
      AdRevenue.deleteMany({ adId: ad._id }),
      Ad.findByIdAndDelete(ad._id)
    ]);
    
    // Log admin action
    await logAdminAction({
      admin: req.user,
      actionType: 'PERMANENT_DELETE_AD',
      targetId: ad._id,
      description: `Permanently deleted ad campaign: ${ad.title}`
    });
    
    res.json({
      success: true,
      message: 'Ad permanently deleted'
    });
    
  } catch (err) {
    console.error('Permanent delete ad error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete ad'
    });
  }
};

/* ======================================================
   ANALYTICS ROUTES
====================================================== */

/**
 * GET /api/ads/admin/:id/analytics
 * Get detailed analytics for a specific ad
 */
exports.getAdAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'week' } = req.query;
    
    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }
    
    const now = new Date();
    let startDate;
    
    switch(period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }
    
    // Get impression stats
    const impressions = await AdImpression.find({
      adId: id,
      viewedAt: { $gte: startDate }
    });
    
    const totalImpressions = impressions.length;
    const uniqueImpressions = await AdImpression.getUniqueImpressions(id, startDate);
    const clicks = impressions.filter(i => i.clicked).length;
    const ctr = totalImpressions > 0 ? (clicks / totalImpressions) * 100 : 0;
    
    // Get hourly breakdown for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hourlyBreakdown = await AdImpression.getHourlyBreakdown(id, today);
    
    // Get top videos where ad was shown
    const topVideos = await AdImpression.aggregate([
      {
        $match: {
          adId: mongoose.Types.ObjectId(id),
          videoId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$videoId',
          impressions: { $sum: 1 },
          clicks: { $sum: { $cond: ['$clicked', 1, 0] } }
        }
      },
      { $sort: { impressions: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video'
        }
      },
      {
        $project: {
          videoTitle: { $arrayElemAt: ['$video.title', 0] },
          impressions: 1,
          clicks: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      analytics: {
        period,
        summary: {
          totalImpressions,
          uniqueImpressions,
          clicks,
          ctr,
          spentAmount: ad.spentAmount,
          remainingBudget: ad.remainingBudget,
          progress: ad.progress
        },
        hourlyBreakdown,
        topVideos
      }
    });
    
  } catch (err) {
    console.error('Get ad analytics error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};

/**
 * GET /api/ads/admin/analytics/overview
 * Get overall ad analytics (Super Admin only)
 */
exports.getOverallAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const analytics = await Ad.getAnalytics(period);
    
    // Get top performing ads
    const topAds = await Ad.find({ status: 'active', isDeleted: false })
      .sort({ ctr: -1, impressions: -1 })
      .limit(5)
      .select('title type impressions clicks ctr spentAmount')
      .lean();
    
    // Get revenue summary
    const revenueSummary = await AdRevenue.aggregate([
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: '$totalRevenue' },
          creatorEarnings: { $sum: '$creatorEarnings' },
          platformEarnings: { $sum: '$platformEarnings' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      analytics: {
        ...analytics,
        topAds,
        revenue: revenueSummary
      }
    });
    
  } catch (err) {
    console.error('Get overall analytics error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overall analytics'
    });
  }
};

/**
 * GET /api/ads/analytics/creator-earnings
 * Get earnings for the current creator
 */
exports.getCreatorEarnings = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { period = 'all' } = req.query;
    
    let startDate;
    const now = new Date();
    
    if (period !== 'all') {
      switch(period) {
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = null;
      }
    }
    
    const earnings = await AdRevenue.getCreatorEarnings(
      req.user._id,
      startDate,
      period === 'all' ? null : new Date()
    );
    
    // Get recent payments
    const recentPayments = await AdRevenue.find({
      creatorId: req.user._id,
      status: 'paid'
    })
      .sort({ paidAt: -1 })
      .limit(10)
      .populate('adId', 'title')
      .lean();
    
    res.json({
      success: true,
      earnings,
      recentPayments
    });
    
  } catch (err) {
    console.error('Get creator earnings error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings'
    });
  }
};

/**
 * GET /api/ads/admin/stats/summary
 * Get quick stats for admin dashboard
 */
exports.getAdStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    
    const [
      totalAds,
      activeAds,
      pendingAds,
      totalImpressionsToday,
      totalClicksToday,
      totalRevenueToday
    ] = await Promise.all([
      Ad.countDocuments({ isDeleted: false }),
      Ad.countDocuments({ 
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now },
        isDeleted: false,
        remainingBudget: { $gt: 0 }
      }),
      Ad.countDocuments({ status: 'pending', isDeleted: false }),
      AdImpression.countDocuments({ viewedAt: { $gte: startOfToday } }),
      AdImpression.countDocuments({ 
        clicked: true,
        clickedAt: { $gte: startOfToday }
      }),
      AdRevenue.aggregate([
        {
          $match: {
            paidAt: { $gte: startOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalRevenue' }
          }
        }
      ])
    ]);
    
    res.json({
      success: true,
      stats: {
        totalAds,
        activeAds,
        pendingAds,
        today: {
          impressions: totalImpressionsToday,
          clicks: totalClicksToday,
          ctr: totalImpressionsToday > 0 ? 
            (totalClicksToday / totalImpressionsToday) * 100 : 0,
          revenue: totalRevenueToday[0]?.total || 0
        }
      }
    });
    
  } catch (err) {
    console.error('Get ad stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad stats'
    });
  }
};