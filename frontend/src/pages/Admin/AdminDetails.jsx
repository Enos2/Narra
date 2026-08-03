/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
// File: frontend/src/pages/Admin/AdminDetails.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAppContext } from '../../context/AppContext';
import './AdminDetails.css';

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ad-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="adsg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13"/>
        <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
      </radialGradient></defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#adsg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite"/>
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4+(i%4)}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>
        </line>
      ))}
      {[110,200,310,440].map((r,i)=>(
        <rect key={i} x={720-r*0.707} y={450-r*0.707} width={r*1.414} height={r*1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18+i*5}s`} repeatCount="indefinite"/>
        </rect>
      ))}
    </svg>
  );
}

function PlatformBg() {
  const traces = ["M0,180 H280 V130 H560 V180 H860 V90 H1440","M0,380 H180 V330 H480 V430 H780 V380 H1440","M0,580 H380 V530 H680 V630 H980 V580 H1440","M220,0 V180 H310 V490 H260 V900","M620,0 V140 H710 V390 H660 V900","M1080,0 V290 H1030 V590 H1130 V900"];
  const nodes = [[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630]];
  return (
    <svg className="ad-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="adpbg" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5"/>
      </pattern></defs>
      <rect width="1440" height="900" fill="url(#adpbg)"/>
      {traces.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3+i*0.7}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
      </path>))}
      {nodes.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
        <animate attributeName="r" values="4;9;4" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
      </circle>))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9"><animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440"/></circle>
    </svg>
  );
}

function SupportBg() {
  const vines = ["M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30","M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0","M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95","M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0","M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40"];
  const leaves = [[130,440],[365,490],[715,545],[1055,470],[1340,515],[200,30],[350,0],[695,95]];
  return (
    <svg className="ad-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="adsbg" cx="50%" cy="100%" r="60%">
        <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08"/>
        <stop offset="100%" stopColor="#22ff00" stopOpacity="0"/>
      </radialGradient></defs>
      <rect width="1440" height="900" fill="url(#adsbg)"/>
      {vines.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#22ff00" strokeOpacity="0.065" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
      </path>))}
      {leaves.map(([x,y],i)=>(<ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22ff00" fillOpacity="0.14">
        <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3+i*0.6}s`} begin={`${i*0.45}s`} repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14+i*2}s`} repeatCount="indefinite"/>
      </ellipse>))}
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9"><animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/></circle>
    </svg>
  );
}

const AdminDetails = () => {
  const { id } = useParams();
  const { user, token, isSuperAdmin } = useAppContext();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActions, setRecentActions] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);
  const [imageError, setImageError] = useState(false);

  const baseUrl = 'http://localhost:5000';
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const currentRole = user?.role || 'superadmin';

  const getAvatarUrl = (adminData) => {
    if (!adminData?.avatar) return null;
    if (adminData.avatar.startsWith('http')) return adminData.avatar;
    return `${baseUrl}${adminData.avatar}`;
  };

  const fetchAdminDetails = useCallback(async () => {
    if (!token || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const adminRes = await axios.get(`${API_BASE}/api/admin/admins`, { headers });
      const allAdmins = adminRes.data.admins || [];
      const targetAdmin = allAdmins.find(a => a._id === id);

      if (!targetAdmin) {
        setError('Admin not found');
        setLoading(false);
        return;
      }

      setAdmin(targetAdmin);

      try {
        const statsRes = await axios.get(`${API_BASE}/api/admin/profile/stats`, { headers });
        setStats(statsRes.data.stats);
      } catch (statsErr) {
        console.warn('Could not fetch admin stats:', statsErr.message);
        setStats(null);
      }

      try {
        const actionsRes = await axios.get(`${API_BASE}/api/admin/audit/logs/recent?limit=10`, { headers });
        const allActions = actionsRes.data.logs || [];
        const adminActions = allActions.filter(log => log.adminId === id || log.adminEmail === targetAdmin.email);
        setRecentActions(adminActions.slice(0, 10));
      } catch (actionsErr) {
        console.warn('Could not fetch admin actions:', actionsErr.message);
        setRecentActions([]);
      }

    } catch (err) {
      console.error('Error fetching admin details:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load admin details');
      }
    } finally {
      setLoading(false);
    }
  }, [token, id, API_BASE]);

  useEffect(() => {
    if (token && id) {
      fetchAdminDetails();
    }
  }, [token, id, fetchAdminDetails]);

  const handlePromote = async () => {
    if (!token || !admin) return;
    if (admin.role === 'superadmin') {
      alert('Cannot promote Super Admin');
      return;
    }
    const nextRole = admin.role === 'supportadmin' ? 'platformadmin' : 'superadmin';
    if (!confirm(`Promote this admin to ${nextRole}?`)) return;

    setActionLoading('promote');
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${admin._id}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Admin promoted successfully' });
      fetchAdminDetails();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to promote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async () => {
    if (!token || !admin) return;
    if (admin.role === 'supportadmin') {
      alert('Cannot demote Support Admin further');
      return;
    }
    const nextRole = admin.role === 'superadmin' ? 'platformadmin' : 'supportadmin';
    if (!confirm(`Demote this admin to ${nextRole}?`)) return;

    setActionLoading('demote');
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${admin._id}/demote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Admin demoted successfully' });
      fetchAdminDetails();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to demote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async () => {
    if (!token || !admin) return;
    if (!confirm('Deactivate this admin?')) return;

    setActionLoading('deactivate');
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${admin._id}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Admin deactivated successfully' });
      fetchAdminDetails();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    if (!token || !admin) return;
    if (!confirm('Reactivate this admin?')) return;

    setActionLoading('reactivate');
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${admin._id}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Admin reactivated successfully' });
      fetchAdminDetails();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!token || !admin) return;
    if (!isSuperAdmin) {
      alert('Only Super Admin can delete admins');
      return;
    }
    if (!confirm('PERMANENTLY DELETE this admin? This action cannot be undone.')) return;

    setActionLoading('delete');
    try {
      await axios.delete(`${API_BASE}/api/admin/admins/${admin._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Admin deleted permanently' });
      setTimeout(() => navigate('/admin/admins'), 1500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete admin');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleLabel = (role) => {
    switch(role) {
      case 'superadmin': return 'Super Admin';
      case 'platformadmin': return 'Platform Admin';
      case 'supportadmin': return 'Support Admin';
      default: return role;
    }
  };

  const getRoleClass = (role) => {
    switch(role) {
      case 'superadmin': return 'ad-role-superadmin';
      case 'platformadmin': return 'ad-role-platformadmin';
      case 'supportadmin': return 'ad-role-supportadmin';
      default: return '';
    }
  };

  const getStatusColor = () => {
    if (!admin) return '#6b7280';
    if (admin.adminDeactivated) return '#ef4444';
    return '#22c55e';
  };

  const getStatusLabel = () => {
    if (!admin) return 'Unknown';
    if (admin.adminDeactivated) return 'Inactive';
    return 'Active';
  };

  const getDisplayName = (adminData) => {
    if (!adminData) return 'Admin';
    return adminData.name || adminData.username || adminData.email?.split('@')[0] || 'Admin';
  };

  const getAvatarLetter = (adminData) => {
    const name = getDisplayName(adminData);
    return name[0]?.toUpperCase() || 'A';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`ad-page ad-role-${currentRole}`}>
        <div className="ad-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
        <div className="ad-grain"/>
        <div className="ad-loading"><div className="ad-ring"/><p>Loading admin details...</p></div>
      </div>
    );
  }

  if (error || !admin) {
    return (
      <div className={`ad-page ad-role-${currentRole}`}>
        <div className="ad-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
        <div className="ad-grain"/>
        <div className="ad-error-state">
          <div className="ad-error-code">404</div>
          <h3>Admin Not Found</h3>
          <p>{error || 'The requested admin could not be found.'}</p>
          <Link to="/admin/admins" className="ad-btn ad-btn--accent">Back to Admins</Link>
        </div>
      </div>
    );
  }

  const avatarUrl = getAvatarUrl(admin);

  return (
    <div className={`ad-page ad-role-${currentRole}`}>
      <div className="ad-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
      <div className="ad-grain"/>

      <div className="ad-shell">
        {/* Header */}
        <header className="ad-hdr">
          <div className="ad-hdr__bar"/>
          <div className="ad-hdr__nav">
            <Link to="/admin/admins" className="ad-back">
              <span>←</span>
              <span>Back to Admins</span>
            </Link>
            {isSuperAdmin && (
              <div className="ad-header-actions">
                <button className="ad-act ad-act--promote" onClick={handlePromote} disabled={actionLoading === 'promote' || admin.role === 'superadmin'}>
                  Promote
                </button>
                <button className="ad-act ad-act--demote" onClick={handleDemote} disabled={actionLoading === 'demote' || admin.role === 'supportadmin'}>
                  Demote
                </button>
                {admin.adminDeactivated ? (
                  <button className="ad-act ad-act--reactivate" onClick={handleReactivate} disabled={actionLoading === 'reactivate'}>
                    Reactivate
                  </button>
                ) : (
                  <button className="ad-act ad-act--deactivate" onClick={handleDeactivate} disabled={actionLoading === 'deactivate'}>
                    Deactivate
                  </button>
                )}
                {isSuperAdmin && (
                  <button className="ad-act ad-act--delete" onClick={handleDelete} disabled={actionLoading === 'delete'}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Alerts */}
        {message && (
          <div className={`ad-alert ad-alert--${message.type}`}>
            <span>{message.type === 'error' ? 'Error' : 'Done'}</span>
            <span className="ad-alert__msg">{message.text}</span>
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {/* Hero */}
        <div className="ad-hero">
          <div className="ad-hero__inner">
            <div className="ad-avatar-wrap">
              {avatarUrl && !imageError ? (
                <img src={avatarUrl} alt={getDisplayName(admin)} className="ad-avatar-img"
                  onError={() => setImageError(true)}/>
              ) : (
                <div className="ad-avatar-fall">{getAvatarLetter(admin)}</div>
              )}
              <div className={`ad-online-dot ${admin.online ? 'online' : 'offline'}`}/>
            </div>

            <div className="ad-hero__info">
              <div className="ad-hero__namerow">
                <h1 className="ad-hero__name">{getDisplayName(admin)}</h1>
                <span className={`ad-role-badge ${getRoleClass(admin.role)}`}>{getRoleLabel(admin.role)}</span>
                <span className="ad-status-badge" style={{
                  background: getStatusColor() === '#22c55e' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: getStatusColor(),
                  borderColor: getStatusColor()
                }}>{getStatusLabel()}</span>
              </div>
              {admin.username && <span className="ad-id-chip">@{admin.username}</span>}
              <span className="ad-id-chip">{admin.email}</span>
              <div className="ad-hero__meta">
                <span>Joined {formatDate(admin.createdAt)}</span>
                {admin.adminDeactivated && admin.adminDeactivatedAt && (
                  <span> · Deactivated {formatDate(admin.adminDeactivatedAt)}</span>
                )}
                {admin.adminDeactivationReason && (
                  <span className="ad-deactivation-reason"> · Reason: {admin.adminDeactivationReason}</span>
                )}
              </div>
            </div>

            <div className="ad-hero__actions">
              <button className="ad-action-btn ad-action-btn--dm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Message
              </button>
              <button className="ad-action-btn ad-action-btn--audit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Audit Log
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="ad-statsrow">
          {[
            { k: 'total', l: 'Total Actions', v: stats?.totalActions || 0 },
            { k: 'week', l: 'This Week', v: stats?.actionsThisWeek || 0 },
            { k: 'month', l: 'This Month', v: stats?.actionsThisMonth || 0 },
            { k: 'approved', l: 'Videos Approved', v: stats?.approvedVideos || 0 },
            { k: 'banned', l: 'Users Banned', v: stats?.bannedUsers || 0 },
          ].map(({ k, l, v }) => (
            <div key={k} className="ad-spill">
              <span className={`ad-spill__n ad-sn-${k}`}>{v}</span>
              <span className="ad-spill__l">{l}</span>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="ad-two-col">
          {/* Recent Activity */}
          <div className="ad-activity-section">
            <h4 className="ad-section-title">Recent Activity</h4>
            {recentActions.length === 0 ? (
              <div className="ad-empty">
                <div className="ad-empty__icon"/>
                <h3>No recent activity</h3>
                <p>This admin has no recorded actions yet</p>
              </div>
            ) : (
              <div className="ad-activity-list">
                {recentActions.map((action, index) => (
                  <div key={index} className="ad-activity-item">
                    <div className="ad-activity-dot"/>
                    <div className="ad-activity-content">
                      <p className="ad-activity-description">{action.actionLabel || action.description}</p>
                      <span className="ad-activity-meta">
                        {action.targetName && `· ${action.targetName}`}
                        {action.targetType && ` · ${action.targetType}`}
                      </span>
                      <span className="ad-activity-time">
                        {new Date(action.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Details */}
          <div className="ad-details-section">
            <h4 className="ad-section-title">Account Details</h4>
            <div className="ad-details-grid">
              {[
                ['Admin ID', admin._id],
                ['Email', admin.email],
                ['Username', admin.username || 'Not set'],
                ['Role', getRoleLabel(admin.role)],
                ['Joined', formatDate(admin.createdAt)],
                ['Last Active', admin.lastActive ? formatDate(admin.lastActive) : 'N/A'],
                ['Status', getStatusLabel()],
              ].map(([label, value]) => (
                <div key={label} className="ad-detail-item">
                  <span className="ad-detail-item__lbl">{label}</span>
                  <span className="ad-detail-item__val">{value}</span>
                </div>
              ))}
              {admin.adminDeactivated && (
                <div className="ad-detail-item ad-detail-item--warn">
                  <span className="ad-detail-item__lbl">Deactivation Reason</span>
                  <span className="ad-detail-item__val">{admin.adminDeactivationReason || 'No reason provided'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDetails;