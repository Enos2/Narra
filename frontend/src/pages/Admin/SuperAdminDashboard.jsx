/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
// FILE: frontend/src/pages/admin/SuperAdminDashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom"; // REMOVED Navigate import - using conditional redirect instead
import { useAppContext } from "../../context/AppContext";
import { useMessages } from "../../context/MessageContext";
import "./SuperAdminDashboard.css";
import {
  getUsers, getVideosForModeration, getLiveStreams,
  getAdmins, getInactiveAdmins, getRecentAuditLogs, getAdStats
} from "../../requests.js";

import superAdminLogo from "../../assets/Admin/Super-admin.png";
// Then use: src={superAdminLogo}

// ── Animated SVG background — radiating sovereign crown geometry ──────────────
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="sd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="500" ry="340" fill="url(#sg1)">
        <animate attributeName="rx" values="500;560;500" dur="8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;1;0.7" dur="8s" repeatCount="indefinite" />
      </ellipse>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * 360 / 24) * Math.PI / 180;
        const x2 = 720 + Math.cos(a) * 950;
        const y2 = 450 + Math.sin(a) * 950;
        return (
          <line key={i} x1="720" y1="450" x2={x2} y2={y2}
            stroke="#FFD700" strokeOpacity="0.04" strokeWidth="1">
            <animate attributeName="stroke-opacity" values="0.04;0.1;0.04"
              dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
          </line>
        );
      })}
      {[110, 210, 330, 470, 620].map((r, i) => (
        <rect key={i}
          x={720 - r * 0.707} y={450 - r * 0.707}
          width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.06" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.06;0.14;0.06"
            dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate"
            from="45 720 450" to="90 720 450" dur={`${22 + i * 5}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}

export default function SuperAdminDashboard() {
  const { user, token, isAuthReady } = useAppContext();
  const { conversations, fetchConversations } = useMessages();
  const initialFetchDone = useRef(false);
  const messageStatsCalculated = useRef(false);

  const [stats, setStats] = useState({
    totalUsers: 0, approvedVideos: 0, totalLiveStreams: 0,
    totalAdmins: 0, inactiveAdmins: 0,
    pendingMovies: 0, pendingSeries: 0,
    flaggedMessages: 0, minorAlerts: 0, totalConversations: 0,
    totalCampaigns: 0, activeCampaigns: 0, pendingCampaigns: 0, todayImpressions: 0
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateMessageStats = useCallback(() => {
    if (!conversations?.length) return { flaggedMessages: 0, minorAlerts: 0, totalConversations: 0 };
    return {
      flaggedMessages: conversations.filter(c => c.hasFlaggedMessages)?.length || 0,
      minorAlerts: conversations.filter(c => c.hasMinor)?.length || 0,
      totalConversations: conversations.length
    };
  }, [conversations]);

  // Update message stats when conversations change, but only once
  useEffect(() => {
    if (!loading && conversations.length > 0 && !messageStatsCalculated.current) {
      setStats(prev => ({ ...prev, ...calculateMessageStats() }));
      messageStatsCalculated.current = true;
    }
  }, [conversations, loading, calculateMessageStats]);

  // FIXED: Proper useEffect with correct dependencies to prevent infinite loop
  useEffect(() => {
    // Don't run if auth is not ready or no user/token
    if (!isAuthReady || !user || !token) {
      if (!isAuthReady) {
        // Still loading auth
        return;
      }
      setLoading(false);
      return;
    }
    
    // Check if user is superadmin
    if (user.role?.toLowerCase() !== "superadmin") {
      setLoading(false);
      return;
    }
    
    // Prevent multiple fetches
    if (initialFetchDone.current) {
      setLoading(false);
      return;
    }
    
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [users, allVideosResult, pendingVideosResult, lives, admins, inactiveAdminsList, auditLogs, adStats] = await Promise.all([
          getUsers(token),
          getVideosForModeration(token, 'all'),
          getVideosForModeration(token, 'pending'),
          getLiveStreams(token),
          getAdmins(token),
          getInactiveAdmins(token),
          getRecentAuditLogs(token, 5),
          getAdStats(token).catch(() => ({ stats: { total: 0, active: 0, pending: 0, todayImpressions: 0 } }))
        ]);
        
        // Fetch conversations without waiting
        fetchConversations().catch(() => {});
        
        let approvedVideosCount = 0;
        if (allVideosResult?.success && allVideosResult.videos) {
          approvedVideosCount = allVideosResult.videos.filter(v => v.status === 'approved' || v.status === 'released').length;
        }
        
        let pendingMoviesCount = 0, pendingSeriesCount = 0;
        if (pendingVideosResult?.success && pendingVideosResult.videos) {
          pendingMoviesCount = pendingVideosResult.videos.filter(v => v.type === 'movie').length;
          pendingSeriesCount = pendingVideosResult.videos.filter(v => v.type === 'series').length;
        }
        
        setStats(prev => ({
          ...prev,
          totalUsers: users?.length || 0,
          approvedVideos: approvedVideosCount,
          totalLiveStreams: lives?.lives?.length || lives?.length || 0,
          totalAdmins: admins?.length || 0,
          inactiveAdmins: inactiveAdminsList?.length || 0,
          pendingMovies: pendingMoviesCount,
          pendingSeries: pendingSeriesCount,
          totalCampaigns: adStats?.stats?.total || 0,
          activeCampaigns: adStats?.stats?.active || 0,
          pendingCampaigns: adStats?.stats?.pending || 0,
          todayImpressions: adStats?.stats?.today?.impressions || 0
        }));
        
        if (auditLogs?.logs) setRecentAuditLogs(auditLogs.logs);
        else if (Array.isArray(auditLogs)) setRecentAuditLogs(auditLogs);
        else setRecentAuditLogs([]);
        
        initialFetchDone.current = true;
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [isAuthReady, user, token, fetchConversations]); // Proper dependencies

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt)) return '—';
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const getActionClass = (a) => {
    if (!a) return 'neutral';
    const s = String(a).toUpperCase();
    if (s.includes('APPROVE') || s.includes('CREATE') || s.includes('ACTIVATE') || s.includes('VERIFY')) return 'positive';
    if (s.includes('BAN') || s.includes('REJECT') || s.includes('DELETE') || s.includes('REMOVE')) return 'negative';
    if (s.includes('FLAG') || s.includes('RESTRICT')) return 'warn';
    return 'neutral';
  };

  const formatAction = (log) => {
    if (log.actionLabel) return log.actionLabel;
    if (!log.actionType) return 'Action';
    return log.actionType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Handle redirect without Navigate component to prevent loops
  if (isAuthReady && user && user.role?.toLowerCase() !== "superadmin") {
    window.location.href = "/login";
    return null;
  }
  
  if (!isAuthReady || loading) {
    return (
      <div className="sd-loading sd-super">
        <div className="sd-loading__ring" />
        <p>Loading Super Admin Dashboard…</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="sd-loading sd-super">
        <p>{error}</p>
        <button onClick={() => {
          initialFetchDone.current = false;
          window.location.reload();
        }}>Retry</button>
      </div>
    );
  }

  const msgStats = calculateMessageStats();

  return (
    <div className="sd-page sd-super">
      {/* Animated background */}
      <div className="sd-bg" aria-hidden="true"><SuperBg /></div>
      <div className="sd-grain" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="sd-header">
        <div className="sd-header__logo-wrap">
          <img src={ADMIN_LOGO} alt="Super Admin" className="sd-header__logo" />
          <div className="sd-header__logo-ring" />
        </div>
        <div className="sd-header__text">
          <div className="sd-header__eyebrow">Narra Platform</div>
          <h1 className="sd-header__title">Super Admin</h1>
          <p className="sd-header__sub">System-wide control &amp; oversight</p>
        </div>
        <Link to="/admin/profile" className="sd-profile-pill">
          <div className="sd-profile-pill__avatar">
            {user?.avatar
              ? <img src={user.avatar} alt="Profile" />
              : <span>{user?.name?.[0]?.toUpperCase() || "S"}</span>}
          </div>
          <div className="sd-profile-pill__info">
            <span className="sd-profile-pill__name">{user?.name || user?.email?.split('@')[0]}</span>
            <span className="sd-profile-pill__role">Super Admin</span>
          </div>
          <span className="sd-profile-pill__arrow">›</span>
        </Link>
      </header>

      {/* ── Stat Cards ── */}
      <section className="sd-grid">
        <Link to="/admin/users" className="sd-card sd-card--single" style={{ "--delay": "0s" }}>
          <div className="sd-card__label">Total Users</div>
          <div className="sd-card__value">{stats.totalUsers.toLocaleString()}</div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/videos?status=approved" className="sd-card sd-card--single" style={{ "--delay": "0.05s" }}>
          <div className="sd-card__label">Approved Videos</div>
          <div className="sd-card__value">{stats.approvedVideos.toLocaleString()}</div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/live-approvals" className="sd-card sd-card--single" style={{ "--delay": "0.1s" }}>
          <div className="sd-card__label">Live Streams</div>
          <div className="sd-card__value">{stats.totalLiveStreams.toLocaleString()}</div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/admins" className="sd-card sd-card--split" style={{ "--delay": "0.15s" }}>
          <div className="sd-card__label">Admin Management</div>
          <div className="sd-card__split-row">
            <div className="sd-card__split-item">
              <span className="sd-card__split-num">{stats.totalAdmins}</span>
              <span className="sd-card__split-label">Total</span>
            </div>
            {stats.inactiveAdmins > 0 && (
              <div className="sd-card__inactive-badge">
                {stats.inactiveAdmins} inactive
              </div>
            )}
          </div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/video-approvals" className="sd-card sd-card--pending" style={{ "--delay": "0.2s" }}>
          <div className="sd-card__label">Pending Approvals</div>
          <div className="sd-card__pending-row">
            <div className="sd-card__pending-block sd-card__pending-block--movie">
              <span className="sd-card__pending-num">{stats.pendingMovies}</span>
              <span className="sd-card__pending-tag">Films</span>
            </div>
            <div className="sd-card__pending-divider" />
            <div className="sd-card__pending-block sd-card__pending-block--series">
              <span className="sd-card__pending-num">{stats.pendingSeries}</span>
              <span className="sd-card__pending-tag">Series</span>
            </div>
          </div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/messages" className="sd-card sd-card--messages" style={{ "--delay": "0.25s" }}>
          <div className="sd-card__label">Messages</div>
          <div className="sd-card__msg-row">
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num sd-card__msg-num--total">{msgStats.totalConversations}</span>
              <span className="sd-card__msg-tag">Total</span>
            </div>
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num sd-card__msg-num--flagged">{msgStats.flaggedMessages}</span>
              <span className="sd-card__msg-tag">Flagged</span>
            </div>
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num sd-card__msg-num--minor">{msgStats.minorAlerts}</span>
              <span className="sd-card__msg-tag">Minor</span>
            </div>
          </div>
          <div className="sd-card__bar" />
        </Link>

        <Link to="/admin/campaigns" className="sd-card sd-card--campaigns" style={{ "--delay": "0.3s" }}>
          <div className="sd-card__label">Ad Campaigns</div>
          <div className="sd-card__msg-row">
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num sd-card__msg-num--total">{stats.totalCampaigns}</span>
              <span className="sd-card__msg-tag">Total</span>
            </div>
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num" style={{ color: "#22c55e" }}>{stats.activeCampaigns}</span>
              <span className="sd-card__msg-tag">Active</span>
            </div>
            <div className="sd-card__msg-item">
              <span className="sd-card__msg-num" style={{ color: "#f59e0b" }}>{stats.pendingCampaigns}</span>
              <span className="sd-card__msg-tag">Pending</span>
            </div>
          </div>
          <div className="sd-card__impressions">
            <span>Today&apos;s Impressions</span>
            <strong>{stats.todayImpressions.toLocaleString()}</strong>
          </div>
          <div className="sd-card__bar" />
        </Link>
      </section>

      {/* ── Quick Actions ── */}
      <section className="sd-actions">
        <h2 className="sd-section-title">Quick Actions</h2>
        <div className="sd-action-grid">
          {[
            { to: "/admin/users", label: "User Moderation" },
            { to: "/admin/admins", label: "Admin Management" },
            { to: "/admin/videos?status=approved", label: "Approved Videos" },
            { to: "/admin/video-approvals", label: "Video Approvals" },
            { to: "/admin/live-approvals", label: "Live Approvals" },
            { to: "/admin/messages", label: "Message Center" },
            { to: "/admin/chat", label: "Admin Chat" },
            { to: "/admin/message-moderation", label: "Message Moderation" },
            { to: "/admin/audit-logs", label: "Audit Logs" },
            { to: "/admin/campaigns", label: "All Campaigns" },
            { to: "/admin/campaigns/create", label: "Create Campaign" },
            { to: "/admin/campaigns/analytics", label: "Ad Analytics" },
          ].map(({ to, label }, i) => (
            <Link key={to} to={to} className="sd-action-link" style={{ animationDelay: `${i * 0.03}s` }}>
              <span>{label}</span>
              <span className="sd-action-link__arrow">›</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Audit Log ── */}
      <section className="sd-audit">
        <div className="sd-audit__header">
          <h2 className="sd-section-title">Recent Admin Activity</h2>
          <Link to="/admin/audit-logs" className="sd-audit__view-all">View All ›</Link>
        </div>

        {!recentAuditLogs?.length ? (
          <div className="sd-audit__empty">No recent admin actions.</div>
        ) : (
          <div className="sd-audit__list">
            {recentAuditLogs.slice(0, 5).map((log, i) => (
              <div key={log._id || log.id || i} className="sd-audit__item">
                <div className="sd-audit__left">
                  <span className={`sd-audit__action sd-audit__action--${getActionClass(log.actionType)}`}>
                    {formatAction(log)}
                  </span>
                  <span className="sd-audit__by">
                    by <strong data-role={log.adminRole?.toLowerCase() || 'admin'} className={`sd-rank sd-rank--${log.adminRole?.toLowerCase() || 'admin'}`}>
                      {log.adminName || 'Admin'}
                    </strong>
                  </span>
                </div>
                <div className="sd-audit__right">
                  <span className="sd-audit__target">{log.targetName || log.targetEmail || log.targetType || ''}</span>
                  <span className="sd-audit__time">{formatDate(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}