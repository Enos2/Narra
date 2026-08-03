/**
 * File: backend/controllers/flagController.js
 * Description: Handles flag creation, escalation, and resolution.
 */

const Flag = require('../models/Flag');
const User = require('../models/User');

// ================================
// CREATE FLAG (ANY USER OR ADMIN)
// ================================
exports.createFlag = async (req, res) => {
  try {
    const { targetModel, targetId, reason, details } = req.body;

    const flag = await Flag.create({
      raisedBy: req.user._id,
      targetModel,
      targetId,
      reason,
      details,
    });

    res.status(201).json({ success: true, message: 'Flag created', flag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create flag' });
  }
};

// ================================
// GET FLAGS (ADMIN)
// ================================
exports.getFlags = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const flags = await Flag.find()
      .populate('raisedBy', 'name email role')
      .populate('assignedAdmin', 'name email role')
      .populate('escalatedBy', 'name email role')
      .populate('resolvedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, flags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch flags' });
  }
};

// ================================
// ASSIGN FLAG TO ADMIN
// ================================
exports.assignFlag = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const flag = await Flag.findById(req.params.id);
    if (!flag) return res.status(404).json({ success: false, message: 'Flag not found' });

    const { assignedAdminId } = req.body;

    flag.assignedAdmin = assignedAdminId;
    flag.updatedAt = new Date();
    await flag.save();

    res.status(200).json({ success: true, message: 'Flag assigned', flag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to assign flag' });
  }
};

// ================================
// ESCALATE FLAG (SUPPORT → PLATFORM/SUPER)
// ================================
exports.escalateFlag = async (req, res) => {
  try {
    if (!['supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only support admins can escalate' });
    }

    const flag = await Flag.findById(req.params.id);
    if (!flag) return res.status(404).json({ success: false, message: 'Flag not found' });

    flag.status = 'escalated';
    flag.escalatedBy = req.user._id;
    flag.updatedAt = new Date();
    await flag.save();

    res.status(200).json({ success: true, message: 'Flag escalated', flag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to escalate flag' });
  }
};

// ================================
// RESOLVE FLAG (ANY ADMIN)
// ================================
exports.resolveFlag = async (req, res) => {
  try {
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const flag = await Flag.findById(req.params.id);
    if (!flag) return res.status(404).json({ success: false, message: 'Flag not found' });

    const { resolutionNotes } = req.body;

    flag.status = 'resolved';
    flag.resolutionNotes = resolutionNotes || '';
    flag.resolvedBy = req.user._id;
    flag.updatedAt = new Date();
    await flag.save();

    res.status(200).json({ success: true, message: 'Flag resolved', flag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to resolve flag' });
  }
};
