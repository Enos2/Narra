/**
 * File: backend/middleware/rateLimiters.js
 * Purpose: IP-based rate limiters for the HTTP API.
 *
 * Why: the only limiter that existed was the guest limiter, and it is skipped
 * entirely when a client omits or rotates the X-Guest-ID header, so login,
 * registration and password reset could be brute-forced without limit.
 *
 * Requires `app.set('trust proxy', ...)` behind Render/any reverse proxy so
 * req.ip is the real client address (configured in server.js).
 */

'use strict';

const rateLimit = require('express-rate-limit');

const make = ({ windowMs, limit, message, skipSuccessfulRequests = false, skip }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip,
    handler: (_req, res) => res.status(429).json({ success: false, message }),
  });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Whole API — generous, just stops floods / scraping from one address.
const apiLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 1500,
  message: 'Too many requests. Please slow down and try again shortly.',
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
});

// Failed logins only (successful ones are not counted).
const loginLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 15,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const adminLoginLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 8,
  skipSuccessfulRequests: true,
  message: 'Too many admin login attempts. Please try again in 15 minutes.',
});

const registerLimiter = make({
  windowMs: HOUR,
  limit: 10,
  message: 'Too many sign-ups from this network. Please try again later.',
});

const passwordLimiter = make({
  windowMs: HOUR,
  limit: 8,
  message: 'Too many password requests. Please try again later.',
});

module.exports = { apiLimiter, loginLimiter, adminLoginLimiter, registerLimiter, passwordLimiter };

// ═══ END OF FILE: backend/middleware/rateLimiters.js ═══