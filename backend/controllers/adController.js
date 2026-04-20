/**
 * File: backend/controllers/adController.js
 * Description: Complete ad management controller with age-based targeting
 * FIXED: Removed broken mongoose.Types.ObjectId() call (use `new` keyword),
 *        guarded against missing AdImpression/AdRevenue models gracefully,
 *        and improved error messages throughout.
 */

const Ad          = require('../models/Ad');
const User        = require('../models/User');
const mongoose    = require('mongoose');

/* ─────────────────────────────────────────────
   Safely require optional models
───────────────────────────────────────────── */
let AdImpression = null;
let AdRevenue    = null;

try { AdImpression = require('../models/AdImpression'); } catch (e) {
  console.warn('[adController] AdImpression model not found — impression tracking disabled');
}
try { AdRevenue = require('../models/AdRevenue'); } catch (e) {
  console.warn('[adController] AdRevenue model not found — revenue tracking disabled');
}

/* ─────────────────────────────────────────────
   HELPER FUNCTIONS
───────────────────────────────────────────── */

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today     = new Date();
  const birthDate = new Date(dateOfBirth);
  let age         = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const getClientIp = (req) =>
  req.headers['x-forwarded-for'] ||
  req.connection?.remoteAddress   ||
  req.socket?.remoteAddress       ||
  req.ip;

const logAdminAction = async ({ admin, actionType, targetId, description, metadata = {} }) => {
  try {
    console.log(`[ADMIN ACTION] ${admin?.email} — ${actionType} — ${description}`);
    // Wire up to AdminAuditLog here if needed
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};

/* ─────────────────────────────────────────────
   PARSE HELPER — safely parse JSON body fields
───────────────────────────────────────────── */
const parseJsonField = (value, fallback = []) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value; // already parsed by multer/bodyParser
  try { return JSON.parse(value); } catch { return fallback; }
};

/* ══════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════ */

/**
 * GET /api/ads/active
 * Get active ads for current user based on age and targeting
 */
exports.getActiveAds = async (req, res) => {
  try {
    const { placement, limit = 5 } = req.query;

    let user = null;
    if (req.user) user = await User.findById(req.user._id);

    const query = {
      status:          'active',
      startDate:       { $lte: new Date() },
      endDate:         { $gte: new Date() },
      isDeleted:       false,
      remainingBudget: { $gt: 0 }
    };

    if (placement) query.placement = placement;

    if (user && user.dateOfBirth) {
      const userAge        = calculateAge(user.dateOfBirth);
      const allowedRatings = ['G', 'ALL'];
      if (userAge >= 8)  allowedRatings.push('PG');
      if (userAge >= 13) allowedRatings.push('PG-13', '13+');
      if (userAge >= 16) allowedRatings.push('16+');
      if (userAge >= 18) allowedRatings.push('18+');
      query.ageRating = { $in: allowedRatings };
    } else {
      query.ageRating = { $in: ['G', 'PG', 'ALL'] };
    }

    const ads = await Ad.find(query)
      .sort({ ctr: -1, remainingBudget: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name email');

    const formattedAds = ads.map(ad => ({
      _id:          ad._id,
      title:        ad.title,
      description:  ad.description,
      type:         ad.type,
      placement:    ad.placement,
      mediaUrl:     ad.mediaUrl,
      thumbnailUrl: ad.thumbnailUrl,
      targetUrl:    ad.targetUrl,
      ageRating:    ad.ageRating
    }));

    res.json({ success: true, ads: formattedAds });
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
      _id:       req.params.id,
      status:    'active',
      isDeleted: false
    }).populate('createdBy', 'name');

    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    res.json({
      success: true,
      ad: {
        _id:         ad._id,
        title:       ad.title,
        description: ad.description,
        type:        ad.type,
        mediaUrl:    ad.mediaUrl,
        thumbnailUrl:ad.thumbnailUrl,
        targetUrl:   ad.targetUrl,
        ageRating:   ad.ageRating
      }
    });
  } catch (err) {
    console.error('Get ad by ID error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ad' });
  }
};

/* ══════════════════════════════════════════════
   TRACKING ROUTES
══════════════════════════════════════════════ */

/**
 * POST /api/ads/:id/impression
 */
