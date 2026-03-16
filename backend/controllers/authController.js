const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');

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

/*
========================================
REGISTER
========================================
*/
exports.register = async (req, res) => {
  try {
    const { name, email, password, dateOfBirth } = req.body;
    if (!name || !email || !password || !dateOfBirth) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({ message: 'Invalid date of birth' });
    }

    const age = calculateAge(dob);
    if (age < 18) {
      return res.status(403).json({ message: 'You must be at least 18 years old to register' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      dateOfBirth: dob,
      lastLogin: new Date(),
      lastActive: new Date(),
    });

    const token = authMiddleware.generateToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

/*
========================================
LOGIN (NORMAL USERS ONLY)
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
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
ADMIN LOGIN (FIXED)
========================================
*/
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ ALLOW ALL ADMIN ROLES (MATCH FRONTEND)
    if (!['supportadmin', 'platformadmin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Invalid admin credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Admin account banned' });
    }

    if (user.isDeactivated) {
      return res.status(403).json({ message: 'Admin account deactivated' });
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
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

/*
========================================
LOGOUT
========================================
*/
exports.logout = async (req, res) => {
  try {
    req.user.online = false;
    await req.user.save({ validateBeforeSave: false });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('LOGOUT ERROR:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
};

/*
========================================
PROFILE
========================================
*/
exports.getMyProfile = async (req, res) => {
  res.json(req.user);
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

    // Hash new password before saving
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
ADMIN CREATION (SUPER ADMIN ONLY)
========================================
*/
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role, dateOfBirth } = req.body;

    if (!['supportadmin', 'platformadmin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid admin role' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      dateOfBirth,
      isVerified: true,
    });

    res.status(201).json({ message: 'Admin created', adminId: admin._id });
  } catch (err) {
    console.error('CREATE ADMIN ERROR:', err);
    res.status(500).json({ message: 'Failed to create admin' });
  }
};