/**
 * File: backend/controllers/adminController.js
 * COMPLETE UPDATED VERSION - ALL FUNCTIONS INCLUDED
 */

const User = require('../models/User');
const Video = require('../models/Video');
const Live = require('../models/Live');
const Comment = require('../models/Comment');
const AdminAuditLog = require('../models/AdminAuditLog');
const bcrypt = require('bcryptjs');

/* ========================
   ROLE HIERARCHY CONSTANTS
======================== */
const ROLE_HIERARCHY = {
  superadmin: 4,
  platformadmin: 3,
  supportadmin: 2,
  user: 1
};

const ADMIN_ROLES = ['superadmin', 'platformadmin', 'supportadmin'];

// FOUNDER PROTECTION
const FOUNDER_ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'founder@narra.com';

/* ========================
   AUDIT LOGGING FUNCTIONS
======================== */

/**
 * Log admin action to centralized audit log
 */
const logAdminAction = async ({
  admin,
  actionType,
  actionLabel,
  targetType,
  targetId = null,
  targetName = null,
  targetEmail = null,
  description,
  reason = null,
  ipAddress = null,
  userAgent = null,
  metadata = {}
}) => {
  try {
    const logEntry = new AdminAuditLog({
      adminId: admin._id,
      adminName: admin.name || admin.username || 'Unknown',
      adminRole: admin.role,
      adminEmail: admin.email,
      actionType,
      actionLabel,
      targetType,
      targetId,
      targetName,
      targetEmail,
      description,
      reason,
      ipAddress,
      userAgent,
      metadata
    });

    await logEntry.save();
    console.log(`[AUDIT] ${actionLabel} by ${admin.email} - ${description}`);

    // Also keep in user's adminActions array for backward compatibility
    if (admin.adminActions) {
      admin.adminActions.push({
        actionType,
        targetId,
        targetModel: targetType,
        performedBy: admin._id,
        description,
        details: metadata,
        createdAt: new Date(),
      });
      await admin.save({ validateBeforeSave: false });
    }
    
  } catch (err) {
    console.error('ADMIN ACTION LOG ERROR:', err);
  }
};

/**
 * Get audit logs with search and filters
 */
const getAuditLogs = async (queryParams) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      adminName = '',
      actionType = '',
      targetType = '',
      targetId = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const query = {};
    
    // Text search across multiple fields
    if (search && search.trim()) {
      query.$or = [
        { adminName: { $regex: search, $options: 'i' } },
        { actionLabel: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
        { targetEmail: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    // Individual field filters
    if (adminName) query.adminName = { $regex: adminName, $options: 'i' };
    if (actionType) query.actionType = actionType;
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = targetId;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    const [logs, total] = await Promise.all([
      AdminAuditLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AdminAuditLog.countDocuments(query)
    ]);

    return {
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return {
      success: false,
      logs: [],
      pagination: { total: 0, page: 1, limit: 50, totalPages: 0 }
    };
  }
};

/**
 * Get recent logs for dashboard
 */
const getRecentAuditLogs = async (limit = 10) => {
  try {
    const logs = await AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    return logs;
  } catch (error) {
    console.error('Failed to fetch recent logs:', error);
    return [];
  }
};

/**
 * Get filter options
 */
const getAuditFilterOptions = async () => {
  try {
    const [actionTypes, adminNames, targetTypes] = await Promise.all([
      AdminAuditLog.distinct('actionType'),
      AdminAuditLog.distinct('adminName'),
      AdminAuditLog.distinct('targetType')
    ]);

    return {
      actionTypes: actionTypes.filter(Boolean).sort(),
      adminNames: adminNames.filter(Boolean).sort(),
      targetTypes: targetTypes.filter(Boolean).sort()
    };
  } catch (error) {
    console.error('Failed to get filter options:', error);
    return { actionTypes: [], adminNames: [], targetTypes: [] };
  }
};

/**
 * Helper functions
 */
const canManageAdmin = (admin1Role, admin2Role) => {
  return ROLE_HIERARCHY[admin1Role] > ROLE_HIERARCHY[admin2Role];
};

const isFounder = (user) => {
  return user && user.email === FOUNDER_ADMIN_EMAIL;
};

const invalidateUserTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;
    
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.lastActive = new Date();
    user.online = false;
    
    await user.save({ validateBeforeSave: false });
    return true;
  } catch (err) {
    console.error('Failed to invalidate tokens:', err.message);
    return false;
  }
};

/* ========================
   AUDIT LOG ENDPOINTS
======================== */

exports.getAuditLogs = async (req, res) => {
  try {
    const result = await getAuditLogs(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
};

exports.getRecentAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = await getRecentAuditLogs(limit);
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching recent audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent audit logs'
    });
  }
};

exports.getAuditFilterOptions = async (req, res) => {
  try {
    const options = await getAuditFilterOptions();
    res.json({
      success: true,
      ...options
    });
  } catch (error) {
    console.error('Error getting audit filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get filter options'
    });
  }
};

/* ========================
   1️⃣ CREATE ADMIN (SUPER ADMIN ONLY)
======================== */
exports.createAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can create admins' 
      });
    }

    const { name, email, password, role, dateOfBirth } = req.body;

    if (!name || !email || !password || !role || !dateOfBirth) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields (name, email, password, role, dateOfBirth) are required' 
      });
    }

    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid admin role. Must be: superadmin, platformadmin, or supportadmin' 
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      dateOfBirth: new Date(dateOfBirth),
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: req.user._id,
      createdBy: req.user._id,
      adminCreatedAt: new Date(),
      adminDeactivated: false,
      isAdmin: true
    });

    await newAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'CREATE_ADMIN',
      actionLabel: 'Create Admin',
      targetType: 'Admin',
      targetId: newAdmin._id,
      targetName: newAdmin.name,
      targetEmail: newAdmin.email,
      description: `Created new admin ${newAdmin.email} with role ${role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        newRole: role,
        createdBy: req.user.email 
      }
    });

    const adminToReturn = {
      _id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      isActive: !newAdmin.adminDeactivated,
      createdAt: newAdmin.createdAt
    };

    res.status(201).json({ 
      success: true, 
      message: 'Admin created successfully',
      admin: adminToReturn 
    });

  } catch (err) {
    console.error('CREATE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create admin: ' + err.message 
    });
  }
};

/* ========================
   2️⃣ PROMOTE ADMIN (SUPER ADMIN ONLY)
======================== */
exports.promoteAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can promote admins' 
      });
    }

    const targetAdmin = await User.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (isFounder(targetAdmin)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder admin cannot be modified' 
      });
    }

    if (targetAdmin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot promote yourself' 
      });
    }

    if (targetAdmin.role === 'superadmin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin is already at highest role' 
      });
    }

    let nextRole;
    if (targetAdmin.role === 'supportadmin') {
      nextRole = 'platformadmin';
    } else if (targetAdmin.role === 'platformadmin') {
      nextRole = 'superadmin';
    } else {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot promote ${targetAdmin.role}` 
      });
    }

    const previousRole = targetAdmin.role;
    targetAdmin.role = nextRole;
    await targetAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'PROMOTE_ADMIN',
      actionLabel: 'Promote Admin',
      targetType: 'Admin',
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
      targetEmail: targetAdmin.email,
      description: `Promoted ${targetAdmin.email} from ${previousRole} to ${nextRole}`,
      reason: req.body.reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        previousRole, 
        newRole: nextRole,
        promotedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: `Admin promoted from ${previousRole} to ${nextRole}`,
      admin: {
        _id: targetAdmin._id,
        email: targetAdmin.email,
        previousRole,
        newRole: nextRole
      }
    });

  } catch (err) {
    console.error('PROMOTE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to promote admin' 
    });
  }
};

