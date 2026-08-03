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
  actionLoading,
  themeColor 
}) {
  const { 
    _id, 
    name, 
    email, 
    avatar,
    canGoLive, 
    canGoLiveReason, 
    approvedVideoCount = 0, 
    totalVideoViews = 0,
    accountAgeDays = 0,
    activeStrikes = 0,
    liveStrikes = []
  } = user;

  // Get theme color based on admin role if not passed
  const getThemeColor = () => {
    if (themeColor) return themeColor;
    switch(adminUser?.role) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };

  const getStatusBadge = () => {
    if (!canGoLive) {
      return { text: 'PENDING', class: 'pending' };
    }
    if (canGoLiveReason === 'auto_qualified') {
      return { text: 'AUTO-QUALIFIED', class: 'auto-qualified' };
    }
    if (canGoLiveReason === 'manual_admin_approval') {
      return { text: 'MANUAL APPROVED', class: 'manual-approved' };
    }
    if (canGoLiveReason === 'revoked') {
      return { text: 'REVOKED', class: 'revoked' };
    }
    return { text: 'UNKNOWN', class: 'unknown' };
  };

  const status = getStatusBadge();
  const qualifiesAutomatically = approvedVideoCount >= 3 && totalVideoViews >= 500 && accountAgeDays >= 30 && activeStrikes === 0;
  const hasStrikes = liveStrikes && liveStrikes.length > 0;
  const accentColor = getThemeColor();

  // Helper function to format view count
  const formatViewCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="lac-card" style={{ '--accent': accentColor }}>
      <div className="lac-header">
        <div className="lac-avatar-container">
          {avatar ? (
            <img 
              src={avatar} 
              alt={name || email} 
              className="lac-avatar-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.querySelector('.lac-avatar-fallback').style.display = 'flex';
              }}
            />
          ) : null}
          <div className="lac-avatar-fallback" style={{ display: avatar ? 'none' : 'flex', background: `linear-gradient(135deg, ${accentColor}, ${accentColor}80)` }}>
            {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="lac-info">
          <h3 className="lac-name">{name || 'Unknown User'}</h3>
          <p className="lac-email">{email}</p>
        </div>
        <div className={`lac-status-badge ${status.class}`} style={{ background: `${accentColor}20`, color: accentColor }}>
          <span className="lac-status-text">{status.text}</span>
        </div>
      </div>

      <div className="lac-stats">
        <div className="lac-stat-item">
          <div className="lac-stat-label">Approved Videos</div>
          <div className={`lac-stat-value approved-videos ${approvedVideoCount >= 3 ? 'met' : 'not-met'}`}>
            <span className="stat-number">{approvedVideoCount}</span>
            <span className="stat-max">/3</span>
          </div>
        </div>
        
        <div className="lac-stat-item">
          <div className="lac-stat-label">Total Views</div>
          <div className={`lac-stat-value total-views ${totalVideoViews >= 500 ? 'met' : 'not-met'}`}>
            <span className="stat-number">{formatViewCount(totalVideoViews)}</span>
            <span className="stat-max">/500</span>
          </div>
        </div>
        
        <div className="lac-stat-item">
          <div className="lac-stat-label">Account Age</div>
          <div className={`lac-stat-value account-age ${accountAgeDays >= 30 ? 'met' : 'not-met'}`}>
            <span className="stat-number">{accountAgeDays}</span>
            <span className="stat-max">days</span>
          </div>
        </div>
        
        <div className="lac-stat-item">
          <div className="lac-stat-label">Active Strikes</div>
          <div className={`lac-stat-value active-strikes ${activeStrikes === 0 ? 'met' : 'not-met'}`}>
            <span className="stat-number">{activeStrikes}</span>
            <span className="stat-max">strikes</span>
          </div>
        </div>
      </div>

      <div className="lac-qualification-status">
        {qualifiesAutomatically && !canGoLive ? (
          <div className="lac-auto-qualify-notice" style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
            <svg className="lac-notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
              <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
            </svg>
            <span>Qualifies automatically</span>
          </div>
        ) : !qualifiesAutomatically && !canGoLive ? (
          <div className="lac-missing-requirements" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <svg className="lac-missing-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Missing requirements</span>
          </div>
        ) : (
          <div className="lac-approved-status" style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
            <svg className="lac-approved-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Live streaming enabled</span>
          </div>
        )}
      </div>

      <div className="lac-actions">
        <button
          onClick={onViewDetails}
          className="lac-btn lac-btn-details"
          disabled={actionLoading}
        >
          View Details
        </button>
        
        {adminUser.role !== 'supportadmin' && (
          <>
            {!canGoLive ? (
              <button
                onClick={onGrantPrivilege}
                className="lac-btn lac-btn-grant"
                style={{ background: accentColor, color: '#000000' }}
                disabled={actionLoading}
              >
                Grant Privileges
              </button>
            ) : (
              <button
                onClick={onRevokePrivilege}
                className="lac-btn lac-btn-revoke"
                style={{ borderColor: accentColor, color: accentColor }}
                disabled={actionLoading}
              >
                Revoke Privileges
              </button>
            )}
            
            <button
              onClick={onAddStrike}
              className="lac-btn lac-btn-strike"
              disabled={actionLoading}
            >
              Add Strike
            </button>

            {hasStrikes && onRemoveStrike && (
              <button
                onClick={onRemoveStrike}
                className="lac-btn lac-btn-remove-strike"
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