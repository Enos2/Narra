/**
 * File: backend/controllers/videoController.js
 * Description: Handles all video operations – upload, watch, purchase, edit,
 * admin moderation, shadow ban, RBAC enforcement, age restrictions, and paid access.
 * FULLY UPDATED: Added like/dislike, share tracking, and improved comment handling
 * UPDATED: Added getRecommendedVideos function and ObjectId validation
 * UPDATED: Added notification calls for upload, approval, rejection, removal, restore
 */

const Video = require('../models/Video');
const User = require('../models/User');
const AdminActionLog = require('../models/AdminActionLog');
const History = require('../models/History');
const mongoose = require('mongoose');
const NotificationService = require('../services/notificationService');

/**
 * --------------------------
 * UPLOAD VIDEO (MOVIES & SERIES) - FIXED: Status explicitly set to pending
 * --------------------------
 */
const uploadVideo = async (req, res) => {
  console.log('=== UPLOAD VIDEO START ===');
  console.log('User ID:', req.user?._id);
  
  try {
    // Check if user can upload
    if (!req.user || !req.user._id) {
      console.log('ERROR: No user found');
      return res.status(401).json({ success: false, message: 'Unauthorized - No user found' });
    }

    const {
      title,
      description = '',
      type = 'movie',
      genre = '[]',
      tags = '[]',
      ageRating = 'G',
      language = 'English',
      subtitles = '[]',
      isPaid = 'false',
      price = '0',
      currency = 'USD',
      isSponsored = 'false',
      sponsorDescription = '',
      isFundraiser = 'false',
      fundraiserDescription = '',
      fundraiserGoal = '0',
      seasons = '[]',
      releaseOption = 'immediate',
      releaseDate,
      isPrivate = 'false',
      commentsDisabled = 'false',
      contentFlags = '{}'
    } = req.body;

    console.log('Parsing form data...');
    
    // Parse JSON fields
    let parsedGenre, parsedTags, parsedSeasons, parsedSubtitles, parsedContentFlags;
    try {
      parsedGenre = genre ? JSON.parse(genre) : [];
      parsedTags = tags ? JSON.parse(tags) : [];
      parsedSeasons = type === 'series' && seasons ? JSON.parse(seasons) : [];
      parsedSubtitles = subtitles ? JSON.parse(subtitles) : [];
      parsedContentFlags = contentFlags ? JSON.parse(contentFlags) : { 
        violence: false, 
        sex: false, 
        language: false, 
        graphic: false 
      };
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
      
      // Send upload failure notification for parsing error
      await NotificationService.notifyUploadFailure(
        req.user._id,
        title || 'your video',
        'invalid_format',
        'Invalid JSON format in form fields'
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid JSON format in one or more fields' 
      });
    }

    // Validate required fields
    if (!title || !ageRating) {
      console.log('ERROR: Missing required fields');
      
      await NotificationService.notifyUploadFailure(
        req.user._id,
        'your video',
        'missing_fields',
        'Title and age rating are required'
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Title and age rating are required' 
      });
    }

    // Validate series structure
    if (type === 'series') {
      if (!parsedSeasons || !Array.isArray(parsedSeasons) || parsedSeasons.length === 0) {
        await NotificationService.notifyUploadFailure(
          req.user._id,
          title,
          'missing_fields',
          'Series must have at least one season'
        );
        
        return res.status(400).json({ 
          success: false, 
          message: 'Series must have at least one season' 
        });
      }
    }

    // Check for required files
    if (!req.files || !req.files.thumbnail) {
      console.log('ERROR: No thumbnail file');
      
      await NotificationService.notifyUploadFailure(
        req.user._id,
        title || 'your video',
        'no_thumbnail',
        'Thumbnail is required for video upload'
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Thumbnail is required' 
      });
    }

    if (type === 'movie' && (!req.files.video || !req.files.video[0])) {
      console.log('ERROR: No video file for movie');
      
      await NotificationService.notifyUploadFailure(
        req.user._id,
        title,
        'missing_fields',
        'Video file is required for movies'
      );
      
      return res.status(400).json({ 
        success: false, 
        message: 'Video file is required for movies' 
      });
    }

    // Handle thumbnail
    const thumbnailFile = req.files.thumbnail[0];
    const thumbnailUrl = `/uploads/thumbnails/${thumbnailFile.filename}`;
    console.log('Thumbnail URL:', thumbnailUrl);

    // Create video document with status explicitly set to 'pending'
    const videoData = {
      title,
      description: description || title,
      thumbnailUrl,
      creator: req.user._id,
      type,
      genre: parsedGenre,
      tags: parsedTags,
      ageRating,
      contentFlags: parsedContentFlags,
      language,
      subtitles: parsedSubtitles,
      isPaid: isPaid === 'true',
      price: parseFloat(price) || 0,
      currency,
      isSponsored: isSponsored === 'true',
      sponsorDescription: isSponsored === 'true' ? sponsorDescription : '',
      isFundraiser: isFundraiser === 'true',
      fundraiserDescription: isFundraiser === 'true' ? fundraiserDescription : '',
      fundraiserGoal: parseFloat(fundraiserGoal) || 0,
      releaseOption,
      releaseDate: releaseOption === 'schedule' && releaseDate ? new Date(releaseDate) : null,
      scheduledReleaseDate: releaseOption === 'schedule' && releaseDate ? new Date(releaseDate) : null,
      isPrivate: isPrivate === 'true',
      commentsDisabled: commentsDisabled === 'true',
      views: 0,
      uniqueViews: 0,
      likes: [],
      dislikes: [],
      ratings: [],
      averageRating: 0,
      status: 'pending',
      approved: false,
      rejected: false,
      released: false,
      isDeleted: false,
      blockedCountries: [],
      blockedContinents: [],
      isShadowBanned: false,
      hideEngagement: false,
      uploadedAt: new Date(),
      seasons: parsedSeasons,
      totalSeasons: parsedSeasons.length,
      totalEpisodes: parsedSeasons.reduce((total, season) => total + (season.episodes ? season.episodes.length : 0), 0)
    };

    console.log(`✅ Video status set to: ${videoData.status}`);

    // Handle movie video file
    if (type === 'movie' && req.files.video && req.files.video[0]) {
      const videoFile = req.files.video[0];
      videoData.videoUrl = `/uploads/videos/${videoFile.filename}`;
      videoData.filePath = videoFile.path;
      console.log('Movie video URL:', videoData.videoUrl);
      
      if (req.files.trailer && req.files.trailer[0]) {
        const trailerFile = req.files.trailer[0];
        videoData.trailerUrl = `/uploads/trailers/${trailerFile.filename}`;
        console.log('Trailer URL:', videoData.trailerUrl);
      }
    }

    // Process series files
    if (type === 'series' && parsedSeasons.length > 0) {
      console.log('Processing series files...');
      
      for (let s = 0; s < parsedSeasons.length; s++) {
        const seasonKey = `season-${s}-trailer`;
        if (req.files[seasonKey] && req.files[seasonKey][0]) {
          const trailerFile = req.files[seasonKey][0];
          parsedSeasons[s].trailerUrl = `/uploads/trailers/${trailerFile.filename}`;
        }

        if (parsedSeasons[s].episodes) {
          for (let e = 0; e < parsedSeasons[s].episodes.length; e++) {
            const videoKey = `season-${s}-episode-${e}-video`;
            const episodeTrailerKey = `season-${s}-episode-${e}-trailer`;

            if (req.files[videoKey] && req.files[videoKey][0]) {
              const videoFile = req.files[videoKey][0];
              parsedSeasons[s].episodes[e].videoUrl = `/uploads/videos/${videoFile.filename}`;
              parsedSeasons[s].episodes[e].filePath = videoFile.path;
            }

            if (req.files[episodeTrailerKey] && req.files[episodeTrailerKey][0]) {
              const trailerFile = req.files[episodeTrailerKey][0];
              parsedSeasons[s].episodes[e].trailerUrl = `/uploads/trailers/${trailerFile.filename}`;
            }

            if (!parsedSeasons[s].episodes[e].episodeNumber) {
              parsedSeasons[s].episodes[e].episodeNumber = e + 1;
            }
            if (!parsedSeasons[s].episodes[e].order) {
              parsedSeasons[s].episodes[e].order = e + 1;
            }
            
            parsedSeasons[s].episodes[e].published = false;
            parsedSeasons[s].episodes[e].price = 0;
          }
        }

        if (!parsedSeasons[s].seasonNumber) {
          parsedSeasons[s].seasonNumber = s + 1;
        }
        if (!parsedSeasons[s].order) {
          parsedSeasons[s].order = s + 1;
        }
        
        parsedSeasons[s].isPublished = false;
      }
      
      videoData.seasons = parsedSeasons;
    }

    console.log('Creating video with data:', {
      title: videoData.title,
      type: videoData.type,
      creator: videoData.creator,
      status: videoData.status,
      seasonsCount: videoData.seasons?.length || 0
    });

    let video;
    try {
      video = await Video.createVideo(videoData);
      console.log('✅ Video created successfully:', video._id);
      console.log('   Video status:', video.status);
      console.log('   Creator ID:', video.creator);
      
      // ✅ Send upload success notification
      await NotificationService.notifyUploadSuccess(
        req.user._id,
        video.title,
        video._id
      );
      
    } catch (createErr) {
      console.error('❌ Error creating video:', createErr);
      
      let errorReason = 'unknown';
      let errorMessage = createErr.message;
      
      if (createErr.name === 'ValidationError') {
        const errors = Object.values(createErr.errors).map(e => e.message);
        console.error('Validation errors:', errors);
        errorReason = 'validation_failed';
        errorMessage = errors.join(', ');
      } else if (createErr.code === 11000) {
        console.error('Duplicate key error');
        errorReason = 'duplicate';
        errorMessage = 'A video with this title already exists';
      }
      
      // Send upload failure notification
      await NotificationService.notifyUploadFailure(
        req.user._id,
        title || 'your video',
        errorReason,
        errorMessage
      );
      
      if (createErr.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Video validation failed',
          errors: Object.values(createErr.errors).map(e => e.message)
        });
      }
      
      if (createErr.code === 11000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Duplicate video detected' 
        });
      }
      
      throw createErr;
    }

    await video.populate('creator', 'name email avatar');

    console.log('=== UPLOAD VIDEO SUCCESS ===');
    
    res.status(201).json({ 
      success: true, 
      message: `${type === 'movie' ? 'Movie' : 'Series'} uploaded successfully, awaiting admin approval`,
      video: {
        ...video.toObject(),
        moderationStatus: 'pending',
        releaseStatus: 'pending_approval'
      }
    });
  } catch (err) {
    console.error('=== UPLOAD VIDEO ERROR ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Full error:', err);
    
    // Send upload failure notification for unexpected errors
    if (req.user && req.user._id) {
      await NotificationService.notifyUploadFailure(
        req.user._id,
        req.body.title || 'your video',
        'server_error',
        err.message
      );
    }
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      console.error('Validation errors:', messages);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: messages 
      });
    }

    console.error('=== UPLOAD VIDEO ERROR END ===');
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET VIDEO FEED - FIXED: Strict filtering for unauthenticated users
 * --------------------------
 */
