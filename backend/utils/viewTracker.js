/**
 * File: backend/utils/viewTracker.js
 * Purpose: Stops trivial view-count inflation. The watch endpoint used to add
 *   one view to the video for EVERY request, so refreshing the page in a loop
 *   (or a 5-line script) could push a video's views — which feed analytics and
 *   creator earnings — as high as you liked.
 *
 *   A viewer (user id, guest id or IP) counts once per video per window
 *   (30 minutes by default). In memory: resets on restart and is per server
 *   instance, which is fine for deterring abuse (not a billing-grade ledger).
 */

'use strict';

const WINDOW_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 500000;

const seen = new Map(); // `${videoId}:${viewerKey}` -> timestamp

/** @returns {boolean} true if this view should be counted */
const shouldCountView = (videoId, viewerKey) => {
  if (!videoId || !viewerKey) return false;
  const key = `${videoId}:${viewerKey}`;
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < WINDOW_MS) return false;

  if (seen.size >= MAX_ENTRIES) {
    // Memory guard: drop the oldest 10% instead of growing without bound.
    let drop = Math.floor(MAX_ENTRIES / 10);
    for (const k of seen.keys()) {
      seen.delete(k);
      if (--drop <= 0) break;
    }
  }
  seen.set(key, now);
  return true;
};

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, t] of seen.entries()) if (t < cutoff) seen.delete(k);
}, 10 * 60 * 1000).unref();

module.exports = { shouldCountView };

// ═══ END OF FILE: backend/utils/viewTracker.js ═══