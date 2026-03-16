/**
 * File: backend/controllers/uploadController.js
 * Description: Handles file uploads for videos, thumbnails, trailers, and avatars
 */

const Video = require('../models/Video');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // For image optimization (optional, install if needed)

/*
========================================
HELPERS
========================================
*/

// Ensure upload directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Save file with validation
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

  // Write file
  fs.writeFileSync(filePath, file.buffer);

  // Get file size
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  return {
    filePath,
    url: `/uploads/${folder}/${fileName}`,
    fileName,
    fileSize,
    mimeType: file.mimetype
  };
};

// Optimize image (for avatars and thumbnails)
const optimizeImage = async (file, folder, options = {}) => {
  if (!file) return null;

  const { width = 500, height = 500, quality = 80 } = options;
  
  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  ensureDir(uploadDir);

  const safeName = file.originalname
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  
  const ext = path.extname(safeName) || '.jpg';
  const baseName = path.basename(safeName, ext);
  const fileName = `${Date.now()}-${baseName}.jpg`; // Convert to jpg for optimization
  const filePath = path.join(uploadDir, fileName);

  // Optimize image with sharp
  await sharp(file.buffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality })
    .toFile(filePath);

  const stats = fs.statSync(filePath);

  return {
    filePath,
    url: `/uploads/${folder}/${fileName}`,
    fileName,
    fileSize: stats.size,
    mimeType: 'image/jpeg',
    dimensions: { width, height }
  };
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
    fs.unlinkSync(filePath);
    return true;
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
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      title,
      description,
      type, // 'movie' or 'series'
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
      seasons, // For series only
      creator,
      releaseOption,
      releaseDate,
    } = req.body;

    /*
    ========================================
    VALIDATION
    ========================================
    */
    if (!title || !description || !type || !ageRating) {
      return res.status(400).json({
        message: 'Missing required fields: title, description, type, and ageRating are required',
      });
    }

    if (!req.files || !req.files.thumbnail) {
      return res.status(400).json({
        message: 'Thumbnail is required',
      });
    }

    // Validate thumbnail
    const thumbnailFile = req.files.thumbnail[0];
    if (!validateFileType(thumbnailFile, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
      return res.status(400).json({
        message: 'Thumbnail must be an image (JPEG, PNG, WEBP, or GIF)',
      });
    }
    
    if (!validateFileSize(thumbnailFile, 5)) { // Max 5MB
      return res.status(400).json({
        message: 'Thumbnail size must be less than 5MB',
      });
    }

    if (type === 'movie' && (!req.files.video || !req.files.video[0])) {
      return res.status(400).json({
        message: 'Video file is required for movies',
      });
    }

    // Validate video file for movies
    if (type === 'movie' && req.files.video) {
      const videoFile = req.files.video[0];
      if (!validateFileType(videoFile, ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])) {
        return res.status(400).json({
          message: 'Video must be in MP4, WEBM, OGG, or MOV format',
        });
      }
      
      if (!validateFileSize(videoFile, 2000)) { // Max 2GB
        return res.status(400).json({
          message: 'Video size must be less than 2GB',
        });
      }
    }

    if (type === 'series' && !seasons) {
      return res.status(400).json({
        message: 'Seasons data is required for series',
      });
    }

    /*
    ========================================
    PARSE JSON FIELDS
    ========================================
    */
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
        message: 'Invalid JSON format in genre, tags, or seasons fields',
      });
    }

    /*
    ========================================
    CREATE BASE VIDEO (ALWAYS PENDING)
    ========================================
    */
    const videoDoc = new Video({
      title,
      description,
      type,
      creator: req.user._id,
      user: req.user._id, // For backward compatibility
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

    /*
    ========================================
    FILE HANDLING - THUMBNAIL (REQUIRED)
    ========================================
    */
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
      // Fallback to saving without optimization
      const savedThumbnail = saveFile(thumbnailFile, 'thumbnails');
      videoDoc.thumbnailUrl = savedThumbnail.url;
      videoDoc.thumbnailPath = savedThumbnail.filePath;
    }

    /*
    ========================================
    FILE HANDLING - MOVIE
    ========================================
    */
    if (type === 'movie') {
      const videoFile = req.files.video[0];
      const savedVideo = saveFile(videoFile, 'videos');
      videoDoc.videoUrl = savedVideo.url;
      videoDoc.filePath = savedVideo.filePath;
      videoDoc.fileSize = savedVideo.fileSize;

      // Handle trailer if provided
      if (req.files.trailer && req.files.trailer[0]) {
        const trailerFile = req.files.trailer[0];
        if (validateFileType(trailerFile, ['video/mp4', 'video/webm', 'video/ogg'])) {
          const savedTrailer = saveFile(trailerFile, 'trailers');
          videoDoc.trailerUrl = savedTrailer.url;
          videoDoc.trailerPath = savedTrailer.filePath;
        }
      }
    }

    /*
    ========================================
    FILE HANDLING - SERIES
    ========================================
    */
    if (type === 'series' && parsedSeasons.length > 0) {
      // Process season trailers
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

        // Process episode videos
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

    /*
    ========================================
    SAVE
    ========================================
    */
    await videoDoc.save();

    // Add to user's uploaded videos
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
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

/*
========================================
UPLOAD AVATAR (USER PROFILE)
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
    
    // Delete old avatar file if it exists and is not the default
    if (user.avatar && !user.avatar.includes('default-avatar')) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar.replace('/uploads/', 'uploads/'));
      deleteFile(oldAvatarPath);
    }

    // Optimize and save new avatar
    const savedAvatar = await optimizeImage(req.file, 'avatars', { 
      width: 400, 
      height: 400, 
      quality: 90 
    });

    // Update user's avatar
    user.avatar = savedAvatar.url;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: savedAvatar.url,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Avatar upload failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
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

    // Optimize and save cover image
    const savedCover = await optimizeImage(req.file, 'covers', { 
      width: 1920, 
      height: 480, 
      quality: 85 
    });

    // Update user's cover image (need to add coverImage field to User model)
    const user = await User.findById(req.user._id);
    
    // Delete old cover if exists
    if (user.coverImage && !user.coverImage.includes('default-cover')) {
      const oldCoverPath = path.join(__dirname, '..', user.coverImage.replace('/uploads/', 'uploads/'));
      deleteFile(oldCoverPath);
    }

    user.coverImage = savedCover.url;
    await user.save();

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

    // Validate file type (allow images and PDFs)
    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'application/pdf'])) {
      return res.status(400).json({
        success: false,
        message: 'Document must be JPEG, PNG, or PDF',
      });
    }

    // Validate file size (max 20MB)
    if (!validateFileSize(req.file, 20)) {
      return res.status(400).json({
        success: false,
        message: 'Document size must be less than 20MB',
      });
    }

    // Save document
    const savedDoc = saveFile(req.file, 'verification');

    // Add to user's verification documents
    const user = await User.findById(req.user._id);
    
    if (!user.verificationDocuments) {
      user.verificationDocuments = [];
    }

    user.verificationDocuments.push({
      type: documentType,
      url: savedDoc.url,
      uploadedAt: new Date(),
      status: 'pending'
    });

    await user.save();

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

    // Validate file type
    if (!validateFileType(req.file, ['image/jpeg', 'image/png', 'image/webp'])) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail must be JPEG, PNG, or WEBP',
      });
    }

    // Validate file size
    if (!validateFileSize(req.file, 5)) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail size must be less than 5MB',
      });
    }

    // Optimize and save thumbnail
    const savedThumbnail = await optimizeImage(req.file, 'thumbnails', { 
      width: 1280, 
      height: 720, 
      quality: 85 
    });

    // If videoId provided, update the video's thumbnail
    if (videoId) {
      const video = await Video.findById(videoId);
      
      // Check if user owns the video
      if (video && (video.creator.toString() === req.user._id.toString() || 
                    video.user.toString() === req.user._id.toString())) {
        
        // Delete old thumbnail
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

    // Convert URL to file path
    const relativePath = fileUrl.replace('/uploads/', 'uploads/');
    const filePath = path.join(__dirname, '..', relativePath);

    // Check if file exists and delete
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

    // Get user's videos
    const videos = await Video.find({
      user: req.user._id,
      isDeleted: false
    });

    // Calculate total storage used (in bytes)
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

    // Define quotas based on user role
    const quotas = {
      user: {
        maxVideos: 50,
        maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
        maxVideoSize: 2 * 1024 * 1024 * 1024, // 2GB per video
        canUpload: true
      },
      creator: {
        maxVideos: 200,
        maxStorage: 50 * 1024 * 1024 * 1024, // 50GB
        maxVideoSize: 5 * 1024 * 1024 * 1024, // 5GB per video
        canUpload: true
      },
      admin: {
        maxVideos: 1000,
        maxStorage: 500 * 1024 * 1024 * 1024, // 500GB
        maxVideoSize: 10 * 1024 * 1024 * 1024, // 10GB per video
        canUpload: true
      }
    };

    const userQuota = req.user.isCreator ? quotas.creator : 
                      (req.user.role.includes('admin') ? quotas.admin : quotas.user);

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
        percentUsed: Math.round((totalStorage / userQuota.maxStorage) * 100),
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