const getVideoFeed = async (req, res) => {
  try {
    const { 
      type, 
      genre, 
      page = 1, 
      limit = 20,
      search,
      sortBy = 'uploadedAt',
      sortOrder = 'desc',
      userId
    } = req.query;

    // Base query for publicly accessible videos
    const query = { 
      status: 'released',
      isDeleted: false, 
      isShadowBanned: false
    };

    // CRITICAL FIX: For unauthenticated users, only show free, public videos
    if (!req.user) {
      query.isPaid = false;
      query.isPrivate = false;
    }

    if (userId) {
      query.creator = userId;
    }

    if (type) {
      query.type = type;
    }

    if (genre) {
      query.genre = genre;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    query.$or = [
      { releaseOption: 'immediate' },
      { 
        releaseOption: 'schedule',
        scheduledReleaseDate: { $lte: new Date() }
      }
    ];

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const videos = await Video.find(query)
      .populate('creator', 'name email avatar isVerified')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const formattedVideos = videos.map(video => ({
      ...video,
      moderationStatus: video.status,
      releaseStatus: video.status === 'released' ? 'released' : 'not_released',
      totalEpisodes: video.totalEpisodes || 0,
      totalSeasons: video.totalSeasons || 0,
      totalDuration: video.type === 'series' ? 
        video.seasons?.reduce((total, season) => 
          total + (season.episodes?.reduce((epTotal, ep) => 
            epTotal + (ep.duration || 0), 0) || 0), 0) || 0 : 
        video.duration || 0,
      isAccessible: true,
      requiresAuth: !req.user && video.isPaid,
      isFree: !video.isPaid
    }));

    const total = await Video.countDocuments(query);

    res.json({ 
      success: true, 
      videos: formattedVideos,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      hasMore: skip + videos.length < total
    });
  } catch (err) {
    console.error('Get video feed error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch video feed', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET RECOMMENDED VIDEOS - NEW FUNCTION
 * --------------------------
 */
const getRecommendedVideos = async (req, res) => {
  try {
    const { exclude, limit = 10 } = req.query;
    
    console.log('Getting recommended videos - exclude:', exclude, 'limit:', limit);
    
    const query = { 
      status: 'released',
      isDeleted: false,
      isShadowBanned: false
    };
    
    if (exclude && mongoose.Types.ObjectId.isValid(exclude)) {
      query._id = { $ne: exclude };
    }
    
    if (!req.user) {
      query.isPaid = false;
      query.isPrivate = false;
    }
    
    const videos = await Video.find(query)
      .populate('creator', 'name email avatar isVerified')
      .sort({ views: -1, uploadedAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      views: video.views,
      uploadedAt: video.uploadedAt,
      duration: video.duration,
      creator: video.creator,
      type: video.type,
      isPaid: video.isPaid,
      ageRating: video.ageRating
    }));
    
    console.log(`Found ${formattedVideos.length} recommended videos`);
    
    res.json({
      success: true,
      videos: formattedVideos,
      count: formattedVideos.length
    });
  } catch (err) {
    console.error('Get recommended videos error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recommended videos',
      videos: []
    });
  }
};

/**
 * ========================================
 * LIKE / DISLIKE FUNCTIONS
 * ========================================
 */

const likeVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (video.status !== 'released' || video.isDeleted) {
      return res.status(403).json({ success: false, message: 'Video not available' });
    }

    const alreadyLiked = video.likes.some(id => id.toString() === userId.toString());
    
    if (alreadyLiked) {
      video.likes = video.likes.filter(id => id.toString() !== userId.toString());
      await video.save();
      
      await User.findByIdAndUpdate(userId, {
        $pull: { likedVideos: id }
      });

      return res.json({
        success: true,
        action: 'unliked',
        message: 'Removed like',
        likes: video.likes.length,
        dislikes: video.dislikes.length
      });
    }

    const alreadyDisliked = video.dislikes.some(id => id.toString() === userId.toString());
    if (alreadyDisliked) {
      video.dislikes = video.dislikes.filter(id => id.toString() !== userId.toString());
    }

    video.likes.push(userId);
    await video.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { likedVideos: id }
    });

    res.json({
      success: true,
      action: 'liked',
      message: 'Video liked',
      likes: video.likes.length,
      dislikes: video.dislikes.length
    });
  } catch (err) {
    console.error('Like video error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to like video',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const dislikeVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (video.status !== 'released' || video.isDeleted) {
      return res.status(403).json({ success: false, message: 'Video not available' });
    }

    const alreadyDisliked = video.dislikes.some(id => id.toString() === userId.toString());
    
    if (alreadyDisliked) {
      video.dislikes = video.dislikes.filter(id => id.toString() !== userId.toString());
      await video.save();

      return res.json({
        success: true,
        action: 'undisliked',
        message: 'Removed dislike',
        likes: video.likes.length,
        dislikes: video.dislikes.length
      });
    }

    const alreadyLiked = video.likes.some(id => id.toString() === userId.toString());
    if (alreadyLiked) {
      video.likes = video.likes.filter(id => id.toString() !== userId.toString());
      
      await User.findByIdAndUpdate(userId, {
        $pull: { likedVideos: id }
      });
    }

    video.dislikes.push(userId);
    await video.save();

    res.json({
      success: true,
      action: 'disliked',
      message: 'Video disliked',
      likes: video.likes.length,
      dislikes: video.dislikes.length
    });
  } catch (err) {
    console.error('Dislike video error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to dislike video',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const getVideoInteractionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(id).select('likes dislikes');
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const hasLiked = video.likes.some(uid => uid.toString() === userId.toString());
    const hasDisliked = video.dislikes.some(uid => uid.toString() === userId.toString());

    res.json({
      success: true,
      hasLiked,
      hasDisliked,
      likesCount: video.likes.length,
      dislikesCount: video.dislikes.length
    });
  } catch (err) {
    console.error('Get interaction status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get interaction status'
    });
  }
};

