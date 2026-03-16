const jwt = require('jsonwebtoken');
const User = require('../models/User');

/* ======================================================
   JWT AUTH PROTECTION WITH TOKEN VERSION CHECKING
====================================================== */
exports.protect = async (req, res, next) => {
  try {
    let token = null;

    // Extract token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('❌ JWT verification failed:', err.message);
      return res.status(401).json({ 
        success: false,
        message: 'Token invalid or expired' 
      });
    }

    // Find user with ALL fields including tokenVersion
    const user = await User.findById(decoded.id).select(
      '-password -passwordResetToken -passwordResetExpires'
    );

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    /* ================================
       TOKEN VERSION CHECK (FORCE LOGOUT)
    ================================= */
    // Check if token version matches (for force logout feature)
    const tokenVersionFromJWT = decoded.tokenVersion || 0;
    const currentTokenVersion = user.tokenVersion || 0;
    
    if (tokenVersionFromJWT !== currentTokenVersion) {
      console.log(`🔒 Token version mismatch for user ${user.email}`);
      console.log(`   JWT tokenVersion: ${tokenVersionFromJWT}`);
      console.log(`   DB tokenVersion: ${currentTokenVersion}`);
      
      // Mark user as offline since token is invalid
      user.online = false;
      user.lastActive = new Date();
      await user.save({ validateBeforeSave: false });
      
      return res.status(401).json({ 
        success: false,
        message: 'Session expired. Please login again.',
        code: 'TOKEN_VERSION_MISMATCH'
      });
    }

    /* ================================
       ACCOUNT STATE CHECKS
    ================================= */
    if (user.isBanned) {
      console.log(`🚫 Banned user attempting access: ${user.email}`);
      return res.status(403).json({ 
        success: false,
        message: 'Account banned',
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy
      });
    }

    if (user.isDeactivated) {
      console.log(`⏸️ Deactivated user attempting access: ${user.email}`);
      
      if (user.deactivatedAt) {
        const diffDays = Math.floor(
          (Date.now() - new Date(user.deactivatedAt)) / (1000 * 60 * 60 * 24)
        );
        
        if (diffDays > 30) {
          return res.status(403).json({ 
            success: false,
            message: 'Account permanently deleted',
            code: 'ACCOUNT_PERMANENTLY_DELETED'
          });
        }
      }
      
      return res.status(403).json({
        success: false,
        message: 'Account deactivated. Reactivate to access this resource.',
        deactivatedAt: user.deactivatedAt,
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    /* ================================
       ADMIN INACTIVITY CHECK
    ================================= */
    if (
      ['supportadmin', 'platformadmin', 'superadmin'].includes(user.role) &&
      user.adminDeactivated
    ) {
      console.log(`👑 Deactivated admin attempting access: ${user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Admin access blocked due to inactivity or deactivation. Contact a Super Admin.',
        adminDeactivatedAt: user.adminDeactivatedAt,
        adminDeactivationReason: user.adminDeactivationReason,
        code: 'ADMIN_DEACTIVATED'
      });
    }

    /* ================================
       SHADOW BAN (REGIONAL)
    ================================= */
    if (user.isShadowBanned) {
      const shadowBanInfo = [];
      
      if (user.shadowBannedCountries && user.country && 
          user.shadowBannedCountries.includes(user.country)) {
        shadowBanInfo.push(`country: ${user.country}`);
      }
      
      if (user.shadowBannedContinents && user.continent && 
          user.shadowBannedContinents.includes(user.continent)) {
        shadowBanInfo.push(`continent: ${user.continent}`);
      }
      
      if (shadowBanInfo.length > 0) {
        console.log(`🌍 Shadow banned user access attempt: ${user.email}`);
        console.log(`   Restrictions: ${shadowBanInfo.join(', ')}`);
        
        return res.status(403).json({ 
          success: false,
          message: 'Access restricted in your region',
          restrictions: shadowBanInfo,
          code: 'SHADOW_BANNED'
        });
      }
    }

    /* ================================
       ACTIVITY TRACKING - FIXED
       ================================= */
    // Only track if user is coming online (not already online)
    if (!user.online) {
      user.online = true;
      user.lastLogin = new Date();
    }
    
    // Update lastActive but let the User model's pre-save hook handle the actual update
    // to avoid triggering the middleware multiple times
    user.lastActive = new Date();
    
    // Save user without triggering validation - FIXED
    try {
      await user.save({ validateBeforeSave: false });
    } catch (saveErr) {
      console.error('⚠️ Failed to update user activity:', saveErr.message);
      // Don't fail the request just because activity tracking failed
    }

    /* ================================
       TOKEN RENEWAL CHECK (Optional)
       ================================= */
    // Example: Renew token if it's about to expire
    const tokenAge = Date.now() - (decoded.iat * 1000);
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (tokenAge > (oneDay * 6)) { // Renew if token is older than 6 days (7-day expiry)
      console.log(`🔄 Token nearing expiry for user: ${user.email}`);
      req.shouldRenewToken = true;
    }

    // Attach user to request
    req.user = {
      ...user.toObject(),
      tokenVersion: user.tokenVersion || 0
    };
    
    next();
  } catch (err) {
    console.error('❌ Protect middleware error:', err.message);
    console.error('Error stack:', err.stack);
    return res.status(401).json({ 
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/* ======================================================
   ADMIN MIDDLEWARE (ADD THIS)
   Simple admin check for routes that require admin access
====================================================== */
exports.admin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, no token' 
      });
    }

    const adminRoles = ['superadmin', 'platformadmin', 'supportadmin'];
    if (!adminRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized as admin' 
      });
    }

    next();
  } catch (err) {
    console.error('❌ Admin middleware error:', err.message);
    return res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/* ======================================================
   ROLE-BASED ACCESS CONTROL
====================================================== */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }
    
    const userRole = req.user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`🚫 Role violation: ${userRole} trying to access ${allowedRoles.join(', ')} endpoint`);
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: userRole
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
   MINOR PROTECTION (CHILD SAFETY)
====================================================== */
exports.blockMinors = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Not authenticated' 
    });
  }

  // Calculate age from dateOfBirth
  if (req.user.dateOfBirth) {
    const birthDate = new Date(req.user.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return res.status(403).json({
        success: false,
        message: 'This content is restricted for users under 18',
        userAge: age,
        code: 'MINOR_RESTRICTION'
      });
    }
  }
  
  next();
};

/* ======================================================
   UPLOAD PERMISSION CHECK
   Enforces server-side upload restrictions
====================================================== */
exports.checkUploadPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Not authenticated' 
    });
  }

  // Check if user is banned
  if (req.user.isBanned) {
    return res.status(403).json({ 
      success: false,
      message: 'Banned accounts cannot upload content',
      code: 'BANNED_NO_UPLOAD'
    });
  }

  // Check if user is deactivated
  if (req.user.isDeactivated) {
    return res.status(403).json({ 
      success: false,
      message: 'Deactivated accounts cannot upload content',
      code: 'DEACTIVATED_NO_UPLOAD'
    });
  }

  // Check if user can go live (if uploading live stream)
  if (req.body.type === 'live' && !req.user.canGoLive) {
    return res.status(403).json({ 
      success: false,
      message: 'You do not have permission to go live',
      liveStrikes: req.user.liveStrikes?.length || 0,
      code: 'NO_LIVE_PERMISSION'
    });
  }

  // Check age restriction (must be 18+ for uploads)
  if (req.user.dateOfBirth) {
    const birthDate = new Date(req.user.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return res.status(403).json({ 
        success: false,
        message: 'Users under 18 cannot upload content',
        userAge: age,
        code: 'MINOR_NO_UPLOAD'
      });
    }
  }

  next();
};

/* ======================================================
   TOKEN GENERATION HELPER (Updated to include tokenVersion)
====================================================== */
exports.generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion || 0
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/* ======================================================
   TOKEN VALIDATION HELPER
====================================================== */
exports.validateToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('tokenVersion');
    
    if (!user) {
      return { valid: false, reason: 'User not found' };
    }
    
    // Check token version
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return { valid: false, reason: 'Token version mismatch (force logged out)' };
    }
    
    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
};

/* ======================================================
   REQUEST LOGGER (Optional middleware for debugging)
====================================================== */
exports.requestLogger = (req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.user) {
    console.log(`   👤 User: ${req.user.email} (${req.user.role})`);
    console.log(`   🔢 Token Version: ${req.user.tokenVersion || 0}`);
  }
  next();
};

/* ======================================================
   SIMPLE AUTH CHECK (For non-critical endpoints)
====================================================== */
exports.simpleAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && !user.isBanned && !user.isDeactivated) {
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};