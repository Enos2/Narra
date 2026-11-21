/**
 * File: backend/middleware/sanitizeInput.js
 * Purpose: Defend against NoSQL operator injection and prototype pollution in
 *   JSON request bodies.
 *
 *   - Removes any key that starts with "$" (e.g. {"email": {"$ne": null}} would
 *     otherwise reach a Mongo query as an operator).
 *   - Removes "__proto__", "constructor" and "prototype" keys.
 *   - Limits nesting depth so a hostile body cannot blow the call stack.
 *
 * Express 5's default "simple" query parser never produces nested objects, so
 * only the JSON body needs cleaning.
 */

'use strict';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 12;

const clean = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }

  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || BLOCKED_KEYS.has(key)) continue;
      out[key] = clean(value[key], depth + 1);
    }
    return out;
  }

  return value;
};

const sanitizeInput = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body);
  }
  next();
};

module.exports = sanitizeInput;

// ═══ END OF FILE: backend/middleware/sanitizeInput.js ═══