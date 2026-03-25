/**
 * File: backend/controllers/authController.js
 * UPDATED: Added audit logging for admin login and logout
 */

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');

// Import AdminAuditLog for audit logging
let AdminAuditLog;
try {
  AdminAuditLog = require('../models/AdminAuditLog');
} catch (e) {
  console.warn('AdminAuditLog model not available for auth logging');
}

/*
========================================
HELPERS
========================================
*/

const calculateAge = (dob) => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

/**
 * Log admin action to audit log
 */
const logAdminAuthAction = async ({
  admin,
  actionType,
  actionLabel,
  description,
  ipAddress = null,
  userAgent = null,
  metadata = {}
}) => {
  try {
    if (!AdminAuditLog) return;
    
    const logEntry = new AdminAuditLog({
      adminId: admin._id,
      adminName: admin.name || admin.username || 'Unknown',
      adminRole: admin.role,
      adminEmail: admin.email,
      actionType,
      actionLabel,
      targetType: 'System',
      description,
      ipAddress,
      userAgent,
      metadata
    });

    await logEntry.save();
    console.log(`[AUDIT] ${actionLabel} by ${admin.email}`);
  } catch (err) {
    console.error('Failed to log admin auth action:', err);
  }
};

// Helper to format user response with restrictions
const formatUserResponse = (user) => {
  return {
    id: user._id,
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName || '',
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
    gender: user.gender || '',
    avatar: user.avatar,
    bio: user.bio || '',
    location: user.location || '',
    website: user.website || '',
    phoneNumber: user.phoneNumber || '',
    dateOfBirth: user.dateOfBirth,
    createdAt: user.createdAt,
    status: user.isBanned ? 'banned' : (user.isDeactivated ? 'deactivated' : 'active'),
    restrictions: user.restrictions || { upload: false, goLive: false, comment: false },
    canGoLive: user.canGoLive || false,
    isVerified: user.isVerified || false,
    isCreator: user.isCreator || false,
    balance: user.balance || 0,
    followers: user.followers || [],
    following: user.following || [],
    twins: user.twins || [],
    notificationPreferences: user.notificationPreferences || {},
    privacySettings: user.privacySettings || {},
    theme: user.theme || 'system',
    preferredLanguage: user.preferredLanguage || 'en',
    loginHistory: user.loginHistory || [],
    payoutMethod: user.payoutMethod || null,
    purchasedVideoIds: user.purchasedVideos || [],
    tokenVersion: user.tokenVersion || 0
  };
};

