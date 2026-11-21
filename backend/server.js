/**
 * File: backend/server.js
 * Purpose: Narra API entry point — Express app, security middleware, HLS
 *   delivery, static uploads, MongoDB connection, routes, cron, Socket.IO and
 *   the RTMP streaming server.
 *
 * SECURITY CHANGES IN THIS VERSION
 *   - helmet security headers (cross-origin resource policy relaxed so the
 *     separate frontend can load images / video from this API).
 *   - `trust proxy` configured so IP-based rate limiting sees real client IPs.
 *   - Global API rate limit + strict limits on login, admin login, register and
 *     password reset (middleware/rateLimiters.js).
 *   - JSON body limit 10 MB → 1 MB; NoSQL-operator / prototype-pollution keys
 *     stripped from bodies (middleware/sanitizeInput.js).
 *   - HLS route only serves  /live/<token>/index.m3u8  and  segment_NNN.ts;
 *     no directory access, no dotfiles, no per-request IP logging.
 *   - /media removed (it exposed the whole media directory); /uploads gets
 *     dotfile denial, a sandboxing CSP and the shared CORS policy.
 *   - Socket.IO moved to socket/socketServer.js (authorisation on every event).
 *   - CORS allow-list is shared by REST and WebSocket and can be extended with
 *     ALLOWED_ORIGINS=a,b,c.
 *   - Startup refuses to run without JWT_SECRET (and warns if it is weak). In
 *     production the server exits if MongoDB cannot be reached, and shuts down
 *     gracefully (stops live encoders) on SIGTERM / SIGINT.
 *   - The per-request HLS log line (which recorded viewer IPs) was removed.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const fs = require('fs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Import cron for scheduled tasks (optional - runs if installed)
let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('⚠️ node-cron not installed. Automatic trash cleanup disabled.');
  console.warn('   To enable automatic cleanup, run: npm install node-cron');
}

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set — authentication cannot work. Add it to your environment.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  // Warn only: exiting here could take down an existing deployment.
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters — replace it with a long random value.');
}

// Routes
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const liveRoutes = require('./routes/liveRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const liveQualificationRoutes = require('./routes/liveQualificationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const searchRoutes = require('./routes/searchRoutes');
const historyRoutes = require('./routes/historyRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const errorHandler = require('./middleware/errorMiddleware');
const sanitizeInput = require('./middleware/sanitizeInput');
const {
  apiLimiter,
  loginLimiter,
  adminLoginLimiter,
  registerLimiter,
  passwordLimiter,
} = require('./middleware/rateLimiters');
const { createSocketServer } = require('./socket/socketServer');

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────
// PROXY + BASIC HARDENING
// ─────────────────────────────────────────────

// Behind Render / a reverse proxy, req.ip must come from X-Forwarded-For or
// every client would share one rate-limit bucket. Override with TRUST_PROXY.
const parseTrustProxy = (value) => {
  if (value === undefined || value === '') return isProduction ? 1 : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
};
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

// ─────────────────────────────────────────────
// CORS ORIGINS (shared by REST and WebSocket)
// ─────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://narrasea.onrender.com',
  'https://narraplay.onrender.com',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()),
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // No Origin header = mobile apps, curl, <img>/<video> tags
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Range', 'x-guest-id'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
};

// ─────────────────────────────────────────────
// SOCKET.IO (all event authorisation lives in socket/socketServer.js)
// ─────────────────────────────────────────────
const io = createSocketServer(server, { allowedOrigins });
app.set('io', io);

// Attach io to messageController
const messageController = require('./controllers/messageController');
if (typeof messageController.setSocketIO === 'function') {
  messageController.setSocketIO(io);
}

// Attach io to streaming server
try {
  const streamingServer = require('./streaming-server');
  if (typeof streamingServer.setSocketIO === 'function') {
    streamingServer.setSocketIO(io);
  }
} catch {
  /* streaming server optional */
}