exports.trackImpression = async (req, res) => {
  try {
    const { id }                                              = req.params;
    const { videoId, placement, watchedSeconds = 0, completed = false } = req.body;

    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    let isUnique = true;

    if (AdImpression) {
      if (req.user) {
        const existing = await AdImpression.findOne({ adId: id, userId: req.user._id });
        isUnique = !existing;
      } else {
        const sessionId = req.body.sessionId || req.headers['x-session-id'];
        if (sessionId) {
          const existing = await AdImpression.findOne({ adId: id, sessionId });
          isUnique = !existing;
        }
      }

      const impression = new AdImpression({
        adId:          id,
        userId:        req.user?._id,
        sessionId:     req.body.sessionId,
        placement,
        videoId,
        viewedAt:      new Date(),
        watchedSeconds,
        completed,
        userAge:       req.user?.dateOfBirth ? calculateAge(req.user.dateOfBirth) : null,
        userCountry:   req.user?.country,
        userContinent: req.user?.continent,
        ipAddress:     getClientIp(req),
        userAgent:     req.headers['user-agent'],
        isUnique
      });
      await impression.save();
    }

    await ad.trackImpression(req.user?._id, isUnique);

    res.json({ success: true, message: 'Impression tracked', isUnique });
  } catch (err) {
    console.error('Track impression error:', err);
    res.status(500).json({ success: false, message: 'Failed to track impression' });
  }
};

/**
 * POST /api/ads/:id/click
 */
