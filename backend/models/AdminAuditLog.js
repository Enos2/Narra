/**
 * File: backend/models/AdminAuditLog.js
 * Description: Centralized audit log for all admin actions with rich context.
 * Enhanced for searchability and human-readable logging.
 * COMPLETE VERSION - INCLUDES ALL MODERATION ACTIONS
 */

const mongoose = require("mongoose");

const AdminAuditLogSchema = new mongoose.Schema(
  {
    // WHO did it
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminName: {
      type: String,
      required: true,
      index: true, // For searching by admin name
    },
    adminRole: {
      type: String,
      required: true,
      enum: ['superadmin', 'platformadmin', 'supportadmin', 'user']
    },
    adminEmail: {
      type: String,
      index: true,
    },

    // WHAT was done - COMPLETE ENUM WITH ALL ACTIONS
    actionType: {
      type: String,
      required: true,
      index: true,
      enum: [
        // ===== MODERATION ACTIONS =====
        'VIEW_MODERATION', 'VIEW_VIDEO_DETAILS',
        
        // ===== VIDEO MODERATION ACTIONS =====
        'APPROVE_VIDEO', 'REJECT_VIDEO', 'REMOVE_VIDEO', 'RESTORE_VIDEO',
        'FEATURE_VIDEO', 'UNFEATURE_VIDEO', 'REMOVE_VIDEO_PERMANENT',
        
        // ===== USER ACTIONS =====
        'BAN_USER', 'UNBAN_USER', 'VERIFY_USER', 'UNVERIFY_USER',
        'DEACTIVATE_USER', 'ACTIVATE_USER', 'SHADOW_BAN_USER', 
        'REMOVE_SHADOW_BAN_USER', 'FORCE_LOGOUT',
        
        // ===== ADMIN ACTIONS =====
        'CREATE_ADMIN', 'PROMOTE_ADMIN', 'DEMOTE_ADMIN', 'DEACTIVATE_ADMIN', 
        'REACTIVATE_ADMIN', 'DELETE_ADMIN', 'PERMANENT_DELETE_ADMIN',
        'TOGGLE_SUPPORT_ROLE', 'FORCE_ADMIN_LOGOUT',
        
        // ===== LIVE STREAM ACTIONS =====
        'APPROVE_LIVE', 'REJECT_LIVE', 'END_LIVE_STREAM', 'SEND_STREAM_WARNING',
        'SHADOW_BAN_LIVE', 'REMOVE_SHADOW_BAN_LIVE',
        
        // ===== CONTENT ACTIONS =====
        'REMOVE_COMMENT', 'SHADOW_BAN_CONTENT', 'REMOVE_SHADOW_BAN_CONTENT',
        
        // ===== FUNDRAISER ACTIONS =====
        'APPROVE_FUNDRAISER', 'REJECT_FUNDRAISER',
        
        // ===== SYSTEM ACTIONS =====
        'PERMANENT_DELETE_ACCOUNT'
      ]
    },
    
    // Human-readable labels - COMPLETE
    actionLabel: {
      type: String,
      required: true,
      enum: [
        // Moderation
        'View Moderation Queue', 'View Video Details',
        
        // Video Moderation
        'Approve Video', 'Reject Video', 'Remove Video', 'Restore Video',
        'Feature Video', 'Unfeature Video', 'Permanently Remove Video',
        
        // User
        'Ban User', 'Unban User', 'Verify User', 'Unverify User',
        'Deactivate User', 'Activate User', 'Shadow Ban User', 
        'Remove Shadow Ban User', 'Force Logout',
        
        // Admin
        'Create Admin', 'Promote Admin', 'Demote Admin', 'Deactivate Admin',
        'Reactivate Admin', 'Delete Admin', 'Permanently Delete Admin',
        'Toggle Support Role', 'Force Admin Logout',
        
        // Live Stream
        'Approve Live Stream', 'Reject Live Stream', 'End Live Stream', 
        'Send Stream Warning', 'Shadow Ban Live Stream', 'Remove Shadow Ban Live Stream',
        
        // Content
        'Remove Comment', 'Shadow Ban Content', 'Remove Shadow Ban Content',
        
        // Fundraiser
        'Approve Fundraiser', 'Reject Fundraiser',
        
        // System
        'Permanently Delete Account'
      ]
    },

    // ON WHAT
    targetType: {
      type: String,
      required: true,
      enum: ['User', 'Video', 'Admin', 'LiveStream', 'Comment', 'Fundraiser', 'System', 'Moderation']
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Some actions don't have a target ID (e.g., viewing queue)
      index: true,
    },
    targetName: {
      type: String,
      index: true,
    },
    targetEmail: {
      type: String,
      index: true,
    },

    // Context
    description: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
    },

    // Metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    }
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ adminName: 1, createdAt: -1 });
AdminAuditLogSchema.index({ actionType: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetType: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetEmail: 1, createdAt: -1 });
AdminAuditLogSchema.index({ createdAt: -1 });

// Text index for search across multiple fields
AdminAuditLogSchema.index({
  adminName: 'text',
  actionLabel: 'text',
  description: 'text',
  targetName: 'text',
  targetEmail: 'text',
  reason: 'text'
}, {
  weights: {
    adminName: 10,
    targetEmail: 8,
    targetName: 6,
    description: 5,
    actionLabel: 4,
    reason: 3
  },
  name: 'audit_log_text_search'
});

module.exports = mongoose.model("AdminAuditLog", AdminAuditLogSchema);