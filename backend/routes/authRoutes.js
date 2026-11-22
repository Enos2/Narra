/**
 * File: backend/routes/authRoutes.js
 * Purpose: Authentication routes — register, login, admin login, logout,
 *   logout-all-devices, profile, deactivate / reactivate, password reset.
 *
 * CHANGES IN THIS VERSION
 *   - NEW  POST /logout-all            (the Account page already calls it)
 *   - NEW  POST /reactivate            (reactivate with password; public, rate limited)
 *   - FIX  PUT  /reactivate            (uses protectAllowDeactivated — a deactivated
 *                                       account was previously blocked by `protect`
 *                                       and could never reactivate)
 *   - NEW  aliases the existing frontend already uses:
 *            POST /forgot-password,  POST|PUT /reset-password/:token
 *          (ResetPassword.jsx posts to /reset-password/:token; the canonical
 *           /password/forgot and /password/reset/:token still work.)
 *
 * Mounted at /api/auth (see server.js, where the global login / register /
 * password limiters are applied to the canonical paths).
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, protectAllowDeactivated } = require('../middleware/authMiddleware');
const { loginLimiter, passwordLimiter } = require('../middleware/rateLimiters');

/*
========================================
PUBLIC ROUTES
========================================
*/

// Register a new user
router.post('/register', authController.register);

// Normal user login
router.post('/login', authController.login);

// Admin login (audit logging is handled inside authController.adminLogin)
router.post('/admin/login', authController.adminLogin);

// Reactivate a deactivated account by proving ownership with the password
router.post('/reactivate', loginLimiter, authController.reactivateWithPassword);

// Request password reset (email or username)
router.post('/password/forgot', authController.requestPasswordReset);
router.post('/forgot-password', passwordLimiter, authController.requestPasswordReset); // alias

// Reset password using the e-mailed token
router.put('/password/reset/:token', authController.resetPassword);
router.put('/reset-password/:token', passwordLimiter, authController.resetPassword); // alias
router.post('/reset-password/:token', passwordLimiter, authController.resetPassword); // alias (ResetPassword.jsx)

/*
========================================
PROTECTED USER ROUTES
========================================
*/

// Logout this device (audit logging for admins is handled in the controller)
router.post('/logout', protect, authController.logout);

// Logout every device (invalidates all existing tokens)
router.post('/logout-all', protect, authController.logoutAll);

// Get my profile
router.get('/me', protect, authController.getMyProfile);

// Deactivate account
router.put('/deactivate', protect, authController.deactivateAccount);

// Reactivate account while still signed in (deactivated accounts are allowed through)
router.put('/reactivate', protectAllowDeactivated, authController.reactivateAccount);

module.exports = router;

// ═══ END OF FILE: backend/routes/authRoutes.js ═══