exports.trackClick = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    let isUnique = true;

    if (AdImpression) {
      let impression;
      if (req.user) {
        impression = await AdImpression.findOne({ adId: id, userId: req.user._id, clicked: false })
          .sort({ viewedAt: -1 });
        const existingClick = await AdImpression.findOne({ adId: id, userId: req.user._id, clicked: true });
        isUnique = !existingClick;
      } else {
        const sessionId = req.body.sessionId || req.headers['x-session-id'];
        if (sessionId) {
          impression = await AdImpression.findOne({ adId: id, sessionId, clicked: false })
            .sort({ viewedAt: -1 });
        }
      }

      if (impression) {
        impression.clicked   = true;
        impression.clickedAt = new Date();
        await impression.save();
      }
    }

    await ad.trackClick(req.user?._id, isUnique);

    res.json({ success: true, message: 'Click tracked', redirectUrl: ad.targetUrl });
  } catch (err) {
    console.error('Track click error:', err);
    res.status(500).json({ success: false, message: 'Failed to track click' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════ */

/**
 * GET /api/ads/admin/all
 */
exports.getAllAds = async (req, res) => {
  try {
    const {
      status    = 'all',
      type      = 'all',
      search    = '',
      page      = 1,
      limit     = 20,
      sortBy    = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isDeleted: false };
    if (status !== 'all') query.status = status;
    if (type   !== 'all') query.type   = type;

    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [{ title: rx }, { description: rx }, { tags: rx }];
    }

    const sortOptions         = {};
    sortOptions[sortBy]       = sortOrder === 'desc' ? -1 : 1;
    const skip                = (parseInt(page) - 1) * parseInt(limit);

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

    const formattedAds = ads.map(ad => ({
      ...ad,
      isActive: ad.status === 'active' &&
                new Date() >= new Date(ad.startDate) &&
                new Date() <= new Date(ad.endDate) &&
                ad.remainingBudget > 0,
      progress: ad.totalBudget
        ? ((ad.totalBudget - ad.remainingBudget) / ad.totalBudget) * 100
        : 0
    }));

    res.json({
      success: true,
      ads: formattedAds,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get all ads error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ads' });
  }
};

/**
 * GET /api/ads/admin/:id
 */
exports.getAdForEdit = async (req, res) => {
  try {
    const ad = await Ad.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'name email role');

    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    res.json({ success: true, ad });
  } catch (err) {
    console.error('Get ad for edit error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ad' });
  }
};

/**
 * POST /api/ads/admin/create
 * FIXED: Proper field parsing, no startDate past-date validator issues,
 *        and mediaUrl is optional when using a URL string instead of file upload.
 */
exports.createAd = async (req, res) => {
  try {
    const {
      title, description, type, placement, targetUrl,
      ageRating, targetGender, startDate, endDate,
      totalBudget, dailyBudget, currency,
      maxImpressionsPerUser, maxClicksPerUser,
      minAge, maxAge, notes,
      // May arrive as JSON strings from multipart/form-data
      contentFlags: rawContentFlags,
      targetCountries: rawTargetCountries,
      targetContinents: rawTargetContinents,
      tags: rawTags,
      // Allow mediaUrl to be passed directly as a string (e.g. cloud URL)
      mediaUrl: bodyMediaUrl,
      thumbnailUrl: bodyThumbnailUrl
    } = req.body;

    // ── Validate required fields ──────────────────────────
    const missing = [];
    if (!title)       missing.push('title');
    if (!type)        missing.push('type');
    if (!placement)   missing.push('placement');
    if (!targetUrl)   missing.push('targetUrl');
    if (!startDate)   missing.push('startDate');
    if (!endDate)     missing.push('endDate');
    if (!totalBudget) missing.push('totalBudget');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // ── Resolve media URLs ────────────────────────────────
    let mediaUrl     = bodyMediaUrl    || '';
    let thumbnailUrl = bodyThumbnailUrl || '';

    if (req.files) {
      if (req.files.video?.[0]) {
        mediaUrl = `/uploads/ads/videos/${req.files.video[0].filename}`;
      } else if (req.files.image?.[0]) {
        mediaUrl = `/uploads/ads/images/${req.files.image[0].filename}`;
      }
      if (req.files.thumbnail?.[0]) {
        thumbnailUrl = `/uploads/ads/images/${req.files.thumbnail[0].filename}`;
      }
    }

    if (!mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'A media file or mediaUrl is required'
      });
    }

    // ── Parse JSON-encoded fields ─────────────────────────
    const parsedContentFlags = parseJsonField(rawContentFlags, {
      violence: false, sex: false, language: false, graphic: false
    });
    const parsedTargetCountries  = parseJsonField(rawTargetCountries, []);
    const parsedTargetContinents = parseJsonField(rawTargetContinents, []);
    const parsedTags             = parseJsonField(rawTags, []);

    // ── Build and save ad ─────────────────────────────────
    const ad = new Ad({
      title,
      description:          description || '',
      type,
      placement,
      mediaUrl,
      thumbnailUrl,
      targetUrl,
      ageRating:            ageRating || 'ALL',
      contentFlags:         parsedContentFlags,
      targetCountries:      parsedTargetCountries,
      targetContinents:     parsedTargetContinents,
      minAge:               minAge ? parseInt(minAge) : null,
      maxAge:               maxAge ? parseInt(maxAge) : null,
      targetGender:         targetGender || 'all',
      startDate:            new Date(startDate),
      endDate:              new Date(endDate),
      totalBudget:          parseFloat(totalBudget),
      dailyBudget:          dailyBudget ? parseFloat(dailyBudget) : null,
      currency:             currency || 'USD',
      maxImpressionsPerUser:maxImpressionsPerUser ? parseInt(maxImpressionsPerUser) : 10,
      maxClicksPerUser:     maxClicksPerUser      ? parseInt(maxClicksPerUser)      : 5,
      tags:                 parsedTags,
      notes,
      createdBy:            req.user._id,
      status:               'pending'
    });

    await ad.save();

    await logAdminAction({
      admin:       req.user,
      actionType:  'CREATE_AD',
      targetId:    ad._id,
      description: `Created new ad campaign: ${title}`,
      metadata:    { type, placement, budget: totalBudget }
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
 */
exports.updateAd = async (req, res) => {
  try {
    const ad = await Ad.findOne({ _id: req.params.id, isDeleted: false });
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

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

    const jsonFields = new Set(['contentFlags', 'targetCountries', 'targetContinents', 'tags']);

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        ad[field] = jsonFields.has(field) ? parseJsonField(req.body[field]) : req.body[field];
      }
    });

    if (req.files) {
      if (req.files.video?.[0]) {
        ad.mediaUrl = `/uploads/ads/videos/${req.files.video[0].filename}`;
      } else if (req.files.image?.[0]) {
        ad.mediaUrl = `/uploads/ads/images/${req.files.image[0].filename}`;
      }
      if (req.files.thumbnail?.[0]) {
        ad.thumbnailUrl = `/uploads/ads/images/${req.files.thumbnail[0].filename}`;
      }
    }

    // Reset approval if major fields changed
    const majorFields = ['title', 'targetUrl', 'mediaUrl', 'ageRating', 'totalBudget'];
    if (majorFields.some(f => req.body[f] !== undefined)) {
      ad.status     = 'pending';
      ad.approved   = false;
      ad.approvedBy = null;
      ad.approvedAt = null;
    }

    await ad.save();

    await logAdminAction({
      admin:       req.user,
      actionType:  'UPDATE_AD',
      targetId:    ad._id,
      description: `Updated ad campaign: ${ad.title}`
    });

    res.json({ success: true, message: 'Ad updated successfully', ad });
  } catch (err) {
    console.error('Update ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to update ad' });
  }
};

