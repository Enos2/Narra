/**
 * File: backend/routes/userRoutes.js
 * Description: Routes for user operations including profile management and follow functionality
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, requireRole } = require('../middleware/authMiddleware');

/*
|---------------------------------------------------------------------------
| PUBLIC ROUTES (NO AUTHENTICATION REQUIRED)
|---------------------------------------------------------------------------
*/

// Get public user profile by ID (with privacy checks)
router.get('/:id/public', userController.getUserById);

// Search users (public with privacy filters)
router.get('/search/public', userController.searchUsers);

/*
|---------------------------------------------------------------------------
| PROTECTED ROUTES (AUTHENTICATED USERS)
|---------------------------------------------------------------------------
*/

// Apply protection to all routes below
router.use(protect);

// ================================
// OWN PROFILE MANAGEMENT
// ================================

// Get current logged-in profile
router.get('/me', userController.getProfile);

// Update own profile
router.put('/me', userController.updateProfile);

// Delete own account (soft delete)
router.delete('/me', userController.deleteUser);

// ================================
// FOLLOW/UNFOLLOW ROUTES
// ================================

// Follow a user
router.post('/:userId/follow', userController.followUser);

// Unfollow a user
router.delete('/:userId/follow', userController.unfollowUser);

// Check follow status with a user
router.get('/:userId/follow-status', userController.checkFollowStatus);

// Get follow suggestions (who to follow)
router.get('/suggestions', userController.getFollowSuggestions);

// ================================
// GET FOLLOWERS/FOLLOWING/TWINS
// ================================

// Get user's followers (with pagination)
router.get('/:userId/followers', userController.getFollowers);

// Get users that a user is following (with pagination)
router.get('/:userId/following', userController.getFollowing);

// Get user's twins (mutual followers) (with pagination)
router.get('/:userId/twins', userController.getTwins);

// ================================
// SEARCH (AUTHENTICATED)
// ================================

// Search users (authenticated - shows more details)
router.get('/search', userController.searchUsers);

/*
|---------------------------------------------------------------------------
| ADMIN ROUTES (RESTRICTED ACCESS)
|---------------------------------------------------------------------------
*/

// Get all users (admin only)
router.get('/', requireRole('superadmin', 'platformadmin', 'supportadmin'), userController.getAllUsers);

// ================================
// ADMIN USER MANAGEMENT
// ================================

// Ban a user
router.post('/:id/ban', requireRole('superadmin', 'platformadmin', 'supportadmin'), userController.banUser);

// Unban a user
router.post('/:id/unban', requireRole('superadmin', 'platformadmin', 'supportadmin'), userController.unbanUser);

// Verify a user
router.post('/:id/verify', requireRole('superadmin', 'platformadmin'), userController.verifyUser);

// Unverify a user
router.post('/:id/unverify', requireRole('superadmin', 'platformadmin'), userController.unverifyUser);

// Deactivate a user
router.put('/:id/deactivate', requireRole('superadmin', 'platformadmin'), userController.deactivateUser);

// Activate a user
router.put('/:id/activate', requireRole('superadmin', 'platformadmin'), userController.activateUser);

// Apply shadow ban to a user
router.post('/:id/shadow-ban', requireRole('superadmin', 'platformadmin'), userController.applyShadowBanUser);

// Remove shadow ban from a user
router.post('/:id/remove-shadow-ban', requireRole('superadmin', 'platformadmin'), userController.removeShadowBanUser);

// Get user by ID (admin version - full details)
router.get('/:id', requireRole('superadmin', 'platformadmin', 'supportadmin'), userController.getUserById);

module.exports = router;