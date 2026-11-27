/**
 * File: backend/utils/videoAccess.js
 * Purpose: One place that decides WHO MAY SEE / WATCH a video, and a whitelist
 *   serializer that decides WHAT a response may contain.
 *
 * WHY: the public video endpoints used to return `{ ...video }` — the raw
 * database document. That exposed, to any visitor:
 *   - the direct file URL of PAID, PRIVATE and unpublished videos/episodes
 *     (anyone logged in could watch paid content without buying it),
 *   - the e-mail address of every creator AND of every user who liked/disliked
 *     a video,
 *   - the full list of buyers (`purchases`), ratings and internal fields.
 * Now a response is built field by field; the main file URL is included only
 * when the viewer is actually allowed to watch.
 */

'use strict';

const { evaluateAccess } = require('./liveAccess');

const ADMIN_ROLES = ['supportadmin', 'platformadmin', 'superadmin'];

/** Fields of a creator that may be shown publicly (never e-mail, balance, etc.). */
const CREATOR_PUBLIC_FIELDS = 'username firstName lastName avatar isVerified';

const isAdminUser = (user) => !!user && ADMIN_ROLES.includes(user.role);
const sameId = (a, b) => !!a && !!b && String(a) === String(b);
const creatorIdOf = (video) => String((video.creator && video.creator._id) || video.creator || '');

// Minimum age per rating (same table the live-stream rules use).
const MIN_AGE = { G: 0, PG: 0, 'PG-13': 13, '13+': 13, '16+': 16, R: 18, 'NC-17': 18, '18+': 18 };

/** Ratings a viewer may see listed. Guests / unknown age only see ≤13+. */
const allowedRatingsFor = (user) => {
  if (isAdminUser(user)) return Object.keys(MIN_AGE);
  let age = null;
  if (user && user.dateOfBirth) {
    const dob = new Date(user.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
    }
  }
  const limit = age === null ? 13 : age;
  return Object.entries(MIN_AGE)
    .filter(([, min]) => min <= limit && (age !== null || min <= 13))
    .map(([rating]) => rating);
};

const scheduledForLater = (video) =>
  video.releaseOption === 'schedule' &&
  video.scheduledReleaseDate &&
  new Date() < new Date(video.scheduledReleaseDate);

/**
 * @param {object} video     lean video (needs creator, status, isDeleted, isShadowBanned, isPrivate, ageRating,
 *                           isPaid, releaseOption, scheduledReleaseDate)
 * @param {object|null} user req.user (or null for guests)
 * @param {{ purchased?: boolean }} [opts]  whether this user already bought the video
 * @returns {{ visible, status?, code?, message?, requiresAuth?, canWatch, privileged, isCreator, isAdmin }}
 *   visible=false → respond with `status`/`message`; canWatch=false → listing only, no stream URL
 */
const evaluateVideoAccess = (video, user, { purchased = false } = {}) => {
  const admin = isAdminUser(user);
  const creator = !!user && sameId(creatorIdOf(video), user._id);
  const privileged = admin || creator;
  const hidden = (status, code, message, extra = {}) => ({
    visible: false, canWatch: false, privileged, isCreator: creator, isAdmin: admin, status, code, message, ...extra,
  });

  if (!video || video.isDeleted) return hidden(404, 'NOT_FOUND', 'Video unavailable');
  if (video.isShadowBanned && !admin) return hidden(404, 'NOT_FOUND', 'Video unavailable');
  if (video.status !== 'released' && !privileged) return hidden(404, 'NOT_FOUND', 'Video unavailable');
  if (scheduledForLater(video) && !privileged) return hidden(403, 'NOT_RELEASED', 'This video has not been released yet');
  if (video.isPrivate && !privileged) return hidden(403, 'PRIVATE', 'This video is private');

  const age = evaluateAccess({ ageRating: video.ageRating }, user, { bypass: privileged });
  if (!age.allowed) {
    return hidden(age.code === 'LOGIN_REQUIRED' ? 401 : 403, age.code, age.message, {
      requiresAuth: age.code === 'LOGIN_REQUIRED',
    });
  }

  const needsPurchase = !!video.isPaid && !privileged && !purchased;
  return {
    visible: true,
    canWatch: !needsPurchase,
    requiresAuth: needsPurchase && !user,
    privileged,
    isCreator: creator,
    isAdmin: admin,
    code: needsPurchase ? (user ? 'PAYMENT_REQUIRED' : 'LOGIN_REQUIRED') : undefined,
  };
};

// ─────────────────────────────────────────────
// SERIALISERS (whitelists)
// ─────────────────────────────────────────────

const pickCreator = (c) => {
  if (!c || typeof c !== 'object') return c || null;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || '';
  return {
    _id: c._id,
    username: c.username,
    firstName: c.firstName,
    lastName: c.lastName,
    name,
    avatar: c.avatar,
    isVerified: !!c.isVerified,
  };
};

const serializeEpisode = (e, { showUrl, privileged }) => {
  const out = {
    _id: e._id,
    episodeNumber: e.episodeNumber,
    title: e.title,
    description: e.description,
    thumbnailUrl: e.thumbnailUrl,
    trailerUrl: e.trailerUrl,
    duration: e.duration,
    price: e.price,
    published: !!e.published,
    views: e.views || 0,
    order: e.order,
  };
  if (showUrl && (e.published || privileged)) out.videoUrl = e.videoUrl;
  return out;
};

const serializeSeason = (s, { showUrl, privileged, withEpisodes }) => {
  const episodes = (s.episodes || []).filter((e) => privileged || e.published);
  const out = {
    _id: s._id,
    seasonNumber: s.seasonNumber,
    title: s.title,
    description: s.description,
    trailerUrl: s.trailerUrl,
    isPublished: !!s.isPublished,
    order: s.order,
    episodeCount: episodes.length,
  };
  if (withEpisodes) out.episodes = episodes.map((e) => serializeEpisode(e, { showUrl, privileged }));
  return out;
};

/**
 * @param {object} video   lean video (creator already reduced to public fields or an id)
 * @param {object} ctx     result of evaluateVideoAccess + extras
 *   ctx.includeStreamUrl  put the main file URL(s) in the response (only honoured when ctx.canWatch)
 *   ctx.withEpisodes      include each season's episode list (detail pages)
 *   ctx.counts            { likes, dislikes, ratings } when arrays were dropped for performance
 */
const serializeVideo = (video, ctx = {}) => {
  const { canWatch = false, privileged = false, includeStreamUrl = false, withEpisodes = false, counts = {} } = ctx;
  const showUrl = includeStreamUrl && canWatch;

  const visibleSeasons = (video.seasons || []).filter((s) => privileged || s.isPublished || (s.episodes || []).some((e) => e.published));

  const out = {
    _id: video._id,
    title: video.title,
    description: video.description,
    type: video.type,
    genre: video.genre,
    tags: video.tags,
    ageRating: video.ageRating,
    language: video.language,
    subtitles: video.subtitles,
    contentFlags: video.contentFlags,
    thumbnailUrl: video.thumbnailUrl,
    trailerUrl: video.trailerUrl, // trailers are public marketing material
    duration: video.duration,
    views: video.views || 0,
    likesCount: counts.likes ?? (video.likes ? video.likes.length : 0),
    dislikesCount: counts.dislikes ?? (video.dislikes ? video.dislikes.length : 0),
    averageRating: video.averageRating || 0,
    ratingCount: counts.ratings ?? (video.ratings ? video.ratings.length : 0),
    uploadedAt: video.uploadedAt,
    publishedAt: video.publishedAt,
    releasedAt: video.releasedAt,
    releaseOption: video.releaseOption,
    scheduledReleaseDate: video.scheduledReleaseDate,
    isPaid: !!video.isPaid,
    price: video.price,
    currency: video.currency,
    isSponsored: !!video.isSponsored,
    sponsorDescription: video.sponsorDescription,
    isFundraiser: !!video.isFundraiser,
    fundraiserDescription: video.fundraiserDescription,
    isPrivate: !!video.isPrivate,
    commentsDisabled: !!video.commentsDisabled,
    creator: pickCreator(video.creator),
    totalSeasons: video.type === 'series' ? visibleSeasons.length : undefined,
    totalEpisodes:
      video.type === 'series'
        ? visibleSeasons.reduce((n, s) => n + (s.episodes || []).filter((e) => privileged || e.published).length, 0)
        : undefined,
    canWatch,
    isFree: !video.isPaid,
    requiresPurchase: !!video.isPaid && !canWatch,
  };

  if (showUrl) out.videoUrl = video.videoUrl;

  if (video.type === 'series') {
    out.seasons = visibleSeasons.map((s) => serializeSeason(s, { showUrl, privileged, withEpisodes }));
  }

  if (privileged) {
    // Only the owner / admins see moderation state.
    out.status = video.status;
    out.approved = !!video.approved;
    out.released = !!video.released;
  }

  return out;
};

module.exports = {
  CREATOR_PUBLIC_FIELDS,
  ADMIN_ROLES,
  isAdminUser,
  sameId,
  allowedRatingsFor,
  evaluateVideoAccess,
  serializeVideo,
  serializeEpisode,
  pickCreator,
};

// ═══ END OF FILE: backend/utils/videoAccess.js ═══