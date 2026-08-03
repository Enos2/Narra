/**
 * File: backend/services/notificationService.js
 * Description: Centralized notification service for all user notifications
 * Handles: Upload success/failure, admin approvals/rejections, new followers,
 *          milestones, live privileges, release reminders, and more
 * UPDATED: Added all notification types including follow, twin, live privileges
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const Video = require('../models/Video');

// Helper function to get user display name
const getUserDisplayName = (user) => {
  if (!user) return 'Someone';
  if (typeof user === 'string') return user;
  if (user.name) return user.name;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.username) return user.username;
  if (user.email) return user.email.split('@')[0];
  return 'Someone';
};

class NotificationService {
  
  /**
   * Create a notification for a user
   */
  static async createNotification({
    userId,
    type,
    title,
    message,
    priority = 'normal',
    link = null,
    reference = null,
    triggeredBy = null,
    data = {}
  }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        priority,
        link,
        reference,
        triggeredBy,
        data,
        read: false,
        delivered: false
      });
      
      console.log(`[NOTIFICATION] Created for user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('[NOTIFICATION] Failed to create notification:', error);
      return null;
    }
  }

  // ========================================
  // UPLOAD NOTIFICATIONS
  // ========================================

  static async notifyUploadSuccess(userId, videoTitle, videoId) {
    return this.createNotification({
      userId,
      type: 'upload',
      title: 'Video Upload Successful',
      message: `Your video "${videoTitle}" has been uploaded successfully and is pending admin review.`,
      priority: 'normal',
      link: { url: `/upload-status/${videoId}`, text: 'View Status' },
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, status: 'pending' }
    });
  }

  static async notifyUploadFailure(userId, videoTitle, reason, errorDetails = null) {
    let message = `Your video "${videoTitle}" failed to upload.`;
    
    if (reason === 'file_too_large') {
      message = `Your video "${videoTitle}" failed to upload because the file is too large. Maximum file size is 5GB.`;
    } else if (reason === 'invalid_format') {
      message = `Your video "${videoTitle}" failed to upload because the file format is not supported. Please use MP4, MOV, or AVI.`;
    } else if (reason === 'no_thumbnail') {
      message = `Your video "${videoTitle}" failed to upload because a thumbnail is required.`;
    } else if (reason === 'missing_fields') {
      message = `Your video "${videoTitle}" failed to upload. Please ensure all required fields are filled out.`;
    } else if (reason === 'duration_too_long') {
      message = `Your video "${videoTitle}" failed to upload because it exceeds the maximum allowed duration.`;
    } else {
      message = `Your video "${videoTitle}" failed to upload. Reason: ${reason || 'Unknown error'}. Please try again.`;
    }
    
    return this.createNotification({
      userId,
      type: 'upload',
      title: 'Video Upload Failed',
      message,
      priority: 'high',
      data: { videoTitle, reason, errorDetails }
    });
  }

  // ========================================
  // ADMIN MODERATION NOTIFICATIONS
  // ========================================

  static async notifyVideoApproved(userId, videoTitle, videoId, approvedBy = null, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Approved',
      message: `Your video "${videoTitle}" has been approved by ${adminName} and is now live. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'high',
      link: { url: `/release/${videoId}`, text: 'Release Now' },
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, approvedBy }
    });
  }

  static async notifyVideoRejected(userId, videoTitle, videoId, rejectionReason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Not Approved',
      message: `Your video "${videoTitle}" was not approved by ${adminName}. Reason: ${rejectionReason || 'Content does not meet our guidelines'}.`,
      priority: 'high',
      link: { url: `/upload/${videoId}/edit`, text: 'Edit & Resubmit' },
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, rejectionReason }
    });
  }

  static async notifyVideoRestricted(userId, videoTitle, videoId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Restricted',
      message: `Your video "${videoTitle}" has been restricted by ${adminName}. Reason: ${reason || 'Violation of guidelines'}.`,
      priority: 'high',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, reason }
    });
  }

  static async notifyVideoRestrictionRemoved(userId, videoTitle, videoId, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Restriction Removed',
      message: `The restriction on your video "${videoTitle}" has been removed by ${adminName}. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'normal',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId }
    });
  }

  static async notifyVideoFlagged(userId, videoTitle, videoId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Flagged',
      message: `Your video "${videoTitle}" has been flagged for review by ${adminName}. Reason: ${reason || 'Content needs review'}.`,
      priority: 'high',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, reason }
    });
  }

  static async notifyVideoFlagRemoved(userId, videoTitle, videoId, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Flag Removed',
      message: `The flag on your video "${videoTitle}" has been removed by ${adminName}. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'normal',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId }
    });
  }

  static async notifyVideoShadowBanned(userId, videoTitle, videoId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Shadow Banned',
      message: `Your video "${videoTitle}" has been shadow banned by ${adminName}. Limited visibility. Reason: ${reason || 'Violation of guidelines'}.`,
      priority: 'urgent',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, reason }
    });
  }

  static async notifyVideoShadowBanRemoved(userId, videoTitle, videoId, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Shadow Ban Removed',
      message: `The shadow ban on your video "${videoTitle}" has been removed by ${adminName}. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'normal',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId }
    });
  }

  static async notifyVideoDeleted(userId, videoTitle, videoId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Removed',
      message: `Your video "${videoTitle}" has been removed from the platform by ${adminName}. Reason: ${reason || 'Violation of community guidelines'}.`,
      priority: 'urgent',
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId, reason }
    });
  }

  static async notifyVideoRestored(userId, videoTitle, videoId, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Video Restored',
      message: `Your video "${videoTitle}" has been restored by ${adminName} and is now visible again. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'normal',
      link: { url: `/video/${videoId}`, text: 'View Video' },
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId }
    });
  }

  // ========================================
  // FOLLOWER NOTIFICATIONS
  // ========================================

  static async notifyNewFollower(userId, followerId, followerName) {
    let displayName = 'Someone';
    
    if (followerName && typeof followerName === 'string' && followerName !== 'undefined' && followerName !== 'null') {
      displayName = followerName;
    } else if (followerId) {
      try {
        const follower = await User.findById(followerId).select('firstName lastName username name email');
        if (follower) {
          displayName = getUserDisplayName(follower);
        }
      } catch (err) {
        console.error('[NOTIFICATION] Failed to fetch follower name:', err);
      }
    }
    
    await this.checkFollowerMilestone(userId);
    
    return this.createNotification({
      userId,
      type: 'follow',
      title: 'New Follower',
      message: `${displayName} started following you!`,
      priority: 'normal',
      link: { url: `/profile/${followerId}`, text: 'View Profile' },
      reference: { model: 'User', id: followerId },
      triggeredBy: followerId,
      data: { followerName: displayName, followerId }
    });
  }

  static async notifyTwin(userId, twinId, twinName) {
    return this.createNotification({
      userId,
      type: 'follow',
      title: 'New Twin',
      message: `${twinName} started following you back! You are now twins!`,
      priority: 'high',
      link: { url: `/profile/${twinId}`, text: 'View Profile' },
      reference: { model: 'User', id: twinId },
      triggeredBy: twinId,
      data: { twinName, twinId, isTwin: true }
    });
  }

  static async checkFollowerMilestone(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;
      
      const followerCount = user.followers?.length || 0;
      const milestones = [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
      
      for (const milestone of milestones) {
        if (followerCount === milestone) {
          await this.createNotification({
            userId,
            type: 'system',
            title: 'Milestone Achieved',
            message: `Congratulations! You've reached ${milestone.toLocaleString()} followers! Keep creating amazing content.`,
            priority: 'high',
            data: { milestone, followerCount }
          });
          break;
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Milestone check failed:', error);
    }
  }

  // ========================================
  // LIVE PRIVILEGE NOTIFICATIONS
  // ========================================

  static async notifyLivePrivilegeGrantedByAdmin(userId, grantedBy, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Live Streaming Access Granted',
      message: `Admin ${adminName} has granted you live streaming privileges! You can now go live and interact with your audience in real-time.`,
      priority: 'high',
      link: { url: `/live/create`, text: 'Go Live Now' },
      data: { grantedBy }
    });
  }

  static async notifyLivePrivilegeGrantedByMilestone(userId, stats) {
    return this.createNotification({
      userId,
      type: 'system',
      title: 'Live Streaming Unlocked',
      message: `Congratulations! You've unlocked live streaming privileges by reaching ${stats.approvedVideoCount} approved videos and ${stats.totalVideoViews.toLocaleString()} views. Start streaming today!`,
      priority: 'high',
      link: { url: `/live/create`, text: 'Start Streaming' },
      data: stats
    });
  }

  static async notifyLivePrivilegeRevoked(userId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Live Streaming Access Revoked',
      message: `Admin ${adminName} has revoked your live streaming privileges. Reason: ${reason || 'Policy violation'}. Please contact support if you believe this is an error.`,
      priority: 'urgent',
      link: { url: `/support`, text: 'Contact Support' },
      data: { reason }
    });
  }

  static async notifyLiveStrike(userId, strikeCount, reason, adminName = 'an administrator') {
    let message = `You have received a live streaming violation strike (${strikeCount}/5) from ${adminName}. Reason: ${reason}.`;
    if (strikeCount >= 5) {
      message = `You have received your 5th strike from ${adminName}. Your live streaming privileges have been automatically revoked. Reason: ${reason}`;
    }
    
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Live Streaming Strike',
      message,
      priority: 'urgent',
      data: { strikeCount, reason }
    });
  }

  static async notifyLiveStrikeRemoved(userId, remainingStrikes, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Live Streaming Strike Removed',
      message: `Admin ${adminName} has removed a strike from your account. You now have ${remainingStrikes} active strike(s).`,
      priority: 'normal',
      data: { remainingStrikes }
    });
  }

  static async notifyLiveRequirementsReminder(userId, missingRequirements) {
    return this.createNotification({
      userId,
      type: 'system',
      title: 'Live Streaming Requirements Reminder',
      message: `You need ${missingRequirements.approvedVideos} more approved videos and ${missingRequirements.totalViews} more views to unlock live streaming. Keep creating!`,
      priority: 'normal',
      link: { url: `/upload`, text: 'Upload Video' },
      data: missingRequirements
    });
  }

  // ========================================
  // RELEASE REMINDER NOTIFICATIONS
  // ========================================

  static async remindReleaseVideo(userId, videoTitle, videoId) {
    return this.createNotification({
      userId,
      type: 'system',
      title: 'Ready to Release',
      message: `Your video "${videoTitle}" has been approved and is waiting to be released. Don't keep your audience waiting!`,
      priority: 'high',
      link: { url: `/release/${videoId}`, text: 'Release Now' },
      reference: { model: 'Video', id: videoId },
      data: { videoTitle, videoId }
    });
  }

  // ========================================
  // ACCOUNT MODERATION NOTIFICATIONS
  // ========================================

  static async notifyUserBanned(userId, reason, bannedBy, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Account Suspended',
      message: `Your account has been suspended by ${adminName}. Reason: ${reason || 'Violation of our terms of service'}. If you believe this is an error, please contact support.`,
      priority: 'urgent',
      link: { url: `/support`, text: 'Appeal' },
      data: { reason, bannedBy }
    });
  }

  static async notifyUserUnbanned(userId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Account Reinstated',
      message: `Your account has been reinstated by ${adminName}. ${reason ? `Reason: ${reason}` : 'Welcome back!'} Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'high',
      data: { reason }
    });
  }

  static async notifyUserVerified(userId, verifiedBy, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Account Verified',
      message: `Congratulations! Your account has been verified by ${adminName}. The verified badge will now appear on your profile. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'high',
      link: { url: `/profile/${userId}`, text: 'View Profile' },
      data: { verifiedBy }
    });
  }

  static async notifyUserDeactivated(userId, reason, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Account Deactivated',
      message: `Your account has been deactivated by ${adminName}. Reason: ${reason || 'Deactivated by admin'}. You will not be able to access your account until reactivated.`,
      priority: 'urgent',
      link: { url: `/support`, text: 'Contact Support' },
      data: { reason }
    });
  }

  static async notifyUserReactivated(userId, adminName = 'an administrator') {
    return this.createNotification({
      userId,
      type: 'admin',
      title: 'Account Reactivated',
      message: `Your account has been reactivated by ${adminName}. Welcome back! You can now access all features again. Thank you for your cooperation and continue enjoying Narra.`,
      priority: 'high',
      data: {}
    });
  }

  // ========================================
  // ACCOUNT MILESTONE NOTIFICATIONS
  // ========================================

  static async notifyAccountMilestone(userId, milestoneType, days) {
    let title = '';
    let message = '';
    
    if (milestoneType === 'days_100') {
      title = '100 Days on Narra';
      message = `Congratulations! You've been a member of Narra for 100 days. Thank you for being part of our community!`;
    } else if (milestoneType === 'days_365') {
      title = '1 Year Anniversary';
      message = `Happy 1 Year Anniversary on Narra! Thank you for your dedication and amazing content. Here's to many more years!`;
    } else if (milestoneType === 'days_730') {
      title = '2 Year Anniversary';
      message = `Happy 2 Year Anniversary on Narra! Two years of amazing content. Thank you for being a valued member!`;
    } else if (milestoneType === 'days_1000') {
      title = '1000 Days on Narra';
      message = `Wow! 1000 days on Narra! Thank you for your incredible journey with us. You're a true legend!`;
    } else if (milestoneType === 'days_2000') {
      title = '2000 Days on Narra';
      message = `Amazing! 2000 days on Narra! Thank you for being an integral part of our community.`;
    } else {
      title = 'Account Milestone';
      message = `Congratulations on reaching ${days} days on Narra! Thank you for being part of our community.`;
    }
    
    return this.createNotification({
      userId,
      type: 'system',
      title,
      message,
      priority: 'high',
      data: { milestoneType, days }
    });
  }

  // ========================================
  // SYSTEM NOTIFICATIONS
  // ========================================

  static async sendSystemNotification(userId, title, message, priority = 'normal') {
    return this.createNotification({
      userId,
      type: 'system',
      title,
      message,
      priority,
      data: {}
    });
  }

  static async broadcastSystemNotification(title, message, priority = 'normal') {
    try {
      const users = await User.find({ isDeleted: false, isBanned: false }).select('_id');
      const notifications = [];
      
      for (const user of users) {
        notifications.push({
          userId: user._id,
          type: 'system',
          title,
          message,
          priority,
          read: false,
          delivered: false
        });
      }
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        console.log(`[NOTIFICATION] Broadcasted to ${notifications.length} users`);
      }
    } catch (error) {
      console.error('[NOTIFICATION] Broadcast failed:', error);
    }
  }

  // ========================================
  // SCHEDULED JOBS
  // ========================================

  static async checkPendingReleaseReminders() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const videos = await Video.find({
        status: 'approved',
        approved: true,
        released: false,
        approvedAt: { $lte: twentyFourHoursAgo },
        isDeleted: false,
        releaseReminderSent: { $ne: true }
      }).populate('creator', '_id');
      
      for (const video of videos) {
        await this.remindReleaseVideo(video.creator._id, video.title, video._id);
        
        video.releaseReminderSent = true;
        await video.save();
        
        console.log(`[NOTIFICATION] Release reminder sent for video: ${video.title}`);
      }
    } catch (error) {
      console.error('[NOTIFICATION] Release reminder check failed:', error);
    }
  }

  static async checkLiveQualificationMilestones() {
    try {
      const users = await User.find({ 
        canGoLive: true, 
        canGoLiveReason: 'auto_qualified',
        liveQualificationNotified: { $ne: true }
      });
      
      for (const user of users) {
        const stats = {
          approvedVideoCount: user.approvedVideoCount,
          totalVideoViews: user.totalVideoViews
        };
        
        await this.notifyLivePrivilegeGrantedByMilestone(user._id, stats);
        
        user.liveQualificationNotified = true;
        await user.save();
        
        console.log(`[NOTIFICATION] Live qualification milestone notified for user: ${user.email}`);
      }
    } catch (error) {
      console.error('[NOTIFICATION] Live qualification check failed:', error);
    }
  }

  static async checkAccountMilestones() {
    try {
      const users = await User.find({ 
        isDeleted: false,
        lastMilestoneNotified: { $exists: true }
      });
      
      const milestones = [100, 365, 730, 1000, 2000, 3000, 4000, 5000];
      const today = new Date();
      
      for (const user of users) {
        const accountAge = Math.floor((today - user.createdAt) / (1000 * 60 * 60 * 24));
        
        for (const milestone of milestones) {
          if (accountAge >= milestone && (!user.lastMilestoneNotified || user.lastMilestoneNotified < milestone)) {
            let milestoneType = '';
            if (milestone === 100) milestoneType = 'days_100';
            else if (milestone === 365) milestoneType = 'days_365';
            else if (milestone === 730) milestoneType = 'days_730';
            else if (milestone === 1000) milestoneType = 'days_1000';
            else if (milestone === 2000) milestoneType = 'days_2000';
            
            await this.notifyAccountMilestone(user._id, milestoneType, milestone);
            
            user.lastMilestoneNotified = milestone;
            await user.save();
            
            console.log(`[NOTIFICATION] Account milestone ${milestone} days notified for user: ${user.email}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Account milestone check failed:', error);
    }
  }
}

module.exports = NotificationService;