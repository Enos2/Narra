/**
 * File: backend/routes/uploadRoutes.js
 * Purpose: Upload routes (mounted at /api/uploads).
 *
 * CHANGES IN THIS VERSION
 *   - Multer writes to a TEMP FILE on disk (cleaned up when the response ends)
 *     instead of holding up to 2 GB per file in memory.
 *   - `upload.any()` (any number of files under any name) is replaced by a
 *     strict allow-list of field names with count / size / field limits.
 *   - Permission + rate-limit guards run BEFORE multer, so a request that will
 *     be rejected never writes a byte to disk.
 *   - NEW  POST /sign             signed direct-to-Cloudinary upload parameters
 *   - NEW  POST /video/finalize   verify direct uploads and create the video
 *   - NEW  GET  /document/:userId/:docId   (admins) short-lived link to a private ID document
 *
 * Environment: MAX_VIDEO_UPLOAD_MB (default 2000) caps multipart video size;
 * UPLOAD_TMP_DIR overrides the temp folder.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadController = require('../controllers/uploadController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { requireCreatorUpload, cleanupTempFiles } = require('../middleware/uploadGuards');
const { uploadLimiter, signLimiter, mediaLimiter } = require('../middleware/rateLimiters');

const MB = 1024 * 1024;
const TMP_DIR = process.env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'narra-uploads');
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(16).toString('hex')), // never trust the client's name
});

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// Field names the video form may use:
//   thumbnail | video | trailer | season-S-trailer | season-S-episode-E-(video|trailer|thumbnail)
const VIDEO_FIELD_RE = /^(thumbnail|video|trailer|season-\d{1,2}-trailer|season-\d{1,2}-episode-\d{1,3}-(video|trailer|thumbnail))$/;

const videoUpload = multer({
  storage,
  limits: {
    fileSize: (Number(process.env.MAX_VIDEO_UPLOAD_MB) || 2000) * MB,
    files: 600,
    fields: 80,
    fieldSize: 2 * MB, // the seasons JSON is one text field
    parts: 700,
  },
  fileFilter: (_req, file, cb) =>
    VIDEO_FIELD_RE.test(file.fieldname) ? cb(null, true) : cb(badRequest('Unexpected file field.')),
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * MB, files: 1, fields: 10 },
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 20 * MB, files: 1, fields: 10 },
});

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
router.param('userId', (_req, res, next, v) =>
  OBJECT_ID_RE.test(v) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' })
);
router.param('docId', (_req, res, next, v) =>
  OBJECT_ID_RE.test(v) ? next() : res.status(400).json({ success: false, message: 'Invalid id.' })
);

// All upload routes need a signed-in user
router.use(protect);

// Profile images
router.post('/avatar', mediaLimiter, cleanupTempFiles, imageUpload.single('avatar'), uploadController.uploadAvatar);
router.post('/cover', mediaLimiter, cleanupTempFiles, imageUpload.single('cover'), uploadController.uploadCoverImage);

// Video upload through this server (movies and series)
router.post('/video', requireCreatorUpload, uploadLimiter, cleanupTempFiles, videoUpload.any(), uploadController.uploadVideo);

// Direct upload: browser → Cloudinary, then we verify and create the video
router.post('/sign', requireCreatorUpload, signLimiter, uploadController.getUploadSignature);
router.post('/video/finalize', requireCreatorUpload, uploadLimiter, uploadController.finalizeVideoUpload);

// Standalone thumbnail
router.post('/thumbnail', requireCreatorUpload, mediaLimiter, cleanupTempFiles, imageUpload.single('thumbnail'), uploadController.uploadThumbnail);

// Verification document (private)
router.post('/document', mediaLimiter, cleanupTempFiles, documentUpload.single('document'), uploadController.uploadVerificationDocument);
router.get(
  '/document/:userId/:docId',
  requireRole('supportadmin', 'platformadmin', 'superadmin'),
  uploadController.getVerificationDocumentLink
);

// Delete one of my files
router.delete('/file', uploadController.deleteFile);

// Quota
router.get('/status', uploadController.getUploadStatus);

module.exports = router;

// ═══ END OF FILE: backend/routes/uploadRoutes.js ═══