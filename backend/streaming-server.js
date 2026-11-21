/**
 * File: backend/streaming-server.js
 * Purpose: RTMP ingest (Node-Media-Server) + low-latency FFmpeg → HLS pipeline.
 *
 * SECURITY MODEL
 *   - Hosts publish with the SECRET streamKey (OBS). Viewers only ever see the
 *     PUBLIC playbackId. HLS files are written to  media/live/<playbackId>/.
 *   - prePublish now FAILS CLOSED: any validation error, unknown key, removed /
 *     rejected / admin-ended stream, or host who lost live privileges is
 *     rejected. Ended streams may only resume within a short reconnect window.
 *   - postPublish refuses to start FFmpeg for a publisher that prePublish never
 *     validated.
 *   - forceStop(streamKey) kicks the publisher, kills FFmpeg and deletes the
 *     HLS output; admin "end stream", host "stop" and key rotation all use it.
 *   - Stream keys are never written to the logs in full.
 *   - The Node-Media-Server HTTP API (which listed active stream paths) is off
 *     and its default admin credentials were removed.
 *
 * LEGACY COMPAT: while a stream is live a directory junction named after the
 * ingest key points to the playbackId directory, so the old LiveWatch.jsx host
 * preview (which builds its URL from the key the host owns) keeps working.
 * Disable with LEGACY_HOST_HLS_ALIAS=false once the new frontend ships.
 */

console.log('✅ streaming-server.js v5 loaded (secure ingest / public playback split)');

const NodeMediaServer = require('node-media-server');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { isValidToken, generatePlaybackId, buildHlsUrl } = require('./utils/liveAccess');

let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  console.log('[Streaming] ✅ ffmpeg-static found:', ffmpegPath);
} catch (e) {
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  console.log('[Streaming] Using fallback ffmpeg:', ffmpegPath);
}

let nmsInstance = null;
let ioInstance = null;

// streamKey -> liveId (stream currently publishing)
const activeStreams = new Map();
// streamKey -> ChildProcess (FFmpeg)
const activeTranscoders = new Map();
// streamKey -> playbackId (set by prePublish after validation)
const playbackByKey = new Map();
// streamKey -> session (only publishers that passed prePublish)
const validatedPublishers = new Map();

const mediaRoot = path.join(__dirname, 'media');
if (!fs.existsSync(mediaRoot)) fs.mkdirSync(mediaRoot, { recursive: true });

const liveMediaRoot = path.join(mediaRoot, 'live');
if (!fs.existsSync(liveMediaRoot)) fs.mkdirSync(liveMediaRoot, { recursive: true });

const RTMP_PORT = parseInt(process.env.RTMP_PORT, 10) || 1935;
const RECONNECT_GRACE_MS = 2 * 60 * 1000; // a dropped host may resume within 2 minutes
const LEGACY_ALIAS = process.env.LEGACY_HOST_HLS_ALIAS !== 'false';

const maskKey = (key) => (key ? `${String(key).slice(0, 6)}…` : 'none');

const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: false, // LATENCY: disable GOP cache - it buffers frames
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: mediaRoot,
    allow_origin: '*',
    api: false, // SECURITY: the management API listed stream paths (= keys)
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [],
  },
  transFork: false,
  relayFork: false,
  logType: 3,
};

// ─────────────────────────────────────────────
// FILESYSTEM HELPERS
// ─────────────────────────────────────────────

const hlsDirFor = (playbackId) => path.join(liveMediaRoot, playbackId);
const aliasDirFor = (streamKey) => path.join(liveMediaRoot, streamKey);

const removeLegacyAlias = (streamKey) => {
  if (!isValidToken(streamKey)) return;
  const alias = aliasDirFor(streamKey);
  try {
    if (fs.lstatSync(alias).isSymbolicLink()) {
      try {
        fs.unlinkSync(alias);
      } catch {
        fs.rmdirSync(alias); // Windows junction fallback (never touches the target)
      }
    }
  } catch {
    /* alias does not exist */
  }
};

const createLegacyAlias = (streamKey, playbackId) => {
  if (!LEGACY_ALIAS) return;
  try {
    removeLegacyAlias(streamKey);
    fs.symlinkSync(hlsDirFor(playbackId), aliasDirFor(streamKey), 'junction');
  } catch (err) {
    console.warn('[Streaming] Legacy host alias not created:', err.message);
  }
};

/** Delete the HLS output later — but never if the same stream resumed meanwhile. */
const scheduleCleanup = (streamKey, playbackId, delayMs) => {
  setTimeout(() => {
    if (activeTranscoders.has(streamKey)) return; // stream is live again
    if (!isValidToken(playbackId)) return;
    try {
      fs.rmSync(hlsDirFor(playbackId), { recursive: true, force: true });
      console.log(`[Cleanup] Removed HLS files for ${maskKey(playbackId)}`);
    } catch (err) {
      console.warn('[Cleanup] Failed:', err.message);
    }
  }, delayMs);
};

// ─────────────────────────────────────────────
// FFMPEG
// ─────────────────────────────────────────────

function startFFmpegTranscoder(streamKey, playbackId) {
  const outputDir = hlsDirFor(playbackId);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const hlsPath = path.join(outputDir, 'index.m3u8');
  const segmentPath = path.join(outputDir, 'segment_%03d.ts');
  const rtmpUrl = `rtmp://127.0.0.1:${RTMP_PORT}/live/${streamKey}`;

  console.log(`[FFmpeg] Starting transcoder for ${maskKey(streamKey)} → ${maskKey(playbackId)}`);

  if (activeTranscoders.has(streamKey)) {
    activeTranscoders.get(streamKey).kill('SIGTERM');
    activeTranscoders.delete(streamKey);
  }

  const ffmpeg = spawn(ffmpegPath, [
    '-i', rtmpUrl,

    // Video — LOW LATENCY
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-b:v', '2000k',
    '-maxrate', '2500k',
    '-bufsize', '1000k',
    '-g', '30',
    '-sc_threshold', '0',
    '-r', '30',

    // Audio
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',

    // HLS output — LOW LATENCY
    '-f', 'hls',
    '-hls_time', '1',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list+omit_endlist',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', segmentPath,
    '-y',
    hlsPath,
  ]);

  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('error')) {
      // FFmpeg echoes the input URL (which holds the key) — redact before logging.
      console.log(`[FFmpeg ${maskKey(playbackId)}]: ${message.replace(streamKey, maskKey(streamKey)).trim()}`);
    }
  });

  ffmpeg.on('error', (err) => {
    console.error(`[FFmpeg ${maskKey(playbackId)}] Process error:`, err.message);
  });

  ffmpeg.on('close', (code) => {
    console.log(`[FFmpeg ${maskKey(playbackId)}] Process exited with code ${code}`);
    if (activeTranscoders.get(streamKey) === ffmpeg) activeTranscoders.delete(streamKey);
  });

  activeTranscoders.set(streamKey, ffmpeg);
  return ffmpeg;
}

function stopFFmpegTranscoder(streamKey) {
  const transcoder = activeTranscoders.get(streamKey);
  if (transcoder) {
    transcoder.kill('SIGTERM');
    activeTranscoders.delete(streamKey);
  }
}

// ─────────────────────────────────────────────
// SESSION HELPERS (works across node-media-server session shapes)
// ─────────────────────────────────────────────

const sessionId = (s) => (s && (s.id ?? s.ID)) ?? null;

const stopSession = (session) => {
  try {
    if (!session) return;
    if (typeof session.reject === 'function') session.reject();
    else if (typeof session.stop === 'function') session.stop();
  } catch (err) {
    console.warn('[RTMP] Could not stop session:', err.message);
  }
};

/** Only a well-formed key is ever accepted from the RTMP path. */
const getStreamKeyFromSession = (session) => {
  const streamPath = session.publishStreamPath || session.streamPath || session.path || '';
  if (!streamPath) return null;
  const candidate = String(streamPath).split('/').pop();
  return isValidToken(candidate) ? candidate : null;
};

const waitForHlsFile = (playbackId, maxWaitMs = 10000) =>
  new Promise((resolve) => {
    const filePath = path.join(hlsDirFor(playbackId), 'index.m3u8');
    const started = Date.now();
    const check = () => {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 50) return resolve(true);
      if (Date.now() - started > maxWaitMs) return resolve(false);
      setTimeout(check, 300);
    };
    check();
  });

// ─────────────────────────────────────────────
// PUBLIC CONTROL API (used by controllers)
// ─────────────────────────────────────────────

const setSocketIO = (io) => {
  ioInstance = io;
};
const registerStream = (streamKey, liveId) => activeStreams.set(streamKey, String(liveId));
const unregisterStream = (streamKey) => activeStreams.delete(streamKey);
const getLiveIdByKey = (streamKey) => activeStreams.get(streamKey) || null;
const isStreamActive = (streamKey) => activeTranscoders.has(streamKey);

/**
 * Immediately cut a stream: kick the publisher, kill FFmpeg, remove the HLS
 * output. Idempotent. Used for admin end/ban/delete, host stop, key rotation.
 */
const forceStop = (streamKey) => {
  if (!isValidToken(streamKey)) return false;

  const playbackId = playbackByKey.get(streamKey);
  const session = validatedPublishers.get(streamKey);

  // Drop bookkeeping first so the later donePublish event is treated as stale.
  validatedPublishers.delete(streamKey);
  playbackByKey.delete(streamKey);
  activeStreams.delete(streamKey);

  stopSession(session);
  stopFFmpegTranscoder(streamKey);
  removeLegacyAlias(streamKey);
  if (playbackId) scheduleCleanup(streamKey, playbackId, 2000);

  console.log(`[RTMP] 🔌 forceStop ${maskKey(streamKey)}`);
  return true;
};

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────

