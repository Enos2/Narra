/* eslint-disable no-undef */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
// FILE: frontend/src/pages/admin/PlatformAdminDashboard.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import { useMessages } from "../../context/MessageContext";
import { getAdStats } from "../../requests";
import "./PlatformAdminDashboard.css";

import platformAdminLogo from "../../assets/Admin/Platform-admin.png";
// Then use: src={platformAdminLogo}

// ── Animated SVG background — electric circuit traces ────────────────────────
function PlatformBg() {
  const traces = [
    "M0,170 H260 V120 H540 V170 H840 V80 H1440",
    "M0,370 H160 V320 H460 V420 H760 V370 H1440",
    "M0,570 H360 V520 H660 V620 H960 V570 H1440",
    "M0,730 H80 V680 H360 V780 H660 V730 H1440",
    "M210,0 V170 H300 V480 H250 V900",
    "M610,0 V130 H700 V380 H650 V900",
    "M1070,0 V280 H1020 V570 H1120 V900",
  ];
  const nodes = [[260,120],[540,170],[840,80],[160,320],[460,420],[360,520],[660,620],[360,680]];
  return (
    <svg className="pd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pd-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36,0 L0,0 0,36" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5"/>
        </pattern>
        <radialGradient id="pd-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.06"/>
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
        </radialGradient>
        <filter id="pd-blur"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <rect width="1440" height="900" fill="url(#pd-glow)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="5s" repeatCount="indefinite"/>
      </rect>
      <rect width="1440" height="900" fill="url(#pd-grid)">
        <animate attributeName="x" values="0;36" dur="8s" repeatCount="indefinite"/>
      </rect>
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.07" strokeWidth="1.5" filter="url(#pd-blur)">
          <animate attributeName="stroke-opacity" values="0.07;0.18;0.07"
            dur={`${3 + i * 0.6}s`} begin={`${i * 0.4}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
            <animate attributeName="r" values="4;9;4" dur={`${2 + i * 0.3}s`} begin={`${i * 0.5}s`} repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2 + i * 0.3}s`} begin={`${i * 0.5}s`} repeatCount="indefinite"/>
          </circle>
          <circle cx={x} cy={y} r="2" fill="#3B82F6" fillOpacity="0.8"/>
        </g>
      ))}
      {/* Moving data packets */}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,170 H260 V120 H540 V170 H840 V80 H1440"/>
      </circle>
      <circle r="3.5" fill="#60a5fa" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,570 H360 V520 H660 V620 H960 V570 H1440"/>
      </circle>
      <circle r="2.5" fill="#93c5fd" fillOpacity="0.7">
        <animateMotion dur="7s" repeatCount="indefinite" begin="1.5s" path="M210,0 V170 H300 V480 H250 V900"/>
      </circle>
    </svg>
  );
}

