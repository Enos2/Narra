/**
 * File: backend/utils/cloudinaryAssets.js
 * Purpose: Single place that talks to Cloudinary.
 *   - Every asset a user uploads lives under  narra/users/<userId>/<kind>/<random>
 *     so OWNERSHIP IS PROVABLE FROM THE ASSET'S PATH (the old code used shared
 *     folders, which is why "delete file" could not check who owned what).
 *   - Uploads stream from a file on disk (chunked for video), never from memory.
 *   - Signed direct-upload parameters so large files go browser → Cloudinary
 *     without passing through this server.
 *   - Verification documents are stored as `authenticated` assets (not publicly
 *     reachable) and can only be read through a short-lived signed link.
 */

'use strict';

const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error(
    'Missing required Cloudinary environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. ' +
      'Set these in your .env file (local) or in your Render environment settings (production). ' +
      'Never commit real credentials into source code.'
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});
console.log('✅ Cloudinary configured from environment variables');

const USER_ROOT = 'narra/users';
const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_FORMATS = ['mp4', 'mov', 'webm', 'ogg', 'ogv', 'mkv'];
const CHUNK_SIZE = 20 * 1024 * 1024;

const userPrefix = (userId) => `${USER_ROOT}/${userId}/`;
const buildPublicId = (userId, kind) => `${USER_ROOT}/${userId}/${kind}/${crypto.randomBytes(12).toString('hex')}`;
const isOwnedBy = (publicId, userId) => typeof publicId === 'string' && publicId.startsWith(userPrefix(userId));

// ─────────────────────────────────────────────
// UPLOAD FROM DISK
// ─────────────────────────────────────────────

const uploadImageFile = async (filePath, { publicId, type = 'upload', width, height, crop = 'limit', quality = 'auto:good' }) => {
  const options = {
    public_id: publicId,
    resource_type: 'image',
    type,
    overwrite: false,
    unique_filename: false,
    quality,
  };
  if (width || height) options.transformation = [{ width, height, crop, quality }];

  const r = await cloudinary.uploader.upload(filePath, options);
  return { url: r.secure_url, publicId: r.public_id, bytes: r.bytes || 0, format: r.format };
};

/** Chunked upload — safe for multi-GB files. */
const uploadVideoFile = (filePath, { publicId }) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        public_id: publicId,
        resource_type: 'video',
        chunk_size: CHUNK_SIZE,
        overwrite: false,
        unique_filename: false,
      },
      (err, r) => {
        if (err) return reject(err);
        resolve({
          url: r.secure_url,
          publicId: r.public_id,
          bytes: r.bytes || 0,
          duration: r.duration || 0,
          format: r.format,
        });
      }
    );
  });

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

const destroy = (publicId, resourceType = 'image', type = 'upload') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true });

/** Best-effort cleanup of assets uploaded during a request that then failed. */
const destroyMany = async (assets) => {
  await Promise.all(
    assets.map((a) =>
      destroy(a.publicId, a.resourceType || 'image', a.type || 'upload').catch((e) =>
        console.error('[Cloudinary] cleanup failed:', a.publicId, e.message)
      )
    )
  );
};

/** Parses one of OUR delivery URLs into its parts. Returns null for anything else. */
const parseAssetUrl = (url) => {
  if (typeof url !== 'string') return null;
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/(upload|authenticated|private)\/(?:v\d+\/)?(.+)$/.exec(url);
  if (!m || m[1] !== CLOUDINARY_CLOUD_NAME) return null;
  let publicId;
  try {
    publicId = decodeURIComponent(m[4]);
  } catch {
    return null;
  }
  return { resourceType: m[2], type: m[3], publicId: publicId.replace(/\.[a-z0-9]{2,5}$/i, '') };
};

// ─────────────────────────────────────────────
// DIRECT (BROWSER → CLOUDINARY) UPLOADS
// ─────────────────────────────────────────────

/**
 * Parameters the browser must POST (with the file) to `uploadUrl`.
 * The public_id and allowed formats are part of the signature, so the client
 * cannot choose another location or file type.
 */
const signUpload = ({ userId, kind }) => {
  const resourceType = kind === 'thumbnail' ? 'image' : 'video';
  const publicId = buildPublicId(userId, kind);
  const params = {
    allowed_formats: (resourceType === 'image' ? IMAGE_FORMATS : VIDEO_FORMATS).join(','),
    public_id: publicId,
    timestamp: Math.round(Date.now() / 1000),
  };
  const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET);

  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    resourceType,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    params: { ...params, api_key: CLOUDINARY_API_KEY, signature },
    expiresInSeconds: 3600,
  };
};

/**
 * Asks Cloudinary what was really uploaded (size, format, duration) — in batches
 * of 100 so a long series does not burn through the Admin API rate limit.
 * @returns {Promise<Map<string, {url, publicId, bytes, format, duration}>>}  missing assets are absent
 */
const inspectAssets = async (publicIds, resourceType) => {
  const found = new Map();
  const unique = [...new Set(publicIds)];

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const r = await cloudinary.api.resources_by_ids(batch, { resource_type: resourceType });
    for (const item of r.resources || []) {
      found.set(item.public_id, {
        url: item.secure_url,
        publicId: item.public_id,
        bytes: item.bytes || 0,
        format: String(item.format || '').toLowerCase(),
        duration: item.duration || 0,
      });
    }
  }
  return found;
};

// ─────────────────────────────────────────────
// PRIVATE DOCUMENTS
// ─────────────────────────────────────────────

const uploadPrivateDocument = async (filePath, { publicId }) => {
  const r = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    resource_type: 'image',
    type: 'authenticated',
    overwrite: false,
    unique_filename: false,
  });
  return { publicId: r.public_id, format: r.format, bytes: r.bytes || 0 };
};

/** Short-lived download link for an authenticated asset (admins only — enforce in the route). */
const privateDocumentLink = (publicId, format, ttlSeconds = 300) =>
  cloudinary.utils.private_download_url(publicId, format, {
    resource_type: 'image',
    type: 'authenticated',
    expires_at: Math.round(Date.now() / 1000) + ttlSeconds,
  });

module.exports = {
  IMAGE_FORMATS,
  VIDEO_FORMATS,
  userPrefix,
  buildPublicId,
  isOwnedBy,
  uploadImageFile,
  uploadVideoFile,
  destroy,
  destroyMany,
  parseAssetUrl,
  signUpload,
  inspectAssets,
  uploadPrivateDocument,
  privateDocumentLink,
};

// ═══ END OF FILE: backend/utils/cloudinaryAssets.js ═══