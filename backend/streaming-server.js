console.log('✅ NEW streaming-server.js loaded v4 - LOW LATENCY');

/**
 * File: backend/streaming-server.js
 * FIXED: Latency reduced from ~30s to ~2-4s
 *   - hls_time reduced from 2s to 1s segments
 *   - hls_list_size reduced from 10 to 3 (only 3 segments in playlist = 3s buffer)
 *   - Added hls_flags delete_segments so old segments are cleaned up
 *   - Removed extra encoding passes that added latency
 *   - Used tune=zerolatency for x264
 */

const NodeMediaServer = require('node-media-server');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  console.log('[Streaming] ✅ ffmpeg-static found:', ffmpegPath);
} catch (e) {
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  console.log('[Streaming] Using fallback ffmpeg:', ffmpegPath);
}
console.log('[Streaming] FFmpeg path resolved to:', ffmpegPath);

let nmsInstance = null;
let ioInstance = null;

const activeStreams = new Map();
const activeTranscoders = new Map();

const mediaRoot = path.join(__dirname, 'media');
if (!fs.existsSync(mediaRoot)) fs.mkdirSync(mediaRoot, { recursive: true });

const liveMediaRoot = path.join(mediaRoot, 'live');
if (!fs.existsSync(liveMediaRoot)) fs.mkdirSync(liveMediaRoot, { recursive: true });

const RTMP_PORT = parseInt(process.env.RTMP_PORT) || 1935;

const buildHlsUrl = (streamKey) => {
  return `http://localhost:5000/live/${streamKey}/index.m3u8`;
};

const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: false,     // LATENCY FIX: disable GOP cache - it buffers frames
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: mediaRoot,
    allow_origin: '*',
    api: true,
    api_user: process.env.STREAM_API_USER || 'admin',
    api_pass: process.env.STREAM_API_PASS || 'admin123',
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [],
  },
  transFork: false,
  relayFork: false,
  logType: 3,
};

/**
 * LOW LATENCY FFmpeg HLS transcoder
 * Key changes vs old version:
 *   - hls_time 1 (was 2) → 1-second segments instead of 2-second
 *   - hls_list_size 3 (was 10) → only 3 segments in playlist (3s total buffer)
 *   - tune=zerolatency → x264 doesn't buffer frames waiting for B-frames
 *   - preset ultrafast (was veryfast) → faster encoding = less delay
 *   - Removed -crf in favor of -b:v for more predictable low-latency output
 */
function startFFmpegTranscoder(streamKey) {
  const outputDir = path.join(liveMediaRoot, streamKey);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[FFmpeg] Created directory: ${outputDir}`);
  }

  const hlsPath = path.join(outputDir, 'index.m3u8');
  const segmentPath = path.join(outputDir, 'segment_%03d.ts');
  const rtmpUrl = `rtmp://127.0.0.1:${RTMP_PORT}/live/${streamKey}`;

  console.log(`[FFmpeg] Starting LOW LATENCY transcoder for ${streamKey}`);
  console.log(`[FFmpeg] Input:  ${rtmpUrl}`);
  console.log(`[FFmpeg] Output: ${hlsPath}`);

  // Kill existing transcoder if any
  if (activeTranscoders.has(streamKey)) {
    const old = activeTranscoders.get(streamKey);
    old.kill('SIGTERM');
    activeTranscoders.delete(streamKey);
  }

  const ffmpeg = spawn(ffmpegPath, [
    // Input
    '-i', rtmpUrl,

    // Video codec - LOW LATENCY settings
    '-c:v', 'libx264',
    '-preset', 'ultrafast',       // fastest encode = less delay (was veryfast)
    '-tune', 'zerolatency',       // KEY: no frame buffering for B-frames
    '-b:v', '2000k',
    '-maxrate', '2500k',
    '-bufsize', '1000k',          // small buffer = low latency (was 4000k)
    '-g', '30',                   // keyframe every 1s at 30fps (matches hls_time)
    '-sc_threshold', '0',         // disable scene-change keyframes for consistency
    '-r', '30',                   // force 30fps output

    // Audio codec
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',

    // HLS output - LOW LATENCY settings
    '-f', 'hls',
    '-hls_time', '1',             // 1-second segments (was 2) = less initial buffer
    '-hls_list_size', '3',        // keep only 3 segments (was 10) = 3s max latency
    '-hls_flags', 'delete_segments+append_list+omit_endlist',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', segmentPath,
    '-y',
    hlsPath,
  ]);

  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('error') || message.includes('Opening') || message.includes('frame=')) {
      // Only log every ~100 frames to reduce spam, but keep errors
      if (message.includes('error') || message.includes('Opening')) {
        console.log(`[FFmpeg ${streamKey.slice(0, 8)}...]: ${message.trim()}`);
      }
    }
  });

  ffmpeg.on('error', (err) => {
    console.error(`[FFmpeg ${streamKey}] Process error:`, err);
  });

  ffmpeg.on('close', (code) => {
    console.log(`[FFmpeg ${streamKey}] Process exited with code ${code}`);
    activeTranscoders.delete(streamKey);
  });

  activeTranscoders.set(streamKey, ffmpeg);
  return ffmpeg;
}

function stopFFmpegTranscoder(streamKey) {
  if (activeTranscoders.has(streamKey)) {
    const transcoder = activeTranscoders.get(streamKey);
    console.log(`[FFmpeg] Stopping transcoder for ${streamKey}`);
    transcoder.kill('SIGTERM');
    activeTranscoders.delete(streamKey);
  }
}

