/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * File: frontend/src/pages/admin/CampaignEdit.jsx
 * Location: frontend/src/pages/admin/CampaignEdit.jsx
 * User-facing label: "Edit Campaign"
 * Theme: Black canvas, role-based animated SVG — matches AdminAuditLogs
 * No emojis anywhere in this file.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { getAdById, updateAd } from "../../requests";
import "./CampaignEdit.css";

const AGE_RATINGS = ["G", "PG", "PG-13", "13+", "16+", "18+", "ALL"];

const PLACEMENTS = [
  { value: "pre-roll",     label: "Pre-roll" },
  { value: "mid-roll",     label: "Mid-roll" },
  { value: "sidebar",      label: "Sidebar" },
  { value: "between-rows", label: "Between Rows" },
  { value: "home-banner",  label: "Home Banner" },
];

const COUNTRIES = [
  "US","GB","CA","AU","DE","FR","ES","IT","JP","KR",
  "BR","MX","IN","ZA","NG","KE","GH","EG","SA","AE",
  "PH","ID","PK","BD","VN","TH","TR","IR","DZ","SD"
];

const CONTINENTS = [
  { value: "AF", label: "Africa" },
  { value: "AN", label: "Antarctica" },
  { value: "AS", label: "Asia" },
  { value: "EU", label: "Europe" },
  { value: "NA", label: "North America" },
  { value: "OC", label: "Oceania" },
  { value: "SA", label: "South America" },
];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ─────────────────────────────────────────────
   Animated SVG backgrounds — matching AdminAuditLogs
───────────────────────────────────────────── */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ce-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ce-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ce-sg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2}
          stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045"
            dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[110, 200, 310, 440].map((r, i) => (
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707}
          width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animateTransform attributeName="transform" type="rotate"
            from="45 720 450" to="90 720 450" dur={`${18 + i * 5}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}

function PlatformBg() {
  return (
    <svg className="ce-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ce-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#ce-pbg)" />
      {["M0,180 H280 V130 H560 V180 H860 V90 H1440", "M0,580 H380 V530 H680 V630 H980 V580 H1440"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#4f6ef7" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3 + i}s`} repeatCount="indefinite" />
        </path>
      ))}
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440" />
      </circle>
    </svg>
  );
}

function SupportBg() {
  return (
    <svg className="ce-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ce-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#ce-sbg)" />
      {["M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30", "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5 + i}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const CampaignEdit = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, token } = useAppContext();
  const role = user?.role || "superadmin";

  const canEdit = ["superadmin", "platformadmin"].includes(role);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [form,     setForm]     = useState(null);
  const [errors,   setErrors]   = useState({});
  const [alert,    setAlert]    = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [files,    setFiles]    = useState({ media: null, thumbnail: null });
  const [previews, setPreviews] = useState({ media: null, thumbnail: null });

  useEffect(() => {
    if (!canEdit) { navigate("/admin/campaigns"); return; }
    fetchCampaign();
  }, [id, token]);

  useEffect(() => () => {
    if (previews.media?.startsWith("blob:"))     URL.revokeObjectURL(previews.media);
    if (previews.thumbnail?.startsWith("blob:")) URL.revokeObjectURL(previews.thumbnail);
  }, [previews]);

  const fetchCampaign = async () => {
    setLoading(true);
    try {
      const res = await getAdById(token, id);
      if (res.success) {
        const c = res.ad;
        setForm({
          ...c,
          startDate:         c.startDate ? new Date(c.startDate).toISOString().split("T")[0] : "",
          endDate:           c.endDate   ? new Date(c.endDate).toISOString().split("T")[0]   : "",
          contentFlags:      c.contentFlags      || { violence: false, sex: false, language: false, graphic: false },
          targetCountries:   c.targetCountries   || [],
          targetContinents:  c.targetContinents  || [],
          blockedCountries:  c.blockedCountries  || [],
          blockedContinents: c.blockedContinents || [],
          tags:              c.tags              || [],
        });
        const resolveUrl = (u) => {
          if (!u) return null;
          return u.startsWith("http") ? u : `${API_BASE}${u}`;
        };
        setPreviews({ media: resolveUrl(c.mediaUrl), thumbnail: resolveUrl(c.thumbnailUrl) });
      } else {
        setAlert({ type: "error", text: res.message || "Failed to load campaign" });
      }
    } catch (err) {
      setAlert({ type: "error", text: err.message || "Failed to load campaign" });
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers ── */
  const set = (name, value) => {
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => { const e = { ...p }; delete e[name]; return e; });
  };

  const handleInput = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith("contentFlags.")) {
      const flag = name.split(".")[1];
      setForm(p => ({ ...p, contentFlags: { ...p.contentFlags, [flag]: checked } }));
    } else {
      set(name, type === "checkbox" ? checked : value);
    }
  };

  const handleFile = (e, key) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const validVideo = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    const validImage = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const allowed = key === "media" ? [...validVideo, ...validImage] : validImage;
    if (!allowed.includes(file.type)) { setErrors(p => ({ ...p, [key]: "Invalid file type" })); return; }
    const maxMB = key === "media" ? 500 : 5;
    if (file.size > maxMB * 1024 * 1024) { setErrors(p => ({ ...p, [key]: `Max ${maxMB}MB` })); return; }
    if (previews[key]?.startsWith("blob:")) URL.revokeObjectURL(previews[key]);
    setFiles(p => ({ ...p, [key]: file }));
    setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }));
    if (errors[key]) setErrors(p => { const e = { ...p }; delete e[key]; return e; });
  };

  const toggleList = (key, val) =>
    setForm(p => ({
      ...p,
      [key]: (p[key] || []).includes(val)
        ? p[key].filter(x => x !== val)
        : [...(p[key] || []), val]
    }));

  const addTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!form.tags?.includes(tagInput.trim()))
        setForm(p => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
      setTagInput("");
    }
  };
  const removeTag = (t) => setForm(p => ({ ...p, tags: (p.tags || []).filter(x => x !== t) }));

  /* ── Validation ── */
  const validate = () => {
    const e = {};
    if (!form.title?.trim())     e.title     = "Title is required";
    if (!form.targetUrl?.trim()) e.targetUrl = "Target URL is required";
    else if (!/^https?:\/\//.test(form.targetUrl)) e.targetUrl = "Must start with http:// or https://";
    if (!form.startDate)         e.startDate = "Start date required";
    if (!form.endDate)           e.endDate   = "End date required";
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate))
      e.endDate = "End date must be after start date";
    if (!form.totalBudget || parseFloat(form.totalBudget) <= 0)
      e.totalBudget = "Budget must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData();
    const skip = new Set([
      "contentFlags", "targetCountries", "targetContinents",
      "blockedCountries", "blockedContinents", "tags",
      "_id", "__v", "createdAt", "updatedAt", "id",
      "createdBy", "approvedBy", "pausedBy", "resumedBy", "deletedBy"
    ]);

    Object.entries(form).forEach(([k, v]) => {
      if (skip.has(k) || v === null || v === undefined) return;
      fd.append(k, v);
    });

    fd.append("contentFlags",      JSON.stringify(form.contentFlags || {}));
    fd.append("targetCountries",   JSON.stringify(form.targetCountries || []));
    fd.append("targetContinents",  JSON.stringify(form.targetContinents || []));
    fd.append("blockedCountries",  JSON.stringify(form.blockedCountries || []));
    fd.append("blockedContinents", JSON.stringify(form.blockedContinents || []));
    fd.append("tags",              JSON.stringify(form.tags || []));

    if (files.media) {
      const isVid = files.media.type.startsWith("video/");
      fd.append(isVid ? "video" : "image", files.media);
    }
    if (files.thumbnail) fd.append("thumbnail", files.thumbnail);

    setSaving(true);
    setProgress(0);
    try {
      const res = await updateAd(token, id, fd, (p) => setProgress(p));
      if (res.success) {
        navigate("/admin/campaigns", {
          state: { message: "Campaign updated successfully", type: "success" }
        });
      } else {
        setErrors({ submit: res.message || "Failed to update campaign" });
      }
    } catch (err) {
      setErrors({ submit: err.message || "Failed to update campaign" });
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={`ce-page ce-role-${role}`}>
        <div className="ce-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="ce-grain" aria-hidden="true" />
        <div className="ce-loading">
          <div className="ce-loading__ring" />
          <p>Loading campaign...</p>
        </div>
      </div>
    );
  }

  /* ── Campaign not found ── */
  if (!form) {
    return (
      <div className={`ce-page ce-role-${role}`}>
        <div className="ce-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="ce-grain" aria-hidden="true" />
        <div className="ce-error-state">
          <h2>Campaign Not Found</h2>
          <p>This campaign does not exist or has been deleted.</p>
          <button className="ce-btn ce-btn--primary"
            onClick={() => navigate("/admin/campaigns")}>
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  /* ── Cannot edit active/ended campaigns ── */
  if (!["pending", "paused", "rejected"].includes(form.status)) {
    return (
      <div className={`ce-page ce-role-${role}`}>
        <div className="ce-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="ce-grain" aria-hidden="true" />
        <div className="ce-error-state">
          <h2>Cannot Edit Campaign</h2>
          <p>
            This campaign is <strong style={{ color: "#fff" }}>{form.status}</strong>.
            Only pending, paused, or rejected campaigns can be edited.
          </p>
          <button className="ce-btn ce-btn--primary"
            onClick={() => navigate("/admin/campaigns")}>
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  /* ─── Main render ─── */
  return (
    <div className={`ce-page ce-role-${role}`}>
      <div className="ce-bg" aria-hidden="true">
        {role === "superadmin"    && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin"  && <SupportBg />}
      </div>
      <div className="ce-grain" aria-hidden="true" />

      {/* Header */}
      <header className="ce-header">
        <div className="ce-header__line" />
        <h1 className="ce-headline">Edit Campaign</h1>
        <p className="ce-subtitle">
          Editing: {form.title}
          <span className={`ce-status-pill ce-status-pill--${form.status}`}>{form.status}</span>
        </p>
        <div className="ce-header__line" />
      </header>

      {alert && (
        <div className={`ce-alert ce-alert--${alert.type}`}>
          <span style={{ flex: 1 }}>{alert.text}</span>
          <button className="ce-alert__close" onClick={() => setAlert(null)}>x</button>
        </div>
      )}

      <form className="ce-form-wrap" onSubmit={handleSubmit} encType="multipart/form-data">

        {/* Basic Info */}
        <div className="ce-section">
          <h2 className="ce-section-title">Basic Information</h2>

          <div className="ce-group">
            <label className="ce-label">Campaign Title <span className="ce-required">*</span></label>
            <input className={`ce-input${errors.title ? " ce-input--error" : ""}`}
              name="title" value={form.title || ""} onChange={handleInput} />
            {errors.title && <span className="ce-error-msg">{errors.title}</span>}
          </div>

          <div className="ce-group">
            <label className="ce-label">Description</label>
            <textarea className="ce-textarea" name="description" rows={3}
              value={form.description || ""} onChange={handleInput} />
          </div>

          <div className="ce-group">
            <label className="ce-label">Campaign Type</label>
            <div className="ce-readonly">
              {form.type} — type cannot be changed after creation
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Placement</label>
            <select className="ce-select" name="placement" value={form.placement || ""} onChange={handleInput}>
              {PLACEMENTS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="ce-group">
            <label className="ce-label">Target URL <span className="ce-required">*</span></label>
            <input className={`ce-input${errors.targetUrl ? " ce-input--error" : ""}`}
              name="targetUrl" value={form.targetUrl || ""} onChange={handleInput} type="url" />
            {errors.targetUrl && <span className="ce-error-msg">{errors.targetUrl}</span>}
          </div>
        </div>

        {/* Media */}
        <div className="ce-section">
          <h2 className="ce-section-title">Media</h2>

          <div className="ce-group">
            <label className="ce-label">Current {form.type === "video" ? "Video" : "Image"}</label>
            {previews.media && (
              <div className="ce-current-media">
                {form.type === "video"
                  ? <video src={previews.media} controls />
                  : <img src={previews.media} alt="Current media" />}
              </div>
            )}
            <label className="ce-label" style={{ marginTop: "0.75rem" }}>
              Replace File (Optional)
            </label>
            <div className="ce-upload-zone">
              <input type="file" id="ce-media"
                accept={form.type === "video" ? "video/*" : "image/*"}
                onChange={e => handleFile(e, "media")} />
              <label className="ce-upload-label" htmlFor="ce-media">
                <div className="ce-upload-placeholder">
                  <div className="ce-upload-icon-box" />
                  <span>Click to upload new file</span>
                  <small>{form.type === "video" ? "MP4, WebM (max 500 MB)" : "JPG, PNG, GIF (max 5 MB)"}</small>
                </div>
              </label>
            </div>
            {files.media && <p className="ce-file-chosen">New file selected: {files.media.name}</p>}
            {errors.media && <span className="ce-error-msg">{errors.media}</span>}
          </div>

          {form.type === "video" && (
            <div className="ce-group">
              <label className="ce-label">Current Thumbnail</label>
              {previews.thumbnail && (
                <div className="ce-current-thumb">
                  <img src={previews.thumbnail} alt="Current thumbnail" />
                </div>
              )}
              <label className="ce-label" style={{ marginTop: "0.5rem" }}>Replace Thumbnail (Optional)</label>
              <div className="ce-upload-zone ce-upload-zone--small">
                <input type="file" id="ce-thumb" accept="image/*"
                  onChange={e => handleFile(e, "thumbnail")} />
                <label className="ce-upload-label" htmlFor="ce-thumb">
                  <div className="ce-upload-placeholder">
                    <div className="ce-upload-icon-box" />
                    <span>Click to replace thumbnail</span>
                  </div>
                </label>
              </div>
              {files.thumbnail && <p className="ce-file-chosen">New file selected: {files.thumbnail.name}</p>}
            </div>
          )}
        </div>

        {/* Targeting */}
        <div className="ce-section">
          <h2 className="ce-section-title">Targeting</h2>

          <div className="ce-group">
            <label className="ce-label">Age Rating</label>
            <div className="ce-age-grid">
              {AGE_RATINGS.map(r => (
                <button key={r} type="button"
                  className={`ce-age-btn${form.ageRating === r ? " ce-age-btn--selected" : ""}`}
                  onClick={() => set("ageRating", r)}>{r}</button>
              ))}
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Content Flags</label>
            <div className="ce-flags">
              {["violence", "sex", "language", "graphic"].map(f => (
                <label key={f} className="ce-flag-label">
                  <input type="checkbox" name={`contentFlags.${f}`}
                    checked={form.contentFlags?.[f] || false} onChange={handleInput} />
                  <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="ce-grid2">
            <div className="ce-group">
              <label className="ce-label">Target Gender</label>
              <select className="ce-select" name="targetGender" value={form.targetGender || "all"} onChange={handleInput}>
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ce-group">
              <label className="ce-label">Age Range</label>
              <div className="ce-range-row">
                <input className="ce-input" type="number" name="minAge"
                  value={form.minAge || ""} onChange={handleInput} placeholder="Min" min="0" max="120" />
                <span className="ce-range-sep">to</span>
                <input className="ce-input" type="number" name="maxAge"
                  value={form.maxAge || ""} onChange={handleInput} placeholder="Max" min="0" max="120" />
              </div>
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">
              Target Countries
              <span className="ce-label-note"> — whitelist (empty = all countries)</span>
            </label>
            <div className="ce-countries-grid">
              {COUNTRIES.map(c => (
                <button key={c} type="button"
                  className={`ce-country-btn${form.targetCountries?.includes(c) ? " ce-country-btn--selected" : ""}`}
                  onClick={() => toggleList("targetCountries", c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Target Continents</label>
            <div className="ce-opt-grid">
              {CONTINENTS.map(c => (
                <button key={c.value} type="button"
                  className={`ce-opt-btn${form.targetContinents?.includes(c.value) ? " ce-opt-btn--selected" : ""}`}
                  onClick={() => toggleList("targetContinents", c.value)}>{c.label}</button>
              ))}
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Tags</label>
            <input className="ce-input" value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder="Type a tag and press Enter" />
            {form.tags?.length > 0 && (
              <div className="ce-tags-list">
                {form.tags.map(t => (
                  <span key={t} className="ce-tag">
                    #{t}
                    <button type="button" className="ce-tag-remove" onClick={() => removeTag(t)}>x</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Restrictions */}
        <div className="ce-section">
          <h2 className="ce-section-title">Restrictions</h2>
          <p className="ce-section-sub">
            Users in blocked regions will not see this campaign even if it is active.
          </p>

          <div className="ce-group">
            <label className="ce-label">
              Blocked Countries
              <span className="ce-label-note ce-label-note--danger"> — these regions will NOT see this campaign</span>
            </label>
            <div className="ce-countries-grid">
              {COUNTRIES.map(c => (
                <button key={c} type="button"
                  className={`ce-country-btn ce-country-btn--block${form.blockedCountries?.includes(c) ? " ce-country-btn--blocked" : ""}`}
                  onClick={() => toggleList("blockedCountries", c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Blocked Continents</label>
            <div className="ce-opt-grid">
              {CONTINENTS.map(c => (
                <button key={c.value} type="button"
                  className={`ce-opt-btn ce-opt-btn--block${form.blockedContinents?.includes(c.value) ? " ce-opt-btn--blocked" : ""}`}
                  onClick={() => toggleList("blockedContinents", c.value)}>{c.label}</button>
              ))}
            </div>
          </div>

          {(form.blockedCountries?.length > 0 || form.blockedContinents?.length > 0) && (
            <div className="ce-block-summary">
              <span className="ce-block-summary__label">Currently blocked:</span>
              <div className="ce-block-summary__tags">
                {form.blockedCountries?.map(c => (
                  <span key={c} className="ce-block-tag">{c}</span>
                ))}
                {form.blockedContinents?.map(c => (
                  <span key={c} className="ce-block-tag">
                    {CONTINENTS.find(x => x.value === c)?.label || c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Budget & Schedule */}
        <div className="ce-section">
          <h2 className="ce-section-title">Budget and Schedule</h2>

          <div className="ce-grid2">
            <div className="ce-group">
              <label className="ce-label">Start Date <span className="ce-required">*</span></label>
              <input className={`ce-input${errors.startDate ? " ce-input--error" : ""}`}
                type="date" name="startDate" value={form.startDate || ""}
                onChange={handleInput} min={today} />
              {errors.startDate && <span className="ce-error-msg">{errors.startDate}</span>}
            </div>
            <div className="ce-group">
              <label className="ce-label">End Date <span className="ce-required">*</span></label>
              <input className={`ce-input${errors.endDate ? " ce-input--error" : ""}`}
                type="date" name="endDate" value={form.endDate || ""}
                onChange={handleInput} min={form.startDate || today} />
              {errors.endDate && <span className="ce-error-msg">{errors.endDate}</span>}
            </div>
          </div>

          <div className="ce-grid3">
            <div className="ce-group">
              <label className="ce-label">Total Budget <span className="ce-required">*</span></label>
              <input className={`ce-input${errors.totalBudget ? " ce-input--error" : ""}`}
                type="number" name="totalBudget" value={form.totalBudget || ""}
                onChange={handleInput} min="1" step="0.01" />
              {errors.totalBudget && <span className="ce-error-msg">{errors.totalBudget}</span>}
            </div>
            <div className="ce-group">
              <label className="ce-label">Daily Budget</label>
              <input className="ce-input" type="number" name="dailyBudget"
                value={form.dailyBudget || ""} onChange={handleInput} min="1" step="0.01" />
            </div>
            <div className="ce-group">
              <label className="ce-label">Currency</label>
              <select className="ce-select" name="currency" value={form.currency || "USD"} onChange={handleInput}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="KES">KES (KSh)</option>
              </select>
            </div>
          </div>

          <div className="ce-grid2">
            <div className="ce-group">
              <label className="ce-label">Max Impressions per User</label>
              <input className="ce-input" type="number" name="maxImpressionsPerUser"
                value={form.maxImpressionsPerUser || 10} onChange={handleInput} min="1" max="100" />
            </div>
            <div className="ce-group">
              <label className="ce-label">Max Clicks per User</label>
              <input className="ce-input" type="number" name="maxClicksPerUser"
                value={form.maxClicksPerUser || 5} onChange={handleInput} min="1" max="50" />
            </div>
          </div>

          <div className="ce-group">
            <label className="ce-label">Internal Notes</label>
            <textarea className="ce-textarea" name="notes" rows={3}
              value={form.notes || ""} onChange={handleInput} />
          </div>
        </div>

        {/* Errors & progress */}
        {errors.submit && (
          <div className="ce-submit-error">{errors.submit}</div>
        )}

        {saving && (
          <div className="ce-progress">
            <div className="ce-progress-track">
              <div className="ce-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="ce-progress-text">Saving... {progress}%</p>
          </div>
        )}

        <div className="ce-actions">
          <button type="button" className="ce-btn ce-btn--ghost"
            disabled={saving} onClick={() => navigate("/admin/campaigns")}>
            Cancel
          </button>
          <button type="submit" className="ce-btn ce-btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignEdit;