/* eslint-disable react-hooks/immutability */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * File: frontend/src/pages/admin/CampaignAnalytics.jsx
 * Location: frontend/src/pages/admin/CampaignAnalytics.jsx
 * User-facing label: "Campaign Analytics"
 * Theme: Black canvas, role-based animated SVG — matches AdminAuditLogs
 * No emojis anywhere in this file.
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import "./CampaignAnalytics.css";

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
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ca-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ca-sg1)">
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
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
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
    "M0,380 H180 V330 H480 V430 H780 V380 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
  ];
  const nodes = [[280, 130], [560, 180], [860, 90], [180, 330], [480, 430], [380, 530]];
  return (
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ca-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#ca-pbg)" />
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
    </svg>
  );
}

function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  return (
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ca-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#ca-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
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
const fmtNum = (n) => {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
};

const fmtCur = (amt, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const progressColor = (p) => {
  if (p >= 90) return "#ef4444";
  if (p >= 70) return "#f59e0b";
  if (p >= 40) return "#10b981";
  return "#3b82f6";
};

/* ─────────────────────────────────────────────
   Bar chart component
───────────────────────────────────────────── */
const HourlyChart = ({ data }) => {
  const max = Math.max(...data.map(h => h.impressions || 0), 1);
  return (
    <div>
      <div className="ca-chart">
        {Array.from({ length: 24 }, (_, i) => {
          const h = data.find(x => x.hour === i) || { impressions: 0, clicks: 0 };
          const impH = Math.round((h.impressions / max) * 80);
          const clkH = Math.round((h.clicks / max) * 50);
          return (
            <div key={i} className="ca-bar-wrap">
              <div className="ca-bar-group">
                <div className="ca-bar ca-bar--imp" style={{ height: `${impH}px` }}
                  title={`${i}:00 — Impressions: ${h.impressions}`} />
                <div className="ca-bar ca-bar--clk" style={{ height: `${clkH}px` }}
                  title={`${i}:00 — Clicks: ${h.clicks}`} />
              </div>
              {i % 4 === 0 && <span className="ca-bar-label">{i}:00</span>}
            </div>
          );
        })}
      </div>
      <div className="ca-chart-legend">
        <span className="ca-legend-item">
          <span className="ca-legend-dot ca-legend-dot--imp" /> Impressions
        </span>
        <span className="ca-legend-item">
          <span className="ca-legend-dot ca-legend-dot--clk" /> Clicks
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const CampaignAnalytics = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, token } = useAppContext();
  const role = user?.role || "superadmin";

  const [loading,   setLoading]   = useState(true);
  const [campaign,  setCampaign]  = useState(null);
  const [analytics, setAnalytics] = useState({
    summary: {
      totalImpressions: 0, uniqueImpressions: 0,
      clicks: 0, uniqueClicks: 0,
      ctr: 0, spentAmount: 0,
      remainingBudget: 0, progress: 0, ecpm: 0
    },
    hourlyBreakdown: [],
    topVideos: []
  });
  const [period,    setPeriod]    = useState("week");
  const [exporting, setExporting] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchAll(); }, [id, period]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [campRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/api/ads/admin/${id}`,                          { headers: authHeaders }),
        fetch(`${API_BASE}/api/ads/admin/${id}/analytics?period=${period}`, { headers: authHeaders }),
      ]);
      const campData      = await campRes.json();
      const analyticsData = await analyticsRes.json();
      if (campData.success)      setCampaign(campData.ad);
      if (analyticsData.success) setAnalytics(analyticsData.analytics);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!campaign) return;
    setExporting(true);
    try {
      const s = analytics.summary;
      const rows = [
        ["Campaign Analytics Export"],
        ["Campaign", campaign.title],
        ["Period", period],
        ["Status", campaign.status],
        ["Type", campaign.type],
        ["Placement", campaign.placement],
        ["Age Rating", campaign.ageRating || "ALL"],
        ["Start Date", fmtDate(campaign.startDate)],
        ["End Date", fmtDate(campaign.endDate)],
        [],
        ["Metric", "Value"],
        ["Total Impressions", s.totalImpressions],
        ["Unique Impressions", s.uniqueImpressions],
        ["Clicks", s.clicks],
        ["Unique Clicks", s.uniqueClicks],
        ["CTR (%)", (s.ctr || 0).toFixed(2)],
        ["Spent", s.spentAmount],
        ["Remaining Budget", s.remainingBudget],
        ["Progress (%)", (s.progress || 0).toFixed(1)],
        ["eCPM", s.ecpm || 0],
      ];

      const csvContent = rows.map(r => r.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `campaign-analytics-${id}-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={`ca-page ca-role-${role}`}>
        <div className="ca-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="ca-grain" aria-hidden="true" />
        <div className="ca-loading">
          <div className="ca-loading__ring" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className={`ca-page ca-role-${role}`}>
        <div className="ca-bg" aria-hidden="true">
          {role === "superadmin"    && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin"  && <SupportBg />}
        </div>
        <div className="ca-grain" aria-hidden="true" />
        <div className="ca-error-state">
          <h2>Campaign Not Found</h2>
          <p>The campaign you are looking for does not exist.</p>
          <button className="ca-btn ca-btn--primary"
            onClick={() => navigate("/admin/campaigns")}>
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  const s    = analytics.summary;
  const ecpm = s.totalImpressions > 0 ? (s.spentAmount / s.totalImpressions) * 1000 : 0;

  return (
    <div className={`ca-page ca-role-${role}`}>
      <div className="ca-bg" aria-hidden="true">
        {role === "superadmin"    && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin"  && <SupportBg />}
      </div>
      <div className="ca-grain" aria-hidden="true" />

      {/* Header */}
      <header className="ca-header">
        <div className="ca-header__left">
          <div className="ca-header__line" />
          <h1 className="ca-headline">Campaign Analytics</h1>
          <p className="ca-subtitle">Performance data for: {campaign.title}</p>
        </div>
        <div className="ca-header__right">
          <button className="ca-back-btn" onClick={() => navigate("/admin/campaigns")}>
            Back to Campaigns
          </button>
          <select className="ca-select" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
          </select>
          <button className="ca-export-btn" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </header>

      {/* Campaign info card */}
      <div className="ca-info-card">
        <div className="ca-info-top">
          <h2 className="ca-info-title">{campaign.title}</h2>
          <span className={`ca-status-badge ca-status-badge--${campaign.status}`}>
            {campaign.status}
          </span>
        </div>
        <div className="ca-info-meta">
          <div className="ca-meta-item">
            <span className="ca-meta-label">Type</span>
            <span className="ca-meta-val" style={{ textTransform: "capitalize" }}>{campaign.type}</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Placement</span>
            <span className="ca-meta-val">{campaign.placement}</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Age Rating</span>
            <span className="ca-meta-val">{campaign.ageRating || "ALL"}</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Duration</span>
            <span className="ca-meta-val">{fmtDate(campaign.startDate)} to {fmtDate(campaign.endDate)}</span>
          </div>
          <div className="ca-meta-item">
            <span className="ca-meta-label">Currency</span>
            <span className="ca-meta-val">{campaign.currency || "USD"}</span>
          </div>
          {campaign.targetGender && campaign.targetGender !== "all" && (
            <div className="ca-meta-item">
              <span className="ca-meta-label">Target Gender</span>
              <span className="ca-meta-val" style={{ textTransform: "capitalize" }}>{campaign.targetGender}</span>
            </div>
          )}
          {campaign.targetCountries?.length > 0 && (
            <div className="ca-meta-item">
              <span className="ca-meta-label">Target Countries</span>
              <span className="ca-meta-val">{campaign.targetCountries.join(", ")}</span>
            </div>
          )}
          {campaign.blockedCountries?.length > 0 && (
            <div className="ca-meta-item">
              <span className="ca-meta-label">Blocked Countries</span>
              <span className="ca-meta-val" style={{ color: "#ef4444" }}>{campaign.blockedCountries.join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="ca-metrics">
        {[
          { label: "Impressions",  val: fmtNum(s.totalImpressions), sub: `${fmtNum(s.uniqueImpressions)} unique` },
          { label: "Clicks",       val: fmtNum(s.clicks),           sub: `CTR: ${(s.ctr || 0).toFixed(2)}%` },
          { label: "Spent",        val: fmtCur(s.spentAmount, campaign.currency), sub: `of ${fmtCur(campaign.totalBudget, campaign.currency)}` },
          { label: "eCPM",         val: fmtCur(ecpm, campaign.currency), sub: "per 1,000 impressions" },
        ].map((m, i) => (
          <div key={i} className="ca-metric" style={{ animationDelay: `${i * 0.07}s` }}>
            <span className="ca-metric__label">{m.label}</span>
            <span className="ca-metric__val">{m.val}</span>
            <span className="ca-metric__sub">{m.sub}</span>
          </div>
        ))}
      </div>

      {/* Budget progress */}
      <div className="ca-section">
        <div className="ca-section-title">Budget Usage</div>
        <div className="ca-budget-track">
          <div className="ca-budget-fill"
            style={{
              width: `${Math.min(s.progress || 0, 100)}%`,
              background: progressColor(s.progress || 0)
            }} />
        </div>
        <div className="ca-budget-row">
          <span>Spent: {fmtCur(s.spentAmount, campaign.currency)}</span>
          <span>{(s.progress || 0).toFixed(1)}% used</span>
          <span>Remaining: {fmtCur(s.remainingBudget, campaign.currency)}</span>
        </div>
      </div>

      {/* Hourly chart */}
      <div className="ca-section">
        <div className="ca-section-title">Hourly Performance</div>
        {analytics.hourlyBreakdown?.length === 0 ? (
          <p className="ca-no-data">
            No hourly data available. Impressions will appear here once the campaign is running.
          </p>
        ) : (
          <HourlyChart data={analytics.hourlyBreakdown || []} />
        )}
      </div>

      {/* Top videos */}
      <div className="ca-section">
        <div className="ca-section-title">Top Performing Videos</div>
        {analytics.topVideos?.length === 0 ? (
          <p className="ca-no-data">No video placement data available for this period.</p>
        ) : (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th>Video Title</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topVideos.map((v, i) => (
                  <tr key={i}>
                    <td>{v.videoTitle || "Unknown Video"}</td>
                    <td>{fmtNum(v.impressions)}</td>
                    <td>{fmtNum(v.clicks)}</td>
                    <td>{v.impressions > 0 ? ((v.clicks / v.impressions) * 100).toFixed(2) : "0.00"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hourly raw data table */}
      <div className="ca-section">
        <div className="ca-section-title">Hourly Raw Data</div>
        <div className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Impressions</th>
                <th>Unique</th>
                <th>Clicks</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 24 }, (_, i) => {
                const h   = (analytics.hourlyBreakdown || []).find(x => x.hour === i) || { impressions: 0, uniqueImpressions: 0, clicks: 0 };
                const ctr = h.impressions > 0 ? ((h.clicks / h.impressions) * 100).toFixed(2) : "0.00";
                return (
                  <tr key={i}>
                    <td>{i}:00 — {i + 1}:00</td>
                    <td>{(h.impressions || 0).toLocaleString()}</td>
                    <td>{(h.uniqueImpressions || 0).toLocaleString()}</td>
                    <td>{(h.clicks || 0).toLocaleString()}</td>
                    <td>{ctr}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer stats */}
      <div className="ca-footer">
        <div className="ca-footer-stats">
          <div className="ca-foot-stat">
            <span className="ca-foot-stat__label">Total Impressions</span>
            <span className="ca-foot-stat__val">{fmtNum(s.totalImpressions)}</span>
          </div>
          <div className="ca-foot-stat">
            <span className="ca-foot-stat__label">Total Clicks</span>
            <span className="ca-foot-stat__val">{fmtNum(s.clicks)}</span>
          </div>
          <div className="ca-foot-stat">
            <span className="ca-foot-stat__label">Overall CTR</span>
            <span className="ca-foot-stat__val">{(s.ctr || 0).toFixed(2)}%</span>
          </div>
        </div>
        <button className="ca-btn ca-btn--primary"
          onClick={() => navigate("/admin/campaigns")}>
          Back to Campaigns
        </button>
      </div>
    </div>
  );
};

export default CampaignAnalytics;