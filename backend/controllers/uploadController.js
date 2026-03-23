/**
 * File: backend/controllers/uploadController.js
 * Description: Handles file uploads for videos, thumbnails, trailers, and avatars
 * FIXED: Avatar upload uses findByIdAndUpdate instead of save to bypass validation
 */

const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Check if sharp is installed - if not, use fallback
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

// Ensure upload directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
};

// Save file with validation (fallback when sharp is not available)
const saveFile = (file, folder, options = {}) => {
  if (!file) return null;

  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  ensureDir(uploadDir);

  // Sanitize filename
  const safeName = file.originalname
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  try {
    // Write file
    fs.writeFileSync(filePath, file.buffer);
    
    // Get file size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    console.log(`✅ File saved: ${fileName} (${fileSize} bytes)`);

    return {
      filePath,
      url: `/uploads/${folder}/${fileName}`,
      fileName,
      fileSize,
      mimeType: file.mimetype
    };
  } catch (err) {
    console.error('Error saving file:', err);
    return null;
  }
};

// Optimize image (for avatars and thumbnails) - with fallback
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
    // If sharp is available, optimize the image
    if (sharp) {
      await sharp(file.buffer)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality })
        .toFile(filePath);
      
      console.log(`✅ Image optimized: ${fileName}`);
    } else {
      // Fallback: just save the file as is
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
      dimensions: { width, height }
    };
  } catch (err) {
    console.error('Error optimizing image:', err);
    // Fallback to saving without optimization
    return saveFile(file, folder);
  }
};

// Validate file type
const validateFileType = (file, allowedTypes) => {
  if (!file) return false;
  return allowedTypes.includes(file.mimetype);
};

// Validate file size (in MB)
const validateFileSize = (file, maxSizeMB) => {
  if (!file) return false;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

// Delete file if it exists
const deleteFile = (filePath) => {
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
    } = req.body;

    if (!title || !description || !type || !ageRating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, type, and ageRating are required',
      });
    }

    if (!req.files || !req.files.thumbnail) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail is required',
      });
    }

    const thumbnailFile = req.files.thumbnail[0];
    if (!validateFileType(thumbnailFile, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
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

    if (type === 'movie' && (!req.files.video || !req.files.video[0])) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required for movies',
      });
    }

    if (type === 'movie' && req.files.video) {
      const videoFile = req.files.video[0];
      if (!validateFileType(videoFile, ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])) {
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

    if (type === 'series' && !seasons) {
      return res.status(400).json({
        success: false,
        message: 'Seasons data is required for series',
      });
    }

    let parsedGenre = [];
    let parsedTags = [];
    let parsedSeasons = [];

    try {
      parsedGenre = genre ? JSON.parse(genre) : [];
      parsedTags = tags ? JSON.parse(tags) : [];
      
      if (!Array.isArray(parsedGenre)) parsedGenre = [];
      if (!Array.isArray(parsedTags)) parsedTags = [];
      
      if (type === 'series' && seasons) {
        parsedSeasons = JSON.parse(seasons);
      }
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in genre, tags, or seasons fields',
      });
    }

    const videoDoc = new Video({
      title,
      description,
      type,
      creator: req.user._id,
      user: req.user._id,
      genre: parsedGenre,
      tags: parsedTags,
      ageRating,
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

    try {
      const savedThumbnail = await optimizeImage(thumbnailFile, 'thumbnails', { 
        width: 1280, 
        height: 720, 
        quality: 85 
      });
      videoDoc.thumbnailUrl = savedThumbnail.url;
      videoDoc.thumbnailPath = savedThumbnail.filePath;
    } catch (err) {
      console.error('Thumbnail optimization error:', err);
      const savedThumbnail = saveFile(thumbnailFile, 'thumbnails');
      videoDoc.thumbnailUrl = savedThumbnail.url;
      videoDoc.thumbnailPath = savedThumbnail.filePath;
    }

    if (type === 'movie') {
      const videoFile = req.files.video[0];
      const savedVideo = saveFile(videoFile, 'videos');
      videoDoc.videoUrl = savedVideo.url;
      videoDoc.filePath = savedVideo.filePath;
      videoDoc.fileSize = savedVideo.fileSize;

      if (req.files.trailer && req.files.trailer[0]) {
        const trailerFile = req.files.trailer[0];
        if (validateFileType(trailerFile, ['video/mp4', 'video/webm', 'video/ogg'])) {
          const savedTrailer = saveFile(trailerFile, 'trailers');
          videoDoc.trailerUrl = savedTrailer.url;
          videoDoc.trailerPath = savedTrailer.filePath;
        }
      }
    }

    if (type === 'series' && parsedSeasons.length > 0) {
      for (let s = 0; s < parsedSeasons.length; s++) {
        const seasonKey = `season-${s}-trailer`;
        if (req.files[seasonKey] && req.files[seasonKey][0]) {
          const trailerFile = req.files[seasonKey][0];
          if (validateFileType(trailerFile, ['video/mp4', 'video/webm', 'video/ogg'])) {
            const savedTrailer = saveFile(trailerFile, 'trailers');
            parsedSeasons[s].trailerUrl = savedTrailer.url;
            parsedSeasons[s].trailerPath = savedTrailer.filePath;
          }
        }

        if (parsedSeasons[s].episodes) {
          for (let e = 0; e < parsedSeasons[s].episodes.length; e++) {
            const videoKey = `season-${s}-episode-${e}-video`;
            const episodeTrailerKey = `season-${s}-episode-${e}-trailer`;

            if (req.files[videoKey] && req.files[videoKey][0]) {
              const videoFile = req.files[videoKey][0];
              if (validateFileType(videoFile, ['video/mp4', 'video/webm', 'video/ogg'])) {
                const savedVideo = saveFile(videoFile, 'videos');
                parsedSeasons[s].episodes[e].videoUrl = savedVideo.url;
                parsedSeasons[s].episodes[e].filePath = savedVideo.filePath;
                parsedSeasons[s].episodes[e].fileSize = savedVideo.fileSize;
              }
            }

            if (req.files[episodeTrailerKey] && req.files[episodeTrailerKey][0]) {
              const trailerFile = req.files[episodeTrailerKey][0];
              if (validateFileType(trailerFile, ['video/mp4', 'video/webm', 'video/ogg'])) {
                const savedTrailer = saveFile(trailerFile, 'trailers');
                parsedSeasons[s].episodes[e].trailerUrl = savedTrailer.url;
                parsedSeasons[s].episodes[e].trailerPath = savedTrailer.filePath;
              }
            }
          }
        }
      }
      
      videoDoc.seasons = parsedSeasons;
    }

    await videoDoc.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { uploadedVideos: videoDoc._id }
    });

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
UPLOAD AVATAR (USER PROFILE) - FIXED
========================================
*/
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    console.log('📸 Uploading avatar for user:', req.user._id);
    console.log('   File:', req.file.originalname, `(${req.file.size} bytes)`);

    // Validate file type
    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
      return res.status(400).json({
        success: false,
        message: 'Avatar must be an image (JPEG, PNG, WEBP, or GIF)',
      });
    }

    // Validate file size (max 5MB)
    if (!validateFileSize(req.file, 5)) {
      return res.status(400).json({
        success: false,
        message: 'Avatar size must be less than 5MB',
      });
    }

    // Get current user to delete old avatar if exists
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Delete old avatar file if it exists
    if (user.avatar && !user.avatar.includes('default-avatar')) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar.replace('/uploads/', 'uploads/'));
      console.log('🗑️ Deleting old avatar:', oldAvatarPath);
      deleteFile(oldAvatarPath);
    }

    // Save new avatar (try optimization first, fallback to simple save)
    let savedAvatar;
    try {
      savedAvatar = await optimizeImage(req.file, 'avatars', { 
        width: 400, 
        height: 400, 
        quality: 90 
      });
      console.log('✅ Avatar optimized and saved:', savedAvatar.url);
    } catch (optimizeErr) {
      console.warn('⚠️ Image optimization failed, using fallback:', optimizeErr.message);
      savedAvatar = saveFile(req.file, 'avatars');
    }

    if (!savedAvatar) {
      throw new Error('Failed to save avatar file');
    }

    // FIXED: Use findByIdAndUpdate instead of save() to bypass validation
    // This prevents the username validation error during avatar upload
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: savedAvatar.url } },
      { new: true, runValidators: false } // runValidators: false bypasses validation
    ).select('-password -tokenVersion');

    console.log('✅ Avatar updated for user:', updatedUser._id);

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
        avatar: updatedUser.avatar
      }
    });
  } catch (err) {
    console.error('❌ Avatar upload error:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Avatar upload failed. Please try again.'
    });
  }
};

/*
========================================
UPLOAD COVER IMAGE (USER PROFILE)
========================================
*/
exports.uploadCoverImage = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    // Validate file type
    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp'])) {
      return res.status(400).json({
        success: false,
        message: 'Cover image must be JPEG, PNG, or WEBP',
      });
    }

    // Validate file size (max 10MB)
    if (!validateFileSize(req.file, 10)) {
      return res.status(400).json({
        success: false,
        message: 'Cover image size must be less than 10MB',
      });
    }

    // Save cover image
    let savedCover;
    try {
      savedCover = await optimizeImage(req.file, 'covers', { 
        width: 1920, 
        height: 480, 
        quality: 85 
      });
    } catch (optimizeErr) {
      console.warn('Cover optimization failed, using fallback:', optimizeErr.message);
      savedCover = saveFile(req.file, 'covers');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { coverImage: savedCover.url } },
      { new: true, runValidators: false }
    );

    return res.status(200).json({
      success: true,
      message: 'Cover image uploaded successfully',
      coverUrl: savedCover.url
    });
  } catch (err) {
    console.error('Cover image upload error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Cover image upload failed' 
    });
  }
};

