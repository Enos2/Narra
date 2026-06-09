/* eslint-disable no-unused-vars */
// File: src/components/AdminVideoDeleteModal.jsx
import React from 'react';

const AdminVideoDeleteModal = ({ isOpen, onClose, video, onConfirm, isDeleting }) => {
  if (!isOpen || !video) return null;

  return (
    <div className="admin-video-delete-modal-overlay" onClick={onClose}>
      <div className="admin-video-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Delete Video</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p>Are you sure you want to delete <strong>{video.title}</strong>?</p>
          <p className="warning-text">This action cannot be undone.</p>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button 
            className="delete-btn" 
            onClick={() => onConfirm(video)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminVideoDeleteModal;