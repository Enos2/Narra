/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * File: frontend/src/pages/admin/CampaignManagement.jsx
 * User-facing label: "Campaign Management"
 * Internal API calls hit /api/ads/* (backward compat alias)
 * Theme: Black canvas, role-based animated SVG backgrounds, no emojis
 */
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import {
  getAds,
  approveAd,
  rejectAd,
  pauseAd,
  resumeAd,
  deleteAd,
  getAdStats
} from "../../requests";
import "./CampaignManagement.css";

/* ─────────────────────────────────────────────
   Animated SVG backgrounds — matching AdminAuditLogs
───────────────────────────────────────────── */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="cm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cm-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#cm-sg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite" />
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
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate"
            from="45 720 450" to="90 720 450" dur={`${18 + i * 5}s`} repeatCount="indefinite" />
        </rect>
      ))}
      {[[60, 60], [1380, 60], [60, 840], [1380, 840]].map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 24} y1={y} x2={x + 24} y2={y} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5" />
          <line x1={x} y1={y - 24} x2={x} y2={y + 24} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5" />
          <circle cx={x} cy={y} r="4" fill="#FFD700" fillOpacity="0.35">
            <animate attributeName="fill-opacity" values="0.35;0.8;0.35" dur="3s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
          </circle>
        </g>
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
    <svg className="cm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="cm-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#cm-pbg)" />
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#4f6ef7" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08"
            dur={`${3 + i * 0.7}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#4f6ef7" fillOpacity="0.5">
          <animate attributeName="r" values="4;9;4" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440" />
      </circle>
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
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
    <svg className="cm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cm-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#cm-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.14"
          transform={`rotate(${i * 37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14"
            dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite"
          path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30" />
      </circle>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtCurrency = (amt, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt || 0);

const progressColor = (p) => {
  if (p >= 90) return "#ef4444";
  if (p >= 70) return "#f59e0b";
  if (p >= 40) return "#10b981";
  return "#3b82f6";
};

const typeLabel = (t) => ({ video: "Video", banner: "Banner", sponsored: "Sponsored" }[t] || t);

const StatusBadge = ({ status }) => (
  <span className={`cm-status cm-status--${status}`}>{status}</span>
);

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const CampaignManagement = () => {
  const navigate = useNavigate();
  const { user, token, isAdmin } = useAppContext();
  const role = user?.role || "superadmin";

  const [campaigns,     setCampaigns]     = useState([]);
  const [filtered,      setFiltered]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [stats,         setStats]         = useState({ totalAds: 0, activeAds: 0, pendingAds: 0, today: { impressions: 0, clicks: 0, ctr: 0, revenue: 0 } });
  const [searchQuery,   setSearchQuery]   = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [sortBy,        setSortBy]        = useState("createdAt");
  const [sortOrder,     setSortOrder]     = useState("desc");
  const [actionLoading, setActionLoading] = useState(null);
  const [alert,         setAlert]         = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null);
  const [rejectReason,  setRejectReason]  = useState("");
  const [deleteModal,   setDeleteModal]   = useState(null);
  const [previewModal,  setPreviewModal]  = useState(null);

  const canManage  = ["superadmin", "platformadmin"].includes(role);
  const canApprove = ["superadmin", "platformadmin"].includes(role);
  const canDelete  = role === "superadmin";

  /* ── Fetch ── */
  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getAds(token, { sortBy, sortOrder });
      if (res.success) setCampaigns(res.ads || []);
      else showAlert("error", res.message || "Failed to load campaigns");
    } catch (err) {
      showAlert("error", err.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [token, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await getAdStats(token);
      if (res.success) setStats(res.stats);
    } catch { /* silent */ }
  }, [token, isAdmin]);

  useEffect(() => { fetchCampaigns(); fetchStats(); }, []);

  /* ── Filter ── */
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = campaigns.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter   !== "all" && c.type   !== typeFilter)   return false;
      if (q) {
        const inTitle   = c.title?.toLowerCase().includes(q);
        const inCreator = (c.createdBy?.name || c.createdBy?.fullName || "").toLowerCase().includes(q);
        const inTags    = c.tags?.some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inCreator && !inTags) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy];
      if (sortBy === "createdBy") {
        av = a.createdBy?.fullName || a.createdBy?.name || "";
        bv = b.createdBy?.fullName || b.createdBy?.name || "";
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortOrder === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    setFiltered(list);
  }, [campaigns, searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  const showAlert = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  /* ── Actions ── */
  const handleApprove = async (c) => {
    setActionLoading(c._id);
    try {
      const r = await approveAd(token, c._id);
      if (r.success) { showAlert("success", `"${c.title}" approved`); fetchCampaigns(); fetchStats(); }
      else showAlert("error", r.message || "Failed");
    } catch (e) { showAlert("error", e.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal._id);
    try {
      const r = await rejectAd(token, rejectModal._id, rejectReason);
      if (r.success) {
        showAlert("success", `"${rejectModal.title}" rejected`);
        setRejectModal(null); setRejectReason("");
        fetchCampaigns(); fetchStats();
      } else showAlert("error", r.message || "Failed");
    } catch (e) { showAlert("error", e.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const handlePause = async (c) => {
    setActionLoading(c._id);
    try {
      const r = await pauseAd(token, c._id);
      if (r.success) { showAlert("success", `"${c.title}" paused`); fetchCampaigns(); }
      else showAlert("error", r.message || "Failed");
    } catch (e) { showAlert("error", e.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleResume = async (c) => {
    setActionLoading(c._id);
    try {
      const r = await resumeAd(token, c._id);
      if (r.success) { showAlert("success", `"${c.title}" resumed`); fetchCampaigns(); }
      else showAlert("error", r.message || "Failed");
    } catch (e) { showAlert("error", e.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal || !canDelete) return;
    setActionLoading(deleteModal._id);
    try {
      const r = await deleteAd(token, deleteModal._id);
      if (r.success) {
        showAlert("success", `"${deleteModal.title}" deleted`);
        setDeleteModal(null); fetchCampaigns(); fetchStats();
      } else showAlert("error", r.message || "Failed");
    } catch (e) { showAlert("error", e.message || "Failed"); }
    finally { setActionLoading(null); }
  };

  const mediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `http://localhost:5000${url}`;
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className={`cm-page cm-role-${role}`}>
        <div className="cm-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="cm-grain" aria-hidden="true" />
        <div className="cm-loading">
          <div className="cm-loading__ring" />
          <p>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`cm-page cm-role-${role}`}>
      {/* Background */}
      <div className="cm-bg" aria-hidden="true">
        {role === "superadmin"    && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin"  && <SupportBg />}
      </div>
      <div className="cm-grain" aria-hidden="true" />

      {/* Header */}
      <header className="cm-header">
        <div className="cm-header__line" />
        <h1 className="cm-headline">Campaign Management</h1>
        <p className="cm-subtitle">Create, manage and monitor advertising campaigns</p>
        <div className="cm-header__line" />
      </header>

      {/* Alert */}
      {alert && (
        <div className={`cm-alert cm-alert--${alert.type}`}>
          <span className="cm-alert__text">{alert.text}</span>
          <button className="cm-alert__close" onClick={() => setAlert(null)}>x</button>
        </div>
      )}

      {/* Stats */}
      <div className="cm-stats">
        {[
          { label: "Total",       val: stats.totalAds },
          { label: "Active",      val: stats.activeAds },
          { label: "Pending",     val: stats.pendingAds },
          { label: "Impressions", val: (stats.today?.impressions || 0).toLocaleString() },
          { label: "Revenue",     val: fmtCurrency(stats.today?.revenue || 0) },
        ].map((s, i) => (
          <div key={i} className="cm-stat" style={{ animationDelay: `${i * 0.06}s` }}>
            <span className="cm-stat__label">{s.label}</span>
            <span className="cm-stat__value">{s.val}</span>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="cm-action-row">
        {canManage && (
          <button className="cm-btn cm-btn--primary" onClick={() => navigate("/admin/campaigns/create")}>
            + New Campaign
          </button>
        )}
        <button className="cm-btn cm-btn--ghost" onClick={() => { fetchCampaigns(); fetchStats(); }}>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="cm-filters">
        <div className="cm-search-wrap">
          <input
            className="cm-search"
            type="text"
            placeholder="Search by title, creator, tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="cm-search-clear" onClick={() => setSearchQuery("")}>x</button>
          )}
        </div>
        <div className="cm-filter-group">
          <div className="cm-field">
            <label className="cm-label">Status</label>
            <select className="cm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="cm-field">
            <label className="cm-label">Type</label>
            <select className="cm-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="video">Video</option>
              <option value="banner">Banner</option>
              <option value="sponsored">Sponsored</option>
            </select>
          </div>
          <div className="cm-field">
            <label className="cm-label">Sort By</label>
            <select className="cm-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="createdAt">Date Created</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="impressions">Impressions</option>
              <option value="clicks">Clicks</option>
              <option value="ctr">CTR</option>
              <option value="spentAmount">Spent</option>
            </select>
          </div>
          <div className="cm-field">
            <label className="cm-label">Order</label>
            <select className="cm-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results bar */}
      <div className="cm-results-bar">
        <div className="cm-results-info">
          <span className="cm-count-pill">{filtered.length}</span>
          <span>of {campaigns.length} campaigns</span>
          {(searchQuery || statusFilter !== "all" || typeFilter !== "all") && (
            <button className="cm-clear-btn"
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="cm-empty">
          <div className="cm-empty__icon" />
          <h3>No Campaigns Found</h3>
          <p>{searchQuery || statusFilter !== "all" || typeFilter !== "all"
            ? "Try adjusting your filters"
            : "No campaigns have been created yet"}</p>
          {canManage && (
            <button className="cm-btn cm-btn--primary" style={{ marginTop: "1rem" }}
              onClick={() => navigate("/admin/campaigns/create")}>
              Create First Campaign
            </button>
          )}
        </div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type / Placement</th>
                <th>Status</th>
                <th>Schedule</th>
                <th>Budget</th>
                <th>Performance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c._id}
                  className={c.status === "ended" ? "cm-row--ended" : ""}
                  style={{ animationDelay: `${idx * 0.03}s` }}>

                  {/* Campaign info */}
                  <td>
                    <div className="cm-campaign-cell">
                      <div className="cm-thumb" onClick={() => setPreviewModal(c)}>
                        {c.thumbnailUrl ? (
                          <img src={mediaUrl(c.thumbnailUrl)} alt={c.title}
                            onError={e => { e.target.onerror = null; e.target.src = "/default-thumbnail.jpg"; }} />
                        ) : (
                          <div className="cm-thumb-placeholder">{c.type?.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="cm-campaign-info">
                        <div className="cm-campaign-title">{c.title}</div>
                        <div className="cm-campaign-creator">
                          {c.createdBy?.fullName || c.createdBy?.name || "Unknown"}
                        </div>
                        <div className="cm-campaign-tags">
                          <span className="cm-age-tag">{c.ageRating || "ALL"}</span>
                          {c.tags?.slice(0, 2).map(t => (
                            <span key={t} className="cm-mini-tag">#{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td>
                    <div className="cm-type-cell">
                      <span className={`cm-type-badge cm-type-badge--${c.type}`}>{typeLabel(c.type)}</span>
                      <span className="cm-placement-chip">{c.placement}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <StatusBadge status={c.status} />
                    {c.status === "active" && c.daysRemaining > 0 && (
                      <div className="cm-days-left">{c.daysRemaining}d left</div>
                    )}
                  </td>

                  {/* Schedule */}
                  <td>
                    <div className="cm-schedule">
                      <span>{fmtDate(c.startDate)}</span>
                      <span className="cm-date-sep">to</span>
                      <span>{fmtDate(c.endDate)}</span>
                    </div>
                  </td>

                  {/* Budget */}
                  <td>
                    <div className="cm-budget-cell">
                      <span className="cm-budget-total">{fmtCurrency(c.totalBudget, c.currency)}</span>
                      <div className="cm-budget-track">
                        <div className="cm-budget-fill"
                          style={{ width: `${Math.min(c.progress || 0, 100)}%`, backgroundColor: progressColor(c.progress || 0) }} />
                      </div>
                      <span className="cm-budget-spent">
                        Spent: {fmtCurrency(c.spentAmount || 0, c.currency)}
                      </span>
                    </div>
                  </td>

                  {/* Performance */}
                  <td>
                    <div className="cm-perf-cell">
                      <div className="cm-perf-row">
                        <span className="cm-perf-label">Imp</span>
                        <span className="cm-perf-val">{(c.impressions || 0).toLocaleString()}</span>
                      </div>
                      <div className="cm-perf-row">
                        <span className="cm-perf-label">Clicks</span>
                        <span className="cm-perf-val">{(c.clicks || 0).toLocaleString()}</span>
                      </div>
                      <div className="cm-perf-row">
                        <span className="cm-perf-label">CTR</span>
                        <span className="cm-perf-val">{(c.ctr || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="cm-actions-cell">
                      <button className="cm-action-btn cm-action-btn--view"
                        title="Preview" onClick={() => setPreviewModal(c)}>
                        View
                      </button>

                      <button className="cm-action-btn cm-action-btn--analytics"
                        title="Analytics"
                        onClick={() => navigate(`/admin/campaigns/${c._id}/analytics`)}>
                        Stats
                      </button>

                      {["pending", "paused", "rejected"].includes(c.status) && canManage && (
                        <button className="cm-action-btn cm-action-btn--edit"
                          title="Edit" disabled={actionLoading === c._id}
                          onClick={() => navigate(`/admin/campaigns/${c._id}/edit`)}>
                          Edit
                        </button>
                      )}

                      {c.status === "pending" && canApprove && (
                        <>
                          <button className="cm-action-btn cm-action-btn--approve"
                            title="Approve" disabled={actionLoading === c._id}
                            onClick={() => handleApprove(c)}>
                            Approve
                          </button>
                          <button className="cm-action-btn cm-action-btn--reject"
                            title="Reject" disabled={actionLoading === c._id}
                            onClick={() => { setRejectModal(c); setRejectReason(""); }}>
                            Reject
                          </button>
                        </>
                      )}

                      {c.status === "active" && canManage && (
                        <button className="cm-action-btn cm-action-btn--pause"
                          title="Pause" disabled={actionLoading === c._id}
                          onClick={() => handlePause(c)}>
                          Pause
                        </button>
                      )}

                      {c.status === "paused" && canManage && (
                        <button className="cm-action-btn cm-action-btn--resume"
                          title="Resume" disabled={actionLoading === c._id}
                          onClick={() => handleResume(c)}>
                          Resume
                        </button>
                      )}

                      {canDelete && (
                        <button className="cm-action-btn cm-action-btn--delete"
                          title="Delete" disabled={actionLoading === c._id}
                          onClick={() => setDeleteModal(c)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="cm-overlay" onClick={() => setRejectModal(null)}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>
            <div className="cm-modal__head">
              <span className="cm-modal__title">Reject Campaign</span>
              <button className="cm-modal__close" onClick={() => setRejectModal(null)}>x Close</button>
            </div>
            <div className="cm-modal__body">
              <p className="cm-modal__sub">
                Rejecting <strong style={{ color: "#fff" }}>"{rejectModal.title}"</strong>
              </p>
              <label className="cm-label">
                Reason for rejection <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                className="cm-textarea"
                rows={4}
                placeholder="Explain clearly why this campaign is being rejected..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="cm-modal__foot">
              <button className="cm-btn cm-btn--ghost"
                onClick={() => { setRejectModal(null); setRejectReason(""); }}>
                Cancel
              </button>
              <button className="cm-btn cm-btn--danger"
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === rejectModal._id}>
                {actionLoading === rejectModal._id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="cm-overlay" onClick={() => setDeleteModal(null)}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>
            <div className="cm-modal__head">
              <span className="cm-modal__title">Delete Campaign</span>
              <button className="cm-modal__close" onClick={() => setDeleteModal(null)}>x Close</button>
            </div>
            <div className="cm-modal__body">
              <div className="cm-modal__warning">
                <span>Warning: </span>
                <span>
                  Delete <strong>"{deleteModal.title}"</strong>?
                  This moves the campaign to trash. A super admin can restore it.
                </span>
              </div>
            </div>
            <div className="cm-modal__foot">
              <button className="cm-btn cm-btn--ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="cm-btn cm-btn--danger"
                onClick={handleDelete}
                disabled={actionLoading === deleteModal._id}>
                {actionLoading === deleteModal._id ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="cm-overlay" onClick={() => setPreviewModal(null)}>
          <div className="cm-modal cm-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="cm-modal__head">
              <span className="cm-modal__title">{previewModal.title}</span>
              <button className="cm-modal__close" onClick={() => setPreviewModal(null)}>x Close</button>
            </div>
            <div className="cm-modal__body">
              {previewModal.type === "video" ? (
                <video controls className="cm-preview-media"
                  src={mediaUrl(previewModal.mediaUrl)}
                  poster={previewModal.thumbnailUrl ? mediaUrl(previewModal.thumbnailUrl) : undefined}>
                  Your browser does not support the video element.
                </video>
              ) : (
                <img className="cm-preview-media"
                  src={mediaUrl(previewModal.mediaUrl)} alt={previewModal.title} />
              )}
              <div className="cm-preview-details">
                {previewModal.description && (
                  <p className="cm-preview-desc">{previewModal.description}</p>
                )}
                <div className="cm-preview-meta-grid">
                  <div className="cm-preview-meta-item">
                    <span className="cm-label">Target URL</span>
                    <a href={previewModal.targetUrl} target="_blank" rel="noopener noreferrer">
                      {previewModal.targetUrl}
                    </a>
                  </div>
                  <div className="cm-preview-meta-item">
                    <span className="cm-label">Age Rating</span>
                    <span className="cm-age-tag">{previewModal.ageRating || "ALL"}</span>
                  </div>
                  <div className="cm-preview-meta-item">
                    <span className="cm-label">Placement</span>
                    <span>{previewModal.placement}</span>
                  </div>
                  <div className="cm-preview-meta-item">
                    <span className="cm-label">Budget</span>
                    <span>{fmtCurrency(previewModal.totalBudget, previewModal.currency)}</span>
                  </div>
                  {previewModal.targetCountries?.length > 0 && (
                    <div className="cm-preview-meta-item">
                      <span className="cm-label">Target Countries</span>
                      <span>{previewModal.targetCountries.join(", ")}</span>
                    </div>
                  )}
                  {previewModal.blockedCountries?.length > 0 && (
                    <div className="cm-preview-meta-item">
                      <span className="cm-label">Blocked Countries</span>
                      <span style={{ color: "#ef4444" }}>{previewModal.blockedCountries.join(", ")}</span>
                    </div>
                  )}
                  {previewModal.targetGender && previewModal.targetGender !== "all" && (
                    <div className="cm-preview-meta-item">
                      <span className="cm-label">Target Gender</span>
                      <span style={{ textTransform: "capitalize" }}>{previewModal.targetGender}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="cm-modal__foot">
              <button className="cm-btn cm-btn--ghost" onClick={() => setPreviewModal(null)}>Close</button>
              <button className="cm-btn cm-btn--primary"
                onClick={() => window.open(previewModal.targetUrl, "_blank")}>
                Visit Target URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManagement;