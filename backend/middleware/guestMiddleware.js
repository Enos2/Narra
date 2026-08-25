/**
 * guestMiddleware.js
 * Middleware for handling guest mode requests
 * Validates guest sessions and applies rate limiting
 */

const crypto = require('crypto');

// Guest session cache (in production, use Redis)
const guestSessions = new Map();

// Clean up old sessions every hour
setInterval(() => {
  const now = Date.now();
  const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
  for (const [key, session] of guestSessions.entries()) {
    if (now - session.createdAt > expiryTime) {
      guestSessions.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Validate a guest session ID
 */
const validateGuestSession = (guestId) => {
  if (!guestId || typeof guestId !== 'string') return false;
  
  // Check format: guest_timestamp_random1_random2_random3
  const parts = guestId.split('_');
  if (parts.length < 4) return false;
  
  const timestamp = parseInt(parts[1]);
  if (isNaN(timestamp) || timestamp <= 0) return false;
  
  // Session expires after 24 hours
  const expiryTime = 24 * 60 * 60 * 1000;
  return (Date.now() - timestamp) < expiryTime;
};

/**
 * Generate a new guest session
 */
const generateGuestSession = () => {
  const timestamp = Date.now();
  const random1 = crypto.randomBytes(8).toString('hex');
  const random2 = crypto.randomBytes(8).toString('hex');
  const random3 = crypto.randomBytes(8).toString('hex');
  return `guest_${timestamp}_${random1}_${random2}_${random3}`;
};

/**
 * Guest authentication middleware
 * Identifies guest users by X-Guest-ID header
 */
const guestAuth = async (req, res, next) => {
  const guestId = req.headers['x-guest-id'];
  
  if (!guestId) {
    req.isGuest = false;
    req.guestId = null;
    return next();
  }
  
  // Validate guest session
  if (!validateGuestSession(guestId)) {
    req.isGuest = false;
    req.guestId = null;
    return next();
  }
  
  // Track guest session
  if (!guestSessions.has(guestId)) {
    guestSessions.set(guestId, {
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requests: 0,
      requestTimestamps: [],
      actions: {},
    });
  }
  
  const session = guestSessions.get(guestId);
  session.lastActivity = Date.now();
  session.requests += 1;
  
  // Clean up old request timestamps
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  session.requestTimestamps = session.requestTimestamps.filter(
    (ts) => ts > now - windowMs
  );
  session.requestTimestamps.push(now);
  
  req.isGuest = true;
  req.guestId = guestId;
  req.guestSession = session;
  
  next();
};

/**
 * Guest rate limiter
 * Limits guest requests to prevent abuse
 */
const guestRateLimiter = (maxRequests = 60, windowMs = 60000) => {
  return (req, res, next) => {
    // Skip if not a guest
    if (!req.isGuest) {
      return next();
    }
    
    const guestId = req.guestId;
    const session = guestSessions.get(guestId);
    
    if (!session) {
      return next();
    }
    
    // Check rate limit
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Count requests in current window
    const requestCount = session.requestTimestamps.filter(
      (ts) => ts > windowStart
    ).length;
    
    if (requestCount >= maxRequests) {
      console.log(`⏱️ Guest rate limit exceeded: ${guestId}`);
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((session.requestTimestamps[0] + windowMs - now) / 1000),
      });
    }
    
    next();
  };
};

/**
 * Guest action limiter
 * Limits specific guest actions (like, comment, etc.)
 */
const guestActionLimiter = (actionType, maxPerHour = 10) => {
  return (req, res, next) => {
    if (!req.isGuest) {
      return next();
    }
    
    const guestId = req.guestId;
    const session = guestSessions.get(guestId);
    
    if (!session) {
      return next();
    }
    
    const key = `action_${actionType}`;
    const now = Date.now();
    const windowMs = 3600000; // 1 hour
    
    if (!session.actions) {
      session.actions = {};
    }
    
    if (!session.actions[key]) {
      session.actions[key] = [];
    }
    
    // Clean old entries
    session.actions[key] = session.actions[key].filter(
      (ts) => ts > now - windowMs
    );
    
    if (session.actions[key].length >= maxPerHour) {
      console.log(`⏱️ Guest action limit exceeded: ${guestId} - ${actionType}`);
      return res.status(429).json({
        success: false,
        message: `Too many ${actionType} actions. Please try again later.`,
      });
    }
    
    // Add current action
    session.actions[key].push(now);
    
    next();
  };
};

/**
 * Check if guest can perform an action (lightweight check)
 */
const canGuestPerformAction = (req, actionType, maxPerHour = 10) => {
  if (!req.isGuest) return true;
  
  const guestId = req.guestId;
  const session = guestSessions.get(guestId);
  
  if (!session) return true;
  
  const key = `action_${actionType}`;
  const now = Date.now();
  const windowMs = 3600000; // 1 hour
  
  if (!session.actions) {
    session.actions = {};
  }
  
  if (!session.actions[key]) {
    session.actions[key] = [];
  }
  
  // Clean old entries
  session.actions[key] = session.actions[key].filter(
    (ts) => ts > now - windowMs
  );
  
  return session.actions[key].length < maxPerHour;
};

/**
 * Guest session info middleware
 * Adds guest session info to response locals
 */
const guestSessionInfo = (req, res, next) => {
  if (req.isGuest && req.guestId) {
    res.locals.guestId = req.guestId;
    res.locals.isGuest = true;
  } else {
    res.locals.isGuest = false;
  }
  next();
};

module.exports = {
  guestAuth,
  guestRateLimiter,
  guestActionLimiter,
  canGuestPerformAction,
  guestSessionInfo,
  validateGuestSession,
  generateGuestSession,
};