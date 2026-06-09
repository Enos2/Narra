/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
/**
 * FILE: frontend/src/pages/admin/AdminProfile.jsx
 * DESCRIPTION: Admin profile page with 2-column layout, gender selection, password display
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

export default function AdminProfile() {
  const { user, token, updateUserData, logout } = useAppContext();
  const navigate = useNavigate();

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const genderOptions = [
    { value: "", label: "Select Gender" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "prefer_not_to_say", label: "Prefer not to say" }
  ];

  const getThemeAccent = () => {
    if (!user) return "#f8b305";
    switch (user.role) {
      case "superadmin": return "#f8b305";
      case "platformadmin": return "#043ede";
      case "supportadmin": return "#00a321";
      default: return "#f8b305";
    }
  };

  const themeAccent = getThemeAccent();

  const getRoleDisplay = (role) => {
    switch (role) {
      case "superadmin": return "Super Administrator";
      case "platformadmin": return "Platform Administrator";
      case "supportadmin": return "Support Administrator";
      default: return role || "Admin";
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "superadmin": return "👑";
      case "platformadmin": return "⚙️";
      case "supportadmin": return "🛡️";
      default: return "👤";
    }
  };

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
      
      if (user.role === 'superadmin') {
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
  }, [token, user]);

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
        setIsSuperAdmin(userData.role === 'superadmin');
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
        setMessage({ type: "success", text: "Avatar updated!" });
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
        setMessage({ type: "success", text: "Profile updated!" });
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
    return <div className="admin-profile-loading"><div className="loading-spinner" style={{ borderTopColor: themeAccent }}></div><p>Loading...</p></div>;
  }

  if (error || !profile) {
    return (
      <div className="admin-profile-error">
        <div className="error-icon">⚠️</div>
        <h2>Error Loading Profile</h2>
        <p>{error || "Unable to load profile"}</p>
        <button onClick={() => window.location.reload()} className="retry-btn" style={{ background: themeAccent }}>Retry</button>
      </div>
    );
  }

  const displayName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.username || "Admin";
  const memberSince = formatDate(profile.createdAt);

  return (
    <div className="admin-profile-wrapper" style={{ "--theme-accent": themeAccent }}>
      {message.text && (
        <div className={`admin-profile-message ${message.type}`}>
          <span>{message.type === "success" ? "✅" : "❌"} {message.text}</span>
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      <div className="admin-profile-container">
        {/* LEFT COLUMN - Profile Info */}
        <div className="profile-left">
          <div className="profile-card">
            <div className="avatar-container">
              {profile.avatar ? (
                <img src={profile.avatar} alt={displayName} className="profile-avatar" />
              ) : (
                <div className="avatar-placeholder">{displayName[0]?.toUpperCase() || "A"}</div>
              )}
              {uploadingAvatar && <div className="avatar-progress-bar" style={{ width: `${uploadProgress}%` }}></div>}
              <label className="avatar-upload-btn" style={{ background: themeAccent }}>
                <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                <span>📷</span>
              </label>
            </div>
            
            <h2 className="profile-name">{displayName}</h2>
            <div className="role-badge" style={{ background: `${themeAccent}20`, color: themeAccent }}>
              {getRoleIcon(user?.role)} {getRoleDisplay(user?.role)}
            </div>
            <p className="profile-email">{profile.email}</p>
            <p className="profile-username">@{profile.username}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            <div className="profile-details">
              <div className="detail-item">📅 Joined {memberSince}</div>
              {profile.location && <div className="detail-item">📍 {profile.location}</div>}
              <div className="detail-item">⚧ {genderOptions.find(g => g.value === profile.gender)?.label || "Not specified"}</div>
            </div>
            <div className="profile-actions">
              <button className="edit-btn" onClick={() => setIsEditing(!isEditing)}>{isEditing ? "Cancel" : "✏️ Edit"}</button>
              <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Stats and Actions */}
        <div className="profile-right">
          {/* Stats Row - Horizontal */}
          <div className="stats-row">
            <div className="stat-box">
              <span className="stat-value">{adminStats.totalActions}</span>
              <span className="stat-label">Total Actions</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{adminStats.actionsThisMonth}</span>
              <span className="stat-label">This Month</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{adminStats.videosApproved}</span>
              <span className="stat-label">Approved</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{adminStats.videosRejected}</span>
              <span className="stat-label">Rejected</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{adminStats.usersBanned}</span>
              <span className="stat-label">Banned</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{adminStats.usersVerified}</span>
              <span className="stat-label">Verified</span>
            </div>
          </div>

          {/* Edit Form - When editing */}
          {isEditing && (
            <div className="edit-card">
              <h3>Edit Profile</h3>
              <div className="edit-grid">
                <div className="edit-field">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Middle Name</label>
                  <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Username</label>
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}>
                    {genderOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="edit-field full-width">
                  <label>Bio</label>
                  <textarea name="bio" value={formData.bio} onChange={handleInputChange} rows="2" />
                </div>
                <div className="edit-field">
                  <label>Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Website</label>
                  <input type="url" name="website" value={formData.website} onChange={handleInputChange} />
                </div>
                <div className="edit-field">
                  <label>Phone</label>
                  <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className="password-section">
                <button type="button" className="change-password-btn" onClick={() => setShowChangePassword(!showChangePassword)}>
                  {showChangePassword ? "− Cancel" : "+ Change Password"}
                </button>
                {showChangePassword && (
                  <div className="password-fields">
                    <div className="edit-field">
                      <label>Current Password</label>
                      <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} />
                    </div>
                    <div className="edit-field">
                      <label>New Password</label>
                      <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} />
                    </div>
                    <div className="edit-field">
                      <label>Confirm Password</label>
                      <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="edit-actions">
                <button className="cancel-edit" onClick={() => { setIsEditing(false); setShowChangePassword(false); loadProfile(); }}>Cancel</button>
                <button className="save-edit" onClick={handleSaveProfile} disabled={isSaving} style={{ background: themeAccent }}>{isSaving ? "Saving..." : "Save Changes"}</button>
              </div>
            </div>
          )}

          {/* Admins Created - Super Admin Only - FIXED with optional chaining */}
          {isSuperAdmin && adminStats?.adminsCreatedList?.length > 0 && (
            <div className="admins-card">
              <div className="card-header">
                <h3>👥 Admins You Created ({adminStats.adminsCreated})</h3>
                <Link to="/admin/admins" className="view-link" style={{ color: themeAccent }}>Manage →</Link>
              </div>
              <div className="admins-list">
                {adminStats.adminsCreatedList.slice(0, 5).map(admin => (
                  <div key={admin._id || admin.id} className="admin-item">
                    <div className="admin-avatar">{admin.name?.[0]?.toUpperCase() || admin.email?.[0]?.toUpperCase() || "A"}</div>
                    <div className="admin-info">
                      <div className="admin-name">{admin.name || admin.email}</div>
                      <div className="admin-email">{admin.email}</div>
                    </div>
                    <span className={`admin-role ${admin.role}`}>{admin.role === 'superadmin' ? '👑' : admin.role === 'platformadmin' ? '⚙️' : '🛡️'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Link */}
          <div className="audit-card">
            <div className="audit-content">
              <span className="audit-icon">📝</span>
              <div className="audit-text">
                <strong>Accountability</strong> - All your actions are logged
              </div>
              <Link to="/admin/audit-logs" className="audit-link" style={{ color: themeAccent }}>View Logs →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}