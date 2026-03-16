/**
 * File: backend/models/User.js
 * Description: Comprehensive User schema for Narra with token versioning for force logout
 * UPDATED: Added live streaming qualification tracking, social features, and preferences
 * FIXED: Pre-save middleware next() function error with validateBeforeSave: false
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/*
========================================
ADMIN ACTION LOG (IMMUTABLE AUDIT TRAIL)
========================================
*/
const AdminActionSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      enum: [
        'CREATE_ADMIN',
        'PROMOTE_ADMIN',
        'DEMOTE_ADMIN',
        'DEACTIVATE_ADMIN',
        'REACTIVATE_ADMIN',
        'DELETE_ADMIN',
        'DELETE_USER',
        'SOFT_DELETE_USER',
        'HARD_DELETE_USER',
        'PERMANENT_DELETE_ACCOUNT',
        'BAN_USER',
        'UNBAN_USER',
        'VERIFY_USER',
        'UNVERIFY_USER',
        'SHADOW_BAN',
        'UNSHADOW_BAN',
        'SHADOW_BAN_CONTENT',
        'UNSHADOW_BAN_CONTENT',
        'REMOVE_VIDEO',
        'RESTORE_VIDEO',
        'REMOVE_COMMENT',
        'REMOVE_LIVE',
        'FEATURE_VIDEO',
        'UNFEATURE_VIDEO',
        'APPROVE_VIDEO',
        'REJECT_VIDEO',
        'APPROVE_FUNDRAISER',
        'REJECT_FUNDRAISER',
        'ASSIGN_SUPPORT',
        'REVOKE_SUPPORT',
        'DEACTIVATE_USER',
        'FORCE_LOGOUT',
        'GRANT_LIVE_PRIVILEGE',
        'REVOKE_LIVE_PRIVILEGE'
      ],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'targetModel',
    },
    targetModel: {
      type: String,
      enum: ['User', 'Video', 'Live', 'Comment'],
    },
    description: { type: String, required: true },
    performedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true
    },
    details: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { _id: false }
);

