/**
 * File: backend/routes/historyRoutes.js
 * Description: Routes for watch history and resume playback functionality
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const historyController = require('../controllers/historyController');

/* ================================
   ALL HISTORY ROUTES REQUIRE AUTHENTICATION
================================ */

// GET continue watching list (videos user hasn't finished)
router.get('/continue-watching', protect, historyController.getContinueWatching);

// GET full watch history with pagination
router.get('/', protect, historyController.getWatchHistory);

// CLEAR entire watch history
router.delete('/clear', protect, historyController.clearWatchHistory);

// DELETE single history entry
router.delete('/:historyId', protect, historyController.deleteHistoryEntry);

// RECORD watch progress (also available via video routes, but keeping for completeness)
// POST /api/history/progress - alternative endpoint
router.post('/progress', protect, historyController.recordWatchProgress);

module.exports = router;