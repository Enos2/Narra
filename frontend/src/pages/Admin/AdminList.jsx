/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
 
// File: src/pages/admin/AdminList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAppContext } from '../../context/AppContext';
import './AdminList.css';

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="al-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="al-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#al-sg1)">
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
    <svg className="al-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="al-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#al-pbg)">
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
    <svg className="al-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="al-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#al-sbg)" />
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

const AdminList = () => {
  const { token, user, isSuperAdmin } = useAppContext();
  const navigate = useNavigate();
  const role = user?.role || "superadmin";
  
  // Get theme color based on role
  const getThemeColor = () => {
    switch(role) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };
  
  const themeColor = getThemeColor();
  const baseUrl = 'http://localhost:5000';
  
  const [admins, setAdmins] = useState([]);
  const [inactiveAdmins, setInactiveAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [imageErrors, setImageErrors] = useState({});

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Helper to get absolute avatar URL
  const getAvatarUrl = (admin) => {
    if (!admin?.avatar) return null;
    if (admin.avatar.startsWith('http')) return admin.avatar;
    return `${baseUrl}${admin.avatar}`;
  };

  const fetchAdmins = useCallback(async () => {
    if (!token) {
      console.warn('No token available, skipping fetch');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [activeRes, inactiveRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/admins`, { headers }),
        axios.get(`${API_BASE}/api/admin/admins/inactive`, { headers })
      ]);
      setAdmins(activeRes.data.admins || []);
      setInactiveAdmins(inactiveRes.data.admins || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load admins');
      }
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => {
    if (token) {
      fetchAdmins();
    }
  }, [token, fetchAdmins]);

  const handleDeactivate = async (adminId) => {
    if (!token) return;
    if (!confirm('Deactivate this admin?')) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
      setMessage({ type: 'success', text: 'Admin deactivated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (adminId) => {
    if (!token) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
      setMessage({ type: 'success', text: 'Admin reactivated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (adminId, currentRole) => {
    if (!token) return;
    if (currentRole === 'superadmin') {
      alert('Cannot promote super admin');
      return;
    }
    if (!confirm(`Promote this admin to ${currentRole === 'supportadmin' ? 'platformadmin' : 'superadmin'}?`)) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
      setMessage({ type: 'success', text: 'Admin promoted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to promote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (adminId, currentRole) => {
    if (!token) return;
    if (currentRole === 'supportadmin') {
      alert('Cannot demote support admin further');
      return;
    }
    if (!confirm(`Demote this admin to ${currentRole === 'superadmin' ? 'platformadmin' : 'supportadmin'}?`)) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/demote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
      setMessage({ type: 'success', text: 'Admin demoted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to demote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (adminId) => {
    if (!token) return;
    if (!isSuperAdmin) {
      alert('Only Super Admin can delete admins');
      return;
    }
    if (!confirm('PERMANENTLY DELETE this admin? This action cannot be undone.')) return;
    setActionLoading(adminId);
    try {
      await axios.delete(`${API_BASE}/api/admin/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
      setMessage({ type: 'success', text: 'Admin deleted permanently' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete admin');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter admins based on search term
  const getFilteredAdmins = () => {
    const adminsToFilter = showInactive ? inactiveAdmins : admins;
    if (!searchTerm) return adminsToFilter;
    
    const term = searchTerm.toLowerCase();
    return adminsToFilter.filter(admin => 
      (admin.name && admin.name.toLowerCase().includes(term)) ||
      (admin.username && admin.username.toLowerCase().includes(term)) ||
      (admin.email && admin.email.toLowerCase().includes(term))
    );
  };

  const filteredAdmins = getFilteredAdmins();

  const getRoleClass = (role) => {
    switch(role) {
      case 'superadmin': return 'role-superadmin';
      case 'platformadmin': return 'role-platformadmin';
      case 'supportadmin': return 'role-supportadmin';
      default: return '';
    }
  };

  // Get the display name for avatar fallback
  const getDisplayName = (admin) => {
    return admin.name || admin.username || admin.email?.split('@')[0] || 'A';
  };

  // Get the first letter for avatar
  const getAvatarLetter = (admin) => {
    const displayName = getDisplayName(admin);
    return displayName[0]?.toUpperCase() || 'A';
  };

  if (!token) {
    return (
      <div className={`al-page al-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="al-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="al-grain" aria-hidden="true"></div>
        <div className="al-error">
          <div className="al-error__icon"></div>
          <p>No authentication token found. Please log in again.</p>
          <button onClick={() => navigate('/admin-login')} className="al-retry-btn" style={{ background: themeColor, color: '#000000' }}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (loading && admins.length === 0 && inactiveAdmins.length === 0) {
    return (
      <div className={`al-page al-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="al-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="al-grain" aria-hidden="true"></div>
        <div className="al-loading">
          <div className="al-loading__ring" style={{ borderTopColor: themeColor }}></div>
          <p>Loading admins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`al-page al-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="al-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="al-grain" aria-hidden="true"></div>
        <div className="al-error">
          <div className="al-error__icon"></div>
          <p>{error}</p>
          <button onClick={fetchAdmins} className="al-retry-btn" style={{ background: themeColor, color: '#000000' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`al-page al-role-${role}`} style={{ "--theme-accent": themeColor }}>
      {/* Animated SVG background */}
      <div className="al-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>

      {/* Grain overlay */}
      <div className="al-grain" aria-hidden="true"></div>

      <div className="al-container">
        <div className="al-header">
          <div>
            <h1 className="al-title">Admin Management</h1>
            <p className="al-description">Manage system administrators and their roles</p>
          </div>
          <div className="al-header-actions">
            <div className="al-search-box">
              <svg className="al-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="al-search-input"
              />
              {searchTerm && (
                <button className="al-search-clear" onClick={() => setSearchTerm('')}>×</button>
              )}
            </div>
            <button 
              className={`al-toggle-btn ${showInactive ? 'active' : ''}`}
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? 'Show Active' : `Show Inactive (${inactiveAdmins.length})`}
            </button>
            {isSuperAdmin && (
              <button 
                className="al-create-btn" 
                onClick={() => navigate('/admin/admins/create')}
                style={{ background: themeColor, color: '#000000' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Admin
              </button>
            )}
          </div>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`al-message ${message.type}`} style={{ borderLeftColor: themeColor }}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="al-message-close">×</button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="al-stats-row">
          <div className="al-stat-box">
            <span className="al-stat-value">{admins.length + inactiveAdmins.length}</span>
            <span className="al-stat-label">Total Admins</span>
          </div>
          <div className="al-stat-box">
            <span className="al-stat-value">{admins.length}</span>
            <span className="al-stat-label">Active Admins</span>
          </div>
          <div className="al-stat-box">
            <span className="al-stat-value">{inactiveAdmins.length}</span>
            <span className="al-stat-label">Inactive Admins</span>
          </div>
        </div>

        {/* Results Count */}
        {searchTerm && (
          <div className="al-results-count">
            Showing <span className="al-results-highlight" style={{ color: themeColor }}>{filteredAdmins.length}</span> of <span className="al-results-highlight" style={{ color: themeColor }}>{showInactive ? inactiveAdmins.length : admins.length}</span> {showInactive ? 'inactive' : 'active'} admins
          </div>
        )}

        {/* Admins Table */}
        {filteredAdmins.length === 0 ? (
          <div className="al-empty-state">
            <div className="al-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="al-empty-title">No {showInactive ? 'inactive' : 'active'} admins found</h3>
            {searchTerm && (
              <p className="al-empty-description">Try adjusting your search criteria</p>
            )}
          </div>
        ) : (
          <div className="al-table-wrapper">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => {
                  const avatarUrl = getAvatarUrl(admin);
                  const hasError = imageErrors[admin._id];
                  
                  return (
                    <tr key={admin._id}>
                      <td className="al-name-cell">
                        <Link to={`/admin/admin-details/${admin._id}`} className="al-avatar-link">
                          <div className="al-avatar-container">
                            {avatarUrl && !hasError ? (
                              <img 
                                src={avatarUrl} 
                                alt={getDisplayName(admin)}
                                className="al-avatar-img"
                                onError={() => setImageErrors(prev => ({ ...prev, [admin._id]: true }))}
                              />
                            ) : (
                              <div className="al-avatar-fallback" style={{ 
                                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                              }}>
                                {getAvatarLetter(admin)}
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="al-name-info">
                          <Link to={`/admin/admin-details/${admin._id}`} className="al-admin-name-link">
                            <span className="al-admin-name">{admin.name || admin.username || 'N/A'}</span>
                          </Link>
                          {admin.username && admin.username !== admin.name && (
                            <span className="al-admin-username">@{admin.username}</span>
                          )}
                        </div>
                      </td>
                      <td className="al-email-cell">{admin.email}</td>
                      <td>
                        <span className={`al-role-badge ${getRoleClass(admin.role)}`}>
                          {admin.role === 'superadmin' ? 'Super Admin' : admin.role === 'platformadmin' ? 'Platform Admin' : 'Support Admin'}
                        </span>
                      </td>
                      <td>
                        <span className={`al-status-badge ${admin.isActive !== false ? 'status-active' : 'status-inactive'}`}
                          style={admin.isActive !== false ? { background: `${themeColor}20`, color: themeColor } : { background: '#ef444420', color: '#ef4444' }}>
                          {admin.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="al-date-cell">{new Date(admin.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="al-action-buttons">
                          {admin.isActive !== false ? (
                            <button 
                              className="al-action-btn al-action-deactivate"
                              onClick={() => handleDeactivate(admin._id)}
                              disabled={actionLoading === admin._id}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button 
                              className="al-action-btn al-action-reactivate"
                              onClick={() => handleReactivate(admin._id)}
                              disabled={actionLoading === admin._id}
                            >
                              Reactivate
                            </button>
                          )}
                          <button 
                            className="al-action-btn al-action-promote"
                            onClick={() => handlePromote(admin._id, admin.role)}
                            disabled={actionLoading === admin._id || admin.role === 'superadmin'}
                          >
                            Promote
                          </button>
                          <button 
                            className="al-action-btn al-action-demote"
                            onClick={() => handleDemote(admin._id, admin.role)}
                            disabled={actionLoading === admin._id || admin.role === 'supportadmin'}
                          >
                            Demote
                          </button>
                          {isSuperAdmin && (
                            <button 
                              className="al-action-btn al-action-delete"
                              onClick={() => handleDelete(admin._id)}
                              disabled={actionLoading === admin._id}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminList;