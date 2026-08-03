/* eslint-disable no-unused-vars */
// File: src/components/AdminVideoDeleteModal.jsx
import React, { useState } from 'react';

const AdminVideoDeleteModal = ({ video, user, onClose, onConfirm, actionLoading }) => {
  const [deleteType, setDeleteType] = useState('soft'); // 'soft' or 'permanent'
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  if (!video) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      setReasonError('Please provide a reason for deletion');
      return;
    }
    onConfirm(deleteType, reason);
  };

  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div className="admin-video-delete-modal-overlay" onClick={onClose}>
      <div className="admin-video-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Delete Video: {video.title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="delete-type-selector">
            <label className="delete-option">
              <input
                type="radio"
                value="soft"
                checked={deleteType === 'soft'}
                onChange={() => setDeleteType('soft')}
              />
              <div>
                <strong>Soft Delete (Move to Trash)</strong>
                <p>Video can be restored later. Creator will be notified.</p>
              </div>
            </label>
            
            {isSuperAdmin && (
              <label className="delete-option">
                <input
                  type="radio"
                  value="permanent"
                  checked={deleteType === 'permanent'}
                  onChange={() => setDeleteType('permanent')}
                />
                <div>
                  <strong>Permanent Delete</strong>
                  <p className="warning-text">⚠️ IRREVERSIBLE - Video will be completely removed from database.</p>
                </div>
              </label>
            )}
          </div>

          <div className="reason-input">
            <label htmlFor="deleteReason">Reason for deletion:</label>
            <textarea
              id="deleteReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError('');
              }}
              placeholder="Enter reason for deletion..."
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
            {reasonError && <span className="reason-error">{reasonError}</span>}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={actionLoading}>
            Cancel
          </button>
          <button 
            className={`delete-btn ${deleteType === 'permanent' ? 'delete-btn--perm' : 'delete-btn--soft'}`}
            onClick={handleConfirm}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : (deleteType === 'permanent' ? 'Permanently Delete' : 'Move to Trash')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminVideoDeleteModal;