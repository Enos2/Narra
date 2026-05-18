/**
 * File: backend/controllers/liveController.js
 * REBUILT FROM SCRATCH
 * Supports: OBS/RTMP, browser streaming, live chat via Socket.IO,
 * qualification checks, admin privilege control, strikes, free streams only
 * FIXED: hlsUrl always uses /live/<streamKey>/index.m3u8 format
 * FIXED: getStreamStatus returns hlsUrl regardless of status so frontend can poll correctly
 * FIXED: streamKey now returned to ALL authenticated viewers when stream is live
 * FIXED: buildHlsUrl uses port 5000 (matches server.js static file serving)
 */

const Live = require('../models/Live');
const User = require('../models/User');
const Video = require('../models/Video');
const crypto = require('crypto');
const mongoose = require('mongoose');
const NotificationService = require('../services/notificationService');
const AdminAuditLog = require('../models/AdminAuditLog');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const ADMIN_ROLES = ['superadmin', 'platformadmin', 'supportadmin'];

const isAdmin = (user) => ADMIN_ROLES.includes(user?.role);

/**
 * Build the canonical HLS URL.
 * FIXED: Use port 5000 — HLS files are served by server.js at /live/<streamKey>/index.m3u8
 * NOT port 8000 (that was Node Media Server's built-in HTTP which we don't use for HLS serving)
 */
const buildHlsUrl = (streamKey) => {
  const HLS_BASE = process.env.HLS_SERVER_URL || 'http://localhost:5000';
  return `${HLS_BASE}/live/${streamKey}/index.m3u8`;
};

const logAdminAction = async ({
  admin, actionType, actionLabel, targetType, targetId,
  targetName, targetEmail, description, reason, ipAddress, userAgent, metadata = {},
}) => {
  try {
    await new AdminAuditLog({
      adminId: admin._id,
      adminName: admin.name || admin.username || 'Admin',
      adminRole: admin.role,
      adminEmail: admin.email,
      actionType, actionLabel, targetType, targetId,
      targetName, targetEmail, description, reason,
      ipAddress, userAgent, metadata,
    }).save();
  } catch (err) {
    console.error('[AuditLog] Failed to save:', err.message);
  }
};

const getUserVideoStats = async (userId) => {
  try {
    const videos = await Video.find({
      creator: userId,
      approved: true,
      isDeleted: { $ne: true },
    }).select('views');
    return {
      approvedVideoCount: videos.length,
      totalVideoViews: videos.reduce((s, v) => s + (v.views || 0), 0),
    };
  } catch {
    return { approvedVideoCount: 0, totalVideoViews: 0 };
  }
};

const calcActiveStrikes = (strikes) => {
  if (!Array.isArray(strikes)) return 0;
  const cutoff = new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000);
  return strikes.filter((s) => new Date(s.date) > cutoff).length;
};

const calcAccountAgeDays = (createdAt) =>
  createdAt ? Math.floor((Date.now() - new Date(createdAt)) / 86400000) : 0;

/**
 * Full qualification check — returns a structured result object
 */
const resolveQualification = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { qualified: false, reason: 'user_not_found' };

  // Manual admin approval always wins
  if (user.canGoLive && user.canGoLiveReason === 'manual_admin_approval') {
    return { qualified: true, reason: 'manual_admin_approval' };
  }

  // Revoked
  if (!user.canGoLive && user.canGoLiveReason === 'revoked') {
    return {
      qualified: false,
      reason: 'revoked',
      message: 'Your live streaming privileges have been revoked by an admin.',
    };
  }

  const accountAgeDays = calcAccountAgeDays(user.createdAt);
  const activeStrikes = calcActiveStrikes(user.liveStrikes);
  const { approvedVideoCount, totalVideoViews } = await getUserVideoStats(userId);

  const needs = { videos: 3, views: 500, days: 30 };

  const met = {
    videos: approvedVideoCount >= needs.videos,
    views: totalVideoViews >= needs.views,
    days: accountAgeDays >= needs.days,
    noStrikes: activeStrikes === 0,
  };

  const qualified = met.videos && met.views && met.days && met.noStrikes;

  if (qualified && !user.canGoLive) {
    // Auto-qualify
    user.canGoLive = true;
    user.canGoLiveReason = 'auto_qualified';
    user.canGoLiveGrantedAt = new Date();
    user.canGoLiveGrantedBy = null;
    user.approvedVideoCount = approvedVideoCount;
    user.totalVideoViews = totalVideoViews;
    user.liveQualificationCheckedAt = new Date();
    await user.save({ validateBeforeSave: false });
  }

  return {
    qualified,
    reason: qualified ? 'auto_qualified' : 'requirements_not_met',
    stats: { approvedVideoCount, totalVideoViews, accountAgeDays, activeStrikes },
    requirements: needs,
    met,
    missing: {
      videos: Math.max(0, needs.videos - approvedVideoCount),
      views: Math.max(0, needs.views - totalVideoViews),
      days: Math.max(0, needs.days - accountAgeDays),
      strikes: activeStrikes,
    },
    message: qualified
      ? 'You are qualified to go live!'
      : buildUnqualifiedMessage(met, { approvedVideoCount, totalVideoViews, accountAgeDays, activeStrikes }, needs),
  };
};

