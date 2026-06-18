/**
 * server.js — Narra Backend
 * UPDATED: Full Socket.IO live streaming rooms + chat integration
 * FIXED: HLS static file serving for live streams on Windows
 * FIXED: HLS served BEFORE any auth middleware (public access)
 * FIXED: MongoDB connection with correct env variable
 * FIXED: Socket.IO admin auth - checks User model first then Admin model
 * ADDED: Cron job for automatic cleanup of expired trashed videos (30-day retention)
 * FIXED: Render deployment - added 0.0.0.0 binding and error handling
 */

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const socketIO   = require('socket.io');
const jwt        = require('jsonwebtoken');
const fs         = require('fs');
require('dotenv').config();

// Import cron for scheduled tasks (optional - runs if installed)
let cron;
try {
  cron = require('node-cron');
} catch (err) {
  console.warn('⚠️ node-cron not installed. Automatic trash cleanup disabled.');
  console.warn('   To enable automatic cleanup, run: npm install node-cron');
}

const User  = require('./models/User');
const Admin = require('./models/Admin');

// Routes
const authRoutes              = require('./routes/authRoutes');
const videoRoutes             = require('./routes/videoRoutes');
const liveRoutes              = require('./routes/liveRoutes');
const userRoutes              = require('./routes/userRoutes');
const adminRoutes             = require('./routes/adminRoutes');
const liveQualificationRoutes = require('./routes/liveQualificationRoutes');
const messageRoutes           = require('./routes/messageRoutes');
const uploadRoutes            = require('./routes/uploadRoutes');
const promotionRoutes         = require('./routes/promotionRoutes');
const searchRoutes            = require('./routes/searchRoutes');
const historyRoutes           = require('./routes/historyRoutes');
const playlistRoutes          = require('./routes/playlistRoutes');
const commentRoutes           = require('./routes/commentRoutes');
const notificationRoutes      = require('./routes/notificationRoutes');

const errorHandler = require('./middleware/errorMiddleware');

const app    = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

app.set('io', io);

// ─── Socket Auth Middleware (FIXED - checks User model first) ───
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new Error('Invalid token'));
    }

    const normalizedRole = (decoded.role || '').toLowerCase().replace(/_/g, '');
    const adminRoles = ['superadmin', 'platformadmin', 'supportadmin'];

    if (adminRoles.includes(normalizedRole)) {
      // FIXED: Check User model FIRST (where admins are stored)
      let admin = await User.findById(decoded.id).select('-password').lean();
      
      // If not found in User, try Admin model as fallback
      if (!admin) {
        admin = await Admin.findById(decoded.id).select('-password').lean();
      }
      
      if (!admin) {
        console.error(`[Socket] Admin not found for ID: ${decoded.id}`);
        return next(new Error('Admin not found'));
      }
      
      // Check if admin account is active
      if (admin.status === 'inactive' || admin.isDeactivated === true) {
        return next(new Error('Admin account inactive'));
      }

      socket.actor = {
        id:    admin._id,
        model: 'Admin',
        role:  admin.role,
        name:  admin.fullName || admin.username || admin.name || admin.email,
        avatar: admin.avatar || null,
      };
      
      console.log(`[Socket] Admin authenticated: ${socket.actor.name} (${socket.actor.role})`);
    } else {
      // Regular user
      const user = await User.findById(decoded.id).select('-password').lean();
      if (!user) {
        console.error(`[Socket] User not found for ID: ${decoded.id}`);
        return next(new Error('User not found'));
      }
      
      if (user.isBanned) {
        return next(new Error('Account banned'));
      }

      if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
        return next(new Error('Session expired'));
      }

      socket.actor = {
        id:     user._id,
        model:  'User',
        role:   user.role,
        name:   user.username || user.firstName || 'Viewer',
        avatar: user.avatar || null,
      };
    }

    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication failed'));
  }
});

