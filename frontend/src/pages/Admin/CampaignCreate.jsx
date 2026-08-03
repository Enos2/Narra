/* eslint-disable react-hooks/exhaustive-deps */
/**
 * File: frontend/src/pages/admin/CampaignCreate.jsx
 * Location: frontend/src/pages/admin/CampaignCreate.jsx
 * User-facing label: "Create Campaign"
 * Theme: Black canvas, role-based animated SVG — matches AdminAuditLogs
 * No emojis anywhere in this file.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { createAd } from "../../requests";
import "./CampaignCreate.css";

const AGE_RATINGS = ["G", "PG", "PG-13", "13+", "16+", "18+", "ALL"];

const AD_TYPES = [
  { value: "video",     label: "Video" },
  { value: "banner",    label: "Banner" },
  { value: "sponsored", label: "Sponsored" },
];

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

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Media" },
  { n: 3, label: "Targeting" },
  { n: 4, label: "Restrictions" },
  { n: 5, label: "Budget" },
  { n: 6, label: "Review" },
];

/* ─────────────────────────────────────────────
   Animated SVG backgrounds — matching AdminAuditLogs
───────────────────────────────────────────── */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="cc-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cc-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#cc-sg1)">
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
  const traces = [
    "M0,180 H280 V130 H560 V180 H860 V90 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
  ];
  return (
    <svg className="cc-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="cc-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#cc-pbg)" />
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#4f6ef7" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08"
            dur={`${3 + i}s`} repeatCount="indefinite" />
        </path>
      ))}
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440" />
      </circle>
    </svg>
  );
}

