/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */

// frontend/src/components/UserVideoPreview.jsx
import React, { useState, useEffect } from 'react';
import './UserVideoPreview.css';

const UserVideoPreview = ({ video, onClose, onWatch, isOpen }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  if (!isOpen || !video) return null;

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="user-video-preview-overlay" onClick={onClose}>
      <div className="user-video-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        
        <div className="video-preview-container">
          <video 
            src={video.videoUrl || video.url}
            className="preview-video"
            poster={video.thumbnailUrl || video.thumbnail}
            controls
            autoPlay={false}
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
          />
        </div>
        
        <div className="video-preview-info">
          <h3 className="video-title">{video.title || 'Untitled Video'}</h3>
          
          <div className="video-creator">
            <img 
              src={video.creatorAvatar || '/default-avatar.png'} 
              alt={video.creatorName}
              className="creator-avatar"
            />
            <span className="creator-name">{video.creatorName || 'Unknown Creator'}</span>
          </div>
          
          <p className="video-description">
            {video.description || 'No description available'}
          </p>
          
          <div className="video-stats">
            <div className="stat">
              <span className="stat-icon">👁️</span>
              <span className="stat-value">{video.views?.toLocaleString() || 0}</span>
              <span className="stat-label">views</span>
            </div>
            <div className="stat">
              <span className="stat-icon">❤️</span>
              <span className="stat-value">{video.likes?.toLocaleString() || 0}</span>
              <span className="stat-label">likes</span>
            </div>
            <div className="stat">
              <span className="stat-icon">💬</span>
              <span className="stat-value">{video.comments?.toLocaleString() || 0}</span>
              <span className="stat-label">comments</span>
            </div>
          </div>
          
          <div className="video-actions">
            <button 
              className="watch-full-button"
              onClick={() => onWatch && onWatch(video)}
            >
              Watch Full Video
            </button>
            <button className="share-button">
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserVideoPreview;