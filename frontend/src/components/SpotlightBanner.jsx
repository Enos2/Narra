/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * File: frontend/src/components/SpotlightBanner.jsx
 * Location: frontend/src/components/SpotlightBanner.jsx
 * User-facing label: "Sponsored" or "Campaign"
 * Internal name: spotlight / promotion
 * Purpose: Displays active campaigns to users on Home, VideoDetails, Dashboard, LiveWatch pages.
 * Targeting is handled server-side. This component just fetches and renders.
 * No emojis anywhere in this file.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./SpotlightBanner.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ─────────────────────────────────────────────
   Track impression (fire and forget)
───────────────────────────────────────────── */
const trackView = async (promotionId, token) => {
  try {
    await fetch(`${API_BASE}/api/ads/${promotionId}/impression`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
  } catch {
    /* non-critical, silent */
  }
};

/* ─────────────────────────────────────────────
   Track click (fire and forget)
───────────────────────────────────────────── */
const trackClick = async (promotionId, token) => {
  try {
    await fetch(`${API_BASE}/api/ads/${promotionId}/click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
  } catch {
    /* non-critical, silent */
  }
};

/* ─────────────────────────────────────────────
   Resolve media URL
───────────────────────────────────────────── */
const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
};

/* ─────────────────────────────────────────────
   Single Banner Card
───────────────────────────────────────────── */
const BannerCard = ({ promotion, token, variant = "banner" }) => {
  const [dismissed, setDismissed] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!viewTracked.current && promotion?._id) {
      trackView(promotion._id, token);
      viewTracked.current = true;
    }
  }, [promotion?._id, token]);

  const handleClick = () => {
    if (!promotion?.targetUrl) return;
    trackClick(promotion._id, token);
    window.open(promotion.targetUrl, "_blank", "noopener,noreferrer");
  };

  if (dismissed) return null;

  const mediaUrl = resolveUrl(promotion.mediaUrl);
  const thumbUrl = resolveUrl(promotion.thumbnailUrl);
  const isVideo  = promotion.type === "video";

  return (
    <div className={`sb-card sb-card--${variant}`} role="complementary" aria-label="Sponsored content">
      <div className="sb-card__label">Sponsored</div>

      <button
        className="sb-card__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Close sponsored content"
        title="Dismiss"
      >
        x
      </button>

      <div className="sb-card__media" onClick={handleClick}>
        {isVideo ? (
          <video
            className="sb-card__video"
            src={mediaUrl}
            poster={thumbUrl || undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            className="sb-card__image"
            src={mediaUrl}
            alt={promotion.title}
            loading="lazy"
          />
        )}
        <div className="sb-card__overlay">
          <span className="sb-card__cta">Learn More</span>
        </div>
      </div>

      {promotion.title && (
        <div className="sb-card__footer" onClick={handleClick}>
          <span className="sb-card__title">{promotion.title}</span>
          {promotion.description && (
            <span className="sb-card__desc">{promotion.description}</span>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Pre-roll / Mid-roll Video Overlay
   Shown before or during video playback
───────────────────────────────────────────── */
const VideoRollAd = ({ promotion, token, onComplete }) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [canSkip,     setCanSkip]     = useState(false);
  const [dismissed,   setDismissed]   = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!viewTracked.current && promotion?._id) {
      trackView(promotion._id, token);
      viewTracked.current = true;
    }
  }, [promotion?._id, token]);

  useEffect(() => {
    if (secondsLeft <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleSkip = () => {
    setDismissed(true);
    onComplete?.();
  };

  const handleClick = () => {
    trackClick(promotion._id, token);
    window.open(promotion.targetUrl, "_blank", "noopener,noreferrer");
  };

  if (dismissed) return null;

  return (
    <div className="sb-roll" role="dialog" aria-label="Sponsored video">
      <div className="sb-roll__label">Sponsored</div>

      <div className="sb-roll__media" onClick={handleClick}>
        {promotion.type === "video" ? (
          <video
            className="sb-roll__video"
            src={resolveUrl(promotion.mediaUrl)}
            poster={resolveUrl(promotion.thumbnailUrl) || undefined}
            autoPlay muted playsInline
          />
        ) : (
          <img
            className="sb-roll__image"
            src={resolveUrl(promotion.mediaUrl)}
            alt={promotion.title}
          />
        )}
      </div>

      <div className="sb-roll__controls">
        {promotion.title && (
          <span className="sb-roll__title">{promotion.title}</span>
        )}
        <button
          className={`sb-roll__skip${canSkip ? " sb-roll__skip--ready" : ""}`}
          onClick={canSkip ? handleSkip : undefined}
          disabled={!canSkip}
        >
          {canSkip ? "Skip" : `Skip in ${secondsLeft}s`}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Between-rows Spotlight Strip
   Rendered between content rows on Home page
───────────────────────────────────────────── */
const SpotlightStrip = ({ promotion, token }) => {
  const [dismissed, setDismissed] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!viewTracked.current && promotion?._id) {
      trackView(promotion._id, token);
      viewTracked.current = true;
    }
  }, [promotion?._id, token]);

  const handleClick = () => {
    trackClick(promotion._id, token);
    window.open(promotion.targetUrl, "_blank", "noopener,noreferrer");
  };

  if (dismissed) return null;

  return (
    <div className="sb-strip" role="complementary" aria-label="Sponsored content">
      <div className="sb-strip__inner" onClick={handleClick}>
        <div className="sb-strip__media">
          {promotion.type === "video" ? (
            <video
              src={resolveUrl(promotion.mediaUrl)}
              poster={resolveUrl(promotion.thumbnailUrl) || undefined}
              autoPlay muted loop playsInline
              className="sb-strip__video"
            />
          ) : (
            <img
              src={resolveUrl(promotion.mediaUrl)}
              alt={promotion.title}
              className="sb-strip__image"
              loading="lazy"
            />
          )}
        </div>
        <div className="sb-strip__content">
          <span className="sb-strip__label">Sponsored</span>
          {promotion.title && <p className="sb-strip__title">{promotion.title}</p>}
          {promotion.description && <p className="sb-strip__desc">{promotion.description}</p>}
          <span className="sb-strip__cta">Learn More</span>
        </div>
      </div>
      <button className="sb-strip__dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">x</button>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main SpotlightBanner component
   Usage:
     <SpotlightBanner placement="between-rows" token={token} />
     <SpotlightBanner placement="home-banner"  token={token} />
     <SpotlightBanner placement="pre-roll"     token={token} onComplete={fn} />
     <SpotlightBanner placement="sidebar"      token={token} />
───────────────────────────────────────────── */
const SpotlightBanner = ({ placement = "home-banner", token = null, onComplete = null }) => {
  const [promotion, setPromotion] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const fetched = useRef(false);

  const fetchPromotion = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;

    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res  = await fetch(`${API_BASE}/api/ads/active?placement=${placement}&limit=1`, { headers });
      const data = await res.json();

      if (data.success && data.promotions?.length > 0) {
        setPromotion(data.promotions[0]);
      } else if (data.success && data.ads?.length > 0) {
        // backward compat
        setPromotion(data.ads[0]);
      }
    } catch {
      /* silent — never crash the page over a campaign */
    } finally {
      setLoading(false);
    }
  }, [placement, token]);

  useEffect(() => {
    fetchPromotion();
  }, [fetchPromotion]);

  // Never show a loading state to users — just render nothing until ready
  if (loading || !promotion) return null;

  /* ── Choose the right display component based on placement ── */
  if (placement === "pre-roll" || placement === "mid-roll") {
    return <VideoRollAd promotion={promotion} token={token} onComplete={onComplete} />;
  }

  if (placement === "between-rows") {
    return <SpotlightStrip promotion={promotion} token={token} />;
  }

  // sidebar, home-banner, default
  return <BannerCard promotion={promotion} token={token} variant={placement === "sidebar" ? "sidebar" : "banner"} />;
};

export default SpotlightBanner;