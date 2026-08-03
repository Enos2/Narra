/**
 * File: backend/controllers/historyController.js
 * Description: Handles watch history and resume playback
 */

const History = require('../models/History');
const Video = require('../models/Video');

/**
 * --------------------------
 * RECORD WATCH PROGRESS
 * Called periodically as user watches video
 * --------------------------
 */
const recordWatchProgress = async (req, res) => {
  try {
    const { 
      videoId, 
      progress,      // current position in seconds
      duration,      // total video duration
      seasonNumber, 
      episodeNumber 
    } = req.body;
    
    const userId = req.user._id;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video ID is required' 
      });
    }
    
    // Calculate percent watched
    const percentWatched = duration > 0 ? (progress / duration) * 100 : 0;
    const completed = percentWatched >= 95; // Consider completed at 95%
    
    // Find or create history entry
    let history = await History.findOne({
      user: userId,
      video: videoId,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
    });
    
    if (history) {
      // Update existing entry
      history.progress = progress;
      history.duration = duration;
      history.percentWatched = percentWatched;
      history.completed = completed;
      history.lastWatchedAt = new Date();
      history.watchCount += 1;
    } else {
      // Create new entry
      history = new History({
        user: userId,
        video: videoId,
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
      history: {
        progress: history.progress,
        percentWatched: history.percentWatched,
        completed: history.completed,
        shouldResume: history.shouldResume(),
      },
    });
  } catch (err) {
    console.error('Record watch progress error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to record progress',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * --------------------------
 * GET RESUME POSITION
 * Called when user loads video to get where they left off
 * --------------------------
 */
const getResumePosition = async (req, res) => {
  try {
    const { videoId, seasonNumber, episodeNumber } = req.params;
    const userId = req.user._id;
    
    const history = await History.findOne({
      user: userId,
      video: videoId,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
    });
    
    if (!history) {
      return res.json({
        success: true,
        hasHistory: false,
        resumePosition: 0,
        shouldResume: false,
      });
    }
    
    const shouldResume = history.shouldResume();
    
    res.json({
      success: true,
      hasHistory: true,
      resumePosition: history.progress,
      percentWatched: history.percentWatched,
      completed: history.completed,
      shouldResume,
      lastWatchedAt: history.lastWatchedAt,
    });
  } catch (err) {
    console.error('Get resume position error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get resume position',
      resumePosition: 0,
      shouldResume: false,
    });
  }
};

/**
 * --------------------------
 * GET CONTINUE WATCHING LIST
 * Returns videos user hasn't finished
 * --------------------------
 */
const getContinueWatching = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user._id;
    
    const history = await History.getContinueWatching(userId, parseInt(limit));
    
    // Populate video details
    const continueWatching = await Promise.all(
      history.map(async (item) => {
        const video = await Video.findById(item.video)
          .populate('creator', 'name avatar')
          .lean();
        
        if (!video) return null;
        
        return {
          videoId: video._id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          creator: video.creator,
          progress: item.progress,
          percentWatched: item.percentWatched,
          resumePosition: item.progress,
          lastWatchedAt: item.lastWatchedAt,
          type: video.type,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
        };
      })
    );
    
    res.json({
      success: true,
      continueWatching: continueWatching.filter(item => item !== null),
    });
  } catch (err) {
    console.error('Get continue watching error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get continue watching list',
      continueWatching: [],
    });
  }
};

/**
 * --------------------------
 * GET WATCH HISTORY
 * Returns user's complete watch history
 * --------------------------
 */
const getWatchHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;
    
    const { history, total, totalPages } = await History.getWatchHistory(
      userId, 
      parseInt(page), 
      parseInt(limit)
    );
    
    // Populate video details
    const watchHistory = await Promise.all(
      history.map(async (item) => {
        const video = await Video.findById(item.video)
          .populate('creator', 'name avatar')
          .lean();
        
        if (!video) return null;
        
        return {
          videoId: video._id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          creator: video.creator,
          progress: item.progress,
          percentWatched: item.percentWatched,
          completed: item.completed,
          watchedAt: item.lastWatchedAt,
          watchCount: item.watchCount,
          type: video.type,
        };
      })
    );
    
    res.json({
      success: true,
      watchHistory: watchHistory.filter(item => item !== null),
      total,
      page: parseInt(page),
      totalPages,
    });
  } catch (err) {
    console.error('Get watch history error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get watch history',
      watchHistory: [],
    });
  }
};

/**
 * --------------------------
 * CLEAR WATCH HISTORY
 * --------------------------
 */
const clearWatchHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    await History.deleteMany({ user: userId });
    
    res.json({
      success: true,
      message: 'Watch history cleared',
    });
  } catch (err) {
    console.error('Clear watch history error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear watch history',
    });
  }
};

/**
 * --------------------------
 * DELETE SINGLE HISTORY ENTRY
 * --------------------------
 */
const deleteHistoryEntry = async (req, res) => {
  try {
    const { historyId } = req.params;
    const userId = req.user._id;
    
    const result = await History.findOneAndDelete({ 
      _id: historyId, 
      user: userId 
    });
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'History entry not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'History entry removed',
    });
  } catch (err) {
    console.error('Delete history entry error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete history entry',
    });
  }
};

module.exports = {
  recordWatchProgress,
  getResumePosition,
  getContinueWatching,
  getWatchHistory,
  clearWatchHistory,
  deleteHistoryEntry,
};