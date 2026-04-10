/**
 * File: backend/controllers/uploadController.js
 * FIXED: req.files is a flat array when using upload.any() — must use
 *        getFile()/getFiles() helpers instead of req.files.fieldName
 * ADDED: Optional per-episode thumbnail support
 */

const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
  console.log('✅ Sharp image processing loaded');
} catch (err) {
  console.warn('⚠️ Sharp not installed, using fallback for image uploads');
  sharp = null;
}

/*
========================================
HELPERS
========================================
*/

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
};

/**
 * When multer uses upload.any(), req.files is a FLAT ARRAY:
 *   [{ fieldname: 'thumbnail', buffer, ... }, { fieldname: 'season-0-episode-0-video', ... }]
 *
 * These helpers replace the broken req.files.fieldName pattern.
 */
const getFile = (files, fieldname) => {
  if (!files || !Array.isArray(files)) return null;
  return files.find(f => f.fieldname === fieldname) || null;
};

const getFiles = (files, fieldname) => {
  if (!files || !Array.isArray(files)) return [];
  return files.filter(f => f.fieldname === fieldname);
};

const saveFile = (file, folder) => {
  if (!file) return null;

  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  ensureDir(uploadDir);

  const safeName = file.originalname
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  try {
    fs.writeFileSync(filePath, file.buffer);
    const stats = fs.statSync(filePath);
    console.log(`✅ File saved: ${fileName} (${stats.size} bytes)`);
    return {
      filePath,
      url: `/uploads/${folder}/${fileName}`,
      fileName,
      fileSize: stats.size,
      mimeType: file.mimetype,
    };
  } catch (err) {
    console.error('Error saving file:', err);
    return null;
  }
};

const optimizeImage = async (file, folder, options = {}) => {
  if (!file) return null;

  const { width = 400, height = 400, quality = 80 } = options;
  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  ensureDir(uploadDir);

  const safeName = file.originalname
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  const ext = path.extname(safeName) || '.jpg';
  const baseName = path.basename(safeName, ext);
  const fileName = `${Date.now()}-${baseName}.jpg`;
  const filePath = path.join(uploadDir, fileName);

  try {
    if (sharp) {
      await sharp(file.buffer)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality })
        .toFile(filePath);
      console.log(`✅ Image optimized: ${fileName}`);
    } else {
      fs.writeFileSync(filePath, file.buffer);
      console.log(`✅ Image saved (no optimization): ${fileName}`);
    }

    const stats = fs.statSync(filePath);
    return {
      filePath,
      url: `/uploads/${folder}/${fileName}`,
      fileName,
      fileSize: stats.size,
      mimeType: 'image/jpeg',
      dimensions: { width, height },
    };
  } catch (err) {
    console.error('Error optimizing image:', err);
    return saveFile(file, folder);
  }
};

const validateFileType = (file, allowedTypes) => {
  if (!file) return false;
  return allowedTypes.includes(file.mimetype);
};

const validateFileSize = (file, maxSizeMB) => {
  if (!file) return false;
  return file.size <= maxSizeMB * 1024 * 1024;
};

