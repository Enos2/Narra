/**
 * File: backend/middleware/messagingMiddleware.js
 * Description: Middleware for messaging-specific validations
 * - Age verification for minor/adult communication
 * - Permission checks
 */

const User = require('../models/User');
const Conversation = require('../models/Conversation');

/**
 * Helper function to calculate age from date of birth
 */
const calculateAge = (dob) => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Check if a user is a minor (< 18)
 */
const isMinor = (user) => {
  if (!user.dateOfBirth) return false; // Default to adult if no DOB
  const age = calculateAge(new Date(user.dateOfBirth));
  return age < 18;
};

/**
 * Middleware: Verify that a user can message another user based on age
 * This checks the minor/adult communication rules
 */
exports.canMessageUser = async (req, res, next) => {
  try {
    const sender = req.user;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required'
      });
    }

    // Don't allow messaging yourself
    if (sender._id.toString() === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself'
      });
    }

    // Get recipient user
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Check if recipient is deleted/banned/deactivated
    if (recipient.isDeleted || recipient.isBanned || recipient.isDeactivated) {
      return res.status(403).json({
        success: false,
        message: 'Cannot message this user'
      });
    }

    // Calculate ages
    const senderIsMinor = isMinor(sender);
    const recipientIsMinor = isMinor(recipient);

    // AGE VERIFICATION RULES
    // Rule 1: Minor → Minor (Allowed)
    // Rule 2: Adult → Adult (Allowed)
    // Rule 3: Minor → Adult (BLOCKED - must go through platform admin)
    // Rule 4: Adult → Minor (BLOCKED - must go through platform admin)

    if (senderIsMinor && !recipientIsMinor) {
      // Minor trying to message adult - BLOCKED
      return res.status(403).json({
        success: false,
        message: 'Minors cannot directly message adults. Please contact a Platform Admin to facilitate communication.',
        code: 'MINOR_TO_ADULT_BLOCKED',
        requiresApproval: true
      });
    }

    if (!senderIsMinor && recipientIsMinor) {
      // Adult trying to message minor - BLOCKED
      return res.status(403).json({
        success: false,
        message: 'Adults cannot directly message minors. Please contact a Platform Admin to facilitate communication.',
        code: 'ADULT_TO_MINOR_BLOCKED',
        requiresApproval: true
      });
    }

    // If we get here, the communication is allowed
    req.recipient = recipient;
    req.senderIsMinor = senderIsMinor;
    req.recipientIsMinor = recipientIsMinor;
    
    next();
  } catch (error) {
    console.error('❌ canMessageUser middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying messaging permissions',
      error: error.message
    });
  }
};

/**
 * Middleware: Check if user can access a conversation
 * - Must be a participant
 * - Not blocked
 */
exports.canAccessConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const conversationId = req.params.conversationId || req.body.conversationId;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is participant
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this conversation'
      });
    }

    // Check if user has blocked this conversation
    if (conversation.blockedBy.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You have blocked this conversation'
      });
    }

    req.conversation = conversation;
    next();
  } catch (error) {
    console.error('❌ canAccessConversation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying conversation access',
      error: error.message
    });
  }
};

/**
 * Middleware: Basic content moderation (keyword filtering)
 * This is Phase 1 - simple keyword blocking
 * Phase 3 will integrate AI moderation
 */
const blockedKeywords = [
  // Add your blocked words here
  'spam',
  'scam',
  // ... more keywords
];

exports.basicContentFilter = (req, res, next) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return next();
    }

    // Check for blocked keywords (case insensitive)
    const lowerContent = content.toLowerCase();
    const foundKeywords = blockedKeywords.filter(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length > 0) {
      // Flag the message but don't block it yet - just note for moderation
      req.body.moderationFlags = {
        automated: true,
        keywords: foundKeywords,
        confidence: 1.0
      };
      
      // Log for monitoring
      console.log(`⚠️ Message from ${req.user.email} contains blocked keywords:`, foundKeywords);
    }

    next();
  } catch (error) {
    console.error('❌ basicContentFilter middleware error:', error);
    next(); // Don't block on filter error
  }
};

/**
 * Middleware: Check if user can create support ticket
 */
exports.canCreateSupportTicket = async (req, res, next) => {
  try {
    const user = req.user;
    const { type } = req.body;

    // Minors cannot create direct support tickets
    // They must go through Platform Admin
    if (isMinor(user) && type !== 'minor-request') {
      return res.status(403).json({
        success: false,
        message: 'Minors must contact a Platform Admin for support',
        code: 'MINOR_SUPPORT_RESTRICTED'
      });
    }

    next();
  } catch (error) {
    console.error('❌ canCreateSupportTicket middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying support ticket permissions'
    });
  }
};

/**
 * Helper function exports for use in controllers
 */
exports.utils = {
  calculateAge,
  isMinor
};