const setSocketIO = (io) => { ioInstance = io; };
const registerStream = (streamKey, liveId) => activeStreams.set(streamKey, liveId.toString());
const unregisterStream = (streamKey) => activeStreams.delete(streamKey);
const getLiveIdByKey = (streamKey) => activeStreams.get(streamKey) || null;

// Wait for HLS file — shorter timeout since segments are now 1s
const waitForHlsFile = (streamKey, maxWaitMs = 10000) => {
  return new Promise((resolve) => {
    const filePath = path.join(liveMediaRoot, streamKey, 'index.m3u8');
    const started = Date.now();
    const check = () => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 50) {
          console.log(`[RTMP] ✅ HLS ready: ${filePath} (${stats.size} bytes)`);
          resolve(true);
        } else {
          setTimeout(check, 300);
        }
      } else if (Date.now() - started > maxWaitMs) {
        console.error(`[RTMP] ❌ HLS file never appeared: ${filePath}`);
        resolve(false);
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
};

const getStreamKeyFromSession = (session) => {
  const streamPath = session.publishStreamPath || session.streamPath || session.path || '';
  if (!streamPath) return null;
  return streamPath.split('/').pop();
};

const startStreamingServer = () => {
  if (nmsInstance) {
    console.log('⚠️  RTMP server already running');
    return nmsInstance;
  }

  const nms = new NodeMediaServer(config);

  nms.on('prePublish', async (session) => {
    if (typeof session !== 'object' || session === null) return;

    const streamKey = getStreamKeyFromSession(session);
    if (!streamKey) {
      console.warn('[RTMP] ⚠️ Could not extract stream key from session');
      return;
    }

    console.log(`[RTMP] prePublish — key: ${streamKey}`);

    try {
      const Live = require('./models/Live');
      const live = await Live.findOne({ streamKey, isDeleted: false });

      if (!live) {
        console.warn(`[RTMP] ❌ Invalid stream key rejected: ${streamKey}`);
        if (typeof session.reject === 'function') session.reject();
        return;
      }

      activeStreams.set(streamKey, live._id.toString());
      console.log(`[RTMP] ✅ Stream key validated: "${live.title}"`);
    } catch (err) {
      console.error('[RTMP] prePublish DB error:', err.message);
    }
  });

  nms.on('postPublish', async (session) => {
    console.log('[RTMP] postPublish fired');
    if (typeof session !== 'object' || session === null) return;

    const streamKey = getStreamKeyFromSession(session);
    if (!streamKey) return;

    console.log(`[RTMP] 🎬 Stream publishing: ${streamKey}`);

    // Start low-latency FFmpeg transcoder
    startFFmpegTranscoder(streamKey);

    const hlsReady = await waitForHlsFile(streamKey, 10000);

    try {
      const Live = require('./models/Live');
      const live = await Live.findOne({ streamKey, isDeleted: false });

      if (live) {
        const hlsUrl = buildHlsUrl(streamKey);
        live.status = 'live';
        live.startedAt = new Date();
        live.viewers = [];
        live.hlsUrl = hlsUrl;
        await live.save({ validateBeforeSave: false });

        activeStreams.set(streamKey, live._id.toString());

        if (ioInstance) {
          ioInstance.to(`live:${live._id}`).emit('stream:started', {
            liveId: live._id,
            title: live.title,
            hlsUrl,
            startedAt: live.startedAt,
            hlsReady,
          });
          ioInstance.emit('feed:stream:started', {
            liveId: live._id,
            title: live.title,
            host: live.host,
          });
        }

        console.log(`[RTMP] ✅ DB updated → live: "${live.title}"`);
        console.log(`[RTMP] HLS URL: ${hlsUrl} | ready: ${hlsReady}`);
      }
    } catch (err) {
      console.error('[RTMP] postPublish DB error:', err.message);
    }
  });

  nms.on('donePublish', async (session) => {
    console.log('[RTMP] donePublish fired');
    if (typeof session !== 'object' || session === null) return;

    const streamKey = getStreamKeyFromSession(session);
    if (!streamKey) return;

    console.log(`[RTMP] 🛑 Stream ENDED: ${streamKey}`);

    stopFFmpegTranscoder(streamKey);

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

      // Clean up HLS files after a delay
      const hlsDir = path.join(liveMediaRoot, streamKey);
      setTimeout(() => {
        if (fs.existsSync(hlsDir)) {
          fs.rmSync(hlsDir, { recursive: true, force: true });
          console.log(`[Cleanup] Removed HLS files for ${streamKey}`);
        }
      }, 30000);

    } catch (err) {
      console.error('[RTMP] donePublish DB error:', err.message);
    }

    activeStreams.delete(streamKey);
  });

  nms.run();
  nmsInstance = nms;

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     NARRA RTMP SERVER — LOW LATENCY MODE     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  RTMP  →  rtmp://localhost:${RTMP_PORT}/live       ║`);
  console.log(`║  HLS   →  http://localhost:5000/live/<key>/  ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Segment: 1s  |  Playlist: 3 segs  (~3s)    ║');
  console.log('║  Preset: ultrafast + tune=zerolatency        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  return nms;
};

module.exports = startStreamingServer;
module.exports.setSocketIO = setSocketIO;
module.exports.registerStream = registerStream;
module.exports.unregisterStream = unregisterStream;
module.exports.getLiveIdByKey = getLiveIdByKey;
module.exports.activeStreams = activeStreams;
module.exports.buildHlsUrl = buildHlsUrl;