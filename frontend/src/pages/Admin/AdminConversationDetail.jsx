/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
// File: frontend/src/pages/admin/AdminConversationDetail.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import './AdminConversationDetail.css';

// IMPORTANT: Use base URL without /api for avatar images (matches UserList.jsx)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_BASE.replace('/api', ''); // http://localhost:5000

/* ─── Animated backgrounds ─── */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="acd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="acdsg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#acdsg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[110, 200, 310, 440].map((r, i) => (
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707} width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
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
  const nodes = [[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630]];
  return (
    <svg className="acd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="acdpbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#acdpbg)">
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
  const leaves = [[130,440],[365,490],[715,545],[1340,515],[200,30],[350,0],[695,95],[1335,40]];
  return (
    <svg className="acd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="acdsbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#acdsbg)" />
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

/* ─── Helpers ─── */
function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(date) {
  if (!date) return '';
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS - EXACTLY MATCHES UserList.jsx
// ═══════════════════════════════════════════════════════════

// Helper function to get avatar URL - EXACTLY matches UserList.jsx
function getAvatarUrl(profile) {
  if (!profile) return null;
  // Check all possible avatar fields
  const avatar = profile.avatar || profile.profilePicture || profile.photo || profile.avatarUrl || null;
  if (!avatar) return null;
  // If it's already a full URL, return it
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  // Use BASE_URL without /api - matches UserList.jsx
  return `${BASE_URL}${avatar}`;
}

// Helper to get display name - EXACTLY matches UserList.jsx
function getDisplayName(profile) {
  if (!profile) return 'Unknown';
  // Match UserList.jsx displayName logic
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  return profile.name || profile.username || profile.displayName || profile.fullName || profile.email || 'Unknown';
}

// Helper to get initials - EXACTLY matches UserList.jsx
function getInitials(profile) {
  const name = getDisplayName(profile);
  if (!name || name === 'Unknown') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

/* ─── Avatar Component - EXACTLY matches UserList.jsx approach ─── */
function Avatar({ profile, accentColor }) {
  const [avatarError, setAvatarError] = useState(false);
  
  // Get avatar URL and name
  const avatarUrl = getAvatarUrl(profile);
  const initials = getInitials(profile);
  const name = getDisplayName(profile);

  // Reset error state when avatar URL changes
  useEffect(() => { 
    setAvatarError(false); 
  }, [avatarUrl]);

  if (avatarUrl && !avatarError) {
    return (
      <div className="acd-avatar" style={{ '--av-accent': accentColor }}>
        <img 
          src={avatarUrl} 
          alt={name}
          className="acd-avatar__img"
          onError={(e) => {
            console.error(`Avatar failed to load for: ${name} URL: ${avatarUrl}`);
            setAvatarError(true);
          }}
        />
      </div>
    );
  }

  // Fallback to initials - exactly like UserList.jsx
  return (
    <div className="acd-avatar acd-avatar--fallback" style={{ '--av-accent': accentColor }}>
      {initials}
    </div>
  );
}

/* ─── Main ─── */
export default function AdminConversationDetail() {
  const { convId, type } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAppContext();
  const role = user?.role || 'superadmin';

  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [participantMap, setParticipantMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const feedRef = useRef(null);

  const themeColor = role === 'platformadmin' ? '#3B82F6'
                   : role === 'supportadmin'  ? '#22c55e'
                   : '#FFD700';

  const fetchConversation = useCallback(async () => {
    const endpoint = type === 'admin'
      ? `${API_BASE}/messages/admin/admin-conversations/${convId}`
      : `${API_BASE}/messages/admin/user-conversations/${convId}`;
    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      console.log('Conversation data:', data);
      
      if (data.success) {
        setMessages(data.messages || []);
        const profiles = data.conversation?.participantProfiles || [];
        console.log('Participant profiles:', profiles);
        
        setParticipants(profiles);
        const map = {};
        profiles.forEach(p => { 
          if (p) {
            map[p._id] = p;
            console.log(`Mapped profile ${p._id}:`, p);
          }
        });
        setParticipantMap(map);
        setDebugInfo({ 
          profileCount: profiles.length, 
          messageCount: data.messages?.length || 0,
          hasProfiles: profiles.length > 0
        });
      }
    } catch (err) {
      console.error('Error fetching conversation:', err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }, 100);
    }
  }, [convId, type, token]);

  useEffect(() => {
    fetchConversation();
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [fetchConversation]);

  const handleCloseConversation = async () => {
    if (!window.confirm('Close this conversation?')) return;
    try {
      await fetch(`${API_BASE}/messages/admin/conversations/${convId}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/admin/messages');
    } catch (err) { console.error(err); }
  };

  const getProfile = (msg) => {
    const profile = participantMap[msg.senderId];
    if (!profile) {
      console.warn(`No profile found for senderId: ${msg.senderId}`);
    }
    return profile || null;
  };
  
  const getName = (msg) => getDisplayName(getProfile(msg));
  const getRole = (msg) => getProfile(msg)?.role || 'user';
  const getUserId = (msg) => getProfile(msg)?._id || msg.senderId;

  const getParticipantNames = () =>
    participants.map(p => getDisplayName(p)).join(' — ');

  // First unique senderId = left, second = right
  const sideOrder = (() => {
    const order = [];
    for (const msg of messages) {
      if (!order.includes(msg.senderId)) order.push(msg.senderId);
      if (order.length === 2) break;
    }
    return order;
  })();

  const getSide = (msg) => sideOrder.indexOf(msg.senderId) === 1 ? 'right' : 'left';

  const messageGroups = (() => {
    const groups = [];
    let currentDate = null;
    messages.forEach(msg => {
      const d = formatDateHeader(msg.createdAt);
      if (d !== currentDate) { currentDate = d; groups.push({ date: d, messages: [msg] }); }
      else groups[groups.length - 1].messages.push(msg);
    });
    return groups;
  })();

  if (loading) {
    return (
      <div className={`acd-page acd-role-${role}`} style={{ '--accent': themeColor }}>
        <div className="acd-bg">
          {role === 'superadmin' && <SuperBg />}
          {role === 'platformadmin' && <PlatformBg />}
          {role === 'supportadmin' && <SupportBg />}
        </div>
        <div className="acd-grain" />
        <div className="acd-loading">
          <div className="acd-loading__ring" />
          <p>Loading conversation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`acd-page acd-role-${role}`} style={{ '--accent': themeColor }}>
      <div className="acd-bg" aria-hidden="true">
        {role === 'superadmin' && <SuperBg />}
        {role === 'platformadmin' && <PlatformBg />}
        {role === 'supportadmin' && <SupportBg />}
      </div>
      <div className="acd-grain" aria-hidden="true" />

      <div className="acd-shell">

        <div className="acd-header">
          <button className="acd-back-btn" onClick={() => navigate('/admin/messages')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <div className="acd-header-info">
            <h1 className="acd-title">{getParticipantNames()}</h1>
            <p className="acd-subtitle">
              {messages.length} messages · {type === 'admin' ? 'Admin Channel' : 'User Conversation'}
              {debugInfo && ` · ${debugInfo.profileCount} participants`}
            </p>
          </div>
          <button className="acd-close-btn" onClick={handleCloseConversation}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>

        <div className="acd-feed" ref={feedRef}>
          {messages.length === 0 ? (
            <div className="acd-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>No messages yet</p>
            </div>
          ) : messageGroups.map((group, gIdx) => (
            <div key={gIdx} className="acd-message-group">
              <div className="acd-date-divider"><span>{group.date}</span></div>
              {group.messages.map(msg => {
                const side = getSide(msg);
                const profile = getProfile(msg);
                const userId = getUserId(msg);
                const userName = getName(msg);
                
                return (
                  <div key={msg._id} className={`acd-msg acd-msg--${side}`}>
                    <div className="acd-msg__avatar">
                      {profile ? (
                        <Avatar profile={profile} accentColor={themeColor} />
                      ) : (
                        <div className="acd-avatar acd-avatar--fallback" style={{ '--av-accent': themeColor }}>
                          ?
                        </div>
                      )}
                    </div>
                    <div className="acd-msg__body">
                      <div className="acd-msg__meta">
                        {/* Clickable name that goes to user profile - matches UserList.jsx */}
                        <Link 
                          to={`/admin/users-test/${userId}`} 
                          className="acd-msg__name-link"
                          style={{ textDecoration: 'none' }}
                        >
                          <span className="acd-msg__name">{userName}</span>
                        </Link>
                        <span className="acd-msg__role-badge">{getRole(msg)}</span>
                      </div>
                      <div className={`acd-msg__bubble acd-msg__bubble--${side}${msg.isDeleted ? ' acd-msg__bubble--deleted' : ''}`}>
                        {msg.isDeleted ? '[message deleted]' : msg.content}
                      </div>
                      <div className="acd-msg__time">{formatTime(msg.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="acd-readonly-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Read-only — admins cannot reply to messages.</span>
        </div>

      </div>
    </div>
  );
}