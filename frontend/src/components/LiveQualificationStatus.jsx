/* eslint-disable no-unused-vars */
// File: src/components/LiveQualificationStatus.jsx
import React from 'react';

const LiveQualificationStatus = ({ qualificationStatus, userStats, requirements, isLiveActive }) => {
  if (!qualificationStatus) return null;

  const getStatusColor = () => {
    if (qualificationStatus.qualified) return '#00ff11';
    if (qualificationStatus.pending) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusText = () => {
    if (qualificationStatus.qualified) return 'Qualified to Go Live';
    if (qualificationStatus.pending) return 'Pending Review';
    return 'Not Qualified';
  };

  return (
    <div className="live-qualification-status">
      <div className="status-header" style={{ borderColor: getStatusColor() }}>
        <h3>Live Streaming Status</h3>
        <span className="status-badge" style={{ background: getStatusColor() }}>
          {getStatusText()}
        </span>
      </div>

      <div className="status-body">
        <div className="requirements-list">
          <h4>Requirements:</h4>
          <ul>
            <li className={requirements?.followersMet ? 'met' : 'not-met'}>
              {requirements?.followersMet ? '✓' : '○'} {requirements?.requiredFollowers || 50} Followers
            </li>
            <li className={requirements?.watchTimeMet ? 'met' : 'not-met'}>
              {requirements?.watchTimeMet ? '✓' : '○'} {requirements?.requiredWatchTime || 60} Minutes Watch Time
            </li>
            <li className={requirements?.accountAgeMet ? 'met' : 'not-met'}>
              {requirements?.accountAgeMet ? '✓' : '○'} Account Age: {requirements?.accountAgeDays || 0}/{requirements?.requiredAccountAge || 7} Days
            </li>
          </ul>
        </div>

        {userStats && (
          <div className="user-stats">
            <h4>Your Stats:</h4>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value">{userStats.followers || 0}</span>
                <span className="stat-label">Followers</span>
              </div>
              <div className="stat">
                <span className="stat-value">{userStats.watchTime || 0} min</span>
                <span className="stat-label">Watch Time</span>
              </div>
              <div className="stat">
                <span className="stat-value">{userStats.accountAge || 0} days</span>
                <span className="stat-label">Account Age</span>
              </div>
            </div>
          </div>
        )}

        {!qualificationStatus.qualified && qualificationStatus.reason && (
          <div className="status-message" style={{ color: '#f97316' }}>
            {qualificationStatus.reason}
          </div>
        )}

        {qualificationStatus.qualified && !isLiveActive && (
          <button className="start-live-btn">
            Start Live Stream
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveQualificationStatus;