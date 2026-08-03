/**
 * middleware/messagingMiddleware.js
 *
 * Attaches a normalised `req.actor` object so message controllers
 * don't need to care whether the caller is a User or an Admin.
 *
 * actor = { id, model: 'User'|'Admin', role, name }
 *
 * Must run AFTER protect (authMiddleware) which already attaches req.user.
 */

exports.resolveActor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const u = req.user;
  const adminRoles = ['superadmin', 'platformadmin', 'supportadmin',
                      'super_admin', 'platform_admin', 'support_admin'];

  const isAdmin = adminRoles.includes((u.role || '').toLowerCase());

  req.actor = {
    id:    u._id || u.id,
    model: isAdmin ? 'Admin' : 'User',
    role:  u.role,
    name:  u.fullName || u.name || u.username || u.email || 'Unknown',
  };

  next();
};

/**
 * Restrict a route to user-lane only (regular users).
 */
exports.userLaneOnly = (req, res, next) => {
  if (!req.actor) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.actor.model !== 'User') {
    return res.status(403).json({ success: false, message: 'This endpoint is for users only' });
  }
  next();
};

/**
 * Restrict a route to admin-lane only.
 */
exports.adminLaneOnly = (req, res, next) => {
  if (!req.actor) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.actor.model !== 'Admin') {
    return res.status(403).json({ success: false, message: 'This endpoint is for admins only' });
  }
  next();
};

/**
 * Super-admin only — used for viewing admin conversations.
 */
exports.superAdminOnly = (req, res, next) => {
  if (!req.actor) return res.status(401).json({ success: false, message: 'Not authenticated' });
  const role = (req.actor.role || '').toLowerCase().replace('_', '');
  if (role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};