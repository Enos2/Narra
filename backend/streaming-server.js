/**
 * File: backend/streaming-server.js
 * Description: RTMP Media Server for live streaming
 * Uses Node-Media-Server for OBS streaming
 * RTMP Input → HLS Output for web playback
 */

const NodeMediaServer = require('node-media-server');
const path = require('path');
const fs = require('fs');

// Ensure media directory exists
const mediaRoot = path.join(__dirname, 'media');
if (!fs.existsSync(mediaRoot)) {
  fs.mkdirSync(mediaRoot, { recursive: true });
  console.log(`✓ Created media directory: ${mediaRoot}`);
}

// Configuration for Node-Media-Server
const config = {
  rtmp: {
    port: process.env.RTMP_PORT || 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
    ssl: false
  },
  http: {
    port: process.env.HLS_PORT || 8000,
    mediaroot: mediaRoot,
    allow_origin: '*',
    api: true
  },
  auth: {
    api: true,
    api_user: process.env.STREAM_API_USER || 'admin',
    api_pass: process.env.STREAM_API_PASS || 'admin123',
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false,
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
};

console.log('Streaming server configuration:');
console.log(`- RTMP Port: ${config.rtmp.port}`);
console.log(`- HLS Port: ${config.http.port}`);
console.log(`- Media Root: ${config.http.mediaroot}`);
console.log(`- FFmpeg Path: ${config.trans.ffmpeg}`);

// Create and start the media server
const nms = new NodeMediaServer(config);

// Event listeners for stream lifecycle
nms.on('preConnect', (id, args) => {
  console.log(`[RTMP] Client connecting: ${id}`);
});

nms.on('postConnect', (id, args) => {
  console.log(`[RTMP] Client connected: ${id}`);
});

nms.on('doneConnect', (id, args) => {
  console.log(`[RTMP] Client disconnected: ${id}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`[RTMP] Stream preparing to publish: ${StreamPath}`);
  
  // Extract stream key from StreamPath (format: live/{streamKey})
  const streamKey = StreamPath.split('/').pop();
  
  // Validate stream format
  if (!streamKey || streamKey.length < 10) {
    console.log(`[RTMP] Invalid stream key: ${streamKey}`);
    return;
  }
  
  console.log(`[RTMP] Stream key detected: ${streamKey}`);
  console.log(`[RTMP] Stream will be available at: http://localhost:${config.http.port}/live/${streamKey}/index.m3u8`);
  
  // You can add database validation here:
  // 1. Check if streamKey exists in your database
  // 2. Verify user has permission to stream
  // 3. Update stream status to 'live'
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log(`[RTMP] Stream published: ${StreamPath}`);
  
  const streamKey = StreamPath.split('/').pop();
  console.log(`[RTMP] ✅ Stream is now LIVE: ${streamKey}`);
  console.log(`[RTMP] 📺 Viewers can watch at: http://localhost:${config.http.port}/live/${streamKey}/index.m3u8`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`[RTMP] Stream ended: ${StreamPath}`);
  
  const streamKey = StreamPath.split('/').pop();
  console.log(`[RTMP] 🛑 Stream ENDED: ${streamKey}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log(`[RTMP] Viewer preparing to play: ${StreamPath}`);
});

nms.on('postPlay', (id, StreamPath, args) => {
  const streamKey = StreamPath.split('/').pop();
  console.log(`[RTMP] 👁️  Viewer started watching: ${streamKey}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  const streamKey = StreamPath.split('/').pop();
  console.log(`[RTMP] 👋 Viewer stopped watching: ${streamKey}`);
});

// Get server stats
nms.getServerStats = () => {
  return {
    rtmp: {
      port: config.rtmp.port,
      connections: Object.keys(nms.sessions).length
    },
    http: {
      port: config.http.port,
      mediaroot: config.http.mediaroot
    },
    streams: nms.sessions
  };
};

// Start the server
const startServer = () => {
  try {
    nms.run();
    
    console.log('============================================');
    console.log('🚀 RTMP MEDIA SERVER STARTED');
    console.log('============================================');
    console.log(`📡 RTMP Server: rtmp://localhost:${config.rtmp.port}/live`);
    console.log(`🎬 HLS Server: http://localhost:${config.http.port}`);
    console.log(`📊 Admin Panel: http://localhost:${config.http.port}/admin`);
    console.log(`📁 Media root: ${mediaRoot}`);
    console.log('============================================');
    console.log('🔧 CONFIGURATION:');
    console.log(`   RTMP Port: ${config.rtmp.port}`);
    console.log(`   HLS Port: ${config.http.port}`);
    console.log(`   FFmpeg: ${config.trans.ffmpeg}`);
    console.log(`   API User: ${config.auth.api_user}`);
    console.log(`   API Pass: ${config.auth.api_pass}`);
    console.log('============================================\n');
    console.log('📝 HOW TO STREAM:');
    console.log('   1. Create a live stream in Narra app');
    console.log('   2. Get your RTMP URL and Stream Key');
    console.log('   3. Configure OBS:');
    console.log('      - Server: rtmp://localhost:1935/live');
    console.log('      - Stream Key: your_stream_key_here');
    console.log('   4. Start streaming in OBS');
    console.log('   5. Viewers watch at:');
    console.log('      http://localhost:8000/live/your_stream_key_here/index.m3u8\n');
    
    return nms;
  } catch (error) {
    console.error('❌ Failed to start RTMP server:', error);
    console.log('⚠  Make sure FFmpeg is installed on your system');
    console.log('⚠  Windows: choco install ffmpeg');
    console.log('⚠  Mac: brew install ffmpeg');
    console.log('⚠  Linux: sudo apt install ffmpeg');
    return null;
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping RTMP Media Server...');
  if (nms && nms.stop) {
    nms.stop();
  }
  console.log('✅ RTMP Server stopped gracefully');
  process.exit(0);
});

// Export the server instance and start function
module.exports = startServer;