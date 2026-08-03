const User = require('../models/User');
const Video = require('../models/Video');
const Live = require('../models/Live');

/*
========================================
PLATFORM OVERVIEW (SUPER ADMIN ONLY)
========================================
- total users
- total creators
- total videos
- total lives
- revenue summary
*/
exports.platformOverview = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalCreators = await User.countDocuments({ isCreator: true });
    const totalAdmins = await User.countDocuments({
      role: { $in: ['supportadmin', 'platformadmin', 'superadmin'] },
    });

    const totalVideos = await Video.countDocuments();
    const totalLives = await Live.countDocuments();

    const paidVideos = await Video.find({ isPaid: true });
    const totalRevenue = paidVideos.reduce(
      (sum, v) => sum + v.price * v.purchases.length,
      0
    );

    res.json({
      users: totalUsers,
      creators: totalCreators,
      admins: totalAdmins,
      videos: totalVideos,
      lives: totalLives,
      totalRevenue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
========================================
USERS BY COUNTRY
========================================
- visible to ALL ADMINS + CREATORS
*/
exports.usersByCountry = async (req, res) => {
  try {
    const users = await User.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
========================================
CREATOR ANALYTICS (SELF)
========================================
- views
- purchases
- earnings
*/
exports.creatorAnalytics = async (req, res) => {
  try {
    const videos = await Video.find({ uploadedBy: req.user._id });

    let totalViews = 0;
    let totalSales = 0;
    let earnings = 0;

    videos.forEach((v) => {
      totalViews += v.views;
      totalSales += v.purchases.length;
      earnings += v.price * v.purchases.length;
    });

    res.json({
      totalVideos: videos.length,
      totalViews,
      totalSales,
      earnings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
========================================
VIDEO PERFORMANCE (ADMIN)
========================================
*/
exports.videoPerformance = async (req, res) => {
  try {
    const videos = await Video.find()
      .select('title views purchases isPaid price status')
      .populate('uploadedBy', 'name');

    const stats = videos.map((v) => ({
      title: v.title,
      creator: v.uploadedBy.name,
      views: v.views,
      sales: v.purchases.length,
      revenue: v.isPaid ? v.price * v.purchases.length : 0,
      status: v.status,
    }));

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
========================================
ADMIN ACTIVITY LOG
========================================
- public transparency
*/
exports.adminActivity = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ['supportadmin', 'platformadmin', 'superadmin'] },
    }).select('name role actions lastActive');

    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/*
========================================
INACTIVE ADMINS (SUPER ADMIN)
========================================
*/
exports.inactiveAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ['supportadmin', 'platformadmin', 'superadmin'] },
    });

    const inactive = admins.filter(
      (a) =>
        !a.lastActive ||
        (Date.now() - new Date(a.lastActive)) / (1000 * 60 * 60 * 24) > 7
    );

    res.json(inactive);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
