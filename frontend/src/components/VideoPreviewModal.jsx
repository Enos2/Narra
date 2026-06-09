/* eslint-disable no-unused-vars */
// File: src/components/VideoPreviewModal.jsx
import React from 'react';

const VideoPreviewModal = ({ video, previewType, onClose, mediaBaseUrl }) => {
  if (!video || !onClose) return null;

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${mediaBaseUrl || 'http://localhost:5000'}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const renderContent = () => {
    switch (previewType) {
      case 'trailer':
        if (video.trailerUrl) {
          return (
            <video controls autoPlay className="preview-video">
              <source src={getFullUrl(video.trailerUrl)} type="video/mp4" />
            </video>
          );
        }
        return <div className="preview-placeholder">No trailer available</div>;
      
      case 'video':
        if (video.videoUrl) {
          return (
            <video controls autoPlay className="preview-video">
              <source src={getFullUrl(video.videoUrl)} type="video/mp4" />
            </video>
          );
        }
        return <div className="preview-placeholder">No video available</div>;
      
      case 'details':
      default:
        return (
          <div className="preview-details">
            <h3>{video.title}</h3>
            <p>{video.description || 'No description available'}</p>
            <div className="preview-meta">
              <span>Type: {video.type === 'series' ? 'Series' : 'Movie'}</span>
              <span>Duration: {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'N/A'}</span>
              {video.genre && video.genre.length > 0 && (
                <span>Genre: {video.genre.join(', ')}</span>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="video-preview-modal-overlay" onClick={onClose}>
      <div className="video-preview-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="video-preview-close" onClick={onClose}>×</button>
        <div className="video-preview-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default VideoPreviewModal;