// ─────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────
app.use(
  helmet({
    // The frontend lives on another origin and loads images / video from here.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─────────────────────────────────────────────
// HLS  (public, BEFORE cors / body parsing / auth / limiters)
// Only  /live/<token>/index.m3u8  and  /live/<token>/segment_NNN.ts  exist.
// <token> is a random playbackId (viewers) — see streaming-server.js.
// ─────────────────────────────────────────────
const liveMediaPath = path.resolve(__dirname, 'media', 'live');
if (!fs.existsSync(liveMediaPath)) {
  fs.mkdirSync(liveMediaPath, { recursive: true });
  console.log(`[Server] Created HLS directory: ${liveMediaPath}`);
}

const HLS_TOKEN_RE = /^[a-f0-9]{32,64}$/;
const HLS_FILE_RE = /^(index\.m3u8|segment_\d{3,}\.ts)$/;

const hlsHeaders = (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Cache-Control', 'no-cache, private');
  res.setHeader('Accept-Ranges', 'bytes');
  next();
};

app.options('/live/:token/:file', hlsHeaders, (_req, res) => res.sendStatus(204));

app.get('/live/:token/:file', hlsHeaders, (req, res) => {
  const { token, file } = req.params;
  if (!HLS_TOKEN_RE.test(token) || !HLS_FILE_RE.test(file)) return res.sendStatus(404);

  res.setHeader(
    'Content-Type',
    file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'
  );

  res.sendFile(
    file,
    { root: path.join(liveMediaPath, token), dotfiles: 'deny', cacheControl: false },
    (err) => {
      if (err && !res.headersSent) res.sendStatus(404);
    }
  );
});

// ─────────────────────────────────────────────
// CORS + BODY PARSING
// ─────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// ─────────────────────────────────────────────
// STATIC UPLOADS
// ─────────────────────────────────────────────
app.use(
  '/uploads',
  cors(corsOptions),
  (req, res, next) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // If a hostile HTML/SVG file ever lands here, forbid it from running script.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    next();
  },
  express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
    },
  })
);

// ─────────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ MongoDB URI not found in environment variables!');
  console.error('   Check your .env file has MONGODB_URI or MONGO_URI set');
  process.exit(1);
}

console.log('[MongoDB] Connecting to database...');

mongoose
  .connect(mongoURI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
  })
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    if (process.env.ENABLE_STREAMING !== 'false') {
      try {
        const startStreaming = require('./streaming-server');
        startStreaming();
        if (typeof startStreaming.setSocketIO === 'function') {
          startStreaming.setSocketIO(io);
        }
      } catch (err) {
        console.warn('⚠️  RTMP server not started:', err.message);
        console.warn('   Install FFmpeg to enable RTMP streaming.');
      }
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('   Please check your internet connection and MongoDB Atlas settings');
    if (isProduction) {
      console.error('   Exiting: the API cannot run without its database in production.');
      process.exit(1);
    }
    console.error('   Development mode: the server will keep running without database features.');
  });

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    streaming: process.env.ENABLE_STREAMING !== 'false',
    database: dbStatus[mongoose.connection.readyState] || 'unknown',
  });
});

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/admin/login', adminLoginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/password', passwordLimiter);

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/lives', liveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live-qualification', liveQualificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/ads', promotionRoutes); // backward compat
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

// =====================================================
// CRON JOB: Daily cleanup of expired trashed videos (2:00 AM UTC)
// =====================================================
if (cron) {
  const cleanupTrash = require('./scripts/cleanupTrash');

  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log('🕐 Running scheduled trash cleanup...');
      try {
        await cleanupTrash();
        console.log('✅ Trash cleanup completed successfully');
      } catch (err) {
        console.error('❌ Trash cleanup failed:', err.message);
      }
    },
    { timezone: 'UTC' }
  );

  console.log('✅ Trash cleanup cron job scheduled (daily at 2:00 AM UTC)');
} else {
  console.log('⚠️ Cron job not scheduled - node-cron not installed');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Bind to 0.0.0.0 for Render compatibility
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Narra API  →  http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket  →  ws://0.0.0.0:${PORT}`);
  console.log(`📺 HLS Media  →  http://0.0.0.0:${PORT}/live/<playbackId>/index.m3u8`);
  console.log(`📡 RTMP       →  rtmp://localhost:1935/live\n`);
});

// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN (Render sends SIGTERM on every deploy)
// ─────────────────────────────────────────────
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  // Stop every live encoder so FFmpeg processes are not orphaned.
  try {
    const streamingServer = require('./streaming-server');
    for (const key of [...streamingServer.activeStreams.keys()]) streamingServer.forceStop(key);
  } catch {
    /* streaming server not running */
  }

  io.close();
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10000).unref(); // hard stop if something hangs
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ═══ END OF FILE: backend/server.js ═══