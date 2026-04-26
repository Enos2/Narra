/**
 * File: backend/controllers/promotionController.js
 * Internal name: promotion (displayed as "Campaign" to users/admins)
 * Replaces: adController.js
 */

const Promotion = require('../models/Promotion');
const User      = require('../models/User');
const Admin     = require('../models/Admin');
const path      = require('path');
const fs        = require('fs');

/* ─────────────────────────────────────────────
   HELPERS
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

const parseJsonField = (value, fallback = []) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const logAdminAction = async ({ admin, actionType, targetId, description }) => {
  try {
    const AdminAuditLog = require('../models/AdminAuditLog');
    await AdminAuditLog.create({
      adminId:     admin._id || admin.id,
      adminName:   admin.fullName || admin.name || admin.email,
      adminEmail:  admin.email,
      adminRole:   admin.role,
      actionType,
      targetId,
      targetType:  'Campaign',
      description,
      createdAt:   new Date()
    });
  } catch (err) {
    // Audit log is non-critical — never let it crash the response
    console.warn('[promotionController] Audit log write failed:', err.message);
  }
};

/* ══════════════════════════════════════════════
   PUBLIC — Get active promotions for a placement
   GET /api/promotions/active?placement=home-banner
══════════════════════════════════════════════ */
exports.getActivePromotions = async (req, res) => {
  try {
    const { placement, limit = 5 } = req.query;

    let user = null;
    if (req.user) {
      user = await User.findById(req.user._id || req.user.id).select(
        'dateOfBirth gender country continent _id'
      ).lean();
    }

    const promotions = await Promotion.getActiveForUser(user, placement || null, parseInt(limit));

    const safe = promotions.map(p => ({
      _id:          p._id,
      title:        p.title,
      description:  p.description,
      type:         p.type,
      placement:    p.placement,
      mediaUrl:     p.mediaUrl,
      thumbnailUrl: p.thumbnailUrl,
      targetUrl:    p.targetUrl,
      ageRating:    p.ageRating
    }));

    return res.json({ success: true, promotions: safe });
  } catch (err) {
    console.error('[getActivePromotions]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
};

/* ══════════════════════════════════════════════
   PUBLIC — Get single promotion (safe view)
   GET /api/promotions/:id
══════════════════════════════════════════════ */
exports.getPromotionById = async (req, res) => {
  try {
    const p = await Promotion.findOne({ _id: req.params.id, status: 'active', isDeleted: false }).lean();
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    return res.json({
      success: true,
      promotion: {
        _id:         p._id,
        title:       p.title,
        description: p.description,
        type:        p.type,
        mediaUrl:    p.mediaUrl,
        thumbnailUrl:p.thumbnailUrl,
        targetUrl:   p.targetUrl,
        ageRating:   p.ageRating
      }
    });
  } catch (err) {
    console.error('[getPromotionById]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
};

/* ══════════════════════════════════════════════
   TRACKING — Impression
   POST /api/promotions/:id/view
══════════════════════════════════════════════ */
exports.trackView = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const isUnique = !req.user; // simplified; can be enhanced with session tracking
    await p.trackImpression(req.user?._id, isUnique);

    return res.json({ success: true });
  } catch (err) {
    console.error('[trackView]', err);
    return res.status(500).json({ success: false, message: 'Failed to track view' });
  }
};

/* ══════════════════════════════════════════════
   TRACKING — Click
   POST /api/promotions/:id/engage
══════════════════════════════════════════════ */
exports.trackEngage = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await p.trackClick(req.user?._id, true);

    return res.json({ success: true, redirectUrl: p.targetUrl });
  } catch (err) {
    console.error('[trackEngage]', err);
    return res.status(500).json({ success: false, message: 'Failed to track engagement' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — List all promotions
   GET /api/promotions/manage/all
══════════════════════════════════════════════ */
exports.getAllPromotions = async (req, res) => {
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

    const sort  = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    const skip  = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      Promotion.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'fullName email role')
        .populate('approvedBy', 'fullName email')
        .lean(),
      Promotion.countDocuments(query)
    ]);

    const enriched = items.map(p => ({
      ...p,
      isActive: p.status === 'active' &&
                new Date() >= new Date(p.startDate) &&
                new Date() <= new Date(p.endDate) &&
                p.remainingBudget > 0,
      progress: p.totalBudget
        ? ((p.totalBudget - p.remainingBudget) / p.totalBudget) * 100
        : 0,
      daysRemaining: p.endDate
        ? Math.max(0, Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0
    }));

    return res.json({
      success: true,
      ads: enriched, // keep "ads" key so existing frontend requests.js works
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[getAllPromotions]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Get single promotion (full details for edit)
   GET /api/promotions/manage/:id
══════════════════════════════════════════════ */
exports.getPromotionForEdit = async (req, res) => {
  try {
    const p = await Promotion.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'fullName email role')
      .lean();

    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    return res.json({ success: true, ad: p }); // keep "ad" key for frontend compat
  } catch (err) {
    console.error('[getPromotionForEdit]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Create promotion
   POST /api/promotions/manage/create
══════════════════════════════════════════════ */
exports.createPromotion = async (req, res) => {
  try {
    const {
      title, description, type, placement, targetUrl,
      ageRating, targetGender, startDate, endDate,
      totalBudget, dailyBudget, currency,
      maxImpressionsPerUser, maxClicksPerUser,
      minAge, maxAge, notes,
      contentFlags:       rawContentFlags,
      targetCountries:    rawTargetCountries,
      targetContinents:   rawTargetContinents,
      blockedCountries:   rawBlockedCountries,
      blockedContinents:  rawBlockedContinents,
      blockedUserIds:     rawBlockedUserIds,
      tags:               rawTags,
      mediaUrl:           bodyMediaUrl,
      thumbnailUrl:       bodyThumbnailUrl
    } = req.body;

    // Required field check
    const missing = [];
    if (!title)       missing.push('title');
    if (!type)        missing.push('type');
    if (!placement)   missing.push('placement');
    if (!targetUrl)   missing.push('targetUrl');
    if (!startDate)   missing.push('startDate');
    if (!endDate)     missing.push('endDate');
    if (!totalBudget) missing.push('totalBudget');

    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    // Resolve media URLs from uploaded files or body strings
    let mediaUrl     = bodyMediaUrl    || '';
    let thumbnailUrl = bodyThumbnailUrl || '';

    if (req.files) {
      if (req.files.video?.[0]) {
        mediaUrl = `/uploads/campaigns/videos/${req.files.video[0].filename}`;
      } else if (req.files.image?.[0]) {
        mediaUrl = `/uploads/campaigns/images/${req.files.image[0].filename}`;
      }
      if (req.files.thumbnail?.[0]) {
        thumbnailUrl = `/uploads/campaigns/images/${req.files.thumbnail[0].filename}`;
      }
    }

    if (!mediaUrl) {
      return res.status(400).json({ success: false, message: 'A media file or mediaUrl is required' });
    }

    const promotion = new Promotion({
      title,
      description:          description || '',
      type,
      placement,
      mediaUrl,
      thumbnailUrl:         thumbnailUrl || null,
      targetUrl,
      ageRating:            ageRating || 'ALL',
      contentFlags:         parseJsonField(rawContentFlags, { violence: false, sex: false, language: false, graphic: false }),
      targetCountries:      parseJsonField(rawTargetCountries, []),
      targetContinents:     parseJsonField(rawTargetContinents, []),
      blockedCountries:     parseJsonField(rawBlockedCountries, []),
      blockedContinents:    parseJsonField(rawBlockedContinents, []),
      blockedUserIds:       parseJsonField(rawBlockedUserIds, []),
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
      tags:                 parseJsonField(rawTags, []),
      notes:                notes || null,
      createdBy:            req.admin._id || req.admin.id,
      status:               'pending'
    });

    await promotion.save();

    await logAdminAction({
      admin:       req.admin,
      actionType:  'CREATE_CAMPAIGN',
      targetId:    promotion._id,
      description: `Created campaign: ${title}`
    });

    return res.status(201).json({
      success: true,
      message: 'Campaign created and pending approval',
      ad: promotion
    });
  } catch (err) {
    console.error('[createPromotion]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create campaign',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Update promotion
   PUT /api/promotions/manage/:id
══════════════════════════════════════════════ */
exports.updatePromotion = async (req, res) => {
  try {
    const p = await Promotion.findOne({ _id: req.params.id, isDeleted: false });
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    if (!['pending', 'paused', 'rejected'].includes(p.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending, paused, or rejected campaigns can be edited'
      });
    }

    const updatable = [
      'title', 'description', 'targetUrl', 'placement', 'ageRating',
      'targetGender', 'startDate', 'endDate', 'totalBudget', 'dailyBudget',
      'currency', 'maxImpressionsPerUser', 'maxClicksPerUser', 'notes',
      'minAge', 'maxAge'
    ];
    const jsonFields = new Set([
      'contentFlags', 'targetCountries', 'targetContinents',
      'blockedCountries', 'blockedContinents', 'blockedUserIds', 'tags'
    ]);

    updatable.forEach(field => {
      if (req.body[field] !== undefined) p[field] = req.body[field];
    });

    jsonFields.forEach(field => {
      if (req.body[field] !== undefined) p[field] = parseJsonField(req.body[field]);
    });

    if (req.files) {
      if (req.files.video?.[0]) {
        p.mediaUrl = `/uploads/campaigns/videos/${req.files.video[0].filename}`;
      } else if (req.files.image?.[0]) {
        p.mediaUrl = `/uploads/campaigns/images/${req.files.image[0].filename}`;
      }
      if (req.files.thumbnail?.[0]) {
        p.thumbnailUrl = `/uploads/campaigns/images/${req.files.thumbnail[0].filename}`;
      }
    }

    // Reset approval if major fields changed
    const major = ['title', 'targetUrl', 'mediaUrl', 'ageRating', 'totalBudget'];
    if (major.some(f => req.body[f] !== undefined)) {
      p.status     = 'pending';
      p.approved   = false;
      p.approvedBy = null;
      p.approvedAt = null;
    }

    await p.save();

    await logAdminAction({
      admin:       req.admin,
      actionType:  'UPDATE_CAMPAIGN',
      targetId:    p._id,
      description: `Updated campaign: ${p.title}`
    });

    return res.json({ success: true, message: 'Campaign updated', ad: p });
  } catch (err) {
    console.error('[updatePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Approve
   PUT /api/promotions/manage/:id/approve
══════════════════════════════════════════════ */
exports.approvePromotion = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (p.status === 'active') return res.status(400).json({ success: false, message: 'Campaign is already active' });

    await p.approve(req.admin._id || req.admin.id);

    await logAdminAction({
      admin:       req.admin,
      actionType:  'APPROVE_CAMPAIGN',
      targetId:    p._id,
      description: `Approved campaign: ${p.title}`
    });

    return res.json({ success: true, message: 'Campaign approved and activated', ad: p });
  } catch (err) {
    console.error('[approvePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to approve campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Reject
   PUT /api/promotions/manage/:id/reject
══════════════════════════════════════════════ */
exports.rejectPromotion = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    await p.reject(req.admin._id || req.admin.id, reason);

    await logAdminAction({
      admin:       req.admin,
      actionType:  'REJECT_CAMPAIGN',
      targetId:    p._id,
      description: `Rejected campaign: ${p.title}. Reason: ${reason}`
    });

    return res.json({ success: true, message: 'Campaign rejected', ad: p });
  } catch (err) {
    console.error('[rejectPromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to reject campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Pause
   PUT /api/promotions/manage/:id/pause
══════════════════════════════════════════════ */
exports.pausePromotion = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (p.status !== 'active') return res.status(400).json({ success: false, message: 'Only active campaigns can be paused' });

    await p.pause(req.admin._id || req.admin.id);

    await logAdminAction({
      admin:       req.admin,
      actionType:  'PAUSE_CAMPAIGN',
      targetId:    p._id,
      description: `Paused campaign: ${p.title}`
    });

    return res.json({ success: true, message: 'Campaign paused', ad: p });
  } catch (err) {
    console.error('[pausePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to pause campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Resume
   PUT /api/promotions/manage/:id/resume
══════════════════════════════════════════════ */
exports.resumePromotion = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (p.status !== 'paused') return res.status(400).json({ success: false, message: 'Only paused campaigns can be resumed' });

    await p.resume(req.admin._id || req.admin.id);

    return res.json({ success: true, message: 'Campaign resumed', ad: p });
  } catch (err) {
    console.error('[resumePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to resume campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Soft delete
   DELETE /api/promotions/manage/:id
══════════════════════════════════════════════ */
exports.deletePromotion = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p)           return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (p.isDeleted)  return res.status(400).json({ success: false, message: 'Campaign already deleted' });

    await p.softDelete(req.admin._id || req.admin.id);

    await logAdminAction({
      admin:       req.admin,
      actionType:  'DELETE_CAMPAIGN',
      targetId:    p._id,
      description: `Soft deleted campaign: ${p.title}`
    });

    return res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    console.error('[deletePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Permanent delete (super admin only)
   DELETE /api/promotions/manage/:id/permanent
══════════════════════════════════════════════ */
exports.permanentDeletePromotion = async (req, res) => {
  try {
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const title = p.title;
    await Promotion.findByIdAndDelete(p._id);

    await logAdminAction({
      admin:       req.admin,
      actionType:  'PERMANENT_DELETE_CAMPAIGN',
      targetId:    req.params.id,
      description: `Permanently deleted campaign: ${title}`
    });

    return res.json({ success: true, message: 'Campaign permanently deleted' });
  } catch (err) {
    console.error('[permanentDeletePromotion]', err);
    return res.status(500).json({ success: false, message: 'Failed to permanently delete campaign' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Block user from seeing a campaign
   POST /api/promotions/manage/:id/block-user
══════════════════════════════════════════════ */
exports.blockUserFromCampaign = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    if (!p.blockedUserIds.includes(userId)) {
      p.blockedUserIds.push(userId);
      await p.save();
    }

    return res.json({ success: true, message: 'User blocked from this campaign' });
  } catch (err) {
    console.error('[blockUserFromCampaign]', err);
    return res.status(500).json({ success: false, message: 'Failed to block user' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Analytics for a single campaign
   GET /api/promotions/manage/:id/analytics
══════════════════════════════════════════════ */
exports.getPromotionAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const p = await Promotion.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const ecpm = p.impressions > 0 ? (p.spentAmount / p.impressions) * 1000 : 0;

    return res.json({
      success: true,
      analytics: {
        period,
        summary: {
          totalImpressions:  p.impressions,
          uniqueImpressions: p.uniqueImpressions,
          clicks:            p.clicks,
          uniqueClicks:      p.uniqueClicks,
          ctr:               p.ctr,
          spentAmount:       p.spentAmount,
          remainingBudget:   p.remainingBudget,
          progress:          p.progress,
          ecpm
        },
        hourlyBreakdown: [],
        topVideos:       []
      }
    });
  } catch (err) {
    console.error('[getPromotionAnalytics]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Platform-wide analytics overview
   GET /api/promotions/manage/analytics/overview
══════════════════════════════════════════════ */
exports.getOverallAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const analytics = await Promotion.getAnalytics(period);

    const topCampaigns = await Promotion.find({ status: 'active', isDeleted: false })
      .sort({ ctr: -1, impressions: -1 })
      .limit(5)
      .select('title type impressions clicks ctr spentAmount')
      .lean();

    return res.json({ success: true, analytics: { ...analytics, topCampaigns } });
  } catch (err) {
    console.error('[getOverallAnalytics]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

/* ══════════════════════════════════════════════
   ADMIN — Quick stats summary
   GET /api/promotions/manage/stats/summary
══════════════════════════════════════════════ */
exports.getStats = async (req, res) => {
  try {
    const now          = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [total, active, pending] = await Promise.all([
      Promotion.countDocuments({ isDeleted: false }),
      Promotion.countDocuments({
        status:          'active',
        startDate:       { $lte: now },
        endDate:         { $gte: now },
        isDeleted:       false,
        remainingBudget: { $gt: 0 }
      }),
      Promotion.countDocuments({ status: 'pending', isDeleted: false })
    ]);

    return res.json({
      success: true,
      stats: {
        totalAds:   total,
        activeAds:  active,
        pendingAds: pending,
        today:      { impressions: 0, clicks: 0, ctr: 0, revenue: 0 }
      }
    });
  } catch (err) {
    console.error('[getStats]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};