/* ========================
   3️⃣ DEMOTE ADMIN (SUPER ADMIN ONLY)
======================== */
exports.demoteAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can demote admins' 
      });
    }

    const targetAdmin = await User.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (isFounder(targetAdmin)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder admin cannot be modified' 
      });
    }

    if (targetAdmin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot demote yourself' 
      });
    }

    if (targetAdmin.role === 'supportadmin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot demote support admin further. Use deactivate instead.' 
      });
    }

    let newRole;
    if (targetAdmin.role === 'superadmin') {
      newRole = 'platformadmin';
    } else if (targetAdmin.role === 'platformadmin') {
      newRole = 'supportadmin';
    } else {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot demote ${targetAdmin.role}` 
      });
    }

    const previousRole = targetAdmin.role;
    targetAdmin.role = newRole;
    await targetAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'DEMOTE_ADMIN',
      actionLabel: 'Demote Admin',
      targetType: 'Admin',
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
      targetEmail: targetAdmin.email,
      description: `Demoted ${targetAdmin.email} from ${previousRole} to ${newRole}`,
      reason: req.body.reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        previousRole, 
        newRole,
        demotedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: `Admin demoted from ${previousRole} to ${newRole}`,
      admin: {
        _id: targetAdmin._id,
        email: targetAdmin.email,
        previousRole,
        newRole
      }
    });

  } catch (err) {
    console.error('DEMOTE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to demote admin' 
    });
  }
};

/* ========================
   4️⃣ DEACTIVATE ADMIN (SUPER + PLATFORM ADMIN)
======================== */
exports.deactivateAdmin = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins or platform admins can deactivate admins' 
      });
    }

    const targetAdmin = await User.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (isFounder(targetAdmin)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder admin cannot be deactivated' 
      });
    }

    if (targetAdmin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate yourself' 
      });
    }

    if (targetAdmin.adminDeactivated) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin is already deactivated' 
      });
    }

    targetAdmin.adminDeactivated = true;
    targetAdmin.adminDeactivatedAt = new Date();
    targetAdmin.adminDeactivationReason = req.body.reason || 'Deactivated by admin';
    
    await invalidateUserTokens(targetAdmin._id);
    await targetAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'DEACTIVATE_ADMIN',
      actionLabel: 'Deactivate Admin',
      targetType: 'Admin',
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
      targetEmail: targetAdmin.email,
      description: `Deactivated admin ${targetAdmin.email}`,
      reason: targetAdmin.adminDeactivationReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        deactivatedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: 'Admin deactivated and force logged out',
      admin: {
        _id: targetAdmin._id,
        email: targetAdmin.email,
        role: targetAdmin.role,
        isActive: false,
        deactivatedAt: targetAdmin.adminDeactivatedAt
      }
    });

  } catch (err) {
    console.error('DEACTIVATE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to deactivate admin' 
    });
  }
};

/* ========================
   5️⃣ REACTIVATE ADMIN (SUPER ADMIN ONLY)
======================== */
exports.reactivateAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can reactivate admins' 
      });
    }

    const targetAdmin = await User.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (!targetAdmin.adminDeactivated) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin is already active' 
      });
    }

    targetAdmin.adminDeactivated = false;
    targetAdmin.adminDeactivatedAt = null;
    targetAdmin.adminDeactivationReason = null;
    await targetAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REACTIVATE_ADMIN',
      actionLabel: 'Reactivate Admin',
      targetType: 'Admin',
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
      targetEmail: targetAdmin.email,
      description: `Reactivated admin ${targetAdmin.email}`,
      reason: req.body.reason || 'Reactivated by superadmin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        reactivatedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: 'Admin reactivated successfully',
      admin: {
        _id: targetAdmin._id,
        email: targetAdmin.email,
        role: targetAdmin.role,
        isActive: true
      }
    });

  } catch (err) {
    console.error('REACTIVATE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reactivate admin' 
    });
  }
};

/* ========================
   6️⃣ DELETE ADMIN (SUPER ADMIN ONLY)
======================== */
exports.deleteAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can delete admins' 
      });
    }

    const targetAdmin = await User.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (isFounder(targetAdmin)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder admin cannot be deleted' 
      });
    }

    if (targetAdmin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete yourself' 
      });
    }

    if (targetAdmin.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin is already deleted' 
      });
    }

    targetAdmin.isDeleted = true;
    targetAdmin.deletedAt = new Date();
    targetAdmin.deletedBy = req.user._id;
    targetAdmin.deleteReason = req.body.reason || 'Deleted by superadmin';
    targetAdmin.adminDeactivated = true;
    targetAdmin.adminDeactivatedAt = new Date();
    
    await invalidateUserTokens(targetAdmin._id);
    await targetAdmin.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'DELETE_ADMIN',
      actionLabel: 'Delete Admin',
      targetType: 'Admin',
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
      targetEmail: targetAdmin.email,
      description: `Soft deleted admin ${targetAdmin.email}`,
      reason: targetAdmin.deleteReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        deleteReason: targetAdmin.deleteReason,
        deletedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: 'Admin soft deleted successfully',
      admin: {
        _id: targetAdmin._id,
        email: targetAdmin.email,
        role: targetAdmin.role,
        isDeleted: true,
        deletedAt: targetAdmin.deletedAt
      }
    });

  } catch (err) {
    console.error('DELETE ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete admin' 
    });
  }
};

/* ========================
   7️⃣ PERMANENTLY DELETE ACCOUNT (SUPER ADMIN ONLY)
======================== */
exports.permanentlyDeleteAccount = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can permanently delete accounts' 
      });
    }

    const account = await User.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    if (isFounder(account)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Founder account cannot be deleted' 
      });
    }

    if (!req.body.confirm || req.body.confirm !== 'PERMANENTLY_DELETE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Confirmation required. Send { confirm: "PERMANENTLY_DELETE" } in request body.' 
      });
    }

    const accountInfo = {
      email: account.email,
      name: account.name,
      role: account.role,
      deletedAt: new Date()
    };

    const actionType = ADMIN_ROLES.includes(account.role) ? 'PERMANENT_DELETE_ADMIN' : 'PERMANENT_DELETE_ACCOUNT';
    const actionLabel = ADMIN_ROLES.includes(account.role) ? 'Permanently Delete Admin' : 'Permanently Delete Account';
    const targetType = ADMIN_ROLES.includes(account.role) ? 'Admin' : 'User';

    await logAdminAction({
      admin: req.user,
      actionType,
      actionLabel,
      targetType,
      targetId: account._id,
      targetName: account.name || account.email,
      targetEmail: account.email,
      description: `Permanently deleted ${targetType.toLowerCase()} ${account.email}`,
      reason: req.body.reason || 'Permanently deleted by superadmin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        ...accountInfo,
        permanentlyDeletedBy: req.user.email 
      }
    });

    await account.deleteOne();

    res.json({ 
      success: true, 
      message: 'Account permanently deleted',
      deletedAccount: accountInfo
    });

  } catch (err) {
    console.error('PERMANENT DELETE ACCOUNT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to permanently delete account: ' + err.message 
    });
  }
};

/* ========================
   8️⃣ DELETE USER (SUPER ADMIN ONLY)
======================== */
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can delete users' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (ADMIN_ROLES.includes(user.role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete admin users with this route. Use admin deletion routes instead.' 
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already deleted' 
      });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user._id;
    user.deleteReason = req.body.reason || 'Deleted by superadmin';
    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    
    await invalidateUserTokens(user._id);
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'DELETE_USER',
      actionLabel: 'Delete User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Soft deleted user ${user.email}`,
      reason: user.deleteReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        deleteReason: user.deleteReason,
        deletedBy: req.user.email 
      }
    });

    res.json({ 
      success: true, 
      message: 'User soft deleted successfully',
      user: {
        _id: user._id,
        email: user.email,
        isDeleted: true,
        deletedAt: user.deletedAt
      }
    });

  } catch (err) {
    console.error('DELETE USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user: ' + err.message 
    });
  }
};

