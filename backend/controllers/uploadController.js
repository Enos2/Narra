/**
 * File: backend/controllers/uploadController.js
 * UPDATED: Now uses Cloudinary for all file uploads (videos, images, thumbnails)
 * This prevents files from being deleted on Render redeploy
 * SECURITY FIX: Removed hardcoded Cloudinary credentials that were exposed in the
 * public GitHub repo. Config now comes strictly from environment variables, and the
 * app fails fast on startup if they're missing instead of silently falling back to
 * a leaked key.
 */

const cloudinary = require('cloudinary').v2;
const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// ── Cloudinary configuration — env vars ONLY, no hardcoded fallbacks ──────────
const REQUIRED_CLOUDINARY_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missingVars = REQUIRED_CLOUDINARY_VARS.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  // Fail fast and loud instead of silently using a fallback/leaked credential.
  throw new Error(
    `Missing required Cloudinary environment variables: ${missingVars.join(', ')}. ` +
    `Set these in your .env file (local) or in your Render environment settings (production). ` +
    `Never commit real credentials into source code.`
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('✅ Cloudinary configured from environment variables');

/*
========================================
HELPERS - CLOUDINARY UPLOAD
========================================
*/

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'narra',
        ...options
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

/**
 * Upload a video to Cloudinary
 * @param {Buffer} buffer - Video file buffer
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadVideoToCloudinary = async (buffer, options = {}) => {
  try {
    const result = await uploadToCloudinary(buffer, {
      resource_type: 'video',
      folder: 'narra/videos',
      ...options
    });
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration || 0,
      format: result.format,
      fileSize: result.bytes
    };
  } catch (error) {
    console.error('Video upload error:', error);
    throw new Error('Failed to upload video to Cloudinary: ' + error.message);
  }
};

/**
 * Upload an image to Cloudinary
 * @param {Buffer} buffer - Image file buffer
 * @param {Object} options - Additional options (width, height, quality)
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImageToCloudinary = async (buffer, options = {}) => {
  try {
    const { width, height, quality = 85, folder = 'narra/images' } = options;
    
    let transformation = {};
    if (width && height) {
      transformation = { width, height, crop: 'fill', quality };
    } else {
      transformation = { quality };
    }
    
    const result = await uploadToCloudinary(buffer, {
      resource_type: 'image',
      folder,
      transformation: [transformation]
    });
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      fileSize: result.bytes,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image to Cloudinary: ' + error.message);
  }
};

/*
========================================
HELPERS - FILE VALIDATION
========================================
*/

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

const validateFileType = (file, allowedTypes) => {
  if (!file) return false;
  return allowedTypes.includes(file.mimetype);
};

const validateFileSize = (file, maxSizeMB) => {
  if (!file) return false;
  return file.size <= maxSizeMB * 1024 * 1024;
};

const getFile = (files, fieldname) => {
  if (!files || !Array.isArray(files)) return null;
  return files.find(f => f.fieldname === fieldname) || null;
};

const getFiles = (files, fieldname) => {
  if (!files || !Array.isArray(files)) return [];
  return files.filter(f => f.fieldname === fieldname);
};

/*
========================================
UPLOAD VIDEO (CREATOR)
========================================
*/
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const files = req.files; // flat array from upload.any()

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

    // ── Thumbnail validation ──────────────────────────────────────────────
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

    // ── Upload thumbnail to Cloudinary ─────────────────────────────────────
    try {
      const result = await uploadImageToCloudinary(thumbnailFile.buffer, {
        width: 1280,
        height: 720,
        quality: 85,
        folder: 'narra/thumbnails'
      });
      videoDoc.thumbnailUrl = result.url;
      videoDoc.thumbnailPath = result.publicId;
      console.log(`✅ Thumbnail uploaded to Cloudinary: ${result.publicId}`);
    } catch (err) {
      console.error('Thumbnail upload error:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to upload thumbnail: ' + err.message 
      });
    }

    // ── Movie: upload main video + optional trailer ──────────────────────
    if (type === 'movie') {
      const videoFile = getFile(files, 'video');
      try {
        const result = await uploadVideoToCloudinary(videoFile.buffer, {
          folder: 'narra/videos'
        });
        videoDoc.videoUrl = result.url;
        videoDoc.filePath = result.publicId;
        videoDoc.fileSize = result.fileSize;
        console.log(`✅ Video uploaded to Cloudinary: ${result.publicId}`);
      } catch (err) {
        console.error('Video upload error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to upload video: ' + err.message 
        });
      }

      // Upload trailer if present
      const trailerFile = getFile(files, 'trailer');
      if (trailerFile && validateFileType(trailerFile, VIDEO_TYPES)) {
        try {
          const result = await uploadVideoToCloudinary(trailerFile.buffer, {
            folder: 'narra/trailers'
          });
          videoDoc.trailerUrl = result.url;
          videoDoc.trailerPath = result.publicId;
          console.log(`✅ Trailer uploaded to Cloudinary: ${result.publicId}`);
        } catch (err) {
          console.warn('Trailer upload failed:', err.message);
        }
      }
    }

    // ── Series: upload season trailers + episode videos/trailers/thumbnails ──
    if (type === 'series' && parsedSeasons.length > 0) {
      for (let s = 0; s < parsedSeasons.length; s++) {
        // Season trailer (optional)
        const seasonTrailerFile = getFile(files, `season-${s}-trailer`);
        if (seasonTrailerFile && validateFileType(seasonTrailerFile, VIDEO_TYPES)) {
          try {
            const result = await uploadVideoToCloudinary(seasonTrailerFile.buffer, {
              folder: 'narra/trailers'
            });
            parsedSeasons[s].trailerUrl = result.url;
            parsedSeasons[s].trailerPath = result.publicId;
          } catch (err) {
            console.warn(`Season ${s} trailer upload failed:`, err.message);
          }
        }

        if (parsedSeasons[s].episodes) {
          for (let e = 0; e < parsedSeasons[s].episodes.length; e++) {
            // Episode video
            const episodeVideoFile = getFile(files, `season-${s}-episode-${e}-video`);
            if (episodeVideoFile && validateFileType(episodeVideoFile, VIDEO_TYPES)) {
              try {
                const result = await uploadVideoToCloudinary(episodeVideoFile.buffer, {
                  folder: 'narra/videos'
                });
                parsedSeasons[s].episodes[e].videoUrl = result.url;
                parsedSeasons[s].episodes[e].filePath = result.publicId;
                parsedSeasons[s].episodes[e].fileSize = result.fileSize;
                console.log(`✅ Episode ${s}-${e} uploaded to Cloudinary: ${result.publicId}`);
              } catch (err) {
                console.error(`Episode ${s}-${e} upload error:`, err.message);
              }
            }

            // Episode trailer (optional)
            const episodeTrailerFile = getFile(files, `season-${s}-episode-${e}-trailer`);
            if (episodeTrailerFile && validateFileType(episodeTrailerFile, VIDEO_TYPES)) {
              try {
                const result = await uploadVideoToCloudinary(episodeTrailerFile.buffer, {
                  folder: 'narra/trailers'
                });
                parsedSeasons[s].episodes[e].trailerUrl = result.url;
                parsedSeasons[s].episodes[e].trailerPath = result.publicId;
              } catch (err) {
                console.warn(`Episode ${s}-${e} trailer upload failed:`, err.message);
              }
            }

            // Episode thumbnail (optional)
            const episodeThumbnailFile = getFile(files, `season-${s}-episode-${e}-thumbnail`);
            if (episodeThumbnailFile && validateFileType(episodeThumbnailFile, IMAGE_TYPES)) {
              try {
                const result = await uploadImageToCloudinary(episodeThumbnailFile.buffer, {
                  width: 1280,
                  height: 720,
                  quality: 85,
                  folder: 'narra/thumbnails'
                });
                parsedSeasons[s].episodes[e].thumbnailUrl = result.url;
                parsedSeasons[s].episodes[e].thumbnailPath = result.publicId;
                console.log(`✅ Episode ${s}-${e} thumbnail uploaded to Cloudinary`);
              } catch (err) {
                console.warn(`Episode ${s}-${e} thumbnail upload failed:`, err.message);
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

    // Upload to Cloudinary
    try {
      const result = await uploadImageToCloudinary(req.file.buffer, {
        width: 400,
        height: 400,
        quality: 90,
        folder: 'narra/avatars'
      });

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatar: result.url } },
        { new: true, runValidators: false }
      ).select('-password -tokenVersion');

      return res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: result.url,
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
      console.error('Cloudinary avatar upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload avatar: ' + err.message
      });
    }
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

    try {
      const result = await uploadImageToCloudinary(req.file.buffer, {
        width: 1920,
        height: 480,
        quality: 85,
        folder: 'narra/covers'
      });

      await User.findByIdAndUpdate(
        req.user._id,
        { $set: { coverImage: result.url } },
        { new: true, runValidators: false }
      );

      return res.status(200).json({
        success: true,
        message: 'Cover image uploaded successfully',
        coverUrl: result.url
      });
    } catch (err) {
      console.error('Cloudinary cover upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload cover image: ' + err.message
      });
    }
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

    try {
      const result = await uploadImageToCloudinary(req.file.buffer, {
        folder: 'narra/verification'
      });

      await User.findByIdAndUpdate(
        req.user._id,
        { 
          $push: { 
            verificationDocuments: { 
              type: documentType, 
              url: result.url, 
              uploadedAt: new Date(), 
              status: 'pending' 
            } 
          } 
        },
        { new: true, runValidators: false }
      );

      return res.status(200).json({
        success: true,
        message: 'Verification document uploaded successfully',
        document: { type: documentType, url: result.url, status: 'pending' }
      });
    } catch (err) {
      console.error('Cloudinary document upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload document: ' + err.message
      });
    }
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

    try {
      const result = await uploadImageToCloudinary(req.file.buffer, {
        width: 1280,
        height: 720,
        quality: 85,
        folder: 'narra/thumbnails'
      });

      const { videoId } = req.body;
      if (videoId) {
        const video = await Video.findById(videoId);
        if (video && (video.creator.toString() === req.user._id.toString() || video.user.toString() === req.user._id.toString())) {
          video.thumbnailUrl = result.url;
          video.thumbnailPath = result.publicId;
          await video.save();
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Thumbnail uploaded successfully',
        thumbnailUrl: result.url
      });
    } catch (err) {
      console.error('Cloudinary thumbnail upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload thumbnail: ' + err.message
      });
    }
  } catch (err) {
    console.error('Thumbnail upload error:', err);
    return res.status(500).json({ success: false, message: 'Thumbnail upload failed' });
  }
};

/*
========================================
DELETE FILE (From Cloudinary)
========================================
*/
exports.deleteFile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ success: false, message: 'File URL is required' });

    // Extract public ID from Cloudinary URL
    let publicId = null;
    if (fileUrl.includes('cloudinary.com')) {
      const urlParts = fileUrl.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1) {
        publicId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
      }
    }

    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'auto'
      });
      console.log(`✅ Deleted from Cloudinary: ${publicId} (${result.result})`);
    } else {
      console.warn('⚠️ Not a Cloudinary URL, skipping deletion');
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      deleted: true
    });
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

exports.helpers = { uploadToCloudinary, uploadVideoToCloudinary, uploadImageToCloudinary, validateFileType, validateFileSize };