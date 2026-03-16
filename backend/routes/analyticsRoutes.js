const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Video = require('../models/Video');

/*
|--------------------------------------------------------------------------
| GET PLATFORM ANALYTICS (ADMIN & SUPERADMIN)
|--------------------------------------------------------------------------
*/
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Users per country
    const usersPerCountry = await User.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
    ]);

    // Total videos
    const totalVideos = await Video.countDocuments();

    // Videos by status
    const videosByStatus = await Video.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Trending creators (most uploaded videos)
    const trendingCreators = await Video.aggregate([
      { $group: { _id: '$uploadedBy', videosCount: { $sum: 1 } } },
      { $sort: { videosCount: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      totalUsers,
      usersPerCountry,
      totalVideos,
      videosByStatus,
      trendingCreators,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/*
|--------------------------------------------------------------------------
| GET ANALYTICS FOR SPECIFIC CREATOR
|--------------------------------------------------------------------------
*/
router.get('/creator/:creatorId', protect, async (req, res) => {
  try {
    const { creatorId } = req.params;

    // Only admin or the creator themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== creatorId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const totalVideos = await Video.countDocuments({ uploadedBy: creatorId });
    const approvedVideos = await Video.countDocuments({ uploadedBy: creatorId, status: 'approved' });
    const rejectedVideos = await Video.countDocuments({ uploadedBy: creatorId, status: 'rejected' });

    res.json({
      totalVideos,
      approvedVideos,
      rejectedVideos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/*
|--------------------------------------------------------------------------
| GET SALES ANALYTICS (SUPERADMIN ONLY)
|--------------------------------------------------------------------------
*/
router.get('/sales', protect, superAdminOnly, async (req, res) => {
  try {
    const videos = await Video.find({ isPaid: true }).populate('uploadedBy', 'name');

    const sales = videos.map(video => ({
      videoId: video._id,
      title: video.title,
      uploader: video.uploadedBy.name,
      price: video.price,
      totalPurchases: video.purchases.length,
      totalRevenue: video.price * video.purchases.length,
    }));

    const totalRevenue = sales.reduce((sum, v) => sum + v.totalRevenue, 0);

    res.json({
      totalRevenue,
      sales,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
