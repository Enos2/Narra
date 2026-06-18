/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/**
 * File: frontend/src/pages/admin/AdminLiveApprovals.jsx
 * Description: Admin panel for managing live streaming approvals
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

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ala-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ala-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ala-sg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[110, 200, 310, 440].map((r, i) => (
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707} width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18 + i * 5}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}

function PlatformBg() {
  const traces = [
    "M0,180 H280 V130 H560 V180 H860 V90 H1440",
    "M0,380 H180 V330 H480 V430 H780 V380 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
    "M0,740 H90 V690 H380 V790 H680 V740 H1440",
    "M220,0 V180 H310 V490 H260 V900",
    "M620,0 V140 H710 V390 H660 V900",
    "M1080,0 V290 H1030 V590 H1130 V900",
  ];
  const nodes = [[280, 130], [560, 180], [860, 90], [180, 330], [480, 430], [380, 530], [680, 630], [380, 690]];
  return (
    <svg className="ala-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ala-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#ala-pbg)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite" />
      </rect>
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3 + i * 0.7}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
          <animate attributeName="r" values="4;9;4" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440" />
      </circle>
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,580 H380 V530 H680 V630 H980 V580 H1440" />
      </circle>
    </svg>
  );
}

function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves = [[130, 440], [365, 490], [715, 545], [1055, 470], [1340, 515], [200, 30], [350, 0], [695, 95], [1070, 0], [1335, 40]];
  return (
    <svg className="ala-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ala-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#ala-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.14" transform={`rotate(${i * 37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30" />
      </circle>
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s" path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95" />
      </circle>
    </svg>
  );
}

const AdminLiveApprovals = () => {
  const { user, token } = useAppContext();
  const navigate = useNavigate();
  
  const role = user?.role || "superadmin";
  
  // Get role-specific theme color
  const getThemeColor = () => {
    switch(user?.role) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };

  // Get role-specific gradient
  const getThemeGradient = () => {
    switch(user?.role) {
      case 'superadmin': return 'linear-gradient(135deg, #FFD700, #FFA500)';
      case 'platformadmin': return 'linear-gradient(135deg, #3B82F6, #1E3A8A)';
      case 'supportadmin': return 'linear-gradient(135deg, #22c55e, #166534)';
      default: return 'linear-gradient(135deg, #FFD700, #FFA500)';
    }
  };
  
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

  // Debug logging
  useEffect(() => {
    console.log('AdminLiveApprovals - Debug Info:');
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
      console.log('Loading data with token:', token ? 'Present' : 'Missing');
      
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
      console.error('Error loading data:', error);
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
      <div className={`ala-page ala-role-${role}`} style={{ "--theme-accent": getThemeColor() }}>
        <div className="ala-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="ala-grain" aria-hidden="true"></div>
        <div className="ala-loading">
          <div className="ala-loading__ring" style={{ borderTopColor: getThemeColor() }}></div>
          <p>Loading live approval data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ala-page ala-role-${role}`} style={{ "--theme-accent": getThemeColor() }}>
        <div className="ala-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="ala-grain" aria-hidden="true"></div>
        <div className="ala-error">
          <div className="ala-error__icon"></div>
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <div className="ala-error-actions">
            <button onClick={loadAllData} className="ala-retry-btn" style={{ background: getThemeColor(), color: '#000000' }}>
              Retry
            </button>
            <button onClick={() => navigate('/login')} className="ala-login-btn">
              Login Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ala-page ala-role-${role}`} style={{ "--theme-accent": getThemeColor() }}>
      {/* Animated SVG background */}
      <div className="ala-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>

      {/* Grain overlay */}
      <div className="ala-grain" aria-hidden="true"></div>

      <div className="ala-container">
        {/* Page Header */}
        <div className="ala-header">
          <div>
            <h1 className="ala-title">
              Live Stream Management
              <span className="ala-role-badge" style={{ background: getThemeColor(), color: '#000000' }}>
                {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'platformadmin' ? 'Platform Admin' : 'Support Admin'}
              </span>
            </h1>
            <p className="ala-description">Review and manage user permissions for live streaming</p>
          </div>
          <button 
            onClick={handleRefresh} 
            className={`ala-refresh-btn ${refreshing ? 'refreshing' : ''}`}
            disabled={actionLoading || refreshing}
          >
            <span className={`ala-refresh-icon ${refreshing ? 'spinning' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </span>
            <span className="ala-refresh-text">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`ala-message ${message.type}`} style={{ borderLeftColor: getThemeColor() }}>
            <span>{message.text}</span>
            <button onClick={clearMessage} className="ala-message-close">×</button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="ala-stats-row">
          <div className="ala-stat-box">
            <span className="ala-stat-value">{stats.totalUsers}</span>
            <span className="ala-stat-label">Total Users</span>
          </div>
          <div className="ala-stat-box">
            <span className="ala-stat-value">{stats.approvedUsers}</span>
            <span className="ala-stat-label">Approved</span>
            <div className="ala-stat-breakdown">
              {stats.autoQualified} auto · {stats.manuallyApproved} manual
            </div>
          </div>
          <div className="ala-stat-box">
            <span className="ala-stat-value">{stats.pendingUsers}</span>
            <span className="ala-stat-label">Pending</span>
          </div>
          <div className="ala-stat-box">
            <span className="ala-stat-value">{stats.revokedUsers}</span>
            <span className="ala-stat-label">Revoked</span>
          </div>
          <div className="ala-stat-box">
            <span className="ala-stat-value">{stats.totalStrikes}</span>
            <span className="ala-stat-label">Strikes</span>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="ala-controls">
          <div className="ala-search-box">
            <svg className="ala-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ala-search-input"
            />
            {searchTerm && (
              <button className="ala-search-clear" onClick={() => setSearchTerm('')}>×</button>
            )}
          </div>
          
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="ala-filter-select"
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
        <div className="ala-results-count">
          Showing <span className="ala-results-highlight" style={{ color: getThemeColor() }}>{filteredUsers.length}</span> of <span className="ala-results-highlight" style={{ color: getThemeColor() }}>{allUsers.length}</span> users
        </div>

        {/* Users Grid */}
        <div className="ala-users-grid">
          {filteredUsers.length === 0 ? (
            <div className="ala-empty-state">
              <div className="ala-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="ala-empty-title">No users found</h3>
              <p className="ala-empty-description">Try adjusting your search or filter criteria</p>
              {(searchTerm || filter !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                  className="ala-empty-action"
                  style={{ '--accent': getThemeColor() }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredUsers.map((userItem) => (
              <LiveApprovalCard
                key={userItem._id}
                user={userItem}
                adminUser={user}
                onViewDetails={() => {
                  setSelectedUser(userItem);
                  loadUserDetails(userItem._id);
                }}
                onGrantPrivilege={() => handleGrantPrivilege(userItem._id, userItem.name || userItem.email)}
                onRevokePrivilege={() => handleRevokePrivilege(userItem._id, userItem.name || userItem.email)}
                onAddStrike={() => handleAddStrike(userItem._id, userItem.name || userItem.email)}
                actionLoading={actionLoading}
                themeColor={getThemeColor()}
              />
            ))
          )}
        </div>

        {/* User Details Modal */}
        {showDetails && userDetails && (
          <div className="ala-modal-overlay" onClick={() => setShowDetails(false)}>
            <div className="ala-modal" onClick={e => e.stopPropagation()}>
              <div className="ala-modal-header">
                <div className="ala-modal-header-left">
                  <h2 className="ala-modal-title">{userDetails.name || 'User Details'}</h2>
                  <span className={`ala-status-badge ${userDetails.canGoLive ? 'active' : 'inactive'}`}
                        style={{ background: userDetails.canGoLive ? `${getThemeColor()}20` : 'rgba(239, 68, 68, 0.1)',
                                 color: userDetails.canGoLive ? getThemeColor() : '#ef4444' }}>
                    {userDetails.canGoLive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button className="ala-modal-close" onClick={() => setShowDetails(false)}>×</button>
              </div>
              
              <div className="ala-modal-body">
                {/* Basic Info */}
                <div className="ala-info-section">
                  <h3 className="ala-info-title">Basic Information</h3>
                  <div className="ala-info-grid">
                    <div className="ala-info-item">
                      <span className="ala-info-label">Email</span>
                      <span className="ala-info-value">{userDetails.email}</span>
                    </div>
                    <div className="ala-info-item">
                      <span className="ala-info-label">Joined</span>
                      <span className="ala-info-value">{new Date(userDetails.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="ala-info-item">
                      <span className="ala-info-label">Account Age</span>
                      <span className="ala-info-value">{userDetails.accountAgeDays || 0} days</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="ala-info-section">
                  <h3 className="ala-info-title">Live Status</h3>
                  <div className="ala-info-grid">
                    <div className="ala-info-item">
                      <span className="ala-info-label">Status</span>
                      <span className="ala-info-value">{userDetails.canGoLive ? 'Approved' : 'Not Approved'}</span>
                    </div>
                    {userDetails.canGoLiveReason && (
                      <div className="ala-info-item">
                        <span className="ala-info-label">Reason</span>
                        <span className="ala-info-value">{userDetails.canGoLiveReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Requirements */}
                <div className="ala-info-section">
                  <h3 className="ala-info-title">Requirements</h3>
                  <div className="ala-requirements-list">
                    <div className="ala-requirement-item">
                      <div className="ala-requirement-header">
                        <span className="ala-requirement-label">Approved Videos</span>
                        <span className={`ala-requirement-value ${userDetails.approvedVideoCount >= 3 ? 'met' : ''}`}
                              style={userDetails.approvedVideoCount >= 3 ? { color: getThemeColor() } : {}}>
                          {userDetails.approvedVideoCount || 0}/3
                        </span>
                      </div>
                      <div className="ala-progress-bar">
                        <div 
                          className="ala-progress-fill" 
                          style={{
                            width: `${Math.min(((userDetails.approvedVideoCount || 0) / 3) * 100, 100)}%`,
                            background: getThemeGradient()
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="ala-requirement-item">
                      <div className="ala-requirement-header">
                        <span className="ala-requirement-label">Total Views</span>
                        <span className={`ala-requirement-value ${userDetails.totalVideoViews >= 500 ? 'met' : ''}`}
                              style={userDetails.totalVideoViews >= 500 ? { color: getThemeColor() } : {}}>
                          {(userDetails.totalVideoViews || 0).toLocaleString()}/500
                        </span>
                      </div>
                      <div className="ala-progress-bar">
                        <div 
                          className="ala-progress-fill" 
                          style={{
                            width: `${Math.min(((userDetails.totalVideoViews || 0) / 500) * 100, 100)}%`,
                            background: getThemeGradient()
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="ala-requirement-item">
                      <div className="ala-requirement-header">
                        <span className="ala-requirement-label">Account Age</span>
                        <span className={`ala-requirement-value ${userDetails.accountAgeDays >= 30 ? 'met' : ''}`}
                              style={userDetails.accountAgeDays >= 30 ? { color: getThemeColor() } : {}}>
                          {userDetails.accountAgeDays || 0}/30 days
                        </span>
                      </div>
                      <div className="ala-progress-bar">
                        <div 
                          className="ala-progress-fill" 
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
                  <div className="ala-info-section">
                    <h3 className="ala-info-title">Strikes ({userDetails.liveStrikes.length})</h3>
                    <div className="ala-strikes-list">
                      {userDetails.liveStrikes.map((strike, index) => (
                        <div key={index} className="ala-strike-item">
                          <span className="ala-strike-reason">{strike.reason}</span>
                          <span className="ala-strike-date">{new Date(strike.date).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {user.role !== 'supportadmin' && (
                  <div className="ala-modal-actions">
                    {!userDetails.canGoLive ? (
                      <button
                        onClick={() => {
                          handleGrantPrivilege(userDetails._id, userDetails.name || userDetails.email);
                          setShowDetails(false);
                        }}
                        className="ala-action-btn ala-grant-btn"
                        style={{ background: getThemeGradient(), color: '#000000' }}
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
                        className="ala-action-btn ala-revoke-btn"
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
                      className="ala-action-btn ala-strike-btn"
                      style={{ borderColor: '#ef4444', color: '#ef4444' }}
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
    </div>
  );
};

export default AdminLiveApprovals;