/**
 * File: backend/controllers/videoPublicController.js
 * Purpose: Everything a viewer or a creator does with a single published video:
 *   feed, recommended, detail, series episode, access check, watch, like /
 *   dislike / interaction status, share, rating, watch progress / resume, and
 *   the creator's edit. (Moderation, release, trash and admin flows stay in
 *   videoController.js.)
 *
 * WHAT WAS WRONG BEFORE
 *   - Responses were the raw database document: they leaked every creator's
 *     e-mail, the e-mail of every user who liked/disliked a video, the full
 *     buyer list, and the direct file URL of paid / private / unpublished
 *     videos and episodes. Responses are now built by a whitelist
 *     (utils/videoAccess.js) and the main file URL is only included when the
 *     viewer may actually watch.
 *   - The public video routes never identified a logged-in user, so everyone
 *     was treated as a guest (paid and purchased viewing could not work).
 *     The routes now use optionalAuth.
 *   - The feed's search was silently overwritten by the release filter (search
 *     never worked), used an unescaped user-supplied regex (ReDoS), accepted
 *     any sort field and an unbounded page size.
 *   - Age restrictions were skipped for guests and computed with a year
 *     difference only (a 17-year-old counted as 18 for most of the year).
 *   - Every watch request added a view (trivial view inflation).
 *   - Likes / dislikes / ratings were read-modify-save (lost updates and
 *     duplicates under concurrency), ratings accepted NaN, and anyone could
 *     rate videos they could not even see.
 *   - Watch-progress accepted any numbers and any video id.
 *   - A creator could edit `videoUrl`, `thumbnailUrl`, an episode's `views` /
 *     `published` flag, and an approved video stayed approved after its
 *     title, description, age rating or pricing changed (approve-then-swap).
 *   - Shares were written to the ADMIN audit log with an unvalidated platform.
 */

const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');
const History = require('../models/History');
const AdminActionLog = require('../models/AdminActionLog');
const { shouldCountView } = require('../utils/viewTracker');
const {
  allowedRatingsFor,
  evaluateVideoAccess,
  serializeVideo,
  serializeEpisode,
} = require('../utils/videoAccess');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);
const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampInt = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
};

const AGE_RATINGS = ['G', 'PG', '13+', '16+', '18+', 'PG-13'];
const SORT_FIELDS = { uploadedAt: 'uploadedAt', views: 'views', title: 'title', averageRating: 'averageRating', publishedAt: 'publishedAt' };
const SHARE_PLATFORMS = ['facebook', 'twitter', 'x', 'whatsapp', 'telegram', 'linkedin', 'reddit', 'email', 'copy', 'copy_link', 'other'];

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

const serverError = (res, err, message) => {
  console.error(`[Video] ${message}:`, err.message);
  return res.status(500).json({ success: false, message });
};

// ─────────────────────────────────────────────
// LOADING HELPERS
// ─────────────────────────────────────────────

/**
 * One video, with the heavy arrays (likes, buyers, ratings, comments) replaced
 * by counts and the creator reduced to public fields.
 */
const loadVideoForView = async (id, userId) => {
  const uid = userId ? toObjectId(userId) : null;
  const [video] = await Video.aggregate([
    { $match: { _id: toObjectId(id), isDeleted: { $ne: true } } },
    {
      $addFields: {
        _likesCount: { $size: { $ifNull: ['$likes', []] } },
        _dislikesCount: { $size: { $ifNull: ['$dislikes', []] } },
        _ratingsCount: { $size: { $ifNull: ['$ratings', []] } },
        _hasLiked: uid ? { $in: [uid, { $ifNull: ['$likes', []] }] } : false,
        _hasDisliked: uid ? { $in: [uid, { $ifNull: ['$dislikes', []] }] } : false,
      },
    },
    {
      $project: {
        purchases: 0,
        likes: 0,
        dislikes: 0,
        ratings: 0,
        comments: 0,
        reports: 0,
        'seasons.episodes.likes': 0,
        'seasons.episodes.dislikes': 0,
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        let: { cid: '$creator' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
          { $project: { username: 1, firstName: 1, lastName: 1, avatar: 1, isVerified: 1 } },
        ],
        as: 'creator',
      },
    },
    { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
  ]);
  return video || null;
};

const hasPurchased = async (videoId, userId) =>
  !!(userId && (await Video.exists({ _id: videoId, 'purchases.user': userId })));

/** Loads + evaluates access in one go. Sends the error response itself when not visible. */
const loadAndAuthorize = async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) {
    fail(res, 400, 'Invalid video ID format');
    return null;
  }
  const video = await loadVideoForView(id, req.user && req.user._id);
  if (!video) {
    fail(res, 404, 'Video unavailable', { code: 'NOT_FOUND' });
    return null;
  }
  const purchased = video.isPaid && req.user ? await hasPurchased(video._id, req.user._id) : false;
  const access = evaluateVideoAccess(video, req.user || null, { purchased });
  if (!access.visible) {
    fail(res, access.status, access.message, { code: access.code, requiresAuth: !!access.requiresAuth });
    return null;
  }
  return { video, access, purchased };
};

const countsOf = (v) => ({ likes: v._likesCount, dislikes: v._dislikesCount, ratings: v._ratingsCount });

const viewerKeyOf = (req) => (req.user && String(req.user._id)) || req.guestId || req.ip || null;

// ─────────────────────────────────────────────
// FEED + RECOMMENDED
// ─────────────────────────────────────────────

const buildListQuery = (req) => {
  const now = new Date();
  const guestOnly = !req.user;

  const and = [
    {
      $or: [
        { releaseOption: { $ne: 'schedule' } },
        { scheduledReleaseDate: null },
        { scheduledReleaseDate: { $exists: false } },
        { scheduledReleaseDate: { $lte: now } },
      ],
    },
  ];

  const q = {
    status: 'released',
    isDeleted: { $ne: true },
    isShadowBanned: { $ne: true },
    isPrivate: { $ne: true },
    ageRating: { $in: allowedRatingsFor(req.user || null) },
    $and: and,
  };
  if (guestOnly) q.isPaid = { $ne: true };
  return q;
};

const LIST_PROJECT = {
  purchases: 0, likes: 0, dislikes: 0, ratings: 0, comments: 0, reports: 0,
  'seasons.episodes': 0,
};

const listVideos = async ({ query, sort, skip, limit }) =>
  Video.aggregate([
    { $match: query },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    {
      $addFields: {
        _likesCount: { $size: { $ifNull: ['$likes', []] } },
        _dislikesCount: { $size: { $ifNull: ['$dislikes', []] } },
        _ratingsCount: { $size: { $ifNull: ['$ratings', []] } },
      },
    },
    { $project: LIST_PROJECT },
    {
      $lookup: {
        from: User.collection.name,
        let: { cid: '$creator' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
          { $project: { username: 1, firstName: 1, lastName: 1, avatar: 1, isVerified: 1 } },
        ],
        as: 'creator',
      },
    },
    { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
  ]);

// List cards never carry a stream URL; `canWatch` is only a hint (paid = false until purchased).
const toCard = (v) => ({
  ...serializeVideo(v, { canWatch: !v.isPaid, counts: countsOf(v) }),
});

exports.getVideoFeed = async (req, res) => {
  try {
    const page = clampInt(req.query.page, 1, 10000, 1);
    const limit = clampInt(req.query.limit, 1, 50, 20);
    const sortBy = req.query.sortBy;
    const sortKey = typeof sortBy === 'string' && Object.prototype.hasOwnProperty.call(SORT_FIELDS, sortBy) ? SORT_FIELDS[sortBy] : 'uploadedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = buildListQuery(req);

    if (req.query.type === 'movie' || req.query.type === 'series') query.type = req.query.type;
    if (typeof req.query.genre === 'string' && req.query.genre.length <= 30) query.genre = req.query.genre;
    if (isObjectId(req.query.userId)) query.creator = toObjectId(req.query.userId);

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const rx = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), 'i');
      query.$and.push({ $or: [{ title: rx }, { description: rx }, { tags: rx }] });
    }

    const [videos, total] = await Promise.all([
      listVideos({ query, sort: { [sortKey]: sortOrder, _id: -1 }, skip: (page - 1) * limit, limit }),
      Video.countDocuments(query),
    ]);

    res.json({
      success: true,
      videos: videos.map(toCard),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (err) {
    serverError(res, err, 'Failed to fetch videos');
  }
};

exports.getRecommendedVideos = async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 1, 30, 10);
    const query = buildListQuery(req);
    if (isObjectId(req.query.exclude)) query._id = { $ne: toObjectId(req.query.exclude) };

    const videos = await listVideos({ query, sort: { views: -1, uploadedAt: -1, _id: -1 }, skip: 0, limit });
    res.json({ success: true, videos: videos.map(toCard) });
  } catch (err) {
    serverError(res, err, 'Failed to fetch recommendations');
  }
};

// ─────────────────────────────────────────────
// DETAIL / ACCESS / WATCH / EPISODE
// ─────────────────────────────────────────────

exports.getVideoById = async (req, res) => {
  try {
    const ctx = await loadAndAuthorize(req, res);
    if (!ctx) return;
    const { video, access, purchased } = ctx;

    res.json({
      success: true,
      video: {
        ...serializeVideo(video, { ...access, includeStreamUrl: true, withEpisodes: true, counts: countsOf(video) }),
        hasLiked: !!video._hasLiked,
        hasDisliked: !!video._hasDisliked,
        hasPurchased: purchased,
      },
      hasAccess: access.canWatch,
      requiresAuth: !!access.requiresAuth,
    });
  } catch (err) {
    serverError(res, err, 'Failed to fetch video');
  }
};

exports.checkVideoAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return fail(res, 400, 'Invalid video ID format');

    const video = await loadVideoForView(id, req.user && req.user._id);
    if (!video) return fail(res, 404, 'Video unavailable', { code: 'NOT_FOUND' });

    const purchased = video.isPaid && req.user ? await hasPurchased(video._id, req.user._id) : false;
    const access = evaluateVideoAccess(video, req.user || null, { purchased });

    if (!access.visible) {
      return res.status(access.status).json({
        success: false,
        hasAccess: false,
        message: access.message,
        code: access.code,
        requiresAuth: !!access.requiresAuth,
      });
    }

    const isSeries = video.type === 'series';
    const seasons = (video.seasons || []).filter((s) => access.privileged || s.isPublished);
    const message = access.canWatch
      ? 'Access granted'
      : access.requiresAuth
        ? 'Please log in to watch this video'
        : 'Purchase required to watch this video';

    res.json({
      success: true,
      hasAccess: access.canWatch,
      price: video.price,
      isPaid: !!video.isPaid,
      type: video.type,
      isSeries,
      totalSeasons: isSeries ? seasons.length : undefined,
      status: video.status,
      requiresAuth: !!access.requiresAuth,
      code: access.code,
      message,
    });
  } catch (err) {
    serverError(res, err, 'Failed to check access');
  }
};

/** Counts a view atomically — once per viewer per video per 30 minutes; never the creator or admins. */
const countView = (req, video, access, seasonNumber, episodeNumber) => {
  if (access.privileged) return;
  if (!shouldCountView(String(video._id), viewerKeyOf(req))) return;

  const update = Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });
  update.catch((e) => console.error('[Video] view count failed:', e.message));

  if (Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber)) {
    Video.updateOne(
      { _id: video._id },
      { $inc: { 'seasons.$[s].episodes.$[e].views': 1 } },
      { arrayFilters: [{ 's.seasonNumber': seasonNumber }, { 'e.episodeNumber': episodeNumber }] }
    ).catch((e) => console.error('[Video] episode view count failed:', e.message));
  }
};

