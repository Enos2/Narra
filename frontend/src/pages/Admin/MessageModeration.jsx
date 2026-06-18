/* eslint-disable react-hooks/set-state-in-effect */
/**
 * pages/admin/MessageModeration.jsx
 *
 * Super admin can view and moderate admin-to-admin conversations.
 * This page handles admin channel moderation (read-only view).
 *
 * Themed to match AdminMessageCenter — black canvas, per-role accent, animated SVG bg.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import './MessageModeration.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ── Formatters ── */
function formatShortDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function roleLabel(role = '') {
  const map = {
    super_admin: 'Super Admin', superadmin: 'Super Admin',
    platform_admin: 'Platform Admin', platformadmin: 'Platform Admin',
    support_admin: 'Support Admin', supportadmin: 'Support Admin',
    user: 'User',
  };
  return map[role.toLowerCase()] || role;
}

/* ══════════════════════════════════════
   PER-ROLE ANIMATED BACKGROUNDS
══════════════════════════════════════ */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="mm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mmsg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#mmsg1)">
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
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707} width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18 + i * 5}s`} repeatCount="indefinite" />
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
    "M0,740 H90 V690 H380 V790 H680 V740 H1440",
  ];
  const nodes = [[280, 130], [560, 180], [860, 90], [180, 330], [480, 430], [380, 530], [680, 630]];
  return (
    <svg className="mm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="mmpbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#mmpbg)">
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
  const leaves = [[130, 440], [365, 490], [715, 545], [1340, 515], [200, 30], [350, 0], [695, 95], [1335, 40]];
  return (
    <svg className="mm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mmsbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#mmsbg)" />
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
    </svg>
  );
}

/* ══════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════ */
export default function MessageModeration() {
  const { user, token } = useAppContext();
  const navigate = useNavigate();
  const role = user?.role || '';
  const normalizedRole = role.replace('_', '').toLowerCase();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQ, setSearchQ] = useState('');

  const fetchConversations = useCallback(async (pg) => {
    setLoading(true);
    const endpoint = `${API_BASE}/messages/admin/admin-conversations?page=${pg}&limit=20`;

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations(page);
  }, [fetchConversations, page]);

  const handleViewConversation = (convId) => {
    navigate(`/admin/messages/admin/${convId}`);
  };

  const filtered = searchQ.trim()
    ? conversations.filter((c) =>
        (c.participantProfiles || []).some((p) => {
          const name = (p?.displayName || p?.username || p?.fullName || '').toLowerCase();
          return name.includes(searchQ.toLowerCase());
        })
      )
    : conversations;

  // Get theme color for role-based styling
  const getThemeColor = () => {
    switch(normalizedRole) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };

  const themeColor = getThemeColor();

  return (
    <div className="mm-root" data-role={normalizedRole} style={{ '--accent': themeColor }}>

      {/* Animated background */}
      <div className="mm-bg" aria-hidden="true">
        {(role === 'superadmin' || role === 'super_admin') && <SuperBg />}
        {(role === 'platformadmin' || role === 'platform_admin') && <PlatformBg />}
        {(role === 'supportadmin' || role === 'support_admin') && <SupportBg />}
      </div>

      {/* Grain */}
      <div className="mm-grain" aria-hidden="true" />

      {/* Header */}
      <header className="mm-header">
        <div className="mm-header__line" />
        <div className="mm-header__eyebrow">Moderation</div>
        <h1 className="mm-header__title">Admin Message Moderation</h1>
        <p className="mm-header__sub">View and moderate admin-to-admin conversations</p>
        <div className="mm-header__line" />
      </header>

      {/* Toolbar */}
      <div className="mm-toolbar">
        <div className="mm-search">
          <svg className="mm-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="mm-search__input"
            type="text"
            placeholder="Filter by admin name…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
        <span className="mm-count">{total} total</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mm-loading">
          <div className="mm-loading__ring" style={{ borderTopColor: themeColor }}></div>
          <p>Loading admin conversations...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mm-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>No admin conversations found.</p>
        </div>
      ) : (
        <>
          <div className="mm-table__head">
            <div>Admin Participants</div>
            <div>Last Message</div>
            <div>Date</div>
            <div>Status</div>
            <div></div>
          </div>

          <div className="mm-table">
            {filtered.map((conv) => {
              const profiles = conv.participantProfiles || [];
              const lastMsg = conv.lastMessage;
              const isSeen = conv.seenByAll || false;

              return (
                <div
                  key={conv._id}
                  className="mm-row"
                  onClick={() => handleViewConversation(conv._id)}
                >
                  <div className="mm-row__participants">
                    {profiles.map((p, i) => p && (
                      <div key={i}>
                        <div className="mm-row__participant">
                          {p.displayName || p.username || p.fullName || 'Unknown'}
                        </div>
                        <div className="mm-row__participant-sub">
                          <span className={`mm-role-tag mm-role-tag--admin`}>
                            {roleLabel(p.role)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mm-row__preview">
                    {lastMsg?.content || '—'}
                  </div>

                  <div className="mm-row__date">
                    {formatShortDate(lastMsg?.sentAt || conv.updatedAt)}
                  </div>

                  <div className="mm-row__status">
                    {isSeen
                      ? <span className="mm-seen-badge">Seen</span>
                      : <span className="mm-unseen-badge">Unread</span>
                    }
                  </div>

                  <div className="mm-row__action">
                    <button
                      className="mm-row__view-btn"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleViewConversation(conv._id);
                      }}
                      style={{ '--accent': themeColor }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mm-pagination">
              <button
                className="mm-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span>{page} / {totalPages}</span>
              <button
                className="mm-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}