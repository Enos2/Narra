/**
 * routes/messageRoutes.js
 */

const express = require('express');
const router  = express.Router();

const { protect, platformAdminOrHigher, superAdminOnly } = require('../middleware/authMiddleware');
const { resolveActor, userLaneOnly, adminLaneOnly }       = require('../middleware/messagingMiddleware');
const ctrl = require('../controllers/messageController');

// All message routes require authentication + actor resolution
router.use(protect, resolveActor);

/* ── User-facing ── */
router.get('/search-users',  userLaneOnly, ctrl.searchUsers);
router.get('/search-admins', adminLaneOnly, ctrl.searchAdmins);

router.post('/conversations',        ctrl.startConversation);
router.get('/conversations',         ctrl.listConversations);
router.get('/conversations/:id',     ctrl.getConversation);
router.post('/conversations/:id',    ctrl.sendMessage);
router.put('/conversations/:id/read', ctrl.markAsRead);

router.put('/:messageId',    ctrl.editMessage);   // NEW: edit a message
router.delete('/:messageId', ctrl.deleteMessage); // body: { scope: 'me' | 'everyone' }

/* ── Admin moderation — platform admin + super admin ── */
router.get(
  '/admin/user-conversations',
  platformAdminOrHigher,
  ctrl.adminListUserConversations
);
router.get(
  '/admin/user-conversations/:id',
  platformAdminOrHigher,
  ctrl.adminGetUserConversation
);

/* ── Super admin only — view admin conversations ── */
router.get(
  '/admin/admin-conversations',
  superAdminOnly,
  ctrl.superAdminListAdminConversations
);
router.get(
  '/admin/admin-conversations/:id',
  superAdminOnly,
  ctrl.superAdminGetAdminConversation
);

module.exports = router;