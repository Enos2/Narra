/* eslint-disable no-unused-vars */
/**
 * File: frontend/src/pages/LiveStream.jsx
 * Now reads accent color from ThemeContext instead of hardcoded #043ede
 * Theme, layout and all behaviour preserved exactly.
 * FIXED: Added base API URL to axios calls
 */

import React, { useState, useRef, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import useHlsPlayer from "../utils/useHlsPlayer";
import axios from "axios";
import LiveQualificationStatus from "../components/LiveQualificationStatus";
import "./LiveStream.css";

// API Base URL - uses environment variable or falls back to production
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://narra-q4p4.onrender.com";

const GENRES = [
  "Drama", "Music", "Concert", "Comedy", "Action", "Gaming", "Documentary", "Education",
];
const AGE_RATINGS = ["G", "PG", "13+", "16+", "18+"];

export default function LiveStream() {
  const { user, token, isAuthReady, canGoLive } = useAppContext();
  const { theme } = useTheme();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [ageRating, setAgeRating] = useState("");
  const [genres, setGenres] = useState([]);
  const [purpose, setPurpose] = useState("normal");
  const [explanation, setExplanation] = useState("");
  const [explanationVideo, setExplanationVideo] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = React.useRef(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [liveId, setLiveId] = useState("");
  const [liveStatus, setLiveStatus] = useState("pending");
  const [showBlocked, setShowBlocked] = useState(false);
  const [qualificationResolved, setQualificationResolved] = useState(false);

  const videoRef = useRef(null);

  // Use global theme accent instead of hardcoded blue
  const themeColor = theme.accent;
  const themeGlow = `rgba(${parseInt(theme.accent.slice(1,3),16)}, ${parseInt(theme.accent.slice(3,5),16)}, ${parseInt(theme.accent.slice(5,7),16)}, 0.3)`;

  const formComplete =
    title && description && ageRating && genres.length > 0 &&
    ((purpose === "sponsored" || purpose === "fundraiser") ? explanation : true) &&
    (!isPaid || price > 0);

  const toggleGenre = (genre) => {
    if (!canGoLive && !qualificationResolved) return handleBlockedInput();
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleBlockedInput = () => {
    setShowBlocked(true);
    setTimeout(() => setShowBlocked(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canGoLive && !qualificationResolved) return handleBlockedInput();
    if (!formComplete) return setError("Please fill all required fields.");
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // FIXED: Use full API URL with axios
      const data = {
        title, description, ageRating, tags: genres,
        isSponsored: purpose === "sponsored",
        sponsorDescription: purpose === "sponsored" ? explanation : "",
        isFundraiser: purpose === "fundraiser",
        fundraiserDescription: purpose === "fundraiser" ? explanation : "",
        isPaid: false, price: 0, currency,
        thumbnailUrl: "", category: "general", scheduledAt: null,
      };
      const res = await axios.post(`${API_BASE_URL}/api/lives`, data, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const live = res.data.live;
      setLiveId(live._id);
      setLiveStatus(live.approved ? "approved" : "pending");
      setRtmpUrl(live.rtmpUrl || live.streamUrl || "");
      setStreamKey(live.streamKey || "");
      if (live.approved) {
        setPreviewUrl(live.hlsUrl || `http://localhost:8000/live/${live.streamKey}/index.m3u8`);
      }
    } catch (err) {
      console.error("Create live error:", err);
      if (err.response?.data?.notQualified) {
        setError("You do not have live streaming privileges yet.");
      } else if (err.response) {
        setError(err.response.data?.message || `Server error: ${err.response.status}`);
      } else if (err.request) {
        setError("Network Error: Could not connect to server.");
      } else {
        setError(err.message || "Failed to create live stream.");
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  useHlsPlayer(videoRef, previewUrl);

  if (!isAuthReady) return <div className="live-wrapper"><p>Initializing session…</p></div>;

  if (!canGoLive && !qualificationResolved) {
    return (
      <div className="live-wrapper">
        <div className="claw-background">
          <div className="claw claw-1"></div><div className="claw claw-2"></div>
          <div className="claw claw-3"></div><div className="claw claw-4"></div>
          <div className="claw claw-5"></div>
          <div className="scar-diagonal scar-diag-1"></div><div className="scar-diagonal scar-diag-2"></div>
          <div className="scratch-horizontal scratch-h-1"></div><div className="scratch-horizontal scratch-h-2"></div>
          <div className="triple-claw triple-1"><span></span><span></span><span></span></div>
          <div className="triple-claw triple-2"><span></span><span></span><span></span></div>
          <div className="scar-x scar-x-1"></div>
        </div>
        <div className="blood-stroke top"></div>
        <div className="blood-stroke bottom"></div>
        <div className="live-page" style={{ paddingTop: '1rem' }}>
          <header className="live-header">
            <div className="header-scar" style={{ background: themeColor }}></div>
            <h1 style={{ background: `linear-gradient(135deg, #fff, ${themeColor})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              START LIVE STREAM
            </h1>
            <p>Broadcast your moment to the world</p>
          </header>
          <section className="live-section" style={{ borderColor: themeColor }}>
            <h2 className="section-title">
              <span className="section-icon" style={{ color: themeColor }}>▸</span>
              LIVE STREAMING ACCESS
            </h2>
            <LiveQualificationStatus token={token} onQualified={() => setQualificationResolved(true)} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="live-wrapper">
      <div className="claw-background">
        <div className="claw claw-1"></div><div className="claw claw-2"></div>
        <div className="claw claw-3"></div><div className="claw claw-4"></div>
        <div className="claw claw-5"></div><div className="claw claw-6"></div>
        <div className="claw claw-7"></div><div className="claw claw-8"></div>
        <div className="claw claw-9"></div><div className="claw claw-10"></div>
        <div className="claw claw-11"></div><div className="claw claw-12"></div>
        <div className="scar-diagonal scar-diag-1"></div><div className="scar-diagonal scar-diag-2"></div>
        <div className="scar-diagonal scar-diag-3"></div><div className="scar-diagonal scar-diag-4"></div>
        <div className="scratch-horizontal scratch-h-1"></div><div className="scratch-horizontal scratch-h-2"></div>
        <div className="scratch-horizontal scratch-h-3"></div><div className="scratch-horizontal scratch-h-4"></div>
        <div className="scratch-horizontal scratch-h-5"></div>
        <div className="scratch-vertical scratch-v-1"></div><div className="scratch-vertical scratch-v-2"></div>
        <div className="scratch-vertical scratch-v-3"></div><div className="scratch-vertical scratch-v-4"></div>
        <div className="triple-claw triple-1"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-2"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-3"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-4"><span></span><span></span><span></span></div>
        <div className="scar-x scar-x-1"></div><div className="scar-x scar-x-2"></div><div className="scar-x scar-x-3"></div>
      </div>

      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>

      {showBlocked && (
        <div className="blocked-overlay">
          <div className="blocked-icon"></div>
          <h1 style={{ color: themeColor, textShadow: `0 0 30px ${themeColor}` }}>✕</h1>
          <p>{liveStatus === "rejected" ? "Streaming access revoked" : "You cannot go live"}</p>
        </div>
      )}

      <form className="live-page" onSubmit={handleSubmit}>
        <header className="live-header">
          <div className="header-scar" style={{ background: themeColor }}></div>
          <h1 style={{ background: `linear-gradient(135deg, #fff, ${themeColor})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            START LIVE STREAM
          </h1>
          <p>Broadcast your moment to the world</p>
        </header>

        {error && <div className="live-error"><span className="error-icon" style={{ color: themeColor }}>⚠</span> {error}</div>}
        {liveStatus === "rejected" && <div className="live-error">Your live stream has been removed by an admin.</div>}

        <section className="live-section" style={{ borderColor: themeColor }}>
          <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>STREAM INFORMATION</h2>
          <input className="live-input" type="text" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} style={{ borderColor: themeColor }} />
          <textarea className="live-textarea" placeholder="Description *" value={description} onChange={(e) => setDescription(e.target.value)} style={{ borderColor: themeColor }} rows="3" />
          <label className="file-label">Thumbnail (optional)</label>
          <input className="live-file" type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files[0])} style={{ borderColor: themeColor }} />
          <label className="file-label">Trailer (optional)</label>
          <input className="live-file" type="file" accept="video/*" onChange={(e) => setTrailer(e.target.files[0])} style={{ borderColor: themeColor }} />
        </section>

        <section className="live-section" style={{ borderColor: themeColor }}>
          <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>CLASSIFICATION</h2>
          <div className="genres">
            {GENRES.map((g) => (
              <button
                type="button" key={g}
                className={`genre-btn ${genres.includes(g) ? "genre-selected" : ""}`}
                onClick={() => toggleGenre(g)}
                style={genres.includes(g) ? { background: themeColor, borderColor: themeColor } : { borderColor: themeColor }}
              >
                {g}
              </button>
            ))}
          </div>
          <select className="live-select" value={ageRating} onChange={(e) => setAgeRating(e.target.value)} style={{ borderColor: themeColor }}>
            <option value="">Select Age Rating *</option>
            {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </section>

        <section className="live-section" style={{ borderColor: themeColor }}>
          <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>PURPOSE</h2>
          <div className="purpose-options">
            {["normal", "sponsored", "fundraiser"].map((p) => (
              <label className="purpose-label" key={p}>
                <input type="radio" value={p} checked={purpose === p} onChange={() => setPurpose(p)} style={{ accentColor: themeColor }} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>
          {(purpose === "sponsored" || purpose === "fundraiser") && (
            <>
              <textarea className="live-textarea" placeholder={`Explain the ${purpose === "sponsored" ? "sponsorship" : "cause"} *`} value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ borderColor: themeColor }} rows="2" />
              <label className="file-label">Explanation Video (optional)</label>
              <input className="live-file" type="file" accept="video/*" onChange={(e) => setExplanationVideo(e.target.files[0])} style={{ borderColor: themeColor }} />
            </>
          )}
        </section>

        <section className="live-section" style={{ borderColor: themeColor }}>
          <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>MONETIZATION</h2>
          <div className="monetization-fields">
            <div style={{
              background: 'rgba(0, 200, 100, 0.07)', border: '1px solid rgba(0, 200, 100, 0.2)',
              borderRadius: '10px', padding: '0.85rem 1rem', color: '#4cd964',
              fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span>✓</span>
              <span>All live streams are currently <strong>free</strong> for viewers. Paid streaming coming soon.</span>
            </div>
          </div>
        </section>

        {rtmpUrl && streamKey && (
          <section className="live-section" style={{ borderColor: themeColor }}>
            <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>STREAMING SETUP</h2>
            <p className="setup-note">Use these in OBS / Streamlabs / any RTMP software to go live</p>
            <div className="stream-info">
              <label>RTMP Server URL</label>
              <input type="text" value={rtmpUrl.replace(`/${streamKey}`, '') || 'rtmp://localhost:1935/live'} readOnly style={{ borderColor: themeColor, background: "#0a0a0a" }} />
              <label>Stream Key</label>
              <input type="text" value={streamKey} readOnly style={{ borderColor: themeColor, background: "#0a0a0a" }} />
            </div>
            <div style={{ marginTop: '0.75rem', padding: '0.85rem', background: `rgba(${parseInt(themeColor.slice(1,3),16)},${parseInt(themeColor.slice(3,5),16)},${parseInt(themeColor.slice(5,7),16)}, 0.05)`, borderRadius: '8px', fontSize: '0.8rem', color: '#6b6b6b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <p>1. Open OBS → Settings → Stream → Service: Custom</p>
              <p>2. Paste the RTMP URL and Stream Key above</p>
              <p>3. Click <strong style={{ color: theme.accentLight || themeColor }}>Start Streaming</strong> in OBS</p>
              <p>4. Visit your stream page and click <strong style={{ color: theme.accentLight || themeColor }}>Go Live</strong></p>
            </div>
            {liveStatus === "pending" && liveId && <div className="live-pending small">Waiting for guardian approval before you can start streaming…</div>}
            {liveStatus === "approved" && <div style={{ marginTop: '0.5rem', color: '#4cd964', fontSize: '0.85rem', fontWeight: '600' }}>✓ Approved! Configure OBS and start streaming.</div>}
          </section>
        )}

        {previewUrl && liveStatus === "approved" && (
          <section className="live-section" style={{ borderColor: themeColor }}>
            <h2 className="section-title"><span className="section-icon" style={{ color: themeColor }}>▸</span>PREVIEW STREAM</h2>
            <video ref={videoRef} controls className="live-video" />
          </section>
        )}

        <div className="live-actions">
          <button
            type="submit"
            className="primary-btn"
            disabled={isSubmitting || (!!liveId && liveStatus === 'approved')}
            style={{ background: formComplete ? themeColor : "#333", borderColor: themeColor }}
          >
            {isSubmitting ? "SUBMITTING..." : liveId ? "CREATE ANOTHER STREAM" : "CREATE LIVE STREAM"}
          </button>
        </div>

        <div className="live-note">
          <small>* Configure OBS with your stream key and start streaming immediately</small>
        </div>
      </form>
    </div>
  );
}