/* ========================
   9️⃣ BAN USER (ALL ADMINS)
======================== */
exports.banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(400).json({ success: false, message: 'User is already banned' });
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedBy = req.user._id;
    user.banReason = req.body.reason || 'Banned by admin';
    await user.save();

    await invalidateUserTokens(user._id);

    await logAdminAction({
      admin: req.user,
      actionType: 'BAN_USER',
      actionLabel: 'Ban User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Banned user ${user.email}`,
      reason: user.banReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        bannedBy: req.user.email
      }
    });

    res.json({ success: true, message: 'User banned and logged out successfully' });
  } catch (err) {
    console.error('BAN USER ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
};

/* ========================
   10️⃣ UNBAN USER (ALL ADMINS)
======================== */
exports.unbanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.isBanned) {
      return res.status(400).json({ success: false, message: 'User is not banned' });
    }

    user.isBanned = false;
    user.bannedAt = null;
    user.bannedBy = null;
    user.banReason = null;
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'UNBAN_USER',
      actionLabel: 'Unban User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Unbanned user ${user.email}`,
      reason: req.body.reason || 'Unbanned by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        unbannedBy: req.user.email
      }
    });

    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (err) {
    console.error('UNBAN USER ERROR:', err);
    res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
};

/* ========================
   11️⃣ APPROVE VIDEO (ALL ADMINS) - FIXED
======================== */
exports.approveVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.status = 'approved';
    video.approved = true;
    video.rejected = false;
    video.rejectionReason = null;
    video.rejectionDetails = null;
    video.approvedBy = req.user._id;
    video.approvedAt = new Date();
    
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'APPROVE_VIDEO',
      actionLabel: 'Approve Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Approved video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        approvedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video approved successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status
      }
    });
  } catch (err) {
    console.error('APPROVE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve video' 
    });
  }
};

/* ========================
   12️⃣ REJECT VIDEO (ALL ADMINS) - FIXED
======================== */
exports.rejectVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rejection reason is required' 
      });
    }

    video.status = 'rejected';
    video.approved = false;
    video.rejected = true;
    video.rejectionReason = reason.trim();
    video.rejectionDetails = reason.trim();
    
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REJECT_VIDEO',
      actionLabel: 'Reject Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Rejected video "${video.title}"`,
      reason: reason.trim(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        rejectedBy: req.user.email,
        rejectionReason: reason.trim()
      }
    });

    res.json({ 
      success: true, 
      message: 'Video rejected successfully',
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        rejectionReason: video.rejectionReason
      }
    });
  } catch (err) {
    console.error('REJECT VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject video' 
    });
  }
};

