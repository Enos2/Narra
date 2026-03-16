/**
 * File: backend/routes/followRoutes.js
 * Description: Routes for follow/unfollow functionality
 */

const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getTwins,
  checkFollowStatus,
  getFollowSuggestions
} = require('../controllers/followController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected except viewing followers/following (which have privacy checks)
router.use(protect);

// Follow suggestions
router.get('/suggestions', getFollowSuggestions);

// Check follow status with a specific user
router.get('/:userId/follow-status', checkFollowStatus);

// Follow/unfollow
router.route('/:userId/follow')
  .post(followUser)
  .delete(unfollowUser);

// Get followers/following/twins
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);
router.get('/:userId/twins', getTwins);

module.exports = router;