// file: backend/middleware/adminMiddleware.js
const User = require('../models/User');

// Admin hierarchy levels
const hierarchy = {
  supportadmin: 1,
  platformadmin: 2,
  superadmin: 3,
};

// --------------------------
// CHECK MINIMUM ADMIN LEVEL
// --------------------------
const checkAdminLevel = (requiredLevel) => async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const userLevel = hierarchy[user.role] || 0;
    const neededLevel = hierarchy[requiredLevel] || 0;

    if (userLevel < neededLevel)
      return res.status(403).json({ message: `Requires ${requiredLevel} privileges` });

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --------------------------
// PREVENT DEMOTION OF FOUNDING SUPER ADMINS
// --------------------------
const preventDemoteFounders = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (targetUser.isFounder)
      return res.status(403).json({ message: 'Founding superadmins cannot be demoted' });

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --------------------------
// RESTRICT ACTIONS TO LOWER-LEVEL ADMINS
// --------------------------
const restrictToLowerAdmin = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const currentAdminLevel = hierarchy[req.user.role] || 0;
    const targetLevel = hierarchy[targetUser.role] || 0;

    if (targetLevel >= currentAdminLevel)
      return res.status(403).json({ message: 'Cannot manage admins of equal or higher level' });

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --------------------------
// SPECIFIC PERMISSION CHECKS
// --------------------------
const canApproveFilm = (req, res, next) => checkAdminLevel('platformadmin')(req, res, next);
const canGiveLiveAccess = (req, res, next) => checkAdminLevel('platformadmin')(req, res, next);
const canGiveVerificationBadge = (req, res, next) => checkAdminLevel('platformadmin')(req, res, next);

// --------------------------
// DETECT INACTIVE ADMINS (>7 DAYS)
// --------------------------
const inactiveAdminCheck = async (req, res, next) => {
  try {
    const admins = await User.find({
      role: { $in: ['supportadmin', 'platformadmin', 'superadmin'] },
    });

    const inactiveAdmins = admins.filter(
      (admin) =>
        !admin.lastActive ||
        (Date.now() - new Date(admin.lastActive)) / (1000 * 60 * 60 * 24) > 7
    );

    req.inactiveAdmins = inactiveAdmins; // attach for routes to notify super admin
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  checkAdminLevel,
  preventDemoteFounders,
  restrictToLowerAdmin,
  canApproveFilm,
  canGiveLiveAccess,
  canGiveVerificationBadge,
  inactiveAdminCheck,
};