function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
  ];
  return (
    <svg className="cc-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cc-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#cc-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const CampaignCreate = () => {
  const navigate = useNavigate();
  const { user, token } = useAppContext();
  const role = user?.role || "superadmin";

  const canCreate = ["superadmin", "platformadmin"].includes(role);

  useEffect(() => {
    if (!canCreate) navigate("/admin/campaigns");
  }, [canCreate]);

  const [step,      setStep]      = useState(1);
  const [errors,    setErrors]    = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [tagInput,  setTagInput]  = useState("");

  const [form, setForm] = useState({
    title:       "",
    description: "",
    type:        "video",
    placement:   "pre-roll",
    targetUrl:   "",
    ageRating:   "ALL",
    contentFlags: { violence: false, sex: false, language: false, graphic: false },
    targetCountries:   [],
    targetContinents:  [],
    blockedCountries:  [],
    blockedContinents: [],
    minAge:       "",
    maxAge:       "",
    targetGender: "all",
    startDate:    "",
    endDate:      "",
    totalBudget:  "",
    dailyBudget:  "",
    currency:     "USD",
    maxImpressionsPerUser: 10,
    maxClicksPerUser:      5,
    tags:  [],
    notes: "",
  });

  const [files,    setFiles]    = useState({ media: null, thumbnail: null });
  const [previews, setPreviews] = useState({ media: null, thumbnail: null });

  useEffect(() => () => {
    if (previews.media?.startsWith("blob:"))     URL.revokeObjectURL(previews.media);
    if (previews.thumbnail?.startsWith("blob:")) URL.revokeObjectURL(previews.thumbnail);
  }, [previews]);

  /* ── Input helpers ── */
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
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val]
    }));

  const addTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!form.tags.includes(tagInput.trim()))
        setForm(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }));
      setTagInput("");
    }
  };
  const removeTag = (t) => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }));

  /* ── Validation ── */
  const validate = () => {
    const e = {};
    if (!form.title.trim())      e.title     = "Title is required";
    if (!form.targetUrl.trim())  e.targetUrl = "Target URL is required";
    else if (!/^https?:\/\//.test(form.targetUrl)) e.targetUrl = "Must start with http:// or https://";
    if (!form.startDate)         e.startDate = "Start date required";
    if (!form.endDate)           e.endDate   = "End date required";
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate))
      e.endDate = "End date must be after start date";
    if (!form.totalBudget || parseFloat(form.totalBudget) <= 0)
      e.totalBudget = "Budget must be greater than 0";
    if (!files.media) e.media = "Media file is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { setStep(1); return; }

    const fd = new FormData();
    const skip = new Set(["contentFlags", "targetCountries", "targetContinents", "blockedCountries", "blockedContinents", "tags"]);

    Object.entries(form).forEach(([k, v]) => {
      if (skip.has(k)) return;
      if (v !== "" && v !== null && v !== undefined) fd.append(k, v);
    });

    fd.append("contentFlags",      JSON.stringify(form.contentFlags));
    fd.append("targetCountries",   JSON.stringify(form.targetCountries));
    fd.append("targetContinents",  JSON.stringify(form.targetContinents));
    fd.append("blockedCountries",  JSON.stringify(form.blockedCountries));
    fd.append("blockedContinents", JSON.stringify(form.blockedContinents));
    fd.append("tags",              JSON.stringify(form.tags));

    if (files.media) {
      const isVid = files.media.type.startsWith("video/");
      fd.append(isVid ? "video" : "image", files.media);
    }
    if (files.thumbnail) fd.append("thumbnail", files.thumbnail);

    setUploading(true);
    setProgress(0);
    try {
      const res = await createAd(token, fd, (p) => setProgress(p));
      if (res.success) {
        navigate("/admin/campaigns", {
          state: { message: "Campaign created and pending approval", type: "success" }
        });
      } else {
        setErrors({ submit: res.message || "Failed to create campaign" });
        setStep(6);
      }
    } catch (err) {
      setErrors({ submit: err.message || "Failed to create campaign" });
      setStep(6);
    } finally {
      setUploading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  /* ── Step navigation validation ── */
  const canProceedFrom = (s) => {
    if (s === 1) return form.title.trim() && form.targetUrl.trim();
    if (s === 2) return !!files.media;
    return true;
  };

  /* ─── Render ─── */
  return (
    <div className={`cc-page cc-role-${role}`}>
      <div className="cc-bg" aria-hidden="true">
        {role === "superadmin"    && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin"  && <SupportBg />}
      </div>
      <div className="cc-grain" aria-hidden="true" />

      {/* Header */}
      <header className="cc-header">
        <div className="cc-header__line" />
        <h1 className="cc-headline">Create New Campaign</h1>
        <p className="cc-subtitle">Configure and launch an advertising campaign</p>
        <div className="cc-header__line" />
      </header>

      {/* Steps */}
      <nav className="cc-steps" aria-label="Form steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <div className={`cc-step-line ${step > s.n ? "done" : ""}`} />}
            <div
              className={`cc-step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`}
              onClick={() => step > s.n && setStep(s.n)}
              style={{ cursor: step > s.n ? "pointer" : "default" }}
            >
              <div className="cc-step-num">{step > s.n ? "+" : s.n}</div>
              <span className="cc-step-label">{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </nav>

      <form className="cc-form-wrap" onSubmit={handleSubmit} encType="multipart/form-data">

        {/* ── Step 1: Basic Info ── */}
        {step === 1 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Basic Information</h2>

            <div className="cc-group">
              <label className="cc-label">Campaign Title <span className="cc-required">*</span></label>
              <input className={`cc-input${errors.title ? " cc-input--error" : ""}`}
                name="title" value={form.title} onChange={handleInput}
                placeholder="e.g. Narra Summer 2025" />
              {errors.title && <span className="cc-error-msg">{errors.title}</span>}
            </div>

            <div className="cc-group">
              <label className="cc-label">Description</label>
              <textarea className="cc-textarea" name="description" rows={3}
                value={form.description} onChange={handleInput}
                placeholder="Optional campaign description..." />
            </div>

            <div className="cc-group">
              <label className="cc-label">Campaign Type <span className="cc-required">*</span></label>
              <div className="cc-opt-grid">
                {AD_TYPES.map(t => (
                  <button key={t.value} type="button"
                    className={`cc-opt-btn${form.type === t.value ? " cc-opt-btn--selected" : ""}`}
                    onClick={() => set("type", t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Placement <span className="cc-required">*</span></label>
              <div className="cc-opt-grid">
                {PLACEMENTS.map(p => (
                  <button key={p.value} type="button"
                    className={`cc-opt-btn${form.placement === p.value ? " cc-opt-btn--selected" : ""}`}
                    onClick={() => set("placement", p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Target URL <span className="cc-required">*</span></label>
              <input className={`cc-input${errors.targetUrl ? " cc-input--error" : ""}`}
                name="targetUrl" value={form.targetUrl} onChange={handleInput}
                placeholder="https://example.com/landing" type="url" />
              {errors.targetUrl && <span className="cc-error-msg">{errors.targetUrl}</span>}
            </div>

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost"
                onClick={() => navigate("/admin/campaigns")}>
                Cancel
              </button>
              <button type="button" className="cc-btn cc-btn--primary"
                onClick={() => setStep(2)}
                disabled={!canProceedFrom(1)}>
                Next: Media
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Media ── */}
        {step === 2 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Media Assets</h2>

            <div className="cc-group">
              <label className="cc-label">
                {form.type === "video" ? "Video File" : "Image File"}
                <span className="cc-required"> *</span>
              </label>
              <div className={`cc-upload-zone${errors.media ? " cc-upload-zone--error" : ""}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const fakeE = { target: { files: [f] } }; handleFile(fakeE, "media"); } }}>
                <input type="file" id="cc-media" className="cc-file-hidden"
                  accept={form.type === "video" ? "video/*" : "image/*"}
                  onChange={e => handleFile(e, "media")} />
                <label className="cc-upload-label" htmlFor="cc-media">
                  {previews.media ? (
                    form.type === "video"
                      ? <video src={previews.media} controls className="cc-preview-media" />
                      : <img src={previews.media} alt="Preview" className="cc-preview-media" />
                  ) : (
                    <div className="cc-upload-placeholder">
                      <div className="cc-upload-icon-box" />
                      <span>Click or drag file here</span>
                      <small>{form.type === "video" ? "MP4, WebM (max 500 MB)" : "JPG, PNG, GIF (max 5 MB)"}</small>
                    </div>
                  )}
                </label>
              </div>
              {errors.media && <span className="cc-error-msg">{errors.media}</span>}
            </div>

            {form.type === "video" && (
              <div className="cc-group">
                <label className="cc-label">Thumbnail Image (Optional)</label>
                <div className="cc-upload-zone cc-upload-zone--small">
                  <input type="file" id="cc-thumb" accept="image/*"
                    onChange={e => handleFile(e, "thumbnail")} />
                  <label className="cc-upload-label" htmlFor="cc-thumb">
                    {previews.thumbnail
                      ? <img src={previews.thumbnail} alt="Thumbnail" className="cc-preview-thumb" />
                      : <div className="cc-upload-placeholder">
                          <div className="cc-upload-icon-box" />
                          <span>Upload thumbnail</span>
                        </div>
                    }
                  </label>
                </div>
              </div>
            )}

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="cc-btn cc-btn--primary" onClick={() => setStep(3)}
                disabled={!canProceedFrom(2)}>
                Next: Targeting
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Targeting ── */}
        {step === 3 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Audience Targeting</h2>
            <p className="cc-section-sub">Define who sees this campaign. Leave blank to show to everyone.</p>

            <div className="cc-group">
              <label className="cc-label">Age Rating <span className="cc-required">*</span></label>
              <div className="cc-age-grid">
                {AGE_RATINGS.map(r => (
                  <button key={r} type="button"
                    className={`cc-age-btn${form.ageRating === r ? " cc-age-btn--selected" : ""}`}
                    onClick={() => set("ageRating", r)}>{r}</button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Content Flags</label>
              <div className="cc-flags">
                {["violence", "sex", "language", "graphic"].map(f => (
                  <label key={f} className="cc-flag-label">
                    <input type="checkbox" name={`contentFlags.${f}`}
                      checked={form.contentFlags[f]} onChange={handleInput} />
                    <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="cc-grid2">
              <div className="cc-group">
                <label className="cc-label">Target Gender</label>
                <select className="cc-select" name="targetGender" value={form.targetGender} onChange={handleInput}>
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="cc-group">
                <label className="cc-label">Age Range (Optional)</label>
                <div className="cc-range-row">
                  <input className="cc-input" type="number" name="minAge" value={form.minAge}
                    onChange={handleInput} placeholder="Min" min="0" max="120" />
                  <span className="cc-range-sep">to</span>
                  <input className="cc-input" type="number" name="maxAge" value={form.maxAge}
                    onChange={handleInput} placeholder="Max" min="0" max="120" />
                </div>
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">
                Target Countries
                <span className="cc-label-note"> — whitelist (leave empty for all countries)</span>
              </label>
              <div className="cc-countries-grid">
                {COUNTRIES.map(c => (
                  <button key={c} type="button"
                    className={`cc-country-btn${form.targetCountries.includes(c) ? " cc-country-btn--selected" : ""}`}
                    onClick={() => toggleList("targetCountries", c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Target Continents</label>
              <div className="cc-opt-grid">
                {CONTINENTS.map(c => (
                  <button key={c.value} type="button"
                    className={`cc-opt-btn${form.targetContinents.includes(c.value) ? " cc-opt-btn--selected" : ""}`}
                    onClick={() => toggleList("targetContinents", c.value)}>{c.label}</button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Tags</label>
              <input className="cc-input" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Type a tag and press Enter" />
              {form.tags.length > 0 && (
                <div className="cc-tags-list">
                  {form.tags.map(t => (
                    <span key={t} className="cc-tag">
                      #{t}
                      <button type="button" className="cc-tag-remove" onClick={() => removeTag(t)}>x</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="cc-btn cc-btn--primary" onClick={() => setStep(4)}>
                Next: Restrictions
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Restrictions / Blocks ── */}
        {step === 4 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Restrictions</h2>
            <p className="cc-section-sub">
              Block specific countries or continents from seeing this campaign.
              Users in blocked regions will not see it even if the campaign is active.
            </p>

            <div className="cc-group">
              <label className="cc-label">
                Blocked Countries
                <span className="cc-label-note cc-label-note--danger"> — these regions will NOT see this campaign</span>
              </label>
              <div className="cc-countries-grid">
                {COUNTRIES.map(c => (
                  <button key={c} type="button"
                    className={`cc-country-btn cc-country-btn--block${form.blockedCountries.includes(c) ? " cc-country-btn--blocked" : ""}`}
                    onClick={() => toggleList("blockedCountries", c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Blocked Continents</label>
              <div className="cc-opt-grid">
                {CONTINENTS.map(c => (
                  <button key={c.value} type="button"
                    className={`cc-opt-btn cc-opt-btn--block${form.blockedContinents.includes(c.value) ? " cc-opt-btn--blocked" : ""}`}
                    onClick={() => toggleList("blockedContinents", c.value)}>{c.label}</button>
                ))}
              </div>
            </div>

            {(form.blockedCountries.length > 0 || form.blockedContinents.length > 0) && (
              <div className="cc-block-summary">
                <span className="cc-block-summary__label">Blocked regions:</span>
                <div className="cc-block-summary__tags">
                  {form.blockedCountries.map(c => (
                    <span key={c} className="cc-block-tag">{c}</span>
                  ))}
                  {form.blockedContinents.map(c => (
                    <span key={c} className="cc-block-tag">
                      {CONTINENTS.find(x => x.value === c)?.label || c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStep(3)}>Back</button>
              <button type="button" className="cc-btn cc-btn--primary" onClick={() => setStep(5)}>
                Next: Budget
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Budget & Schedule ── */}
        {step === 5 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Budget and Schedule</h2>

            <div className="cc-grid2">
              <div className="cc-group">
                <label className="cc-label">Start Date <span className="cc-required">*</span></label>
                <input className={`cc-input${errors.startDate ? " cc-input--error" : ""}`}
                  type="date" name="startDate" value={form.startDate}
                  onChange={handleInput} min={today} />
                {errors.startDate && <span className="cc-error-msg">{errors.startDate}</span>}
              </div>
              <div className="cc-group">
                <label className="cc-label">End Date <span className="cc-required">*</span></label>
                <input className={`cc-input${errors.endDate ? " cc-input--error" : ""}`}
                  type="date" name="endDate" value={form.endDate}
                  onChange={handleInput} min={form.startDate || today} />
                {errors.endDate && <span className="cc-error-msg">{errors.endDate}</span>}
              </div>
            </div>

            <div className="cc-grid3">
              <div className="cc-group">
                <label className="cc-label">Total Budget <span className="cc-required">*</span></label>
                <input className={`cc-input${errors.totalBudget ? " cc-input--error" : ""}`}
                  type="number" name="totalBudget" value={form.totalBudget}
                  onChange={handleInput} placeholder="1000" min="1" step="0.01" />
                {errors.totalBudget && <span className="cc-error-msg">{errors.totalBudget}</span>}
              </div>
              <div className="cc-group">
                <label className="cc-label">Daily Budget (Optional)</label>
                <input className="cc-input" type="number" name="dailyBudget" value={form.dailyBudget}
                  onChange={handleInput} placeholder="100" min="1" step="0.01" />
              </div>
              <div className="cc-group">
                <label className="cc-label">Currency</label>
                <select className="cc-select" name="currency" value={form.currency} onChange={handleInput}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (KSh)</option>
                </select>
              </div>
            </div>

            <div className="cc-grid2">
              <div className="cc-group">
                <label className="cc-label">Max Impressions per User</label>
                <input className="cc-input" type="number" name="maxImpressionsPerUser"
                  value={form.maxImpressionsPerUser} onChange={handleInput} min="1" max="100" />
              </div>
              <div className="cc-group">
                <label className="cc-label">Max Clicks per User</label>
                <input className="cc-input" type="number" name="maxClicksPerUser"
                  value={form.maxClicksPerUser} onChange={handleInput} min="1" max="50" />
              </div>
            </div>

            <div className="cc-group">
              <label className="cc-label">Internal Notes</label>
              <textarea className="cc-textarea" name="notes" rows={3}
                value={form.notes} onChange={handleInput}
                placeholder="Any internal notes about this campaign..." />
            </div>

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStep(4)}>Back</button>
              <button type="button" className="cc-btn cc-btn--primary" onClick={() => setStep(6)}>
                Next: Review
              </button>
            </div>
          </div>
        )}

        {/* ── Step 6: Review ── */}
        {step === 6 && (
          <div className="cc-section">
            <h2 className="cc-section-title">Review and Submit</h2>

            <div className="cc-review">
              <div className="cc-review-group">
                <div className="cc-review-group-title">Basic Information</div>
                <div className="cc-review-row"><span className="cc-label">Title</span><span>{form.title}</span></div>
                {form.description && <div className="cc-review-row"><span className="cc-label">Description</span><span>{form.description}</span></div>}
                <div className="cc-review-row"><span className="cc-label">Type</span><span style={{ textTransform: "capitalize" }}>{form.type}</span></div>
                <div className="cc-review-row"><span className="cc-label">Placement</span><span>{PLACEMENTS.find(p => p.value === form.placement)?.label}</span></div>
                <div className="cc-review-row"><span className="cc-label">Target URL</span><span style={{ wordBreak: "break-all" }}>{form.targetUrl}</span></div>
              </div>

              {previews.media && (
                <div className="cc-review-group">
                  <div className="cc-review-group-title">Media Preview</div>
                  {form.type === "video"
                    ? <video src={previews.media} controls className="cc-preview-media-review" />
                    : <img src={previews.media} alt="Campaign media" className="cc-preview-media-review" />}
                </div>
              )}

              <div className="cc-review-group">
                <div className="cc-review-group-title">Targeting</div>
                <div className="cc-review-row"><span className="cc-label">Age Rating</span><span>{form.ageRating}</span></div>
                <div className="cc-review-row"><span className="cc-label">Gender</span><span style={{ textTransform: "capitalize" }}>{form.targetGender}</span></div>
                {(form.minAge || form.maxAge) && (
                  <div className="cc-review-row"><span className="cc-label">Age Range</span><span>{form.minAge || "0"} to {form.maxAge || "unlimited"}</span></div>
                )}
                {form.targetCountries.length > 0 && (
                  <div className="cc-review-row"><span className="cc-label">Target Countries</span><span>{form.targetCountries.join(", ")}</span></div>
                )}
                {form.blockedCountries.length > 0 && (
                  <div className="cc-review-row">
                    <span className="cc-label">Blocked Countries</span>
                    <span style={{ color: "#ef4444" }}>{form.blockedCountries.join(", ")}</span>
                  </div>
                )}
                {form.tags.length > 0 && (
                  <div className="cc-review-row"><span className="cc-label">Tags</span><span>{form.tags.map(t => `#${t}`).join(" ")}</span></div>
                )}
              </div>

              <div className="cc-review-group">
                <div className="cc-review-group-title">Budget and Schedule</div>
                <div className="cc-review-row"><span className="cc-label">Duration</span><span>{form.startDate} to {form.endDate}</span></div>
                <div className="cc-review-row">
                  <span className="cc-label">Total Budget</span>
                  <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: form.currency }).format(form.totalBudget || 0)}</span>
                </div>
                {form.dailyBudget && (
                  <div className="cc-review-row">
                    <span className="cc-label">Daily Budget</span>
                    <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: form.currency }).format(form.dailyBudget)}</span>
                  </div>
                )}
                <div className="cc-review-row">
                  <span className="cc-label">Frequency Cap</span>
                  <span>{form.maxImpressionsPerUser} impressions, {form.maxClicksPerUser} clicks per user</span>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="cc-submit-error">{errors.submit}</div>
            )}

            {uploading && (
              <div className="cc-progress">
                <div className="cc-progress-track">
                  <div className="cc-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="cc-progress-text">Uploading... {progress}%</p>
              </div>
            )}

            <div className="cc-nav-row">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStep(5)} disabled={uploading}>
                Back
              </button>
              <button type="submit" className="cc-btn cc-btn--primary cc-btn--submit" disabled={uploading}>
                {uploading ? "Creating..." : "Launch Campaign"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default CampaignCreate;