/*
========================================
REGISTER - UPDATED with restrictions
========================================
*/
exports.register = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      middleName, 
      username,
      email, 
      password, 
      dateOfBirth,
      gender 
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !username || !email || !password || !dateOfBirth) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    // Validate name lengths
    if (firstName.length < 2) {
      return res.status(400).json({ message: 'First name must be at least 2 characters' });
    }
    if (lastName.length < 2) {
      return res.status(400).json({ message: 'Last name must be at least 2 characters' });
    }

    // Validate username
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        message: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores' 
      });
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({ message: 'Invalid date of birth' });
    }

    const age = calculateAge(dob);
    if (age < 13) {
      return res.status(403).json({ message: 'You must be at least 13 years old to register' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName,
      lastName,
      middleName: middleName || '',
      username: username.toLowerCase(),
      email,
      password: hashedPassword,
      dateOfBirth: dob,
      gender: gender || '',
      restrictions: { upload: false, goLive: false, comment: false }, // Add restrictions with defaults
      lastLogin: new Date(),
      lastActive: new Date(),
    });

    const token = authMiddleware.generateToken(user);

    res.status(201).json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

/*
========================================
LOGIN (NORMAL USERS ONLY) - UPDATED with restrictions
========================================
*/
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // block admins from user login
    if (['supportadmin', 'platformadmin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admins must use the admin login page' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Account banned' });
    }

    if (user.isDeactivated) {
      return res.status(403).json({ message: 'Account deactivated' });
    }

    // Use bcrypt.compare directly
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    user.lastActive = new Date();
    user.online = true;
    await user.save({ validateBeforeSave: false });

    const token = authMiddleware.generateToken(user);

    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
ADMIN LOGIN - UPDATED with audit logging
========================================
*/
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ALLOW ALL ADMIN ROLES
    if (!['supportadmin', 'platformadmin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Invalid admin credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Admin account banned' });
    }

    if (user.isDeactivated) {
      return res.status(403).json({ message: 'Admin account deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    user.lastActive = new Date();
    user.online = true;
    await user.save({ validateBeforeSave: false });

    const token = authMiddleware.generateToken(user);

    // ADDED: Log admin login to audit log
    await logAdminAuthAction({
      admin: user,
      actionType: 'ADMIN_LOGIN',
      actionLabel: 'Admin Login',
      description: `Admin ${user.email} logged in successfully`,
      ipAddress,
      userAgent,
      metadata: {
        loginTime: new Date().toISOString(),
        role: user.role
      }
    });

    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
LOGOUT - UPDATED with audit logging
========================================
*/
exports.logout = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = ['supportadmin', 'platformadmin', 'superadmin'].includes(user.role);
    
    user.online = false;
    await user.save({ validateBeforeSave: false });

    // ADDED: Log admin logout to audit log (only for admin users)
    if (isAdmin && AdminAuditLog) {
      await logAdminAuthAction({
        admin: user,
        actionType: 'ADMIN_LOGOUT',
        actionLabel: 'Admin Logout',
        description: `Admin ${user.email} logged out`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          logoutTime: new Date().toISOString(),
          role: user.role
        }
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('LOGOUT ERROR:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
};

/*
========================================
PROFILE - UPDATED with restrictions
========================================
*/
exports.getMyProfile = async (req, res) => {
  res.json(formatUserResponse(req.user));
};

/*
========================================
ACCOUNT DEACTIVATION / REACTIVATION
========================================
*/
exports.deactivateAccount = async (req, res) => {
  try {
    req.user.isDeactivated = true;
    req.user.deactivationRequestedAt = new Date();
    await req.user.save({ validateBeforeSave: false });
    res.json({ message: 'Account deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to deactivate account' });
  }
};

exports.reactivateAccount = async (req, res) => {
  try {
    req.user.isDeactivated = false;
    req.user.deactivationRequestedAt = null;
    await req.user.save({ validateBeforeSave: false });
    res.json({ message: 'Account reactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to reactivate account' });
  }
};

/*
========================================
PASSWORD RESET
========================================
*/
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If the email exists, a reset link was sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Password reset link sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to request password reset' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token invalid or expired' });
    }

    user.password = await bcrypt.hash(req.body.password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Password reset failed' });
  }
};

/*
========================================
ADMIN CREATION (SUPER ADMIN ONLY) - UPDATED with restrictions
========================================
*/
exports.createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, middleName, username, email, password, role, dateOfBirth } = req.body;

    if (!['supportadmin', 'platformadmin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid admin role' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      firstName,
      lastName,
      middleName: middleName || '',
      username: username.toLowerCase(),
      email,
      password: hashedPassword,
      role,
      dateOfBirth,
      isVerified: true,
      restrictions: { upload: false, goLive: false, comment: false }, // Admins have no restrictions
    });

    res.status(201).json({ 
      message: 'Admin created', 
      adminId: admin._id,
      admin: formatUserResponse(admin)
    });
  } catch (err) {
    console.error('CREATE ADMIN ERROR:', err);
    res.status(500).json({ message: 'Failed to create admin' });
  }
};

/*
========================================
CHECK USERNAME AVAILABILITY
========================================
*/
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.json({ available: true });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    res.json({ available: !existingUser });
  } catch (err) {
    console.error('CHECK USERNAME ERROR:', err);
    res.status(500).json({ message: 'Failed to check username' });
  }
};

/*
========================================
UPDATE RESTRICTIONS (ADMIN ONLY)
========================================
*/
exports.updateUserRestrictions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { upload, goLive, comment } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only superadmin and platformadmin can update restrictions
    if (req.user.role !== 'superadmin' && req.user.role !== 'platformadmin') {
      return res.status(403).json({ message: 'Not authorized to update restrictions' });
    }

    // Update restrictions
    if (upload !== undefined) user.restrictions.upload = upload;
    if (goLive !== undefined) user.restrictions.goLive = goLive;
    if (comment !== undefined) user.restrictions.comment = comment;

    await user.save();

    res.json({
      success: true,
      message: 'User restrictions updated',
      restrictions: user.restrictions
    });
  } catch (err) {
    console.error('UPDATE RESTRICTIONS ERROR:', err);
    res.status(500).json({ message: 'Failed to update restrictions' });
  }
};

/*
========================================
GET USER RESTRICTIONS (ADMIN ONLY)
========================================
*/
exports.getUserRestrictions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('restrictions username firstName lastName email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        restrictions: user.restrictions || { upload: false, goLive: false, comment: false }
      }
    });
  } catch (err) {
    console.error('GET RESTRICTIONS ERROR:', err);
    res.status(500).json({ message: 'Failed to get restrictions' });
  }
};

/**
 * File: backend/controllers/authController.js (END)
 */