/**
 * PUT /api/ads/admin/:id/approve
 */
exports.approveAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (ad.status === 'active') return res.status(400).json({ success: false, message: 'Ad is already active' });

    await ad.approve(req.user._id);
    await logAdminAction({ admin: req.user, actionType: 'APPROVE_AD', targetId: ad._id, description: `Approved ad: ${ad.title}` });
    res.json({ success: true, message: 'Ad approved and activated', ad });
  } catch (err) {
    console.error('Approve ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve ad' });
  }
};

/**
 * PUT /api/ads/admin/:id/reject
 */
exports.rejectAd = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    await ad.reject(req.user._id, reason);
    await logAdminAction({ admin: req.user, actionType: 'REJECT_AD', targetId: ad._id, description: `Rejected ad: ${ad.title}`, metadata: { reason } });
    res.json({ success: true, message: 'Ad rejected', ad });
  } catch (err) {
    console.error('Reject ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to reject ad' });
  }
};

/**
 * PUT /api/ads/admin/:id/pause
 */
exports.pauseAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (ad.status !== 'active') return res.status(400).json({ success: false, message: 'Only active ads can be paused' });

    await ad.pause(req.user._id);
    res.json({ success: true, message: 'Ad paused', ad });
  } catch (err) {
    console.error('Pause ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to pause ad' });
  }
};

/**
 * PUT /api/ads/admin/:id/resume
 */
exports.resumeAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (ad.status !== 'paused') return res.status(400).json({ success: false, message: 'Only paused ads can be resumed' });

    await ad.resume(req.user._id);
    res.json({ success: true, message: 'Ad resumed', ad });
  } catch (err) {
    console.error('Resume ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to resume ad' });
  }
};

/**
 * DELETE /api/ads/admin/:id
 */
exports.deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (ad.isDeleted) return res.status(400).json({ success: false, message: 'Ad is already deleted' });

    await ad.softDelete(req.user._id);
    await logAdminAction({ admin: req.user, actionType: 'DELETE_AD', targetId: ad._id, description: `Soft deleted ad: ${ad.title}` });
    res.json({ success: true, message: 'Ad soft deleted' });
  } catch (err) {
    console.error('Delete ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete ad' });
  }
};

/**
 * DELETE /api/ads/admin/:id/permanent
 */
exports.permanentDeleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    const deleteOps = [Ad.findByIdAndDelete(ad._id)];
    if (AdImpression) deleteOps.push(AdImpression.deleteMany({ adId: ad._id }));
    if (AdRevenue)    deleteOps.push(AdRevenue.deleteMany({ adId: ad._id }));
    await Promise.all(deleteOps);

    await logAdminAction({ admin: req.user, actionType: 'PERMANENT_DELETE_AD', targetId: ad._id, description: `Permanently deleted ad: ${ad.title}` });
    res.json({ success: true, message: 'Ad permanently deleted' });
  } catch (err) {
    console.error('Permanent delete ad error:', err);
    res.status(500).json({ success: false, message: 'Failed to permanently delete ad' });
  }
};

/* ══════════════════════════════════════════════
   ANALYTICS ROUTES
══════════════════════════════════════════════ */

/**
 * GET /api/ads/admin/:id/analytics
 */
