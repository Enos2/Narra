/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * LiveWatch.jsx — redesigned streaming page
 * Features:
 *  - Twitch-style overlay chat (toggle with O key or button)
 *  - Detachable, draggable floating chat window
 *  - Custom SVG player controls (no generic emoji icons)
 *  - Cinematic dark aesthetic with theme-accent accents
 *  - Chat persists via localStorage
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';
import Hls from 'hls.js';
import LiveChat from '../components/LiveChat';
import './LiveWatch.css';

const API        = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const buildHlsUrl = (streamKey) =>
  streamKey ? `http://localhost:5000/live/${streamKey}/index.m3u8` : null;

/* ── Background decoration (preserved) ── */
function LiveDecor() {
  return (
    <div className="lw-decor" aria-hidden="true">
      {[...Array(12)].map((_, i) => <div key={i} className={`lw-decor-claw lw-decor-claw-${i + 1}`} />)}
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`lw-decor-triple lw-decor-triple-${i + 1}`}><span /><span /><span /></div>
      ))}
      {[...Array(6)].map((_, i) => <div key={i} className={`lw-decor-drip lw-decor-drip-${i + 1}`} />)}
      {[...Array(4)].map((_, i) => <div key={i} className={`lw-decor-scratch lw-decor-scratch-${i + 1}`} />)}
    </div>
  );
}

/* ── SVG Icons (custom, not generic emoji) ── */
const IconVolume = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconMute = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconFullscreen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M8 3H5a2 2 0 00-2 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 8V5a2 2 0 00-2-2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 16v3a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 21h3a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconExitFullscreen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M8 3v3a2 2 0 01-2 2H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 8h-3a2 2 0 01-2-2V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 16h3a2 2 0 012 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 21v-3a2 2 0 012-2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconOverlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M6 16l3-3 2 2 3-4 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 8h4M6 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconDetach = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M15 3h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 14L21 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClose = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconDrag = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="7" r="1.5" fill="currentColor" />
    <circle cx="15" cy="7" r="1.5" fill="currentColor" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9" cy="17" r="1.5" fill="currentColor" />
    <circle cx="15" cy="17" r="1.5" fill="currentColor" />
  </svg>
);

export default function LiveWatch() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const { user, token } = useAppContext();

  const [live,        setLive]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [streamState, setStreamState] = useState('loading');
  const [viewerCount, setViewerCount] = useState(0);
  const [isHost,      setIsHost]      = useState(false);

  const socketRef     = useRef(null);
  const socketInitRef = useRef(false);

  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`narra_chat_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [socketConnected, setSocketConnected] = useState(false);

  const videoRef      = useRef(null);
  const hlsRef        = useRef(null);
  const hlsKeyRef     = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [muted,       setMuted]       = useState(true);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [showControls,setShowControls]= useState(true);
  const fullscreenContainerRef = useRef(null);
  const ctrlTimerRef  = useRef(null);

  /* ── Chat display modes ── */
  // 'sidebar' | 'overlay' | 'detached' | 'closed'
  const [chatMode, setChatMode] = useState('sidebar');

  /* ── Detached chat position & drag ── */
  const [chatPos, setChatPos]       = useState({ x: null, y: null });
  const [dragging, setDragging]     = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const detachedRef = useRef(null);

  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (id && chatMessages.length > 0) {
      try {
        localStorage.setItem(`narra_chat_${id}`, JSON.stringify(chatMessages.slice(-200)));
      } catch {}
    }
  }, [chatMessages, id]);

  /* ── Keyboard shortcut: O = overlay, C = close/open ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'o' || e.key === 'O') {
        setChatMode((m) => m === 'overlay' ? 'sidebar' : 'overlay');
      }
      if (e.key === 'c' || e.key === 'C') {
        setChatMode((m) => m === 'closed' ? 'sidebar' : 'closed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const revealControls = () => {
    setShowControls(true);
    if (ctrlTimerRef.current) clearTimeout(ctrlTimerRef.current);
    ctrlTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  };

  /* ── Data ── */
  const fetchLive = useCallback(async () => {
    try {
      const res  = await axios.get(`${API}/lives/${id}`, { headers: authHeader });
      const data = res.data.live;
      const hlsUrl = buildHlsUrl(data.streamKey);
      setLive({ ...data, hlsUrl, playbackUrl: hlsUrl });
      setViewerCount(data.viewerCount || 0);
      setIsHost(
        data.host?._id?.toString() === (user?._id || user?.id) ||
        data.host?.toString()      === (user?._id || user?.id)
      );
      if      (data.status === 'live')      setStreamState('live');
      else if (data.status === 'ended')     setStreamState('ended');
      else if (data.status === 'scheduled') setStreamState('scheduled');
      else if (data.status === 'pending')   setStreamState('pending');
      else                                  setStreamState('offline');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stream.');
      setStreamState('offline');
    } finally {
      setLoading(false);
    }
  }, [id, token, user]);

  const joinStream = useCallback(async () => {
    try {
      const res  = await axios.post(`${API}/lives/${id}/join`, {}, { headers: authHeader });
      const data = res.data.live;
      const hlsUrl = buildHlsUrl(data.streamKey);
      setLive(p => ({ ...p, ...data, hlsUrl, playbackUrl: hlsUrl }));
      setViewerCount(data.viewerCount || 0);
      setIsHost(data.isHost || false);
    } catch {}
  }, [id, token]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchLive();
  }, [id, token, fetchLive, navigate]);

  useEffect(() => {
    if (streamState === 'live') joinStream();
  }, [streamState, joinStream]);

  /* ── Socket ── */
  useEffect(() => {
    if (!token || !id || socketInitRef.current) return;
    socketInitRef.current = true;
    const socket = socketIO(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect',    () => { setSocketConnected(true);  socket.emit('live:join', { liveId: id }); });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('live:chat:message', msg => setChatMessages(p => [...p.slice(-199), msg]));
    socket.on('live:chat:deleted', ({ messageId }) => setChatMessages(p => p.filter(m => m.id !== messageId)));
    socket.on('viewer:update', ({ viewerCount: vc }) => setViewerCount(vc));
    socket.on('stream:started', ({ startedAt }) => {
      setStreamState('live');
      setLive(p => {
        if (!p) return p;
        const url = buildHlsUrl(p.streamKey);
        return { ...p, playbackUrl: url, hlsUrl: url, startedAt, status: 'live' };
      });
    });
    socket.on('stream:ended', ({ message }) => {
      setStreamState('ended');
      setChatMessages(p => [...p, { id: 'system-ended', name: 'System', text: message || 'Stream has ended.', sentAt: new Date(), isSystem: true }]);
    });
    socket.on('stream:warning', ({ message }) =>
      setChatMessages(p => [...p, { id: `warn-${Date.now()}`, name: 'Admin', text: message, sentAt: new Date(), isSystem: true, isWarning: true }])
    );
    socket.on('live:approved', ({ title }) =>
      setChatMessages(p => [...p, { id: `approved-${Date.now()}`, name: 'System', text: `"${title}" approved! You can now start streaming.`, sentAt: new Date(), isSystem: true }])
    );
    return () => {
      socket.emit('live:leave', { liveId: id });
      socket.disconnect();
      socketRef.current     = null;
      socketInitRef.current = false;
    };
  }, [token, id]);

  /* ── HLS ── */
  const startHls = useCallback((videoEl, streamKey) => {
    if (!videoEl || !streamKey) return;
    if (hlsKeyRef.current === streamKey) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    hlsKeyRef.current = streamKey;
    setPlayerReady(false);
    const hlsUrl = buildHlsUrl(streamKey);

    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 1, liveMaxLatencyDurationCount: 2,
        liveBackBufferLength: 0, maxBufferLength: 2, maxMaxBufferLength: 4,
        backBufferLength: 0, enableWorker: true, lowLatencyMode: true,
        manifestLoadingMaxRetry: 25, manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 30000, levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 500, fragLoadingMaxRetry: 10, fragLoadingRetryDelay: 500,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlayerReady(true);
        if (hls.liveSyncPosition) videoEl.currentTime = hls.liveSyncPosition;
        videoEl.play().catch(() => { videoEl.muted = true; videoEl.play().catch(() => {}); });
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        if (data.details?.live && hls.liveSyncPosition) {
          const drift = hls.liveSyncPosition - videoEl.currentTime;
          if (drift > 2) videoEl.currentTime = hls.liveSyncPosition;
        }
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setTimeout(() => { if (hlsRef.current) { hlsRef.current.loadSource(hlsUrl); hlsRef.current.startLoad(); } }, 1000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy(); hlsRef.current = null; hlsKeyRef.current = null; setPlayerReady(false);
        }
      });
      hlsRef.current = hls;
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hlsUrl;
      videoEl.addEventListener('loadedmetadata', () => {
        setPlayerReady(true);
        if (isFinite(videoEl.duration)) videoEl.currentTime = videoEl.duration;
        videoEl.play().catch(() => {});
      });
    }
  }, []);

  useEffect(() => {
    const streamKey = live?.streamKey;
    if (!streamKey) return;
    if (videoRef.current) { startHls(videoRef.current, streamKey); return; }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (videoRef.current) { clearInterval(timer); startHls(videoRef.current, streamKey); }
      else if (attempts >= 40) clearInterval(timer);
    }, 100);
    return () => {
      clearInterval(timer);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; hlsKeyRef.current = null; }
      setPlayerReady(false);
    };
  }, [live?.streamKey, startHls]);

  /* ── Player controls ── */
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!fullscreenContainerRef.current) return;
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* ── Draggable detached chat ── */
  const startDetach = () => {
    if (chatMode !== 'detached') {
      setChatPos({ x: window.innerWidth - 360, y: 80 });
      setChatMode('detached');
    }
  };

  const handleDragStart = (e) => {
    if (chatMode !== 'detached') return;
    e.preventDefault();
    setDragging(true);
    setDragOffset({
      x: e.clientX - (chatPos.x || 0),
      y: e.clientY - (chatPos.y || 0),
    });
  };

  const handleDragMove = useCallback((e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x));
    const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
    setChatPos({ x, y });
  }, [dragging, dragOffset]);

  const handleDragEnd = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [dragging, handleDragMove]);

  /* ── Host actions ── */
  const handleStartStream = async () => {
    try {
      const res  = await axios.post(`${API}/lives/${id}/start`, {}, { headers: authHeader });
      const data = res.data.live;
      const url  = buildHlsUrl(data.streamKey);
      setStreamState('live');
      setLive(p => p ? { ...p, status: 'live', hlsUrl: url, playbackUrl: url } : p);
    } catch (err) { alert(err.response?.data?.message || 'Failed to start stream.'); }
  };

  const handleStopStream = async () => {
    if (!window.confirm('End this live stream?')) return;
    try {
      await axios.post(`${API}/lives/${id}/stop`, {}, { headers: authHeader });
      setStreamState('ended');
      setLive(p => p ? { ...p, status: 'ended', playbackUrl: null } : p);
    } catch (err) { alert(err.response?.data?.message || 'Failed to stop stream.'); }
  };

  const sendMessage = (text) => {
    if (!socketRef.current || !text.trim()) return;
    socketRef.current.emit('live:chat', { liveId: id, text });
  };

  if (!token) return null;

  if (loading) return (
    <div className="lw-page">
      <LiveDecor />
      <div className="lw-stroke lw-stroke-t" /><div className="lw-stroke lw-stroke-b" />
      <div className="lw-center-state"><div className="lw-spinner" /><p>Loading stream…</p></div>
    </div>
  );

  if (error && !live) return (
    <div className="lw-page">
      <LiveDecor />
      <div className="lw-stroke lw-stroke-t" /><div className="lw-stroke lw-stroke-b" />
      <div className="lw-center-state">
        <div className="lw-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M1 6s4-2 11-2 11 2 11 2v3s-4 2-11 2S1 9 1 9V6z" stroke="currentColor" strokeWidth="1.5"/><path d="M1 9v9s4 2 11 2 11-2 11-2V9" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="2" x2="8" y2="22" stroke="currentColor" strokeWidth="1.5"/></svg>
        </div>
        <h2>Stream Unavailable</h2>
        <p>{error}</p>
        <button className="lw-btn-primary" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    </div>
  );

  const hostName = live?.host?.username || live?.host?.firstName || 'Streamer';
  const showVideo = !!live?.streamKey;
  const chatProps = {
    messages: chatMessages,
    onSend: sendMessage,
    currentUserId: user?._id || user?.id,
    currentUserName: user?.username || user?.firstName || 'You',
    currentUserRole: user?.role,
    chatEnabled: live?.chatEnabled !== false,
    isLive: streamState === 'live',
    socketConnected,
  };

  return (
    <div className={`lw-page ${chatMode === 'sidebar' ? 'lw-chat-open' : ''} ${fullscreen ? 'lw-fs' : ''}`}>
      <LiveDecor />
      <div className="lw-stroke lw-stroke-t" />
      <div className="lw-stroke lw-stroke-b" />

      {/* ── Body ── */}
      <div className="lw-body" ref={fullscreenContainerRef}>

        {/* ── Video column ── */}
        <div className="lw-video-col">

          {/* Player wrapper */}
          <div
            className="lw-player-wrap"
            onMouseMove={revealControls}
            onClick={revealControls}
          >
            {showVideo && (
              <video
                ref={videoRef}
                className="lw-video"
                autoPlay
                playsInline
                muted={muted}
                poster={live?.thumbnailUrl || ''}
              />
            )}

            {/* Connecting overlay */}
            {showVideo && !playerReady && (
              <div className="lw-player-overlay">
                <div className="lw-spinner" />
                <p>Connecting to stream…</p>
              </div>
            )}

            {/* State overlays (not live) */}
            {!showVideo && (
              <div className="lw-player-overlay lw-player-overlay-solid">
                {live?.thumbnailUrl && <img src={live.thumbnailUrl} alt="thumbnail" className="lw-thumb-blur" />}
                <div className="lw-overlay-content">
                  {streamState === 'loading' && <><div className="lw-spinner" /><p>Connecting…</p></>}
                  {streamState === 'pending' && (
                    <>
                      <div className="lw-state-icon lw-state-icon-svg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                      <h3>Awaiting Approval</h3>
                      <p>This stream is pending admin approval.</p>
                      {isHost && <p className="lw-hint-box">Once approved, configure OBS and click Go Live.</p>}
                    </>
                  )}
                  {streamState === 'scheduled' && (
                    <>
                      <div className="lw-state-icon lw-state-icon-svg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg>
                      </div>
                      <h3>Scheduled</h3>
                      <p>Starting <strong>{live?.scheduledAt ? new Date(live.scheduledAt).toLocaleString() : 'soon'}</strong>.</p>
                    </>
                  )}
                  {streamState === 'ended' && (
                    <>
                      <div className="lw-state-icon lw-state-icon-svg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><polygon points="23,7 16,12 23,17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg>
                      </div>
                      <h3>Stream Ended</h3>
                      <p>Thanks for watching!</p>
                      <button className="lw-btn-primary" onClick={() => navigate('/')}>Browse Streams</button>
                    </>
                  )}
                  {streamState === 'offline' && (
                    <>
                      <div className="lw-state-icon lw-state-icon-svg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10.71 5.05A16 16 0 0122.56 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8.53 16.11a6 6 0 016.95 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="20" x2="12.01" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                      <h3>Stream Offline</h3>
                      <p>{error || 'Not available right now.'}</p>
                      <button className="lw-btn-primary" onClick={() => navigate('/')}>Go Back</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Overlay chat (Twitch-style) ── */}
            {chatMode === 'overlay' && playerReady && (
              <div className="lw-chat-overlay-layer">
                <LiveChat {...chatProps} overlayMode={true} />
              </div>
            )}

            {/* ── Controls bar ── */}
            {playerReady && (
              <div className={`lw-controls ${showControls ? 'lw-controls-show' : ''}`}>
                <div className="lw-controls-left">
                  <button className="lw-ctrl-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                    {muted ? <IconMute /> : <IconVolume />}
                  </button>
                  <div className="lw-live-badge-ctrl">
                    <span className="lw-live-dot-ctrl" />
                    LIVE
                  </div>
                  {viewerCount > 0 && (
                    <span className="lw-viewer-ctrl">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      {viewerCount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="lw-controls-right">
                  {/* Chat mode toggle buttons */}
                  <button
                    className={`lw-ctrl-btn ${chatMode === 'overlay' ? 'lw-ctrl-active' : ''}`}
                    onClick={() => setChatMode(m => m === 'overlay' ? 'sidebar' : 'overlay')}
                    title="Toggle overlay chat (O)"
                  >
                    <IconOverlay />
                  </button>
                  <button
                    className={`lw-ctrl-btn ${chatMode === 'sidebar' ? 'lw-ctrl-active' : ''}`}
                    onClick={() => setChatMode(m => m === 'sidebar' ? 'closed' : 'sidebar')}
                    title="Toggle sidebar chat (C)"
                  >
                    <IconChat />
                  </button>
                  <button className="lw-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen">
                    {fullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Info panel ── */}
          <div className="lw-info-panel">
            <div className="lw-info-top">
              <div className="lw-host-row">
                <div className="lw-host-avatar">
                  {live?.host?.avatar
                    ? <img src={`http://localhost:5000${live.host.avatar}`} alt={hostName} />
                    : <span>{hostName[0]?.toUpperCase()}</span>
                  }
                </div>
                <div className="lw-host-meta">
                  <div className="lw-host-name">
                    {hostName}
                    {live?.host?.isVerified && (
                      <span className="lw-verified-badge">
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </div>
                  {streamState === 'live' && (
                    <div className="lw-live-since">
                      Live since {live?.startedAt ? new Date(live.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'just now'}
                    </div>
                  )}
                </div>
              </div>

              {/* Host controls */}
              {isHost && (
                <div className="lw-host-controls">
                  {((streamState === 'pending' && live?.approved) || streamState === 'scheduled') && (
                    <button className="lw-btn-primary lw-btn-go-live" onClick={handleStartStream}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="white"/></svg>
                      Go Live
                    </button>
                  )}
                  {streamState === 'live' && (
                    <button className="lw-btn-danger" onClick={handleStopStream}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
                      End Stream
                    </button>
                  )}
                </div>
              )}
            </div>

            <h1 className="lw-title">{live?.title}</h1>
            {live?.description && <p className="lw-description">{live.description}</p>}

            <div className="lw-tags">
              {live?.category && <span className="lw-tag lw-tag-cat">{live.category}</span>}
              {live?.tags?.map(t => <span key={t} className="lw-tag">{t}</span>)}
              <span className="lw-tag lw-tag-free">FREE</span>
            </div>

            {/* Chat mode hint */}
            <div className="lw-chat-mode-hint">
              <span>Chat:</span>
              <button
                className={`lw-mode-pill ${chatMode === 'sidebar' ? 'lw-mode-active' : ''}`}
                onClick={() => setChatMode('sidebar')}
              >Sidebar</button>
              <button
                className={`lw-mode-pill ${chatMode === 'overlay' ? 'lw-mode-active' : ''}`}
                onClick={() => setChatMode('overlay')}
              >Overlay</button>
              <button
                className={`lw-mode-pill ${chatMode === 'detached' ? 'lw-mode-active' : ''}`}
                onClick={startDetach}
              >Detach</button>
              <button
                className={`lw-mode-pill ${chatMode === 'closed' ? 'lw-mode-active' : ''}`}
                onClick={() => setChatMode('closed')}
              >Hide</button>
            </div>

            {/* OBS Setup */}
            {isHost && live?.streamKey && (
              <details className="lw-obs-wrap">
                <summary className="lw-obs-summary">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{marginRight:'6px'}}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  OBS / Streaming Setup
                </summary>
                <div className="lw-obs-body">
                  <div className="lw-obs-field">
                    <label>RTMP Server URL</label>
                    <div className="lw-obs-row">
                      <input readOnly value="rtmp://localhost:1935/live" />
                      <button onClick={() => navigator.clipboard.writeText('rtmp://localhost:1935/live')}>Copy</button>
                    </div>
                  </div>
                  <div className="lw-obs-field">
                    <label>Stream Key</label>
                    <div className="lw-obs-row">
                      <input readOnly value={live.streamKey} type="password" id="lw-sk" />
                      <button onClick={() => { const el = document.getElementById('lw-sk'); if(el) el.type = el.type==='password'?'text':'password'; }}>Show</button>
                      <button onClick={() => navigator.clipboard.writeText(live.streamKey)}>Copy</button>
                    </div>
                  </div>
                  <ol className="lw-obs-steps">
                    <li>Open OBS → Settings → Stream → Service: <strong>Custom</strong></li>
                    <li>Server: <code>rtmp://localhost:1935/live</code></li>
                    <li>Paste your stream key above</li>
                    <li>Click <strong>Start Streaming</strong> in OBS</li>
                    <li>Stream goes live automatically once OBS connects</li>
                  </ol>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* ── Sidebar chat ── */}
        {chatMode === 'sidebar' && (
          <aside className="lw-chat-col">
            {/* Sidebar header with mode controls */}
            <div className="lw-chat-col-header">
              <span className="lw-chat-col-title">
                <span className={`lw-chat-dot ${socketConnected ? 'lw-chat-dot-on' : 'lw-chat-dot-off'}`} />
                Live Chat
              </span>
              <div className="lw-chat-col-actions">
                <button
                  className="lw-chat-action-btn"
                  onClick={startDetach}
                  title="Detach chat"
                >
                  <IconDetach />
                </button>
                <button
                  className="lw-chat-action-btn"
                  onClick={() => setChatMode('overlay')}
                  title="Overlay mode"
                >
                  <IconOverlay />
                </button>
                <button
                  className="lw-chat-action-btn"
                  onClick={() => setChatMode('closed')}
                  title="Close chat"
                >
                  <IconClose />
                </button>
              </div>
            </div>
            <LiveChat {...chatProps} />
          </aside>
        )}
      </div>

      {/* ── Detached floating chat ── */}
      {chatMode === 'detached' && (
        <div
          ref={detachedRef}
          className="lw-chat-detached"
          style={{
            left: chatPos.x ?? window.innerWidth - 360,
            top: chatPos.y ?? 80,
            cursor: dragging ? 'grabbing' : 'default',
          }}
        >
          <div
            className="lw-detached-header"
            onMouseDown={handleDragStart}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          >
            <div className="lw-detached-header-left">
              <span className="lw-detached-drag"><IconDrag /></span>
              <span className={`lw-chat-dot ${socketConnected ? 'lw-chat-dot-on' : 'lw-chat-dot-off'}`} />
              <span className="lw-detached-title">Live Chat</span>
            </div>
            <div className="lw-detached-actions">
              <button
                className="lw-chat-action-btn"
                onClick={() => setChatMode('sidebar')}
                title="Dock chat"
              >
                <IconPin />
              </button>
              <button
                className="lw-chat-action-btn"
                onClick={() => setChatMode('closed')}
                title="Close"
              >
                <IconClose />
              </button>
            </div>
          </div>
          <div className="lw-detached-body">
            <LiveChat {...chatProps} />
          </div>
        </div>
      )}

      {/* ── Floating reopen button ── */}
      {chatMode === 'closed' && (
        <button
          className="lw-floating-chat-btn"
          onClick={() => setChatMode('sidebar')}
          title="Open chat"
        >
          <IconChat />
        </button>
      )}

      {/* Keyboard hint */}
      {playerReady && (
        <div className="lw-kbd-hint">
          <kbd>O</kbd> overlay · <kbd>C</kbd> sidebar
        </div>
      )}
    </div>
  );
}