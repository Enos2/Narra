/**
 * File: backend/models/User.js
 * Description: Comprehensive User schema for Narra with token versioning for force logout
 * FULLY UPDATED: Added missing adminActions enum values and fixed video query field
 * FIXED: checkLiveQualification now uses 'creator' instead of 'user'
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
        'REVOKE_LIVE_PRIVILEGE',
        'ADD_LIVE_STRIKE',
        'REMOVE_LIVE_STRIKE',
        'BAN_FROM_STREAMING',
        'END_LIVE_STREAM',
        'SEND_STREAM_WARNING',
        'SHADOW_BAN_LIVE',
        'REMOVE_SHADOW_BAN_LIVE'
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
RESTRICTIONS SCHEMA
========================================
*/
const RestrictionsSchema = new mongoose.Schema(
  {
    upload: { type: Boolean, default: false },
    goLive: { type: Boolean, default: false },
    comment: { type: Boolean, default: false }
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
    firstName: { 
      type: String, 
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters']
    },
    lastName: { 
      type: String, 
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters']
    },
    middleName: { 
      type: String, 
      trim: true,
      default: '' 
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'], 
      unique: true, 
      lowercase: true,
      index: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: { type: String, required: true, minlength: 6 },
    
    gender: {
      type: String,
      enum: ['male', 'female', ''],
      default: ''
    },
    
    avatar: { type: String, default: null },
    bio: { type: String, maxlength: 500, default: '' },
    dateOfBirth: { type: Date, required: true },
    phoneNumber: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    twins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    twinCount: { type: Number, default: 0 },

    notificationPreferences: { type: NotificationPreferencesSchema, default: () => ({}) },
    privacySettings: { type: PrivacySettingsSchema, default: () => ({}) },
    preferredLanguage: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },

    restrictions: { type: RestrictionsSchema, default: () => ({ upload: false, goLive: false, comment: false }) },

    role: {
      type: String,
      enum: ['user', 'supportadmin', 'platformadmin', 'superadmin'],
      default: 'user',
      index: true
    },
    isFounder: { type: Boolean, default: false, immutable: true },
    isCreator: { type: Boolean, default: false },
    isSupport: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminCreatedAt: Date,

    canGoLive: { type: Boolean, default: false, index: true },
    canGoLiveReason: { 
      type: String, 
      enum: ['manual_admin_approval', 'auto_qualified', 'pending', 'revoked', null],
      default: null 
    },
    canGoLiveGrantedAt: Date,
    canGoLiveGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedVideoCount: { type: Number, default: 0 },
    totalVideoViews: { type: Number, default: 0 },
    liveQualificationCheckedAt: Date,
    liveStrikes: { type: [LiveStrikeSchema], default: [] },

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

    balance: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },
    payoutMethod: {
      type: { type: String, enum: ['paypal', 'stripe', 'bank', null], default: null },
      email: String,
      accountLastFour: String,
      isVerified: { type: Boolean, default: false }
    },

    purchasedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    purchasedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],
    uploadedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    uploadedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],

    isBanned: { type: Boolean, default: false },
    bannedAt: Date,
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    banReason: String,
    isShadowBanned: { type: Boolean, default: false },
    shadowBannedCountries: [{ type: String }],
    shadowBannedContinents: [{ type: String }],
    shadowBanAppliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shadowBanAppliedAt: Date,

    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationDocuments: [{
      type: { type: String, enum: ['id', 'passport', 'license'] },
      url: String,
      uploadedAt: Date,
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
    }],

    lastLogin: { type: Date, index: true },
    lastActive: { type: Date, index: true },
    online: { type: Boolean, default: false },
    accountAge: { type: Number, default: 0 },

    country: { type: String, index: true },
    continent: String,
    timezone: String,

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

    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    likedLives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Live' }],
    watchHistory: [{
      video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
      watchedAt: Date,
      progress: Number
    }],
    ratings: [
      {
        video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
        rating: { type: Number, min: 0, max: 10 },
        createdAt: { type: Date, default: Date.now }
      },
    ],

    adminActions: { type: [AdminActionSchema], default: [] },

    adminDeactivated: { type: Boolean, default: false },
    adminDeactivatedAt: Date,
    adminDeactivationReason: String,

    isDeactivated: { type: Boolean, default: false },
    deactivatedAt: Date,
    deactivationRequestedAt: Date,
    deactivationReason: String,

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deleteReason: String,

    featuredVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],

    auditLogs: [
      {
        type: { type: String },
        description: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/*
========================================
VIRTUAL PROPERTIES
========================================
*/
UserSchema.virtual('fullName').get(function() {
  let name = `${this.firstName} ${this.lastName}`;
  if (this.middleName && this.middleName.trim()) {
    name = `${this.firstName} ${this.middleName} ${this.lastName}`;
  }
  return name;
});

UserSchema.virtual('name').get(function() {
  return this.fullName;
});

UserSchema.virtual('profileComplete').get(function() {
  return !!(this.avatar && this.bio && this.location);
});

UserSchema.virtual('displayName').get(function() {
  return this.username || this.fullName || this.email.split('@')[0];
});

UserSchema.virtual('status').get(function() {
  if (this.isBanned) return 'banned';
  if (this.isDeactivated) return 'deactivated';
  return 'active';
});

/*
========================================
METHOD TO GET FORMATTED ACCOUNT AGE
========================================
*/
UserSchema.methods.getFormattedAccountAge = function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    if (remainingDays === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    const months = Math.floor(remainingDays / 30);
    const days = remainingDays % 30;
    
    let result = `${years} year${years !== 1 ? 's' : ''}`;
    if (months > 0) {
      result += `, ${months} month${months !== 1 ? 's' : ''}`;
    }
    if (days > 0 && months === 0) {
      result += `, ${days} day${days !== 1 ? 's' : ''}`;
    }
    return result;
  }
};

/*
========================================
COMPOUND INDEXES
========================================
*/
UserSchema.index({ role: 1, lastActive: -1 });
UserSchema.index({ isDeleted: 1, role: 1 });
UserSchema.index({ adminDeactivated: 1, role: 1 });
UserSchema.index({ canGoLive: 1, canGoLiveReason: 1 });
UserSchema.index({ followers: 1 });
UserSchema.index({ following: 1 });
UserSchema.index({ twins: 1 });
UserSchema.index({ followerCount: -1 });
UserSchema.index({ location: 1 });
UserSchema.index({ createdAt: -1 });

/*
========================================
HELPER FUNCTION TO UPDATE DERIVED FIELDS
========================================
*/
function updateDerivedFields(user) {
  if (user.followers) user.followerCount = user.followers.length;
  if (user.following) user.followingCount = user.following.length;
  if (user.twins) user.twinCount = user.twins.length;
  
  if (user.createdAt) {
    const now = new Date();
    const diffTime = Math.abs(now - user.createdAt);
    user.accountAge = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/*
========================================
PRE-VALIDATE MIDDLEWARE
========================================
*/
UserSchema.pre('validate', function(next) {
  updateDerivedFields(this);
  if (next && typeof next === 'function') {
    next();
  }
});

/*
========================================
PRE-SAVE MIDDLEWARE
========================================
*/
UserSchema.pre('save', function(next) {
  updateDerivedFields(this);
  
  if (this.isModified('password') && this.password) {
    if (!this.password.startsWith('$2')) {
      const salt = bcrypt.genSaltSync(10);
      this.password = bcrypt.hashSync(this.password, salt);
    }
  }
  
  if (!this.restrictions) {
    this.restrictions = { upload: false, goLive: false, comment: false };
  }
  
  if (next && typeof next === 'function') {
    next();
  }
});

/*
========================================
PRE-FIND MIDDLEWARE
========================================
*/
UserSchema.pre('find', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('findOne', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('findById', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('findOneAndUpdate', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('updateOne', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('updateMany', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('countDocuments', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

UserSchema.pre('aggregate', function(next) {
  if (this.getOptions().includeDeleted !== true) {
    this.pipeline().unshift({ $match: { isDeleted: false } });
  }
  if (next && typeof next === 'function') {
    next();
  }
});

/*
========================================
METHODS
========================================
*/

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.follow = async function(userId) {
  if (this.following.includes(userId)) {
    return { success: false, message: 'Already following' };
  }
  
  this.following.push(userId);
  await this.save({ validateBeforeSave: false });
  
  const targetUser = await mongoose.model('User').findById(userId);
  if (targetUser) {
    targetUser.followers.push(this._id);
    
    if (targetUser.following.includes(this._id)) {
      this.twins.push(userId);
      targetUser.twins.push(this._id);
      await targetUser.save({ validateBeforeSave: false });
      await this.save({ validateBeforeSave: false });
    } else {
      await targetUser.save({ validateBeforeSave: false });
    }
  }
  
  return { success: true, message: 'Followed successfully' };
};

UserSchema.methods.unfollow = async function(userId) {
  if (!this.following.includes(userId)) {
    return { success: false, message: 'Not following' };
  }
  
  this.following = this.following.filter(id => id.toString() !== userId.toString());
  this.twins = this.twins.filter(id => id.toString() !== userId.toString());
  await this.save({ validateBeforeSave: false });
  
  const targetUser = await mongoose.model('User').findById(userId);
  if (targetUser) {
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== this._id.toString());
    targetUser.twins = targetUser.twins.filter(id => id.toString() !== this._id.toString());
    await targetUser.save({ validateBeforeSave: false });
  }
  
  return { success: true, message: 'Unfollowed successfully' };
};

UserSchema.methods.getTwins = async function() {
  const twinUsers = await mongoose.model('User')
    .find({ _id: { $in: this.twins } })
    .select('firstName lastName username avatar isVerified');
  return twinUsers;
};

UserSchema.methods.isFollowing = function(userId) {
  return this.following.some(id => id.toString() === userId.toString());
};

UserSchema.methods.isFollowedBy = function(userId) {
  return this.followers.some(id => id.toString() === userId.toString());
};

UserSchema.methods.isTwin = function(userId) {
  return this.twins.some(id => id.toString() === userId.toString());
};

/*
========================================
CHECK LIVE QUALIFICATION - FIXED
========================================
*/
UserSchema.methods.checkLiveQualification = async function () {
  const Video = mongoose.model('Video');
  const now = new Date();
  
  if (this.canGoLive && this.canGoLiveReason === 'manual_admin_approval') {
    return { qualified: true, reason: 'manual_admin_approval' };
  }
  
  if (this.liveQualificationCheckedAt && 
      (now - this.liveQualificationCheckedAt) < (24 * 60 * 60 * 1000)) {
    return { 
      qualified: this.canGoLive && this.canGoLiveReason === 'auto_qualified', 
      reason: this.canGoLiveReason 
    };
  }

  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  const activeStrikes = this.liveStrikes.filter(
    strike => new Date(strike.date) > nineMonthsAgo
  );
  
  if (activeStrikes.length > 0) {
    this.liveQualificationCheckedAt = now;
    await this.save();
    return { qualified: false, reason: 'active_strikes', strikeCount: activeStrikes.length };
  }

  const accountAge = Math.floor((now - this.createdAt) / (1000 * 60 * 60 * 24));
  if (accountAge < 30) {
    this.liveQualificationCheckedAt = now;
    await this.save();
    return { qualified: false, reason: 'account_age', days: accountAge };
  }

  // FIXED: Changed from 'user' to 'creator'
  const videos = await Video.find({
    creator: this._id,
    approved: true,
    isDeleted: false
  }).select('views');

  const approvedVideoCount = videos.length;
  const totalVideoViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);

  this.approvedVideoCount = approvedVideoCount;
  this.totalVideoViews = totalVideoViews;
  this.liveQualificationCheckedAt = now;

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
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  this.liveStrikes = this.liveStrikes.filter(s => new Date(s.date) > nineMonthsAgo);

  this.liveStrikes.push({ 
    reason, 
    date: now,
    issuedBy: issuedBy || null
  });

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

UserSchema.methods.removeLiveStrike = async function (strikeId) {
  const strikeIndex = this.liveStrikes.findIndex(
    strike => strike._id.toString() === strikeId
  );

  if (strikeIndex === -1) {
    throw new Error('Strike not found');
  }

  const removedStrike = this.liveStrikes[strikeIndex];
  this.liveStrikes.splice(strikeIndex, 1);
  
  await this.save();
  return removedStrike;
};

UserSchema.methods.getLiveStrikeCount = function () {
  const now = new Date();
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  return this.liveStrikes.filter(s => new Date(s.date) > nineMonthsAgo).length;
};

UserSchema.methods.getActiveStrikeCount = function () {
  const now = new Date();
  const nineMonthsAgo = new Date(now.getTime() - (9 * 30 * 24 * 60 * 60 * 1000));
  return this.liveStrikes.filter(s => new Date(s.date) > nineMonthsAgo).length;
};

UserSchema.methods.grantLivePrivilege = async function (adminId) {
  this.canGoLive = true;
  this.canGoLiveReason = 'manual_admin_approval';
  this.canGoLiveGrantedAt = new Date();
  this.canGoLiveGrantedBy = adminId;
  
  await this.save();
  return this;
};

UserSchema.methods.revokeLivePrivilege = async function (adminId, reason = 'Revoked by admin') {
  this.canGoLive = false;
  this.canGoLiveReason = 'revoked';
  this.canGoLiveGrantedAt = null;
  this.canGoLiveGrantedBy = null;
  
  await this.addLiveStrike(reason, adminId);
  
  this.notifications.push({
    type: 'system',
    message: `Live streaming privileges revoked: ${reason}`,
    createdAt: new Date()
  });
  
  await this.save();
  return this;
};

UserSchema.methods.invalidateTokens = async function () {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  this.online = false;
  this.lastActive = new Date();
  
  await this.save({ validateBeforeSave: false });
  return this.tokenVersion;
};

UserSchema.methods.isTokenValid = function (tokenVersion) {
  return (this.tokenVersion || 0) === tokenVersion;
};

UserSchema.methods.addLoginHistory = async function (ip, userAgent, location = '') {
  this.loginHistory.push({ ip, userAgent, location, timestamp: new Date() });
  
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  this.lastLogin = new Date();
  this.online = true;
  await this.save();
  return this;
};

UserSchema.methods.softDelete = async function (deletedBy, reason = '') {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deleteReason = reason;
  this.adminDeactivated = true;
  this.adminDeactivatedAt = new Date();
  this.adminDeactivationReason = 'SOFT_DELETED';
  
  if (this.canGoLive) {
    this.canGoLive = false;
    this.canGoLiveReason = 'revoked';
    this.canGoLiveGrantedAt = null;
    this.canGoLiveGrantedBy = null;
  }
  
  await this.invalidateTokens();
  await this.save({ validateBeforeSave: false });
  return this;
};

UserSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.deleteReason = null;
  this.adminDeactivated = false;
  this.adminDeactivatedAt = null;
  this.adminDeactivationReason = null;
  
  await this.save({ validateBeforeSave: false });
  return this;
};

UserSchema.methods.updateNotificationPreferences = async function (preferences) {
  this.notificationPreferences = {
    ...this.notificationPreferences.toObject(),
    ...preferences
  };
  await this.save();
  return this.notificationPreferences;
};

UserSchema.methods.updatePrivacySettings = async function (settings) {
  this.privacySettings = {
    ...this.privacySettings.toObject(),
    ...settings
  };
  await this.save();
  return this.privacySettings;
};

UserSchema.methods.updateRestrictions = async function (restrictions) {
  this.restrictions = {
    ...this.restrictions.toObject(),
    ...restrictions
  };
  await this.save();
  return this.restrictions;
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

UserSchema.statics.findActive = function (conditions = {}) {
  return this.find({ ...conditions, isDeleted: false });
};

UserSchema.statics.findDeleted = function (conditions = {}) {
  return this.find({ ...conditions, isDeleted: true });
};

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
      name: user.fullName,
      username: user.username,
      email: user.email,
      ...qualification
    });
  }
  
  return results;
};

UserSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isDeleted: false, isBanned: false })
    .sort({ followerCount: -1 })
    .limit(limit)
    .select('firstName lastName username avatar bio followerCount isVerified');
};

UserSchema.statics.findTwins = function (userId) {
  return this.find({
    _id: { $ne: userId },
    followers: userId,
    following: userId
  }).select('firstName lastName username avatar isVerified');
};

/*
========================================
EXPORT MODEL WITH OVERWRITE PROTECTION
========================================
*/
const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;