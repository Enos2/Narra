/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */

// frontend/src/components/UserVideoPreview.jsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import './UserVideoPreview.css';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);

const CommentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const UserVideoPreview = ({ video, onClose, onWatch, isOpen }) => {
  const { theme } = useTheme();
  const accent = theme?.accent || '#dc2626';
  const accentLight = theme?.accentLight || accent;

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [shareFeedback, setShareFeedback] = useState('');

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

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/watch/${video._id}`;
    const shareData = {
      title: video.title || 'Check this out on Narra',
      text: video.description ? video.description.slice(0, 140) : undefined,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      throw new Error('Web Share API unavailable');
    } catch (err) {
      // User cancelling the native share sheet also lands here — don't fall
      // through to clipboard in that case.
      if (err?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Link copied!');
        setTimeout(() => setShareFeedback(''), 2000);
      } catch {
        setShareFeedback('Could not copy link');
        setTimeout(() => setShareFeedback(''), 2000);
      }
    }
  };

  return (
    <div
      className="user-video-preview-overlay"
      onDoubleClick={onClose}
    >
      <div
        className="user-video-preview-modal"
        style={{ '--uvp-accent': accent, '--uvp-accent-light': accentLight }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button className="close-button" onClick={onClose} aria-label="Close preview">
          <CloseIcon />
        </button>

        <div className="video-preview-container">
          <video
            src={video.videoUrl || video.url}
            className="preview-video"
            poster={video.thumbnailUrl || video.thumbnail}
            controls
            controlsList="nodownload noremoteplayback noplaybackrate"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(e) => e.preventDefault()}
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
              <span className="stat-icon"><EyeIcon /></span>
              <span className="stat-value">{video.views?.toLocaleString() || 0}</span>
              <span className="stat-label">views</span>
            </div>
            <div className="stat">
              <span className="stat-icon"><HeartIcon /></span>
              <span className="stat-value">{video.likes?.toLocaleString() || 0}</span>
              <span className="stat-label">likes</span>
            </div>
            <div className="stat">
              <span className="stat-icon"><CommentIcon /></span>
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
            <button className="share-button" onClick={handleShare}>
              {shareFeedback || 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserVideoPreview;