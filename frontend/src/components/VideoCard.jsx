/* eslint-disable no-unused-vars */
// frontend/src/components/VideoCard.jsx
import React, { useState } from 'react';
import './VideoCard.css';

const VideoCard = ({ video, onClick, isAuthenticated, user, token }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  if (!video) return null;

  const handleClick = () => {
    if (onClick) {
      onClick(video);
    }
  };

  const formatViews = (views) => {
    if (!views) return '0 views';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div 
      className="video-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowOptions(false);
      }}
      onClick={handleClick}
    >
      <div className="video-card-thumbnail">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        ) : (
          <div className="thumbnail-placeholder">
            <span>🎬</span>
          </div>
        )}
        
        {video.isLive && (
          <div className="live-badge">
            <span className="live-dot"></span>
            LIVE
          </div>
        )}
        
        {video.duration && !video.isLive && (
          <div className="duration-badge">
            {formatDuration(video.duration)}
          </div>
        )}
        
        {isHovered && !video.isLive && (
          <div className="play-overlay">
            <div className="play-button">▶</div>
          </div>
        )}
      </div>
      
      <div className="video-card-info">
        <div className="video-card-details">
          <h4 className="video-card-title">
            {video.title || 'Untitled'}
          </h4>
          <p className="video-card-creator">
            {video.creator?.name || video.creator?.username || 'Unknown Creator'}
          </p>
          <div className="video-card-stats">
            <span className="views">{formatViews(video.views)}</span>
            {video.uploadedAt && (
              <span className="upload-date">
                {new Date(video.uploadedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        {isHovered && !video.isLive && (
          <div className="video-card-hover">
            <button className="watch-now-btn" onClick={handleClick}>
              Watch Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCard;