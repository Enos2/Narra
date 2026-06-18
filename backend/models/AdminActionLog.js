const mongoose = require("mongoose");

const AdminActionLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    adminRoleAtTime: {
      type: String,
      enum: ["support_admin", "platform_admin", "super_admin"],
      required: true,
    },

    actionType: {
      type: String,
      enum: [
        "VIDEO_APPROVED",
        "VIDEO_REJECTED",
        "VIDEO_SHADOW_BANNED",
        "VIDEO_UNSHADOW_BANNED",
        "VIDEO_FEATURED",
        "USER_BANNED",
        "USER_UNBANNED",
        "USER_SHADOW_BANNED",
        "USER_UNSHADOW_BANNED",
        "USER_VERIFIED",
        "ADMIN_PROMOTED",
        "ADMIN_DEMOTED",
        "ADMIN_CREATED",
        "LIVE_STREAM_APPROVED",
        "LIVE_STREAM_REVOKED",
        "COMMENT_REMOVED",
        "RATING_FLAGGED",
        "SECURITY_OVERRIDE",
      ],
      required: true,
    },

    targetType: {
      type: String,
      enum: ["video", "user", "admin", "comment", "live_stream", "system"],
      required: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    reason: {
      type: String,
      default: "",
    },

    metadata: {
      type: Object,
      default: {},
    },

    isPublic: {
      type: Boolean,
      default: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminActionLog", AdminActionLogSchema);