/**
 * File: backend/controllers/uploadController.js
 * Purpose: Uploads — videos (movies / series), avatar, cover, standalone
 *   thumbnail, verification documents, signed direct uploads, delete, quota.
 *
 * WHAT WAS WRONG BEFORE (all fixed here)
 *   - Files were held IN MEMORY (up to 2 GB each, unlimited count): one
 *     authenticated user could crash the server. Uploads now go to a temp file
 *     on disk and are streamed to Cloudinary (chunked for video).
 *   - DELETE /uploads/file let ANY logged-in user delete ANY Cloudinary asset
 *     (other people's videos, thumbnails, ID documents). It now requires proof
 *     of ownership and refuses assets that a video still uses.
 *   - Identity documents (ID / passport / licence) were uploaded publicly and
 *     their URL stored. They are now private (`authenticated`) and only an
 *     admin can fetch a short-lived signed link.
 *   - There were NO upload permission checks (minors and users restricted from
 *     uploading could upload). See middleware/uploadGuards.js.
 *   - The series payload was copied straight into the database, so a client
 *     could set an episode's views, likes, `published` flag, price or
 *     videoUrl. Metadata is now validated and whitelisted field by field.
 *   - Quotas were computed from fields the schema does not store (always 0)
 *     and never enforced. Sizes are now recorded in video.metadata.storage and
 *     quotas are enforced.
 *   - A failure half-way left orphaned files in Cloudinary and episodes that
 *     silently had no video. Uploads are now all-or-nothing with cleanup.
 *   - File types were trusted from the client. The first bytes are checked too.
 *
 * NEW: POST /uploads/sign + POST /uploads/video/finalize — browser uploads
 *   straight to Cloudinary (no size limit imposed by this server; needed for
 *   very large files and real upload-progress UIs), then the server verifies
 *   what was uploaded before creating the video.
 */

const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const cloud = require('../utils/cloudinaryAssets');

const MB = 1024 * 1024;
const GB = 1024 * MB;
const ADMIN_ROLES = ['supportadmin', 'platformadmin', 'superadmin'];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];
const AGE_RATINGS = ['G', 'PG', '13+', '16+', '18+', 'PG-13'];
const MAX_SEASONS = 30;
const MAX_EPISODES_PER_SEASON = 200;

const QUOTAS = {
  user: { maxVideos: 50, maxStorage: 10 * GB, maxVideoSize: 2 * GB, canUpload: true },
  creator: { maxVideos: 200, maxStorage: 50 * GB, maxVideoSize: 5 * GB, canUpload: true },
  admin: { maxVideos: 1000, maxStorage: 500 * GB, maxVideoSize: 10 * GB, canUpload: true },
};

const quotaFor = (user) => {
  if (ADMIN_ROLES.includes(user.role)) return QUOTAS.admin;
  return user.isCreator ? QUOTAS.creator : QUOTAS.user;
};

const maxMultipartBytes = () => (Number(process.env.MAX_VIDEO_UPLOAD_MB) || 2000) * MB;

class UploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ─────────────────────────────────────────────
// FILE CHECKS (declared type + real first bytes)
// ─────────────────────────────────────────────

const readHead = async (filePath, n = 16) => {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fh.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fh.close();
  }
};

const looksLike = {
  image: (b) =>
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
    b.subarray(0, 3).toString('latin1') === 'GIF' ||
    (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'),
  video: (b) =>
    b.subarray(4, 8).toString('latin1') === 'ftyp' || // mp4 / mov
    b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) || // webm / mkv
    b.subarray(0, 4).toString('latin1') === 'OggS',
  pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

/** Throws UploadError unless `file` is the kind of file it claims to be and within the size limit. */
const assertFile = async (file, { kind, types, maxBytes, label }) => {
  if (!types.includes(file.mimetype)) {
    throw new UploadError(400, `${label} has an unsupported file type.`);
  }
  if (file.size > maxBytes) {
    throw new UploadError(400, `${label} is too large (max ${Math.round(maxBytes / MB)} MB).`);
  }
  const head = await readHead(file.path);
  const ok = kind === 'document' ? looksLike.image(head) || looksLike.pdf(head) : looksLike[kind](head);
  if (!ok) throw new UploadError(400, `${label} does not look like a valid file.`);
};

// ─────────────────────────────────────────────
// METADATA VALIDATION (whitelist — nothing else reaches the database)
// ─────────────────────────────────────────────

const toBool = (v) => v === true || v === 'true';

const parseMaybeJson = (v, fallback) => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    throw new UploadError(400, 'Invalid JSON in one of the fields.');
  }
};

