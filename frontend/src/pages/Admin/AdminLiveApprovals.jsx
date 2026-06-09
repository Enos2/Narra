/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/**
 * File: frontend/src/pages/admin/AdminLiveApprovals.jsx
 * Description: Admin panel for managing live streaming approvals
 * Using AdminLayout wrapper
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { 
  getUsersNeedingLiveApproval, 
  setLivePrivilege, 
  addLiveStrike,
  getUserLiveDetails,
  getUsers
} from '../../requests';
import LiveApprovalCard from '../../components/LiveApprovalCard';
import './AdminLiveApprovals.css';

const AdminLiveApprovals = () => {
  const { user, token } = useAppContext();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  
  // User data states
  const [allUsers, setAllUsers] = useState([]);
  const [usersNeedingApproval, setUsersNeedingApproval] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    approvedUsers: 0,
    pendingUsers: 0,
    autoQualified: 0,
    manuallyApproved: 0,
    revokedUsers: 0,
    totalStrikes: 0
  });

  // Get role-specific theme color
  const getThemeColor = () => {
    switch(user?.role) {
      case 'superadmin':
        return '#f8b305'; // Gold/Yellow
      case 'platformadmin':
        return '#043ede'; // Blue
      case 'supportadmin':
        return '#00a321'; // Green
      default:
        return '#f8b305';
    }
  };

  // Get role-specific gradient
  const getThemeGradient = () => {
    switch(user?.role) {
      case 'superadmin':
        return 'linear-gradient(135deg, #f8b305 0%, #ffd966 100%)';
      case 'platformadmin':
        return 'linear-gradient(135deg, #043ede 0%, #4d7eff 100%)';
      case 'supportadmin':
        return 'linear-gradient(135deg, #00a321 0%, #4cd964 100%)';
      default:
        return 'linear-gradient(135deg, #f8b305 0%, #ffd966 100%)';
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('🔍 AdminLiveApprovals - Debug Info:');
    console.log('   user:', user ? { id: user.id, role: user.role } : 'null');
    console.log('   token:', token ? `${token.substring(0, 30)}... (${token.length} chars)` : 'null');
  }, [user, token]);

  useEffect(() => {
    // Check if user is authenticated and is an admin
    if (!user) {
      console.log('No user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    if (!['superadmin', 'platformadmin', 'supportadmin'].includes(user.role)) {
      console.log('User is not admin, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }

    // Check if token exists
    if (!token) {
      console.log('No token found, redirecting to login');
      setError('Authentication token missing. Please login again.');
      navigate('/login');
      return;
    }
    
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, navigate]);

  const loadAllData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setMessage(null);
    
    try {
      console.log('📡 Loading data with token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        throw new Error('Not authenticated. Please login again.');
      }

      // Simulate network delay for refresh animation to be visible (remove in production)
      if (isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Load all users first
      console.log('Fetching all users...');
      const usersResult = await getUsers(token);
      console.log('Users result:', usersResult);
      
      if (!Array.isArray(usersResult)) {
        console.warn('Users result is not an array:', usersResult);
        setAllUsers([]);
      } else {
        setAllUsers(usersResult);
        console.log(`Loaded ${usersResult.length} users`);
      }
      
      // Load users needing approval
      console.log('Fetching users needing approval...');
      const approvalResult = await getUsersNeedingLiveApproval(token);
      console.log('Approval result:', approvalResult);
      
      if (approvalResult.message && approvalResult.message.includes('Authentication failed')) {
        throw new Error('Authentication failed. Please login again.');
      }
      
      const approvalData = approvalResult.success ? approvalResult.users : [];
      setUsersNeedingApproval(approvalData);
      console.log(`Loaded ${approvalData.length} users needing approval`);
      
      // Calculate statistics
      if (Array.isArray(usersResult)) {
        calculateStats(usersResult);
      }

      setMessage({ type: 'success', text: 'Data refreshed successfully' });
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError(error.message || 'Failed to load data. Please try again.');
      
      // If it's an authentication error, redirect to login
      if (error.message.includes('Authentication') || 
          error.message.includes('401') || 
          error.message.includes('token') ||
          error.message.includes('Not authenticated')) {
        console.log('Authentication error detected, redirecting to login');
        navigate('/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadAllData(true);
  };

  const calculateStats = (users) => {
    if (!users || !Array.isArray(users)) {
      console.log('No users to calculate stats');
      return;
    }
    
    console.log('Calculating stats for users:', users.length);
    
    const processedUsers = users.map(user => ({
      canGoLive: user.canGoLive || false,
      canGoLiveReason: user.canGoLiveReason || null,
      approvedVideoCount: user.approvedVideoCount || 0,
      totalVideoViews: user.totalVideoViews || 0,
      liveStrikes: user.liveStrikes || [],
      ...user
    }));
    
    const totalStrikes = processedUsers.reduce((acc, user) => 
      acc + (user.liveStrikes?.length || 0), 0
    );
    
    const newStats = {
      totalUsers: processedUsers.length,
      approvedUsers: processedUsers.filter(u => u.canGoLive).length,
      pendingUsers: processedUsers.filter(u => !u.canGoLive).length,
      autoQualified: processedUsers.filter(u => u.canGoLive && u.canGoLiveReason === 'auto_qualified').length,
      manuallyApproved: processedUsers.filter(u => u.canGoLive && u.canGoLiveReason === 'manual_admin_approval').length,
      revokedUsers: processedUsers.filter(u => !u.canGoLive && u.canGoLiveReason === 'revoked').length,
      totalStrikes: totalStrikes
    };
    
    console.log('Calculated stats:', newStats);
    setStats(newStats);
  };

  const loadUserDetails = async (userId) => {
    try {
      console.log('Loading details for user:', userId);
      const result = await getUserLiveDetails(token, userId);
      if (result.success) {
        setUserDetails(result.user);
        setShowDetails(true);
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      setMessage({ type: 'error', text: 'Failed to load user details' });
    }
  };

  const handleGrantPrivilege = async (userId, userName) => {
    if (!window.confirm(`Grant live streaming privileges to ${userName}?`)) return;
    
    setActionLoading(true);
    try {
      console.log('Granting live privilege to:', userId);
      await setLivePrivilege(token, userId, true, 'Manual approval by admin');
      setMessage({ type: 'success', text: 'Live privileges granted successfully' });
      await loadAllData();
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Grant privilege error:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokePrivilege = async (userId, userName) => {
    const reason = prompt(`Enter reason for revoking ${userName}'s live privileges:`);
    if (!reason || reason.trim().length < 5) {
      alert('Please provide a valid reason (minimum 5 characters)');
      return;
    }
    
    setActionLoading(true);
    try {
      console.log('Revoking live privilege from:', userId);
      await setLivePrivilege(token, userId, false, reason);
      setMessage({ type: 'success', text: 'Live privileges revoked successfully' });
      await loadAllData();
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Revoke privilege error:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStrike = async (userId, userName) => {
    const reason = prompt(`Enter reason for strike against ${userName}:`);
    if (!reason || reason.trim().length < 5) {
      alert('Please provide a valid reason (minimum 5 characters)');
      return;
    }
    
    setActionLoading(true);
    try {
      console.log('Adding strike to user:', userId);
      await addLiveStrike(token, userId, reason);
      setMessage({ type: 'success', text: 'Live strike added successfully' });
      await loadAllData();
      if (selectedUser?._id === userId) {
        await loadUserDetails(userId);
      }
    } catch (error) {
      console.error('Add strike error:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users based on criteria
  const getFilteredUsers = () => {
    let filtered = [...allUsers];
    
    // Apply status filter
    switch (filter) {
      case 'approved':
        filtered = filtered.filter(user => user.canGoLive);
        break;
      case 'pending':
        filtered = filtered.filter(user => !user.canGoLive);
        break;
      case 'auto-qualified':
        filtered = filtered.filter(user => 
          user.canGoLive && user.canGoLiveReason === 'auto_qualified'
        );
        break;
      case 'manual':
        filtered = filtered.filter(user => 
          user.canGoLive && user.canGoLiveReason === 'manual_admin_approval'
        );
        break;
      case 'revoked':
        filtered = filtered.filter(user => 
          !user.canGoLive && user.canGoLiveReason === 'revoked'
        );
        break;
      case 'strikes':
        filtered = filtered.filter(user => 
          user.liveStrikes && user.liveStrikes.length > 0
        );
        break;
      case 'all':
      default:
        break;
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  };

  const filteredUsers = getFilteredUsers();

  const clearMessage = () => {
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="live-approvals-loading">
        <div className="loading-spinner" style={{ borderTopColor: getThemeColor() }}></div>
        <p>Loading live approval data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-approvals-error">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Data</h3>
        <p>{error}</p>
        <div className="error-actions">
          <button onClick={loadAllData} className="retry-btn" style={{ background: getThemeColor(), color: user?.role === 'superadmin' ? '#000' : '#fff' }}>
            Retry
          </button>
          <button onClick={() => navigate('/login')} className="login-btn">
            Login Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-approvals-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Live Stream Management
            <span className="role-badge" style={{ background: getThemeColor(), color: user?.role === 'superadmin' ? '#000' : '#fff' }}>
              {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'platformadmin' ? 'Platform Admin' : 'Support Admin'}
            </span>
          </h1>
          <p className="page-description">Review and manage user permissions for live streaming</p>
        </div>
        <button 
          onClick={handleRefresh} 
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          disabled={actionLoading || refreshing}
          style={{ '--theme-color': getThemeColor() }}
        >
          <span className={`refresh-icon ${refreshing ? 'spinning' : ''}`}>↻</span>
          <span className="refresh-text">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          {refreshing && (
            <span className="refresh-particles">
              <span className="particle" style={{ background: getThemeColor() }}></span>
              <span className="particle" style={{ background: getThemeColor() }}></span>
              <span className="particle" style={{ background: getThemeColor() }}></span>
            </span>
          )}
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`message-banner ${message.type}`} style={{ borderLeftColor: getThemeColor() }}>
          <span>{message.text}</span>
          <button onClick={clearMessage} className="message-close">×</button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--stat-color': getThemeColor() }}>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': getThemeColor() }}>
          <div className="stat-value">{stats.approvedUsers}</div>
          <div className="stat-label">Approved</div>
          <div className="stat-breakdown">
            {stats.autoQualified} auto · {stats.manuallyApproved} manual
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-color': getThemeColor() }}>
          <div className="stat-value">{stats.pendingUsers}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': getThemeColor() }}>
          <div className="stat-value">{stats.revokedUsers}</div>
          <div className="stat-label">Revoked</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': getThemeColor() }}>
          <div className="stat-value">{stats.totalStrikes}</div>
          <div className="stat-label">Strikes</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-container">
        <div className="search-box">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            style={{ '--theme-color': getThemeColor() }}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
        
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
          style={{ '--theme-color': getThemeColor() }}
        >
          <option value="all">All Users</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="auto-qualified">Auto-Qualified</option>
          <option value="manual">Manually Approved</option>
          <option value="revoked">Revoked</option>
          <option value="strikes">Has Strikes</option>
        </select>
      </div>

      {/* Results Count */}
      <div className="results-count">
        Showing <span className="results-highlight" style={{ color: getThemeColor() }}>{filteredUsers.length}</span> of <span className="results-highlight" style={{ color: getThemeColor() }}>{allUsers.length}</span> users
      </div>

      {/* Users Grid */}
      <div className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3 className="empty-title">No users found</h3>
            <p className="empty-description">Try adjusting your search or filter criteria</p>
            {(searchTerm || filter !== 'all') && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="empty-action"
                style={{ '--theme-color': getThemeColor() }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <LiveApprovalCard
              key={user._id}
              user={user}
              adminUser={user}
              onViewDetails={() => {
                setSelectedUser(user);
                loadUserDetails(user._id);
              }}
              onGrantPrivilege={() => handleGrantPrivilege(user._id, user.name || user.email)}
              onRevokePrivilege={() => handleRevokePrivilege(user._id, user.name || user.email)}
              onAddStrike={() => handleAddStrike(user._id, user.name || user.email)}
              actionLoading={actionLoading}
              themeColor={getThemeColor()}
            />
          ))
        )}
      </div>

      {/* User Details Modal */}
      {showDetails && userDetails && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ '--theme-color': getThemeColor(), '--theme-gradient': getThemeGradient() }}>
            <div className="modal-header">
              <div className="modal-header-left">
                <h2 className="modal-title">{userDetails.name || 'User Details'}</h2>
                <span className={`status-badge ${userDetails.canGoLive ? 'active' : 'inactive'}`} 
                      style={{ background: userDetails.canGoLive ? `rgba(${user?.role === 'superadmin' ? '248, 179, 5' : user?.role === 'platformadmin' ? '4, 62, 222' : '0, 163, 33'}, 0.1)` : 'rgba(239, 68, 68, 0.1)' }}>
                  {userDetails.canGoLive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button className="modal-close" onClick={() => setShowDetails(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Basic Info */}
              <div className="info-section">
                <h3 className="info-title">Basic Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{userDetails.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Joined</span>
                    <span className="info-value">{new Date(userDetails.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Account Age</span>
                    <span className="info-value">{userDetails.accountAgeDays || 0} days</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="info-section">
                <h3 className="info-title">Live Status</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <span className="info-value">{userDetails.canGoLive ? 'Approved' : 'Not Approved'}</span>
                  </div>
                  {userDetails.canGoLiveReason && (
                    <div className="info-item">
                      <span className="info-label">Reason</span>
                      <span className="info-value">{userDetails.canGoLiveReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="info-section">
                <h3 className="info-title">Requirements</h3>
                <div className="requirements-list">
                  <div className="requirement-item">
                    <div className="requirement-header">
                      <span className="requirement-label">Approved Videos</span>
                      <span className={`requirement-value ${userDetails.approvedVideoCount >= 3 ? 'met' : ''}`} 
                            style={userDetails.approvedVideoCount >= 3 ? { color: getThemeColor() } : {}}>
                        {userDetails.approvedVideoCount || 0}/3
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{
                          width: `${Math.min(((userDetails.approvedVideoCount || 0) / 3) * 100, 100)}%`,
                          background: getThemeGradient()
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="requirement-item">
                    <div className="requirement-header">
                      <span className="requirement-label">Total Views</span>
                      <span className={`requirement-value ${userDetails.totalVideoViews >= 500 ? 'met' : ''}`}
                            style={userDetails.totalVideoViews >= 500 ? { color: getThemeColor() } : {}}>
                        {(userDetails.totalVideoViews || 0).toLocaleString()}/500
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{
                          width: `${Math.min(((userDetails.totalVideoViews || 0) / 500) * 100, 100)}%`,
                          background: getThemeGradient()
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="requirement-item">
                    <div className="requirement-header">
                      <span className="requirement-label">Account Age</span>
                      <span className={`requirement-value ${userDetails.accountAgeDays >= 30 ? 'met' : ''}`}
                            style={userDetails.accountAgeDays >= 30 ? { color: getThemeColor() } : {}}>
                        {userDetails.accountAgeDays || 0}/30 days
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{
                          width: `${Math.min(((userDetails.accountAgeDays || 0) / 30) * 100, 100)}%`,
                          background: getThemeGradient()
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Strikes */}
              {userDetails.liveStrikes && userDetails.liveStrikes.length > 0 && (
                <div className="info-section">
                  <h3 className="info-title">Strikes ({userDetails.liveStrikes.length})</h3>
                  <div className="strikes-list">
                    {userDetails.liveStrikes.map((strike, index) => (
                      <div key={index} className="strike-item">
                        <span className="strike-reason">{strike.reason}</span>
                        <span className="strike-date">{new Date(strike.date).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {user.role !== 'supportadmin' && (
                <div className="modal-actions">
                  {!userDetails.canGoLive ? (
                    <button
                      onClick={() => {
                        handleGrantPrivilege(userDetails._id, userDetails.name || userDetails.email);
                        setShowDetails(false);
                      }}
                      className="action-btn grant"
                      style={{ background: getThemeGradient(), color: user?.role === 'superadmin' ? '#000' : '#fff' }}
                      disabled={actionLoading}
                    >
                      Grant Access
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleRevokePrivilege(userDetails._id, userDetails.name || userDetails.email);
                        setShowDetails(false);
                      }}
                      className="action-btn revoke"
                      style={{ borderColor: getThemeColor(), color: getThemeColor() }}
                      disabled={actionLoading}
                    >
                      Revoke Access
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      handleAddStrike(userDetails._id, userDetails.name || userDetails.email);
                    }}
                    className="action-btn strike"
                    style={{ borderColor: getThemeColor(), color: getThemeColor() }}
                    disabled={actionLoading}
                  >
                    Add Strike
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLiveApprovals;