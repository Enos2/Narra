/**
 * File: backend/controllers/authController.js
 * Purpose: Registration, login (user + admin), logout, logout-all-devices,
 *   profile, account deactivation / reactivation, password reset, plus the
 *   admin-only restriction helpers.
 *
 * SECURITY CHANGES IN THIS VERSION
 *   - Login no longer reveals account state before the password is verified
 *     ("banned", "deactivated", "use the admin page" used to be returned to
 *     anyone who merely knew a username). A missing account now costs the same
 *     bcrypt work as a real one, so response time cannot be used to find out
 *     which usernames / e-mails exist.
 *   - Brute-force throttle per account+IP and per account (on top of the IP
 *     rate limiter in server.js).
 *   - Every input is type-checked (objects / arrays used to crash handlers or
 *     reach database queries).
 *   - Password policy on register, reset and admin creation.
 *   - Password reset now WORKS: the token is e-mailed (it was generated but
 *     never delivered), expires in 15 minutes, is single use, and a successful
 *     reset signs the account out of every device and sends a notice e-mail.
 *   - Fixed: logout, deactivate and reactivate crashed with a 500 because they
 *     called .save() on a plain object. They now use atomic updates.
 *   - NEW: POST /auth/logout-all (the Account page already calls it),
 *     POST /auth/reactivate (deactivated users could never come back).
 *   - Login records IP / user-agent in the account's loginHistory.
 *   - E-mail addresses are no longer written to the logs.
 */

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');
const {
  isString,
  isValidEmail,
  isValidUsername,
  normalizeIdentifier,
  validatePassword,
  verifyPassword,
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginFailures,
  allowPasswordResetRequest,
  MAX_PASSWORD_LENGTH,
} = require('../utils/authSecurity');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../utils/mailer');

let AdminAuditLog;
try {
  AdminAuditLog = require('../models/AdminAuditLog');
} catch (e) {
  console.warn('AdminAuditLog model not available for auth logging');
}

const ADMIN_ROLES = ['supportadmin', 'platformadmin', 'superadmin'];
const RESET_TOKEN_MINUTES = 15;
const DEACTIVATION_GRACE_DAYS = 30;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

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

const logAdminAuthAction = async ({
  admin,
  actionType,
  actionLabel,
  description,
  ipAddress = null,
  userAgent = null,
  metadata = {},
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
      metadata,
    });
    await logEntry.save();
    console.log(`[AUDIT] ${actionLabel} by admin ${admin._id}`);
  } catch (err) {
    console.error('Failed to log admin auth action:', err.message);
  }
};

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
    status: user.isBanned ? 'banned' : user.isDeactivated ? 'deactivated' : 'active',
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
    tokenVersion: user.tokenVersion || 0,
  };
};

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

/** Reads the login identifier (the frontend sends it in `email`) and the password. */
const readCredentials = (body = {}) => {
  const identifier = normalizeIdentifier(body.identifier ?? body.email);
  const { password } = body;
  if (!identifier || !isString(password) || !password || password.length > MAX_PASSWORD_LENGTH) {
    return { error: 'Email/username and password required' };
  }
  return { identifier, password };
};

const findByIdentifier = (identifier) =>
  User.findOne({ $or: [{ email: identifier }, { username: identifier }] });

const throttleResponse = (res, throttle) => {
  res.set('Retry-After', String(throttle.retryAfterSec));
  return res.status(429).json({
    message: `Too many failed attempts. Try again in ${Math.ceil(throttle.retryAfterSec / 60)} minute(s).`,
  });
};

/** Atomic "this person just logged in" update + loginHistory entry. */
const recordSuccessfulLogin = async (userId, req) => {
  const now = new Date();
  try {
    await User.updateOne(
      { _id: userId },
      {
        $set: { lastLogin: now, lastActive: now, online: true },
        $push: {
          loginHistory: {
            $each: [
              {
                ip: req.ip || '',
                userAgent: (req.get('User-Agent') || '').slice(0, 300),
                location: '',
                timestamp: now,
              },
            ],
            $slice: -50,
          },
        },
      }
    );
  } catch (err) {
    console.error('Failed to record login:', err.message);
  }
};

const deactivationExpired = (user) =>
  !!user.deactivatedAt &&
  Math.floor((Date.now() - new Date(user.deactivatedAt)) / 86400000) > DEACTIVATION_GRACE_DAYS;

/** Validates + normalises the fields shared by register and createAdmin. */
const validateNewAccount = (body = {}, { requireAdultAge = 13 } = {}) => {
  const { firstName, lastName, middleName, username, email, password, dateOfBirth, gender } = body;

  if (![firstName, lastName, username, email, password].every(isString) || !dateOfBirth) {
    return { error: 'All required fields must be filled' };
  }
  if (middleName !== undefined && middleName !== null && !isString(middleName)) {
    return { error: 'Invalid middle name' };
  }

  const first = firstName.trim();
  const last = lastName.trim();
  const middle = isString(middleName) ? middleName.trim() : '';

  if (first.length < 2) return { error: 'First name must be at least 2 characters' };
  if (last.length < 2) return { error: 'Last name must be at least 2 characters' };
  if (first.length > 50 || last.length > 50 || middle.length > 50) {
    return { error: 'Names must be 50 characters or fewer' };
  }

  if (!isValidUsername(username)) {
    return {
      error: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) return { error: 'Please enter a valid email address' };

  const policy = validatePassword(password, {
    email: cleanEmail,
    username,
    firstName: first,
    lastName: last,
  });
  if (!policy.valid) return { error: policy.message };

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return { error: 'Invalid date of birth' };
  const age = calculateAge(dob);
  if (age < 0 || age > 120) return { error: 'Invalid date of birth' };
  if (age < requireAdultAge) {
    return { error: `You must be at least ${requireAdultAge} years old to register`, status: 403 };
  }

  const cleanGender = isString(gender) && ['male', 'female'].includes(gender.toLowerCase()) ? gender.toLowerCase() : '';

  return {
    value: {
      firstName: first,
      lastName: last,
      middleName: middle,
      username: username.toLowerCase(),
      email: cleanEmail,
      password,
      dateOfBirth: dob,
      gender: cleanGender,
    },
  };
};

/*
========================================
REGISTER
========================================
*/
exports.register = async (req, res) => {
  try {
    const parsed = validateNewAccount(req.body);
    if (parsed.error) return res.status(parsed.status || 400).json({ message: parsed.error });
    const input = parsed.value;

    if (await User.findOne({ username: input.username })) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    if (await User.findOne({ email: input.email })) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await User.create({
      ...input,
      password: hashedPassword,
      restrictions: { upload: false, goLive: false, comment: false },
      lastLogin: new Date(),
      lastActive: new Date(),
    });

    const token = authMiddleware.generateToken(user);

    res.status(201).json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ message: 'Registration failed' });
  }
};

/*
========================================
LOGIN — accepts username OR email
========================================
*/
exports.login = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (creds.error) return res.status(400).json({ message: creds.error });
    const { identifier, password } = creds;

    const throttle = checkLoginThrottle(identifier, req.ip);
    if (throttle.locked) return throttleResponse(res, throttle);

    const user = await findByIdentifier(identifier);

    // Always performs a bcrypt comparison (dummy hash when the account is missing).
    const passwordOk = await verifyPassword(user, password);
    if (!passwordOk) {
      recordLoginFailure(identifier, req.ip);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // From here on the caller proved they own the account, so state can be shown.
    clearLoginFailures(identifier, req.ip);

    if (isAdminRole(user.role)) {
      return res.status(403).json({ message: 'Admins must use the admin login page' });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: 'Account banned' });
    }
    if (user.isDeactivated) {
      return res.status(403).json({
        message: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
        canReactivate: !deactivationExpired(user),
      });
    }

    await recordSuccessfulLogin(user._id, req);

    const token = authMiddleware.generateToken(user);

    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
ADMIN LOGIN — accepts username OR email
========================================
*/
exports.adminLogin = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (creds.error) return res.status(400).json({ message: creds.error });
    const { identifier, password } = creds;

    const throttle = checkLoginThrottle(identifier, req.ip);
    if (throttle.locked) return throttleResponse(res, throttle);

    const user = await findByIdentifier(identifier);

    const passwordOk = await verifyPassword(user, password);
    if (!passwordOk) {
      recordLoginFailure(identifier, req.ip);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    clearLoginFailures(identifier, req.ip);

    if (!isAdminRole(user.role)) {
      return res.status(403).json({ message: 'Invalid admin credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: 'Admin account banned' });
    }
    if (user.isDeactivated) {
      return res.status(403).json({ message: 'Admin account deactivated' });
    }
    if (user.adminDeactivated) {
      return res.status(403).json({ message: 'Admin access blocked. Contact a Super Admin.' });
    }

    await recordSuccessfulLogin(user._id, req);

    const token = authMiddleware.generateToken(user);

    await logAdminAuthAction({
      admin: user,
      actionType: 'ADMIN_LOGIN',
      actionLabel: 'Admin Login',
      description: `Admin ${user.email} logged in successfully`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        loginTime: new Date().toISOString(),
        role: user.role,
      },
    });

    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err.message);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
LOGOUT (this device)
========================================
*/
exports.logout = async (req, res) => {
  try {
    const user = req.user;

    await User.updateOne({ _id: user._id }, { $set: { online: false, lastActive: new Date() } });

    if (isAdminRole(user.role) && AdminAuditLog) {
      await logAdminAuthAction({
        admin: user,
        actionType: 'ADMIN_LOGOUT',
        actionLabel: 'Admin Logout',
        description: `Admin ${user.email} logged out`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          logoutTime: new Date().toISOString(),
          role: user.role,
        },
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('LOGOUT ERROR:', err.message);
    res.status(500).json({ message: 'Logout failed' });
  }
};

/*
========================================
LOGOUT ALL DEVICES (new — the Account page already calls this)
Bumping tokenVersion invalidates every token issued before now.
========================================
*/
exports.logoutAll = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 }, $set: { online: false, lastActive: new Date() } }
    );
    res.json({ success: true, message: 'Logged out of all devices' });
  } catch (err) {
    console.error('LOGOUT ALL ERROR:', err.message);
    res.status(500).json({ message: 'Failed to log out of all devices' });
  }
};

/*
========================================
PROFILE
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
    const now = new Date();
    await User.updateOne(
      { _id: req.user._id },
      { $set: { isDeactivated: true, deactivatedAt: now, deactivationRequestedAt: now, online: false } }
    );
    res.json({ message: 'Account deactivated' });
  } catch (err) {
    console.error('DEACTIVATE ERROR:', err.message);
    res.status(500).json({ message: 'Failed to deactivate account' });
  }
};

// Reactivate while still signed in (route uses protectAllowDeactivated).
exports.reactivateAccount = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { isDeactivated: false, deactivatedAt: null, deactivationRequestedAt: null } }
    );
    res.json({ message: 'Account reactivated' });
  } catch (err) {
    console.error('REACTIVATE ERROR:', err.message);
    res.status(500).json({ message: 'Failed to reactivate account' });
  }
};

// NEW: reactivate by proving ownership with the password (public route).
exports.reactivateWithPassword = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (creds.error) return res.status(400).json({ message: creds.error });
    const { identifier, password } = creds;

    const throttle = checkLoginThrottle(identifier, req.ip);
    if (throttle.locked) return throttleResponse(res, throttle);

    const user = await findByIdentifier(identifier);
    const passwordOk = await verifyPassword(user, password);
    if (!passwordOk) {
      recordLoginFailure(identifier, req.ip);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    clearLoginFailures(identifier, req.ip);

    if (user.isBanned) return res.status(403).json({ message: 'Account banned' });
    if (!user.isDeactivated) return res.status(400).json({ message: 'This account is not deactivated' });
    if (deactivationExpired(user)) {
      return res.status(403).json({
        message: 'Account permanently deleted',
        code: 'ACCOUNT_PERMANENTLY_DELETED',
      });
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { isDeactivated: false, deactivatedAt: null, deactivationRequestedAt: null } }
    );
    await recordSuccessfulLogin(user._id, req);

    user.isDeactivated = false;
    const token = authMiddleware.generateToken(user);

    res.json({ message: 'Account reactivated', token, user: formatUserResponse(user) });
  } catch (err) {
    console.error('REACTIVATE (PASSWORD) ERROR:', err.message);
    res.status(500).json({ message: 'Failed to reactivate account' });
  }
};

/*
========================================
PASSWORD RESET
========================================
*/
const GENERIC_RESET_MESSAGE = 'If an account exists for that email or username, a reset link has been sent.';