const deleteFileFromDisk = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ File deleted: ${filePath}`);
      return true;
    } catch (err) {
      console.error('Error deleting file:', err);
      return false;
    }
  }
  return false;
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

/*
========================================
UPLOAD VIDEO (CREATOR)
FIXED: use getFile() / getFiles() instead of req.files.fieldName
ADDED: optional per-episode thumbnail
========================================
*/
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const files = req.files; // flat array from upload.any()

    // Debug: log what files arrived
    console.log('📦 Received files:', files ? files.map(f => `${f.fieldname} (${f.size} bytes)`) : 'none');
    console.log('📦 Received body fields:', Object.keys(req.body));

    const {
      title,
      description,
      type,
      genre,
      tags,
      ageRating,
      isSponsored,
      sponsorDescription,
      isFundraiser,
      fundraiserDescription,
      isPaid,
      price,
      currency,
      seasons,
      releaseOption,
      releaseDate,
      language,
      subtitles,
      commentsDisabled,
      isPrivate,
      contentFlags,
    } = req.body;

    // ── Required field validation ──────────────────────────────────────────
    if (!title || !description || !type || !ageRating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, type, and ageRating are required',
      });
    }

    // ── Thumbnail validation (FIXED: use getFile() not req.files.thumbnail) ──
    const thumbnailFile = getFile(files, 'thumbnail');
    if (!thumbnailFile) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail is required',
      });
    }

    if (!validateFileType(thumbnailFile, IMAGE_TYPES)) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail must be an image (JPEG, PNG, WEBP, or GIF)',
      });
    }

    if (!validateFileSize(thumbnailFile, 5)) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail size must be less than 5MB',
      });
    }

    // ── Movie-specific video validation ────────────────────────────────────
    if (type === 'movie') {
      const videoFile = getFile(files, 'video');
      if (!videoFile) {
        return res.status(400).json({
          success: false,
          message: 'Video file is required for movies',
        });
      }
      if (!validateFileType(videoFile, VIDEO_TYPES)) {
        return res.status(400).json({
          success: false,
          message: 'Video must be in MP4, WEBM, OGG, or MOV format',
        });
      }
      if (!validateFileSize(videoFile, 2000)) {
        return res.status(400).json({
          success: false,
          message: 'Video size must be less than 2GB',
        });
      }
    }

    // ── Series requires seasons payload ───────────────────────────────────
    if (type === 'series' && !seasons) {
      return res.status(400).json({
        success: false,
        message: 'Seasons data is required for series',
      });
    }

    // ── Parse JSON fields ──────────────────────────────────────────────────
    let parsedGenre = [];
    let parsedTags = [];
    let parsedSeasons = [];
    let parsedContentFlags = {};
    let parsedSubtitles = [];

    try {
      parsedGenre = genre ? JSON.parse(genre) : [];
      parsedTags = tags ? JSON.parse(tags) : [];
      parsedSubtitles = subtitles ? JSON.parse(subtitles) : [];
      parsedContentFlags = contentFlags ? JSON.parse(contentFlags) : {};

      if (!Array.isArray(parsedGenre)) parsedGenre = [];
      if (!Array.isArray(parsedTags)) parsedTags = [];
      if (!Array.isArray(parsedSubtitles)) parsedSubtitles = [];

      if (type === 'series' && seasons) {
        parsedSeasons = JSON.parse(seasons);
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in genre, tags, subtitles, or seasons fields',
      });
    }

    // ── Build video document ───────────────────────────────────────────────
    const videoDoc = new Video({
      title,
      description,
      type,
      creator: req.user._id,
      user: req.user._id,
      genre: parsedGenre,
      tags: parsedTags,
      ageRating,
      language: language || 'English',
      subtitles: parsedSubtitles,
      commentsDisabled: commentsDisabled === 'true',
      isPrivate: isPrivate === 'true',
      contentFlags: parsedContentFlags,
      isSponsored: isSponsored === 'true',
      sponsorDescription: sponsorDescription || '',
      isFundraiser: isFundraiser === 'true',
      fundraiserDescription: fundraiserDescription || '',
      isPaid: isPaid === 'true',
      price: isPaid === 'true' ? Number(price) || 0 : 0,
      currency: currency || 'USD',
      releaseOption: releaseOption || 'immediate',
      releaseDate: releaseDate || null,
      seasons: parsedSeasons,
      approved: false,
      rejected: false,
      isDeleted: false,
      status: 'pending',
      uploadedAt: new Date(),
    });

    // ── Save thumbnail ─────────────────────────────────────────────────────
    try {
      const savedThumbnail = await optimizeImage(thumbnailFile, 'thumbnails', {
        width: 1280,
        height: 720,
        quality: 85,
      });
      videoDoc.thumbnailUrl = savedThumbnail.url;
      videoDoc.thumbnailPath = savedThumbnail.filePath;
    } catch (err) {
      console.error('Thumbnail optimization error:', err);
      const savedThumbnail = saveFile(thumbnailFile, 'thumbnails');
      if (!savedThumbnail) {
        return res.status(500).json({ success: false, message: 'Failed to save thumbnail' });
      }
      videoDoc.thumbnailUrl = savedThumbnail.url;
      videoDoc.thumbnailPath = savedThumbnail.filePath;
    }

    // ── Movie: save main video + optional trailer ──────────────────────────
    if (type === 'movie') {
      const videoFile = getFile(files, 'video');
      const savedVideo = saveFile(videoFile, 'videos');
      if (!savedVideo) {
        return res.status(500).json({ success: false, message: 'Failed to save video file' });
      }
      videoDoc.videoUrl = savedVideo.url;
      videoDoc.filePath = savedVideo.filePath;
      videoDoc.fileSize = savedVideo.fileSize;

      const trailerFile = getFile(files, 'trailer');
      if (trailerFile && validateFileType(trailerFile, VIDEO_TYPES)) {
        const savedTrailer = saveFile(trailerFile, 'trailers');
        if (savedTrailer) {
          videoDoc.trailerUrl = savedTrailer.url;
          videoDoc.trailerPath = savedTrailer.filePath;
        }
      }
    }

    // ── Series: save season trailers + episode videos/trailers/thumbnails ──
    if (type === 'series' && parsedSeasons.length > 0) {
      for (let s = 0; s < parsedSeasons.length; s++) {

        // Season trailer (optional)
        const seasonTrailerFile = getFile(files, `season-${s}-trailer`);
        if (seasonTrailerFile && validateFileType(seasonTrailerFile, VIDEO_TYPES)) {
          const saved = saveFile(seasonTrailerFile, 'trailers');
          if (saved) {
            parsedSeasons[s].trailerUrl = saved.url;
            parsedSeasons[s].trailerPath = saved.filePath;
          }
        }

        if (parsedSeasons[s].episodes) {
          for (let e = 0; e < parsedSeasons[s].episodes.length; e++) {

            // Episode video (required per episode)
            const episodeVideoFile = getFile(files, `season-${s}-episode-${e}-video`);
            if (episodeVideoFile && validateFileType(episodeVideoFile, VIDEO_TYPES)) {
              const saved = saveFile(episodeVideoFile, 'videos');
              if (saved) {
                parsedSeasons[s].episodes[e].videoUrl = saved.url;
                parsedSeasons[s].episodes[e].filePath = saved.filePath;
                parsedSeasons[s].episodes[e].fileSize = saved.fileSize;
              }
            }

            // Episode trailer (optional)
            const episodeTrailerFile = getFile(files, `season-${s}-episode-${e}-trailer`);
            if (episodeTrailerFile && validateFileType(episodeTrailerFile, VIDEO_TYPES)) {
              const saved = saveFile(episodeTrailerFile, 'trailers');
              if (saved) {
                parsedSeasons[s].episodes[e].trailerUrl = saved.url;
                parsedSeasons[s].episodes[e].trailerPath = saved.filePath;
              }
            }

            // Episode thumbnail (optional) — NEW
            const episodeThumbnailFile = getFile(files, `season-${s}-episode-${e}-thumbnail`);
            if (episodeThumbnailFile && validateFileType(episodeThumbnailFile, IMAGE_TYPES)) {
              try {
                const saved = await optimizeImage(episodeThumbnailFile, 'thumbnails', {
                  width: 1280,
                  height: 720,
                  quality: 85,
                });
                if (saved) {
                  parsedSeasons[s].episodes[e].thumbnailUrl = saved.url;
                  parsedSeasons[s].episodes[e].thumbnailPath = saved.filePath;
                  console.log(`✅ Episode ${s}-${e} thumbnail saved`);
                }
              } catch (thumbErr) {
                console.warn(`⚠️ Episode ${s}-${e} thumbnail optimization failed, using fallback`);
                const saved = saveFile(episodeThumbnailFile, 'thumbnails');
                if (saved) {
                  parsedSeasons[s].episodes[e].thumbnailUrl = saved.url;
                  parsedSeasons[s].episodes[e].thumbnailPath = saved.filePath;
                }
              }
            }
          }
        }
      }

      videoDoc.seasons = parsedSeasons;
    }

    // ── Persist ────────────────────────────────────────────────────────────
    await videoDoc.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { uploadedVideos: videoDoc._id },
    });

    console.log(`✅ ${type} uploaded: "${title}" (ID: ${videoDoc._id})`);

    return res.status(201).json({
      success: true,
      message: `${type === 'movie' ? 'Movie' : 'Series'} submitted for admin review`,
      videoId: videoDoc._id,
      type: videoDoc.type,
      title: videoDoc.title,
      moderationStatus: 'pending',
      thumbnailUrl: videoDoc.thumbnailUrl,
    });
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Upload failed',
    });
  }
};

/*
========================================
UPLOAD AVATAR
========================================
*/
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    if (!validateFileType(req.file, IMAGE_TYPES)) {
      return res.status(400).json({
        success: false,
        message: 'Avatar must be an image (JPEG, PNG, WEBP, or GIF)',
      });
    }

    if (!validateFileSize(req.file, 5)) {
      return res.status(400).json({
        success: false,
        message: 'Avatar size must be less than 5MB',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.avatar && !user.avatar.includes('default-avatar')) {
      const oldPath = path.join(__dirname, '..', user.avatar.replace('/uploads/', 'uploads/'));
      deleteFileFromDisk(oldPath);
    }

    let savedAvatar;
    try {
      savedAvatar = await optimizeImage(req.file, 'avatars', { width: 400, height: 400, quality: 90 });
    } catch {
      savedAvatar = saveFile(req.file, 'avatars');
    }

    if (!savedAvatar) throw new Error('Failed to save avatar file');

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: savedAvatar.url } },
      { new: true, runValidators: false }
    ).select('-password -tokenVersion');

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: savedAvatar.url,
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
      },
    });
  } catch (err) {
    console.error('❌ Avatar upload error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Avatar upload failed' });
  }
};

/*
========================================
UPLOAD COVER IMAGE
========================================
*/
exports.uploadCoverImage = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp'])) {
      return res.status(400).json({ success: false, message: 'Cover image must be JPEG, PNG, or WEBP' });
    }

    if (!validateFileSize(req.file, 10)) {
      return res.status(400).json({ success: false, message: 'Cover image size must be less than 10MB' });
    }

    let savedCover;
    try {
      savedCover = await optimizeImage(req.file, 'covers', { width: 1920, height: 480, quality: 85 });
    } catch {
      savedCover = saveFile(req.file, 'covers');
    }

    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { coverImage: savedCover.url } },
      { new: true, runValidators: false }
    );

    return res.status(200).json({ success: true, message: 'Cover image uploaded successfully', coverUrl: savedCover.url });
  } catch (err) {
    console.error('Cover image upload error:', err);
    return res.status(500).json({ success: false, message: 'Cover image upload failed' });
  }
};

/*
========================================
UPLOAD VERIFICATION DOCUMENT
========================================
*/
exports.uploadVerificationDocument = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { documentType } = req.body;
    if (!documentType || !['id', 'passport', 'license'].includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Valid document type (id, passport, license) is required' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'No document file provided' });

    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'application/pdf'])) {
      return res.status(400).json({ success: false, message: 'Document must be JPEG, PNG, or PDF' });
    }

    if (!validateFileSize(req.file, 20)) {
      return res.status(400).json({ success: false, message: 'Document size must be less than 20MB' });
    }

    const savedDoc = saveFile(req.file, 'verification');

    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { verificationDocuments: { type: documentType, url: savedDoc.url, uploadedAt: new Date(), status: 'pending' } } },
      { new: true, runValidators: false }
    );

    return res.status(200).json({ success: true, message: 'Verification document uploaded successfully', document: { type: documentType, url: savedDoc.url, status: 'pending' } });
  } catch (err) {
    console.error('Document upload error:', err);
    return res.status(500).json({ success: false, message: 'Document upload failed' });
  }
};

/*
========================================
UPLOAD STANDALONE THUMBNAIL
========================================
*/
exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp'])) {
      return res.status(400).json({ success: false, message: 'Thumbnail must be JPEG, PNG, or WEBP' });
    }

    if (!validateFileSize(req.file, 5)) {
      return res.status(400).json({ success: false, message: 'Thumbnail size must be less than 5MB' });
    }

    let savedThumbnail;
    try {
      savedThumbnail = await optimizeImage(req.file, 'thumbnails', { width: 1280, height: 720, quality: 85 });
    } catch {
      savedThumbnail = saveFile(req.file, 'thumbnails');
    }

    const { videoId } = req.body;
    if (videoId) {
      const video = await Video.findById(videoId);
      if (video && (video.creator.toString() === req.user._id.toString() || video.user.toString() === req.user._id.toString())) {
        if (video.thumbnailPath) deleteFileFromDisk(video.thumbnailPath);
        video.thumbnailUrl = savedThumbnail.url;
        video.thumbnailPath = savedThumbnail.filePath;
        await video.save();
      }
    }

    return res.status(200).json({ success: true, message: 'Thumbnail uploaded successfully', thumbnailUrl: savedThumbnail.url });
  } catch (err) {
    console.error('Thumbnail upload error:', err);
    return res.status(500).json({ success: false, message: 'Thumbnail upload failed' });
  }
};

/*
========================================
DELETE FILE
========================================
*/
exports.deleteFile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ success: false, message: 'File URL is required' });

    const relativePath = fileUrl.replace('/uploads/', 'uploads/');
    const filePath = path.join(__dirname, '..', relativePath);
    const deleted = deleteFileFromDisk(filePath);

    return res.status(200).json({ success: true, message: deleted ? 'File deleted successfully' : 'File not found', deleted });
  } catch (err) {
    console.error('File deletion error:', err);
    return res.status(500).json({ success: false, message: 'File deletion failed' });
  }
};

/*
========================================
GET UPLOAD STATUS / QUOTA
========================================
*/
exports.getUploadStatus = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const videos = await Video.find({ user: req.user._id, isDeleted: false });

    let totalStorage = 0;
    videos.forEach(video => {
      if (video.fileSize) totalStorage += video.fileSize;
      if (video.seasons) {
        video.seasons.forEach(season => {
          if (season.episodes) {
            season.episodes.forEach(episode => {
              if (episode.fileSize) totalStorage += episode.fileSize;
            });
          }
        });
      }
    });

    const quotas = {
      user:    { maxVideos: 50,   maxStorage: 10  * 1024 ** 3, maxVideoSize: 2  * 1024 ** 3, canUpload: true },
      creator: { maxVideos: 200,  maxStorage: 50  * 1024 ** 3, maxVideoSize: 5  * 1024 ** 3, canUpload: true },
      admin:   { maxVideos: 1000, maxStorage: 500 * 1024 ** 3, maxVideoSize: 10 * 1024 ** 3, canUpload: true },
    };

    const userQuota = req.user.isCreator ? quotas.creator :
      (req.user.role?.includes('admin') ? quotas.admin : quotas.user);

    return res.status(200).json({
      success: true,
      quota: {
        ...userQuota,
        currentVideos: videos.length,
        currentStorage: totalStorage,
        currentStorageGB: (totalStorage / 1024 ** 3).toFixed(2),
        quotaGB: (userQuota.maxStorage / 1024 ** 3).toFixed(2),
        percentUsed: Math.min(100, Math.round((totalStorage / userQuota.maxStorage) * 100)),
        remainingVideos: Math.max(0, userQuota.maxVideos - videos.length),
        remainingStorage: Math.max(0, userQuota.maxStorage - totalStorage),
      },
    });
  } catch (err) {
    console.error('Get upload status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get upload status' });
  }
};

exports.helpers = { saveFile, optimizeImage, validateFileType, validateFileSize, deleteFile: deleteFileFromDisk, ensureDir };