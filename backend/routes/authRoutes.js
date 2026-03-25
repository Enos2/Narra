/**
 * File: backend/routes/authRoutes.js
 * UPDATED: Routes for authentication (login/logout now have audit logging in controller)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

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

// Logout (audit logging is handled inside authController.logout for admin users)
router.post('/logout', protect, authController.logout);

// Request password reset
router.post('/password/forgot', authController.requestPasswordReset);

// Reset password using token
router.put('/password/reset/:token', authController.resetPassword);

/*
========================================
PROTECTED USER ROUTES
========================================
*/

// Get my profile
router.get('/me', protect, authController.getMyProfile);

// Deactivate account
router.put('/deactivate', protect, authController.deactivateAccount);

// Reactivate account
router.put('/reactivate', protect, authController.reactivateAccount);

/*
========================================
ADMIN ROUTES - REMOVE THIS
(Now handled in adminRoutes.js for consistency)
========================================*/

// REMOVE THIS LINE - Admin creation moved to adminRoutes
// router.post('/admin/create', protect, superAdminOnly, authController.createAdmin);

module.exports = router;

/**
 * File: backend/routes/authRoutes.js (END)
 */