/*
========================================
LIVE STREAM STRIKES
========================================
*/
const LiveStrikeSchema = new mongoose.Schema(
  {
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

/*
========================================
NOTIFICATION PREFERENCES
========================================
*/
const NotificationPreferencesSchema = new mongoose.Schema(
  {
    emailComments: { type: Boolean, default: true },
    emailNewFollowers: { type: Boolean, default: true },
    emailMessages: { type: Boolean, default: true },
    emailLiveStreams: { type: Boolean, default: true },
    emailVideoUploads: { type: Boolean, default: true },
    emailMentions: { type: Boolean, default: true },
    pushEnabled: { type: Boolean, default: true },
    pushComments: { type: Boolean, default: true },
    pushNewFollowers: { type: Boolean, default: true },
    pushMessages: { type: Boolean, default: true },
    pushLiveStreams: { type: Boolean, default: true }
  },
  { _id: false }
);

/*
========================================
PRIVACY SETTINGS
========================================
*/
const PrivacySettingsSchema = new mongoose.Schema(
  {
    showEmail: { type: Boolean, default: false },
    showFollowers: { type: Boolean, default: true },
    showFollowing: { type: Boolean, default: true },
    showLikedVideos: { type: Boolean, default: true },
    showPurchasedContent: { type: Boolean, default: false },
    allowMessages: { type: Boolean, default: true },
    allowComments: { type: Boolean, default: true },
    allowMentions: { type: Boolean, default: true },
    profileVisibility: { 
      type: String, 
      enum: ['public', 'followers_only', 'private'],
      default: 'public'
    }
  },
  { _id: false }
);

/*
========================================
USER SCHEMA
========================================
*/
const UserSchema = new mongoose.Schema(
  {
    // ----------------------
    // BASIC INFO
    // ----------------------
    name: { type: String, required: true, trim: true },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      index: true
    },
    password: { type: String, required: true },
    
    // ----------------------
    // PROFILE ENHANCEMENTS
    // ----------------------
    avatar: { type: String, default: null }, // URL to avatar image
    bio: { type: String, maxlength: 500, default: '' },
    dateOfBirth: { type: Date, required: true },
    phoneNumber: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },

    // ----------------------
    // SOCIAL FEATURES
    // ----------------------
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    twins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Mutual followers
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    twinCount: { type: Number, default: 0 },

    // ----------------------
    // SETTINGS & PREFERENCES
    // ----------------------
    notificationPreferences: { type: NotificationPreferencesSchema, default: () => ({}) },
    privacySettings: { type: PrivacySettingsSchema, default: () => ({}) },
    preferredLanguage: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },

    // ----------------------
    // ROLES & PERMISSIONS
    // ----------------------
    role: {
      type: String,
      enum: ['user', 'supportadmin', 'platformadmin', 'superadmin'],
      default: 'user',
      index: true
    },
    isFounder: { type: Boolean, default: false, immutable: true },
    isCreator: { type: Boolean, default: false },
    isSupport: { type: Boolean, default: false }, // ADDED - for toggleSupportAdmin

    // ----------------------
    // ADMIN CREATION TRACKING
    // ----------------------
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminCreatedAt: Date,

    // ----------------------
    // LIVE STREAMING PRIVILEGES
    // ----------------------
    canGoLive: { type: Boolean, default: false, index: true },
    canGoLiveReason: { 
      type: String, 
      enum: ['manual_admin_approval', 'auto_qualified', 'pending', 'revoked', null],
      default: null 
    },
    canGoLiveGrantedAt: Date,
    canGoLiveGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // For automatic qualification tracking
    approvedVideoCount: { type: Number, default: 0 },
    totalVideoViews: { type: Number, default: 0 },
    liveQualificationCheckedAt: Date,
    liveStrikes: { type: [LiveStrikeSchema], default: [] },

    // ----------------------
    // SECURITY & TOKENS
    // ----------------------
    tokenVersion: { 
      type: Number, 
      default: 0,
      index: true 
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    lastPasswordChange: Date,
    loginHistory: [{
      ip: String,
      userAgent: String,
      timestamp: { type: Date, default: Date.now },
      location: String
    }],

    // ----------------------
    // FINANCIAL
    // ----------------------
    balance: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },
    payoutMethod: {
      type: { type: String, enum: ['paypal', 'stripe', 'bank', null], default: null },
      email: String,
      accountLastFour: String,
      isVerified: { type: Boolean, default: false }
    },

    // ----------------------
    // CONTENT RELATIONS
    // ----------------------
    purchasedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    purchasedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],
    uploadedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    uploadedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],

    // ----------------------
    // MODERATION & RESTRICTIONS
    // ----------------------
    isBanned: { type: Boolean, default: false },
    bannedAt: Date,
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    banReason: String,
    
    isShadowBanned: { type: Boolean, default: false },
    shadowBannedCountries: [{ type: String }],
    shadowBannedContinents: [{ type: String }],
    shadowBanAppliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shadowBanAppliedAt: Date,

    // ----------------------
    // VERIFICATION
    // ----------------------
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationDocuments: [{
      type: { type: String, enum: ['id', 'passport', 'license'] },
      url: String,
      uploadedAt: Date,
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
    }],

    // ----------------------
    // ACTIVITY TRACKING
    // ----------------------
    lastLogin: { type: Date, index: true },
    lastActive: { type: Date, index: true },
    online: { type: Boolean, default: false },
    accountAge: { type: Number, default: 0 }, // Calculated in days

    // ----------------------
    // GEO / ANALYTICS
    // ----------------------
    country: { type: String, index: true },
    continent: String,
    timezone: String,

    // ----------------------
    // NOTIFICATIONS
    // ----------------------
    notifications: [
      {
        type: { type: String, enum: ['system', 'follow', 'comment', 'like', 'purchase', 'live'] },
        message: String,
        isRead: { type: Boolean, default: false },
        relatedId: { type: mongoose.Schema.Types.ObjectId },
        relatedModel: { type: String, enum: ['User', 'Video', 'Live', 'Comment'] },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ----------------------
    // INTERACTIONS
    // ----------------------
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    likedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],
    watchHistory: [{
      video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
      watchedAt: Date,
      progress: Number // seconds watched
    }],
    ratings: [
      {
        video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
        rating: { type: Number, min: 0, max: 10 },
        createdAt: { type: Date, default: Date.now }
      },
    ],

    // ----------------------
    // ADMIN LOGS
    // ----------------------
    adminActions: { type: [AdminActionSchema], default: [] },

    // ----------------------
    // ADMIN INACTIVITY
    // ----------------------
    adminDeactivated: { type: Boolean, default: false },
    adminDeactivatedAt: Date,
    adminDeactivationReason: String,

    // ----------------------
    // USER DEACTIVATION
    // ----------------------
    isDeactivated: { type: Boolean, default: false },
    deactivatedAt: Date,
    deactivationRequestedAt: Date,
    deactivationReason: String,

    // ----------------------
    // SOFT DELETE FIELDS
    // ----------------------
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deleteReason: String,

    // ----------------------
    // FEATURED CONTENT
    // ----------------------
    featuredVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],

    // ----------------------
    // AUDIT CONTROL
    // ----------------------
    auditLogs: [
      {
        type: { type: String },
        description: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/*
========================================
COMPOUND INDEXES ONLY
========================================
*/
UserSchema.index({ role: 1, lastActive: -1 });
UserSchema.index({ isDeleted: 1, role: 1 });
UserSchema.index({ adminDeactivated: 1, role: 1 });
UserSchema.index({ canGoLive: 1, canGoLiveReason: 1 });
UserSchema.index({ followers: 1 }); // For social queries
UserSchema.index({ following: 1 }); // For social queries
UserSchema.index({ twins: 1 }); // For social queries
UserSchema.index({ followerCount: -1 }); // For trending users
UserSchema.index({ location: 1 }); // For geo-based queries

/*
========================================
VIRTUAL PROPERTIES
========================================
*/
UserSchema.virtual('profileComplete').get(function() {
  return !!(this.avatar && this.bio && this.location);
});

UserSchema.virtual('displayName').get(function() {
  return this.name || this.email.split('@')[0];
});

/*
========================================
HELPER FUNCTION TO UPDATE DERIVED FIELDS
========================================
*/
function updateDerivedFields(user) {
  // Update follower/following counts
  if (user.followers) user.followerCount = user.followers.length;
  if (user.following) user.followingCount = user.following.length;
  if (user.twins) user.twinCount = user.twins.length;
  
  // Calculate account age in days
  if (user.createdAt) {
    const now = new Date();
    const diffTime = Math.abs(now - user.createdAt);
    user.accountAge = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/*
========================================
PRE-VALIDATE MIDDLEWARE (runs even with validateBeforeSave: false)
========================================
*/
UserSchema.pre('validate', function(next) {
  updateDerivedFields(this);
  next();
});

/*
========================================
PRE-SAVE MIDDLEWARE (with safe next() check)
========================================
*/
UserSchema.pre('save', function(next) {
  updateDerivedFields(this);
  
  // Safely call next only if it's a function
  if (typeof next === 'function') {
    next();
  }
});

/*
========================================
METHODS
========================================
*/

// Follow a user
UserSchema.methods.follow = async function(userId) {
  if (this.following.includes(userId)) {
    return { success: false, message: 'Already following' };
  }
  
  this.following.push(userId);
  await this.save();
  
  // Add to target user's followers
  const targetUser = await mongoose.model('User').findById(userId);
  if (targetUser) {
    targetUser.followers.push(this._id);
    
    // Check if it's a twin (mutual follow)
    if (targetUser.following.includes(this._id)) {
      this.twins.push(userId);
      targetUser.twins.push(this._id);
      await targetUser.save();
      await this.save();
    } else {
      await targetUser.save();
    }
  }
  
  return { success: true, message: 'Followed successfully' };
};

// Unfollow a user
UserSchema.methods.unfollow = async function(userId) {
  if (!this.following.includes(userId)) {
    return { success: false, message: 'Not following' };
  }
  
  this.following = this.following.filter(id => id.toString() !== userId.toString());
  this.twins = this.twins.filter(id => id.toString() !== userId.toString());
  await this.save();
  
  // Remove from target user's followers
  const targetUser = await mongoose.model('User').findById(userId);
  if (targetUser) {
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== this._id.toString());
    targetUser.twins = targetUser.twins.filter(id => id.toString() !== this._id.toString());
    await targetUser.save();
  }
  
  return { success: true, message: 'Unfollowed successfully' };
};

// Get twin count
UserSchema.methods.getTwins = async function() {
  const twinUsers = await mongoose.model('User')
    .find({ _id: { $in: this.twins } })
    .select('name avatar isVerified');
  return twinUsers;
};

// Check if following a user
UserSchema.methods.isFollowing = function(userId) {
  return this.following.some(id => id.toString() === userId.toString());
};

// Check if followed by a user
UserSchema.methods.isFollowedBy = function(userId) {
  return this.followers.some(id => id.toString() === userId.toString());
};

// Check if twins with a user
UserSchema.methods.isTwin = function(userId) {
  return this.twins.some(id => id.toString() === userId.toString());
};

// Check if user qualifies for live streaming automatically
UserSchema.methods.checkLiveQualification = async function () {
  const Video = mongoose.model('Video');
  const now = new Date();
  
  // Skip if already manually approved
  if (this.canGoLive && this.canGoLiveReason === 'manual_admin_approval') {
    return { qualified: true, reason: 'manual_admin_approval' };
  }
  
  // Check if already auto-qualified recently (within last day)
  if (this.liveQualificationCheckedAt && 
      (now - this.liveQualificationCheckedAt) < (24 * 60 * 60 * 1000)) {
    return { 
      qualified: this.canGoLive && this.canGoLiveReason === 'auto_qualified', 
      reason: this.canGoLiveReason 
    };
  }

  // 4. Check active strikes (strikes older than 9 months are ignored)
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  const activeStrikes = this.liveStrikes.filter(
    strike => new Date(strike.date) > nineMonthsAgo
  );
  
  if (activeStrikes.length > 0) {
    this.liveQualificationCheckedAt = now;
    await this.save();
    return { qualified: false, reason: 'active_strikes', strikeCount: activeStrikes.length };
  }

  // 3. Check account age (30 days minimum)
  const accountAge = Math.floor((now - this.createdAt) / (1000 * 60 * 60 * 24));
  if (accountAge < 30) {
    this.liveQualificationCheckedAt = now;
    await this.save();
    return { qualified: false, reason: 'account_age', days: accountAge };
  }

  // 1 & 2. Get user's approved videos count and total views
  const videos = await Video.find({
    user: this._id,
    approved: true,
    isDeleted: false
  }).select('views');

  const approvedVideoCount = videos.length;
  const totalVideoViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);

  // Update user stats
  this.approvedVideoCount = approvedVideoCount;
  this.totalVideoViews = totalVideoViews;
  this.liveQualificationCheckedAt = now;

  // Check if qualifies
  if (approvedVideoCount >= 3 && totalVideoViews >= 500) {
    this.canGoLive = true;
    this.canGoLiveReason = 'auto_qualified';
    this.canGoLiveGrantedAt = now;
    this.canGoLiveGrantedBy = null;
    
    await this.save();
    return { 
      qualified: true, 
      reason: 'auto_qualified',
      stats: { approvedVideoCount, totalVideoViews, accountAge }
    };
  }

  // Save updated stats even if not qualified
  await this.save();
  return { 
    qualified: false, 
    reason: 'requirements_not_met',
    stats: { 
      approvedVideoCount, 
      totalVideoViews, 
      accountAge,
      needed: { videos: 3, views: 500, days: 30 }
    }
  };
};

UserSchema.methods.addLiveStrike = async function (reason, issuedBy = null) {
  const now = new Date();

  // Remove strikes older than 9 months
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  this.liveStrikes = this.liveStrikes.filter(s => new Date(s.date) > nineMonthsAgo);

  this.liveStrikes.push({ 
    reason, 
    date: now,
    issuedBy: issuedBy || null
  });

  // Auto-disable live privileges if 5 or more strikes in 9 months
  if (this.liveStrikes.length >= 5) {
    this.canGoLive = false;
    this.canGoLiveReason = 'revoked';
    this.canGoLiveGrantedAt = null;
    this.canGoLiveGrantedBy = null;
    
    this.notifications.push({ 
      type: 'system',
      message: 'Live privileges revoked due to multiple violations.',
      createdAt: new Date()
    });
  }

  await this.save();
  return this;
};

UserSchema.methods.getLiveStrikeCount = function () {
  const now = new Date();
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  return this.liveStrikes.filter(s => new Date(s.date) > nineMonthsAgo).length;
};

// Method to manually grant live privileges
UserSchema.methods.grantLivePrivilege = async function (adminId) {
  this.canGoLive = true;
  this.canGoLiveReason = 'manual_admin_approval';
  this.canGoLiveGrantedAt = new Date();
  this.canGoLiveGrantedBy = adminId;
  
  await this.save();
  return this;
};

// Method to manually revoke live privileges
UserSchema.methods.revokeLivePrivilege = async function (adminId, reason = 'Revoked by admin') {
  this.canGoLive = false;
  this.canGoLiveReason = 'revoked';
  this.canGoLiveGrantedAt = null;
  this.canGoLiveGrantedBy = null;
  
  // Add strike record
  await this.addLiveStrike(reason, adminId);
  
  this.notifications.push({
    type: 'system',
    message: `Live streaming privileges revoked: ${reason}`,
    createdAt: new Date()
  });
  
  await this.save();
  return this;
};

// Method to invalidate all tokens (force logout)
UserSchema.methods.invalidateTokens = async function () {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  this.online = false;
  this.lastActive = new Date();
  
  // Save without validation - the pre-validate hook will still run
  await this.save({ validateBeforeSave: false });
  return this.tokenVersion;
};

// Method to check if token is valid
UserSchema.methods.isTokenValid = function (tokenVersion) {
  return (this.tokenVersion || 0) === tokenVersion;
};

// Method to add login history
UserSchema.methods.addLoginHistory = async function (ip, userAgent, location = '') {
  this.loginHistory.push({ ip, userAgent, location, timestamp: new Date() });
  
  // Keep only last 50 logins
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  this.lastLogin = new Date();
  this.online = true;
  await this.save();
  return this;
};

// Method to soft delete user
UserSchema.methods.softDelete = async function (deletedBy, reason = '') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleteReason = reason;
  this.adminDeactivated = true;
  this.adminDeactivatedAt = new Date();
  this.adminDeactivationReason = 'SOFT_DELETED';
  
  // Also revoke live privileges
  if (this.canGoLive) {
    this.canGoLive = false;
    this.canGoLiveReason = 'revoked';
    this.canGoLiveGrantedAt = null;
    this.canGoLiveGrantedBy = null;
  }
  
  // Force logout
  await this.invalidateTokens();
  
  // Save without validation - the pre-validate hook will still run
  await this.save({ validateBeforeSave: false });
  return this;
};

// Method to restore soft deleted user
UserSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.deleteReason = null;
  this.adminDeactivated = false;
  this.adminDeactivatedAt = null;
  this.adminDeactivationReason = null;
  
  // Save without validation - the pre-validate hook will still run
  await this.save({ validateBeforeSave: false });
  return this;
};

