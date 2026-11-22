/**
 * File: backend/middleware/authMiddleware.js
 * Purpose: JWT authentication, role guards, minor-protection and upload
 *   permission middleware, plus token helpers.
 *
 * CHANGES IN THIS VERSION
 *   - JWT algorithm is pinned to HS256 on sign and verify; lifetime comes from
 *     JWT_EXPIRES_IN (default 7d); the e-mail address is no longer put in the token.
 *   - `protect` no longer saves the user document on EVERY request (a write per
 *     request, with version-conflict risk). Activity is updated with a single
 *     atomic update at most once a minute.
 *   - NEW `protectAllowDeactivated`: same checks, but lets a deactivated account
 *     through so it can reactivate itself (previously impossible).
 *   - No e-mail addresses are written to the logs.
 *   - `simpleAuth` now honours force-logout (tokenVersion) and admin deactivation.
 *   - Minor-protection and upload checks FAIL CLOSED when a non-admin account has
 *     no valid date of birth (previously they let the request through).
 *   - Role-violation responses no longer reveal which roles an endpoint needs.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ADMIN_ROLES = ['supportadmin', 'platformadmin', 'superadmin'];
const JWT_ALGORITHM = 'HS256';
const ACTIVITY_THROTTLE_MS = 60 * 1000;
const DEACTIVATION_GRACE_DAYS = 30;

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1] || null;
  return null;
};

const verifyJwt = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

/** One atomic update, at most once a minute, instead of a full save() per request. */
const touchActivity = async (user) => {
  const now = Date.now();
  const last = user.lastActive ? new Date(user.lastActive).getTime() : 0;
  if (user.online && now - last < ACTIVITY_THROTTLE_MS) return;

  const $set = { online: true, lastActive: new Date(now) };
  if (!user.online) $set.lastLogin = new Date(now);

  try {
    await User.updateOne({ _id: user._id }, { $set });
  } catch (err) {
    // Never fail a request because activity tracking failed.
    console.error('⚠️ Failed to update user activity:', err.message);
  }
};

/* ======================================================
   JWT AUTH PROTECTION WITH TOKEN VERSION CHECKING
====================================================== */
const buildProtect = ({ allowDeactivated = false } = {}) => async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (err) {
      console.error('❌ JWT verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }

    const user = await User.findById(decoded.id).select(
      '-password -passwordResetToken -passwordResetExpires'
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    /* ================================
       TOKEN VERSION CHECK (FORCE LOGOUT)
    ================================= */
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      console.log(`🔒 Token version mismatch for user ${user._id}`);
      try {
        await User.updateOne({ _id: user._id }, { $set: { online: false, lastActive: new Date() } });
      } catch {
        /* ignore */
      }
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
        code: 'TOKEN_VERSION_MISMATCH',
      });
    }

    /* ================================
       ACCOUNT STATE CHECKS
    ================================= */
    if (user.isBanned) {
      console.log(`🚫 Banned user attempting access: ${user._id}`);
      return res.status(403).json({
        success: false,
        message: 'Account banned',
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy,
      });
    }

    if (user.isDeactivated) {
      const expired =
        user.deactivatedAt &&
        Math.floor((Date.now() - new Date(user.deactivatedAt)) / (1000 * 60 * 60 * 24)) > DEACTIVATION_GRACE_DAYS;

      if (expired) {
        return res.status(403).json({
          success: false,
          message: 'Account permanently deleted',
          code: 'ACCOUNT_PERMANENTLY_DELETED',
        });
      }

      if (!allowDeactivated) {
        return res.status(403).json({
          success: false,
          message: 'Account deactivated. Reactivate to access this resource.',
          deactivatedAt: user.deactivatedAt,
          code: 'ACCOUNT_DEACTIVATED',
        });
      }
    }

    /* ================================
       ADMIN INACTIVITY CHECK
    ================================= */
    if (ADMIN_ROLES.includes(user.role) && user.adminDeactivated) {
      console.log(`👑 Deactivated admin attempting access: ${user._id}`);
      return res.status(403).json({
        success: false,
        message: 'Admin access blocked due to inactivity or deactivation. Contact a Super Admin.',
        adminDeactivatedAt: user.adminDeactivatedAt,
        adminDeactivationReason: user.adminDeactivationReason,
        code: 'ADMIN_DEACTIVATED',
      });
    }

    /* ================================
       SHADOW BAN (REGIONAL)
    ================================= */
    if (user.isShadowBanned) {
      const shadowBanInfo = [];

      if (user.shadowBannedCountries && user.country && user.shadowBannedCountries.includes(user.country)) {
        shadowBanInfo.push(`country: ${user.country}`);
      }
      if (user.shadowBannedContinents && user.continent && user.shadowBannedContinents.includes(user.continent)) {
        shadowBanInfo.push(`continent: ${user.continent}`);
      }

      if (shadowBanInfo.length > 0) {
        console.log(`🌍 Shadow banned user access attempt: ${user._id} (${shadowBanInfo.join(', ')})`);
        return res.status(403).json({
          success: false,
          message: 'Access restricted in your region',
          restrictions: shadowBanInfo,
          code: 'SHADOW_BANNED',
        });
      }
    }

    /* ================================
       ACTIVITY TRACKING (throttled)
    ================================= */
    await touchActivity(user);

    // Attach a plain object (controllers that need a document re-fetch it).
    req.user = {
      ...user.toObject(),
      tokenVersion: user.tokenVersion || 0,
    };

    next();
  } catch (err) {
    console.error('❌ Protect middleware error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.protect = buildProtect();
exports.protectAllowDeactivated = buildProtect({ allowDeactivated: true });

/* ======================================================
   ADMIN MIDDLEWARE
   Simple admin check for routes that require admin access
====================================================== */
exports.admin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized as admin' });
    }

    next();
  } catch (err) {
    console.error('❌ Admin middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/* ======================================================
   ROLE-BASED ACCESS CONTROL
====================================================== */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      console.log(`🚫 Role violation: ${userRole} (${req.user._id}) on a restricted endpoint`);
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions',
      });
    }

    next();
  };
};

