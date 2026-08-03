/**
 * File: backend/controllers/playlistController.js
 * Description: Handles user playlists (Save to Playlist feature)
 */

const Playlist = require('../models/Playlist');
const Video = require('../models/Video');

/**
 * --------------------------
 * GET USER'S PLAYLISTS
 * --------------------------
 */
const getUserPlaylists = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const playlists = await Playlist.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    // Get video count for each playlist
    const playlistsWithDetails = await Promise.all(
      playlists.map(async (playlist) => {
        // Get first 3 videos for thumbnail
        const firstVideos = await Video.find({
          _id: { $in: playlist.videos.slice(0, 3).map(v => v.video) }
        }).select('thumbnailUrl').lean();
        
        return {
          ...playlist,
          thumbnailUrl: playlist.thumbnailUrl || firstVideos[0]?.thumbnailUrl || '',
          videoCount: playlist.videos.length,
        };
      })
    );
    
    res.json({
      success: true,
      playlists: playlistsWithDetails,
    });
  } catch (err) {
    console.error('Get user playlists error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch playlists',
      playlists: [],
    });
  }
};

/**
 * --------------------------
 * CREATE NEW PLAYLIST
 * --------------------------
 */
const createPlaylist = async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const userId = req.user._id;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Playlist name is required' 
      });
    }
    
    const playlist = await Playlist.create({
      name: name.trim(),
      description: description || '',
      user: userId,
      isPublic: isPublic || false,
    });
    
    res.status(201).json({
      success: true,
      message: 'Playlist created successfully',
      playlist,
    });
  } catch (err) {
    console.error('Create playlist error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create playlist',
    });
  }
};

/**
 * --------------------------
 * UPDATE PLAYLIST
 * --------------------------
 */
const updatePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { name, description, isPublic } = req.body;
    const userId = req.user._id;
    
    const playlist = await Playlist.findOne({ _id: playlistId, user: userId });
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist not found' 
      });
    }
    
    if (name) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    
    await playlist.save();
    
    res.json({
      success: true,
      message: 'Playlist updated successfully',
      playlist,
    });
  } catch (err) {
    console.error('Update playlist error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update playlist',
    });
  }
};

/**
 * --------------------------
 * DELETE PLAYLIST
 * --------------------------
 */
const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.user._id;
    
    const playlist = await Playlist.findOneAndDelete({ _id: playlistId, user: userId });
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (err) {
    console.error('Delete playlist error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete playlist',
    });
  }
};

/**
 * --------------------------
 * ADD VIDEO TO PLAYLIST (SAVE)
 * --------------------------
 */
const addVideoToPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId, notes } = req.body;
    const userId = req.user._id;
    
    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }
    
    // Get or create "Watch Later" playlist if playlistId not provided
    let playlist;
    if (!playlistId) {
      playlist = await Playlist.getOrCreateWatchLater(userId);
    } else {
      playlist = await Playlist.findOne({ _id: playlistId, user: userId });
    }
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist not found' 
      });
    }
    
    const added = playlist.addVideo(videoId, notes || '');
    
    if (!added) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video already in playlist' 
      });
    }
    
    // Update thumbnail if not set
    if (!playlist.thumbnailUrl && video.thumbnailUrl) {
      playlist.thumbnailUrl = video.thumbnailUrl;
    }
    
    await playlist.save();
    
    res.json({
      success: true,
      message: 'Video saved to playlist',
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        videoCount: playlist.videoCount,
      },
    });
  } catch (err) {
    console.error('Add video to playlist error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save video to playlist',
    });
  }
};

/**
 * --------------------------
 * REMOVE VIDEO FROM PLAYLIST
 * --------------------------
 */
const removeVideoFromPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;
    const userId = req.user._id;
    
    const playlist = await Playlist.findOne({ _id: playlistId, user: userId });
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist not found' 
      });
    }
    
    const removed = playlist.removeVideo(videoId);
    
    if (!removed) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found in playlist' 
      });
    }
    
    await playlist.save();
    
    res.json({
      success: true,
      message: 'Video removed from playlist',
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        videoCount: playlist.videoCount,
      },
    });
  } catch (err) {
    console.error('Remove video from playlist error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video from playlist',
    });
  }
};

/**
 * --------------------------
 * CHECK IF VIDEO IS SAVED
 * Returns which playlists contain the video
 * --------------------------
 */
const checkVideoSaved = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user._id;
    
    const playlists = await Playlist.find({ 
      user: userId,
      'videos.video': videoId,
    }).select('_id name').lean();
    
    res.json({
      success: true,
      saved: playlists.length > 0,
      playlists: playlists.map(p => ({ _id: p._id, name: p.name })),
    });
  } catch (err) {
    console.error('Check video saved error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check save status',
      saved: false,
      playlists: [],
    });
  }
};

/**
 * --------------------------
 * GET PLAYLIST VIDEOS
 * --------------------------
 */
const getPlaylistVideos = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;
    
    const playlist = await Playlist.findOne({ _id: playlistId, user: userId });
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Playlist not found' 
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const videoIds = playlist.videos.slice(skip, skip + parseInt(limit)).map(v => v.video);
    
    const videos = await Video.find({ _id: { $in: videoIds } })
      .populate('creator', 'name avatar')
      .lean();
    
    // Maintain order
    const orderedVideos = videoIds.map(id => videos.find(v => v._id.toString() === id.toString())).filter(v => v);
    
    res.json({
      success: true,
      playlist: {
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        videoCount: playlist.videoCount,
      },
      videos: orderedVideos,
      page: parseInt(page),
      hasMore: skip + orderedVideos.length < playlist.videoCount,
    });
  } catch (err) {
    console.error('Get playlist videos error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch playlist videos',
      videos: [],
    });
  }
};

module.exports = {
  getUserPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  checkVideoSaved,
  getPlaylistVideos,
};