export default function PlatformAdminDashboard() {
  const { user, token, isAuthReady } = useAppContext();
  const { conversations, fetchConversations } = useMessages();
  const [stats, setStats] = useState({
    totalUsers: 0, approvedVideos: 0, pendingVideos: 0,
    pendingMovies: 0, pendingSeries: 0,
    totalLiveStreams: 0, pendingLiveStreams: 0,
    flaggedMessages: 0, minorAlerts: 0, totalConversations: 0,
    totalCampaigns: 0, activeCampaigns: 0, pendingCampaigns: 0, todayImpressions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialFetchDone = useRef(false);

  useEffect(() => { document.title = "Narra | Platform Admin"; }, []);

  const messageStats = useCallback(() => {
    if (!conversations?.length) return { flaggedMessages: 0, minorAlerts: 0, totalConversations: 0 };
    return {
      flaggedMessages: conversations.filter(c => c.hasFlaggedMessages)?.length || 0,
      minorAlerts: conversations.filter(c => c.hasMinor)?.length || 0,
      totalConversations: conversations.length,
    };
  }, [conversations]);

  useEffect(() => {
    if (!loading && conversations.length > 0) {
      const ms = messageStats();
      setStats(prev => ({ ...prev, ...ms }));
    }
  }, [conversations, loading, messageStats]);

  const fetchStats = async () => {
    if (!token || initialFetchDone.current) { setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const headers = { Authorization: `Bearer ${token}` };
      const base = "http://localhost:5000";

      const [usersRes, approvedRes, pendingRes, livesRes, pendingLivesRes, adStats] = await Promise.allSettled([
        axios.get(`${base}/api/admin/users`, { headers }),
        axios.get(`${base}/api/videos?status=approved`, { headers }),
        axios.get(`${base}/api/videos?status=pending`, { headers }),
        axios.get(`${base}/api/lives`, { headers }),
        axios.get(`${base}/api/lives?status=pending`, { headers }),
        getAdStats(token).catch(() => ({ stats: { total: 0, active: 0, pending: 0, todayImpressions: 0 } }))
      ]);

      if (token) await fetchConversations().catch(() => {});

      const len = (r) => {
        if (r.status !== "fulfilled") return 0;
        const d = r.value.data;
        if (d?.users && Array.isArray(d.users)) return d.users.length;
        if (d?.videos && Array.isArray(d.videos)) return d.videos.length;
        if (d?.lives && Array.isArray(d.lives)) return d.lives.length;
        if (Array.isArray(d)) return d.length;
        return 0;
      };

      // Calculate pending movies vs series
      let pendingMovies = 0, pendingSeries = 0;
      if (pendingRes.status === "fulfilled") {
        const vids = pendingRes.value.data?.videos || pendingRes.value.data || [];
        const arr = Array.isArray(vids) ? vids : [];
        pendingMovies = arr.filter(v => v.type === 'movie').length;
        pendingSeries = arr.filter(v => v.type === 'series').length;
      }

      const adData = adStats.status === "fulfilled" ? adStats.value : { stats: {} };
      setStats(prev => ({
        ...prev,
        totalUsers: len(usersRes),
        approvedVideos: len(approvedRes),
        pendingVideos: len(pendingRes),
        pendingMovies, pendingSeries,
        totalLiveStreams: len(livesRes),
        pendingLiveStreams: len(pendingLivesRes),
        totalCampaigns: adData?.stats?.total || 0,
        activeCampaigns: adData?.stats?.active || 0,
        pendingCampaigns: adData?.stats?.pending || 0,
        todayImpressions: adData?.stats?.today?.impressions || 0
      }));

      initialFetchDone.current = true;
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token && isAuthReady) fetchStats(); }, [token, isAuthReady]);

  if (!isAuthReady) return <div className="pd-loading"><div className="pd-loading__ring"/><p>Loading…</p></div>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== "platformadmin") return <Navigate to="/" replace />;
  if (loading) return <div className="pd-loading"><div className="pd-loading__ring"/><p>Loading Platform Admin Dashboard…</p></div>;
  if (error) return (
    <div className="pd-loading">
      <p className="pd-error">{error}</p>
      <button onClick={fetchStats} className="pd-retry">Retry</button>
    </div>
  );

  const { flaggedMessages, minorAlerts, totalConversations } = messageStats();

  return (
    <div className="pd-page">
      <div className="pd-bg" aria-hidden="true"><PlatformBg /></div>
      <div className="pd-grain" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="pd-header">
        <div className="pd-header__logo-wrap">
          // eslint-disable-next-line no-undef
          <img src={PLATFORM_LOGO} alt="Platform Admin" className="pd-header__logo" />
          <div className="pd-header__logo-ring" />
        </div>
        <div className="pd-header__text">
          <div className="pd-header__eyebrow">Narra Platform</div>
          <h1 className="pd-header__title">Platform Admin</h1>
          <p className="pd-header__sub">Platform oversight &amp; management</p>
        </div>
        <Link to="/admin/profile" className="pd-profile-pill">
          <div className="pd-profile-pill__avatar">
            {user?.avatar
              ? <img src={user.avatar} alt="Profile" />
              : <span>{user?.name?.[0]?.toUpperCase() || "P"}</span>}
          </div>
          <div className="pd-profile-pill__info">
            <span className="pd-profile-pill__name">{user?.name || user?.email?.split('@')[0]}</span>
            <span className="pd-profile-pill__role">Platform Admin</span>
          </div>
          <span className="pd-profile-pill__arrow">›</span>
        </Link>
      </header>

      {/* ── Stats Grid ── */}
      <section className="pd-grid">

        <Link to="/admin/users" className="pd-card" style={{ "--d": "0s" }}>
          <div className="pd-card__label">Total Users</div>
          <div className="pd-card__value">{stats.totalUsers.toLocaleString()}</div>
          <div className="pd-card__bar" />
        </Link>

        <Link to="/admin/videos?status=approved" className="pd-card" style={{ "--d": "0.05s" }}>
          <div className="pd-card__label">Approved Videos</div>
          <div className="pd-card__value">{stats.approvedVideos.toLocaleString()}</div>
          <div className="pd-card__bar" />
        </Link>

        {/* Pending Videos — split */}
        <Link to="/admin/video-approvals" className="pd-card pd-card--pending" style={{ "--d": "0.1s" }}>
          <div className="pd-card__label">Pending Approvals</div>
          <div className="pd-card__pending-row">
            <div className="pd-card__pending-block pd-card__pending-block--film">
              <span className="pd-card__pending-num">{stats.pendingMovies}</span>
              <span className="pd-card__pending-tag">Films</span>
            </div>
            <div className="pd-card__pending-block pd-card__pending-block--series">
              <span className="pd-card__pending-num">{stats.pendingSeries}</span>
              <span className="pd-card__pending-tag">Series</span>
            </div>
          </div>
          <div className="pd-card__bar" />
        </Link>

        <Link to="/admin/dashboard/live-moderation" className="pd-card" style={{ "--d": "0.15s" }}>
          <div className="pd-card__label">Live Streams</div>
          <div className="pd-card__value">{stats.totalLiveStreams.toLocaleString()}</div>
          <div className="pd-card__bar" />
        </Link>

        <Link to="/admin/live-approvals" className="pd-card" style={{ "--d": "0.2s" }}>
          <div className="pd-card__label">Pending Live</div>
          <div className="pd-card__value">{stats.pendingLiveStreams.toLocaleString()}</div>
          <div className="pd-card__bar" />
        </Link>

        {/* Messages */}
        <Link to="/admin/messages" className="pd-card pd-card--messages" style={{ "--d": "0.25s" }}>
          <div className="pd-card__label">Messages</div>
          <div className="pd-card__row">
            <div className="pd-card__cell">
              <span className="pd-card__cell-num pd-num--total">{totalConversations}</span>
              <span className="pd-card__cell-tag">Total</span>
            </div>
            <div className="pd-card__cell">
              <span className="pd-card__cell-num pd-num--flagged">{flaggedMessages}</span>
              <span className="pd-card__cell-tag">Flagged</span>
            </div>
            <div className="pd-card__cell">
              <span className="pd-card__cell-num pd-num--minor">{minorAlerts}</span>
              <span className="pd-card__cell-tag">Minor</span>
            </div>
          </div>
          <div className="pd-card__bar" />
        </Link>

        {/* Chat */}
        <Link to="/admin/chat" className="pd-card pd-card--chat" style={{ "--d": "0.3s" }}>
          <div className="pd-card__label">Admin Chat</div>
          <div className="pd-card__chat-cta">Open Chat</div>
          <div className="pd-card__bar" />
        </Link>

        {/* Campaigns */}
        <Link to="/admin/dashboard/campaigns" className="pd-card pd-card--campaigns" style={{ "--d": "0.35s" }}>
          <div className="pd-card__label">Ad Campaigns</div>
          <div className="pd-card__row">
            <div className="pd-card__cell">
              <span className="pd-card__cell-num pd-num--total">{stats.totalCampaigns}</span>
              <span className="pd-card__cell-tag">Total</span>
            </div>
            <div className="pd-card__cell">
              <span className="pd-card__cell-num" style={{ color: "#22c55e" }}>{stats.activeCampaigns}</span>
              <span className="pd-card__cell-tag">Active</span>
            </div>
            <div className="pd-card__cell">
              <span className="pd-card__cell-num" style={{ color: "#f59e0b" }}>{stats.pendingCampaigns}</span>
              <span className="pd-card__cell-tag">Pending</span>
            </div>
          </div>
          <div className="pd-card__impressions">
            <span>Today&apos;s Impressions</span>
            <strong>{stats.todayImpressions.toLocaleString()}</strong>
          </div>
          <div className="pd-card__bar" />
        </Link>

      </section>
    </div>
  );
}