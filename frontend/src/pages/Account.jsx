/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
  updateUserProfile,
  uploadAvatar,
  getFollowers,
  getFollowing,
  getTwins,
  getFollowSuggestions,
  getUploadStatus,
  checkUsername,
} from "../requests";
import "./Account.css";

// ── Safe API base URL — never "undefined/..." ───────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Theme picker ────────────────────────────────────────────────────────────
function ThemePicker() {
  const { theme, setTheme, setCustomTheme, presets } = useTheme();
  const [customBg, setCustomBg] = useState(theme.bg);
  const [customAccent, setCustomAccent] = useState(theme.accent);
  const [showCustom, setShowCustom] = useState(theme.id === "custom");

  const handlePreset = (preset) => {
    if (preset.id === "custom") { setShowCustom(true); return; }
    setShowCustom(false);
    setTheme(preset);
  };

  return (
    <div className="theme-picker-section">
      <h3 className="theme-picker-title">Appearance Theme</h3>
      <p className="theme-picker-desc">
        Choose background and accent color for all pages. Your choice is saved automatically.
      </p>

      <div className="theme-presets-grid">
        {presets.filter((p) => p.id !== "custom").map((preset) => (
          <button
            key={preset.id}
            className={`theme-preset-btn ${theme.id === preset.id ? "theme-preset-active" : ""}`}
            onClick={() => handlePreset(preset)}
            title={preset.label}
          >
            <div className="theme-preset-swatch">
              <div className="theme-swatch-bg" style={{ background: preset.bg }} />
              <div className="theme-swatch-accent" style={{ background: preset.accent }} />
            </div>
            <span className="theme-preset-label">{preset.label}</span>
            {theme.id === preset.id && <span className="theme-preset-check">✓</span>}
          </button>
        ))}
        <button
          className={`theme-preset-btn ${theme.id === "custom" ? "theme-preset-active" : ""}`}
          onClick={() => setShowCustom((v) => !v)}
          title="Custom"
        >
          <div className="theme-preset-swatch theme-swatch-custom"><span>🎨</span></div>
          <span className="theme-preset-label">Custom</span>
        </button>
      </div>

      {showCustom && (
        <div className="theme-custom-wrap">
          <div className="theme-custom-row">
            <div className="theme-custom-field">
              <label>Background Color</label>
              <div className="theme-color-input-row">
                <input
                  type="color" value={customBg} className="theme-color-picker"
                  onChange={(e) => setCustomBg(e.target.value)}
                />
                <input
                  type="text" value={customBg} maxLength={7} placeholder="#060606"
                  className="theme-color-text"
                  onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCustomBg(e.target.value); }}
                />
              </div>
              <p className="theme-custom-hint">Keep background very dark for best look</p>
            </div>
            <div className="theme-custom-field">
              <label>Accent Color</label>
              <div className="theme-color-input-row">
                <input
                  type="color" value={customAccent} className="theme-color-picker"
                  onChange={(e) => setCustomAccent(e.target.value)}
                />
                <input
                  type="text" value={customAccent} maxLength={7} placeholder="#8b0000"
                  className="theme-color-text"
                  onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCustomAccent(e.target.value); }}
                />
              </div>
              <p className="theme-custom-hint">Used for borders, buttons, highlights</p>
            </div>
          </div>

          <div className="theme-preview-bar" style={{ background: customBg }}>
            <div className="theme-preview-claw" style={{ background: customAccent }} />
            <div className="theme-preview-claw" style={{ background: customAccent, opacity: 0.6 }} />
            <div className="theme-preview-claw" style={{ background: customAccent, opacity: 0.3 }} />
            <span style={{ color: customAccent, fontFamily: "monospace", fontSize: "11px", letterSpacing: "2px" }}>
              PREVIEW
            </span>
          </div>

          <button
            className="theme-apply-btn"
            onClick={() => setCustomTheme(customBg, customAccent)}
            style={{ borderColor: customAccent, color: customAccent }}
          >
            Apply Custom Theme
          </button>
        </div>
      )}

      <div className="theme-current-info">
        <div className="theme-current-dot" style={{ background: theme.accent }} />
        <span>
          Active: <strong>{theme.label}</strong> — bg: {theme.bg} · accent: {theme.accent}
        </span>
      </div>
    </div>
  );
}

// ── Decorative background ───────────────────────────────────────────────────
function ClawBackground() {
  return (
    <div className="acct-claw-bg">
      {[...Array(12)].map((_, i) => <div key={i} className={`acct-claw acct-claw-${i + 1}`} />)}
      {[...Array(4)].map((_, i) => <div key={i} className={`acct-scar-diag acct-scar-diag-${i + 1}`} />)}
      {[...Array(5)].map((_, i) => <div key={i} className={`acct-scratch-h acct-scratch-h-${i + 1}`} />)}
      {[...Array(4)].map((_, i) => <div key={i} className={`acct-scratch-v acct-scratch-v-${i + 1}`} />)}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`acct-triple acct-triple-${i}`}>
          <span /><span /><span />
        </div>
      ))}
      {[1, 2, 3].map((i) => <div key={i} className={`acct-scar-x acct-scar-x-${i}`} />)}
    </div>
  );
}

// ── Main Account component ──────────────────────────────────────────────────
function Account() {
  const { user, token, logout, videos = [], liveStreams = [], updateUserData } = useAppContext();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const userId = user?.id || user?._id || null;

  const [activeTab, setActiveTab] = useState("profile");
  const [localUser, setLocalUser] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", middleName: "", username: "",
    email: "", bio: "", location: "", website: "", phoneNumber: "",
    dateOfBirth: "", gender: "", currentPassword: "", newPassword: "", confirmPassword: "",
  });

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailComments: true, emailNewFollowers: true, emailMessages: true,
    emailLiveStreams: true, emailVideoUploads: true, emailMentions: true,
    pushEnabled: true, pushComments: true, pushNewFollowers: true,
    pushMessages: true, pushLiveStreams: true,
  });

  const [privacySettings, setPrivacySettings] = useState({
    showEmail: false, showFollowers: true, showFollowing: true,
    showLikedVideos: true, showPurchasedContent: false,
    allowMessages: true, allowComments: true, allowMentions: true,
    profileVisibility: "public",
  });

  const [themeState, setThemeState] = useState("system");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [avatar, setAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [twins, setTwins] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [socialLoaded, setSocialLoaded] = useState(false);

  const [purchasedContent, setPurchasedContent] = useState([]);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [uploadedStreams, setUploadedStreams] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [uploadQuota, setUploadQuota] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [feedback, setFeedback] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // ── Mount tracker ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Sync localUser only when user ID changes ──
  useEffect(() => {
    if (user && userId) {
      setLocalUser({ ...user, avatar: user.avatar || null });
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate form only when username (identity) changes ──
  const localUsername = localUser?.username ?? "";
  useEffect(() => {
    if (!localUser) return;
    setFormData({
      firstName: localUser.firstName || "",
      lastName: localUser.lastName || "",
      middleName: localUser.middleName || "",
      username: localUser.username || "",
      email: localUser.email || "",
      bio: localUser.bio || "",
      location: localUser.location || "",
      website: localUser.website || "",
      phoneNumber: localUser.phoneNumber || "",
      dateOfBirth: localUser.dateOfBirth
        ? new Date(localUser.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: localUser.gender || "",
      currentPassword: "", newPassword: "", confirmPassword: "",
    });
    setAvatar(localUser.avatar || null);
    if (localUser.notificationPreferences)
      setNotificationPrefs((p) => ({ ...p, ...localUser.notificationPreferences }));
    if (localUser.privacySettings)
      setPrivacySettings((p) => ({ ...p, ...localUser.privacySettings }));
    if (localUser.theme) setThemeState(localUser.theme);
    if (localUser.preferredLanguage) setPreferredLanguage(localUser.preferredLanguage);
  }, [localUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Account age ──
  const getFormattedAccountAge = useCallback(() => {
    if (!localUser?.createdAt) return "0 days";
    const totalDays = Math.floor(
      Math.abs(new Date() - new Date(localUser.createdAt)) / (1000 * 60 * 60 * 24)
    );
    if (totalDays < 30) return `${totalDays} day${totalDays !== 1 ? "s" : ""} (${totalDays}d total)`;
    if (totalDays < 365) return `${Math.floor(totalDays / 30)}mo ${totalDays % 30}d (${totalDays}d total)`;
    return `${Math.floor(totalDays / 365)}yr ${Math.floor((totalDays % 365) / 30)}mo (${totalDays}d total)`;
  }, [localUser?.createdAt]);

  // ── Refresh from server ──
  const refreshUserData = useCallback(async () => {
    if (!updateUserData) return null;
    const updated = await updateUserData();
    if (updated) setLocalUser(updated);
    return updated;
  }, [updateUserData]);

  // ── Username availability ──
  useEffect(() => {
    const cur = formData.username;
    if (!cur || cur === localUser?.username || cur.length < 3) {
      setIsUsernameAvailable(true); return;
    }
    let active = true;
    const t = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const r = await checkUsername(token, cur);
        if (active) setIsUsernameAvailable(r.isAvailable === true);
      } catch { if (active) setIsUsernameAvailable(true); }
      finally { if (active) setCheckingUsername(false); }
    }, 500);
    return () => { active = false; clearTimeout(t); };
  }, [formData.username, localUser?.username, token]);

  // ── Content lists ──
  const purchasedVideoIds = localUser?.purchasedVideoIds;
  const purchasedVideosField = localUser?.purchasedVideos;
  useEffect(() => {
    if (!userId || !videos.length) return;
    const userVideos = videos.filter(
      (v) => v.uploaderId === userId || v.user === userId || v.creator === userId
    );
    setPurchasedContent(
      videos.filter((v) => purchasedVideoIds?.includes(v.id) || purchasedVideosField?.includes(v._id))
    );
    setUploadedVideos(userVideos.filter((v) => v.status === "approved" && !v.isLive));
    setUploadedStreams(liveStreams.filter((s) => s.uploaderId === userId));
    setPendingUploads(userVideos.filter((v) => v.status === "pending"));
  }, [userId, videos.length, liveStreams.length, purchasedVideoIds, purchasedVideosField]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Social data ──
  useEffect(() => {
    if (!token || !userId || socialLoaded) return;
    let active = true;
    setLoadingSocial(true);
    const load = async () => {
      try {
        const [frs, fng, tw, sug, quota] = await Promise.all([
          getFollowers(token, userId, 1, 5),
          getFollowing(token, userId, 1, 5),
          getTwins(token, userId, 1, 5),
          getFollowSuggestions(token, 5),
          getUploadStatus(token).catch(() => null),
        ]);
        if (!active) return;
        if (frs?.success) setFollowers(frs.data || []);
        if (fng?.success) setFollowing(fng.data || []);
        if (tw?.success) setTwins(tw.data || []);
        if (sug?.success) setSuggestions(sug.data || []);
        if (quota?.success && quota.quota) setUploadQuota(quota.quota);
        setSocialLoaded(true);
      } catch (e) { console.error("Social load error:", e); }
      finally { if (active) setLoadingSocial(false); }
    };
    load();
    return () => { active = false; };
  }, [token, userId, socialLoaded]);

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy" },
    { id: "social", label: "Social" },
    { id: "content", label: "Content" },
    { id: "purchased", label: "Purchased" },
    { id: "theme", label: "Theme" },
  ];

  // ── Helpers ──
  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => { if (isMountedRef.current) setMessage({ type: "", text: "" }); }, 3000);
  }, []);

  const resetForm = useCallback(() => {
    if (!localUser) return;
    setFormData({
      firstName: localUser.firstName || "", lastName: localUser.lastName || "",
      middleName: localUser.middleName || "", username: localUser.username || "",
      email: localUser.email || "", bio: localUser.bio || "",
      location: localUser.location || "", website: localUser.website || "",
      phoneNumber: localUser.phoneNumber || "",
      dateOfBirth: localUser.dateOfBirth ? new Date(localUser.dateOfBirth).toISOString().split("T")[0] : "",
      gender: localUser.gender || "",
      currentPassword: "", newPassword: "", confirmPassword: "",
    });
  }, [localUser]);

  // ── Avatar ──
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showMessage("error", "Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { showMessage("error", "Image size must be less than 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
    await handleAvatarUpload(file);
  };

  const handleAvatarUpload = async (file) => {
    if (!token) { showMessage("error", "You must be logged in"); return; }
    setUploadingAvatar(true); setUploadProgress(0);
    try {
      const result = await uploadAvatar(token, file, (p) => { if (isMountedRef.current) setUploadProgress(p); });
      if (result?.success) {
        const newUrl = result.avatarUrl || result.data?.avatar;
        if (newUrl) {
          setAvatar(newUrl);
          setLocalUser((prev) => ({ ...prev, avatar: newUrl }));
          const updated = await refreshUserData();
          if (updated?.avatar) setAvatar(updated.avatar);
        } else {
          const updated = await refreshUserData();
          if (updated?.avatar) setAvatar(updated.avatar);
        }
        showMessage("success", "Avatar updated successfully!");
      } else throw new Error(result?.message || "Upload failed");
    } catch (err) {
      showMessage("error", err.message || "Failed to upload avatar.");
      setAvatar(localUser?.avatar || null);
    } finally {
      if (isMountedRef.current) { setUploadingAvatar(false); setUploadProgress(0); }
    }
  };

  // ── Remove avatar — uses safe API_BASE constant ──
  const handleRemoveAvatar = async () => {
    if (!token) return;
    setRemovingAvatar(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setAvatar(null);
        setLocalUser((prev) => ({ ...prev, avatar: null }));
        await refreshUserData();
        showMessage("success", "Profile picture removed.");
      } else {
        // Fallback: update via profile endpoint
        const result = await updateUserProfile(token, { avatar: null });
        if (result?.success) {
          setAvatar(null);
          setLocalUser((prev) => ({ ...prev, avatar: null }));
          showMessage("success", "Profile picture removed.");
        } else throw new Error("Remove failed");
      }
    } catch {
      showMessage("error", "Failed to remove profile picture.");
    } finally {
      if (isMountedRef.current) setRemovingAvatar(false);
    }
  };

  // ── Form handlers ──
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };
  const handleNotificationChange = (key) =>
    setNotificationPrefs((p) => ({ ...p, [key]: !p[key] }));
  const handlePrivacyChange = (key, value) =>
    setPrivacySettings((p) => ({ ...p, [key]: value }));

  const handleSaveProfile = async () => {
    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) { showMessage("error", "New passwords do not match"); return; }
      if (formData.newPassword.length < 6) { showMessage("error", "Password must be at least 6 characters"); return; }
      if (!formData.currentPassword) { showMessage("error", "Current password is required"); return; }
    }
    if (formData.username && formData.username !== localUser?.username && !isUsernameAvailable) {
      showMessage("error", "Username is already taken"); return;
    }
    setIsSaving(true);
    try {
      const updateData = {
        firstName: formData.firstName, lastName: formData.lastName, middleName: formData.middleName,
        username: formData.username, email: formData.email, bio: formData.bio,
        location: formData.location, website: formData.website, phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth || undefined, gender: formData.gender,
        notificationPreferences: notificationPrefs, privacySettings,
        theme: themeState, preferredLanguage,
      };
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.password = formData.newPassword;
      }
      const result = await updateUserProfile(token, updateData);
      if (result?.success) {
        showMessage("success", "Profile updated successfully!");
        await refreshUserData();
        setIsEditing(false);
        setShowPasswordSection(false);
        setFormData((p) => ({ ...p, currentPassword: "", newPassword: "", confirmPassword: "" }));
      } else throw new Error(result?.message || "Update failed");
    } catch (err) {
      showMessage("error", err.message || "Failed to update profile.");
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  // ── Logout all devices — uses safe API_BASE constant ──
  const handleLogoutAllDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/logout-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        showMessage("success", "Logged out of all devices!");
        setTimeout(() => logout(), 2000);
      } else throw new Error();
    } catch {
      showMessage("error", "Failed to logout all devices");
    }
  };

  // ── Not signed in ──
  if (!localUser) {
    return (
      <div className="account-wrapper">
        <ClawBackground />
        <div className="acct-blood-stroke top" />
        <div className="acct-blood-stroke bottom" />
        <div className="account-page">
          <h1>Account</h1>
          <div className="account-card">
            <p className="acct-empty">You are not signed in. Please log in to access your account.</p>
            <button className="acct-login-btn" onClick={() => navigate("/login")}>Go to Login</button>
          </div>
        </div>
      </div>
    );
  }

  const currentAvatar = localUser.avatar || avatar;

  return (
    <div className="account-wrapper">
      <ClawBackground />
      <div className="acct-blood-stroke top" />
      <div className="acct-blood-stroke bottom" />

      <div className="account-page">
        <h1>My Account</h1>

        {message.text && (
          <div className={`acct-message-banner ${message.type}`}>
            {message.type === "success" ? "[ OK ]" : "[ ERR ]"} {message.text}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="account-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content">

          {/* ===== PROFILE ===== */}
          {activeTab === "profile" && (
            <div className="account-card">
              <div className="card-header">
                <h2>Profile Information</h2>
                {!isEditing ? (
                  <button className="acct-edit-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                ) : (
                  <div className="edit-actions">
                    <button className="acct-cancel-btn" onClick={() => { setIsEditing(false); setShowPasswordSection(false); resetForm(); }} disabled={isSaving}>
                      Cancel
                    </button>
                    <button className="acct-save-btn" onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-section">
                {/* ── Avatar column - FIXED ── */}
                <div className="avatar-section">
                  <div className="avatar-wrapper large">
                    {currentAvatar && (
                      <img src={currentAvatar} alt="avatar" className="avatar"
                        onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                    )}
                    <div className="avatar-placeholder" style={{ display: currentAvatar ? "none" : "flex" }}>
                      {localUser.firstName?.[0] || localUser.email?.[0] || "U"}
                    </div>
                    {uploadingAvatar && (
                      <div className="upload-progress">
                        <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="avatar-input" 
                      onChange={handleAvatarChange} 
                      disabled={uploadingAvatar || removingAvatar}
                      id="avatar-file-input"
                    />
                    {!uploadingAvatar && !removingAvatar && (
                      <label htmlFor="avatar-file-input" className="avatar-overlay">
                        <span>Change Photo</span>
                      </label>
                    )}
                  </div>

                  {currentAvatar && (
                    <button className="acct-remove-avatar-btn" onClick={handleRemoveAvatar} disabled={removingAvatar || uploadingAvatar}>
                      {removingAvatar ? "Removing…" : "Remove Photo"}
                    </button>
                  )}

                  {uploadQuota && (
                    <div className="acct-quota-info">
                      <small>Storage: {uploadQuota.currentStorageGB}GB / {uploadQuota.quotaGB}GB</small>
                      <small>Videos: {uploadQuota.currentVideos} / {uploadQuota.maxVideos}</small>
                    </div>
                  )}

                  <div className="stats-row">
                    <div className="stat" onClick={() => setActiveTab("social")}>
                      <span className="stat-value">{localUser.followers?.length || 0}</span>
                      <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat" onClick={() => setActiveTab("social")}>
                      <span className="stat-value">{localUser.following?.length || 0}</span>
                      <span className="stat-label">Following</span>
                    </div>
                    <div className="stat" onClick={() => setActiveTab("social")}>
                      <span className="stat-value">{localUser.twins?.length || 0}</span>
                      <span className="stat-label">Twins</span>
                    </div>
                  </div>
                </div>

                {/* ── Info / Edit column ── */}
                <div className="profile-info">
                  {isEditing ? (
                    <div className="edit-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>First Name</label>
                          <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="First name" />
                        </div>
                        <div className="form-group">
                          <label>Last Name</label>
                          <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="Last name" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Middle Name</label>
                        <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} placeholder="Middle name (optional)" />
                      </div>
                      <div className="form-group">
                        <label>Username</label>
                        <div style={{ position: "relative" }}>
                          <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder="username" />
                          {checkingUsername && <span className="username-checking">…</span>}
                          {formData.username && formData.username !== localUser.username && !checkingUsername && (
                            <span className={`username-status ${isUsernameAvailable ? "available" : "taken"}`}>
                              {isUsernameAvailable ? "available" : "taken"}
                            </span>
                          )}
                        </div>
                        <small>3–30 chars · letters, numbers, underscores</small>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Email</label>
                          <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="your@email.com" />
                        </div>
                        <div className="form-group">
                          <label>Gender</label>
                          <select name="gender" value={formData.gender} onChange={handleInputChange}>
                            <option value="">Prefer not to say</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Bio</label>
                        <textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us about yourself…" rows="3" maxLength="500" />
                        <small>{formData.bio.length}/500</small>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Location</label>
                          <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="City, Country" />
                        </div>
                        <div className="form-group">
                          <label>Website</label>
                          <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://…" />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Phone Number</label>
                          <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="+1234567890" />
                        </div>
                        <div className="form-group">
                          <label>Date of Birth</label>
                          <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Theme</label>
                          <select value={themeState} onChange={(e) => setThemeState(e.target.value)}>
                            <option value="system">System Default</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Language</label>
                          <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}>
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="ja">Japanese</option>
                          </select>
                        </div>
                      </div>

                      <button type="button" className="acct-toggle-pwd-btn" onClick={() => setShowPasswordSection(!showPasswordSection)}>
                        {showPasswordSection ? "Hide Password Change" : "Change Password"}
                      </button>

                      {showPasswordSection && (
                        <div className="password-section">
                          <h3>Change Password</h3>
                          <div className="form-group">
                            <label>Current Password</label>
                            <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} placeholder="Enter current password" />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>New Password</label>
                              <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} placeholder="Min. 6 characters" />
                            </div>
                            <div className="form-group">
                              <label>Confirm Password</label>
                              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} placeholder="Re-enter new password" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="view-info">
                      <div className="info-grid">
                        <div className="info-cell">
                          <span className="info-label">Full Name</span>
                          <span className="info-value">{localUser.firstName} {localUser.middleName ? localUser.middleName + " " : ""}{localUser.lastName}</span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Username</span>
                          <span className="info-value">@{localUser.username}</span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Email</span>
                          <span className="info-value">{localUser.email}</span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Gender</span>
                          <span className="info-value capitalize">{localUser.gender || "Not specified"}</span>
                        </div>
                        {localUser.bio && (
                          <div className="info-cell wide">
                            <span className="info-label">Bio</span>
                            <span className="info-value">{localUser.bio}</span>
                          </div>
                        )}
                        {localUser.location && (
                          <div className="info-cell">
                            <span className="info-label">Location</span>
                            <span className="info-value">{localUser.location}</span>
                          </div>
                        )}
                        {localUser.website && (
                          <div className="info-cell">
                            <span className="info-label">Website</span>
                            <a href={localUser.website} target="_blank" rel="noopener noreferrer" className="info-value acct-link" onClick={(e) => e.stopPropagation()}>
                              {localUser.website}
                            </a>
                          </div>
                        )}
                        {localUser.phoneNumber && (
                          <div className="info-cell">
                            <span className="info-label">Phone</span>
                            <span className="info-value">{localUser.phoneNumber}</span>
                          </div>
                        )}
                        {localUser.dateOfBirth && (
                          <div className="info-cell">
                            <span className="info-label">Birthday</span>
                            <span className="info-value">{new Date(localUser.dateOfBirth).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="info-cell">
                          <span className="info-label">Member Since</span>
                          <span className="info-value">{new Date(localUser.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Account Age</span>
                          <span className="info-value">{getFormattedAccountAge()}</span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Role</span>
                          <span className="info-value">
                            <span className="acct-role-badge">
                              {localUser.role}
                              {localUser.isVerified && <span className="acct-verified-badge" title="Verified">V</span>}
                            </span>
                            {localUser.isCreator && <span className="acct-creator-badge">Creator</span>}
                          </span>
                        </div>
                        <div className="info-cell">
                          <span className="info-label">Balance</span>
                          <span className="info-value acct-balance">${localUser.balance || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== SECURITY ===== */}
          {activeTab === "security" && (
            <div className="account-card">
              <h2>Security Settings</h2>
              <div className="settings-section">
                <h3>Login History</h3>
                {localUser.loginHistory?.length > 0 ? (
                  <div className="login-history">
                    {localUser.loginHistory.slice(0, 5).map((login, idx) => (
                      <div key={idx} className="history-item">
                        <span className="history-device">{login.userAgent?.substring(0, 50) || "Unknown device"}</span>
                        <span className="history-time">{new Date(login.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="acct-empty">No login history available</p>}
              </div>
              <div className="settings-section">
                <h3>Active Sessions</h3>
                <div className="session-item">
                  <div className="session-info">
                    <span className="session-device">Current Session</span>
                    <span className="session-location">{localUser.location || "Unknown location"}</span>
                  </div>
                  <span className="session-status active">Active</span>
                </div>
                <button className="acct-logout-all-btn" onClick={handleLogoutAllDevices}>
                  Logout All Other Devices
                </button>
              </div>
            </div>
          )}

          {/* ===== NOTIFICATIONS ===== */}
          {activeTab === "notifications" && (
            <div className="account-card">
              <h2>Notification Preferences</h2>
              <div className="settings-section">
                <h3>Email Notifications</h3>
                {[
                  { key: "emailComments", title: "Comments", desc: "Get email when someone comments on your video" },
                  { key: "emailNewFollowers", title: "New Followers", desc: "Get email when someone follows you" },
                  { key: "emailMessages", title: "Messages", desc: "Get email when you receive a new message" },
                  { key: "emailLiveStreams", title: "Live Streams", desc: "Get email when someone you follow goes live" },
                ].map((item) => (
                  <div key={item.key} className="setting-item">
                    <label className="setting-label">
                      <input type="checkbox" checked={notificationPrefs[item.key]} onChange={() => handleNotificationChange(item.key)} />
                      <div className="setting-info">
                        <span className="setting-title">{item.title}</span>
                        <span className="setting-description">{item.desc}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="settings-section">
                <h3>Push Notifications</h3>
                <div className="setting-item">
                  <label className="setting-label">
                    <input type="checkbox" checked={notificationPrefs.pushEnabled} onChange={() => handleNotificationChange("pushEnabled")} />
                    <div className="setting-info">
                      <span className="setting-title">Enable Push Notifications</span>
                      <span className="setting-description">Receive notifications on your device</span>
                    </div>
                  </label>
                </div>
                {notificationPrefs.pushEnabled && ["pushComments", "pushNewFollowers", "pushMessages"].map((key) => (
                  <div key={key} className="setting-item indent">
                    <label className="setting-label">
                      <input type="checkbox" checked={notificationPrefs[key]} onChange={() => handleNotificationChange(key)} />
                      <div className="setting-info">
                        <span className="setting-title">{key.replace("push", "")}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== PRIVACY ===== */}
          {activeTab === "privacy" && (
            <div className="account-card">
              <h2>Privacy Settings</h2>
              <div className="settings-section">
                <h3>Profile Privacy</h3>
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-title">Profile Visibility</span>
                    <span className="setting-description">Control who can see your profile</span>
                  </div>
                  <select className="acct-privacy-select" value={privacySettings.profileVisibility} onChange={(e) => handlePrivacyChange("profileVisibility", e.target.value)}>
                    <option value="public">Public</option>
                    <option value="followers_only">Followers Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                {[
                  { key: "showEmail", title: "Show Email", desc: "Display your email on your profile" },
                  { key: "showFollowers", title: "Show Followers", desc: "Allow others to see your followers list" },
                  { key: "showFollowing", title: "Show Following", desc: "Allow others to see who you follow" },
                ].map((item) => (
                  <div key={item.key} className="setting-item">
                    <label className="setting-label">
                      <input type="checkbox" checked={privacySettings[item.key]} onChange={() => handlePrivacyChange(item.key, !privacySettings[item.key])} />
                      <div className="setting-info">
                        <span className="setting-title">{item.title}</span>
                        <span className="setting-description">{item.desc}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="settings-section">
                <h3>Interaction Settings</h3>
                {[
                  { key: "allowMessages", title: "Allow Direct Messages", desc: "Let others send you private messages" },
                  { key: "allowComments", title: "Allow Comments", desc: "Let others comment on your videos" },
                  { key: "allowMentions", title: "Allow Mentions", desc: "Let others mention you in comments" },
                ].map((item) => (
                  <div key={item.key} className="setting-item">
                    <label className="setting-label">
                      <input type="checkbox" checked={privacySettings[item.key]} onChange={() => handlePrivacyChange(item.key, !privacySettings[item.key])} />
                      <div className="setting-info">
                        <span className="setting-title">{item.title}</span>
                        <span className="setting-description">{item.desc}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SOCIAL ===== */}
          {activeTab === "social" && (
            <div className="account-card">
              <h2>Social Connections</h2>
              <div className="social-stats-large">
                {[
                  { label: "Followers", value: localUser.followers?.length || 0 },
                  { label: "Following", value: localUser.following?.length || 0 },
                  { label: "Twins", value: localUser.twins?.length || 0, highlight: true },
                ].map((s) => (
                  <div key={s.label} className={`stat-card ${s.highlight ? "highlight" : ""}`}>
                    <span className="stat-number">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="social-sections">
                {[{ title: "Your Twins", data: twins }, { title: "Recent Followers", data: followers }].map((section) => (
                  <div key={section.title} className="social-section">
                    <h3>{section.title}</h3>
                    {loadingSocial ? <p className="acct-loading">Loading…</p> :
                      section.data.length > 0 ? (
                        <div className="user-list">
                          {section.data.map((u) => (
                            <div key={u._id} className="user-item" onClick={() => navigate(`/profile/${u._id}`)}>
                              {u.avatar
                                ? <img src={u.avatar} alt={u.firstName} className="user-avatar small" onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                                : null}
                              <div className="avatar-placeholder small" style={{ display: u.avatar ? "none" : "flex" }}>{u.firstName?.[0] || "U"}</div>
                              <div className="user-info">
                                <span className="user-name">{u.firstName} {u.lastName}</span>
                                {u.bio && <span className="user-bio">{u.bio.substring(0, 40)}…</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="acct-empty">Nothing to show here yet.</p>}
                  </div>
                ))}
                <div className="social-section">
                  <h3>Who to Follow</h3>
                  {loadingSocial ? <p className="acct-loading">Loading…</p> :
                    suggestions.length > 0 ? (
                      <div className="user-list">
                        {suggestions.map((s) => (
                          <div key={s._id} className="user-item">
                            {s.avatar
                              ? <img src={s.avatar} alt={s.firstName} className="user-avatar small" onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                              : null}
                            <div className="avatar-placeholder small" style={{ display: s.avatar ? "none" : "flex" }}>{s.firstName?.[0] || "U"}</div>
                            <div className="user-info">
                              <span className="user-name">{s.firstName} {s.lastName}</span>
                              <span className="acct-follower-count">{s.followerCount} followers</span>
                            </div>
                            <button className="acct-follow-btn-small">Follow</button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="acct-empty">No suggestions available</p>}
                </div>
              </div>
            </div>
          )}

          {/* ===== CONTENT ===== */}
          {activeTab === "content" && (
            <div className="account-card">
              <h2>My Content</h2>
              {localUser.role === "creator" && (
                <div className="acct-creator-actions">
                  <button className="acct-creator-btn" onClick={() => navigate("/upload")}>Upload Video</button>
                  <button className="acct-creator-btn" onClick={() => navigate("/live")}>Start Live Stream</button>
                  <button className="acct-creator-btn" onClick={() => navigate("/dashboard")}>Dashboard</button>
                </div>
              )}
              {pendingUploads.length > 0 && (
                <div className="content-section">
                  <h3>Pending Approval</h3>
                  <div className="content-grid">
                    {pendingUploads.map((video) => (
                      <div key={video.id} className="content-item pending" onClick={() => navigate(`/video/${video.id}`)}>
                        {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="content-thumbnail" />}
                        <div className="content-info">
                          <span className="content-title">{video.title}</span>
                          <span className="content-status">Pending Review</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadedVideos.length > 0 && (
                <div className="content-section">
                  <h3>Uploaded Videos</h3>
                  <div className="content-grid">
                    {uploadedVideos.map((video) => (
                      <div key={video.id} className="content-item" onClick={() => navigate(`/video/${video.id}`)}>
                        {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="content-thumbnail" />}
                        <div className="content-info">
                          <span className="content-title">{video.title}</span>
                          <span className="content-stats">{video.views || 0} views</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadedVideos.length === 0 && pendingUploads.length === 0 && uploadedStreams.length === 0 && (
                <p className="acct-empty">No content yet. Start creating!</p>
              )}
            </div>
          )}

          {/* ===== PURCHASED ===== */}
          {activeTab === "purchased" && (
            <div className="account-card">
              <h2>Purchased Content</h2>
              {purchasedContent.length === 0 ? (
                <div className="acct-empty-state">
                  <p className="acct-empty">You haven't purchased anything yet.</p>
                  <button className="acct-browse-btn" onClick={() => navigate("/")}>Browse Videos</button>
                </div>
              ) : (
                <div className="content-grid">
                  {purchasedContent.map((video) => (
                    <div key={video.id} className="content-item purchased" onClick={() => navigate(`/video/${video.id}`)}>
                      {video.thumbnailUrl && <img src={video.thumbnailUrl} alt={video.title} className="content-thumbnail" />}
                      <div className="content-info">
                        <span className="content-title">{video.title}</span>
                        <span className="acct-purchase-price">${video.price || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="acct-payment-section">
                <h3>Payment Methods</h3>
                <div className="acct-payment-methods">
                  <div className="acct-payment-method">
                    <span className="acct-method-icon">CC</span>
                    <span className="acct-method-name">•••• 4242</span>
                    <span className="acct-method-expiry">Expires 12/25</span>
                    <button className="acct-remove-method">Remove</button>
                  </div>
                  <button className="acct-add-method-btn">+ Add Payment Method</button>
                </div>
              </div>
            </div>
          )}

          {/* ===== THEME ===== */}
          {activeTab === "theme" && (
            <div className="account-card">
              <h2>Appearance & Theme</h2>
              <ThemePicker />
            </div>
          )}
        </div>

        {/* ── Feedback ── */}
        <div className="account-card acct-feedback-card">
          <h2>Help & Feedback</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (!feedback.trim()) return; alert("Feedback sent to Narra team"); setFeedback(""); }} className="acct-feedback-form">
            <textarea
              placeholder="Tell us what we can improve…"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <button type="submit" className={feedback.trim() ? "enabled" : ""} disabled={!feedback.trim()}>
              Send Feedback
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Account;