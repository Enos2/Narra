/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
/* File: InactiveAdmins.jsx */
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import "./InactiveAdmins.css";

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ia-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ia-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ia-sg1)">
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
    <svg className="ia-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ia-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#ia-pbg)">
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
    <svg className="ia-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ia-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#ia-sbg)" />
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

export default function InactiveAdmins() {
  const { token, user, isSuperAdmin } = useAppContext();
  const role = user?.role || "superadmin";
  
  const getThemeColor = () => {
    switch(role) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };
  
  const themeColor = getThemeColor();
  
  const [inactiveAdmins, setInactiveAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchInactiveAdmins = useCallback(async () => {
    if (!token) {
      setError("Authentication token missing. Please log in again.");
      setLoading(false);
      return;
    }

    if (!isSuperAdmin) {
      setError("Access forbidden. Super Admin privileges required.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const response = await axios.get(
        `${API_BASE}/api/admin/admins/inactive`,
        { headers }
      );

      if (response.data.success) {
        setInactiveAdmins(response.data.admins || []);
      } else {
        setError(response.data.message || "Failed to fetch inactive admins");
      }
    } catch (err) {
      console.error("Fetch inactive admins error:", err);
      if (err.response?.status === 403) {
        setError("Access forbidden. You don't have permission to view inactive admins.");
      } else if (err.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError(err.response?.data?.message || "Failed to fetch inactive admins");
      }
    } finally {
      setLoading(false);
    }
  }, [token, isSuperAdmin, API_BASE]);

  useEffect(() => {
    if (token && isSuperAdmin) {
      fetchInactiveAdmins();
    }
  }, [token, isSuperAdmin, fetchInactiveAdmins]);

  const handleReactivate = async (adminId, adminName) => {
    if (!window.confirm(`Are you sure you want to reactivate ${adminName}?`)) {
      return;
    }

    if (!token) {
      setError("Authentication token missing. Please log in again.");
      return;
    }

    if (!isSuperAdmin) {
      setError("Access forbidden. Only Super Admin can reactivate admins.");
      return;
    }

    try {
      setActionLoading(adminId);
      setError(null);
      setSuccess(null);
      
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const response = await axios.put(
        `${API_BASE}/api/admin/admins/${adminId}/reactivate`,
        {},
        { headers }
      );

      if (response.data.success) {
        setSuccess(`${adminName} has been reactivated successfully!`);
        fetchInactiveAdmins();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(response.data.message || "Failed to reactivate admin");
      }
    } catch (err) {
      console.error("Reactivate admin error:", err);
      if (err.response?.status === 403) {
        setError("Access forbidden. You don't have permission to reactivate admins.");
      } else if (err.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError(err.response?.data?.message || "Failed to reactivate admin");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "superadmin":
        return "ia-role-badge ia-superadmin";
      case "platformadmin":
        return "ia-role-badge ia-platformadmin";
      case "supportadmin":
        return "ia-role-badge ia-supportadmin";
      default:
        return "ia-role-badge";
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case "superadmin":
        return "Super Admin";
      case "platformadmin":
        return "Platform Admin";
      case "supportadmin":
        return "Support Admin";
      default:
        return role;
    }
  };

  const getAvatarLetter = (admin) => {
    const name = admin.name || admin.username || admin.email?.split('@')[0] || 'A';
    return name[0]?.toUpperCase() || 'A';
  };

  if (token && !isSuperAdmin) {
    return (
      <div className={`ia-page ia-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="ia-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="ia-grain" aria-hidden="true"></div>
        <div className="ia-container">
          <div className="ia-alert ia-alert-error">
            <div className="ia-alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span className="ia-alert-message">Access Denied: Super Admin privileges required.</span>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={`ia-page ia-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="ia-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="ia-grain" aria-hidden="true"></div>
        <div className="ia-container">
          <div className="ia-alert ia-alert-error">
            <div className="ia-alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span className="ia-alert-message">Authentication token missing. Please log in again.</span>
            <button onClick={() => window.location.href = "/admin-login"} className="ia-alert-btn">Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`ia-page ia-role-${role}`} style={{ "--theme-accent": themeColor }}>
        <div className="ia-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="ia-grain" aria-hidden="true"></div>
        <div className="ia-loading">
          <div className="ia-loading__ring" style={{ borderTopColor: themeColor }}></div>
          <p>Loading inactive admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ia-page ia-role-${role}`} style={{ "--theme-accent": themeColor }}>
      <div className="ia-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>
      <div className="ia-grain" aria-hidden="true"></div>

      <div className="ia-container">
        <div className="ia-header">
          <div>
            <h1 className="ia-title">Inactive Administrators</h1>
            <p className="ia-description">Manage deactivated admin accounts</p>
          </div>
        </div>

        {error && (
          <div className="ia-alert ia-alert-error">
            <div className="ia-alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span className="ia-alert-message">{error}</span>
            <button className="ia-alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="ia-alert ia-alert-success">
            <div className="ia-alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="ia-alert-message">{success}</span>
            <button className="ia-alert-close" onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <div className="ia-stats-row">
          <div className="ia-stat-box">
            <span className="ia-stat-value">{inactiveAdmins.length}</span>
            <span className="ia-stat-label">Inactive Admins</span>
          </div>
        </div>

        {inactiveAdmins.length === 0 ? (
          <div className="ia-empty-state">
            <div className="ia-empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="ia-empty-title">No Inactive Admins</h3>
            <p className="ia-empty-description">All administrators are currently active in the system.</p>
          </div>
        ) : (
          <div className="ia-table-wrapper">
            <table className="ia-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Deactivated On</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactiveAdmins.map((admin) => (
                  <tr key={admin._id}>
                    <td className="ia-name-cell">
                      <div className="ia-avatar-container">
                        {admin.avatar ? (
                          <img 
                            src={admin.avatar} 
                            alt={admin.name || 'Admin'}
                            className="ia-avatar-img"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.parentElement) {
                                const fallback = e.target.parentElement.querySelector('.ia-avatar-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className="ia-avatar-fallback" style={{ 
                          display: admin.avatar ? 'none' : 'flex',
                          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                          border: `2px solid ${themeColor}`
                        }}>
                          {getAvatarLetter(admin)}
                        </div>
                      </div>
                      <div className="ia-name-info">
                        <span className="ia-admin-name">{admin.name || admin.username || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="ia-email-cell">{admin.email}</td>
                    <td>
                      <span className={getRoleBadgeClass(admin.role)}>
                        {getRoleDisplayName(admin.role)}
                      </span>
                    </td>
                    <td className="ia-date-cell">
                      {formatDate(admin.adminDeactivatedAt)}
                    </td>
                    <td className="ia-reason-cell">
                      {admin.adminDeactivationReason || "No reason provided"}
                    </td>
                    <td className="ia-actions-cell">
                      <button
                        className="ia-btn ia-btn-reactivate"
                        onClick={() => handleReactivate(admin._id, admin.name)}
                        disabled={actionLoading === admin._id}
                        style={{ borderColor: themeColor, color: themeColor }}
                      >
                        {actionLoading === admin._id ? (
                          <>
                            <span className="ia-spinner-small"></span>
                            Reactivating...
                          </>
                        ) : (
                          "Reactivate"
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ia-info-note">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p>
            <strong>Note:</strong> Reactivated admins will regain full access to the system.
            They will receive a notification upon reactivation.
          </p>
        </div>
      </div>
    </div>
  );
}