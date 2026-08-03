const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  purchaseVideo,
  purchaseLive,
  addBalance,
} = require('../controllers/paymentController');

// Purchase video
router.post('/video/:videoId', protect, purchaseVideo);

// Purchase live
router.post('/live/:liveId', protect, purchaseLive);

// Add balance
router.post('/balance', protect, addBalance);

module.exports = router;
