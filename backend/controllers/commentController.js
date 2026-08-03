// controllers/commentController.js
const Video = require('../models/Video');
const User = require('../models/User');
const Comment = require('../models/Comment');

/*
|---------------------------------------------------------------------------
| ADD COMMENT
| Handles user comment creation
|---------------------------------------------------------------------------
*/
exports.addComment = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content, rating, parentCommentId } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    const video = await Video.findById(videoId);
    if (!video || video.isDeleted || video.status !== 'released') {
      return res.status(404).json({ message: 'Video not available' });
    }

    // Check if video is paid and user has access
    if (video.isPaid) {
      const hasPurchased = video.purchases.some(p => p.user.toString() === req.user._id.toString());
      const isCreator = video.creator.toString() === req.user._id.toString();
      const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);
      
      if (!hasPurchased && !isCreator && !isAdmin) {
        return res.status(403).json({ message: 'Purchase required to comment' });
      }
    }

    const comment = await Comment.create({
      video: videoId,
      user: req.user._id,
      content: content.trim(),
      rating: rating || null,
      parentComment: parentCommentId || null
    });

    // Populate user data for response - FIXED to include firstName, lastName
    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'firstName lastName username avatar isVerified email')
      .lean();

    // Add isCreator flag
    populatedComment.isCreator = video.creator.toString() === req.user._id.toString();

    res.status(201).json({ 
      success: true,
      message: 'Comment added', 
      comment: populatedComment 
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| ADD REPLY TO COMMENT - FIXED route path
|---------------------------------------------------------------------------
*/
exports.addReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Reply cannot be empty' });
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment || parentComment.isDeleted) {
      return res.status(404).json({ message: 'Original comment not found' });
    }

    const video = await Video.findById(parentComment.video);
    if (!video || video.isDeleted || video.status !== 'released') {
      return res.status(404).json({ message: 'Video not available' });
    }

    const reply = await Comment.create({
      video: parentComment.video,
      user: req.user._id,
      content: content.trim(),
      parentComment: commentId
    });

    const populatedReply = await Comment.findById(reply._id)
      .populate('user', 'firstName lastName username avatar isVerified email')
      .lean();

    res.status(201).json({ 
      success: true,
      message: 'Reply added', 
      reply: populatedReply 
    });
  } catch (err) {
    console.error('Add reply error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| GET COMMENTS FOR VIDEO
| Returns all visible comments with replies
|---------------------------------------------------------------------------
*/
exports.getVideoComments = async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Get video to check creator
    const video = await Video.findById(videoId).select('creator');
    
    // Get all non-deleted comments for this video
    const comments = await Comment.find({ 
      video: videoId, 
      isDeleted: false,
      parentComment: null
    })
      .populate('user', 'firstName lastName username avatar isVerified email')
      .sort({ createdAt: -1 })
      .lean();

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
      const replies = await Comment.find({ 
        parentComment: comment._id,
        isDeleted: false 
      })
        .populate('user', 'firstName lastName username avatar isVerified email')
        .sort({ createdAt: 1 })
        .lean();
      
      return {
        ...comment,
        replies: replies,
        replyCount: replies.length,
        isCreator: video && video.creator && comment.user && video.creator.toString() === comment.user._id.toString()
      };
    }));

    res.status(200).json({ 
      success: true,
      comments: commentsWithReplies,
      count: commentsWithReplies.length
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| GET REPLIES FOR A COMMENT
|---------------------------------------------------------------------------
*/
exports.getReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const replies = await Comment.find({ 
      parentComment: commentId,
      isDeleted: false 
    })
      .populate('user', 'firstName lastName username avatar isVerified email')
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({ 
      success: true,
      replies,
      count: replies.length
    });
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| EDIT COMMENT
| Users can edit their own comment
|---------------------------------------------------------------------------
*/
exports.editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.user.toString() !== req.user._id.toString() && !['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const updatedComment = await Comment.findById(commentId)
      .populate('user', 'firstName lastName username avatar isVerified email')
      .lean();

    res.status(200).json({ 
      success: true,
      message: 'Comment updated', 
      comment: updatedComment 
    });
  } catch (err) {
    console.error('Edit comment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| DELETE COMMENT
| Users can delete their own comment, admins can delete any
|---------------------------------------------------------------------------
*/
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const isAuthor = comment.user.toString() === req.user._id.toString();
    const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    comment.isDeleted = true;
    comment.deletedBy = req.user._id;
    comment.deletionReason = 'User deleted';
    await comment.save();

    res.status(200).json({ 
      success: true,
      message: 'Comment deleted' 
    });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| LIKE OR UNLIKE COMMENT
|---------------------------------------------------------------------------
*/
exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userIndex = comment.likes.findIndex(id => id.toString() === userId.toString());
    
    if (userIndex >= 0) {
      comment.likes.splice(userIndex, 1);
      await comment.save();
      res.status(200).json({ 
        success: true,
        action: 'unliked',
        message: 'Comment unliked', 
        likes: comment.likes.length 
      });
    } else {
      comment.likes.push(userId);
      await comment.save();
      res.status(200).json({ 
        success: true,
        action: 'liked',
        message: 'Comment liked', 
        likes: comment.likes.length 
      });
    }
  } catch (err) {
    console.error('Like comment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};