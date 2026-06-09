/* eslint-disable no-unused-vars */
// File: frontend/src/components/LiveApprovalCard.jsx
import React from "react";
import "./LiveApprovalCard.css";

export default function LiveApprovalCard({ 
  user, 
  adminUser, 
  onViewDetails, 
  onGrantPrivilege, 
  onRevokePrivilege, 
  onAddStrike,
  onRemoveStrike,
  actionLoading 
}) {
  const { 
    _id, 
    name, 
    email, 
    canGoLive, 
    canGoLiveReason, 
    approvedVideoCount = 0, 
    totalVideoViews = 0,
    accountAgeDays = 0,
    activeStrikes = 0,
    liveStrikes = []
  } = user;

  const getStatusBadge = () => {
    if (!canGoLive) {
      return { text: 'PENDING', class: 'pending', icon: '⏳' };
    }
    if (canGoLiveReason === 'auto_qualified') {
      return { text: 'AUTO-QUALIFIED', class: 'auto-qualified', icon: '⚡' };
    }
    if (canGoLiveReason === 'manual_admin_approval') {
      return { text: 'M-APPROVED', class: 'manual-approved', icon: '' };
    }
    if (canGoLiveReason === 'revoked') {
      return { text: 'REVOKED', class: 'revoked', icon: '🚫' };
    }
    return { text: 'UNKNOWN', class: 'unknown', icon: '❓' };
  };

  const status = getStatusBadge();
  const qualifiesAutomatically = approvedVideoCount >= 3 && totalVideoViews >= 500 && accountAgeDays >= 30 && activeStrikes === 0;
  const hasStrikes = liveStrikes && liveStrikes.length > 0;

  return (
    <div className="live-approval-card">
      <div className="card-header">
        <div className="user-avatar">
          {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <h3 className="user-name">{name || 'Unknown User'}</h3>
          <p className="user-email">{email}</p>
        </div>
        <div className={`status-badge ${status.class}`}>
          <span className="status-icon">{status.icon}</span>
          <span className="status-text">{status.text}</span>
        </div>
      </div>

      <div className="card-stats">
        <div className="stat-item">
          <div className="stat-label">Approved Videos</div>
          <div className={`stat-value ${approvedVideoCount >= 3 ? 'met' : 'not-met'}`}>
            {approvedVideoCount} / 3
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Total Views</div>
          <div className={`stat-value ${totalVideoViews >= 500 ? 'met' : 'not-met'}`}>
            {totalVideoViews.toLocaleString()} / 500
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Account Age</div>
          <div className={`stat-value ${accountAgeDays >= 30 ? 'met' : 'not-met'}`}>
            {accountAgeDays} days
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Active Strikes</div>
          <div className={`stat-value ${activeStrikes === 0 ? 'met' : 'not-met'}`}>
            {activeStrikes}
          </div>
        </div>
      </div>

      <div className="qualification-status">
        {qualifiesAutomatically && !canGoLive ? (
          <div className="auto-qualify-notice">
            <span className="notice-icon">⚡</span>
            <span>Qualifies automatically</span>
          </div>
        ) : !qualifiesAutomatically && !canGoLive ? (
          <div className="missing-requirements">
            <span className="missing-icon">❌</span>
            <span>Missing requirements</span>
          </div>
        ) : (
          <div className="approved-status">
            <span className="approved-icon">✅</span>
            <span>Live streaming enabled</span>
          </div>
        )}
      </div>

      <div className="card-actions">
        <button
          onClick={onViewDetails}
          className="btn-details"
          disabled={actionLoading}
        >
          View Details
        </button>
        
        {adminUser.role !== 'supportadmin' && (
          <>
            {!canGoLive ? (
              <button
                onClick={onGrantPrivilege}
                className="btn-approve"
                disabled={actionLoading}
              >
                Grant Privileges
              </button>
            ) : (
              <button
                onClick={onRevokePrivilege}
                className="btn-revoke"
                disabled={actionLoading}
              >
                Revoke Privileges
              </button>
            )}
            
            <button
              onClick={onAddStrike}
              className="btn-strike"
              disabled={actionLoading}
            >
              Add Strike
            </button>

            {hasStrikes && (
              <button
                onClick={onRemoveStrike}
                className="btn-remove-strike"
                disabled={actionLoading}
              >
                Remove Strike
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}