const pickEpisode = (video, access, seasonNumber, episodeNumber) => {
  const season = (video.seasons || []).find((s) => s.seasonNumber === seasonNumber);
  if (!season) return { error: 'Season not found' };
  if (!season.isPublished && !access.privileged) return { error: 'This season is not available yet' };
  const episode = (season.episodes || []).find((e) => e.episodeNumber === episodeNumber);
  if (!episode) return { error: 'Episode not found' };
  if (!episode.published && !access.privileged) return { error: 'This episode is not available yet' };
  return { season, episode };
};

exports.watchVideo = async (req, res) => {
  try {
    const ctx = await loadAndAuthorize(req, res);
    if (!ctx) return;
    const { video, access, purchased } = ctx;

    if (!access.canWatch) {
      return res.status(access.requiresAuth ? 401 : 402).json({
        success: false,
        message: access.requiresAuth ? 'Please log in to watch this video' : 'Payment required',
        code: access.code,
        requiresAuth: !!access.requiresAuth,
        price: video.price,
      });
    }

    let seasonNumber = null;
    let episodeNumber = null;
    let current = {};

    if (video.type === 'series') {
      seasonNumber = parseInt(req.query.season, 10);
      episodeNumber = parseInt(req.query.episode, 10);
      if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
        return fail(res, 400, 'Season and episode numbers are required for series');
      }
      const picked = pickEpisode(video, access, seasonNumber, episodeNumber);
      if (picked.error) return fail(res, 404, picked.error);
      current = {
        currentSeason: { seasonNumber: picked.season.seasonNumber, title: picked.season.title },
        currentEpisode: serializeEpisode(picked.episode, { showUrl: true, privileged: access.privileged }),
      };
    }

    countView(req, video, access, seasonNumber, episodeNumber);

    res.json({
      success: true,
      video: {
        ...serializeVideo(video, { ...access, includeStreamUrl: true, withEpisodes: true, counts: countsOf(video) }),
        hasPurchased: purchased,
      },
      ...current,
    });
  } catch (err) {
    serverError(res, err, 'Failed to load video');
  }
};

exports.getSeriesEpisode = async (req, res) => {
  try {
    const { videoId } = req.params;
    const seasonNumber = parseInt(req.params.seasonNumber, 10);
    const episodeNumber = parseInt(req.params.episodeNumber, 10);
    if (!isObjectId(videoId) || !Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
      return fail(res, 400, 'Invalid request');
    }

    req.params.id = videoId;
    const ctx = await loadAndAuthorize(req, res);
    if (!ctx) return;
    const { video, access } = ctx;

    if (video.type !== 'series') return fail(res, 400, 'This video is not a series');

    const picked = pickEpisode(video, access, seasonNumber, episodeNumber);
    if (picked.error) return fail(res, 404, picked.error);

    if (access.canWatch) countView(req, video, access, seasonNumber, episodeNumber);

    res.json({
      success: true,
      video: serializeVideo(video, { ...access, includeStreamUrl: true, withEpisodes: true, counts: countsOf(video) }),
      currentSeason: { seasonNumber: picked.season.seasonNumber, title: picked.season.title },
      currentEpisode: serializeEpisode(picked.episode, { showUrl: access.canWatch, privileged: access.privileged }),
      hasAccess: access.canWatch,
    });
  } catch (err) {
    serverError(res, err, 'Failed to fetch episode');
  }
};

// ─────────────────────────────────────────────
// LIKE / DISLIKE (atomic)
// ─────────────────────────────────────────────

const interactionCounts = async (videoId, userId) => {
  const [r] = await Video.aggregate([
    { $match: { _id: toObjectId(videoId) } },
    {
      $project: {
        likesCount: { $size: { $ifNull: ['$likes', []] } },
        dislikesCount: { $size: { $ifNull: ['$dislikes', []] } },
        hasLiked: { $in: [toObjectId(userId), { $ifNull: ['$likes', []] }] },
        hasDisliked: { $in: [toObjectId(userId), { $ifNull: ['$dislikes', []] }] },
      },
    },
  ]);
  return r || { likesCount: 0, dislikesCount: 0, hasLiked: false, hasDisliked: false };
};

