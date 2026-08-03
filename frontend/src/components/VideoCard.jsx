/* eslint-disable no-unused-vars */
// frontend/src/components/VideoCard.jsx
import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import './VideoCard.css';

const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7L8 5Z" />
  </svg>
);

const FilmIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" />
  </svg>
);

const ThumbUpIcon = ({ filled }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v12M15 5.88 14 10h6.42a2 2 0 0 1 1.94 2.5l-2.06 8a2 2 0 0 1-1.94 1.5H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 .5-1.32L13 2a2.5 2.5 0 0 1 2 2.5v1.38Z" />
  </svg>
);

const ThumbDownIcon = ({ filled }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 14V2M9 18.12 10 14H3.58a2 2 0 0 1-1.94-2.5l2.06-8A2 2 0 0 1 5.64 2H15a2 2 0 0 1 2 2v9a2 2 0 0 1-.5 1.32L11 22a2.5 2.5 0 0 1-2-2.5v-1.38Z" />
  </svg>
);

const VideoCard = ({ video, onClick, isAuthenticated, user, token }) => {
  const { theme } = useTheme();
  const accent = theme.accent;
  const accentLight = theme.accentLight || theme.accent;

  const [isHovered, setIsHovered] = useState(false);
  const [reaction, setReaction] = useState(null); // 'like' | 'dislike' | null

  if (!video) return null;

  const handleClick = () => { if (onClick) onClick(video); };

  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return `${views}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleReaction = (e, type) => {
    e.stopPropagation();
    setReaction(prev => (prev === type ? null : type));
    // TODO: wire to /api/videos/:id/react once that endpoint exists
  };

  return (
    <div
      className="video-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{ '--vc-accent': accent, '--vc-accent-light': accentLight }}
    >
      <div className="video-card-thumbnail">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        ) : (
          <div className="thumbnail-placeholder">
            <FilmIcon />
          </div>
        )}

        {video.isLive && (
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
        )}

        {video.duration && !video.isLive && (
          <div className="duration-badge">{formatDuration(video.duration)}</div>
        )}

        {isHovered && !video.isLive && (
          <div className="play-overlay" style={{ background: `radial-gradient(circle, rgba(${accentRgbFrom(accent)},0.25), rgba(0,0,0,0.55))` }}>
            <div className="play-button" style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }}>
              <PlayIcon />
            </div>
          </div>
        )}
      </div>

      <div className="video-card-info">
        <div className="video-card-details">
          <h4 className="video-card-title">{video.title || 'Untitled'}</h4>
          <p className="video-card-creator">
            {video.creator?.name || video.creator?.username || 'Unknown Creator'}
          </p>
          <div className="video-card-stats">
            <span className="views">
              <EyeIcon /> {formatViews(video.views)}
            </span>
            {video.uploadedAt && (
              <span className="upload-date">{new Date(video.uploadedAt).toLocaleDateString()}</span>
            )}

            <span className="reactions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`reaction-btn ${reaction === 'like' ? 'active' : ''}`}
                style={reaction === 'like' ? { color: accent } : {}}
                onClick={(e) => handleReaction(e, 'like')}
                aria-label="Like"
              >
                <ThumbUpIcon filled={reaction === 'like'} />
              </button>
              <button
                type="button"
                className={`reaction-btn ${reaction === 'dislike' ? 'active' : ''}`}
                style={reaction === 'dislike' ? { color: accent } : {}}
                onClick={(e) => handleReaction(e, 'dislike')}
                aria-label="Dislike"
              >
                <ThumbDownIcon filled={reaction === 'dislike'} />
              </button>
            </span>
          </div>
        </div>

        {isHovered && !video.isLive && (
          <div className="video-card-hover">
            <button
              className="watch-now-btn"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }}
              onClick={handleClick}
            >
              Watch Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function accentRgbFrom(hex) {
  if (!hex || hex[0] !== '#') return '139, 0, 0';
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

export default VideoCard;