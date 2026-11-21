/**
 * File: backend/middleware/optionalAuth.js
 * Purpose: Identify the logged-in user on PUBLIC routes without ever rejecting
 *   the request. If a valid Bearer token is present (and the account is in good
 *   standing) `req.user` is set; otherwise the request continues as anonymous.
 *
 *   Why this exists: routes such as "join a live stream" must work for guests
 *   AND logged-in users. Previously they used only the guest middleware, so
 *   `req.user` was always undefined and the controllers crashed.
 *
 *   Unlike `protect`, this performs NO database writes (no lastActive updates),
 *   so it is cheap enough to run on high-traffic public endpoints.
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const FIELDS =
  'username firstName lastName avatar role isBanned isDeactivated adminDeactivated ' +
  'tokenVersion isShadowBanned dateOfBirth country continent canGoLive restrictions';

const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();

    const token = header.split(' ')[1];
    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(); // bad/expired token → treat as anonymous
    }

    const user = await User.findById(decoded.id).select(FIELDS).lean();
    if (!user) return next();

    // Same account-state rules as `protect`: a revoked/banned session is anonymous.
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) return next();
    if (user.isBanned || user.isDeactivated) return next();
    if (
      ['supportadmin', 'platformadmin', 'superadmin'].includes(user.role) &&
      user.adminDeactivated
    ) {
      return next();
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('optionalAuth error:', err.message);
    return next(); // never block a public route because of an auth lookup failure
  }
};

module.exports = optionalAuth;

// ═══ END OF FILE: backend/middleware/optionalAuth.js ═══