/* ========================
   13️⃣ REMOVE VIDEO (ALL ADMINS)
======================== */
exports.removeVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.isDeleted = true;
    video.deletedAt = new Date();
    video.deletedBy = req.user._id;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_VIDEO',
      actionLabel: 'Remove Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Removed video "${video.title}"`,
      reason: req.body.reason || 'Removed by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        removedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video removed successfully' 
    });
  } catch (err) {
    console.error('REMOVE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove video' 
    });
  }
};

/* ========================
   14️⃣ RESTORE VIDEO (ALL ADMINS)
======================== */
exports.restoreVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.isDeleted = false;
    video.deletedAt = null;
    video.deletedBy = null;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'RESTORE_VIDEO',
      actionLabel: 'Restore Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Restored video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        restoredBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video restored successfully' 
    });
  } catch (err) {
    console.error('RESTORE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore video' 
    });
  }
};

/* ========================
   15️⃣ FEATURE VIDEO (ALL ADMINS)
======================== */
exports.featureVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.isFeatured = true;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'FEATURE_VIDEO',
      actionLabel: 'Feature Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Featured video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        featuredBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video featured successfully' 
    });
  } catch (err) {
    console.error('FEATURE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to feature video' 
    });
  }
};

/* ========================
   16️⃣ UNFEATURE VIDEO (ALL ADMINS)
======================== */
exports.unfeatureVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found' 
      });
    }

    video.isFeatured = false;
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'UNFEATURE_VIDEO',
      actionLabel: 'Unfeature Video',
      targetType: 'Video',
      targetId: video._id,
      targetName: video.title,
      description: `Unfeatured video "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        unfeaturedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Video unfeatured successfully' 
    });
  } catch (err) {
    console.error('UNFEATURE VIDEO ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unfeature video' 
    });
  }
};

/* ========================
   17️⃣ APPROVE FUNDRAISER (ALL ADMINS)
======================== */
exports.approveFundraiser = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fundraiser video not found' 
      });
    }

    video.approved = true;
    video.rejected = false;
    video.rejectionReason = null;
    video.approvedBy = req.user._id;
    video.approvedAt = new Date();
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'APPROVE_FUNDRAISER',
      actionLabel: 'Approve Fundraiser',
      targetType: 'Fundraiser',
      targetId: video._id,
      targetName: video.title,
      description: `Approved fundraiser "${video.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        approvedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Fundraiser approved successfully' 
    });
  } catch (err) {
    console.error('APPROVE FUNDRAISER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to approve fundraiser' 
    });
  }
};

/* ========================
   18️⃣ REJECT FUNDRAISER (ALL ADMINS)
======================== */
exports.rejectFundraiser = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fundraiser video not found' 
      });
    }

    const { reason } = req.body;
    video.approved = false;
    video.rejected = true;
    video.rejectionReason = reason || 'Rejected by admin';
    await video.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REJECT_FUNDRAISER',
      actionLabel: 'Reject Fundraiser',
      targetType: 'Fundraiser',
      targetId: video._id,
      targetName: video.title,
      description: `Rejected fundraiser "${video.title}"`,
      reason: video.rejectionReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        videoTitle: video.title,
        rejectedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Fundraiser rejected successfully' 
    });
  } catch (err) {
    console.error('REJECT FUNDRAISER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject fundraiser' 
    });
  }
};

/* ========================
   19️⃣ VERIFY USER (ALL ADMINS)
======================== */
exports.verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already verified' 
      });
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifiedBy = req.user._id;
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'VERIFY_USER',
      actionLabel: 'Verify User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Verified user ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        verifiedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'User verified successfully' 
    });
  } catch (err) {
    console.error('VERIFY USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify user' 
    });
  }
};

/* ========================
   20️⃣ UNVERIFY USER (ALL ADMINS)
======================== */
exports.unverifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not verified' 
      });
    }

    user.isVerified = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'UNVERIFY_USER',
      actionLabel: 'Unverify User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Unverified user ${user.email}`,
      reason: req.body.reason || 'Unverified by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        unverifiedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'User unverified successfully' 
    });
  } catch (err) {
    console.error('UNVERIFY USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unverify user' 
    });
  }
};

/* ========================
   21️⃣ GET ALL ADMINS
======================== */
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ADMIN_ROLES },
      isDeleted: { $ne: true }
    }).select('-password').sort({ createdAt: -1 });

    const adminsWithStatus = admins.map(admin => ({
      ...admin.toObject(),
      isActive: !admin.adminDeactivated
    }));

    res.json({ 
      success: true, 
      admins: adminsWithStatus 
    });
  } catch (err) {
    console.error('GET ALL ADMINS ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch admins' 
    });
  }
};