/**
 * ========================================
 * SHARE TRACKING FUNCTION
 * ========================================
 */

const trackShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { platform } = req.body;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    try {
      await AdminActionLog.create({
        admin: userId || null,
        action: 'SHARE_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { 
          title: video.title, 
          platform: platform || 'unknown',
          sharedBy: userId || 'anonymous'
        }
      });
    } catch (logErr) {
      console.error('Failed to log share:', logErr);
    }

    console.log(`📤 Video shared: ${video.title} on ${platform || 'unknown'} by ${userId || 'anonymous'}`);

    res.json({
      success: true,
      message: 'Share tracked successfully'
    });
  } catch (err) {
    console.error('Track share error:', err);
    res.json({
      success: true,
      message: 'Share tracked'
    });
  }
};

/**
 * ========================================
 * WATCH HISTORY WITH RESUME
 * ========================================
 */

const recordWatchProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, duration, seasonNumber, episodeNumber } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const percentWatched = duration > 0 ? (progress / duration) * 100 : 0;
    const completed = percentWatched >= 95;

    let history = await History.findOne({
      user: userId,
      video: id,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
    });

    if (history) {
      history.progress = progress;
      history.duration = duration;
      history.percentWatched = percentWatched;
      history.completed = completed;
      history.lastWatchedAt = new Date();
      history.watchCount += 1;
    } else {
      history = new History({
        user: userId,
        video: id,
        seasonNumber: seasonNumber || null,
        episodeNumber: episodeNumber || null,
        progress,
        duration,
        percentWatched,
        completed,
        lastWatchedAt: new Date(),
        watchCount: 1,
      });
    }

    await history.save();

    res.json({
      success: true,
      message: 'Progress recorded',
      shouldResume: history.shouldResume(),
      percentWatched: history.percentWatched
    });
  } catch (err) {
    console.error('Record watch progress error:', err);
    res.json({ success: true, message: 'Progress recorded' });
  }
};

const getResumePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { seasonNumber, episodeNumber } = req.query;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.json({ success: true, resumePosition: 0, shouldResume: false });
    }

    const history = await History.findOne({
      user: userId,
      video: id,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
    });

    if (!history || history.completed || history.percentWatched < 5) {
      return res.json({
        success: true,
        hasHistory: false,
        resumePosition: 0,
        shouldResume: false
      });
    }

    res.json({
      success: true,
      hasHistory: true,
      resumePosition: history.progress,
      percentWatched: history.percentWatched,
      shouldResume: history.shouldResume(),
      lastWatchedAt: history.lastWatchedAt
    });
  } catch (err) {
    console.error('Get resume position error:', err);
    res.json({ success: true, resumePosition: 0, shouldResume: false });
  }
};

/**
 * --------------------------
 * GET VIDEOS BY STATUS (for user dashboard)
 * --------------------------
 */
const getVideosByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { userId } = req.query;
    
    console.log('========================================');
    console.log('📹 getVideosByStatus CALLED');
    console.log('   Status requested:', status);
    console.log('   User ID from query:', userId);
    console.log('   Auth user ID:', req.user?._id);
    console.log('========================================');

    if (!['pending', 'approved', 'released', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status parameter',
        videos: [] 
      });
    }

    const targetUserId = userId || (req.user?._id?.toString());
    
    if (!targetUserId) {
      console.error('getVideosByStatus: No userId provided and no authenticated user');
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        videos: []
      });
    }

    console.log(`   Target User ID: ${targetUserId}`);

    let videos = [];
    let approach = '';

    try {
      approach = 'ObjectId comparison';
      videos = await Video.find({ 
        creator: targetUserId, 
        status: status,
        isDeleted: false 
      })
      .populate('creator', 'name email avatar')
      .sort({ createdAt: -1, uploadedAt: -1 });
      
      console.log(`✅ Approach 1 (${approach}) found ${videos.length} ${status} videos`);
      
      if (videos.length === 0) {
        approach = 'String comparison with $expr';
        videos = await Video.find({ 
          $expr: { $eq: [{ $toString: "$creator" }, targetUserId] },
          status: status,
          isDeleted: false 
        })
        .populate('creator', 'name email avatar')
        .sort({ createdAt: -1, uploadedAt: -1 });
        
        console.log(`✅ Approach 2 (${approach}) found ${videos.length} ${status} videos`);
      }
      
      if (videos.length === 0) {
        approach = 'Manual filtering';
        console.log(`⚠️ No videos found with direct queries, trying manual check...`);
        
        const allVideosWithStatus = await Video.find({ 
          status: status,
          isDeleted: false 
        })
        .populate('creator', 'name email avatar')
        .sort({ createdAt: -1, uploadedAt: -1 });
        
        videos = allVideosWithStatus.filter(video => {
          const videoCreatorId = 
            video.creator?._id?.toString() || 
            video.creator?.toString() || 
            (typeof video.creator === 'object' ? JSON.stringify(video.creator) : null);
          
          const matches = videoCreatorId === targetUserId;
          
          if (matches) {
            console.log(`   ✅ Manual match found: Video "${video.title}" (${video._id})`);
          }
          
          return matches;
        });
        
        console.log(`✅ Approach 3 (${approach}) found ${videos.length} ${status} videos`);
      }
      
      if (videos.length > 0) {
        console.log(`   First video: "${videos[0].title}" (ID: ${videos[0]._id})`);
        console.log(`   Creator: ${videos[0].creator?.name || 'Unknown'}`);
      } else {
        console.log(`   No ${status} videos found for user ${targetUserId}`);
        
        const anyVideos = await Video.find({ 
          isDeleted: false 
        }).limit(5).lean();
        
        console.log(`   Sample of any videos in DB (first 5):`);
        anyVideos.forEach((v, i) => {
          const creatorInfo = v.creator ? 
            (v.creator._id || v.creator).toString() : 'null';
          console.log(`     ${i+1}. "${v.title}" - Creator: ${creatorInfo} (${typeof v.creator})`);
        });
      }

    } catch (dbError) {
      console.error(`❌ Database error fetching ${status} videos:`, dbError);
      return res.json({
        success: true,
        status,
        videos: []
      });
    }

    res.json({
      success: true,
      status,
      videos: videos.map(video => ({
        ...video.toObject(),
        moderationStatus: video.status,
        releaseStatus: video.status === 'approved' ? 'approved_for_release' : 
                      video.status === 'released' ? 'released' : 
                      video.status === 'rejected' ? 'rejected' : 'pending',
        canRelease: video.status === 'approved',
        totalEpisodes: video.totalEpisodes || 0,
        totalSeasons: video.totalSeasons || 0,
        publishedEpisodesCount: video.publishedEpisodesCount || 0,
      }))
    });
    
  } catch (err) {
    console.error('❌ Get videos by status ERROR:', err);
    console.error('   Stack:', err.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch videos',
      videos: [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * GET APPROVED VIDEOS FOR RELEASE
 * --------------------------
 */
const getApprovedForRelease = async (req, res) => {
  try {
    const { userId } = req.query;
    
    console.log('========================================');
    console.log('📹 getApprovedForRelease CALLED');
    console.log('   User ID from query:', userId);
    console.log('   Auth user ID:', req.user?._id);
    console.log('========================================');

    const targetUserId = userId || (req.user?._id?.toString());
    
    if (!targetUserId) {
      console.error('getApprovedForRelease: No userId provided and no authenticated user');
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        videos: []
      });
    }

    console.log(`   Target User ID: ${targetUserId}`);

    let videos = [];

    videos = await Video.find({
      creator: targetUserId,
      status: 'approved',
      isDeleted: false
    })
    .populate('creator', 'name email avatar')
    .sort({ approvedAt: -1 })
    .lean();

    if (videos.length === 0) {
      videos = await Video.find({
        $expr: { $eq: [{ $toString: "$creator" }, targetUserId] },
        status: 'approved',
        isDeleted: false
      })
      .populate('creator', 'name email avatar')
      .sort({ approvedAt: -1 })
      .lean();
    }

    console.log(`Found ${videos.length} approved videos for release for user ${targetUserId}`);
    
    if (videos.length > 0) {
      console.log('Sample approved video creator:', videos[0].creator);
    }

    res.json({
      success: true,
      videos: videos.map(video => ({
        ...video,
        canRelease: true,
        releaseStatus: 'approved_for_release',
        totalEpisodes: video.totalEpisodes || 0,
        totalSeasons: video.totalSeasons || 0,
        publishedEpisodesCount: video.publishedEpisodesCount || 0,
      }))
    });
  } catch (err) {
    console.error('Get approved for release error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approved videos',
      videos: [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * RELEASE VIDEO
 * --------------------------
 */
const releaseVideo = async (req, res) => {
  try {
    const { price, currency = 'USD', releaseAllEpisodes = false } = req.body;
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (video.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to release this video' });
    }

    if (!video.approved || video.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Video must be approved by admin before release'
      });
    }

    if (video.status === 'released') {
      return res.status(400).json({
        success: false,
        message: 'Video already released'
      });
    }

    console.log('=== RELEASE VIDEO DEBUG ===');
    console.log('Video ID:', video._id);
    console.log('Title:', video.title);
    console.log('Before release - status:', video.status);
    console.log('Before release - released:', video.released);
    console.log('Before release - approved:', video.approved);

    video.status = 'released';
    video.released = true;
    video.approved = true;
    video.rejected = false;
    video.releasedBy = req.user._id;
    video.releasedAt = new Date();
    video.publishedAt = new Date();
    
    console.log('After setting fields - status:', video.status);
    console.log('After setting fields - released:', video.released);

    if (price !== undefined) {
      video.price = parseFloat(price);
      video.releasePrice = parseFloat(price);
      video.isPaid = price > 0;
      video.releaseCurrency = currency;
    }

    if (video.type === 'series') {
      if (releaseAllEpisodes) {
        video.seasons.forEach(season => {
          season.isPublished = true;
          season.publishedAt = new Date();
          if (season.episodes && Array.isArray(season.episodes)) {
            season.episodes.forEach(episode => {
              episode.published = true;
              episode.publishedAt = new Date();
            });
          }
        });
      }
    }

    await video.save({ validateBeforeSave: true });

    const afterSave = await Video.findById(video._id);
    console.log('After save from DB - status:', afterSave.status);
    console.log('After save from DB - released:', afterSave.released);
    console.log('After save from DB - approved:', afterSave.approved);
    console.log('=== RELEASE VIDEO DEBUG END ===');

    console.log(`✅ Video released successfully: ${video._id}`);
    console.log(`   Title: ${video.title}`);
    console.log(`   Status: ${video.status}`);
    console.log(`   Released: ${video.released}`);
    console.log(`   Released At: ${video.releasedAt}`);

    res.json({
      success: true,
      message: video.type === 'series' 
        ? 'Series released successfully' 
        : 'Video released successfully',
      video: {
        ...video.toObject(),
        status: 'released',
        moderationStatus: 'released',
        releaseStatus: 'released',
        publishedAt: video.publishedAt
      }
    });
  } catch (err) {
    console.error('❌ Release video error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to release video',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * RELEASE SERIES EPISODE
 * --------------------------
 */
const releaseSeriesEpisode = async (req, res) => {
  try {
    const { seasonNumber, episodeNumber, price } = req.body;
    const video = await Video.findById(req.params.id);

    if (!video || video.type !== 'series') {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }

    if (video.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!video.approved || video.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Series must be approved by admin before releasing episodes'
      });
    }

    const season = video.seasons.find(s => s.seasonNumber === parseInt(seasonNumber));
    if (!season) {
      return res.status(404).json({ success: false, message: 'Season not found' });
    }

    const episode = season.episodes.find(e => e.episodeNumber === parseInt(episodeNumber));
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    if (episode.published) {
      return res.status(400).json({
        success: false,
        message: 'Episode already released'
      });
    }

    episode.published = true;
    episode.publishedAt = new Date();
    if (price !== undefined) {
      episode.price = parseFloat(price);
    }
    
    const publishedEpisodes = season.episodes.filter(ep => ep.published);
    if (publishedEpisodes.length === 1) {
      season.isPublished = true;
      season.publishedAt = new Date();
    }

    const publishedSeasons = video.seasons.filter(s => s.isPublished);
    if (publishedSeasons.length === 1 && video.status === 'approved') {
      video.status = 'released';
      video.released = true;
      video.releasedAt = new Date();
      video.releasedBy = req.user._id;
      video.publishedAt = new Date();
    }

    await video.save();

    res.json({
      success: true,
      message: 'Episode released successfully',
      episode: {
        ...episode,
        seasonNumber: parseInt(seasonNumber),
        episodeNumber: parseInt(episodeNumber)
      },
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        publishedEpisodesCount: video.publishedEpisodesCount,
        totalEpisodes: video.totalEpisodes
      }
    });
  } catch (err) {
    console.error('Release series episode error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to release episode',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * --------------------------
 * CHECK VIDEO ACCESS
 * --------------------------
 */
const checkVideoAccess = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video || video.isDeleted || video.status !== 'released' || video.isShadowBanned)
      return res.status(404).json({ success: false, message: 'Video unavailable' });

    if (!req.user) {
      const isFreeAndPublic = !video.isPaid && !video.isPrivate && 
        (video.releaseOption !== 'schedule' || !video.scheduledReleaseDate || new Date() >= video.scheduledReleaseDate);
      
      return res.json({ 
        success: true, 
        hasAccess: isFreeAndPublic, 
        price: video.isPaid ? video.price : 0,
        isPaid: video.isPaid,
        type: video.type,
        isSeries: video.type === 'series',
        totalSeasons: video.totalSeasons || 0,
        totalEpisodes: video.totalEpisodes || 0,
        status: video.status,
        requiresAuth: !isFreeAndPublic,
        message: isFreeAndPublic ? 'Free access' : 'Authentication required'
      });
    }

    const userAge = req.user?.dateOfBirth ? new Date().getFullYear() - new Date(req.user.dateOfBirth).getFullYear() : null;
    if (userAge !== null) {
      if ((video.ageRating === '13+' && userAge < 13) || 
          (video.ageRating === '16+' && userAge < 16) || 
          (video.ageRating === '18+' && userAge < 18) ||
          (video.ageRating === 'PG-13' && userAge < 13)) {
        return res.status(403).json({ success: false, message: 'Age restricted' });
      }
    }

    if (video.releaseOption === 'schedule' && video.scheduledReleaseDate) {
      if (new Date() < video.scheduledReleaseDate) {
        return res.status(403).json({ success: false, message: 'Video is scheduled for later release' });
      }
    }

    if (video.isPrivate && (!req.user || video.creator.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Video is private' });
    }

    const isAdmin = req.user && ['superadmin','platformadmin','supportadmin'].includes(req.user.role);
    const isCreator = req.user && video.creator.toString() === req.user._id.toString();
    
    const hasAccess = !video.isPaid ||
      video.purchases.some(p => p.user.toString() === req.user?._id.toString()) ||
      isAdmin ||
      isCreator;

    res.json({ 
      success: true, 
      hasAccess, 
      price: video.isPaid ? video.price : 0,
      isPaid: video.isPaid,
      type: video.type,
      isSeries: video.type === 'series',
      totalSeasons: video.totalSeasons || 0,
      totalEpisodes: video.totalEpisodes || 0,
      status: video.status,
      releaseStatus: video.releaseStatus
    });
  } catch (err) {
    console.error('Check video access error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check video access', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * WATCH VIDEO
 * --------------------------
 */
const watchVideo = async (req, res) => {
  try {
    const { seasonNumber, episodeNumber } = req.query;
    const video = await Video.findById(req.params.id).populate('creator', 'name email avatar isVerified');
    
    if (!video || video.isDeleted || video.status !== 'released' || video.isShadowBanned)
      return res.status(404).json({ success: false, message: 'Video unavailable' });

    if (!req.user) {
      const isFreeAndPublic = !video.isPaid && !video.isPrivate && 
        (video.releaseOption !== 'schedule' || !video.scheduledReleaseDate || new Date() >= video.scheduledReleaseDate);
      
      if (isFreeAndPublic) {
        video.views += 1;
        await video.save();
        
        return res.json({
          success: true,
          video: {
            ...video.toObject(),
            moderationStatus: video.status,
            releaseStatus: video.releaseStatus
          }
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required to watch this video',
          requiresAuth: true
        });
      }
    }

    const userAge = req.user?.dateOfBirth ? new Date().getFullYear() - new Date(req.user.dateOfBirth).getFullYear() : null;
    if (userAge !== null) {
      if ((video.ageRating === '13+' && userAge < 13) || 
          (video.ageRating === '16+' && userAge < 16) || 
          (video.ageRating === '18+' && userAge < 18) ||
          (video.ageRating === 'PG-13' && userAge < 13)) {
        return res.status(403).json({ success: false, message: 'Age restricted' });
      }
    }

    if (video.releaseOption === 'schedule' && video.scheduledReleaseDate) {
      if (new Date() < video.scheduledReleaseDate) {
        return res.status(403).json({ success: false, message: 'Video is scheduled for later release' });
      }
    }

    if (video.isPrivate && (!req.user || video.creator.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Video is private' });
    }

    const isAdmin = req.user && ['superadmin','platformadmin','supportadmin'].includes(req.user.role);
    const isCreator = req.user && video.creator.toString() === req.user._id.toString();
    
    const hasAccess = !video.isPaid ||
      video.purchases.some(p => p.user.toString() === req.user?._id.toString()) ||
      isAdmin ||
      isCreator;

    if (!hasAccess) {
      return res.status(402).json({ 
        success: false, 
        message: 'Payment required', 
        price: video.price 
      });
    }

    if (video.type === 'series' && seasonNumber && episodeNumber) {
      const season = video.seasons.find(s => s.seasonNumber === parseInt(seasonNumber));
      if (!season || !season.isPublished) {
        return res.status(403).json({ success: false, message: 'Season not available' });
      }
      
      const episode = season.episodes.find(e => e.episodeNumber === parseInt(episodeNumber));
      if (!episode || !episode.published) {
        return res.status(403).json({ success: false, message: 'Episode not available' });
      }
      
      episode.views = (episode.views || 0) + 1;
      video.views += 1;
      await video.save();
    } else if (video.type === 'movie') {
      video.views += 1;
      await video.save();
    }

    let responseData = {
      success: true,
      video: {
        ...video.toObject(),
        moderationStatus: video.status,
        releaseStatus: video.releaseStatus
      }
    };

    if (video.type === 'series' && seasonNumber && episodeNumber) {
      const season = video.seasons.find(s => s.seasonNumber === parseInt(seasonNumber));
      if (season) {
        const episode = season.episodes.find(e => e.episodeNumber === parseInt(episodeNumber));
        if (episode) {
          responseData.currentEpisode = episode;
          responseData.currentSeason = season;
        }
      }
    }

    res.json(responseData);
  } catch (err) {
    console.error('Watch video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to watch video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * PURCHASE VIDEO
 * --------------------------
 */
const purchaseVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    const user = await User.findById(req.user._id);

    if (!video || video.status !== 'released' || video.isDeleted) 
      return res.status(400).json({ success: false, message: 'Invalid purchase' });
    
    if (!video.isPaid)
      return res.status(400).json({ success: false, message: 'Video is free' });
    
    if (video.purchases.some(p => p.user.toString() === user._id.toString())) 
      return res.status(400).json({ success: false, message: 'Already purchased' });
    
    if (user.balance < video.price) 
      return res.status(402).json({ success: false, message: 'Insufficient balance' });

    user.balance -= video.price;
    video.purchases.push({ user: user._id });

    await Promise.all([user.save(), video.save()]);
    
    res.json({ 
      success: true, 
      message: 'Purchase successful',
      newBalance: user.balance
    });
  } catch (err) {
    console.error('Purchase video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Payment failed', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * RATE VIDEO
 * --------------------------
 */
const rateVideo = async (req, res) => {
  try {
    const { rating, seasonNumber, episodeNumber } = req.body;
    
    if (rating < 0 || rating > 10) 
      return res.status(400).json({ success: false, message: 'Rating must be 0–10' });

    const video = await Video.findById(req.params.id);
    if (!video) 
      return res.status(404).json({ success: false, message: 'Video not found' });

    if (video.type === 'series' && seasonNumber !== undefined && episodeNumber !== undefined) {
      const season = video.seasons.find(s => s.seasonNumber === parseInt(seasonNumber));
      if (season) {
        const episode = season.episodes.find(e => e.episodeNumber === parseInt(episodeNumber));
        if (episode) {
          // Episode rating logic here
        }
      }
    }

    const existing = video.ratings.find(r => r.user.toString() === req.user._id.toString());
    if (existing) {
      existing.rating = rating;
    } else {
      video.ratings.push({ user: req.user._id, rating });
    }

    video.averageRating = video.ratings.reduce((sum, r) => sum + r.rating, 0) / video.ratings.length;
    await video.save();
    
    res.json({ 
      success: true, 
      message: 'Rating saved', 
      averageRating: video.averageRating 
    });
  } catch (err) {
    console.error('Rate video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save rating', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * EDIT VIDEO
 * --------------------------
 */
const editVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) 
      return res.status(404).json({ success: false, message: 'Video not found' });
    
    if (video.creator.toString() !== req.user._id.toString()) 
      return res.status(403).json({ success: false, message: 'Forbidden' });

    const editableFields = [
      'title', 'description', 'thumbnailUrl', 'videoUrl',
      'type', 'genre', 'tags', 'ageRating', 'contentFlags', 'language', 'subtitles',
      'isPaid', 'price', 'currency',
      'isSponsored', 'sponsorDescription', 'isFundraiser', 'fundraiserDescription',
      'fundraiserGoal', 'isPrivate', 'commentsDisabled', 'releaseOption', 'releaseDate'
    ];

    editableFields.forEach(f => { 
      if (req.body[f] !== undefined) video[f] = req.body[f]; 
    });

    if (video.type === 'series' && req.body.seasons !== undefined) {
      try {
        video.seasons = JSON.parse(req.body.seasons);
        video.totalSeasons = video.seasons.length;
        video.totalEpisodes = video.seasons.reduce((total, season) => 
          total + (season.episodes ? season.episodes.length : 0), 0);
      } catch (parseErr) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid seasons format' 
        });
      }
    }

    const majorFields = ['title', 'description', 'videoUrl', 'isPaid', 'isSponsored', 'isFundraiser', 'type'];
    if (majorFields.some(f => req.body[f] !== undefined) && (video.approved || video.released)) {
      if (video.released) {
        video.status = 'approved';
        video.released = false;
        video.releasedAt = null;
        video.releasedBy = null;
        video.publishedAt = null;
      }
      
      video.approved = true;
      video.status = 'approved';
    }

    await video.save();
    
    res.json({ 
      success: true, 
      message: 'Video updated', 
      video 
    });
  } catch (err) {
    console.error('Edit video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN MODERATION
 * --------------------------
 */
const adminUpdateVideoFlags = async (req, res) => {
  try {
    if (!['superadmin','platformadmin','supportadmin'].includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const { ageRating, contentFlags, genre } = req.body;
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    if (ageRating) video.ageRating = ageRating;
    if (genre) video.genre = genre;
    if (contentFlags) video.contentFlags = { ...video.contentFlags, ...contentFlags };

    await video.save();
    res.json({ success: true, message: 'Video flags updated', video });
  } catch (err) {
    console.error('Admin update video flags error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update video flags', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * UPDATE VIDEO STATUS (APPROVE / REJECT) - Legacy
 * --------------------------
 */
const updateVideoStatus = async (req, res) => {
  try {
    if (!['superadmin','platformadmin','supportadmin'].includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const { status, rejectionReason, rejectionDetails } = req.body;
    if (!['approved','rejected'].includes(status)) 
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const video = await Video.findById(req.params.id);
    if (!video) 
      return res.status(404).json({ success: false, message: 'Video not found' });

    video.approved = status === 'approved';
    video.rejected = status === 'rejected';
    video.status = status;
    video.rejectionReason = status === 'rejected' ? rejectionReason || 'No reason provided' : '';
    video.rejectionDetails = status === 'rejected' ? rejectionDetails || '' : '';
    video.approvedBy = req.user._id;
    video.approvedAt = status === 'approved' ? new Date() : null;
    
    video.publishedAt = null;
    video.released = false;
    video.releasedAt = null;
    video.releasedBy = null;

    await video.save();
    
    // Send notification based on status
    if (status === 'approved') {
      await NotificationService.notifyVideoApproved(
        video.creator,
        video.title,
        video._id,
        req.user._id
      );
    } else if (status === 'rejected') {
      await NotificationService.notifyVideoRejected(
        video.creator,
        video.title,
        video._id,
        rejectionReason || 'No reason provided'
      );
    }
    
    res.json({ 
      success: true, 
      message: `Video ${status}. Creator can now release it.`,
      video 
    });
  } catch (err) {
    console.error('Update video status error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update video status', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * SHADOW BAN VIDEO
 * --------------------------
 */
const shadowBanVideo = async (req, res) => {
  try {
    if (!['superadmin','platformadmin','supportadmin'].includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const video = await Video.findById(req.params.id);
    if (!video) 
      return res.status(404).json({ success: false, message: 'Video not found' });

    video.isShadowBanned = true;
    await video.save();

    res.json({ 
      success: true, 
      message: 'Video shadow banned' 
    });
  } catch (err) {
    console.error('Shadow ban video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to shadow ban video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * DELETE VIDEO
 * --------------------------
 */
const deleteVideo = async (req, res) => {
  try {
    if (!['superadmin','platformadmin','supportadmin'].includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const video = await Video.findById(req.params.id);
    if (!video) 
      return res.status(404).json({ success: false, message: 'Video not found' });

    video.isDeleted = true;
    await video.save();

    res.json({ 
      success: true, 
      message: 'Video deleted' 
    });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET VIDEO BY ID
 * --------------------------
 */
const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid video ID format' 
      });
    }
    
    const video = await Video.findById(id)
      .populate('creator', 'name email avatar isVerified')
      .populate('likes', 'name email')
      .populate('dislikes', 'name email')
      .lean();

    if (!video || video.isDeleted) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const isAdmin = req.user && ['superadmin','platformadmin','supportadmin'].includes(req.user.role);
    const isCreator = req.user && video.creator._id.toString() === req.user._id.toString();

    if (video.status !== 'released') {
      if (!isAdmin && !isCreator) {
        return res.status(403).json({ 
          success: false, 
          message: video.status === 'approved' 
            ? 'Video is approved but not yet released by creator' 
            : 'Video is not available for viewing' 
        });
      }
    }

    if (video.isPrivate && !isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Video is private' });
    }

    if (video.isShadowBanned && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Video unavailable' });
    }

    if (!req.user && video.releaseOption === 'schedule' && video.scheduledReleaseDate) {
      if (new Date() < video.scheduledReleaseDate) {
        return res.status(403).json({ 
          success: false, 
          message: 'Video is scheduled for later release' 
        });
      }
    }

    if (!req.user) {
      const isFreeAndPublic = !video.isPaid && !video.isPrivate && 
        (video.releaseOption !== 'schedule' || !video.scheduledReleaseDate || new Date() >= video.scheduledReleaseDate);
      
      if (!isFreeAndPublic) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required to view this video',
          requiresAuth: true
        });
      }
    }

    const formattedVideo = {
      ...video,
      moderationStatus: video.status,
      releaseStatus: video.releaseStatus,
      totalEpisodes: video.totalEpisodes || 0,
      totalSeasons: video.totalSeasons || 0,
      totalDuration: video.type === 'series' ? 
        video.seasons?.reduce((total, season) => 
          total + (season.episodes?.reduce((epTotal, ep) => 
            epTotal + (ep.duration || 0), 0) || 0), 0) || 0 : 
        video.duration || 0,
      isAccessible: !video.isPrivate && video.status === 'released' && 
        (video.releaseOption !== 'schedule' || 
         !video.scheduledReleaseDate || 
         video.scheduledReleaseDate <= new Date()),
      canEdit: isAdmin || isCreator,
      canDelete: isAdmin,
      canRelease: isCreator && video.status === 'approved',
      requiresAuth: !req.user && (video.isPaid || video.isPrivate || video.status !== 'released')
    };

    res.json({ 
      success: true, 
      video: formattedVideo 
    });
  } catch (err) {
    console.error('Get video by ID error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET SERIES EPISODE
 * --------------------------
 */
const getSeriesEpisode = async (req, res) => {
  try {
    const { videoId, seasonNumber, episodeNumber } = req.params;
    
    const video = await Video.findById(videoId)
      .populate('creator', 'name email avatar isVerified')
      .lean();

    if (!video || video.isDeleted || video.type !== 'series') {
      return res.status(404).json({ success: false, message: 'Series or episode not found' });
    }

    const season = video.seasons.find(s => s.seasonNumber === parseInt(seasonNumber));
    if (!season) {
      return res.status(404).json({ success: false, message: 'Season not found' });
    }

    const episode = season.episodes.find(e => e.episodeNumber === parseInt(episodeNumber));
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const isAdmin = req.user && ['superadmin','platformadmin','supportadmin'].includes(req.user.role);
    const isCreator = req.user && video.creator._id.toString() === req.user._id.toString();

    if (!req.user) {
      const isFreeAndPublic = !video.isPaid && !video.isPrivate && 
        video.status === 'released' && season.isPublished && episode.published &&
        (video.releaseOption !== 'schedule' || !video.scheduledReleaseDate || new Date() >= video.scheduledReleaseDate);
      
      if (!isFreeAndPublic) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required to view this episode',
          requiresAuth: true
        });
      }
    } else {
      if (!isAdmin && !isCreator) {
        if (video.status !== 'released' || !season.isPublished || !episode.published) {
          return res.status(403).json({ 
            success: false, 
            message: video.status === 'approved' 
              ? 'Episode is approved but not yet released by creator' 
              : 'Episode unavailable' 
          });
        }

        if (video.isPrivate) {
          return res.status(403).json({ success: false, message: 'Episode is private' });
        }

        if (video.releaseOption === 'schedule' && video.scheduledReleaseDate) {
          if (new Date() < video.scheduledReleaseDate) {
            return res.status(403).json({ success: false, message: 'Episode is scheduled for later release' });
          }
        }
      }
    }

    res.json({
      success: true,
      video: {
        ...video,
        currentEpisode: episode,
        currentSeason: season,
        moderationStatus: video.status,
        releaseStatus: video.releaseStatus,
        requiresAuth: !req.user && (video.isPaid || video.isPrivate)
      }
    });
  } catch (err) {
    console.error('Get series episode error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch episode', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET PENDING VIDEOS FOR ADMIN APPROVAL
 * --------------------------
 */
const getPendingVideosForAdmin = async (req, res) => {
  try {
    if (!req.user || !['superadmin','platformadmin','supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const videos = await Video.find({
      status: 'pending',
      isDeleted: false
    })
    .populate('creator', 'name email avatar')
    .sort({ uploadedAt: -1 })
    .lean();

    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      videoUrl: video.videoUrl,
      trailerUrl: video.trailerUrl,
      type: video.type,
      ageRating: video.ageRating,
      genre: video.genre || [],
      tags: video.tags || [],
      language: video.language,
      creator: video.creator,
      uploadedBy: video.creator,
      uploadedAt: video.uploadedAt,
      status: video.status,
      approved: video.approved,
      rejected: video.rejected,
      moderationStatus: video.status,
      releaseStatus: 'pending_approval',
      totalSeasons: video.totalSeasons || 0,
      totalEpisodes: video.totalEpisodes || 0,
      seasons: video.type === 'series' ? video.seasons?.map(season => ({
        title: season.title,
        seasonNumber: season.seasonNumber,
        episodes: season.episodes?.map(episode => ({
          title: episode.title,
          episodeNumber: episode.episodeNumber
        }))
      })) : []
    }));

    res.json({
      success: true,
      count: formattedVideos.length,
      videos: formattedVideos
    });
  } catch (err) {
    console.error('Get pending videos for admin error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending videos', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET VIDEOS FOR ADMIN MODERATION WITH SEARCH & FILTERS
 * --------------------------
 */
const getVideosForAdminModeration = async (req, res) => {
  try {
    console.log('========== GET VIDEOS FOR MODERATION ==========');
    console.log('User:', req.user?.email);
    console.log('Role:', req.user?.role);
    console.log('Query params:', req.query);
    
    if (!req.user || !['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      console.log('❌ Admin access denied for role:', req.user?.role);
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const {
      status = 'all',
      type = 'all',
      search = '',
      page = 1,
      limit = 12,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('Filters - status:', status, 'type:', type, 'search:', search);

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

    console.log('MongoDB Query:', JSON.stringify(query));

    const sortOptions = {};
    if (sortBy === 'title') {
      sortOptions.title = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'views') {
      sortOptions.views = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'createdAt') {
      sortOptions.createdAt = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.uploadedAt = sortOrder === 'desc' ? -1 : 1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // FIXED: Populate creator with firstName and lastName
    const videos = await Video.find(query)
      .populate('creator', 'firstName lastName name email username avatar isVerified')
      .populate('approvedBy', 'name email')
      .populate('releasedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log(`Found ${videos.length} videos`);

    const total = await Video.countDocuments(query);

    // FIXED: Format uploadedBy properly with firstName and lastName
    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      videoUrl: video.videoUrl,
      trailerUrl: video.trailerUrl,
      type: video.type,
      ageRating: video.ageRating,
      genre: video.genre || [],
      tags: video.tags || [],
      language: video.language,
      creator: video.creator,
      uploadedBy: video.creator ? {
        _id: video.creator._id,
        firstName: video.creator.firstName,
        lastName: video.creator.lastName,
        name: video.creator.name,
        email: video.creator.email,
        username: video.creator.username,
        avatar: video.creator.avatar,
        isVerified: video.creator.isVerified
      } : null,
      uploadedAt: video.uploadedAt,
      status: video.status,
      approved: video.approved,
      approvedBy: video.approvedBy,
      approvedAt: video.approvedAt,
      released: video.released,
      releasedBy: video.releasedBy,
      releasedAt: video.releasedAt,
      rejectionReason: video.rejectionReason,
      views: video.views || 0,
      likesCount: video.likes?.length || 0,
      dislikesCount: video.dislikes?.length || 0,
      averageRating: video.averageRating || 0,
      isPaid: video.isPaid,
      price: video.price || 0,
      isPrivate: video.isPrivate,
      isSponsored: video.isSponsored,
      isFundraiser: video.isFundraiser,
      totalSeasons: video.totalSeasons || 0,
      totalEpisodes: video.totalEpisodes || 0,
      seasons: video.type === 'series' ? video.seasons?.map(season => ({
        title: season.title,
        seasonNumber: season.seasonNumber,
        isPublished: season.isPublished,
        episodes: season.episodes?.map(episode => ({
          title: episode.title,
          episodeNumber: episode.episodeNumber,
          published: episode.published
        }))
      })) : []
    }));

    console.log('========== END ==========');

    res.json({
      success: true,
      videos: formattedVideos,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('❌ Get videos for admin moderation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch videos for moderation', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * GET VIDEO MODERATION STATS
 * --------------------------
 */
const getVideoModerationStats = async (req, res) => {
  try {
    if (!req.user || !['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const [
      pendingCount,
      approvedCount,
      releasedCount,
      rejectedCount,
      totalCount,
      moviesCount,
      seriesCount,
      todayUploads,
      last7DaysUploads
    ] = await Promise.all([
      Video.countDocuments({ status: 'pending', isDeleted: false }),
      Video.countDocuments({ status: 'approved', isDeleted: false }),
      Video.countDocuments({ status: 'released', isDeleted: false }),
      Video.countDocuments({ status: 'rejected', isDeleted: false }),
      Video.countDocuments({ isDeleted: false }),
      Video.countDocuments({ type: 'movie', isDeleted: false }),
      Video.countDocuments({ type: 'series', isDeleted: false }),
      Video.countDocuments({ 
        uploadedAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        }, 
        isDeleted: false 
      }),
      Video.countDocuments({ 
        uploadedAt: { 
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
        }, 
        isDeleted: false 
      })
    ]);

    res.json({
      success: true,
      stats: {
        byStatus: {
          pending: pendingCount,
          approved: approvedCount,
          released: releasedCount,
          rejected: rejectedCount,
          total: totalCount
        },
        byType: {
          movies: moviesCount,
          series: seriesCount
        },
        activity: {
          today: todayUploads,
          last7Days: last7DaysUploads
        }
      }
    });
  } catch (err) {
    console.error('Get video moderation stats error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch moderation stats', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN APPROVE VIDEO
 * --------------------------
 */
const adminApproveVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status === 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already approved' 
      });
    }

    if (video.status === 'released') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already released' 
      });
    }

    video.approved = true;
    video.status = 'approved';
    video.approvedBy = req.user._id;
    video.approvedAt = new Date();
    video.rejected = false;
    video.rejectionReason = '';
    video.rejectionDetails = '';

    await video.save();

    // Log admin action
    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'APPROVE_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    // ✅ Send notification to creator
    await NotificationService.notifyVideoApproved(
      video.creator,
      video.title,
      video._id,
      req.user._id
    );

    console.log(`✅ Video approved: ${video._id} - Status now: ${video.status}`);

    res.json({
      success: true,
      message: 'Video approved successfully. Creator can now release it.',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        approvedAt: video.approvedAt
      }
    });
  } catch (err) {
    console.error('Admin approve video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN REJECT VIDEO
 * --------------------------
 */
const adminRejectVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { rejectionReason, rejectionDetails } = req.body;
    
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Rejection reason is required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status === 'rejected') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already rejected' 
      });
    }

    if (video.status === 'released') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot reject a released video' 
      });
    }

    video.approved = false;
    video.status = 'rejected';
    video.rejected = true;
    video.rejectionReason = rejectionReason.trim();
    video.rejectionDetails = rejectionDetails || '';
    video.approvedBy = null;
    video.approvedAt = null;

    await video.save();

    // Log admin action
    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'REJECT_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title, reason: rejectionReason }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    // ✅ Send notification to creator
    await NotificationService.notifyVideoRejected(
      video.creator,
      video.title,
      video._id,
      rejectionReason
    );

    res.json({
      success: true,
      message: 'Video rejected successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        rejectionReason: video.rejectionReason
      }
    });
  } catch (err) {
    console.error('Admin reject video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN REMOVE VIDEO (soft delete)
 * --------------------------
 */
const adminRemoveVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already removed' 
      });
    }

    // Soft delete
    video.isDeleted = true;
    video.status = 'removed';
    video.removedAt = new Date();
    video.removedBy = req.user._id;

    await video.save();

    // Log admin action
    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'REMOVE_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    // ✅ Send notification to creator
    await NotificationService.notifyVideoRemoved(
      video.creator,
      video.title,
      video._id,
      req.body.reason || 'Removed by admin'
    );

    res.json({
      success: true,
      message: 'Video removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isDeleted: video.isDeleted
      }
    });
  } catch (err) {
    console.error('Admin remove video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN RESTORE VIDEO (undo soft delete)
 * --------------------------
 */
const adminRestoreVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (!video.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video is not removed' 
      });
    }

    // Restore
    video.isDeleted = false;
    video.status = 'pending';
    video.removedAt = null;
    video.removedBy = null;

    await video.save();

    // Log admin action
    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'RESTORE_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    // ✅ Send notification to creator
    await NotificationService.notifyVideoRestored(
      video.creator,
      video.title,
      video._id
    );

    res.json({
      success: true,
      message: 'Video restored successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isDeleted: video.isDeleted
      }
    });
  } catch (err) {
    console.error('Admin restore video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN PERMANENT DELETE VIDEO
 * --------------------------
 */
const adminPermanentDeleteVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Super admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    await Video.findByIdAndDelete(req.params.id);

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'PERMANENT_DELETE_VIDEO',
        targetType: 'Video',
        targetId: req.params.id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video permanently deleted'
    });
  } catch (err) {
    console.error('Admin permanent delete video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to permanently delete video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN RESTRICT VIDEO
 * --------------------------
 */
const adminRestrictVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Restriction reason is required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status === 'restricted') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already restricted' 
      });
    }

    video.status = 'restricted';
    video.restricted = true;
    video.restrictedReason = reason.trim();
    video.restrictedAt = new Date();
    video.restrictedBy = req.user._id;

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'RESTRICT_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title, reason }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video restricted successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        restrictedReason: video.restrictedReason
      }
    });
  } catch (err) {
    console.error('Admin restrict video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restrict video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN REMOVE RESTRICTION
 * --------------------------
 */
const adminRemoveRestriction = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status !== 'restricted') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video is not restricted' 
      });
    }

    video.status = 'pending';
    video.restricted = false;
    video.restrictedReason = null;
    video.restrictedAt = null;
    video.restrictedBy = null;

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'REMOVE_RESTRICTION_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video restriction removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('Admin remove restriction error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video restriction', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN FLAG VIDEO
 * --------------------------
 */
const adminFlagVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Flag reason is required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status === 'flagged') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already flagged' 
      });
    }

    video.status = 'flagged';
    video.flagged = true;
    video.flaggedReason = reason.trim();
    video.flaggedAt = new Date();
    video.flaggedBy = req.user._id;

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'FLAG_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title, reason }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video flagged successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        flaggedReason: video.flaggedReason
      }
    });
  } catch (err) {
    console.error('Admin flag video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to flag video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN REMOVE FLAG
 * --------------------------
 */
const adminRemoveFlag = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status !== 'flagged') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video is not flagged' 
      });
    }

    video.status = 'pending';
    video.flagged = false;
    video.flaggedReason = null;
    video.flaggedAt = null;
    video.flaggedBy = null;

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'REMOVE_FLAG_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video flag removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('Admin remove flag error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video flag', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN SHADOW BAN VIDEO
 * --------------------------
 */