// Method to update notification preferences
UserSchema.methods.updateNotificationPreferences = async function (preferences) {
  this.notificationPreferences = {
    ...this.notificationPreferences.toObject(),
    ...preferences
  };
  await this.save();
  return this.notificationPreferences;
};

// Method to update privacy settings
UserSchema.methods.updatePrivacySettings = async function (settings) {
  this.privacySettings = {
    ...this.privacySettings.toObject(),
    ...settings
  };
  await this.save();
  return this.privacySettings;
};

/*
========================================
STATICS
========================================
*/
UserSchema.statics.forceLogoutAllSessions = async function (userId) {
  const user = await this.findById(userId);
  if (!user) return false;
  
  return await user.invalidateTokens();
};

// Find non-deleted users
UserSchema.statics.findActive = function (conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

// Find deleted users
UserSchema.statics.findDeleted = function (conditions = {}) {
  return this.find({ ...conditions, isDeleted: true });
};

// Check live qualification for all users (admin tool)
UserSchema.statics.checkAllLiveQualifications = async function () {
  const users = await this.find({ 
    isDeleted: false,
    isBanned: false,
    role: 'user'
  });
  
  const results = [];
  for (const user of users) {
    const qualification = await user.checkLiveQualification();
    results.push({
      userId: user._id,
      name: user.name,
      email: user.email,
      ...qualification
    });
  }
  
  return results;
};

// Find popular users based on follower count
UserSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isDeleted: false, isBanned: false })
    .sort({ followerCount: -1 })
    .limit(limit)
    .select('name avatar bio followerCount isVerified');
};

// Find twins between two users
UserSchema.statics.findTwins = function (userId) {
  return this.find({
    _id: { $ne: userId },
    followers: userId,
    following: userId
  }).select('name avatar isVerified');
};

module.exports = mongoose.model('User', UserSchema);