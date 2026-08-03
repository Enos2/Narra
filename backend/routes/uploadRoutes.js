/**
 * File: backend/routes/uploadRoutes.js
 * Description: Routes for file uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 2000 * 1024 * 1024, // 2GB max for videos
  }
});

// All upload routes are protected
router.use(protect);

// Avatar upload (single file)
router.post(
  '/avatar',
  upload.single('avatar'),
  uploadController.uploadAvatar
);

// Cover image upload
router.post(
  '/cover',
  upload.single('cover'),
  uploadController.uploadCoverImage
);

// Video upload - accepts ANY field names dynamically (supports movies and series with unlimited seasons/episodes)
router.post(
  '/video',
  upload.any(), // This accepts any field names like 'video', 'thumbnail', 'trailer', 'season-0-episode-1-video', etc.
  uploadController.uploadVideo
);

// Standalone thumbnail upload
router.post(
  '/thumbnail',
  upload.single('thumbnail'),
  uploadController.uploadThumbnail
);

// Verification document upload
router.post(
  '/document',
  upload.single('document'),
  uploadController.uploadVerificationDocument
);

// Delete file
router.delete('/file', uploadController.deleteFile);

// Get upload status/quota
router.get('/status', uploadController.getUploadStatus);

module.exports = router;