const cleanList = (v, { maxItems, maxLen }) => {
  const arr = parseMaybeJson(v, []);
  if (!Array.isArray(arr)) return [];
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

const text = (v, { max, required = false, label }) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new UploadError(400, `${label} is required.`);
    return '';
  }
  if (typeof v !== 'string') throw new UploadError(400, `${label} must be text.`);
  const s = v.trim();
  if (required && !s) throw new UploadError(400, `${label} is required.`);
  if (s.length > max) throw new UploadError(400, `${label} must be ${max} characters or fewer.`);
  return s;
};

const money = (v, label) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new UploadError(400, `${label} must be a number between 0 and 1,000,000.`);
  return Math.round(n * 100) / 100;
};

/** @returns the sanitised fields, including a seasons skeleton (titles/numbers only) for series */
const parseVideoInput = (body = {}) => {
  const title = text(body.title, { max: 200, required: true, label: 'Title' });
  const description = text(body.description, { max: 5000, required: true, label: 'Description' });

  const type = body.type;
  if (type !== 'movie' && type !== 'series') throw new UploadError(400, 'Type must be "movie" or "series".');

  if (!AGE_RATINGS.includes(body.ageRating)) throw new UploadError(400, 'Invalid age rating.');

  const flagsIn = parseMaybeJson(body.contentFlags, {});
  const contentFlags = {};
  for (const k of ['violence', 'sex', 'language', 'graphic']) contentFlags[k] = toBool(flagsIn && flagsIn[k]);

  const isSponsored = toBool(body.isSponsored);
  const isFundraiser = toBool(body.isFundraiser);
  if (isSponsored && isFundraiser) throw new UploadError(400, 'A video cannot be both sponsored and a fundraiser.');

  const isPaid = toBool(body.isPaid);
  let price = 0;
  if (isPaid) {
    price = money(body.price, 'Price');
    if (price <= 0) throw new UploadError(400, 'A paid video needs a price above 0.');
  }

  let currency = 'USD';
  if (body.currency !== undefined && body.currency !== '') {
    if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency)) {
      throw new UploadError(400, 'Currency must be a 3-letter code.');
    }
    currency = body.currency.toUpperCase();
  }

  const releaseOption = body.releaseOption === 'schedule' ? 'schedule' : 'immediate';
  let releaseDate = null;
  if (releaseOption === 'schedule') {
    releaseDate = new Date(body.releaseDate);
    if (Number.isNaN(releaseDate.getTime())) throw new UploadError(400, 'A valid release date is required.');
    if (releaseDate.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw new UploadError(400, 'Release date is too far ahead.');
  }

  const out = {
    title,
    description,
    type,
    ageRating: body.ageRating,
    genre: cleanList(body.genre, { maxItems: 10, maxLen: 30 }),
    tags: cleanList(body.tags, { maxItems: 20, maxLen: 30 }),
    subtitles: cleanList(body.subtitles, { maxItems: 20, maxLen: 40 }),
    language: text(body.language, { max: 40, label: 'Language' }) || 'English',
    contentFlags,
    commentsDisabled: toBool(body.commentsDisabled),
    isPrivate: toBool(body.isPrivate),
    isSponsored,
    sponsorDescription: isSponsored ? text(body.sponsorDescription, { max: 1000, label: 'Sponsor description' }) : '',
    isFundraiser,
    fundraiserDescription: isFundraiser ? text(body.fundraiserDescription, { max: 1000, label: 'Fundraiser description' }) : '',
    isPaid,
    price,
    currency,
    releaseOption,
    releaseDate,
    seasons: [],
  };

  if (type === 'series') {
    const seasonsIn = parseMaybeJson(body.seasons, null);
    if (!Array.isArray(seasonsIn) || seasonsIn.length === 0) throw new UploadError(400, 'Seasons data is required for series.');
    if (seasonsIn.length > MAX_SEASONS) throw new UploadError(400, `A series can have at most ${MAX_SEASONS} seasons.`);

    out.seasons = seasonsIn.map((s, si) => {
      if (!s || typeof s !== 'object') throw new UploadError(400, `Season ${si + 1} is invalid.`);
      const eps = Array.isArray(s.episodes) ? s.episodes : [];
      if (eps.length === 0) throw new UploadError(400, `Season ${si + 1} needs at least one episode.`);
      if (eps.length > MAX_EPISODES_PER_SEASON) throw new UploadError(400, `Season ${si + 1} has too many episodes.`);

      return {
        title: text(s.title, { max: 200, required: true, label: `Season ${si + 1} title` }),
        description: text(s.description, { max: 2000, label: `Season ${si + 1} description` }),
        seasonNumber: Number.isInteger(s.seasonNumber) && s.seasonNumber > 0 ? s.seasonNumber : si + 1,
        order: si,
        episodes: eps.map((e, ei) => {
          if (!e || typeof e !== 'object') throw new UploadError(400, `Season ${si + 1}, episode ${ei + 1} is invalid.`);
          const where = `Season ${si + 1}, episode ${ei + 1}`;
          return {
            title: text(e.title, { max: 200, required: true, label: `${where} title` }),
            description: text(e.description, { max: 2000, label: `${where} description` }),
            episodeNumber: Number.isInteger(e.episodeNumber) && e.episodeNumber > 0 ? e.episodeNumber : ei + 1,
            order: ei,
            price: e.price === undefined || e.price === '' ? 0 : money(e.price, `${where} price`),
          };
        }),
      };
    });
  }

  return out;
};