exports.getAdAnalytics = async (req, res) => {
  try {
    const { id }           = req.params;
    const { period = 'week' } = req.query;

    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    const now = new Date();
    const msMap = { day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 };
    const startDate = new Date(now.getTime() - (msMap[period] || msMap.week));

    // If AdImpression model is available, use it; otherwise return ad-level stats
    if (!AdImpression) {
      return res.json({
        success: true,
        analytics: {
          period,
          summary: {
            totalImpressions:  ad.impressions,
            uniqueImpressions: ad.uniqueImpressions,
            clicks:            ad.clicks,
            ctr:               ad.ctr,
            spentAmount:       ad.spentAmount,
            remainingBudget:   ad.remainingBudget,
            progress:          ad.progress
          },
          hourlyBreakdown: [],
          topVideos:       []
        }
      });
    }

    const impressions      = await AdImpression.find({ adId: id, viewedAt: { $gte: startDate } });
    const totalImpressions = impressions.length;
    const clicks           = impressions.filter(i => i.clicked).length;
    const ctr              = totalImpressions > 0 ? (clicks / totalImpressions) * 100 : 0;

    const topVideos = await AdImpression.aggregate([
      { $match: { adId: new mongoose.Types.ObjectId(id), videoId: { $ne: null } } },
      { $group: { _id: '$videoId', impressions: { $sum: 1 }, clicks: { $sum: { $cond: ['$clicked', 1, 0] } } } },
      { $sort: { impressions: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'videos', localField: '_id', foreignField: '_id', as: 'video' } },
      { $project: { videoTitle: { $arrayElemAt: ['$video.title', 0] }, impressions: 1, clicks: 1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        period,
        summary: {
          totalImpressions,
          uniqueImpressions: impressions.filter(i => i.isUnique).length,
          clicks,
          ctr,
          spentAmount:     ad.spentAmount,
          remainingBudget: ad.remainingBudget,
          progress:        ad.progress
        },
        topVideos
      }
    });
  } catch (err) {
    console.error('Get ad analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

/**
 * GET /api/ads/admin/analytics/overview
 */
exports.getOverallAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const analytics = await Ad.getAnalytics(period);

    const topAds = await Ad.find({ status: 'active', isDeleted: false })
      .sort({ ctr: -1, impressions: -1 })
      .limit(5)
      .select('title type impressions clicks ctr spentAmount')
      .lean();

    let revenueSummary = [];
    if (AdRevenue) {
      revenueSummary = await AdRevenue.aggregate([
        {
          $group: {
            _id:              '$status',
            totalRevenue:     { $sum: '$totalRevenue' },
            creatorEarnings:  { $sum: '$creatorEarnings' },
            platformEarnings: { $sum: '$platformEarnings' },
            count:            { $sum: 1 }
          }
        }
      ]);
    }

    res.json({ success: true, analytics: { ...analytics, topAds, revenue: revenueSummary } });
  } catch (err) {
    console.error('Get overall analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch overall analytics' });
  }
};

/**
 * GET /api/ads/analytics/creator-earnings
 */
exports.getCreatorEarnings = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!AdRevenue) return res.json({ success: true, earnings: {}, recentPayments: [] });

    const { period = 'all' } = req.query;
    const now = new Date();
    let startDate = null;

    if (period === 'month')       startDate = new Date(now.getTime() - 30  * 86400000);
    else if (period === 'year')   startDate = new Date(now.getTime() - 365 * 86400000);

    const earnings = await AdRevenue.getCreatorEarnings(
      req.user._id, startDate, period === 'all' ? null : now
    );

    const recentPayments = await AdRevenue.find({ creatorId: req.user._id, status: 'paid' })
      .sort({ paidAt: -1 })
      .limit(10)
      .populate('adId', 'title')
      .lean();

    res.json({ success: true, earnings, recentPayments });
  } catch (err) {
    console.error('Get creator earnings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings' });
  }
};

/**
 * GET /api/ads/admin/stats/summary
 */
exports.getAdStats = async (req, res) => {
  try {
    const now          = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

    const [totalAds, activeAds, pendingAds] = await Promise.all([
      Ad.countDocuments({ isDeleted: false }),
      Ad.countDocuments({ status: 'active', startDate: { $lte: now }, endDate: { $gte: now }, isDeleted: false, remainingBudget: { $gt: 0 } }),
      Ad.countDocuments({ status: 'pending', isDeleted: false })
    ]);

    let todayStats = { impressions: 0, clicks: 0, revenue: 0 };
    if (AdImpression) {
      const [impressions, clicks] = await Promise.all([
        AdImpression.countDocuments({ viewedAt: { $gte: startOfToday } }),
        AdImpression.countDocuments({ clicked: true, clickedAt: { $gte: startOfToday } })
      ]);
      todayStats.impressions = impressions;
      todayStats.clicks      = clicks;
    }

    if (AdRevenue) {
      const rev = await AdRevenue.aggregate([
        { $match: { paidAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$totalRevenue' } } }
      ]);
      todayStats.revenue = rev[0]?.total || 0;
    }

    res.json({
      success: true,
      stats: {
        totalAds,
        activeAds,
        pendingAds,
        today: {
          impressions: todayStats.impressions,
          clicks:      todayStats.clicks,
          ctr:         todayStats.impressions > 0 ? (todayStats.clicks / todayStats.impressions) * 100 : 0,
          revenue:     todayStats.revenue
        }
      }
    });
  } catch (err) {
    console.error('Get ad stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ad stats' });
  }
};