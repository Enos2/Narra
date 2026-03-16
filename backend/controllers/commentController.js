// controllers/commentController.js
const Video = require('../models/Video');
const User = require('../models/User');

/*
|---------------------------------------------------------------------------
| ADD COMMENT
| Handles user comment creation
|---------------------------------------------------------------------------
*/
exports.addComment = async (req, res) => {
  try {
    const { videoId, text } = req.body;
    if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });

    const video = await Video.findById(videoId);
    if (!video || video.isDeleted || !video.approved) return res.status(404).json({ message: 'Video not available' });

    const comment = {
      id: Date.now().toString(),
      userId: req.user._id,
      username: req.user.name,
      text,
      createdAt: new Date(),
      hidden: false,
      likes: [],
      dislikes: []
    };

    video.comments.push(comment);
    await video.save();

    res.status(201).json({ message: 'Comment added', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| LIKE OR DISLIKE COMMENT
| type = 'like' or 'dislike'
|---------------------------------------------------------------------------
*/
exports.reactComment = async (req, res) => {
  try {
    const { videoId, commentId, type } = req.body;
    if (!['like','dislike'].includes(type)) return res.status(400).json({ message: 'Invalid reaction type' });

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const comment = video.comments.find(c => c.id === commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const userId = req.user._id.toString();

    // Remove previous reaction
    comment.likes = comment.likes.filter(id => id.toString() !== userId);
    comment.dislikes = comment.dislikes.filter(id => id.toString() !== userId);

    if (type === 'like') comment.likes.push(req.user._id);
    if (type === 'dislike') comment.dislikes.push(req.user._id);

    await video.save();
    res.status(200).json({ message: `${type} recorded`, likes: comment.likes.length, dislikes: comment.dislikes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| HIDE COMMENT (USER)
| Users can hide their own comment
|---------------------------------------------------------------------------
*/
exports.hideComment = async (req, res) => {
  try {
    const { videoId, commentId } = req.body;

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const comment = video.comments.find(c => c.id === commentId && c.userId.toString() === req.user._id.toString());
    if (!comment) return res.status(404).json({ message: 'Comment not found or not yours' });

    comment.hidden = true;
    await video.save();

    // Optional: notify admins
    console.log(`Admin Notification: User ${req.user.name} hid a comment on video ${video.title}`);

    res.status(200).json({ message: 'Comment hidden' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| EDIT COMMENT (USER)
| Users can edit their own comment
|---------------------------------------------------------------------------
*/
exports.editComment = async (req, res) => {
  try {
    const { videoId, commentId, newText } = req.body;
    if (!newText) return res.status(400).json({ message: 'Comment cannot be empty' });

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const comment = video.comments.find(c => c.id === commentId && c.userId.toString() === req.user._id.toString());
    if (!comment) return res.status(404).json({ message: 'Comment not found or not yours' });

    comment.text = newText;
    comment.updatedAt = new Date();
    await video.save();

    res.status(200).json({ message: 'Comment updated', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| ADMIN: DELETE COMMENT (SOFT DELETE)
| Marks a comment as removed but keeps it in DB
|---------------------------------------------------------------------------
*/
exports.adminDeleteComment = async (req, res) => {
  try {
    const { videoId, commentId } = req.body;

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const comment = video.comments.find(c => c.id === commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    comment.hidden = true;
    comment.adminNote = req.body.adminNote || '';
    await video.save();

    res.status(200).json({ message: 'Comment removed by admin', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
|---------------------------------------------------------------------------
| GET COMMENTS
| Returns all visible comments for a video
|---------------------------------------------------------------------------
*/
exports.getComments = async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const visibleComments = video.comments.filter(c => !c.hidden);
    res.status(200).json({ comments: visibleComments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