exports.requireRole = roleGuard;
exports.restrictTo = roleGuard;

// Admin access levels
exports.adminOnly = roleGuard('supportadmin', 'platformadmin', 'superadmin');
exports.superAdminOnly = roleGuard('superadmin');
exports.platformAdminOrHigher = roleGuard('platformadmin', 'superadmin');

/* ======================================================
   MINOR PROTECTION (CHILD SAFETY) — fails closed
====================================================== */
exports.blockMinors = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const age = getAge(req.user.dateOfBirth);

  if (age === null) {
    // No usable date of birth: only admins may proceed.
    if (ADMIN_ROLES.includes(req.user.role)) return next();
    return res.status(403).json({
      success: false,
      message: 'Please add your date of birth to access this content',
      code: 'AGE_UNVERIFIED',
    });
  }

  if (age < 18) {
    return res.status(403).json({
      success: false,
      message: 'This content is restricted for users under 18',
      userAge: age,
      code: 'MINOR_RESTRICTION',
    });
  }

  next();
};

/* ======================================================
   UPLOAD PERMISSION CHECK
   Enforces server-side upload restrictions
====================================================== */
exports.checkUploadPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  if (req.user.isBanned) {
    return res.status(403).json({
      success: false,
      message: 'Banned accounts cannot upload content',
      code: 'BANNED_NO_UPLOAD',
    });
  }

  if (req.user.isDeactivated) {
    return res.status(403).json({
      success: false,
      message: 'Deactivated accounts cannot upload content',
      code: 'DEACTIVATED_NO_UPLOAD',
    });
  }

  if (req.body && req.body.type === 'live' && !req.user.canGoLive) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to go live',
      liveStrikes: req.user.liveStrikes?.length || 0,
      code: 'NO_LIVE_PERMISSION',
    });
  }

  // Must be 18+ to upload; an unknown age is treated as not allowed (admins excepted)
  const age = getAge(req.user.dateOfBirth);
  if (age === null) {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Please add your date of birth before uploading content',
        code: 'AGE_UNVERIFIED',
      });
    }
  } else if (age < 18) {
    return res.status(403).json({
      success: false,
      message: 'Users under 18 cannot upload content',
      userAge: age,
      code: 'MINOR_NO_UPLOAD',
    });
  }

  next();
};

/* ======================================================
   TOKEN GENERATION HELPER
====================================================== */
exports.generateToken = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: JWT_ALGORITHM,
  });
};

/* ======================================================
   TOKEN VALIDATION HELPER
====================================================== */
exports.validateToken = async (token) => {
  try {
    const decoded = verifyJwt(token);
    const user = await User.findById(decoded.id).select('tokenVersion');

    if (!user) {
      return { valid: false, reason: 'User not found' };
    }

    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return { valid: false, reason: 'Token version mismatch (force logged out)' };
    }

    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
};

/* ======================================================
   REQUEST LOGGER (optional middleware for debugging)
====================================================== */
exports.requestLogger = (req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.user) {
    console.log(`   👤 User: ${req.user._id} (${req.user.role})`);
  }
  next();
};

/* ======================================================
   SIMPLE AUTH CHECK (for non-critical endpoints; never rejects)
====================================================== */
exports.simpleAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyJwt(token);
    const user = await User.findById(decoded.id).select('-password');

    const valid =
      user &&
      !user.isBanned &&
      !user.isDeactivated &&
      (user.tokenVersion || 0) === (decoded.tokenVersion || 0) &&
      !(ADMIN_ROLES.includes(user.role) && user.adminDeactivated);

    req.user = valid ? user : null;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

// ═══ END OF FILE: backend/middleware/authMiddleware.js ═══