/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
/**
 * FILE: frontend/src/pages/admin/AdminProfile.jsx
 * DESCRIPTION: Admin profile page with role-based theming, background animations, no emojis
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import {
  updateUserProfile,
  uploadAvatar,
  getUserProfile,
  getRecentAuditLogs
} from "../../requests";
import "./AdminProfile.css";

const ROLE_LABELS = {
  superadmin: "Super Administrator",
  platformadmin: "Platform Administrator",
  supportadmin: "Support Administrator",
};

const genderOptions = [
  { value: "", label: "Select Gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" }
];

export default function AdminProfile() {
  const { user, token, updateUserData, logout } = useAppContext();
  const navigate = useNavigate();
  const role = user?.role || "superadmin";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    username: "",
    email: "",
    bio: "",
    location: "",
    website: "",
    phoneNumber: "",
    gender: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [adminStats, setAdminStats] = useState({
    totalActions: 0,
    actionsThisMonth: 0,
    usersBanned: 0,
    usersVerified: 0,
    videosApproved: 0,
    videosRejected: 0,
    videosFlagged: 0,
    liveStreamsEnded: 0,
    adminsCreated: 0,
    adminsCreatedList: []
  });
  
  const [loadingStats, setLoadingStats] = useState(false);
  const isSuperAdmin = user?.role === "superadmin";

  const getThemeAccent = () => {
    switch (role) {
      case "superadmin": return "#FFD700";
      case "platformadmin": return "#3B82F6";
      case "supportadmin": return "#22c55e";
      default: return "#FFD700";
    }
  };

  const themeAccent = getThemeAccent();

  const fetchAdminStats = useCallback(async () => {
    if (!token || !user) return;
    setLoadingStats(true);
    try {
      const logsRes = await getRecentAuditLogs(token, 500);
      let allLogs = [];
      if (logsRes && logsRes.logs) allLogs = logsRes.logs;
      else if (Array.isArray(logsRes)) allLogs = logsRes;
      
      const myLogs = allLogs.filter(log => 
        log.adminId === user._id || log.adminEmail === user.email
      );
      
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      setAdminStats(prev => ({
        ...prev,
        usersBanned: myLogs.filter(l => l.actionType === 'BAN_USER').length,
        usersVerified: myLogs.filter(l => l.actionType === 'VERIFY_USER').length,
        videosApproved: myLogs.filter(l => l.actionType === 'APPROVE_VIDEO').length,
        videosRejected: myLogs.filter(l => l.actionType === 'REJECT_VIDEO').length,
        videosFlagged: myLogs.filter(l => l.actionType === 'FLAG_VIDEO').length,
        liveStreamsEnded: myLogs.filter(l => l.actionType === 'END_LIVE_STREAM').length,
        totalActions: myLogs.length,
        actionsThisMonth: myLogs.filter(l => new Date(l.createdAt) > monthAgo).length
      }));
      
      if (isSuperAdmin) {
        try {
          const response = await fetch(`http://localhost:5000/api/admin/admins/created-by/${user._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setAdminStats(prev => ({
              ...prev,
              adminsCreated: data.total || data.admins?.length || 0,
              adminsCreatedList: data.admins || []
            }));
          }
        } catch (err) {
          console.error("Error fetching admins created:", err);
        }
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [token, user, isSuperAdmin]);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getUserProfile(token);
      if (response && (response.data || response.user)) {
        const userData = response.data || response.user;
        setProfile(userData);
        setFormData({
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          middleName: userData.middleName || "",
          username: userData.username || "",
          email: userData.email || "",
          bio: userData.bio || "",
          location: userData.location || "",
          website: userData.website || "",
          phoneNumber: userData.phoneNumber || "",
          gender: userData.gender || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
    fetchAdminStats();
  }, [loadProfile, fetchAdminStats]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image size must be less than 5MB" });
      return;
    }
    setUploadingAvatar(true);
    setUploadProgress(0);
    try {
      const result = await uploadAvatar(token, file, (progress) => setUploadProgress(progress));
      if (result && result.success) {
        await updateUserData();
        await loadProfile();
        setMessage({ type: "success", text: "Avatar updated" });
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (err) {
      setMessage({ type: "error", text: "Upload failed" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (formData.newPassword && formData.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        username: formData.username,
        email: formData.email,
        bio: formData.bio,
        location: formData.location,
        website: formData.website,
        phoneNumber: formData.phoneNumber,
        gender: formData.gender
      };
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.password = formData.newPassword;
      }
      const result = await updateUserProfile(token, updateData);
      if (result && result.success) {
        await updateUserData();
        await loadProfile();
        setMessage({ type: "success", text: "Profile updated" });
        setIsEditing(false);
        setShowChangePassword(false);
        setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (err) {
      setMessage({ type: "error", text: "Update failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/admin-login");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className={`ap-loading ap-role-${role}`}>
        <div className="ap-loading__ring" style={{ borderTopColor: themeAccent }}></div>
        <p>Loading profile</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="ap-error">
        <div className="ap-error__icon"></div>
        <h2>Error Loading Profile</h2>
        <p>{error || "Unable to load profile"}</p>
        <button onClick={() => window.location.reload()} className="ap-retry" style={{ background: themeAccent }}>Retry</button>
      </div>
    );
  }

  const displayName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.username || "Admin";
  const memberSince = formatDate(profile.createdAt);

  return (
    <div className={`ap-page ap-role-${role}`} style={{ "--theme-accent": themeAccent }}>

      {/* Animated SVG background */}
      <div className="ap-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>

      {/* Grain overlay */}
      <div className="ap-grain" aria-hidden="true"></div>

      {/* Message Alert */}
      {message.text && (
        <div className={`ap-message ${message.type}`}>
          <span>{message.type === "success" ? "✓" : "✗"} {message.text}</span>
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      <div className="ap-container">

        {/* LEFT COLUMN - Profile Card */}
        <div className="ap-left">
          <div className="ap-card">
            <div className="ap-avatar-container">
              {profile.avatar ? (
                <img src={profile.avatar} alt={displayName} className="ap-avatar" />
              ) : (
                <div className="ap-avatar-placeholder">{displayName[0]?.toUpperCase() || "A"}</div>
              )}
              {uploadingAvatar && <div className="ap-avatar-progress" style={{ width: `${uploadProgress}%`, background: themeAccent }}></div>}
              <label className="ap-avatar-upload">
                <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                <svg className="ap-camera-icon" viewBox="0 0 24 24" fill="none" stroke={themeAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </label>
            </div>
            
            <h2 className="ap-name">{displayName}</h2>
            <div className="ap-role" style={{ background: `${themeAccent}20`, color: themeAccent }}>
              {ROLE_LABELS[role] || "Administrator"}
            </div>
            <p className="ap-email">{profile.email}</p>
            <p className="ap-username">@{profile.username}</p>
            {profile.bio && <p className="ap-bio">{profile.bio}</p>}
            
            <div className="ap-details">
              <div className="ap-detail-item">Joined {memberSince}</div>
              {profile.location && <div className="ap-detail-item">{profile.location}</div>}
              <div className="ap-detail-item">
                {genderOptions.find(g => g.value === profile.gender)?.label || "Not specified"}
              </div>
            </div>
            
            <div className="ap-actions">
              <button className="ap-edit-btn" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
              <button className="ap-logout-btn" onClick={handleLogout}>Sign Out</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Stats and Actions */}
        <div className="ap-right">

          {/* Stats Row */}
          <div className="ap-stats-row">
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.totalActions}</span>
              <span className="ap-stat-label">Total Actions</span>
            </div>
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.actionsThisMonth}</span>
              <span className="ap-stat-label">This Month</span>
            </div>
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.videosApproved}</span>
              <span className="ap-stat-label">Approved</span>
            </div>
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.videosRejected}</span>
              <span className="ap-stat-label">Rejected</span>
            </div>
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.usersBanned}</span>
              <span className="ap-stat-label">Banned</span>
            </div>
            <div className="ap-stat-box">
              <span className="ap-stat-value">{adminStats.usersVerified}</span>
              <span className="ap-stat-label">Verified</span>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className="ap-edit-card">
              <h3>Edit Profile</h3>
              <div className="ap-edit-grid">
                <div className="ap-edit-field">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Middle Name</label>
                  <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Username</label>
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}>
                    {genderOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="ap-edit-field ap-full-width">
                  <label>Bio</label>
                  <textarea name="bio" value={formData.bio} onChange={handleInputChange} rows="2" />
                </div>
                <div className="ap-edit-field">
                  <label>Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Website</label>
                  <input type="url" name="website" value={formData.website} onChange={handleInputChange} />
                </div>
                <div className="ap-edit-field">
                  <label>Phone</label>
                  <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className="ap-password-section">
                <button type="button" className="ap-password-toggle" onClick={() => setShowChangePassword(!showChangePassword)}>
                  {showChangePassword ? "Cancel Password Change" : "Change Password"}
                </button>
                {showChangePassword && (
                  <div className="ap-password-fields">
                    <div className="ap-edit-field">
                      <label>Current Password</label>
                      <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} />
                    </div>
                    <div className="ap-edit-field">
                      <label>New Password</label>
                      <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} />
                    </div>
                    <div className="ap-edit-field">
                      <label>Confirm Password</label>
                      <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ap-edit-actions">
                <button className="ap-cancel-btn" onClick={() => { setIsEditing(false); setShowChangePassword(false); loadProfile(); }}>Cancel</button>
                <button className="ap-save-btn" onClick={handleSaveProfile} disabled={isSaving} style={{ background: themeAccent }}>{isSaving ? "Saving..." : "Save Changes"}</button>
              </div>
            </div>
          )}

          {/* Admins Created - Super Admin Only */}
          {isSuperAdmin && adminStats?.adminsCreatedList?.length > 0 && (
            <div className="ap-admins-card">
              <div className="ap-card-header">
                <h3>Admins You Created ({adminStats.adminsCreated})</h3>
                <Link to="/admin/admins" className="ap-view-link" style={{ color: themeAccent }}>Manage →</Link>
              </div>
              <div className="ap-admins-list">
                {adminStats.adminsCreatedList.slice(0, 5).map(admin => (
                  <div key={admin._id || admin.id} className="ap-admin-item">
                    <div className="ap-admin-avatar">{admin.name?.[0]?.toUpperCase() || admin.email?.[0]?.toUpperCase() || "A"}</div>
                    <div className="ap-admin-info">
                      <div className="ap-admin-name">{admin.name || admin.email}</div>
                      <div className="ap-admin-email">{admin.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Link */}
          <div className="ap-audit-card">
            <div className="ap-audit-content">
              <div className="ap-audit-icon">
                <svg className="ap-audit-svg" viewBox="0 0 24 24" fill="none" stroke={themeAccent} strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div className="ap-audit-text">
                <strong>Accountability</strong> - All your actions are logged
              </div>
              <Link to="/admin/audit-logs" className="ap-audit-link" style={{ color: themeAccent }}>View Logs →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUPER ADMIN background ────────────────────────────────────────────────
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#sg1)">
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

// ── PLATFORM ADMIN background ─────────────────────────────────────────────
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
    <svg className="ap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#pbg)">
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

// ── SUPPORT ADMIN background ──────────────────────────────────────────────
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
    <svg className="ap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#sbg)" />
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