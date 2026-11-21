/**
 * File: backend/utils/liveAccess.js
 * Purpose: Single source of truth for live-stream security rules.
 *   - Generates the two SEPARATE tokens every stream has:
 *       streamKey  = SECRET ingest key (OBS/RTMP). Host-only. Never sent to viewers.
 *       playbackId = PUBLIC token used in the HLS URL that viewers watch.
 *   - Builds HLS / RTMP URLs.
 *   - Decides who may watch a stream (age rating + regional blocks).
 *   - Serialises a Live document into a safe API object (whitelist, not spread).
 *   - Tracks anonymous (guest) viewers in memory with a size cap and TTL.
 */

'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────

// Both tokens are lowercase hex (streamKey = 40 chars, playbackId = 32 chars).
// Validating the format before any filesystem use blocks path traversal.
const TOKEN_RE = /^[a-f0-9]{32,64}$/;

const generateStreamKey = () => crypto.randomBytes(20).toString('hex');
const generatePlaybackId = () => crypto.randomBytes(16).toString('hex');
const isValidToken = (value) => typeof value === 'string' && TOKEN_RE.test(value);

// ─────────────────────────────────────────────
// URLS
// ─────────────────────────────────────────────

const trimSlash = (s) => String(s).replace(/\/+$/, '');

const getHlsBase = () => trimSlash(process.env.HLS_SERVER_URL || 'http://localhost:5000');
const getRtmpBase = () => trimSlash(process.env.RTMP_SERVER_URL || 'rtmp://localhost:1935/live');

/** Public HLS URL. Built ONLY from the playbackId, never from the stream key. */
const buildHlsUrl = (playbackId) => `${getHlsBase()}/live/${playbackId}/index.m3u8`;

/** Full RTMP publish URL (contains the secret key — host-only). */
const buildRtmpUrl = (streamKey) => `${getRtmpBase()}/${streamKey}`;

// ─────────────────────────────────────────────
// ACCESS RULES (age rating + regional blocks)
// ─────────────────────────────────────────────

const MIN_AGE_BY_RATING = {
  G: 0,
  PG: 0,
  'PG-13': 13,
  '13+': 13,
  '16+': 16,
  R: 18,
  'NC-17': 18,
  '18+': 18,
};

const calcAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

/**
 * Decide whether `user` (or an anonymous guest when user is falsy) may watch `live`.
 * Hosts and admins bypass this (pass { bypass: true }).
 * Returns { allowed, code?, message? }.
 */
const evaluateAccess = (live, user, { bypass = false } = {}) => {
  if (bypass) return { allowed: true };

  const minAge = MIN_AGE_BY_RATING[live.ageRating] ?? 0;

  // Guests cannot prove their age, so mature content requires a login.
  if (!user && minAge >= 16) {
    return {
      allowed: false,
      code: 'LOGIN_REQUIRED',
      message: 'Please log in to watch this stream.',
    };
  }

  if (user && minAge > 0) {
    const age = calcAge(user.dateOfBirth);
    // Unknown age on a 16+/18+ stream is treated as restricted (fail closed).
    if (age === null ? minAge >= 16 : age < minAge) {
      return {
        allowed: false,
        code: 'AGE_RESTRICTED',
        message: `This stream is restricted to viewers aged ${minAge}+.`,
      };
    }
  }

  if (user) {
    const blockedCountries = Array.isArray(live.blockedCountries) ? live.blockedCountries : [];
    const blockedContinents = Array.isArray(live.blockedContinents) ? live.blockedContinents : [];
    if (
      (user.country && blockedCountries.includes(user.country)) ||
      (user.continent && blockedContinents.includes(user.continent))
    ) {
      return {
        allowed: false,
        code: 'REGION_BLOCKED',
        message: 'This stream is not available in your region.',
      };
    }
  }

  return { allowed: true };
};

// ─────────────────────────────────────────────
// SERIALISER  (whitelist — never spread a DB document into a response)
// ─────────────────────────────────────────────

/**
 * @param {object} live  Live document or lean object
 * @param {object} opts
 *   isHost        true only when the requester is the host
 *   viewerCount   total viewers (users + guests)
 *   streamKey     SECRET ingest key — only honoured when isHost is true
 *   rtmpUrl       SECRET publish URL — only honoured when isHost is true
 *   allowPlayback false hides every playback field (access denied)
 */
const serializeLive = (live, opts = {}) => {
  const { isHost = false, viewerCount, streamKey, rtmpUrl, allowPlayback = true } = opts;

  const playbackId = live.playbackId || null;
  const canPlay = allowPlayback && !!playbackId;
  const hlsUrl = canPlay ? buildHlsUrl(playbackId) : null;
  const isLiveNow = live.status === 'live';

  const out = {
    _id: live._id,
    title: live.title,
    description: live.description,
    thumbnailUrl: live.thumbnailUrl,
    host: live.host,
    status: live.status,
    isLive: isLiveNow,
    approved: live.approved,
    startedAt: live.startedAt,
    endedAt: live.endedAt,
    duration: live.duration,
    scheduledAt: live.scheduledAt,
    viewerCount: viewerCount ?? live.viewers?.length ?? 0,
    peakViewers: live.peakViewers,
    totalViews: live.totalViews,
    chatEnabled: live.chatEnabled,
    chatSlowMode: live.chatSlowMode,
    category: live.category,
    tags: live.tags,
    ageRating: live.ageRating,
    isFree: true,
    isHost,
    createdAt: live.createdAt,
    playbackId: canPlay ? playbackId : null,
    hlsUrl,
    playbackUrl: isLiveNow ? hlsUrl : null,
  };

  if (isHost) {
    // Host-only: the real ingest credentials + moderation notices.
    if (streamKey) out.streamKey = streamKey;
    if (rtmpUrl) out.rtmpUrl = rtmpUrl;
    out.rejected = !!live.rejected;
    out.removalReason = live.removalReason || '';
    out.adminEnded = !!live.adminEnded;
    out.adminEndedReason = live.adminEndedReason || '';
  } else if (isLiveNow && canPlay) {
    // LEGACY COMPAT: the current LiveWatch.jsx builds its player URL from a
    // field named `streamKey`. For viewers we hand it the PUBLIC playbackId so
    // the old frontend keeps working without ever receiving the secret.
    // Remove this once the new frontend reads `playbackId` / `hlsUrl`.
    out.streamKey = playbackId;
    out.streamKeyIsPlaybackId = true;
  }

  return out;
};

// ─────────────────────────────────────────────
// GUEST VIEWER TRACKER (in-memory, capped, expiring)
// ─────────────────────────────────────────────

const GUEST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_GUESTS_PER_LIVE = 20000;

const guestViewers = new Map(); // liveId(string) -> Map(guestId -> firstSeenTimestamp)

const trackGuestViewer = (liveId, guestId) => {
  const key = String(liveId);
  let bucket = guestViewers.get(key);
  if (!bucket) {
    bucket = new Map();
    guestViewers.set(key, bucket);
  }
  if (bucket.has(guestId)) return { isNew: false, count: bucket.size };
  if (bucket.size >= MAX_GUESTS_PER_LIVE) return { isNew: false, count: bucket.size };
  bucket.set(guestId, Date.now());
  return { isNew: true, count: bucket.size };
};

const getGuestViewerCount = (liveId) => guestViewers.get(String(liveId))?.size || 0;

const clearGuestViewers = (liveId) => {
  guestViewers.delete(String(liveId));
};

// Periodic cleanup so abandoned streams never leak memory.
setInterval(() => {
  const cutoff = Date.now() - GUEST_TTL_MS;
  for (const [liveId, bucket] of guestViewers.entries()) {
    for (const [guestId, ts] of bucket.entries()) {
      if (ts < cutoff) bucket.delete(guestId);
    }
    if (bucket.size === 0) guestViewers.delete(liveId);
  }
}, 30 * 60 * 1000).unref();

module.exports = {
  generateStreamKey,
  generatePlaybackId,
  isValidToken,
  buildHlsUrl,
  buildRtmpUrl,
  getRtmpBase,
  calcAge,
  evaluateAccess,
  serializeLive,
  trackGuestViewer,
  getGuestViewerCount,
  clearGuestViewers,
};

// ═══ END OF FILE: backend/utils/liveAccess.js ═══