// ─────────────────────────────────────────────
// QUOTA
// ─────────────────────────────────────────────

const getUsage = async (userId) => {
  const [agg] = await Video.aggregate([
    { $match: { creator: new mongoose.Types.ObjectId(String(userId)), isDeleted: { $ne: true } } },
    { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: { $ifNull: ['$metadata.storage.totalBytes', 0] } } } },
  ]);
  return { videos: agg?.count || 0, bytes: agg?.bytes || 0 };
};

const assertQuota = async (user, { newBytes, largestVideoBytes }) => {
  const quota = quotaFor(user);
  const usage = await getUsage(user._id);

  if (usage.videos + 1 > quota.maxVideos) {
    throw new UploadError(403, `You have reached your limit of ${quota.maxVideos} videos.`);
  }
  if (largestVideoBytes > quota.maxVideoSize) {
    throw new UploadError(400, `A single video can be at most ${Math.round(quota.maxVideoSize / GB)} GB.`);
  }
  if (usage.bytes + newBytes > quota.maxStorage) {
    throw new UploadError(403, `This upload would exceed your ${Math.round(quota.maxStorage / GB)} GB storage quota.`);
  }
};

// ─────────────────────────────────────────────
// BUILD + SAVE THE VIDEO FROM RESOLVED ASSETS
// resolved = { thumbnail, video?, trailer?, seasons?: [{ trailer?, episodes: [{ video, trailer?, thumbnail? }] }] }
// every asset = { url, publicId, bytes, duration?, resourceType }
// ─────────────────────────────────────────────

const saveVideo = async ({ userId, input, resolved, method }) => {
  const assets = [];
  const track = (kind, a) => {
    if (a) assets.push({ kind, publicId: a.publicId, resourceType: a.resourceType, bytes: a.bytes || 0 });
  };

  track('thumbnail', resolved.thumbnail);

  const doc = {
    title: input.title,
    description: input.description,
    type: input.type,
    creator: userId,
    genre: input.genre,
    tags: input.tags,
    ageRating: input.ageRating,
    language: input.language,
    subtitles: input.subtitles,
    commentsDisabled: input.commentsDisabled,
    isPrivate: input.isPrivate,
    contentFlags: input.contentFlags,
    isSponsored: input.isSponsored,
    sponsorDescription: input.sponsorDescription,
    isFundraiser: input.isFundraiser,
    fundraiserDescription: input.fundraiserDescription,
    isPaid: input.isPaid,
    price: input.price,
    currency: input.currency,
    releaseOption: input.releaseOption,
    releaseDate: input.releaseDate,
    thumbnailUrl: resolved.thumbnail.url,
    approved: false,
    status: 'pending',
  };

  if (input.type === 'movie') {
    track('video', resolved.video);
    track('trailer', resolved.trailer);
    doc.videoUrl = resolved.video.url;
    doc.filePath = resolved.video.publicId;
    doc.duration = resolved.video.duration || 0;
    if (resolved.trailer) doc.trailerUrl = resolved.trailer.url;
  } else {
    let total = 0;
    doc.seasons = input.seasons.map((s, si) => {
      const rs = resolved.seasons[si];
      track('trailer', rs.trailer);
      return {
        ...s,
        trailerUrl: rs.trailer ? rs.trailer.url : undefined,
        isPublished: false,
        episodes: s.episodes.map((e, ei) => {
          const re = rs.episodes[ei];
          track('video', re.video);
          track('trailer', re.trailer);
          track('thumbnail', re.thumbnail);
          total += re.video.duration || 0;
          return {
            ...e,
            videoUrl: re.video.url,
            filePath: re.video.publicId,
            duration: re.video.duration || 0,
            trailerUrl: re.trailer ? re.trailer.url : undefined,
            thumbnailUrl: re.thumbnail ? re.thumbnail.url : undefined,
            published: false,
          };
        }),
      };
    });
    doc.duration = total;
  }

  doc.metadata = {
    storage: { assets, totalBytes: assets.reduce((sum, a) => sum + a.bytes, 0), method },
  };

  const video = await Video.create(doc);
  await User.updateOne({ _id: userId }, { $push: { uploadedVideos: video._id } });
  return video;
};

const submittedResponse = (video) => ({
  success: true,
  message: `${video.type === 'movie' ? 'Movie' : 'Series'} submitted for admin review`,
  videoId: video._id,
  type: video.type,
  title: video.title,
  moderationStatus: 'pending',
  thumbnailUrl: video.thumbnailUrl,
});

const sendError = (res, err, fallback) => {
  if (err instanceof UploadError) return res.status(err.status).json({ success: false, message: err.message });
  console.error(`[Upload] ${fallback}:`, err.message);
  return res.status(500).json({ success: false, message: fallback });
};

// ─────────────────────────────────────────────
// UPLOAD VIDEO (multipart, via temp files)
// field names: thumbnail, video, trailer, season-S-trailer,
//              season-S-episode-E-video | -trailer | -thumbnail
// ─────────────────────────────────────────────
exports.uploadVideo = async (req, res) => {
  const uploaded = []; // for rollback
  try {
    const input = parseVideoInput(req.body);

    const byName = new Map();
    for (const f of req.files || []) if (!byName.has(f.fieldname)) byName.set(f.fieldname, f);
    const get = (name) => byName.get(name) || null;

    const quota = quotaFor(req.user);
    const videoMax = Math.min(maxMultipartBytes(), quota.maxVideoSize);

    // 1) Validate every file BEFORE uploading anything.
    const plan = []; // { slot, file, kind }
    const want = async (slot, name, { kind, required, label }) => {
      const file = get(name);
      if (!file) {
        if (required) throw new UploadError(400, `${label} is required.`);
        return;
      }
      if (kind === 'thumbnail') await assertFile(file, { kind: 'image', types: IMAGE_TYPES, maxBytes: 5 * MB, label });
      else await assertFile(file, { kind: 'video', types: VIDEO_TYPES, maxBytes: videoMax, label });
      plan.push({ slot, file, kind });
    };

    await want('thumbnail', 'thumbnail', { kind: 'thumbnail', required: true, label: 'Thumbnail' });

    if (input.type === 'movie') {
      await want('video', 'video', { kind: 'video', required: true, label: 'Video file' });
      await want('trailer', 'trailer', { kind: 'trailer', required: false, label: 'Trailer' });
    } else {
      for (let s = 0; s < input.seasons.length; s++) {
        await want(`s${s}.trailer`, `season-${s}-trailer`, { kind: 'trailer', required: false, label: `Season ${s + 1} trailer` });
        for (let e = 0; e < input.seasons[s].episodes.length; e++) {
          const p = `season-${s}-episode-${e}`;
          const l = `Season ${s + 1}, episode ${e + 1}`;
          await want(`s${s}e${e}.video`, `${p}-video`, { kind: 'video', required: true, label: `${l} video` });
          await want(`s${s}e${e}.trailer`, `${p}-trailer`, { kind: 'trailer', required: false, label: `${l} trailer` });
          await want(`s${s}e${e}.thumbnail`, `${p}-thumbnail`, { kind: 'thumbnail', required: false, label: `${l} thumbnail` });
        }
      }
    }

    // 2) Quota.
    const newBytes = plan.reduce((sum, p) => sum + p.file.size, 0);
    const largest = Math.max(0, ...plan.filter((p) => p.kind === 'video').map((p) => p.file.size));
    await assertQuota(req.user, { newBytes, largestVideoBytes: largest });

    // 3) Upload, one file at a time, remembering what to roll back.
    const done = {};
    for (const p of plan) {
      const publicId = cloud.buildPublicId(req.user._id, p.kind);
      let r;
      if (p.kind === 'thumbnail') {
        r = await cloud.uploadImageFile(p.file.path, { publicId, width: 1280, height: 720, crop: 'limit' });
        r.resourceType = 'image';
      } else {
        r = await cloud.uploadVideoFile(p.file.path, { publicId });
        r.resourceType = 'video';
      }
      uploaded.push({ publicId: r.publicId, resourceType: r.resourceType });
      done[p.slot] = r;
    }

    // 4) Assemble + save.
    const resolved =
      input.type === 'movie'
        ? { thumbnail: done.thumbnail, video: done.video, trailer: done.trailer || null }
        : {
            thumbnail: done.thumbnail,
            seasons: input.seasons.map((s, si) => ({
              trailer: done[`s${si}.trailer`] || null,
              episodes: s.episodes.map((_, ei) => ({
                video: done[`s${si}e${ei}.video`],
                trailer: done[`s${si}e${ei}.trailer`] || null,
                thumbnail: done[`s${si}e${ei}.thumbnail`] || null,
              })),
            })),
          };

    const video = await saveVideo({ userId: req.user._id, input, resolved, method: 'multipart' });
    console.log(`✅ ${input.type} uploaded: "${video.title}" (${video._id})`);
    return res.status(201).json(submittedResponse(video));
  } catch (err) {
    if (uploaded.length) await cloud.destroyMany(uploaded);
    return sendError(res, err, 'Upload failed');
  }
};

