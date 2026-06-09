/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
// File: frontend/src/components/NarraVideoPlayer.jsx
// Custom video player for Narra admin panel
// Keyboard: Space/K = pause, M = mute, Left/Right = ±10s, Up/Down = volume, F = fullscreen
// Admin-role themed (gold / blue / green) · logo watermark · no download
// Auto-play next episode - shows 40 seconds before episode ends with 7-second countdown

import React, { useRef, useState, useEffect, useCallback } from "react";
import "./NarraVideoPlayer.css";

const ADMIN_LOGOS = {
  superadmin:    "/src/assets/admin/Super-admin.png",
  platformadmin: "/src/assets/admin/Platform-admin.png",
  supportadmin:  "/src/assets/admin/Support-admin.png",
};

const ROLE_ACCENT = {
  superadmin:    "#FFD700",
  platformadmin: "#3B82F6",
  supportadmin:  "#22ff00",
};

const ROLE_LABEL = {
  superadmin:    "SUPER ADMIN",
  platformadmin: "PLATFORM ADMIN",
  supportadmin:  "SUPPORT ADMIN",
};

function fmt(s) {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function NarraVideoPlayer({ 
  src, 
  poster, 
  title, 
  role = "superadmin", 
  onClose,
  episodeQueue = [],
  currentEpisodeIndex = 0,
  onNextEpisode,
  onEpisodeEnded
}) {
  const videoRef  = useRef(null);
  const wrapRef   = useRef(null);
  const hideTimer = useRef(null);
  const nextTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hasShownPromptRef = useRef(false);

  const accent = ROLE_ACCENT[role] || "#FFD700";
  const logo   = ADMIN_LOGOS[role];

  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [volume,   setVolume]   = useState(1);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showCtrl, setShowCtrl] = useState(true);
  const [fullscr,  setFullscr]  = useState(false);
  const [nudge,    setNudge]    = useState(null);

  // Volume OSD state
  const [volOSD, setVolOSD] = useState(null); // { level, muted, key }
  const volOSDTimer = useRef(null);

  // Next episode UI state — 40s trigger, 7s countdown
  const NEXT_TRIGGER_SECS = 40;
  const NEXT_COUNTDOWN_SECS = 7;
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(NEXT_COUNTDOWN_SECS);
  const hasNextEpisode = episodeQueue.length > 0 && currentEpisodeIndex < episodeQueue.length - 1;

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (volOSDTimer.current) clearTimeout(volOSDTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Reset everything when src changes — kill timers, clear stale state
  useEffect(() => {
    if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setShowNextPrompt(false);
    setNextCountdown(NEXT_COUNTDOWN_SECS);
    hasShownPromptRef.current = false;
    // Clear stale video state so checkForNextEpisodePrompt can't fire with old duration/current
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
  }, [src]);

  // Auto-hide controls
  const resetHide = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowCtrl(false);
    }, 3000);
  }, []);

  // Volume OSD trigger
  const showVolumeOSD = useCallback((vol, isMuted) => {
    clearTimeout(volOSDTimer.current);
    setVolOSD({ level: isMuted ? 0 : vol, muted: isMuted, key: Date.now() });
    volOSDTimer.current = setTimeout(() => setVolOSD(null), 1800);
  }, []);

  // Check if we're 40 seconds from the end and show prompt
  const checkForNextEpisodePrompt = useCallback(() => {
    if (!hasNextEpisode) return;
    if (hasShownPromptRef.current) return;
    if (showNextPrompt) return;
    if (!duration || duration === 0) return;

    const timeLeft = duration - current;
    if (timeLeft <= NEXT_TRIGGER_SECS && timeLeft > 0) {
      hasShownPromptRef.current = true;
      setShowNextPrompt(true);
      setNextCountdown(NEXT_COUNTDOWN_SECS);

      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      countdownIntervalRef.current = setInterval(() => {
        setNextCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-play next after 7 seconds
      nextTimerRef.current = setTimeout(() => {
        if (onNextEpisode && hasNextEpisode) {
          setShowNextPrompt(false);
          setNextCountdown(NEXT_COUNTDOWN_SECS);
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          nextTimerRef.current = null;
          hasShownPromptRef.current = false;
          onNextEpisode();
        }
      }, NEXT_COUNTDOWN_SECS * 1000);
    }
  }, [current, duration, hasNextEpisode, showNextPrompt, onNextEpisode]);

  useEffect(() => {
    checkForNextEpisodePrompt();
  }, [current, checkForNextEpisodePrompt]);

  // Handle episode end (fallback)
  const handleVideoEnded = useCallback(() => {
    setPlaying(false);
    setShowCtrl(true);

    if (onEpisodeEnded) onEpisodeEnded();

    if (hasNextEpisode && !hasShownPromptRef.current) {
      if (onNextEpisode) onNextEpisode();
    }
  }, [hasNextEpisode, onNextEpisode, onEpisodeEnded]);

  // Immediately play next episode
  const triggerNextEpisode = useCallback(() => {
    if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setShowNextPrompt(false);
    setNextCountdown(NEXT_COUNTDOWN_SECS);
    hasShownPromptRef.current = false; // parent will change src, but reset here too for safety
    if (onNextEpisode && hasNextEpisode) onNextEpisode();
  }, [onNextEpisode, hasNextEpisode]);

  // Cancel — stay, watch credits, do NOT re-trigger
  const cancelNextEpisode = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowNextPrompt(false);
    // Keep hasShownPromptRef.current = true so prompt never reappears this episode
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ": case "k":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case "m": case "M":
          e.preventDefault();
          v.muted = !v.muted;
          setMuted(v.muted);
          showVolumeOSD(v.volume, v.muted);
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          setNudge({ dir: "right", k: Date.now() });
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          setNudge({ dir: "left", k: Date.now() });
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          v.muted = false;
          setVolume(v.volume);
          setMuted(false);
          showVolumeOSD(v.volume, false);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          if (v.volume === 0) v.muted = true;
          setVolume(v.volume);
          setMuted(v.muted);
          showVolumeOSD(v.volume, v.muted);
          break;
        case "f": case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        default: break;
      }
      resetHide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetHide, showVolumeOSD]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  const onLoadedMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    v.play().then(() => setPlaying(true)).catch(() => {});
  };

  const onPlay  = () => { setPlaying(true); resetHide(); };
  const onPause = () => { setPlaying(false); setShowCtrl(true); };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
    resetHide();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showVolumeOSD(v.volume, v.muted);
  };

  const handleVolumeChange = (e) => {
    const v = videoRef.current;
    const val = parseFloat(e.target.value);
    if (!v) return;
    v.volume = val;
    setVolume(val);
    v.muted = val === 0;
    setMuted(val === 0);
    showVolumeOSD(val, val === 0);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrent(v.currentTime);
    resetHide();
    // Reset prompt if seeking back before trigger window
    if (v.currentTime < duration - NEXT_TRIGGER_SECS - 1) {
      hasShownPromptRef.current = false;
      setShowNextPrompt(false);
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFullscr(true); }
    else { document.exitFullscreen?.(); setFullscr(false); }
  };

  useEffect(() => {
    const h = () => setFullscr(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const progressPct = duration ? (current / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const volPct = muted ? 0 : volume * 100;

  // Image-only mode (no src)
  if (!src) {
    return (
      <div className={`nvp-wrap nvp-role-${role}`} ref={wrapRef} style={{ "--accent": accent }}>
        {logo && <img src={logo} alt={ROLE_LABEL[role]} className="nvp-watermark" draggable={false} />}
        <div className="nvp-role-label">{ROLE_LABEL[role]}</div>
        {poster && <img src={poster} alt={title} className="nvp-poster-img" draggable={false} />}
        {onClose && <button className="nvp-close-overlay" onClick={onClose}>Close</button>}
      </div>
    );
  }

  return (
    <div
      className={`nvp-wrap nvp-role-${role} ${playing ? "nvp-playing" : "nvp-paused"}`}
      ref={wrapRef}
      style={{ "--accent": accent }}
      onMouseMove={resetHide}
      onMouseLeave={() => { if (playing) setShowCtrl(false); }}
    >
      {logo && <img src={logo} alt={ROLE_LABEL[role]} className="nvp-watermark" draggable={false} />}
      <div className="nvp-role-label">{ROLE_LABEL[role]}</div>

      {title && (
        <div className={`nvp-title-bar ${showCtrl ? "nvp-vis" : ""}`}>
          <span>{title}</span>
        </div>
      )}

      <video
        ref={videoRef}
        className="nvp-video"
        src={src}
        poster={poster}
        playsInline
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMeta}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={handleVideoEnded}
        onClick={togglePlay}
      />

      {/* ── Next Episode Card — Netflix style, small, bottom-right ── */}
      {showNextPrompt && hasNextEpisode && (
        <div className="nvp-next-episode-prompt">
          <span className="nvp-next-up-label">Next Episode in {nextCountdown}s</span>
          <span className="nvp-next-up-title">
            {episodeQueue[currentEpisodeIndex + 1]?.title || `Episode ${currentEpisodeIndex + 2}`}
          </span>
          <div className="nvp-next-up-actions">
            <button className="nvp-next-up-cancel" onClick={cancelNextEpisode}>Cancel</button>
            <button className="nvp-next-up-play" onClick={triggerNextEpisode}>Play Now</button>
          </div>
          <div className="nvp-next-up-bar">
            <div className="nvp-next-up-bar-fill" style={{ width: `${((NEXT_COUNTDOWN_SECS - nextCountdown) / NEXT_COUNTDOWN_SECS) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Volume OSD ── */}
      {volOSD && (
        <VolumeOSD
          key={volOSD.key}
          level={volOSD.level}
          muted={volOSD.muted}
          accent={accent}
        />
      )}

      {/* Nudge flash */}
      {nudge && <NudgeFlash key={nudge.k} dir={nudge.dir} accent={accent} />}

      {/* Center play */}
      {!playing && (
        <button className="nvp-center-play" onClick={togglePlay}><PlaySVG big /></button>
      )}

      {/* Controls */}
      <div className={`nvp-controls ${showCtrl ? "nvp-vis" : ""}`}>
        {/* Progress */}
        <div className="nvp-progress-area" onClick={handleSeek}>
          <div className="nvp-track">
            <div className="nvp-buf" style={{ width: `${bufferedPct}%` }} />
            <div className="nvp-fill" style={{ width: `${progressPct}%` }} />
            <div className="nvp-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <div className="nvp-times">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="nvp-btn-row">
          <div className="nvp-left">
            <button className="nvp-btn" onClick={togglePlay} title="Space">
              {playing ? <PauseSVG /> : <PlaySVG />}
            </button>
            <button className="nvp-btn" onClick={() => { videoRef.current.currentTime -= 10; setNudge({ dir: "left", k: Date.now() }); }} title="← 10s">
              <RewindSVG />
            </button>
            <button className="nvp-btn" onClick={() => { videoRef.current.currentTime += 10; setNudge({ dir: "right", k: Date.now() }); }} title="→ 10s">
              <ForwardSVG />
            </button>
            <div className="nvp-vol-group">
              <button className="nvp-btn" onClick={toggleMute} title="M">
                <VolumeIcon muted={muted} volume={volume} />
              </button>
              <div className="nvp-vol-track-wrap">
                <input
                  className="nvp-vol"
                  type="range" min={0} max={1} step={0.02}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                />
                <div className="nvp-vol-fill" style={{ width: `${volPct}%` }} />
              </div>
            </div>
          </div>

          <div className="nvp-right">
            <span className="nvp-hint">Space · M · ← →</span>
            <button className="nvp-btn" onClick={toggleFullscreen} title="F">
              <FullscreenSVG full={fullscr} />
            </button>
            {onClose && (
              <button className="nvp-btn nvp-close-btn" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Volume OSD Component ── */
function VolumeOSD({ level, muted, accent }) {
  const bars = 10;
  const filled = muted ? 0 : Math.round(level * bars);
  const pct = Math.round((muted ? 0 : level) * 100);

  return (
    <div className="nvp-vol-osd" style={{ "--accent": accent }}>
      <div className="nvp-vol-osd-icon">
        <VolumeIcon muted={muted} volume={level} />
      </div>
      <div className="nvp-vol-osd-bars">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`nvp-vol-osd-bar ${i < filled ? "nvp-vol-osd-bar--on" : ""}`}
            style={{ height: `${40 + i * 6}%` }}
          />
        ))}
      </div>
      <span className="nvp-vol-osd-pct">{pct}%</span>
      {muted && <span className="nvp-vol-osd-muted-badge">MUTED</span>}
    </div>
  );
}

function NudgeFlash({ dir, accent }) {
  return (
    <div className={`nvp-nudge nvp-nudge--${dir}`} style={{ "--accent": accent }}>
      <span className="nvp-nudge__arrow">{dir === "right" ? "»" : "«"}</span>
      <span className="nvp-nudge__label">{dir === "right" ? "+10s" : "-10s"}</span>
    </div>
  );
}

function PlaySVG({ big }) {
  const s = big ? 36 : 18;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>;
}
function PauseSVG() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1" /><rect x="15" y="3" width="4" height="18" rx="1" /></svg>;
}
function RewindSVG() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 2,12 11,19" /><polygon points="22,5 13,12 22,19" /></svg>;
}
function ForwardSVG() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><polygon points="13,5 22,12 13,19" /><polygon points="2,5 11,12 2,19" /></svg>;
}
function VolumeIcon({ muted, volume }) {
  if (muted || volume === 0) return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
      <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {volume > 0.5 && <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="2" fill="none" />}
      <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
function FullscreenSVG({ full }) {
  return full ? (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
    </svg>
  ) : (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
    </svg>
  );
}