const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Comment = require('../models/Comment');
const Video = require('../models/Video');
const User = require('../models/User');

// --------------------------
// ADD COMMENT TO VIDEO
// --------------------------
router.post('/:videoId', protect, async (req, res) => {
  try {
    const { content, rating, tags } = req.body;
    const { videoId } = req.params;

    if (!content) return res.status(400).json({ message: 'Comment required' });
    if (rating && (rating < 0 || rating > 10)) {
      return res.status(400).json({ message: 'Rating must be 0-10' });
    }

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Shadow ban check
    if (req.user.shadowBannedCountries?.includes(req.user.country) ||
        req.user.shadowBannedContinents?.includes(req.user.continent)) {
      return res.status(403).json({ message: 'Cannot comment from your region' });
    }

    const comment = await Comment.create({
      video: videoId,
      user: req.user._id,
      content,
      rating: rating || null,
      tags: tags || [],
    });

    // Update video ratings aggregate
    if (rating !== undefined) {
      const allRatings = await Comment.find({ video: videoId, rating: { $ne: null } });
      const avgRating = allRatings.reduce((sum, c) => sum + c.rating, 0) / allRatings.length;
      video.avgRating = avgRating;
      await video.save();
    }

    res.status(201).json({ message: 'Comment added', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --------------------------
// EDIT COMMENT
// --------------------------
router.put('/:commentId', protect, async (req, res) => {
  try {
    const { content, rating, tags } = req.body;
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (!comment.user.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (content) comment.content = content;
    if (rating !== undefined) {
      if (rating < 0 || rating > 10) return res.status(400).json({ message: 'Rating 0-10' });
      comment.rating = rating;

      // Update video avg rating
      const video = await Video.findById(comment.video);
      const allRatings = await Comment.find({ video: video._id, rating: { $ne: null } });
      video.avgRating = allRatings.reduce((sum, c) => sum + c.rating, 0) / allRatings.length;
      await video.save();
    }

    if (tags) comment.tags = tags;

    await comment.save();
    res.status(200).json({ message: 'Comment updated', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --------------------------
// DELETE COMMENT
// --------------------------
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (!comment.user.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await comment.deleteOne();

    // Update video avg rating
    if (comment.rating !== null) {
      const video = await Video.findById(comment.video);
      const allRatings = await Comment.find({ video: video._id, rating: { $ne: null } });
      video.avgRating = allRatings.length > 0 ? allRatings.reduce((sum, c) => sum + c.rating, 0) / allRatings.length : 0;
      await video.save();
    }

    // Placeholder: Notify admins about removed comment
    // TODO: Admin notifications system

    res.status(200).json({ message: 'Comment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --------------------------
// LIKE OR UNLIKE COMMENT
// --------------------------
router.post('/:commentId/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const userIndex = comment.likes.findIndex(id => id.equals(req.user._id));
    if (userIndex >= 0) comment.likes.splice(userIndex, 1);
    else comment.likes.push(req.user._id);

    await comment.save();
    res.status(200).json({ message: 'Comment liked/unliked', likes: comment.likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --------------------------
// GET COMMENTS FOR VIDEO
// --------------------------
router.get('/video/:videoId', async (req, res) => {
  try {
    const comments = await Comment.find({ video: req.params.videoId })
      .populate('user', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
