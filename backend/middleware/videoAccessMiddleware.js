// /middleware/videoAccessMiddleware.js
const Video = require('../models/Video');
const User = require('../models/User');

exports.checkVideoAccess = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Check shadow-ban: if user is blocked from this video
    if (video.shadowBannedCountries?.includes(user.country) || video.shadowBannedUsers?.includes(user._id.toString())) {
      return res.status(403).json({ message: 'You do not have access to this content' });
    }

    const userId = user._id.toString();
    const hasAccess =
      !video.isPaid ||
      video.purchases.map((id) => id.toString()).includes(userId) ||
      ['superadmin', 'platformadmin', 'supportadmin'].includes(user.role);

    if (!hasAccess) {
      return res.status(402).json({
        message: 'Payment required to watch this video',
        price: video.price,
        isPaid: video.isPaid,
      });
    }

    // Attach video info for downstream controllers
    req.video = {
      ...video.toObject(),
      accessGranted: true,
      isAdminOverride: ['superadmin', 'platformadmin', 'supportadmin'].includes(user.role),
    };

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