// ─── Socket Connection Handler ────────────────
io.on('connection', (socket) => {
  const { actor } = socket;
  console.log(`[Socket] Connected: ${actor.model} "${actor.name}" (${actor.id})`);

  // Personal notification room
  const personalRoom = `${actor.model === 'Admin' ? 'admin' : 'user'}:${actor.id}`;
  socket.join(personalRoom);

  // ── MESSAGING ─────────────────────────────────
  socket.on('subscribe-conversations', async (conversationIds) => {
    if (!Array.isArray(conversationIds)) return;
    const Conversation = require('./models/Conversation');
    for (const convId of conversationIds) {
      try {
        const conv = await Conversation.findById(convId).lean();
        if (!conv) continue;
        const isMember = conv.participants.some(
          (p) => p.participantId.toString() === actor.id.toString()
        );
        if (isMember) socket.join(`conversation:${convId}`);
      } catch { /* skip */ }
    }
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('typing', {
      senderId: actor.id, senderName: actor.name, conversationId, isTyping,
    });
  });

  socket.on('mark-read', async ({ conversationId }) => {
    try {
      const Message      = require('./models/Message');
      const Conversation = require('./models/Conversation');

      await Message.updateMany(
        { conversationId, senderId: { $ne: actor.id }, 'readBy.readerId': { $ne: actor.id }, isDeleted: false },
        { $push: { readBy: { readerId: actor.id, readerModel: actor.model, readAt: new Date() } } }
      );

      const conv = await Conversation.findById(conversationId);
      if (conv) { conv.clearUnread(actor.id); await conv.save(); }

      socket.to(`conversation:${conversationId}`).emit('messages-read', {
        conversationId, readerId: actor.id, readerModel: actor.model, readAt: new Date(),
      });
    } catch (err) {
      console.error('Socket mark-read error:', err.message);
    }
  });

  // ── LIVE STREAMING ROOMS ──────────────────────

  /**
   * Join a live stream room
   * Client sends: { liveId }
   */
  socket.on('live:join', async ({ liveId }) => {
    if (!liveId) return;
    const room = `live:${liveId}`;
    socket.join(room);
    console.log(`[Socket] ${actor.name} joined live room: ${liveId}`);

    // Let everyone in the room know someone joined
    socket.to(room).emit('live:viewer:joined', {
      userId: actor.id,
      name: actor.name,
      avatar: actor.avatar,
    });

    // Acknowledge to sender
    socket.emit('live:joined', { liveId, room });
  });

  /**
   * Leave a live stream room
   * Client sends: { liveId }
   */
  socket.on('live:leave', ({ liveId }) => {
    if (!liveId) return;
    const room = `live:${liveId}`;
    socket.leave(room);
    socket.to(room).emit('live:viewer:left', {
      userId: actor.id,
      name: actor.name,
    });
    console.log(`[Socket] ${actor.name} left live room: ${liveId}`);
  });

  /**
   * Send a live chat message
   * Client sends: { liveId, text }
   * Broadcasts to entire room
   */
  socket.on('live:chat', async ({ liveId, text }) => {
    if (!liveId || !text || !text.trim()) return;

    // Sanitize text — strip HTML, limit length
    const sanitized = String(text).replace(/<[^>]*>/g, '').substring(0, 300).trim();
    if (!sanitized) return;

    // Check if user is shadow banned (don't send but don't tell them)
    if (actor.model === 'User') {
      try {
        const user = await User.findById(actor.id).select('isShadowBanned restrictions').lean();
        if (user?.isShadowBanned || user?.restrictions?.comment) {
          // Echo back to sender only (ghost mode)
          socket.emit('live:chat:message', {
            id: Date.now().toString(),
            liveId,
            userId: actor.id,
            name: actor.name,
            avatar: actor.avatar,
            text: sanitized,
            sentAt: new Date(),
            isOwn: true,
          });
          return;
        }
      } catch { /* allow through */ }
    }

    const msg = {
      id: `${actor.id}-${Date.now()}`,
      liveId,
      userId: actor.id,
      name: actor.name,
      avatar: actor.avatar,
      role: actor.role,
      text: sanitized,
      sentAt: new Date(),
    };

    // Broadcast to everyone in the room including sender
    io.to(`live:${liveId}`).emit('live:chat:message', msg);
  });

  /**
   * Admin: delete a chat message
   * Client sends: { liveId, messageId }
   */
  socket.on('live:chat:delete', ({ liveId, messageId }) => {
    const adminRoles = ['superadmin', 'platformadmin', 'supportadmin'];
    if (!adminRoles.includes(actor.role)) return;
    io.to(`live:${liveId}`).emit('live:chat:deleted', { messageId });
  });

  /**
   * Host heartbeat — keeps stream "live" flag accurate
   * Client sends: { liveId }
   */
  socket.on('live:heartbeat', ({ liveId }) => {
    socket.to(`live:${liveId}`).emit('live:heartbeat', { liveId, ts: Date.now() });
  });

  /**
   * WebRTC signaling for browser-based streaming
   * Client sends: { liveId, offer, targetId }
   */
  socket.on('webrtc:offer', ({ liveId, offer, targetId }) => {
    if (targetId) {
      io.to(targetId).emit('webrtc:offer', { offer, from: socket.id, liveId });
    } else {
      socket.to(`live:${liveId}`).emit('webrtc:offer', { offer, from: socket.id, liveId });
    }
  });

  socket.on('webrtc:answer', ({ answer, to }) => {
    io.to(to).emit('webrtc:answer', { answer, from: socket.id });
  });

  socket.on('webrtc:ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('webrtc:ice-candidate', { candidate, from: socket.id });
  });

  // ── DISCONNECT ────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${actor.model} "${actor.name}" — ${reason}`);
  });
});

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
} catch { /* streaming server optional */ }