exports.requestPasswordReset = async (req, res) => {
  try {
    // The forgot-password page sends an email OR a username.
    const identifier = normalizeIdentifier(req.body?.identifier ?? req.body?.email);
    if (!identifier) {
      return res.status(400).json({ message: 'Email or username required' });
    }

    // Same answer whether or not the account exists, and whether or not we are throttled.
    if (!allowPasswordResetRequest(identifier)) {
      return res.json({ message: GENERIC_RESET_MESSAGE });
    }

    const user = await findByIdentifier(identifier);

    if (user && !user.isBanned) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetToken: hashedToken,
            passwordResetExpires: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000),
          },
        }
      );

      const base = (process.env.PASSWORD_RESET_URL_BASE || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`).replace(/\/+$/, '');
      const resetUrl = `${base}/${resetToken}`;

      // Not awaited: e-mail latency must not reveal whether the account exists.
      sendPasswordResetEmail({
        to: user.email,
        name: user.firstName,
        resetUrl,
        expiresMinutes: RESET_TOKEN_MINUTES,
      }).catch((err) => console.error('[Mail] Failed to send reset e-mail:', err.message));
    }

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error('PASSWORD RESET REQUEST ERROR:', err.message);
    res.status(500).json({ message: 'Failed to request password reset' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    if (!isString(token) || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ message: 'Token invalid or expired' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token invalid or expired' });
    }

    const policy = validatePassword(req.body?.password, {
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    if (!policy.valid) return res.status(400).json({ message: policy.message });

    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    // Single use + sign out of every device.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          lastPasswordChange: new Date(),
          online: false,
          lastActive: new Date(),
        },
        $unset: { passwordResetToken: '', passwordResetExpires: '' },
        $inc: { tokenVersion: 1 },
      }
    );

    sendPasswordChangedEmail({ to: user.email, name: user.firstName }).catch((err) =>
      console.error('[Mail] Failed to send password-changed notice:', err.message)
    );

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('PASSWORD RESET ERROR:', err.message);
    res.status(500).json({ message: 'Password reset failed' });
  }
};

/*
========================================
ADMIN CREATION (SUPER ADMIN ONLY — not routed here; kept for adminRoutes)
========================================
*/
exports.createAdmin = async (req, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only a super admin can create admins' });
    }

    const { role } = req.body || {};
    if (!isString(role) || !ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid admin role' });
    }

    const parsed = validateNewAccount(req.body, { requireAdultAge: 18 });
    if (parsed.error) return res.status(parsed.status || 400).json({ message: parsed.error });
    const input = parsed.value;

    if (await User.findOne({ email: input.email })) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    if (await User.findOne({ username: input.username })) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const admin = await User.create({
      ...input,
      password: hashedPassword,
      role,
      isVerified: true,
      restrictions: { upload: false, goLive: false, comment: false },
    });

    res.status(201).json({
      message: 'Admin created',
      adminId: admin._id,
      admin: formatUserResponse(admin),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }
    console.error('CREATE ADMIN ERROR:', err.message);
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
    if (!isString(username)) {
      return res.status(400).json({ message: 'Invalid username' });
    }
    if (username.length < 3) {
      return res.json({ available: true });
    }
    if (!isValidUsername(username)) {
      return res.json({ available: false });
    }
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    res.json({ available: !existingUser });
  } catch (err) {
    console.error('CHECK USERNAME ERROR:', err.message);
    res.status(500).json({ message: 'Failed to check username' });
  }
};

/*
========================================
UPDATE RESTRICTIONS (ADMIN ONLY)
========================================
*/
const toBool = (v) => v === true || v === 'true';

exports.updateUserRestrictions = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isString(userId) || !OBJECT_ID_RE.test(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (req.user.role !== 'superadmin' && req.user.role !== 'platformadmin') {
      return res.status(403).json({ message: 'Not authorized to update restrictions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admins may only restrict ordinary users, unless a super admin is acting.
    if (isAdminRole(user.role) && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Not authorized to restrict an admin account' });
    }

    const { upload, goLive, comment } = req.body || {};
    if (!user.restrictions) user.restrictions = { upload: false, goLive: false, comment: false };
    if (upload !== undefined) user.restrictions.upload = toBool(upload);
    if (goLive !== undefined) user.restrictions.goLive = toBool(goLive);
    if (comment !== undefined) user.restrictions.comment = toBool(comment);

    await user.save();

    res.json({
      success: true,
      message: 'User restrictions updated',
      restrictions: user.restrictions,
    });
  } catch (err) {
    console.error('UPDATE RESTRICTIONS ERROR:', err.message);
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
    if (!isAdminRole(req.user?.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { userId } = req.params;
    if (!isString(userId) || !OBJECT_ID_RE.test(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

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
        restrictions: user.restrictions || { upload: false, goLive: false, comment: false },
      },
    });
  } catch (err) {
    console.error('GET RESTRICTIONS ERROR:', err.message);
    res.status(500).json({ message: 'Failed to get restrictions' });
  }
};

// ═══ END OF FILE: backend/controllers/authController.js ═══