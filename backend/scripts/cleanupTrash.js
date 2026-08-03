/**
 * FILE: backend/scripts/cleanupTrash.js
 * Cron job script to automatically delete expired trashed videos
 * Run this script daily via cron job or node-cron
 * 
 * Setup cron job example:
 * 0 2 * * * cd /path/to/backend && node scripts/cleanupTrash.js >> logs/cleanup.log 2>&1
 * 
 * Or use node-cron in server.js:
 * const cron = require('node-cron');
 * cron.schedule('0 2 * * *', () => { require('./scripts/cleanupTrash')(); });
 */

const mongoose = require('mongoose');
const Video = require('../models/Video');
const NotificationService = require('../services/notificationService');

// MongoDB connection string - adjust as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/narra';

async function cleanupExpiredTrashedVideos() {
  console.log('========================================');
  console.log('🗑️ TRASH CLEANUP JOB STARTED');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const now = new Date();

    // Find all expired videos in trash
    const expiredVideos = await Video.find({
      isDeleted: true,
      status: 'removed',
      trashExpiresAt: { $lt: now }
    });

    console.log(`📊 Found ${expiredVideos.length} expired videos to delete`);

    let deletedCount = 0;
    let failedCount = 0;

    for (const video of expiredVideos) {
      try {
        const videoTitle = video.title;
        const creatorId = video.creator;
        const videoId = video._id;

        // Send notification before deletion
        await NotificationService.createNotification({
          userId: creatorId,
          type: 'system',
          title: 'Video Permanently Deleted',
          message: `Your video "${videoTitle}" has been permanently deleted after 30 days in trash.`,
          priority: 'normal',
          data: { videoTitle, videoId }
        }).catch(err => console.error(`Failed to send notification for ${videoId}:`, err.message));

        // Permanently delete the video
        await Video.findByIdAndDelete(videoId);
        deletedCount++;

        console.log(`✅ Deleted expired video: ${videoTitle} (${videoId})`);
      } catch (err) {
        failedCount++;
        console.error(`❌ Failed to delete video ${video._id}:`, err.message);
      }
    }

    console.log('========================================');
    console.log('🗑️ TRASH CLEANUP JOB COMPLETED');
    console.log(`✅ Deleted: ${deletedCount} videos`);
    console.log(`❌ Failed: ${failedCount} videos`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('========================================');

  } catch (err) {
    console.error('❌ TRASH CLEANUP JOB FAILED:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupExpiredTrashedVideos();
}

module.exports = cleanupExpiredTrashedVideos;

/**
 * END OF FILE: backend/scripts/cleanupTrash.js
 */