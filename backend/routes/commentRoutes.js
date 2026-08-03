/**
 * FILE: backend/routes/commentRoutes.js
 * 
 * ROUTES:
 *   POST   /api/comments/:videoId          — add comment or reply
 *   GET    /api/comments/video/:videoId    — get all comments (nested tree)
 *   DELETE /api/comments/:commentId        — delete comment (own or creator/admin)
 *   POST   /api/comments/:commentId/like   — like a comment
 *   POST   /api/comments/:commentId/dislike — dislike a comment
 *   PUT    /api/comments/:commentId        — edit a comment
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Comment = require('../models/Comment');
const Video = require('../models/Video');

/* ─────────────────────────────────────────────
   POST /api/comments/:videoId
   Add a top-level comment OR a reply.
   Body: { content, parentCommentId?, replyToUserId? }
───────────────────────────────────────────── */
router.post('/:videoId', protect, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content, parentCommentId, replyToUserId } = req.body;

    // Validate content
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    // Check video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Build the comment document
    const commentData = {
      video: videoId,
      user: req.user._id,
      content: content.trim(),
    };

    // ── Handle reply ──
    // parentCommentId can arrive as a string "null" from some front-end serialisers,
    // so we check for that too.
    const isReply =
      parentCommentId &&
      parentCommentId !== 'null' &&
      parentCommentId !== 'undefined' &&
      parentCommentId !== '';

    if (isReply) {
      // Verify the parent comment actually exists
      const parentComment = await Comment.findById(parentCommentId).select('_id video user isDeleted');
      if (!parentComment || parentComment.isDeleted) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
      // Make sure parent belongs to the same video
      if (parentComment.video.toString() !== videoId) {
        return res.status(400).json({ success: false, message: 'Parent comment does not belong to this video' });
      }

      commentData.parentComment = parentCommentId;

      // Who are we replying TO?
      if (replyToUserId && replyToUserId !== 'null' && replyToUserId !== 'undefined') {
        commentData.replyToUser = replyToUserId;
      } else {
        // Default: reply to whoever wrote the parent
        commentData.replyToUser = parentComment.user;
      }
    }

    // Save
    const comment = new Comment(commentData);
    await comment.save();

    // Return populated version
    const populated = await Comment.findById(comment._id)
      .populate('user', 'firstName lastName username avatar isVerified')
      .populate('replyToUser', 'firstName lastName username')
      .lean();

    // Add empty replies array so front-end doesn't crash
    populated.replies = [];

    return res.status(201).json({ success: true, comment: populated });

  } catch (err) {
    console.error('❌ Add comment error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/comments/video/:videoId
   Returns a nested tree:
     [
       { ...comment, replies: [ { ...reply, replies: [...] } ] }
     ]
───────────────────────────────────────────── */
router.get('/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Fetch ALL non-deleted comments for this video in one query
    const allComments = await Comment.find({ video: videoId, isDeleted: false })
      .populate('user', 'firstName lastName username avatar isVerified')
      .populate('replyToUser', 'firstName lastName username')
      .sort({ createdAt: 1 }) // oldest first so parent always before child
      .lean();

    // ── Build nested tree ──
    const map = {};   // id → comment node
    const roots = []; // top-level comments

    // First pass: index every comment
    allComments.forEach(c => {
      c.replies = [];
      c.likeCount = c.likes ? c.likes.length : 0;
      c.dislikeCount = c.dislikes ? c.dislikes.length : 0;
      map[c._id.toString()] = c;
    });

    // Second pass: attach replies to their parents
    allComments.forEach(c => {
      if (c.parentComment) {
        const parentId = c.parentComment.toString();
        if (map[parentId]) {
          map[parentId].replies.push(c);
        } else {
          // Parent was deleted or missing — show as root so comment isn't lost
          roots.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    // Sort roots: newest first
    roots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Sort replies within each node: oldest first (chronological thread order)
    const sortReplies = (nodes) => {
      nodes.forEach(n => {
        if (n.replies.length > 0) {
          n.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          sortReplies(n.replies);
        }
      });
    };
    sortReplies(roots);

    return res.json(roots);

  } catch (err) {
    console.error('❌ Get comments error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   DELETE /api/comments/:commentId
   • Comment author can delete their own
   • Video creator can delete any comment on their video
   • Admins can delete anything
───────────────────────────────────────────── */
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const video = await Video.findById(comment.video).select('creator');
    const isAuthor = comment.user.toString() === req.user._id.toString();
    const isVideoCreator = video && video.creator.toString() === req.user._id.toString();
    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);

    if (!isAuthor && !isVideoCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised to delete this comment' });
    }

    comment.isDeleted = true;
    comment.deletedBy = req.user._id;
    comment.deletionReason = isAuthor ? 'user' : isVideoCreator ? 'creator' : 'admin';
    await comment.save();

    return res.json({ success: true, message: 'Comment deleted' });

  } catch (err) {
    console.error('❌ Delete comment error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/comments/:commentId/like
───────────────────────────────────────────── */
router.post('/:commentId/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const userId = req.user._id.toString();
    const alreadyLiked = comment.likes.map(id => id.toString()).includes(userId);

    if (alreadyLiked) {
      // Unlike
      comment.likes = comment.likes.filter(id => id.toString() !== userId);
    } else {
      // Like — also remove from dislikes if present
      comment.likes.push(req.user._id);
      comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId);
    }

    await comment.save();
    return res.json({
      success: true,
      action: alreadyLiked ? 'unliked' : 'liked',
      likeCount: comment.likes.length,
      dislikeCount: comment.dislikes.length,
    });

  } catch (err) {
    console.error('❌ Like comment error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/comments/:commentId/dislike
───────────────────────────────────────────── */
router.post('/:commentId/dislike', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const userId = req.user._id.toString();
    const alreadyDisliked = comment.dislikes.map(id => id.toString()).includes(userId);

    if (alreadyDisliked) {
      comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId);
    } else {
      comment.dislikes.push(req.user._id);
      comment.likes = comment.likes.filter(id => id.toString() !== userId);
    }

    await comment.save();
    return res.json({
      success: true,
      action: alreadyDisliked ? 'undisliked' : 'disliked',
      likeCount: comment.likes.length,
      dislikeCount: comment.dislikes.length,
    });

  } catch (err) {
    console.error('❌ Dislike comment error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/* ─────────────────────────────────────────────
   PUT /api/comments/:commentId
   Edit own comment
───────────────────────────────────────────── */
router.put('/:commentId', protect, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const isAuthor = comment.user.toString() === req.user._id.toString();
    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const updated = await Comment.findById(comment._id)
      .populate('user', 'firstName lastName username avatar isVerified')
      .populate('replyToUser', 'firstName lastName username')
      .lean();

    return res.json({ success: true, comment: updated });

  } catch (err) {
    console.error('❌ Edit comment error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;