// ─────────────────────────────────────────────
// CORS + BODY PARSING
// ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────
// STATIC FILES - HLS MUST BE FIRST (BEFORE ANY AUTH)
// ─────────────────────────────────────────────

// CRITICAL: Serve HLS files FIRST with NO authentication requirements
const liveMediaPath = path.resolve(__dirname, 'media', 'live');
console.log(`[Server] HLS files directory: ${liveMediaPath}`);
console.log(`[Server] Directory exists: ${fs.existsSync(liveMediaPath)}`);

// Create directory if it doesn't exist
if (!fs.existsSync(liveMediaPath)) {
  fs.mkdirSync(liveMediaPath, { recursive: true });
  console.log(`[Server] Created HLS directory: ${liveMediaPath}`);
}

// Serve HLS files - PUBLIC access, no auth middleware should run before this
app.use('/live', (req, res, next) => {
  console.log(`[HLS Request] ${req.method} ${req.url} - IP: ${req.ip}`);
  
  // Set CORS headers for public access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Cache-Control', 'no-cache, private');
  res.setHeader('Accept-Ranges', 'bytes');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(liveMediaPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
    }
  },
  // Allow serving files even if they're being written
  fallthrough: true
}));

// ─────────────────────────────────────────────
// OTHER STATIC FILES
// ─────────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  },
}));

// Also serve media root for compatibility
app.use('/media', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  next();
}, express.static(path.join(__dirname, 'media')));

// ─────────────────────────────────────────────
// DATABASE - FIXED: Use MONGODB_URI from .env
// ─────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ MongoDB URI not found in environment variables!');
  console.error('   Check your .env file has MONGODB_URI or MONGO_URI set');
  process.exit(1);
}

console.log(`[MongoDB] Connecting to database...`);

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
        const streamingServer = startStreaming();
        // Pass io after start
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
    console.error('   The server will continue running but database features will not work');
    // Don't exit - let server run without DB for testing
  });

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  res.json({ 
    success: true, 
    status: 'healthy', 
    timestamp: new Date(), 
    streaming: process.env.ENABLE_STREAMING !== 'false',
    database: dbStatus[dbState] || 'unknown'
  });
});

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api/videos',            videoRoutes);
app.use('/api/lives',             liveRoutes);
app.use('/api/users',             userRoutes);
app.use('/api/admin',             adminRoutes);
app.use('/api/live-qualification', liveQualificationRoutes);
app.use('/api/messages',          messageRoutes);
app.use('/api/uploads',           uploadRoutes);
app.use('/api/promotions',        promotionRoutes);
app.use('/api/ads',               promotionRoutes);   // backward compat
app.use('/api/search',            searchRoutes);
app.use('/api/history',           historyRoutes);
app.use('/api/playlists',         playlistRoutes);
app.use('/api/comments',          commentRoutes);
app.use('/api/notifications',     notificationRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

// =====================================================
// CRON JOB: Daily cleanup of expired trashed videos
// Runs every day at 2:00 AM
// =====================================================
if (cron) {
  const cleanupTrash = require('./scripts/cleanupTrash');
  
  // Schedule cleanup job - runs at 2:00 AM every day
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Running scheduled trash cleanup...');
    try {
      await cleanupTrash();
      console.log('✅ Trash cleanup completed successfully');
    } catch (err) {
      console.error('❌ Trash cleanup failed:', err.message);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log('✅ Trash cleanup cron job scheduled (daily at 2:00 AM UTC)');
} else {
  console.log('⚠️ Cron job not scheduled - node-cron not installed');
  console.log('   To enable automatic cleanup of expired videos, run: npm install node-cron');
}

// ─────────────────────────────────────────────
// START - FIXED FOR RENDER DEPLOYMENT
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Add error handling for the server
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Bind to 0.0.0.0 for Render compatibility
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Narra API  →  http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket  →  ws://0.0.0.0:${PORT}`);
  console.log(`📺 HLS Media  →  http://0.0.0.0:${PORT}/live`);
  console.log(`📡 RTMP       →  rtmp://localhost:1935/live\n`);
});

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit immediately - give the server a chance to log
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * END OF FILE: backend/server.js
 */