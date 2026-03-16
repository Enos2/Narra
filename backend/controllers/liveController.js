/**
 * File: backend/controllers/liveController.js
 * Description: Handles live stream creation, OBS-compatible RTMP ingestion,
 * HLS preview, access, moderation, paid streams, fundraiser/sponsorship,
 * RBAC, live privileges & strikes.
 * UPDATED: Added automatic qualification system and all admin moderation functions
 */

const Live = require('../models/Live');
const User = require('../models/User');
const Video = require('../models/Video');
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Check if user qualifies for live streaming
 */
const checkUserLiveQualification = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { qualified: false, reason: 'user_not_found' };
    
    // Check manual approval first
    if (user.canGoLive && user.canGoLiveReason === 'manual_admin_approval') {
      return { qualified: true, reason: 'manual_admin_approval' };
    }
    
    // Check auto-qualification
    return await user.checkLiveQualification();
  } catch (error) {
    console.error('Error checking live qualification:', error);
    return { qualified: false, reason: 'error' };
  }
};

/**
 * --------------------------
 * CREATE / SCHEDULE LIVE
 * --------------------------
 */
const createLive = async (req, res) => {
  try {
    // DEBUG: Log incoming request
    console.log('Create live request received:', {
      body: req.body,
      files: req.files,
      user: req.user ? req.user._id : 'No user'
    });

    // Check if req.body exists
    if (!req.body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Request body is empty or not properly parsed. Check Content-Type header.' 
      });
    }

    // Check user's live qualification
    const qualification = await checkUserLiveQualification(req.user._id);
    
    if (!qualification.qualified) {
      // Get user details for helpful error message
      const user = await User.findById(req.user._id);
      
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have live streaming privileges yet.',
        qualification,
        requirements: {
          needed: {
            approvedVideos: 3,
            totalViews: 500,
            accountAgeDays: 30,
            noActiveStrikes: true
          },
          current: {
            approvedVideos: user.approvedVideoCount || 0,
            totalViews: user.totalVideoViews || 0,
            accountAgeDays: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)),
            activeStrikes: user.liveStrikes?.filter(s => {
              const nineMonthsAgo = new Date(Date.now() - (9 * 30 * 24 * 60 * 60 * 1000));
              return new Date(s.date) > nineMonthsAgo;
            }).length || 0
          },
          helpMessage: 'Unlock live streaming by uploading 3 approved videos and reaching 500 total views on your content. Contact support for manual approval.'
        }
      });
    }
    
    if (req.user.isShadowBanned) {
      return res.status(403).json({ success: false, message: 'Shadow banned users cannot create live streams' });
    }

    // Extract with defaults to prevent destructuring error
    const {
   title = '',
   description = '',
   thumbnailUrl = '',
   scheduledAt = null,
   isPaid = false,
   price = 0,
   currency = 'USD',
   isSponsored = false,
   sponsorDescription = '',
   isFundraiser = false,
   fundraiserDescription = '',
   category = 'general',
   tags = [],
   ageRating = 'PG'
  } = req.body;

    // Parse tags if it's a JSON string
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (isSponsored && isFundraiser) {
      return res.status(400).json({ success: false, message: 'Cannot be both sponsored and fundraiser' });
    }

    // Generate unique stream key
    const streamKey = crypto.randomBytes(16).toString('hex');
    const rtmpServerUrl = process.env.RTMP_SERVER_URL || 'rtmp://localhost:1935/live';
    const streamUrl = `${rtmpServerUrl}/${streamKey}`;
    
    // HLS URL for web playback
    const hlsServerUrl = process.env.HLS_SERVER_URL || 'http://localhost:8000';
    const hlsUrl = `${hlsServerUrl}/live/${streamKey}/index.m3u8`;

    // Handle file uploads if present
    let finalThumbnailUrl = thumbnailUrl;
    if (req.files && req.files.thumbnailUrl) {
      // You would typically upload to cloud storage here
      // For now, use a placeholder or save path
      finalThumbnailUrl = `/uploads/thumbnails/${req.files.thumbnailUrl[0].filename}`;
    }

    const live = await Live.create({
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl: finalThumbnailUrl,
      host: req.user._id,
      status: scheduledAt ? 'scheduled' : 'pending',
      scheduledAt: scheduledAt || null,
      isPaid: Boolean(isPaid),
      price: isPaid ? (parseFloat(price) || 0) : 0,
      currency: currency || 'USD',
      purchases: [],
      isSponsored: Boolean(isSponsored),
      sponsorDescription: isSponsored ? sponsorDescription.trim() : '',
      isFundraiser: Boolean(isFundraiser),
      fundraiserDescription: isFundraiser ? fundraiserDescription.trim() : '',
      category: category || 'general',
      tags: parsedTags,
      ageRating: ageRating || 'PG',
      viewers: [],
      peakViewers: 0,
      totalViews: 0,
      isShadowBanned: false,
      isDeleted: false,
      approved: false,
      rejected: false,
      removalReason: '',
      streamKey,
      streamUrl,
      hlsUrl,
      startedAt: null,
      endedAt: null,
      duration: 0,
      chatEnabled: true,
      chatSlowMode: false
    });

    console.log('Live stream created successfully:', live._id);

    res.status(201).json({
      success: true,
      message: 'Live stream created successfully',
      live: { 
        ...live.toObject(), 
        streamKey, 
        streamUrl,
        hlsUrl,
        // RTMP settings for OBS
        obsSettings: {
          server: rtmpServerUrl,
          streamKey: streamKey,
          url: streamUrl
        }
      }
    });
  } catch (err) {
    console.error('Create live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create live stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * GET LIVE FEED
 * --------------------------
 */
const getLiveFeed = async (req, res) => {
  try {
    const lives = await Live.find({ 
      isDeleted: false, 
      isShadowBanned: false, 
      status: { $in: ['live', 'scheduled'] },
      approved: true 
    })
    .populate('host', 'name avatar isVerified')
    .sort({ startedAt: -1, scheduledAt: 1 })
    .lean();

    // Add HLS URLs for live streams
    const livesWithUrls = lives.map(live => ({
      ...live,
      playbackUrl: live.status === 'live' ? live.hlsUrl : null,
      isLive: live.status === 'live',
      viewerCount: live.viewers?.length || 0,
      canJoin: !live.isPaid || req.user?._id?.toString() === live.host._id.toString()
    }));

    res.json({ 
      success: true, 
      lives: livesWithUrls,
      count: livesWithUrls.length 
    });
  } catch (err) {
    console.error('Get live feed error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch live streams',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * CHECK LIVE ACCESS
 * --------------------------
 */
const checkLiveAccess = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    if (!live || live.isDeleted || live.status === 'cancelled' || live.isShadowBanned) {
      return res.status(404).json({ success: false, message: 'Live stream not available' });
    }

    // Check if stream is live
    if (live.status !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'Stream is not live',
        status: live.status,
        scheduledAt: live.scheduledAt
      });
    }

    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);
    const isHost = live.host.toString() === req.user._id.toString();
    
    const hasAccess =
      !live.isPaid ||
      live.purchases.some(p => p.user.toString() === req.user._id.toString()) ||
      isAdmin ||
      isHost;

    res.json({ 
      success: true, 
      hasAccess, 
      price: live.isPaid ? live.price : 0,
      isHost,
      isAdmin,
      playbackUrl: live.hlsUrl,
      title: live.title,
      hostId: live.host,
      chatEnabled: live.chatEnabled
    });
  } catch (err) {
    console.error('Check live access error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check live access',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * JOIN / WATCH LIVE
 * --------------------------
 */
const joinLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'name avatar isVerified');
    
    if (!live || live.isDeleted || live.isShadowBanned) {
      return res.status(404).json({ success: false, message: 'Live stream not available' });
    }

    // Check if stream is live
    if (live.status !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'Stream is not live',
        status: live.status,
        scheduledAt: live.scheduledAt
      });
    }

    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);
    const isHost = live.host._id.toString() === req.user._id.toString();
    
    const hasAccess =
      !live.isPaid ||
      live.purchases.some(p => p.user.toString() === req.user._id.toString()) ||
      isAdmin ||
      isHost;

    if (!hasAccess) {
      return res.status(402).json({ 
        success: false, 
        message: 'Payment required to watch this stream', 
        price: live.price 
      });
    }

    // Add viewer if not already watching
    if (!live.viewers.includes(req.user._id)) {
      live.viewers.push(req.user._id);
      live.totalViews += 1;
      live.peakViewers = Math.max(live.peakViewers, live.viewers.length);
      await live.save();
    }

    res.json({ 
      success: true, 
      live: {
        ...live.toObject(),
        playbackUrl: live.hlsUrl,
        viewerCount: live.viewers.length,
        isHost,
        chatEnabled: live.chatEnabled,
        chatSlowMode: live.chatSlowMode,
        isPaid: live.isPaid,
        price: live.price
      }
    });
  } catch (err) {
    console.error('Join live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to join live stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * START STREAM (when OBS connects)
 * --------------------------
 */
const startStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    // Check permissions
    if (live.host.toString() !== req.user._id.toString() && 
        !['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to start this stream' });
    }

    // Check if already live
    if (live.status === 'live') {
      return res.status(400).json({ success: false, message: 'Stream is already live' });
    }

    // Update stream status
    live.status = 'live';
    live.startedAt = new Date();
    live.viewers = [];
    await live.save();

    console.log(`📡 Stream started: ${live.title} (ID: ${live._id}) by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Stream started successfully',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        hlsUrl: live.hlsUrl,
        streamKey: live.streamKey,
        startedAt: live.startedAt,
        isLive: true
      }
    });
  } catch (err) {
    console.error('Start stream error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * STOP STREAM (when OBS disconnects)
 * --------------------------
 */
const stopStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    // Check permissions
    if (live.host.toString() !== req.user._id.toString() && 
        !['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to stop this stream' });
    }

    // Check if already ended
    if (live.status !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'Stream is not live',
        status: live.status
      });
    }

    // Calculate duration
    const endedAt = new Date();
    const duration = Math.floor((endedAt - live.startedAt) / 1000);

    // Update stream status
    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = duration;
    await live.save();

    console.log(`🛑 Stream ended: ${live.title} - Duration: ${duration}s, Viewers: ${live.viewers.length}`);

    res.json({
      success: true,
      message: 'Stream stopped successfully',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        duration: duration,
        peakViewers: live.peakViewers,
        totalViews: live.totalViews,
        endedAt: live.endedAt
      }
    });
  } catch (err) {
    console.error('Stop stream error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * GET STREAM STATUS
 * --------------------------
 */
const getStreamStatus = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'name avatar');
    
    if (!live || live.isDeleted) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    res.json({
      success: true,
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        isLive: live.status === 'live',
        startedAt: live.startedAt,
        endedAt: live.endedAt,
        duration: live.duration,
        viewers: live.viewers.length,
        peakViewers: live.peakViewers,
        totalViews: live.totalViews,
        host: live.host,
        hlsUrl: live.hlsUrl,
        streamKey: live.streamKey,
        chatEnabled: live.chatEnabled,
        isPaid: live.isPaid,
        price: live.price,
        isSponsored: live.isSponsored,
        isFundraiser: live.isFundraiser
      }
    });
  } catch (err) {
    console.error('Get stream status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get stream status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * PURCHASE LIVE
 * --------------------------
 */
const purchaseLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    const user = await User.findById(req.user._id);

    if (!live || !live.isPaid || live.isDeleted) {
      return res.status(400).json({ success: false, message: 'Invalid purchase' });
    }
    
    if (live.status !== 'live' && live.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Stream is not available for purchase' });
    }
    
    if (live.purchases.some(p => p.user.toString() === user._id.toString())) {
      return res.status(400).json({ success: false, message: 'Already purchased' });
    }
    
    if (user.balance < live.price) {
      return res.status(402).json({ success: false, message: 'Insufficient balance' });
    }

    user.balance -= live.price;
    live.purchases.push({ user: user._id });

    await Promise.all([user.save(), live.save()]);
    
    res.json({ 
      success: true, 
      message: 'Purchase successful',
      newBalance: user.balance
    });
  } catch (err) {
    console.error('Purchase live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Payment failed', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: UPDATE STATUS (APPROVE / REJECT / CANCEL)
 * --------------------------
 */
const updateLiveStatus = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { status, removalReason } = req.body;
    if (!['approved','rejected','cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found' });

    live.status = status === 'cancelled' ? 'cancelled' : live.status;
    live.approved = status === 'approved';
    live.rejected = status === 'rejected';
    live.removalReason = status === 'rejected' ? removalReason || 'No reason provided' : '';
    live.approvedBy = req.user._id;
    live.approvedAt = status === 'approved' ? new Date() : null;

    await live.save();
    
    res.json({ 
      success: true, 
      message: `Live stream ${status}`,
      live: live.toObject()
    });
  } catch (err) {
    console.error('Update live status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update live stream status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: GRANT / REVOKE LIVE PRIVILEGE
 * --------------------------
 */
const setLivePrivilege = async (req, res) => {
  try {
    const { userId, canGoLive, reason } = req.body;
    
    // Authorization check
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Permission hierarchy check
    // Support Admin can only view
    if (req.user.role === 'supportadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Support admin cannot grant/revoke live privileges' 
      });
    }

    // Check if trying to modify another admin
    const isTargetAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(targetUser.role);
    if (isTargetAdmin && req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admin can modify admin privileges' 
      });
    }

    // Update privilege
    if (canGoLive) {
      await targetUser.grantLivePrivilege(req.user._id);
      
      // Add admin action log
      targetUser.adminActions.push({
        actionType: 'GRANT_LIVE_PRIVILEGE',
        targetId: targetUser._id,
        targetModel: 'User',
        description: `${req.user.name} granted live streaming privileges to ${targetUser.name}`,
        performedBy: req.user._id,
        details: { reason: reason || 'Manual approval by admin' }
      });
    } else {
      await targetUser.revokeLivePrivilege(req.user._id, reason || 'Revoked by admin');
      
      // Add admin action log
      targetUser.adminActions.push({
        actionType: 'REVOKE_LIVE_PRIVILEGE',
        targetId: targetUser._id,
        targetModel: 'User',
        description: `${req.user.name} revoked live streaming privileges from ${targetUser.name}`,
        performedBy: req.user._id,
        details: { reason: reason || 'Revoked by admin' }
      });
    }

    await targetUser.save();

    // Get updated qualification status
    const qualification = await targetUser.checkLiveQualification();

    res.json({ 
      success: true, 
      message: `Live privileges ${canGoLive ? 'granted' : 'revoked'}`,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        canGoLive: targetUser.canGoLive,
        canGoLiveReason: targetUser.canGoLiveReason,
        canGoLiveGrantedAt: targetUser.canGoLiveGrantedAt,
        canGoLiveGrantedBy: targetUser.canGoLiveGrantedBy,
        approvedVideoCount: targetUser.approvedVideoCount,
        totalVideoViews: targetUser.totalVideoViews,
        liveStrikes: targetUser.liveStrikes.length,
        qualification
      }
    });
  } catch (err) {
    console.error('Set live privilege error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update live privilege',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: ADD LIVE STRIKE
 * --------------------------
 */
const addLiveStrike = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { userId, reason } = req.body;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add strike
    await targetUser.addLiveStrike(reason, req.user._id);

    // Add admin action log
    targetUser.adminActions.push({
      actionType: 'ADD_LIVE_STRIKE',
      targetId: targetUser._id,
      targetModel: 'User',
      description: `${req.user.name} added live strike to ${targetUser.name}`,
      performedBy: req.user._id,
      details: { reason }
    });

    await targetUser.save();

    // Check if user still qualifies for live streaming
    const qualification = await targetUser.checkLiveQualification();
    
    res.json({ 
      success: true, 
      message: 'Live strike added',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        liveStrikes: targetUser.liveStrikes.length,
        canGoLive: targetUser.canGoLive,
        canGoLiveReason: targetUser.canGoLiveReason,
        qualification
      }
    });
  } catch (err) {
    console.error('Add live strike error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add live strike',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: GET USER LIVE DETAILS
 * --------------------------
 */
const getUserLiveDetails = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const targetUser = await User.findById(req.params.userId)
      .select('name email canGoLive canGoLiveReason canGoLiveGrantedAt canGoLiveGrantedBy approvedVideoCount totalVideoViews liveStrikes isShadowBanned createdAt')
      .lean();

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Get user's live streams
    const userLives = await Live.find({ host: req.params.userId })
      .select('title status startedAt endedAt viewers peakViewers totalViews')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate qualification stats
    const accountAge = Math.floor((new Date() - new Date(targetUser.createdAt)) / (1000 * 60 * 60 * 24));
    const activeStrikes = targetUser.liveStrikes?.filter(s => {
      const nineMonthsAgo = new Date(Date.now() - (9 * 30 * 24 * 60 * 60 * 1000));
      return new Date(s.date) > nineMonthsAgo;
    }).length || 0;

    const qualifiesAutomatically = 
      targetUser.approvedVideoCount >= 3 && 
      targetUser.totalVideoViews >= 500 && 
      accountAge >= 30 && 
      activeStrikes === 0;

    res.json({
      success: true,
      user: {
        ...targetUser,
        liveStreams: userLives,
        totalStreams: userLives.length,
        activeStreams: userLives.filter(l => l.status === 'live').length,
        totalViewers: userLives.reduce((sum, live) => sum + (live.totalViews || 0), 0),
        accountAgeDays: accountAge,
        activeStrikes: activeStrikes,
        qualifiesAutomatically: qualifiesAutomatically,
        qualificationStatus: {
          approvedVideos: targetUser.approvedVideoCount || 0,
          totalViews: targetUser.totalVideoViews || 0,
          accountAgeDays: accountAge,
          activeStrikes: activeStrikes,
          meetsRequirements: qualifiesAutomatically,
          missingRequirements: {
            approvedVideos: Math.max(0, 3 - (targetUser.approvedVideoCount || 0)),
            totalViews: Math.max(0, 500 - (targetUser.totalVideoViews || 0)),
            accountAgeDays: Math.max(0, 30 - accountAge),
            noActiveStrikes: activeStrikes === 0
          }
        }
      }
    });
  } catch (err) {
    console.error('Get user live details error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user live details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: SHADOW BAN LIVE
 * --------------------------
 */
const shadowBanLive = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found' });

    live.isShadowBanned = true;
    await live.save();
    
    res.json({ 
      success: true, 
      message: 'Live stream shadow banned' 
    });
  } catch (err) {
    console.error('Shadow ban live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to shadow ban live stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: DELETE LIVE
 * --------------------------
 */
const deleteLive = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const live = await Live.findById(req.params.id);
    if (!live) return res.status(404).json({ success: false, message: 'Live stream not found' });

    live.isDeleted = true;
    await live.save();

    res.json({ 
      success: true, 
      message: 'Live stream deleted' 
    });
  } catch (err) {
    console.error('Delete live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete live stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * CHECK USER LIVE QUALIFICATION (PUBLIC)
 * --------------------------
 */
const checkLiveQualification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const qualification = await user.checkLiveQualification();
    
    res.json({
      success: true,
      qualification,
      user: {
        _id: user._id,
        name: user.name,
        canGoLive: user.canGoLive,
        canGoLiveReason: user.canGoLiveReason,
        approvedVideoCount: user.approvedVideoCount,
        totalVideoViews: user.totalVideoViews,
        liveStrikes: user.liveStrikes.length
      }
    });
  } catch (err) {
    console.error('Check live qualification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check live qualification',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * =====================================================
 * NEW ADMIN MODERATION FUNCTIONS (REQUIRED BY adminRoutes.js)
 * =====================================================
 */

/**
 * --------------------------
 * ADMIN: GET ALL LIVE STREAMS FOR MODERATION
 * --------------------------
 */
const getAdminLiveStreams = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let filter = { isDeleted: false };
    
    // Filter by status
    if (status) {
      filter.status = status;
    }
    
    // Search in title or description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const lives = await Live.find(filter)
      .populate('host', 'name email avatar isVerified isShadowBanned')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Live.countDocuments(filter);
    
    res.json({
      success: true,
      lives,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get admin live streams error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch live streams',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: GET DETAILED LIVE STREAM INFO
 * --------------------------
 */
const getAdminLiveStreamDetails = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id)
      .populate('host', 'name email avatar isVerified canGoLive liveStrikes')
      .populate('purchases.user', 'name email')
      .populate('viewers', 'name email')
      .populate('approvedBy', 'name email')
      .lean();

    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    // Get host's qualification status
    const hostQualification = await checkUserLiveQualification(live.host._id);
    
    // Get reports for this live stream (if you have a Report model)
    const reports = []; // You would fetch from Report model

    res.json({
      success: true,
      live: {
        ...live,
        hostQualification,
        reports
      }
    });
  } catch (err) {
    console.error('Get admin live stream details error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch live stream details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: FORCE END LIVE STREAM
 * --------------------------
 */
const endLiveStreamAdmin = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    if (live.status !== 'live') {
      return res.status(400).json({ 
        success: false, 
        message: 'Stream is not live',
        status: live.status
      });
    }

    // Calculate duration
    const endedAt = new Date();
    const duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;

    // Update stream status
    live.status = 'ended';
    live.endedAt = endedAt;
    live.duration = duration;
    live.adminEnded = true;
    live.adminEndedBy = req.user._id;
    live.adminEndedReason = req.body.reason || 'Terminated by admin';
    
    await live.save();

    // Add strike to user if reason indicates violation
    if (req.body.addStrike) {
      const host = await User.findById(live.host);
      if (host) {
        await host.addLiveStrike(
          `Stream terminated by admin: ${req.body.reason || 'Violation of terms'}`,
          req.user._id
        );
      }
    }

    console.log(`🛑 Admin ended stream: ${live.title} by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Live stream terminated by admin',
      live: {
        _id: live._id,
        title: live.title,
        status: live.status,
        adminEnded: true,
        adminEndedBy: req.user._id,
        adminEndedReason: live.adminEndedReason
      }
    });
  } catch (err) {
    console.error('Admin end stream error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to end stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: SEND WARNING/STRIKE TO STREAMER
 * --------------------------
 */
const sendStreamWarning = async (req, res) => {
  try {
    const { warningType, reason, addStrike } = req.body;
    
    const live = await Live.findById(req.params.id)
      .populate('host', 'name email');
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    const host = await User.findById(live.host._id);
    if (!host) {
      return res.status(404).json({ success: false, message: 'Host not found' });
    }

    let message = '';
    
    if (addStrike) {
      await host.addLiveStrike(reason || 'Live stream violation', req.user._id);
      message = 'Strike added to user';
    } else {
      // Just send warning (no strike)
      message = 'Warning sent to user';
    }

    // Create warning record (you might want to save this in a separate collection)
    const warning = {
      type: warningType || 'general',
      reason: reason || 'Violation of community guidelines',
      liveStreamId: live._id,
      issuedBy: req.user._id,
      issuedAt: new Date(),
      addStrike: Boolean(addStrike)
    };

    // You might want to save this to a Warnings collection
    // await Warning.create(warning);

    // Check if user still qualifies for live streaming
    const qualification = await host.checkLiveQualification();

    res.json({
      success: true,
      message,
      warning,
      user: {
        _id: host._id,
        name: host.name,
        liveStrikes: host.liveStrikes.length,
        canGoLive: host.canGoLive,
        canGoLiveReason: host.canGoLiveReason,
        qualification
      }
    });
  } catch (err) {
    console.error('Send stream warning error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send warning',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: GET LIVE STREAM REPORTS
 * --------------------------
 */
const getLiveStreamReports = async (req, res) => {
  try {
    // This function depends on your Report model
    // Assuming you have a Report model that references live streams
    
    const reports = []; // Placeholder - fetch from Report model
    
    // Example implementation:
    /*
    const reports = await Report.find({ 
      targetType: 'live', 
      targetId: req.params.id,
      resolved: false 
    })
    .populate('reportedBy', 'name email')
    .populate('resolvedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
    */

    res.json({
      success: true,
      reports,
      count: reports.length
    });
  } catch (err) {
    console.error('Get live stream reports error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch reports',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: APPLY SHADOW BAN TO LIVE STREAM
 * --------------------------
 */
const applyShadowBanToLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    live.isShadowBanned = true;
    live.shadowBanReason = req.body.reason || 'Violation of community guidelines';
    live.shadowBannedBy = req.user._id;
    live.shadowBannedAt = new Date();
    
    await live.save();

    res.json({
      success: true,
      message: 'Live stream shadow banned',
      live: {
        _id: live._id,
        title: live.title,
        isShadowBanned: live.isShadowBanned,
        shadowBanReason: live.shadowBanReason,
        shadowBannedAt: live.shadowBannedAt
      }
    });
  } catch (err) {
    console.error('Apply shadow ban to live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to shadow ban live stream',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: REMOVE SHADOW BAN FROM LIVE STREAM
 * --------------------------
 */
const removeShadowBanFromLive = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    
    if (!live) {
      return res.status(404).json({ success: false, message: 'Live stream not found' });
    }

    live.isShadowBanned = false;
    live.shadowBanReason = null;
    live.shadowBannedBy = null;
    live.shadowBannedAt = null;
    
    await live.save();

    res.json({
      success: true,
      message: 'Shadow ban removed from live stream',
      live: {
        _id: live._id,
        title: live.title,
        isShadowBanned: live.isShadowBanned
      }
    });
  } catch (err) {
    console.error('Remove shadow ban from live error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove shadow ban',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: REMOVE STRIKE FROM USER
 * --------------------------
 */
const removeStrike = async (req, res) => {
  try {
    const { id: userId, strikeId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the strike
    const strikeIndex = user.liveStrikes.findIndex(
      strike => strike._id.toString() === strikeId
    );

    if (strikeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Strike not found' });
    }

    // Remove the strike
    const removedStrike = user.liveStrikes[strikeIndex];
    user.liveStrikes.splice(strikeIndex, 1);
    
    await user.save();

    // Check if user now qualifies for live streaming
    const qualification = await user.checkLiveQualification();

    res.json({
      success: true,
      message: 'Strike removed successfully',
      removedStrike,
      user: {
        _id: user._id,
        name: user.name,
        liveStrikes: user.liveStrikes.length,
        canGoLive: user.canGoLive,
        canGoLiveReason: user.canGoLiveReason,
        qualification
      }
    });
  } catch (err) {
    console.error('Remove strike error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove strike',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * ADMIN: BAN USER FROM STREAMING
 * --------------------------
 */
const banUserFromStreaming = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Revoke live privileges
    await user.revokeLivePrivilege(
      req.user._id, 
      req.body.reason || 'Banned from streaming by admin'
    );

    // Add admin action log
    user.adminActions.push({
      actionType: 'BAN_FROM_STREAMING',
      targetId: user._id,
      targetModel: 'User',
      description: `${req.user.name} banned ${user.name} from streaming`,
      performedBy: req.user._id,
      details: { reason: req.body.reason || 'Banned from streaming' }
    });

    await user.save();

    // End any active streams by this user
    const activeStreams = await Live.find({ 
      host: user._id, 
      status: 'live' 
    });
    
    for (const stream of activeStreams) {
      stream.status = 'ended';
      stream.endedAt = new Date();
      stream.adminEnded = true;
      stream.adminEndedBy = req.user._id;
      stream.adminEndedReason = 'Host banned from streaming';
      await stream.save();
    }

    res.json({
      success: true,
      message: 'User banned from streaming',
      user: {
        _id: user._id,
        name: user.name,
        canGoLive: user.canGoLive,
        canGoLiveReason: user.canGoLiveReason,
        activeStreamsEnded: activeStreams.length
      }
    });
  } catch (err) {
    console.error('Ban user from streaming error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to ban user from streaming',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * EXPORT - NOW INCLUDES ALL ADMIN MODERATION FUNCTIONS
 * --------------------------
 */
module.exports = {
  // User functions
  createLive,
  getLiveFeed,
  checkLiveAccess,
  joinLive,
  purchaseLive,
  checkLiveQualification,
  
  // Stream control functions
  startStream,
  stopStream,
  getStreamStatus,
  
  // Admin moderation functions (existing)
  updateLiveStatus,
  shadowBanLive,
  deleteLive,
  setLivePrivilege,
  addLiveStrike,
  getUserLiveDetails,
  
  // NEW: Admin live moderation functions (required by adminRoutes.js)
  getAdminLiveStreams,
  getAdminLiveStreamDetails,
  endLiveStreamAdmin,
  sendStreamWarning,
  getLiveStreamReports,
  applyShadowBanToLive,
  removeShadowBanFromLive,
  removeStrike,
  banUserFromStreaming
};