// ─────────────────────────────────────────────
// DIRECT UPLOAD — step 1: signed parameters
// POST /uploads/sign   { kind: 'video'|'trailer'|'thumbnail', size?: bytes }
// ─────────────────────────────────────────────
exports.getUploadSignature = async (req, res) => {
  try {
    const { kind, size } = req.body || {};
    if (!['video', 'trailer', 'thumbnail'].includes(kind)) {
      return res.status(400).json({ success: false, message: 'kind must be video, trailer or thumbnail.' });
    }

    const quota = quotaFor(req.user);
    if (kind !== 'thumbnail' && size !== undefined) {
      if (!Number.isFinite(Number(size)) || Number(size) <= 0) {
        return res.status(400).json({ success: false, message: 'size must be a positive number of bytes.' });
      }
      if (Number(size) > quota.maxVideoSize) {
        return res.status(400).json({ success: false, message: `A single video can be at most ${Math.round(quota.maxVideoSize / GB)} GB.` });
      }
    }

    const usage = await getUsage(req.user._id);
    if (usage.videos + 1 > quota.maxVideos) {
      return res.status(403).json({ success: false, message: `You have reached your limit of ${quota.maxVideos} videos.` });
    }

    return res.json({ success: true, ...cloud.signUpload({ userId: req.user._id, kind }) });
  } catch (err) {
    return sendError(res, err, 'Could not prepare the upload');
  }
};

// ─────────────────────────────────────────────
// DIRECT UPLOAD — step 2: verify what was uploaded, then create the video
// POST /uploads/video/finalize
//   body: same metadata as the multipart upload (JSON), plus
//   assets: { thumbnail, video?, trailer?, seasons?: [{ trailer?, episodes: [{ video, trailer?, thumbnail? }] }] }
//   (every asset is the publicId returned by /uploads/sign)
// ─────────────────────────────────────────────
exports.finalizeVideoUpload = async (req, res) => {
  try {
    const input = parseVideoInput(req.body);
    const a = req.body.assets;
    if (!a || typeof a !== 'object') throw new UploadError(400, 'assets are required.');

    // Collect every referenced id with the kind it must have.
    const refs = []; // { slot, publicId, kind, resourceType }
    const add = (slot, publicId, kind, required, label) => {
      if (publicId === undefined || publicId === null || publicId === '') {
        if (required) throw new UploadError(400, `${label} is required.`);
        return;
      }
      if (typeof publicId !== 'string') throw new UploadError(400, `${label} is invalid.`);
      if (!cloud.isOwnedBy(publicId, req.user._id) || publicId.split('/')[3] !== kind) {
        throw new UploadError(403, `${label} was not uploaded by you.`);
      }
      refs.push({ slot, publicId, kind, resourceType: kind === 'thumbnail' ? 'image' : 'video' });
    };

    add('thumbnail', a.thumbnail, 'thumbnail', true, 'Thumbnail');
    if (input.type === 'movie') {
      add('video', a.video, 'video', true, 'Video');
      add('trailer', a.trailer, 'trailer', false, 'Trailer');
    } else {
      const seasonsIn = Array.isArray(a.seasons) ? a.seasons : [];
      input.seasons.forEach((s, si) => {
        const sa = seasonsIn[si] || {};
        add(`s${si}.trailer`, sa.trailer, 'trailer', false, `Season ${si + 1} trailer`);
        const eps = Array.isArray(sa.episodes) ? sa.episodes : [];
        s.episodes.forEach((_, ei) => {
          const ea = eps[ei] || {};
          const l = `Season ${si + 1}, episode ${ei + 1}`;
          add(`s${si}e${ei}.video`, ea.video, 'video', true, `${l} video`);
          add(`s${si}e${ei}.trailer`, ea.trailer, 'trailer', false, `${l} trailer`);
          add(`s${si}e${ei}.thumbnail`, ea.thumbnail, 'thumbnail', false, `${l} thumbnail`);
        });
      });
    }

    const ids = refs.map((r) => r.publicId);
    if (new Set(ids).size !== ids.length) throw new UploadError(400, 'The same file was used more than once.');
    if (await Video.exists({ 'metadata.storage.assets.publicId': { $in: ids } })) {
      throw new UploadError(409, 'One of these files is already attached to a video.');
    }

    // Ask Cloudinary what actually exists.
    const quota = quotaFor(req.user);
    const inspected = new Map();
    for (const type of ['image', 'video']) {
      const wanted = refs.filter((r) => r.resourceType === type).map((r) => r.publicId);
      if (wanted.length) for (const [k, v] of await cloud.inspectAssets(wanted, type)) inspected.set(k, v);
    }

    const bad = [];
    const resolvedBySlot = {};
    let newBytes = 0;
    let largest = 0;

    for (const r of refs) {
      const info = inspected.get(r.publicId);
      if (!info) throw new UploadError(400, 'A file was not found. It may not have finished uploading.');

      const allowed = r.resourceType === 'image' ? cloud.IMAGE_FORMATS : cloud.VIDEO_FORMATS;
      const tooBig = r.kind === 'thumbnail' ? info.bytes > 5 * MB : info.bytes > quota.maxVideoSize;
      if (!allowed.includes(info.format) || tooBig) {
        bad.push({ publicId: r.publicId, resourceType: r.resourceType });
        continue;
      }
      newBytes += info.bytes;
      if (r.kind !== 'thumbnail') largest = Math.max(largest, info.bytes);
      resolvedBySlot[r.slot] = { ...info, resourceType: r.resourceType };
    }

    if (bad.length) {
      await cloud.destroyMany(bad); // do not leave rejected files in storage
      throw new UploadError(400, 'A file has an unsupported format or is too large and was removed.');
    }

    await assertQuota(req.user, { newBytes, largestVideoBytes: largest });

    const resolved =
      input.type === 'movie'
        ? { thumbnail: resolvedBySlot.thumbnail, video: resolvedBySlot.video, trailer: resolvedBySlot.trailer || null }
        : {
            thumbnail: resolvedBySlot.thumbnail,
            seasons: input.seasons.map((s, si) => ({
              trailer: resolvedBySlot[`s${si}.trailer`] || null,
              episodes: s.episodes.map((_, ei) => ({
                video: resolvedBySlot[`s${si}e${ei}.video`],
                trailer: resolvedBySlot[`s${si}e${ei}.trailer`] || null,
                thumbnail: resolvedBySlot[`s${si}e${ei}.thumbnail`] || null,
              })),
            })),
          };

    const video = await saveVideo({ userId: req.user._id, input, resolved, method: 'direct' });
    console.log(`✅ ${input.type} registered (direct upload): "${video.title}" (${video._id})`);
    return res.status(201).json(submittedResponse(video));
  } catch (err) {
    return sendError(res, err, 'Could not finish the upload');
  }
};

// ─────────────────────────────────────────────
// AVATAR / COVER
// ─────────────────────────────────────────────

/** Deletes a previous image only if it is one of OUR assets that belongs to this user. */
const removeOldOwnedImage = async (userId, oldUrl) => {
  const parsed = cloud.parseAssetUrl(oldUrl);
  if (parsed && parsed.type === 'upload' && cloud.isOwnedBy(parsed.publicId, userId)) {
    await cloud.destroy(parsed.publicId, 'image').catch(() => {});
  }
};

const uploadProfileImage = ({ kind, types, maxMb, width, height, userField, urlKey, label, crop }) => async (req, res) => {
  let uploadedAsset = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
    await assertFile(req.file, { kind: 'image', types, maxBytes: maxMb * MB, label });

    const before = await User.findById(req.user._id).select(userField).lean();
    const r = await cloud.uploadImageFile(req.file.path, {
      publicId: cloud.buildPublicId(req.user._id, kind),
      width,
      height,
      crop,
    });
    uploadedAsset = { publicId: r.publicId, resourceType: 'image' };

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { [userField]: r.url } },
      { new: true, runValidators: false }
    ).select('-password -tokenVersion -passwordResetToken -passwordResetExpires');

    await removeOldOwnedImage(req.user._id, before && before[userField]);

    return res.status(200).json({
      success: true,
      message: `${label} uploaded successfully`,
      [urlKey]: r.url,
      user: updated,
    });
  } catch (err) {
    if (uploadedAsset) await cloud.destroyMany([uploadedAsset]);
    return sendError(res, err, `${label} upload failed`);
  }
};

exports.uploadAvatar = uploadProfileImage({
  kind: 'avatar',
  types: IMAGE_TYPES,
  maxMb: 5,
  width: 400,
  height: 400,
  crop: 'fill',
  userField: 'avatar',
  urlKey: 'avatarUrl',
  label: 'Avatar',
});

exports.uploadCoverImage = uploadProfileImage({
  kind: 'cover',
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxMb: 10,
  width: 1920,
  height: 480,
  userField: 'coverImage',
  urlKey: 'coverUrl',
  label: 'Cover image',
  crop: 'fill',
});

// ─────────────────────────────────────────────
// STANDALONE THUMBNAIL (optionally attached to the user's own video)
// ─────────────────────────────────────────────
exports.uploadThumbnail = async (req, res) => {
  let uploadedAsset = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
    await assertFile(req.file, { kind: 'image', types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * MB, label: 'Thumbnail' });

    const { videoId } = req.body || {};
    if (videoId !== undefined && !(typeof videoId === 'string' && /^[a-f\d]{24}$/i.test(videoId))) {
      throw new UploadError(400, 'Invalid video id.');
    }

    const r = await cloud.uploadImageFile(req.file.path, {
      publicId: cloud.buildPublicId(req.user._id, 'thumbnail'),
      width: 1280,
      height: 720,
      crop: 'limit',
    });
    uploadedAsset = { publicId: r.publicId, resourceType: 'image' };

    if (videoId) {
      const video = await Video.findOne({ _id: videoId, creator: req.user._id, isDeleted: { $ne: true } }).select('thumbnailUrl');
      if (!video) throw new UploadError(404, 'Video not found.');
      const oldUrl = video.thumbnailUrl;
      await Video.updateOne({ _id: videoId, creator: req.user._id }, { $set: { thumbnailUrl: r.url } });
      await removeOldOwnedImage(req.user._id, oldUrl);
    }

    return res.status(200).json({ success: true, message: 'Thumbnail uploaded successfully', thumbnailUrl: r.url });
  } catch (err) {
    if (uploadedAsset) await cloud.destroyMany([uploadedAsset]);
    return sendError(res, err, 'Thumbnail upload failed');
  }
};

// ─────────────────────────────────────────────
// VERIFICATION DOCUMENT (private)
// ─────────────────────────────────────────────
const PRIVATE_REF = 'cloudinary-private:';