const startStreamingServer = () => {
  if (nmsInstance) {
    console.log('⚠️  RTMP server already running');
    return nmsInstance;
  }

  const nms = new NodeMediaServer(config);

  // ── prePublish: authorise the publisher (FAIL CLOSED) ───────────────────
  nms.on('prePublish', async (session) => {
    if (typeof session !== 'object' || session === null) {
      console.error('[RTMP] prePublish received an unexpected payload; cannot authorise.');
      return;
    }

    const reject = (why) => {
      console.warn(`[RTMP] ❌ Publish rejected: ${why}`);
      stopSession(session);
    };

    try {
      const streamKey = getStreamKeyFromSession(session);
      if (!streamKey) return reject('malformed stream key');

      const Live = require('./models/Live');
      const User = require('./models/User');

      const live = await Live.findOne({ streamKey, isDeleted: false });
      if (!live) return reject(`unknown key ${maskKey(streamKey)}`);

      if (live.isRemoved || live.rejected || live.adminEnded || live.forceClosed || live.status === 'cancelled') {
        return reject('stream was removed, rejected, cancelled or ended by an admin');
      }
      if (!live.approved) return reject('stream not approved');

      if (live.status === 'ended') {
        const endedMs = live.endedAt ? Date.now() - new Date(live.endedAt).getTime() : Infinity;
        if (endedMs > RECONNECT_GRACE_MS) return reject('stream already ended — create a new one');
      }

      const host = await User.findById(live.host)
        .select('isBanned isDeactivated canGoLive restrictions')
        .lean();
      if (!host || host.isBanned || host.isDeactivated || !host.canGoLive || host.restrictions?.goLive === true) {
        return reject('host is not allowed to stream');
      }

      // Backfill a playbackId for streams created before this version.
      if (!live.playbackId) {
        live.playbackId = generatePlaybackId();
        await live.save({ validateBeforeSave: false });
      }

      // A reconnect replaces any stale previous session for the same key.
      const previous = validatedPublishers.get(streamKey);
      if (previous && sessionId(previous) !== sessionId(session)) stopSession(previous);

      validatedPublishers.set(streamKey, session);
      playbackByKey.set(streamKey, live.playbackId);
      activeStreams.set(streamKey, live._id.toString());

      console.log(`[RTMP] ✅ Publisher authorised: "${live.title}" (${maskKey(streamKey)})`);
    } catch (err) {
      // FAIL CLOSED: a database error must never let an unverified publisher in.
      reject(`authorisation error: ${err.message}`);
    }
  });

  // ── postPublish: start transcoding + mark the stream live ───────────────
  nms.on('postPublish', async (session) => {
    if (typeof session !== 'object' || session === null) return;

    const streamKey = getStreamKeyFromSession(session);
    if (!streamKey) return stopSession(session);

    const playbackId = playbackByKey.get(streamKey);
    if (!validatedPublishers.has(streamKey) || !playbackId) {
      console.warn('[RTMP] ⚠️ postPublish for a publisher that was never authorised — dropping');
      return stopSession(session);
    }

    console.log(`[RTMP] 🎬 Publishing: ${maskKey(streamKey)}`);

    startFFmpegTranscoder(streamKey, playbackId);
    createLegacyAlias(streamKey, playbackId);

    const hlsReady = await waitForHlsFile(playbackId, 10000);

    try {
      const Live = require('./models/Live');
      const live = await Live.findOne({ streamKey, isDeleted: false });
      if (!live) return;

      const resumed = live.status === 'ended';
      live.status = 'live';
      if (!resumed || !live.startedAt) {
        live.startedAt = new Date();
        live.viewers = [];
      }
      live.endedAt = null;
      live.hlsUrl = buildHlsUrl(playbackId);
      await live.save({ validateBeforeSave: false });

      if (ioInstance) {
        ioInstance.to(`live:${live._id}`).emit('stream:started', {
          liveId: live._id,
          title: live.title,
          hlsUrl: live.hlsUrl,
          playbackId,
          streamKey: playbackId, // LEGACY COMPAT: old LiveWatch.jsx reads this field (public id, not the secret)
          startedAt: live.startedAt,
          hlsReady,
        });
        ioInstance.emit('feed:stream:started', {
          liveId: live._id,
          title: live.title,
          host: live.host,
        });
      }

      console.log(`[RTMP] ✅ Live: "${live.title}" | HLS ready: ${hlsReady}`);
    } catch (err) {
      console.error('[RTMP] postPublish DB error:', err.message);
    }
  });

  // ── donePublish: the encoder disconnected ───────────────────────────────
  nms.on('donePublish', async (session) => {
    if (typeof session !== 'object' || session === null) return;

    const streamKey = getStreamKeyFromSession(session);
    if (!streamKey) return;

    // Ignore the end of an old session that a reconnect already replaced.
    const current = validatedPublishers.get(streamKey);
    if (current && sessionId(current) !== null && sessionId(session) !== null && sessionId(current) !== sessionId(session)) {
      return;
    }
    if (!current) return; // already cleaned up (forceStop) — nothing to do

    console.log(`[RTMP] 🛑 Publisher disconnected: ${maskKey(streamKey)}`);

    const playbackId = playbackByKey.get(streamKey);
    validatedPublishers.delete(streamKey);
    playbackByKey.delete(streamKey);
    activeStreams.delete(streamKey);

    stopFFmpegTranscoder(streamKey);
    removeLegacyAlias(streamKey);

    try {
      const Live = require('./models/Live');
      const live = await Live.findOne({ streamKey, isDeleted: false });

      if (live && live.status === 'live') {
        const endedAt = new Date();
        const duration = live.startedAt ? Math.floor((endedAt - live.startedAt) / 1000) : 0;
        live.status = 'ended';
        live.endedAt = endedAt;
        live.duration = duration;
        await live.save({ validateBeforeSave: false });

        if (ioInstance) {
          ioInstance.to(`live:${live._id}`).emit('stream:ended', {
            liveId: live._id,
            title: live.title,
            duration,
            endedAt,
          });
          ioInstance.emit('feed:stream:ended', { liveId: live._id });
        }
        console.log(`[RTMP] ended: "${live.title}" (${duration}s)`);
      }
    } catch (err) {
      console.error('[RTMP] donePublish DB error:', err.message);
    }

    if (playbackId) scheduleCleanup(streamKey, playbackId, 30000);
  });

  nms.run();
  nmsInstance = nms;

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  NARRA RTMP SERVER — SECURE / LOW LATENCY    ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  RTMP  →  rtmp://localhost:${RTMP_PORT}/live       ║`);
  console.log('║  HLS   →  /live/<playbackId>/index.m3u8      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  return nms;
};

module.exports = startStreamingServer;
module.exports.setSocketIO = setSocketIO;
module.exports.registerStream = registerStream;
module.exports.unregisterStream = unregisterStream;
module.exports.getLiveIdByKey = getLiveIdByKey;
module.exports.isStreamActive = isStreamActive;
module.exports.forceStop = forceStop;
module.exports.activeStreams = activeStreams;

// ═══ END OF FILE: backend/streaming-server.js ═══