const buildUnqualifiedMessage = (met, stats, needs) => {
  const parts = [];
  if (!met.videos)
    parts.push(`${needs.videos - stats.approvedVideoCount} more approved video(s) needed`);
  if (!met.views)
    parts.push(`${needs.views - stats.totalVideoViews} more total views needed`);
  if (!met.days)
    parts.push(`account must be ${needs.days - stats.accountAgeDays} more day(s) old`);
  if (!met.noStrikes)
    parts.push(`${stats.activeStrikes} active strike(s) must be resolved`);
  return parts.length
    ? `To go live you need: ${parts.join(', ')}.`
    : 'Requirements not met.';
};

// ─────────────────────────────────────────────
// CHECK LIVE QUALIFICATION (GET /lives/check-qualification)
// ─────────────────────────────────────────────
const checkLiveQualification = async (req, res) => {
  try {
    const qualification = await resolveQualification(req.user._id);
    const user = await User.findById(req.user._id).select(
      'canGoLive canGoLiveReason approvedVideoCount totalVideoViews liveStrikes'
    );

    res.json({
      success: true,
      qualification,
      user: {
        _id: user._id,
        canGoLive: user.canGoLive,
        canGoLiveReason: user.canGoLiveReason,
        approvedVideoCount: user.approvedVideoCount,
        totalVideoViews: user.totalVideoViews,
        strikeCount: calcActiveStrikes(user.liveStrikes),
      },
    });
  } catch (err) {
    console.error('checkLiveQualification error:', err);
    res.status(500).json({ success: false, message: 'Failed to check qualification' });
  }
};

// ─────────────────────────────────────────────
// CREATE LIVE  (POST /lives)
// ─────────────────────────────────────────────
const createLive = async (req, res) => {
  try {
    const qualification = await resolveQualification(req.user._id);

    if (!qualification.qualified) {
      return res.status(403).json({
        success: false,
        message: qualification.message || 'You do not have live streaming privileges.',
        qualification,
        notQualified: true,
      });
    }

    if (req.user.isShadowBanned) {
      return res.status(403).json({ success: false, message: 'Shadow banned users cannot create live streams.' });
    }

    const {
      title = '',
      description = '',
      thumbnailUrl = '',
      scheduledAt = null,
      category = 'general',
      tags = [],
      ageRating = 'PG',
    } = req.body;

    let parsedTags = tags;
    if (typeof tags === 'string') {
      try { parsedTags = JSON.parse(tags); }
      catch { parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean); }
    }

    if (!title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    // Generate stream credentials
    const streamKey = crypto.randomBytes(20).toString('hex');
    const RTMP_URL = process.env.RTMP_SERVER_URL || 'rtmp://localhost:1935/live';

    // FIXED: Always use the correct HLS URL format pointing to port 5000
    const rtmpUrl = `${RTMP_URL}/${streamKey}`;
    const hlsUrl = buildHlsUrl(streamKey);

    // All streams are FREE — payments disabled
    const live = await Live.create({
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl: thumbnailUrl || '',
      host: req.user._id,
      status: scheduledAt ? 'scheduled' : 'live',
      scheduledAt: scheduledAt || null,
      isPaid: false,
      price: 0,
      currency: 'USD',
      purchases: [],
      isSponsored: false,
      isFundraiser: false,
      category: category || 'general',
      tags: parsedTags,
      ageRating: ageRating || 'PG',
      viewers: [],
      peakViewers: 0,
      totalViews: 0,
      chatEnabled: true,
      chatSlowMode: false,
      approved: true,
      isDeleted: false,
      streamKey,
      rtmpUrl,
      hlsUrl,
    });

    // Register with streaming server for key validation
    try {
      const streamingServer = require('../streaming-server');
      if (streamingServer.registerStream) {
        streamingServer.registerStream(streamKey, live._id);
      }
    } catch { /* streaming server optional */ }

    console.log(`🎬 Live created: "${live.title}" by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Live stream created successfully.',
      live: {
        ...live.toObject(),
        streamKey,
        rtmpUrl,
        hlsUrl,
        obsSettings: {
          server: RTMP_URL,
          streamKey,
          fullUrl: rtmpUrl,
          instructions: [
            'Open OBS Studio → Settings → Stream',
            'Service: Custom',
            `Server: ${RTMP_URL}`,
            `Stream Key: ${streamKey}`,
            'Click OK → Start Streaming',
          ],
        },
        browserStreamUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/live/broadcast/${live._id}`,
      },
    });
  } catch (err) {
    console.error('createLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to create live stream.', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};

// ─────────────────────────────────────────────
// GET LIVE FEED  (GET /lives)
// ─────────────────────────────────────────────
const getLiveFeed = async (req, res) => {
  try {
    const lives = await Live.find({
      isDeleted: false,
      isShadowBanned: { $ne: true },
      status: { $in: ['live', 'scheduled'] },
    })
      .populate('host', 'username firstName lastName avatar isVerified')
      .sort({ status: -1, startedAt: -1, scheduledAt: 1 })
      .lean();

    const result = lives.map((live) => ({
      ...live,
      // Always build the correct hlsUrl from the streamKey in case DB value is stale
      hlsUrl: live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl,
      playbackUrl: live.status === 'live' ? (live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl) : null,
      isLive: live.status === 'live',
      viewerCount: live.viewers?.length || 0,
      isFree: true,
    }));

    res.json({ success: true, lives: result, count: result.length });
  } catch (err) {
    console.error('getLiveFeed error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch live streams.' });
  }
};

// ─────────────────────────────────────────────
// GET STREAM STATUS  (GET /lives/:id or /lives/:id/status)
// ─────────────────────────────────────────────
const getStreamStatus = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'username firstName lastName avatar isVerified')
      .lean();

    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    // Always compute the correct hlsUrl from streamKey — never trust the stored value alone
    const correctHlsUrl = live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl;

    const isHostUser = req.user?._id?.toString() === live.host?._id?.toString();

    res.json({
      success: true,
      live: {
        _id: live._id,
        title: live.title,
        description: live.description,
        thumbnailUrl: live.thumbnailUrl,
        host: live.host,
        status: live.status,
        isLive: live.status === 'live',
        approved: live.approved,
        startedAt: live.startedAt,
        endedAt: live.endedAt,
        duration: live.duration,
        viewerCount: live.viewers?.length || 0,
        peakViewers: live.peakViewers,
        totalViews: live.totalViews,
        // Always return hlsUrl so frontend can build player immediately.
        // The HLS player handles retries if the stream hasn't started yet.
        hlsUrl: correctHlsUrl,
        playbackUrl: live.status === 'live' ? correctHlsUrl : null,
        // FIXED: Return streamKey to ALL authenticated users when stream is live.
        // Viewers need streamKey so LiveWatch.jsx can build the HLS URL client-side
        // and showVideo becomes true (previously only host got streamKey → viewers saw black screen).
        streamKey: live.status === 'live' ? live.streamKey : (isHostUser ? live.streamKey : undefined),
        // Only expose rtmpUrl (RTMP ingest credentials) to the host
        rtmpUrl: isHostUser ? live.rtmpUrl : undefined,
        chatEnabled: live.chatEnabled,
        chatSlowMode: live.chatSlowMode,
        category: live.category,
        tags: live.tags,
        isFree: true,
        scheduledAt: live.scheduledAt,
      },
    });
  } catch (err) {
    console.error('getStreamStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to get stream status.' });
  }
};

// ─────────────────────────────────────────────
// JOIN / WATCH LIVE  (POST /lives/:id/join)
// ─────────────────────────────────────────────
const joinLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'username firstName lastName avatar isVerified');

    if (!live || live.isDeleted || live.isShadowBanned) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    if (live.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: live.status === 'scheduled'
          ? `This stream is scheduled for ${live.scheduledAt ? new Date(live.scheduledAt).toLocaleString() : 'later'}.`
          : live.status === 'ended'
            ? 'This stream has ended.'
            : 'Stream is not yet live.',
        status: live.status,
        scheduledAt: live.scheduledAt,
      });
    }

    const userId = req.user._id;
    const isHostUser = live.host._id.toString() === userId.toString();

    // Track viewer
    if (!live.viewers.some((v) => v.toString() === userId.toString())) {
      live.viewers.push(userId);
      live.totalViews += 1;
      live.peakViewers = Math.max(live.peakViewers, live.viewers.length);
      await live.save({ validateBeforeSave: false });
    }

    // Notify room of new viewer count via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('viewer:update', {
        viewerCount: live.viewers.length,
      });
    }

    // Always derive hlsUrl from streamKey
    const correctHlsUrl = live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl;

    res.json({
      success: true,
      live: {
        _id: live._id,
        title: live.title,
        description: live.description,
        thumbnailUrl: live.thumbnailUrl,
        host: live.host,
        status: live.status,
        isLive: true,
        playbackUrl: correctHlsUrl,
        hlsUrl: correctHlsUrl,
        // FIXED: Always return streamKey to viewers on join so LiveWatch.jsx
        // can set showVideo = true and initialise the HLS player
        streamKey: live.streamKey,
        viewerCount: live.viewers.length,
        isHost: isHostUser,
        chatEnabled: live.chatEnabled,
        chatSlowMode: live.chatSlowMode,
        isFree: true,
        category: live.category,
        tags: live.tags,
      },
    });
  } catch (err) {
    console.error('joinLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to join live stream.' });
  }
};

// ─────────────────────────────────────────────
// CHECK LIVE ACCESS  (GET /lives/:id/access)
// ─────────────────────────────────────────────
const checkLiveAccess = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    if (!live || live.isDeleted || live.isShadowBanned) {
      return res.status(404).json({ success: false, message: 'Live stream not available.' });
    }

    const isHostUser = live.host.toString() === req.user._id.toString();
    const isAdminUser = isAdmin(req.user);
    const correctHlsUrl = live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl;

    res.json({
      success: true,
      hasAccess: true, // All streams are free
      isHost: isHostUser,
      isAdmin: isAdminUser,
      playbackUrl: live.status === 'live' ? correctHlsUrl : null,
      hlsUrl: correctHlsUrl,
      // Return streamKey to all authenticated users for access check
      streamKey: live.status === 'live' ? live.streamKey : undefined,
      status: live.status,
      title: live.title,
      chatEnabled: live.chatEnabled,
    });
  } catch (err) {
    console.error('checkLiveAccess error:', err);
    res.status(500).json({ success: false, message: 'Failed to check live access.' });
  }
};

// ─────────────────────────────────────────────
// START STREAM  (POST /lives/:id/start)
// Called manually by host or triggered by RTMP
// ─────────────────────────────────────────────
const startStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    const isHostUser = live.host.toString() === req.user._id.toString();
    if (!isHostUser && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to start this stream.' });
    }

    const correctHlsUrl = live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl;

    if (live.status === 'live') {
      return res.json({
        success: true,
        message: 'Stream is already live.',
        live: { _id: live._id, status: live.status, hlsUrl: correctHlsUrl, streamKey: live.streamKey },
      });
    }

    live.status = 'live';
    live.startedAt = new Date();
    live.viewers = [];
    // Ensure hlsUrl is always correct before saving
    live.hlsUrl = correctHlsUrl;
    await live.save({ validateBeforeSave: false });

    // Notify Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:started', {
        liveId: live._id,
        title: live.title,
        hlsUrl: correctHlsUrl,
        streamKey: live.streamKey,
        startedAt: live.startedAt,
      });
      io.emit('feed:stream:started', { liveId: live._id, title: live.title });
    }

    console.log(`📡 Stream started: "${live.title}" by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Stream started.',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        hlsUrl: correctHlsUrl,
        streamKey: live.streamKey,
        rtmpUrl: live.rtmpUrl,
        startedAt: live.startedAt,
      },
    });
  } catch (err) {
    console.error('startStream error:', err);
    res.status(500).json({ success: false, message: 'Failed to start stream.' });
  }
};

// ─────────────────────────────────────────────
// STOP STREAM  (POST /lives/:id/stop)
// ─────────────────────────────────────────────
const stopStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    const isHostUser = live.host.toString() === req.user._id.toString();
    if (!isHostUser && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to stop this stream.' });
    }

    if (live.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Stream is not currently live.', status: live.status });
    }

    const endedAt = new Date();
    const duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;

    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = duration;
    await live.save({ validateBeforeSave: false });

    // Notify Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:ended', {
        liveId: live._id,
        duration,
        endedAt,
        message: 'The streamer has ended this broadcast.',
      });
      io.emit('feed:stream:ended', { liveId: live._id });
    }

    console.log(`🛑 Stream stopped: "${live.title}" — ${duration}s`);

    res.json({
      success: true,
      message: 'Stream stopped.',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        duration,
        peakViewers: live.peakViewers,
        totalViews: live.totalViews,
        endedAt,
      },
    });
  } catch (err) {
    console.error('stopStream error:', err);
    res.status(500).json({ success: false, message: 'Failed to stop stream.' });
  }
};

// ─────────────────────────────────────────────
// GET USER'S OWN LIVE STREAMS  (GET /lives/my)
// ─────────────────────────────────────────────
const getMyLives = async (req, res) => {
  try {
    const lives = await Live.find({ host: req.user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    // Ensure hlsUrl is always correct in list view too
    const result = lives.map((live) => ({
      ...live,
      hlsUrl: live.streamKey ? buildHlsUrl(live.streamKey) : live.hlsUrl,
    }));

    res.json({ success: true, lives: result, count: result.length });
  } catch (err) {
    console.error('getMyLives error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch your streams.' });
  }
};

// ─────────────────────────────────────────────
// PURCHASE LIVE — DISABLED (all free)
// ─────────────────────────────────────────────
const purchaseLive = async (req, res) => {
  res.json({ success: true, message: 'All live streams are currently free. Enjoy!' });
};

// ─────────────────────────────────────────────
// ADMIN: UPDATE LIVE STATUS  (PATCH /lives/:id/status)
// ─────────────────────────────────────────────
const updateLiveStatus = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const { status, removalReason } = req.body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    live.approved = status === 'approved';
    live.rejected = status === 'rejected';
    if (status === 'cancelled') live.status = 'cancelled';
    live.removalReason = status === 'rejected' ? removalReason || 'No reason provided' : '';
    live.approvedBy = req.user._id;

    await live.save({ validateBeforeSave: false });

    // Notify host
    const notifMap = {
      approved: {
        title: 'Live Stream Approved ✅',
        message: `Your stream "${live.title}" has been approved. You can now go live!`,
        priority: 'high',
      },
      rejected: {
        title: 'Live Stream Rejected',
        message: `Your stream "${live.title}" was rejected. Reason: ${removalReason || 'Content guidelines violation'}.`,
        priority: 'high',
      },
      cancelled: {
        title: 'Live Stream Cancelled',
        message: `Your stream "${live.title}" has been cancelled by an admin.`,
        priority: 'normal',
      },
    };

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host,
        type: 'admin',
        ...notifMap[status],
        triggeredBy: req.user._id,
        data: { liveId: live._id, liveTitle: live.title },
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: `LIVE_${status.toUpperCase()}`,
      actionLabel: `${status.charAt(0).toUpperCase() + status.slice(1)} Live Stream`,
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `${status} live stream "${live.title}"`,
      reason: removalReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { liveId: live._id },
    });

    // Notify via socket if approved
    const io = req.app.get('io');
    if (io && status === 'approved') {
      io.to(`user:${live.host}`).emit('live:approved', { liveId: live._id, title: live.title });
    }

    res.json({ success: true, message: `Live stream ${status}.`, live: live.toObject() });
  } catch (err) {
    console.error('updateLiveStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SHADOW BAN LIVE  (PATCH /lives/:id/shadow-ban)
// ─────────────────────────────────────────────
const shadowBanLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    live.isShadowBanned = !live.isShadowBanned;
    await live.save({ validateBeforeSave: false });

    await logAdminAction({
      admin: req.user,
      actionType: live.isShadowBanned ? 'SHADOW_BAN_LIVE' : 'REMOVE_SHADOW_BAN_LIVE',
      actionLabel: live.isShadowBanned ? 'Shadow Ban Live' : 'Remove Shadow Ban',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `${live.isShadowBanned ? 'Applied' : 'Removed'} shadow ban on "${live.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: `Shadow ban ${live.isShadowBanned ? 'applied' : 'removed'}.`, isShadowBanned: live.isShadowBanned });
  } catch (err) {
    console.error('shadowBanLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle shadow ban.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: DELETE LIVE  (DELETE /lives/:id)
// ─────────────────────────────────────────────
const deleteLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    live.isDeleted = true;
    if (live.status === 'live') {
      live.status = 'ended';
      live.endedAt = new Date();
      const io = req.app.get('io');
      if (io) {
        io.to(`live:${live._id}`).emit('stream:ended', {
          liveId: live._id,
          message: 'This stream has been removed by an admin.',
        });
      }
    }
    await live.save({ validateBeforeSave: false });

    await logAdminAction({
      admin: req.user,
      actionType: 'DELETE_LIVE',
      actionLabel: 'Delete Live Stream',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `Deleted live stream "${live.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Live stream deleted.' });
  } catch (err) {
    console.error('deleteLive error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete live stream.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SET LIVE PRIVILEGE  (POST /lives/privileges)
// ─────────────────────────────────────────────
const setLivePrivilege = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (req.user.role === 'supportadmin') {
      return res.status(403).json({ success: false, message: 'Support admins cannot modify live privileges.' });
    }

    const { userId, canGoLive, reason } = req.body;
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    if (canGoLive) {
      await targetUser.grantLivePrivilege(req.user._id);
    } else {
      await targetUser.revokeLivePrivilege(req.user._id, reason || 'Revoked by admin');
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'admin',
        title: canGoLive ? '🎬 Live Streaming Access Granted' : '🚫 Live Streaming Access Revoked',
        message: canGoLive
          ? 'Admin has granted you live streaming privileges! You can now go live.'
          : `Admin has revoked your live streaming privileges. Reason: ${reason || 'Policy violation'}.`,
        priority: 'high',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: canGoLive ? 'GRANT_LIVE_PRIVILEGE' : 'REVOKE_LIVE_PRIVILEGE',
      actionLabel: canGoLive ? 'Grant Live Privilege' : 'Revoke Live Privilege',
      targetType: 'User',
      targetId: targetUser._id,
      targetName: targetUser.name || targetUser.email,
      targetEmail: targetUser.email,
      description: `${canGoLive ? 'Granted' : 'Revoked'} live privileges for ${targetUser.email}`,
      reason: reason || (canGoLive ? 'Manual approval' : 'Revoked by admin'),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: `Live privileges ${canGoLive ? 'granted' : 'revoked'}.`,
      user: {
        _id: targetUser._id,
        canGoLive: targetUser.canGoLive,
        canGoLiveReason: targetUser.canGoLiveReason,
      },
    });
  } catch (err) {
    console.error('setLivePrivilege error:', err);
    res.status(500).json({ success: false, message: 'Failed to update live privilege.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: ADD LIVE STRIKE  (POST /lives/strikes)
// ─────────────────────────────────────────────
const addLiveStrike = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { userId, reason } = req.body;
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    await targetUser.addLiveStrike(reason, req.user._id);
    const strikeCount = calcActiveStrikes(targetUser.liveStrikes);

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: targetUser._id,
        type: 'admin',
        title: '⚠️ Live Streaming Strike',
        message: `You have received a live streaming strike (${strikeCount}/5). Reason: ${reason || 'Violation of guidelines'}.${strikeCount >= 5 ? ' Your live privileges have been revoked.' : ''}`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'ADD_LIVE_STRIKE',
      actionLabel: 'Add Live Strike',
      targetType: 'User',
      targetId: targetUser._id,
      targetName: targetUser.name || targetUser.email,
      targetEmail: targetUser.email,
      description: `Added live strike to ${targetUser.email}`,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { strikeCount },
    });

    res.json({
      success: true,
      message: 'Strike added.',
      strikeCount,
      canGoLive: targetUser.canGoLive,
    });
  } catch (err) {
    console.error('addLiveStrike error:', err);
    res.status(500).json({ success: false, message: 'Failed to add strike.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: REMOVE STRIKE  (DELETE /lives/strikes/:id/:strikeId)
// ─────────────────────────────────────────────
const removeStrike = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { id: userId, strikeId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const idx = user.liveStrikes.findIndex((s) => s._id.toString() === strikeId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Strike not found.' });

    const removed = user.liveStrikes.splice(idx, 1)[0];
    await user.save({ validateBeforeSave: false });

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: user._id,
        type: 'admin',
        title: '✅ Live Strike Removed',
        message: `Admin has removed a strike from your account. You now have ${calcActiveStrikes(user.liveStrikes)} active strike(s).`,
        priority: 'normal',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_LIVE_STRIKE',
      actionLabel: 'Remove Live Strike',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Removed live strike from ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Strike removed.', removedStrike: removed });
  } catch (err) {
    console.error('removeStrike error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove strike.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET USER LIVE DETAILS  (GET /lives/user/:userId)
// ─────────────────────────────────────────────
const getUserLiveDetails = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const targetUser = await User.findById(req.params.userId)
      .select('name email canGoLive canGoLiveReason canGoLiveGrantedAt approvedVideoCount totalVideoViews liveStrikes createdAt isShadowBanned')
      .lean();

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const videoStats = await getUserVideoStats(targetUser._id);
    const userLives = await Live.find({ host: req.params.userId })
      .select('title status startedAt endedAt viewers peakViewers totalViews createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const accountAgeDays = calcAccountAgeDays(targetUser.createdAt);
    const activeStrikes = calcActiveStrikes(targetUser.liveStrikes);

    res.json({
      success: true,
      user: {
        ...targetUser,
        approvedVideoCount: videoStats.approvedVideoCount,
        totalVideoViews: videoStats.totalVideoViews,
        accountAgeDays,
        activeStrikes,
        liveStreams: userLives,
        totalStreams: userLives.length,
        activeStreams: userLives.filter((l) => l.status === 'live').length,
        qualificationStatus: {
          approvedVideos: videoStats.approvedVideoCount,
          totalViews: videoStats.totalVideoViews,
          accountAgeDays,
          activeStrikes,
          meetsVideos: videoStats.approvedVideoCount >= 3,
          meetsViews: videoStats.totalVideoViews >= 500,
          meetsDays: accountAgeDays >= 30,
          meetsStrikes: activeStrikes === 0,
          qualifiesAutomatically:
            videoStats.approvedVideoCount >= 3 &&
            videoStats.totalVideoViews >= 500 &&
            accountAgeDays >= 30 &&
            activeStrikes === 0,
        },
      },
    });
  } catch (err) {
    console.error('getUserLiveDetails error:', err);
    res.status(500).json({ success: false, message: 'Failed to get user live details.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET ALL LIVE STREAMS  (GET /admin/lives)
// ─────────────────────────────────────────────
const getAdminLiveStreams = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }];

    const skip = (page - 1) * limit;
    const [lives, total] = await Promise.all([
      Live.find(filter)
        .populate('host', 'name email avatar isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Live.countDocuments(filter),
    ]);

    res.json({
      success: true,
      lives,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getAdminLiveStreams error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch live streams.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: GET LIVE STREAM DETAILS  (GET /admin/lives/:id)
// ─────────────────────────────────────────────
const getAdminLiveStreamDetails = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'name email avatar isVerified canGoLive liveStrikes')
      .lean();

    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    res.json({ success: true, live });
  } catch (err) {
    console.error('getAdminLiveStreamDetails error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch details.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: END LIVE STREAM  (POST /admin/lives/:id/end)
// ─────────────────────────────────────────────
const endLiveStreamAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });
    if (live.status !== 'live') return res.status(400).json({ success: false, message: 'Stream is not live.' });

    const endedAt = new Date();
    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;
    live.adminEnded = true;
    live.adminEndedBy = req.user._id;
    live.adminEndedReason = req.body.reason || 'Terminated by admin';
    await live.save({ validateBeforeSave: false });

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:ended', {
        liveId: live._id,
        message: `Stream ended by admin: ${live.adminEndedReason}`,
        adminEnded: true,
      });
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host,
        type: 'admin',
        title: '🛑 Live Stream Ended by Admin',
        message: `Your stream "${live.title}" was ended by admin. Reason: ${live.adminEndedReason}`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    if (req.body.addStrike) {
      const host = await User.findById(live.host);
      if (host) await host.addLiveStrike(`Stream terminated: ${req.body.reason || 'Policy violation'}`, req.user._id);
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'END_LIVE_STREAM',
      actionLabel: 'Admin End Live Stream',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `Admin ended stream "${live.title}"`,
      reason: live.adminEndedReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Live stream terminated.', live: { _id: live._id, status: live.status } });
  } catch (err) {
    console.error('endLiveStreamAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to end stream.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: SEND WARNING  (POST /admin/lives/:id/warn)
// ─────────────────────────────────────────────
const sendStreamWarning = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const { warningType, reason, addStrike } = req.body;
    const live = await Live.findById(req.params.id).populate('host', 'name email');
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found.' });

    const host = await User.findById(live.host._id);
    if (!host) return res.status(404).json({ success: false, message: 'Host not found.' });

    if (addStrike) {
      await host.addLiveStrike(reason || 'Live stream violation', req.user._id);
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: live.host._id,
        type: 'admin',
        title: addStrike ? '⚠️ Live Strike Issued' : '⚠️ Live Stream Warning',
        message: `Your stream "${live.title}" received ${addStrike ? 'a strike' : 'a warning'}. Reason: ${reason || 'Violation of guidelines'}.`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`live:${live._id}`).emit('stream:warning', {
        message: `Admin warning: ${reason || 'Review community guidelines.'}`,
        type: addStrike ? 'strike' : 'warning',
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: addStrike ? 'ADD_LIVE_STRIKE' : 'SEND_STREAM_WARNING',
      actionLabel: addStrike ? 'Strike via Warning' : 'Send Stream Warning',
      targetType: 'User',
      targetId: host._id,
      targetName: host.name || host.email,
      targetEmail: host.email,
      description: `${addStrike ? 'Added strike to' : 'Warned'} host of "${live.title}"`,
      reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: addStrike ? 'Strike issued.' : 'Warning sent.' });
  } catch (err) {
    console.error('sendStreamWarning error:', err);
    res.status(500).json({ success: false, message: 'Failed to send warning.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: APPLY/REMOVE SHADOW BAN  (separate endpoints)
// ─────────────────────────────────────────────
const applyShadowBanToLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Not found.' });
    live.isShadowBanned = true;
    live.shadowBanReason = req.body.reason || 'Violation';
    live.shadowBannedBy = req.user._id;
    live.shadowBannedAt = new Date();
    await live.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Shadow ban applied.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

const removeShadowBanFromLive = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Not found.' });
    live.isShadowBanned = false;
    live.shadowBanReason = null;
    live.shadowBannedBy = null;
    live.shadowBannedAt = null;
    await live.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Shadow ban removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// ─────────────────────────────────────────────
// ADMIN: BAN USER FROM STREAMING  (POST /admin/users/:id/ban-streaming)
// ─────────────────────────────────────────────
const banUserFromStreaming = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await user.revokeLivePrivilege(req.user._id, req.body.reason || 'Banned from streaming');

    // End any active streams
    const activeUserStreams = await Live.find({ host: user._id, status: 'live' });
    const io = req.app.get('io');
    for (const stream of activeUserStreams) {
      stream.status = 'ended';
      stream.endedAt = new Date();
      await stream.save({ validateBeforeSave: false });
      if (io) {
        io.to(`live:${stream._id}`).emit('stream:ended', {
          liveId: stream._id,
          message: 'This stream has been ended by an admin.',
          adminEnded: true,
        });
      }
    }

    if (NotificationService?.createNotification) {
      await NotificationService.createNotification({
        userId: user._id,
        type: 'admin',
        title: '🚫 Banned from Live Streaming',
        message: `Admin has banned you from live streaming. Reason: ${req.body.reason || 'Policy violation'}.`,
        priority: 'urgent',
        triggeredBy: req.user._id,
      });
    }

    await logAdminAction({
      admin: req.user,
      actionType: 'BAN_FROM_STREAMING',
      actionLabel: 'Ban User from Streaming',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Banned ${user.email} from live streaming`,
      reason: req.body.reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'User banned from streaming.', activeStreamsEnded: activeUserStreams.length });
  } catch (err) {
    console.error('banUserFromStreaming error:', err);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// Stub for getLiveStreamReports
const getLiveStreamReports = async (req, res) => {
  res.json({ success: true, reports: [], count: 0 });
};

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
module.exports = {
  checkLiveQualification,
  createLive,
  getLiveFeed,
  getStreamStatus,
  joinLive,
  checkLiveAccess,
  startStream,
  stopStream,
  getMyLives,
  purchaseLive,
  updateLiveStatus,
  shadowBanLive,
  deleteLive,
  setLivePrivilege,
  addLiveStrike,
  removeStrike,
  getUserLiveDetails,
  getAdminLiveStreams,
  getAdminLiveStreamDetails,
  endLiveStreamAdmin,
  sendStreamWarning,
  getLiveStreamReports,
  applyShadowBanToLive,
  removeShadowBanFromLive,
  banUserFromStreaming,
};