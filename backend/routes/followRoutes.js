const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const commentController = require('../controllers/commentController');

// --------------------------
// GET COMMENTS FOR VIDEO
// --------------------------
router.get('/video/:videoId', commentController.getVideoComments);

// --------------------------
// ADD COMMENT TO VIDEO (requires auth)
// --------------------------
router.post('/:videoId', protect, commentController.addComment);

// --------------------------
// ADD REPLY TO A COMMENT (requires auth)
// --------------------------
router.post('/reply/:commentId', protect, commentController.addReply);

// --------------------------
// GET REPLIES FOR A COMMENT
// --------------------------
router.get('/replies/:commentId', commentController.getReplies);

// --------------------------
// EDIT COMMENT (requires auth)
// --------------------------
router.put('/:commentId', protect, commentController.editComment);

// --------------------------
// DELETE COMMENT (requires auth)
// --------------------------
router.delete('/:commentId', protect, commentController.deleteComment);

// --------------------------
// LIKE OR UNLIKE COMMENT (requires auth)
// --------------------------
router.post('/:commentId/like', protect, commentController.likeComment);

module.exports = router;