exports.uploadVerificationDocument = async (req, res) => {
  let uploadedAsset = null;
  try {
    const { documentType } = req.body || {};
    if (!['id', 'passport', 'license'].includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Valid document type (id, passport, license) is required' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No document file provided' });

    await assertFile(req.file, {
      kind: 'document',
      types: ['image/jpeg', 'image/png', 'application/pdf'],
      maxBytes: 20 * MB,
      label: 'Document',
    });

    const r = await cloud.uploadPrivateDocument(req.file.path, {
      publicId: cloud.buildPublicId(req.user._id, 'verification'),
    });
    uploadedAsset = { publicId: r.publicId, resourceType: 'image', type: 'authenticated' };

    // The stored value is a private reference, NOT a public URL.
    await User.updateOne(
      { _id: req.user._id },
      {
        $push: {
          verificationDocuments: {
            type: documentType,
            url: `${PRIVATE_REF}${r.publicId}:${r.format}`,
            uploadedAt: new Date(),
            status: 'pending',
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Verification document uploaded successfully',
      document: { type: documentType, status: 'pending' },
    });
  } catch (err) {
    if (uploadedAsset) await cloud.destroyMany([uploadedAsset]);
    return sendError(res, err, 'Document upload failed');
  }
};

// Admin only (route-guarded): short-lived signed link to view a private document.
exports.getVerificationDocumentLink = async (req, res) => {
  try {
    const { userId, docId } = req.params;
    const user = await User.findById(userId).select('verificationDocuments').lean();
    const doc = user && (user.verificationDocuments || []).find((d) => String(d._id) === docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (typeof doc.url === 'string' && doc.url.startsWith(PRIVATE_REF)) {
      const rest = doc.url.slice(PRIVATE_REF.length);
      const cut = rest.lastIndexOf(':');
      const publicId = rest.slice(0, cut);
      const format = rest.slice(cut + 1);
      return res.json({ success: true, url: cloud.privateDocumentLink(publicId, format, 300), expiresInSeconds: 300 });
    }
    // Legacy documents were uploaded publicly; return as stored.
    return res.json({ success: true, url: doc.url, legacyPublic: true });
  } catch (err) {
    return sendError(res, err, 'Could not open the document');
  }
};

// ─────────────────────────────────────────────
// DELETE FILE — only the owner, only when nothing uses it
// ─────────────────────────────────────────────
exports.deleteFile = async (req, res) => {
  try {
    const { fileUrl } = req.body || {};
    if (typeof fileUrl !== 'string' || !fileUrl) {
      return res.status(400).json({ success: false, message: 'File URL is required' });
    }

    const parsed = cloud.parseAssetUrl(fileUrl);
    if (!parsed || parsed.type !== 'upload') {
      return res.status(400).json({ success: false, message: 'Not a deletable file.' });
    }

    // Ownership: the asset lives under this user's folder, or it is this user's current avatar/cover (legacy paths).
    const me = await User.findById(req.user._id).select('avatar coverImage').lean();
    const isOwner = cloud.isOwnedBy(parsed.publicId, req.user._id) || (me && (me.avatar === fileUrl || me.coverImage === fileUrl));
    if (!isOwner) return res.status(403).json({ success: false, message: 'You can only delete your own files.' });

    // Never pull a file out from under a video that still uses it.
    const inUse = await Video.exists({
      $or: [
        { thumbnailUrl: fileUrl },
        { videoUrl: fileUrl },
        { trailerUrl: fileUrl },
        { filePath: parsed.publicId },
        { 'seasons.trailerUrl': fileUrl },
        { 'seasons.episodes.videoUrl': fileUrl },
        { 'seasons.episodes.trailerUrl': fileUrl },
        { 'seasons.episodes.thumbnailUrl': fileUrl },
        { 'metadata.storage.assets.publicId': parsed.publicId },
      ],
    });
    if (inUse) {
      return res.status(409).json({ success: false, message: 'This file is used by a video. Delete the video instead.' });
    }

    await cloud.destroy(parsed.publicId, parsed.resourceType === 'raw' ? 'raw' : parsed.resourceType);
    return res.status(200).json({ success: true, message: 'File deleted successfully', deleted: true });
  } catch (err) {
    return sendError(res, err, 'File deletion failed');
  }
};

// ─────────────────────────────────────────────
// UPLOAD STATUS / QUOTA
// ─────────────────────────────────────────────
exports.getUploadStatus = async (req, res) => {
  try {
    const quota = quotaFor(req.user);
    const usage = await getUsage(req.user._id);

    return res.status(200).json({
      success: true,
      quota: {
        ...quota,
        maxMultipartUpload: maxMultipartBytes(),
        currentVideos: usage.videos,
        currentStorage: usage.bytes,
        currentStorageGB: (usage.bytes / GB).toFixed(2),
        quotaGB: (quota.maxStorage / GB).toFixed(2),
        percentUsed: Math.min(100, Math.round((usage.bytes / quota.maxStorage) * 100)),
        remainingVideos: Math.max(0, quota.maxVideos - usage.videos),
        remainingStorage: Math.max(0, quota.maxStorage - usage.bytes),
      },
    });
  } catch (err) {
    return sendError(res, err, 'Failed to get upload status');
  }
};

// ═══ END OF FILE: backend/controllers/uploadController.js ═══