/** Light check: may this user interact with the video at all (not necessarily watch it)? */
const authorizeInteraction = async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) {
    fail(res, 400, 'Invalid video ID format');
    return null;
  }
  const video = await Video.findOne({ _id: id, isDeleted: { $ne: true } })
    .select('creator status isShadowBanned isPrivate ageRating isPaid releaseOption scheduledReleaseDate')
    .lean();
  const access = evaluateVideoAccess(video, req.user, { purchased: true });
  if (!video || !access.visible) {
    fail(res, access.status || 404, access.message || 'Video unavailable');
    return null;
  }
  return video;
};

const toggleReaction = (kind) => async (req, res) => {
  try {
    const video = await authorizeInteraction(req, res);
    if (!video) return;

    const uid = req.user._id;
    const mine = kind === 'like' ? 'likes' : 'dislikes';
    const other = kind === 'like' ? 'dislikes' : 'likes';

    const already = await Video.exists({ _id: video._id, [mine]: uid });
    if (already) {
      await Video.updateOne({ _id: video._id }, { $pull: { [mine]: uid } });
    } else {
      await Video.updateOne({ _id: video._id }, { $addToSet: { [mine]: uid }, $pull: { [other]: uid } });
    }

    // Keep the user's "liked videos" list in step (best effort).
    if (kind === 'like') {
      await User.updateOne(
        { _id: uid },
        already ? { $pull: { likedVideos: video._id } } : { $addToSet: { likedVideos: video._id } }
      ).catch(() => {});
    } else if (!already) {
      await User.updateOne({ _id: uid }, { $pull: { likedVideos: video._id } }).catch(() => {});
    }

    const c = await interactionCounts(video._id, uid);
    res.json({
      success: true,
      message: already ? (kind === 'like' ? 'Like removed' : 'Dislike removed') : kind === 'like' ? 'Video liked' : 'Video disliked',
      ...c,
      likes: c.likesCount,
      dislikes: c.dislikesCount,
    });
  } catch (err) {
    serverError(res, err, kind === 'like' ? 'Failed to like video' : 'Failed to dislike video');
  }
};

exports.likeVideo = toggleReaction('like');
exports.dislikeVideo = toggleReaction('dislike');

exports.getVideoInteractionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.json({ success: true, hasLiked: false, hasDisliked: false, likesCount: 0, dislikesCount: 0 });
    const c = await interactionCounts(id, req.user._id);
    res.json({ success: true, ...c });
  } catch (err) {
    serverError(res, err, 'Failed to get interaction status');
  }
};

// ─────────────────────────────────────────────
// SHARE
// ─────────────────────────────────────────────

exports.trackShare = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return fail(res, 400, 'Invalid video ID format');

    const video = await Video.findOne({ _id: id, isDeleted: { $ne: true } })
      .select('title creator status isShadowBanned isPrivate ageRating isPaid releaseOption scheduledReleaseDate')
      .lean();
    const access = evaluateVideoAccess(video, req.user || null, { purchased: true });
    if (!video || !access.visible) return fail(res, 404, 'Video not found');

    const platform = SHARE_PLATFORMS.includes(String(req.body && req.body.platform).toLowerCase())
      ? String(req.body.platform).toLowerCase()
      : 'other';

    AdminActionLog.create({
      admin: req.user ? req.user._id : null,
      action: 'SHARE_VIDEO',
      targetType: 'Video',
      targetId: video._id,
      details: {
        title: String(video.title).slice(0, 200),
        platform,
        sharedBy: req.user ? String(req.user._id) : req.isGuest ? 'guest' : 'anonymous',
      },
    }).catch((e) => console.error('[Video] share log failed:', e.message));

    res.json({ success: true, message: 'Share tracked successfully' });
  } catch (err) {
    console.error('[Video] trackShare:', err.message);
    res.json({ success: true, message: 'Share tracked' }); // sharing must never look broken to the user
  }
};

// ─────────────────────────────────────────────
// RATING
// ─────────────────────────────────────────────

exports.rateVideo = async (req, res) => {
  try {
    const raw = req.body && req.body.rating;
    // Only real numbers or plain numeric strings — null / '' / booleans / objects must not become 0.
    const rating =
      typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
      return fail(res, 400, 'Rating must be a number between 0 and 10');
    }

    const ctx = await loadAndAuthorize(req, res);
    if (!ctx) return;
    if (!ctx.access.canWatch) return fail(res, 403, 'You can only rate videos you can watch');

    const id = ctx.video._id;
    const uid = req.user._id;
    const value = Math.round(rating * 10) / 10;

    const updated = await Video.updateOne({ _id: id, 'ratings.user': uid }, { $set: { 'ratings.$.rating': value } });
    if (updated.matchedCount === 0) {
      await Video.updateOne(
        { _id: id, 'ratings.user': { $ne: uid } },
        { $push: { ratings: { user: uid, rating: value } } }
      );
    }

    const [agg] = await Video.aggregate([
      { $match: { _id: id } },
      { $project: { avg: { $avg: '$ratings.rating' }, n: { $size: { $ifNull: ['$ratings', []] } } } },
    ]);
    const averageRating = agg && agg.avg ? Math.round(agg.avg * 10) / 10 : 0;
    await Video.updateOne({ _id: id }, { $set: { averageRating } });

    res.json({ success: true, message: 'Rating submitted', averageRating, ratingCount: agg ? agg.n : 0, userRating: value });
  } catch (err) {
    serverError(res, err, 'Failed to rate video');
  }
};

// ─────────────────────────────────────────────
// WATCH PROGRESS / RESUME
// ─────────────────────────────────────────────

const optInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 100000 ? n : NaN;
};

exports.recordWatchProgress = async (req, res) => {
  try {
    const progress = Number(req.body && req.body.progress);
    const duration = Number(req.body && req.body.duration);
    const seasonNumber = optInt(req.body && req.body.seasonNumber);
    const episodeNumber = optInt(req.body && req.body.episodeNumber);

    if (!Number.isFinite(progress) || !Number.isFinite(duration) || progress < 0 || duration <= 0 || duration > 172800) {
      return fail(res, 400, 'Invalid progress or duration');
    }
    if (Number.isNaN(seasonNumber) || Number.isNaN(episodeNumber)) return fail(res, 400, 'Invalid season or episode');

    const ctx = await loadAndAuthorize(req, res);
    if (!ctx) return;
    if (!ctx.access.canWatch) return fail(res, 403, 'You cannot record progress for this video');

    const safeProgress = Math.min(progress, duration);
    const percentWatched = Math.min(100, (safeProgress / duration) * 100);
    const completed = percentWatched >= 95;
    const filter = { user: req.user._id, video: ctx.video._id, seasonNumber, episodeNumber };

    const history = await History.findOneAndUpdate(
      filter,
      {
        $set: { progress: safeProgress, duration, percentWatched, completed, lastWatchedAt: new Date() },
        $inc: { watchCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Progress recorded',
      shouldResume: history.progress > 5 && !history.completed && history.percentWatched < 90,
      percentWatched: history.percentWatched,
    });
  } catch (err) {
    console.error('[Video] progress:', err.message);
    res.json({ success: true, message: 'Progress recorded' }); // progress pings must never break playback
  }
};

exports.getResumePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const none = { success: true, hasHistory: false, resumePosition: 0, shouldResume: false };
    if (!isObjectId(id)) return res.json(none);

    const seasonNumber = optInt(req.query.seasonNumber);
    const episodeNumber = optInt(req.query.episodeNumber);
    if (Number.isNaN(seasonNumber) || Number.isNaN(episodeNumber)) return res.json(none);

    const history = await History.findOne({ user: req.user._id, video: id, seasonNumber, episodeNumber }).lean();
    if (!history || history.completed || history.percentWatched < 5) return res.json(none);

    res.json({
      success: true,
      hasHistory: true,
      resumePosition: history.progress,
      percentWatched: history.percentWatched,
      shouldResume: history.progress > 5 && !history.completed && history.percentWatched < 90,
      lastWatchedAt: history.lastWatchedAt,
    });
  } catch (err) {
    console.error('[Video] resume:', err.message);
    res.json({ success: true, hasHistory: false, resumePosition: 0, shouldResume: false });
  }
};

