const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// Routes
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const liveRoutes = require('./routes/liveRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const liveQualificationRoutes = require('./routes/liveQualificationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Middleware
const errorHandler = require('./middleware/errorMiddleware');
const { protect } = require('./middleware/authMiddleware');

const app = express();

/*
========================================
CREATE HTTP SERVER FOR SOCKET.IO
========================================
*/
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Range']
  }
});

// Make io accessible to controllers
app.set('io', io);

/*
========================================
SOCKET.IO CONNECTION HANDLER
========================================
*/
const jwt = require('jsonwebtoken');
const User = require('./models/User');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    // Check token version
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return next(new Error('Token expired'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.user.email} (${socket.user._id})`);

  // Join user's personal room
  socket.join(`user:${socket.user._id}`);

  // Handle joining conversation rooms
  socket.on('join-conversations', async (conversationIds) => {
    try {
      const Conversation = require('./models/Conversation');
      
      for (const convId of conversationIds) {
        const conversation = await Conversation.findById(convId);
        if (conversation && conversation.isParticipant(socket.user._id)) {
          socket.join(`conversation:${convId}`);
          console.log(`  Joined conversation: ${convId}`);
        }
      }
    } catch (err) {
      console.error('Error joining conversations:', err);
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
      userId: socket.user._id,
      username: socket.user.name,
      conversationId: data.conversationId,
      isTyping: data.isTyping
    });
  });

  // Handle read receipts
  socket.on('mark-read', async (data) => {
    try {
      const Message = require('./models/Message');
      await Message.updateMany(
        {
          conversationId: data.conversationId,
          senderId: { $ne: socket.user._id },
          'readBy.userId': { $ne: socket.user._id }
        },
        {
          $push: { readBy: { userId: socket.user._id, readAt: new Date() } }
        }
      );

      socket.to(`conversation:${data.conversationId}`).emit('messages-read', {
        conversationId: data.conversationId,
        userId: socket.user._id,
        readAt: new Date()
      });
    } catch (err) {
      console.error('Error marking read:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.user.email}`);
  });
});

/*
========================================
NOW CONNECT MESSAGE CONTROLLER TO SOCKET.IO
========================================
*/
// Pass io instance to message controller
const messageController = require('./controllers/messageController');
if (messageController && typeof messageController.setSocketIO === 'function') {
  messageController.setSocketIO(io);
  console.log('✅ Message controller connected to Socket.IO');
} else {
  console.warn('⚠️ Message controller setSocketIO method not found');
}

/*
========================================
GLOBAL MIDDLEWARE
========================================
*/
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
};

app.use(cors(corsOptions));
app.use(express.json());

// Video streaming headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, x-requested-with');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

app.use('/media', express.static(path.join(__dirname, 'media')));

/*
========================================
DATABASE CONNECTION
========================================
*/
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✓ MongoDB connected successfully');
    
    if (process.env.ENABLE_STREAMING === 'true' || !process.env.ENABLE_STREAMING) {
      try {
        const startStreamingServer = require('./streaming-server');
        startStreamingServer();
        console.log('✓ RTMP Streaming server started');
      } catch (error) {
        console.error('⚠ Failed to start RTMP server:', error.message);
      }
    }
  })
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err);
    process.exit(1);
  });

/*
========================================
HEALTH CHECK
========================================
*/
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Narra Backend</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #0a0a0a; color: #fff; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #4CAF50; }
          .card { background: #1a1a1a; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .endpoint { background: #2a2a2a; padding: 10px; border-radius: 5px; margin: 5px 0; font-family: monospace; }
          .status { display: inline-block; padding: 5px 10px; border-radius: 5px; font-weight: bold; }
          .online { background: #4CAF50; color: white; }
          .offline { background: #f44336; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Narra Backend API Server</h1>
          <div class="card">
            <h2>Status: <span class="status online">ONLINE</span></h2>
            <p>Server is running with video streaming and messaging support</p>
            <p>✅ Socket.io enabled for real-time messaging</p>
            <p>✅ Message controller connected to Socket.IO</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy', 
    timestamp: new Date(),
    server: 'Narra Backend API',
    version: '1.0.0',
    features: {
      video_upload: true,
      live_streaming: true,
      video_streaming: true,
      user_authentication: true,
      admin_moderation: true,
      realtime_messaging: true,
      age_verification: true,
      avatar_upload: true,
      follow_system: true,
      twin_detection: true
    }
  });
});

/*
========================================
API ROUTES
========================================
*/
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/lives', liveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live-qualification', liveQualificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

/*
========================================
404 HANDLER
========================================
*/
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    requested_url: req.originalUrl
  });
});

/*
========================================
GLOBAL ERROR HANDLER
========================================
*/
app.use(errorHandler);

/*
========================================
SERVER START
========================================
*/
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('============================================');
  console.log('🚀 NARRA BACKEND SERVER STARTED');
  console.log('============================================');
  console.log(`📡 API Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📁 Video files: http://localhost:${PORT}/uploads`);
  console.log(`💬 Messaging system: ACTIVE`);
  console.log(`✅ Message controller: CONNECTED`);
  console.log('============================================\n');
});