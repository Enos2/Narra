/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
// FILE: frontend/src/pages/admin/SupportAdminDashboard.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import { useMessages } from "../../context/MessageContext";
import { getAdStats } from "../../requests";
import "./SupportAdminDashboard.css";

const SUPPORT_LOGO = "/src/assets/Admin/Support-admin.png";

// ── Animated SVG background — organic vine network ───────────────────────────
function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves = [
    [130,440],[365,490],[715,545],[1055,470],[1340,515],
    [200,30],[350,0],[695,95],[1070,0],[1335,40],
    [80,700],[380,750],[720,780],[1020,720],[1360,800]
  ];
  return (
    <svg className="spd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="spd-glow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="spd-top" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.04"/>
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#spd-glow)"/>
      <rect width="1440" height="900" fill="url(#spd-top)"/>
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite"/>
          <animate attributeName="stroke-width" values="1.5;2.5;1.5"
            dur={`${7 + i}s`} begin={`${i * 0.5}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="7" ry="3.5"
            fill="#22c55e" fillOpacity="0.12"
            transform={`rotate(${i * 37} ${x} ${y})`}>
            <animate attributeName="fill-opacity" values="0.12;0.28;0.12"
              dur={`${3 + i * 0.6}s`} begin={`${i * 0.4}s`} repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="rotate"
              from={`0 ${x} ${y}`} to={`360 ${x} ${y}`}
              dur={`${14 + i * 2}s`} repeatCount="indefinite"/>
          </ellipse>
          <circle cx={x} cy={y} r="1.5" fill="#4ade80" fillOpacity="0.4">
            <animate attributeName="fill-opacity" values="0.4;0.9;0.4"
              dur={`${2 + i * 0.4}s`} begin={`${i * 0.3}s`} repeatCount="indefinite"/>
          </circle>
        </g>
      ))}
      {/* Crawling particles */}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite"
          path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/>
      </circle>
      <circle r="2.5" fill="#4ade80" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="4s"
          path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95"/>
      </circle>
      <circle r="2" fill="#86efac" fillOpacity="0.7">
        <animateMotion dur="11s" repeatCount="indefinite" begin="7s"
          path="M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40"/>
      </circle>
    </svg>
  );
}

export default function SupportAdminDashboard() {
  const { user, token, isAuthReady } = useAppContext();
  const { conversations, fetchConversations } = useMessages();
  const [stats, setStats] = useState({
    totalUsers: 0, approvedVideos: 0, pendingVideos: 0,
    pendingMovies: 0, pendingSeries: 0,
    totalLiveStreams: 0,
    flaggedMessages: 0, minorAlerts: 0, totalConversations: 0, openTickets: 0,
    totalCampaigns: 0, activeCampaigns: 0, pendingCampaigns: 0, todayImpressions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialFetchDone = useRef(false);

  useEffect(() => { document.title = "Narra | Support Admin"; }, []);

  const messageStats = useCallback(() => {
    if (!conversations?.length) return { flaggedMessages: 0, minorAlerts: 0, totalConversations: 0, openTickets: 0 };
    const support = conversations.filter(c => c.type === 'support');
    return {
      flaggedMessages: conversations.filter(c => c.hasFlaggedMessages)?.length || 0,
      minorAlerts: conversations.filter(c => c.hasMinor)?.length || 0,
      totalConversations: conversations.length,
      openTickets: support.filter(c => c.supportMetadata?.status === 'open').length,
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

      const [usersRes, approvedRes, pendingRes, livesRes, adStats] = await Promise.allSettled([
        axios.get(`${base}/api/admin/users`, { headers }),
        axios.get(`${base}/api/videos?status=approved`, { headers }),
        axios.get(`${base}/api/videos?status=pending`, { headers }),
        axios.get(`${base}/api/lives`, { headers }),
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

      // Split pending
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

  if (!isAuthReady) return <div className="spd-loading"><div className="spd-loading__ring"/><p>Loading…</p></div>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== "supportadmin") return <Navigate to="/" replace />;
  if (loading) return <div className="spd-loading"><div className="spd-loading__ring"/><p>Loading Support Admin Dashboard…</p></div>;
  if (error) return (
    <div className="spd-loading">
      <p className="spd-error">{error}</p>
      <button onClick={fetchStats} className="spd-retry">Retry</button>
    </div>
  );

  const { flaggedMessages, minorAlerts, totalConversations, openTickets } = messageStats();

  return (
    <div className="spd-page">
      <div className="spd-bg" aria-hidden="true"><SupportBg /></div>
      <div className="spd-grain" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="spd-header">
        <div className="spd-header__logo-wrap">
          <img src={SUPPORT_LOGO} alt="Support Admin" className="spd-header__logo" />
          <div className="spd-header__logo-ring" />
        </div>
        <div className="spd-header__text">
          <div className="spd-header__eyebrow">Narra Platform</div>
          <h1 className="spd-header__title">Support Admin</h1>
          <p className="spd-header__sub">User support &amp; content moderation</p>
        </div>
        <Link to="/admin/profile" className="spd-profile-pill">
          <div className="spd-profile-pill__avatar">
            {user?.avatar
              ? <img src={user.avatar} alt="Profile" />
              : <span>{user?.name?.[0]?.toUpperCase() || "S"}</span>}
          </div>
          <div className="spd-profile-pill__info">
            <span className="spd-profile-pill__name">{user?.name || user?.email?.split('@')[0]}</span>
            <span className="spd-profile-pill__role">Support Admin</span>
          </div>
          <span className="spd-profile-pill__arrow">›</span>
        </Link>
      </header>

      {/* ── Stats Grid ── */}
      <section className="spd-grid">

        <Link to="/admin/users" className="spd-card" style={{ "--d": "0s" }}>
          <div className="spd-card__label">Total Users</div>
          <div className="spd-card__value">{stats.totalUsers.toLocaleString()}</div>
          <div className="spd-card__bar" />
        </Link>

        <Link to="/admin/videos?status=approved" className="spd-card" style={{ "--d": "0.05s" }}>
          <div className="spd-card__label">Approved Videos</div>
          <div className="spd-card__value">{stats.approvedVideos.toLocaleString()}</div>
          <div className="spd-card__bar" />
        </Link>

        {/* Pending Videos — split */}
        <Link to="/admin/video-approvals" className="spd-card spd-card--pending" style={{ "--d": "0.1s" }}>
          <div className="spd-card__label">Pending Approvals</div>
          <div className="spd-card__pending-row">
            <div className="spd-card__pending-block spd-block--film">
              <span className="spd-card__pending-num">{stats.pendingMovies}</span>
              <span className="spd-card__pending-tag">Films</span>
            </div>
            <div className="spd-card__pending-block spd-block--series">
              <span className="spd-card__pending-num">{stats.pendingSeries}</span>
              <span className="spd-card__pending-tag">Series</span>
            </div>
          </div>
          <div className="spd-card__bar" />
        </Link>

        <Link to="/admin/dashboard/live-moderation" className="spd-card" style={{ "--d": "0.15s" }}>
          <div className="spd-card__label">Live Streams</div>
          <div className="spd-card__value">{stats.totalLiveStreams.toLocaleString()}</div>
          <div className="spd-card__bar" />
        </Link>

        {/* Open Tickets */}
        <Link to="/admin/messages?type=support" className="spd-card spd-card--tickets" style={{ "--d": "0.2s" }}>
          <div className="spd-card__label">Open Tickets</div>
          <div className="spd-card__value spd-card__value--ticket">{openTickets}</div>
          <div className="spd-card__bar" />
        </Link>

        {/* Messages */}
        <Link to="/admin/messages" className="spd-card spd-card--messages" style={{ "--d": "0.25s" }}>
          <div className="spd-card__label">Messages</div>
          <div className="spd-card__row">
            <div className="spd-card__cell">
              <span className="spd-cell-num spd-num--total">{totalConversations}</span>
              <span className="spd-cell-tag">Total</span>
            </div>
            <div className="spd-card__cell">
              <span className="spd-cell-num spd-num--flagged">{flaggedMessages}</span>
              <span className="spd-cell-tag">Flagged</span>
            </div>
            <div className="spd-card__cell">
              <span className="spd-cell-num spd-num--minor">{minorAlerts}</span>
              <span className="spd-cell-tag">Minor</span>
            </div>
          </div>
          <div className="spd-card__bar" />
        </Link>

        {/* Chat */}
        <Link to="/admin/chat" className="spd-card spd-card--chat" style={{ "--d": "0.3s" }}>
          <div className="spd-card__label">Support Chat</div>
          <div className="spd-card__chat-cta">Open Chat</div>
          <div className="spd-card__bar" />
        </Link>

        {/* Campaigns (view only) */}
        <Link to="/admin/dashboard/campaigns" className="spd-card spd-card--campaigns" style={{ "--d": "0.35s" }}>
          <div className="spd-card__label">
            Ad Campaigns
            <span className="spd-view-only">View Only</span>
          </div>
          <div className="spd-card__row">
            <div className="spd-card__cell">
              <span className="spd-cell-num spd-num--total">{stats.totalCampaigns}</span>
              <span className="spd-cell-tag">Total</span>
            </div>
            <div className="spd-card__cell">
              <span className="spd-cell-num" style={{ color: "#22c55e" }}>{stats.activeCampaigns}</span>
              <span className="spd-cell-tag">Active</span>
            </div>
            <div className="spd-card__cell">
              <span className="spd-cell-num" style={{ color: "#f59e0b" }}>{stats.pendingCampaigns}</span>
              <span className="spd-cell-tag">Pending</span>
            </div>
          </div>
          <div className="spd-card__impressions">
            <span>Today&apos;s Impressions</span>
            <strong>{stats.todayImpressions.toLocaleString()}</strong>
          </div>
          <div className="spd-card__bar" />
        </Link>

      </section>
    </div>
  );
}