// ─────────────────────────────────────────────
// EDIT (creator only)
// Cannot change: files (videoUrl / thumbnailUrl — use the upload endpoints), type, creator, views, likes,
// purchases, moderation fields, or episode published flags.
// Changing title, description, age rating, content flags, sponsorship or pricing model sends a
// released/approved video back for moderation.
// ─────────────────────────────────────────────

const bad = (message) => Object.assign(new Error(message), { badRequest: true });
const asText = (v, max, label) => {
  if (typeof v !== 'string') throw bad(`${label} must be text.`);
  const s = v.trim();
  if (s.length > max) throw bad(`${label} must be ${max} characters or fewer.`);
  return s;
};
const asList = (v, maxItems, maxLen) => {
  let arr = v;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = arr.split(','); }
  }
  if (!Array.isArray(arr)) throw bad('Expected a list.');
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s || s.length > maxLen || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
};
const asBool = (v) => v === true || v === 'true';
const asMoney = (v, label) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw bad(`${label} must be between 0 and 1,000,000.`);
  return Math.round(n * 100) / 100;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

exports.editVideo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return fail(res, 400, 'Invalid video ID format');

    const video = await Video.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!video) return fail(res, 404, 'Video not found');
    if (String(video.creator) !== String(req.user._id)) return fail(res, 403, 'You can only edit your own videos');

    const b = req.body || {};
    const before = {
      title: video.title,
      description: video.description,
      ageRating: video.ageRating,
      contentFlags: video.contentFlags ? JSON.parse(JSON.stringify(video.contentFlags)) : {},
      isPaid: video.isPaid,
      isSponsored: video.isSponsored,
      isFundraiser: video.isFundraiser,
      sponsorDescription: video.sponsorDescription,
      fundraiserDescription: video.fundraiserDescription,
    };

    // ── minor changes (no re-review) ──
    if (b.genre !== undefined) video.genre = asList(b.genre, 10, 30);
    if (b.tags !== undefined) video.tags = asList(b.tags, 20, 30);
    if (b.subtitles !== undefined) video.subtitles = asList(b.subtitles, 20, 40);
    if (b.language !== undefined) video.language = asText(b.language, 40, 'Language') || 'English';
    if (b.commentsDisabled !== undefined) video.commentsDisabled = asBool(b.commentsDisabled);
    if (b.isPrivate !== undefined) video.isPrivate = asBool(b.isPrivate);
    if (b.price !== undefined) video.price = asMoney(b.price, 'Price');
    if (b.currency !== undefined) {
      if (typeof b.currency !== 'string' || !/^[A-Za-z]{3}$/.test(b.currency)) throw bad('Currency must be a 3-letter code.');
      video.currency = b.currency.toUpperCase();
    }
    if (b.releaseOption !== undefined) {
      if (!['immediate', 'schedule'].includes(b.releaseOption)) throw bad('Invalid release option.');
      video.releaseOption = b.releaseOption;
    }
    if (b.releaseDate !== undefined && b.releaseDate !== null && b.releaseDate !== '') {
      const d = new Date(b.releaseDate);
      if (Number.isNaN(d.getTime())) throw bad('Invalid release date.');
      video.releaseDate = d;
      if (video.releaseOption === 'schedule') video.scheduledReleaseDate = d;
    }

    // ── major changes (trigger re-review) ──
    if (b.title !== undefined) {
      video.title = asText(b.title, 200, 'Title');
      if (!video.title) throw bad('Title is required.');
    }
    if (b.description !== undefined) {
      video.description = asText(b.description, 5000, 'Description');
      if (!video.description) throw bad('Description is required.');
    }
    if (b.ageRating !== undefined) {
      if (!AGE_RATINGS.includes(b.ageRating)) throw bad('Invalid age rating.');
      video.ageRating = b.ageRating;
    }
    if (b.contentFlags !== undefined) {
      let flags = b.contentFlags;
      if (typeof flags === 'string') {
        try { flags = JSON.parse(flags); } catch { throw bad('Invalid content flags.'); }
      }
      video.contentFlags = {
        violence: asBool(flags && flags.violence),
        sex: asBool(flags && flags.sex),
        language: asBool(flags && flags.language),
        graphic: asBool(flags && flags.graphic),
      };
    }
    if (b.isPaid !== undefined) video.isPaid = asBool(b.isPaid);
    if (b.isSponsored !== undefined) video.isSponsored = asBool(b.isSponsored);
    if (b.isFundraiser !== undefined) video.isFundraiser = asBool(b.isFundraiser);
    if (video.isSponsored && video.isFundraiser) throw bad('A video cannot be both sponsored and a fundraiser.');
    if (b.sponsorDescription !== undefined) video.sponsorDescription = video.isSponsored ? asText(b.sponsorDescription, 1000, 'Sponsor description') : '';
    if (b.fundraiserDescription !== undefined) video.fundraiserDescription = video.isFundraiser ? asText(b.fundraiserDescription, 1000, 'Fundraiser description') : '';
    if (video.isPaid && !(video.price > 0)) throw bad('A paid video needs a price above 0.');

    // ── series text edits: existing seasons / episodes only, text only ──
    if (b.seasons !== undefined && video.type === 'series') {
      let seasonsIn = b.seasons;
      if (typeof seasonsIn === 'string') {
        try { seasonsIn = JSON.parse(seasonsIn); } catch { throw bad('Invalid seasons data.'); }
      }
      if (!Array.isArray(seasonsIn)) throw bad('Invalid seasons data.');
      for (const sIn of seasonsIn) {
        if (!sIn || typeof sIn !== 'object') continue;
        const season = video.seasons.find((s) => s.seasonNumber === sIn.seasonNumber);
        if (!season) continue;
        if (sIn.title !== undefined) season.title = asText(sIn.title, 200, 'Season title');
        if (sIn.description !== undefined) season.description = asText(sIn.description, 2000, 'Season description');
        for (const eIn of Array.isArray(sIn.episodes) ? sIn.episodes : []) {
          if (!eIn || typeof eIn !== 'object') continue;
          const ep = season.episodes.find((e) => e.episodeNumber === eIn.episodeNumber);
          if (!ep) continue;
          if (eIn.title !== undefined) ep.title = asText(eIn.title, 200, 'Episode title');
          if (eIn.description !== undefined) ep.description = asText(eIn.description, 2000, 'Episode description');
        }
      }
    }

    const after = {
      title: video.title,
      description: video.description,
      ageRating: video.ageRating,
      contentFlags: video.contentFlags ? JSON.parse(JSON.stringify(video.contentFlags)) : {},
      isPaid: video.isPaid,
      isSponsored: video.isSponsored,
      isFundraiser: video.isFundraiser,
      sponsorDescription: video.sponsorDescription,
      fundraiserDescription: video.fundraiserDescription,
    };
    const majorChange = !same(before, after);
    const wasLive = ['approved', 'released'].includes(video.status);

    let requiresReview = false;
    if (majorChange && wasLive) {
      // approve-then-swap protection: the new content must be reviewed again.
      video.status = 'pending';
      video.approved = false;
      video.released = false;
      video.releasedAt = undefined;
      video.publishedAt = undefined;
      requiresReview = true;
    }

    await video.save();

    res.json({
      success: true,
      message: requiresReview
        ? 'Video updated. Because key details changed it has been sent back for review.'
        : 'Video updated successfully',
      requiresReview,
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        approved: !!video.approved,
        released: !!video.released,
      },
    });
  } catch (err) {
    if (err && err.badRequest) return fail(res, 400, err.message);
    return serverError(res, err, 'Failed to update video');
  }
};

// ═══ END OF FILE: backend/controllers/videoPublicController.js ═══