/*
========================================
UPLOAD VERIFICATION DOCUMENT
========================================
*/
exports.uploadVerificationDocument = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const { documentType } = req.body;

    if (!documentType || !['id', 'passport', 'license'].includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid document type (id, passport, license) is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No document file provided' 
      });
    }

    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'application/pdf'])) {
      return res.status(400).json({
        success: false,
        message: 'Document must be JPEG, PNG, or PDF',
      });
    }

    if (!validateFileSize(req.file, 20)) {
      return res.status(400).json({
        success: false,
        message: 'Document size must be less than 20MB',
      });
    }

    const savedDoc = saveFile(req.file, 'verification');

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $push: { 
          verificationDocuments: {
            type: documentType,
            url: savedDoc.url,
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
      document: {
        type: documentType,
        url: savedDoc.url,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Document upload error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Document upload failed' 
    });
  }
};

/*
========================================
UPLOAD VIDEO THUMBNAIL (STANDALONE)
========================================
*/
exports.uploadThumbnail = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const { videoId } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file provided' 
      });
    }

    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp'])) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail must be JPEG, PNG, or WEBP',
      });
    }

    if (!validateFileSize(req.file, 5)) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail size must be less than 5MB',
      });
    }

    let savedThumbnail;
    try {
      savedThumbnail = await optimizeImage(req.file, 'thumbnails', { 
        width: 1280, 
        height: 720, 
        quality: 85 
      });
    } catch (optimizeErr) {
      savedThumbnail = saveFile(req.file, 'thumbnails');
    }

    if (videoId) {
      const video = await Video.findById(videoId);
      
      if (video && (video.creator.toString() === req.user._id.toString() || 
                    video.user.toString() === req.user._id.toString())) {
        
        if (video.thumbnailPath) {
          deleteFile(video.thumbnailPath);
        }
        
        video.thumbnailUrl = savedThumbnail.url;
        video.thumbnailPath = savedThumbnail.filePath;
        await video.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnailUrl: savedThumbnail.url
    });
  } catch (err) {
    console.error('Thumbnail upload error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Thumbnail upload failed' 
    });
  }
};

/*
========================================
DELETE FILE
========================================
*/
exports.deleteFile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'File URL is required'
      });
    }

    const relativePath = fileUrl.replace('/uploads/', 'uploads/');
    const filePath = path.join(__dirname, '..', relativePath);

    const deleted = deleteFile(filePath);

    return res.status(200).json({
      success: true,
      message: deleted ? 'File deleted successfully' : 'File not found',
      deleted
    });
  } catch (err) {
    console.error('File deletion error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'File deletion failed' 
    });
  }
};

/*
========================================
GET UPLOAD STATUS / QUOTA
========================================
*/
exports.getUploadStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const videos = await Video.find({
      user: req.user._id,
      isDeleted: false
    });

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
      user: {
        maxVideos: 50,
        maxStorage: 10 * 1024 * 1024 * 1024,
        maxVideoSize: 2 * 1024 * 1024 * 1024,
        canUpload: true
      },
      creator: {
        maxVideos: 200,
        maxStorage: 50 * 1024 * 1024 * 1024,
        maxVideoSize: 5 * 1024 * 1024 * 1024,
        canUpload: true
      },
      admin: {
        maxVideos: 1000,
        maxStorage: 500 * 1024 * 1024 * 1024,
        maxVideoSize: 10 * 1024 * 1024 * 1024,
        canUpload: true
      }
    };

    const userQuota = req.user.isCreator ? quotas.creator : 
                      (req.user.role?.includes('admin') ? quotas.admin : quotas.user);

    const storageUsedGB = (totalStorage / (1024 * 1024 * 1024)).toFixed(2);
    const quotaGB = (userQuota.maxStorage / (1024 * 1024 * 1024)).toFixed(2);

    return res.status(200).json({
      success: true,
      quota: {
        ...userQuota,
        currentVideos: videos.length,
        currentStorage: totalStorage,
        currentStorageGB: storageUsedGB,
        quotaGB: quotaGB,
        percentUsed: Math.min(100, Math.round((totalStorage / userQuota.maxStorage) * 100)),
        remainingVideos: Math.max(0, userQuota.maxVideos - videos.length),
        remainingStorage: Math.max(0, userQuota.maxStorage - totalStorage)
      }
    });
  } catch (err) {
    console.error('Get upload status error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get upload status' 
    });
  }
};

// Export helper functions for use in other controllers
exports.helpers = {
  saveFile,
  optimizeImage,
  validateFileType,
  validateFileSize,
  deleteFile,
  ensureDir
};