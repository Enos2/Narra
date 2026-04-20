/**
 * File: backend/routes/playlistRoutes.js
 * Description: Routes for user playlists (Save to Playlist feature)
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const playlistController = require('../controllers/playlistController');

/* ================================
   ALL PLAYLIST ROUTES REQUIRE AUTHENTICATION
================================ */

// GET all user playlists
router.get('/', protect, playlistController.getUserPlaylists);

// CREATE new playlist
router.post('/', protect, playlistController.createPlaylist);

// UPDATE playlist
router.put('/:playlistId', protect, playlistController.updatePlaylist);

// DELETE playlist
router.delete('/:playlistId', protect, playlistController.deletePlaylist);

// ADD video to playlist (Save feature)
router.post('/add', protect, playlistController.addVideoToPlaylist);

// REMOVE video from playlist
router.delete('/:playlistId/video/:videoId', protect, playlistController.removeVideoFromPlaylist);

// CHECK if video is saved in any playlist
router.get('/saved/:videoId', protect, playlistController.checkVideoSaved);

// GET all videos in a specific playlist
router.get('/:playlistId/videos', protect, playlistController.getPlaylistVideos);

module.exports = router;