const adminShadowBanVideo = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { reason, countries = [], continents = [] } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Shadow ban reason is required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.status === 'shadowBanned') {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already shadow banned' 
      });
    }

    video.status = 'shadowBanned';
    video.isShadowBanned = true;
    video.shadowBanReason = reason.trim();
    video.shadowBannedAt = new Date();
    video.shadowBannedBy = req.user._id;
    video.blockedCountries = countries;
    video.blockedContinents = continents;

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'SHADOW_BAN_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title, reason, countries, continents }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video shadow banned successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        shadowBanReason: video.shadowBanReason,
        isShadowBanned: video.isShadowBanned
      }
    });
  } catch (err) {
    console.error('Admin shadow ban video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to shadow ban video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * ADMIN REMOVE SHADOW BAN
 * --------------------------
 */
const adminRemoveShadowBan = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (!video.isShadowBanned) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video is not shadow banned' 
      });
    }

    video.status = 'pending';
    video.isShadowBanned = false;
    video.shadowBanReason = null;
    video.shadowBannedAt = null;
    video.shadowBannedBy = null;
    video.blockedCountries = [];
    video.blockedContinents = [];

    await video.save();

    try {
      const AdminActionLog = require('../models/AdminActionLog');
      await AdminActionLog.create({
        admin: req.user._id,
        action: 'REMOVE_SHADOW_BAN_VIDEO',
        targetType: 'Video',
        targetId: video._id,
        details: { title: video.title }
      });
    } catch (logErr) {
      console.error('Failed to log admin action:', logErr);
    }

    res.json({
      success: true,
      message: 'Video shadow ban removed successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isShadowBanned: video.isShadowBanned
      }
    });
  } catch (err) {
    console.error('Admin remove shadow ban error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video shadow ban', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * ================================
 * USER DELETE FUNCTIONS
 * ================================
 */

const userSoftDeleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own videos' 
      });
    }

    if (video.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already in trash' 
      });
    }

    video.isDeleted = true;
    video.removedAt = new Date();
    video.previousStatus = video.status;
    video.status = 'removed';

    await video.save();

    console.log(`✅ User soft deleted video: ${video._id} by user: ${req.user._id}`);

    res.json({
      success: true,
      message: 'Video moved to trash. It will be permanently deleted in 10 days.',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isDeleted: video.isDeleted,
        removedAt: video.removedAt
      }
    });
  } catch (err) {
    console.error('User soft delete video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

const userRestoreVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only restore your own videos' 
      });
    }

    if (!video.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video is not in trash' 
      });
    }

    video.isDeleted = false;
    video.removedAt = null;
    video.status = video.previousStatus || 'pending';
    video.previousStatus = undefined;

    await video.save();

    console.log(`✅ User restored video: ${video._id} by user: ${req.user._id}`);

    res.json({
      success: true,
      message: 'Video restored successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        isDeleted: video.isDeleted
      }
    });
  } catch (err) {
    console.error('User restore video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

const userPermanentDeleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    if (video.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own videos' 
      });
    }

    if (!video.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video must be moved to trash first. Use soft delete.' 
      });
    }

    await Video.findByIdAndDelete(req.params.id);

    console.log(`✅ User permanently deleted video: ${req.params.id} by user: ${req.user._id}`);

    res.json({
      success: true,
      message: 'Video permanently deleted'
    });
  } catch (err) {
    console.error('User permanent delete video error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to permanently delete video', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

/**
 * --------------------------
 * EXPORT - UPDATED with all functions
 * --------------------------
 */
module.exports = {
  // Core CRUD
  uploadVideo,
  getVideoFeed,
  getRecommendedVideos,
  getVideosByStatus,
  getApprovedForRelease,
  releaseVideo,
  releaseSeriesEpisode,
  getVideoById,
  getSeriesEpisode,
  checkVideoAccess,
  watchVideo,
  purchaseVideo,
  rateVideo,
  editVideo,
  
  // Like/Dislike functions
  likeVideo,
  dislikeVideo,
  getVideoInteractionStatus,
  
  // Share tracking
  trackShare,
  
  // Watch history with resume
  recordWatchProgress,
  getResumePosition,
  
  // Admin moderation
  adminUpdateVideoFlags,
  updateVideoStatus,
  shadowBanVideo,
  deleteVideo,
  getPendingVideosForAdmin,
  getVideosForAdminModeration,
  getVideoModerationStats,
  adminApproveVideo,
  adminRejectVideo,
  adminRemoveVideo,
  adminRestoreVideo,
  adminPermanentDeleteVideo,
  adminRestrictVideo,
  adminRemoveRestriction,
  adminFlagVideo,
  adminRemoveFlag,
  adminShadowBanVideo,
  adminRemoveShadowBan,
  
  // User delete functions
  userSoftDeleteVideo,
  userRestoreVideo,
  userPermanentDeleteVideo
};