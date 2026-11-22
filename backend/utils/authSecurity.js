/**
 * File: backend/utils/authSecurity.js
 * Purpose: Shared authentication-security helpers.
 *   - Input normalisation / type checks (prevents crashes and injection when a
 *     client sends objects or arrays instead of strings).
 *   - Password policy (length, composition, common-password and
 *     personal-info checks).
 *   - Constant-time password verification (a missing account costs the same
 *     bcrypt work as a real one, so response time does not reveal which
 *     usernames / emails exist).
 *   - Brute-force throttle per (account + IP) and per account, plus a limit on
 *     password-reset e-mails per account.
 */

'use strict';

const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
// INPUT HELPERS
// ─────────────────────────────────────────────

const isString = (v) => typeof v === 'string';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

const isValidEmail = (v) => isString(v) && v.length <= 254 && EMAIL_RE.test(v.trim());
const isValidUsername = (v) => isString(v) && USERNAME_RE.test(v);

/** Trim + lowercase a login identifier (email or username). Null if invalid. */
const normalizeIdentifier = (v) => {
  if (!isString(v)) return null;
  const s = v.trim().toLowerCase();
  return s && s.length <= 254 ? s : null;
};

// ─────────────────────────────────────────────
// PASSWORD POLICY
// ─────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // bcrypt only uses 72 bytes; this also bounds CPU/body abuse

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1',
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321',
  'qwerty123', 'qwertyuiop', 'qwerty12', '1q2w3e4r', '1qaz2wsx', 'abc12345', 'abcd1234',
  'iloveyou', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'admin123', 'admin1234',
  'changeme', 'changeme1', 'monkey123', 'dragon123', 'football1', 'baseball1', 'superman1',
  'narra123', 'narra1234', 'narra2024', 'narra2025', 'narra2026', 'kenya2024', 'nairobi123',
]);

/**
 * @param {string} password
 * @param {{ email?: string, username?: string, firstName?: string, lastName?: string }} [ctx]
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePassword = (password, ctx = {}) => {
  if (!isString(password)) return { valid: false, message: 'Password is required.' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter and one number.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { valid: false, message: 'Password is too simple.' };
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return { valid: false, message: 'That password is too common. Choose something harder to guess.' };
  }

  const personal = [
    ctx.username,
    isString(ctx.email) ? ctx.email.split('@')[0] : null,
    ctx.firstName,
    ctx.lastName,
  ]
    .filter((p) => isString(p) && p.trim().length >= 4)
    .map((p) => p.trim().toLowerCase());

  if (personal.some((p) => lower.includes(p))) {
    return { valid: false, message: 'Password must not contain your name, username or email.' };
  }

  return { valid: true };
};

// ─────────────────────────────────────────────
// CONSTANT-TIME PASSWORD CHECK
// ─────────────────────────────────────────────

// Computed once at startup. Used when the account does not exist so the request
// still performs a full bcrypt comparison.
const DUMMY_HASH = bcrypt.hashSync('narra-dummy-password-for-timing', 12);

/**
 * @param {{ password?: string } | null} user  user document (or null)
 * @param {string} password                    candidate password
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (user, password) => {
  const hash = user && isString(user.password) && user.password ? user.password : DUMMY_HASH;
  let ok = false;
  try {
    ok = await bcrypt.compare(password, hash);
  } catch {
    ok = false;
  }
  return !!user && ok;
};

// ─────────────────────────────────────────────
// LOGIN THROTTLE (in memory; resets on restart)
// ─────────────────────────────────────────────

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_ACCOUNT_IP = 5; // one attacker hammering one account
const MAX_FAILS_PER_ACCOUNT = 30; // distributed attack on one account

const failures = new Map(); // key -> [timestamps]

const recent = (key) => {
  const now = Date.now();
  const list = (failures.get(key) || []).filter((t) => t > now - WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
};

const accountKey = (identifier) => `acct:${identifier}`;
const pairKey = (identifier, ip) => `pair:${identifier}|${ip}`;

/** @returns {{ locked: boolean, retryAfterSec: number }} */
const checkLoginThrottle = (identifier, ip) => {
  const pair = recent(pairKey(identifier, ip));
  const acct = recent(accountKey(identifier));

  let oldest = null;
  if (pair.length >= MAX_FAILS_PER_ACCOUNT_IP) oldest = pair[0];
  else if (acct.length >= MAX_FAILS_PER_ACCOUNT) oldest = acct[0];

  if (oldest === null) return { locked: false, retryAfterSec: 0 };
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000)) };
};

const recordLoginFailure = (identifier, ip) => {
  const now = Date.now();
  for (const key of [pairKey(identifier, ip), accountKey(identifier)]) {
    const list = failures.get(key) || [];
    list.push(now);
    failures.set(key, list);
  }
};

const clearLoginFailures = (identifier, ip) => {
  failures.delete(pairKey(identifier, ip)); // keep the account-wide count: it protects against distributed guessing
};

// Password-reset e-mails: at most 3 per account per hour (stops mail bombing).
const RESET_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESET_REQUESTS = 3;
const resetRequests = new Map(); // identifier -> [timestamps]

const allowPasswordResetRequest = (identifier) => {
  const now = Date.now();
  const list = (resetRequests.get(identifier) || []).filter((t) => t > now - RESET_WINDOW_MS);
  if (list.length >= MAX_RESET_REQUESTS) {
    resetRequests.set(identifier, list);
    return false;
  }
  list.push(now);
  resetRequests.set(identifier, list);
  return true;
};

setInterval(() => {
  for (const key of [...failures.keys()]) recent(key);
  const cutoff = Date.now() - RESET_WINDOW_MS;
  for (const [id, list] of [...resetRequests.entries()]) {
    const fresh = list.filter((t) => t > cutoff);
    if (fresh.length) resetRequests.set(id, fresh);
    else resetRequests.delete(id);
  }
}, 10 * 60 * 1000).unref();

module.exports = {
  isString,
  isValidEmail,
  isValidUsername,
  normalizeIdentifier,
  validatePassword,
  verifyPassword,
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginFailures,
  allowPasswordResetRequest,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};

// ═══ END OF FILE: backend/utils/authSecurity.js ═══