/* ========================
   22️⃣ GET INACTIVE ADMINS
======================== */
exports.getInactiveAdmins = async (req, res) => {
  try {
    const inactiveAdmins = await User.find({
      role: { $in: ADMIN_ROLES },
      adminDeactivated: true,
      isDeleted: { $ne: true }
    }).select('-password');
    
    res.json({ 
      success: true, 
      admins: inactiveAdmins 
    });
  } catch (err) {
    console.error('GET INACTIVE ADMINS ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch inactive admins' 
    });
  }
};

/* ========================
   23️⃣ GET ALL USERS
======================== */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $nin: ADMIN_ROLES },
      isDeleted: { $ne: true }
    }).select('-password').sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      users 
    });
  } catch (err) {
    console.error('GET ALL USERS ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users' 
    });
  }
};

/* ========================
   24️⃣ GET USER BY ID
======================== */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    res.json({ 
      success: true, 
      user 
    });
  } catch (err) {
    console.error('GET USER BY ID ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user' 
    });
  }
};

/* ========================
   25️⃣ DEACTIVATE USER (SUPER ADMIN ONLY)
======================== */
exports.deactivateUser = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can deactivate users' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.isDeactivated) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already deactivated' 
      });
    }

    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    user.deactivatedBy = req.user._id;
    user.deactivationReason = req.body.reason || 'Deactivated by superadmin';
    await user.save();

    await invalidateUserTokens(user._id);

    await logAdminAction({
      admin: req.user,
      actionType: 'DEACTIVATE_USER',
      actionLabel: 'Deactivate User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Deactivated user ${user.email}`,
      reason: user.deactivationReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        deactivatedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'User deactivated and logged out successfully' 
    });
  } catch (err) {
    console.error('DEACTIVATE USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to deactivate user' 
    });
  }
};

/* ========================
   26️⃣ ACTIVATE USER (SUPER ADMIN ONLY)
======================== */
exports.activateUser = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only super admins can activate users' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isDeactivated) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already active' 
      });
    }

    user.isDeactivated = false;
    user.deactivatedAt = null;
    user.deactivatedBy = null;
    user.deactivationReason = null;
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'ACTIVATE_USER',
      actionLabel: 'Activate User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Activated user ${user.email}`,
      reason: req.body.reason || 'Activated by superadmin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        activatedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'User activated successfully' 
    });
    
  } catch (err) {
    console.error('ACTIVATE USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to activate user' 
    });
  }
};

/* ========================
   27️⃣ TOGGLE SUPPORT ADMIN (PLATFORM ADMIN ONLY)
======================== */
exports.toggleSupportAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'platformadmin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only platform admins can toggle support role' 
      });
    }

    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    if (admin.role !== 'platformadmin') {
      return res.status(400).json({
        success: false,
        message: 'Only platform admins can toggle support role',
      });
    }

    admin.isSupport = !admin.isSupport;
    await admin.save();

    await logAdminAction({
      admin: req.user,
      actionType: admin.isSupport ? 'TOGGLE_SUPPORT_ROLE' : 'TOGGLE_SUPPORT_ROLE',
      actionLabel: admin.isSupport ? 'Assign Support Role' : 'Revoke Support Role',
      targetType: 'Admin',
      targetId: admin._id,
      targetName: admin.name,
      targetEmail: admin.email,
      description: `${admin.isSupport ? 'Assigned' : 'Revoked'} support role for ${admin.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        isSupport: admin.isSupport,
        updatedBy: req.user.email
      }
    });

    res.json({
      success: true,
      message: 'Support role updated',
      isSupport: admin.isSupport,
    });
  } catch (err) {
    console.error('TOGGLE SUPPORT ADMIN ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update support role' 
    });
  }
};

/* ========================
   28️⃣ REMOVE COMMENT (ALL ADMINS)
======================== */
exports.removeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }

    await comment.deleteOne();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_COMMENT',
      actionLabel: 'Remove Comment',
      targetType: 'Comment',
      targetId: comment._id,
      description: 'Removed comment',
      reason: req.body.reason || 'Removed by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        removedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Comment removed successfully' 
    });
  } catch (err) {
    console.error('REMOVE COMMENT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove comment' 
    });
  }
};

/* ========================
   29️⃣ REMOVE LIVE STREAM (ALL ADMINS)
======================== */
exports.removeLiveStream = async (req, res) => {
  try {
    const live = await Live.findById(req.params.id);
    if (!live) {
      return res.status(404).json({ 
        success: false, 
        message: 'Live stream not found' 
      });
    }

    live.isDeleted = true;
    live.deletedAt = new Date();
    live.deletedBy = req.user._id;
    await live.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_LIVE',
      actionLabel: 'Remove Live Stream',
      targetType: 'LiveStream',
      targetId: live._id,
      targetName: live.title,
      description: `Removed live stream "${live.title}"`,
      reason: req.body.reason || 'Removed by admin',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        liveTitle: live.title,
        removedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Live stream removed successfully' 
    });
  } catch (err) {
    console.error('REMOVE LIVE STREAM ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove live stream' 
    });
  }
};

/* ========================
   30️⃣ APPLY SHADOW BAN USER (ALL ADMINS)
======================== */
exports.applyShadowBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const { countries = [], continents = [], reason } = req.body;

    user.isShadowBanned = true;
    user.shadowBannedCountries = countries;
    user.shadowBannedContinents = continents;
    user.shadowBanAppliedBy = req.user._id;
    user.shadowBanAppliedAt = new Date();
    user.shadowBanReason = reason || 'Shadow banned by admin';
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'SHADOW_BAN_USER',
      actionLabel: 'Shadow Ban User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Shadow banned user ${user.email}`,
      reason: user.shadowBanReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        countries,
        continents,
        shadowBannedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'User shadow banned successfully',
      user: {
        _id: user._id,
        isShadowBanned: true
      }
    });
  } catch (err) {
    console.error('APPLY SHADOW BAN USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to apply shadow ban' 
    });
  }
};

/* ========================
   31️⃣ REMOVE SHADOW BAN USER (ALL ADMINS)
======================== */
exports.removeShadowBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.isShadowBanned = false;
    user.shadowBannedCountries = [];
    user.shadowBannedContinents = [];
    user.shadowBanAppliedBy = null;
    user.shadowBanAppliedAt = null;
    user.shadowBanReason = null;
    await user.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_SHADOW_BAN_USER',
      actionLabel: 'Remove Shadow Ban User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name || user.email,
      targetEmail: user.email,
      description: `Removed shadow ban for user ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        shadowBanRemovedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Shadow ban removed successfully',
      user: {
        _id: user._id,
        isShadowBanned: false
      }
    });
  } catch (err) {
    console.error('REMOVE SHADOW BAN USER ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove shadow ban' 
    });
  }
};

/* ========================
   32️⃣ APPLY SHADOW BAN CONTENT (ALL ADMINS)
======================== */
exports.applyShadowBanContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetType, countries = [], continents = [], reason } = req.body;

    if (!targetType || !['Video', 'LiveStream', 'Comment'].includes(targetType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'targetType must be Video, LiveStream, or Comment' 
      });
    }

    let content;
    switch (targetType) {
      case 'Video':
        content = await Video.findById(id);
        break;
      case 'LiveStream':
        content = await Live.findById(id);
        break;
      case 'Comment':
        content = await Comment.findById(id);
        break;
    }

    if (!content) {
      return res.status(404).json({ 
        success: false, 
        message: `${targetType} not found` 
      });
    }

    content.isShadowBanned = true;
    content.shadowBannedCountries = countries;
    content.shadowBannedContinents = continents;
    content.shadowBanAppliedBy = req.user._id;
    content.shadowBanAppliedAt = new Date();
    content.shadowBanReason = reason || 'Shadow banned by admin';
    await content.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'SHADOW_BAN_CONTENT',
      actionLabel: 'Shadow Ban Content',
      targetType,
      targetId: content._id,
      targetName: content.title || content.text?.substring(0, 50) || `Content ${id}`,
      description: `Applied shadow ban to ${targetType.toLowerCase()}`,
      reason: content.shadowBanReason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        targetType,
        countries,
        continents,
        shadowBannedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: `${targetType} shadow banned successfully`,
      content: {
        _id: content._id,
        isShadowBanned: true
      }
    });
  } catch (err) {
    console.error('APPLY SHADOW BAN CONTENT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to apply shadow ban to content' 
    });
  }
};

/* ========================
   33️⃣ REMOVE SHADOW BAN CONTENT (ALL ADMINS)
======================== */
exports.removeShadowBanContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetType } = req.body;

    if (!targetType || !['Video', 'LiveStream', 'Comment'].includes(targetType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'targetType must be Video, LiveStream, or Comment' 
      });
    }

    let content;
    switch (targetType) {
      case 'Video':
        content = await Video.findById(id);
        break;
      case 'LiveStream':
        content = await Live.findById(id);
        break;
      case 'Comment':
        content = await Comment.findById(id);
        break;
    }

    if (!content) {
      return res.status(404).json({ 
        success: false, 
        message: `${targetType} not found` 
      });
    }

    content.isShadowBanned = false;
    content.shadowBannedCountries = [];
    content.shadowBannedContinents = [];
    content.shadowBanAppliedBy = null;
    content.shadowBanAppliedAt = null;
    content.shadowBanReason = null;
    await content.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'REMOVE_SHADOW_BAN_CONTENT',
      actionLabel: 'Remove Shadow Ban Content',
      targetType,
      targetId: content._id,
      targetName: content.title || content.text?.substring(0, 50) || `Content ${id}`,
      description: `Removed shadow ban from ${targetType.toLowerCase()}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        targetType,
        shadowBanRemovedBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: `Shadow ban removed from ${targetType}`,
      content: {
        _id: content._id,
        isShadowBanned: false
      }
    });
  } catch (err) {
    console.error('REMOVE SHADOW BAN CONTENT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove shadow ban from content' 
    });
  }
};

/* ========================
   34️⃣ FORCE ADMIN LOGOUT (ALL ADMINS)
======================== */
exports.forceAdminLogout = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    target.tokenVersion = (target.tokenVersion || 0) + 1;
    target.online = false;
    await target.save();

    await logAdminAction({
      admin: req.user,
      actionType: 'FORCE_ADMIN_LOGOUT',
      actionLabel: 'Force Admin Logout',
      targetType: 'Admin',
      targetId: target._id,
      targetName: target.name,
      targetEmail: target.email,
      description: `Forced logout for admin ${target.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        forcedLogoutBy: req.user.email
      }
    });

    res.json({ 
      success: true, 
      message: 'Admin force logged out successfully' 
    });
  } catch (err) {
    console.error('FORCE ADMIN LOGOUT ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to force logout admin' 
    });
  }
};

/* ========================
   35️⃣ GET ADMIN AUDIT LOGS (LEGACY)
======================== */
exports.getAdminAuditLogs = async (req, res) => {
  try {
    const logs = await User.findById(req.user._id).select('adminActions');
    res.json({ 
      success: true, 
      logs: logs?.adminActions || [] 
    });
  } catch (err) {
    console.error('GET ADMIN AUDIT LOGS ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch audit logs' 
    });
  }
};

/* ========================
   EXPORTS - COMPLETE LIST
======================== */
module.exports = {
  // AUDIT LOGS
  getAuditLogs: exports.getAuditLogs,
  getRecentAuditLogs: exports.getRecentAuditLogs,
  getAuditFilterOptions: exports.getAuditFilterOptions,
  getAdminAuditLogs: exports.getAdminAuditLogs,
  
  // ADMIN MANAGEMENT
  createAdmin: exports.createAdmin,
  promoteAdmin: exports.promoteAdmin,
  demoteAdmin: exports.demoteAdmin,
  deactivateAdmin: exports.deactivateAdmin,
  reactivateAdmin: exports.reactivateAdmin,
  deleteAdmin: exports.deleteAdmin,
  permanentlyDeleteAccount: exports.permanentlyDeleteAccount,
  
  // ADMIN LISTING
  getAllAdmins: exports.getAllAdmins,
  getInactiveAdmins: exports.getInactiveAdmins,
  
  // USER MANAGEMENT
  getAllUsers: exports.getAllUsers,
  getUserById: exports.getUserById,
  deactivateUser: exports.deactivateUser,
  activateUser: exports.activateUser,
  deleteUser: exports.deleteUser,
  
  // USER MODERATION
  banUser: exports.banUser,
  unbanUser: exports.unbanUser,
  verifyUser: exports.verifyUser,
  unverifyUser: exports.unverifyUser,
  applyShadowBanUser: exports.applyShadowBanUser,
  removeShadowBanUser: exports.removeShadowBanUser,
  
  // ADMIN ROLE MANAGEMENT
  toggleSupportAdmin: exports.toggleSupportAdmin,
  
  // CONTENT MODERATION
  approveVideo: exports.approveVideo,
  rejectVideo: exports.rejectVideo,
  removeVideo: exports.removeVideo,
  restoreVideo: exports.restoreVideo,
  featureVideo: exports.featureVideo,
  unfeatureVideo: exports.unfeatureVideo,
  approveFundraiser: exports.approveFundraiser,
  rejectFundraiser: exports.rejectFundraiser,
  removeComment: exports.removeComment,
  removeLiveStream: exports.removeLiveStream,
  applyShadowBanContent: exports.applyShadowBanContent,
  removeShadowBanContent: exports.removeShadowBanContent,
  
  // AUDIT & ADMIN TOOLS
  forceAdminLogout: exports.forceAdminLogout
};