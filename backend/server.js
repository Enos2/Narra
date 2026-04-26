/**
 * server.js — Narra Backend
 * Socket.IO messaging rebuilt from scratch (clean slate).
 */

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const socketIO   = require('socket.io');
const jwt        = require('jsonwebtoken');
require('dotenv').config();

const User  = require('./models/User');
const Admin = require('./models/Admin');

// Routes
const authRoutes             = require('./routes/authRoutes');
const videoRoutes            = require('./routes/videoRoutes');
const liveRoutes             = require('./routes/liveRoutes');
const userRoutes             = require('./routes/userRoutes');
const adminRoutes            = require('./routes/adminRoutes');
const liveQualificationRoutes= require('./routes/liveQualificationRoutes');
const messageRoutes          = require('./routes/messageRoutes');
const uploadRoutes           = require('./routes/uploadRoutes');
const promotionRoutes        = require('./routes/promotionRoutes');
const searchRoutes           = require('./routes/searchRoutes');
const historyRoutes          = require('./routes/historyRoutes');
const playlistRoutes         = require('./routes/playlistRoutes');
const commentRoutes          = require('./routes/commentRoutes');
const notificationRoutes     = require('./routes/notificationRoutes');

const errorHandler = require('./middleware/errorMiddleware');

const app    = express();
const server = http.createServer(app);

/*
========================================
SOCKET.IO
========================================
*/
const io = socketIO(server, {
  cors: {
    origin:  'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

app.set('io', io);

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
      const admin = await Admin.findById(decoded.id).select('-password').lean();
      if (!admin)               return next(new Error('Admin not found'));
      if (admin.status === 'inactive') return next(new Error('Admin account inactive'));

      socket.actor = {
        id:    admin._id,
        model: 'Admin',
        role:  admin.role,
        name:  admin.fullName,
      };
    } else {
      const user = await User.findById(decoded.id).select('-password').lean();
      if (!user)  return next(new Error('User not found'));
      if (user.isBanned) return next(new Error('Account banned'));

      if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
        return next(new Error('Session expired'));
      }

      socket.actor = {
        id:    user._id,
        model: 'User',
        role:  user.role,
        name:  user.username || user.firstName || 'User',
      };
    }

    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const { actor } = socket;
  console.log(`Connected: ${actor.model} "${actor.name}" (${actor.id})`);

  const personalRoom = `${actor.model === 'Admin' ? 'admin' : 'user'}:${actor.id}`;
  socket.join(personalRoom);

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
      } catch {
        // skip invalid ids
      }
    }
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('typing', {
      senderId:       actor.id,
      senderName:     actor.name,
      conversationId,
      isTyping,
    });
  });

  socket.on('mark-read', async ({ conversationId }) => {
    try {
      const Message      = require('./models/Message');
      const Conversation = require('./models/Conversation');

      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: actor.id },
          'readBy.readerId': { $ne: actor.id },
          isDeleted: false,
        },
        {
          $push: {
            readBy: { readerId: actor.id, readerModel: actor.model, readAt: new Date() },
          },
        }
      );

      const conv = await Conversation.findById(conversationId);
      if (conv) {
        conv.clearUnread(actor.id);
        await conv.save();
      }

      socket.to(`conversation:${conversationId}`).emit('messages-read', {
        conversationId,
        readerId:    actor.id,
        readerModel: actor.model,
        readAt:      new Date(),
      });
    } catch (err) {
      console.error('Socket mark-read error:', err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${actor.model} "${actor.name}" — ${reason}`);
  });
});

const messageController = require('./controllers/messageController');
if (typeof messageController.setSocketIO === 'function') {
  messageController.setSocketIO(io);
}

/*
========================================
CORS + BODY PARSING
========================================
*/
app.use(cors({
  origin:  'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));
app.use(express.json());

/*
========================================
STATIC FILE SERVING
========================================
*/
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
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

app.use('/media', express.static(path.join(__dirname, 'media')));

/*
========================================
DATABASE
========================================
*/
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    if (process.env.ENABLE_STREAMING !== 'false') {
      try {
        const startStreaming = require('./streaming-server');
        startStreaming();
        console.log('RTMP streaming server started');
      } catch (err) {
        console.warn('RTMP server not started:', err.message);
      }
    }
  })
  .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });

/*
========================================
HEALTH
========================================
*/
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date() });
});

/*
========================================
ROUTES
========================================
*/
app.use('/api/auth',             authRoutes);
app.use('/api/videos',           videoRoutes);
app.use('/api/lives',            liveRoutes);
app.use('/api/users',            userRoutes);
app.use('/api/admin',            adminRoutes);
app.use('/api/live-qualification', liveQualificationRoutes);
app.use('/api/messages',         messageRoutes);
app.use('/api/uploads',          uploadRoutes);
// Primary route: /api/promotions
app.use('/api/promotions',       promotionRoutes);
// Backward-compat alias: /api/ads — keeps existing frontend requests.js working
app.use('/api/ads',              promotionRoutes);
app.use('/api/search',           searchRoutes);
app.use('/api/history',          historyRoutes);
app.use('/api/playlists',        playlistRoutes);
app.use('/api/comments',         commentRoutes);
app.use('/api/notifications',    notificationRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

/*
========================================
START
========================================
*/
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Narra API running on http://localhost:${PORT}`);
  console.log(`WebSocket running on ws://localhost:${PORT}`);
});