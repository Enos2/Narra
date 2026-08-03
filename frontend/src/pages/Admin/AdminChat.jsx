/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * pages/admin/AdminChat.jsx
 * Admin-to-admin messaging.
 *
 * Themed to match AdminAuditLogs — black canvas, per-role accent, animated SVG bg.
 * Features:
 *   • Seen receipts: sender sees "Seen" when recipient opens the conversation
 *   • Leave Chat button: archives/leaves the conversation
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages }   from '../../context/MessageContext';
import { useAppContext } from '../../context/AppContext';
import './AdminChat.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ── helpers ── */
function initials(name = '') {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';
}

function roleLabel(role = '') {
  const map = {
    super_admin: 'Super Admin',       superadmin: 'Super Admin',
    platform_admin: 'Platform Admin', platformadmin: 'Platform Admin',
    support_admin: 'Support Admin',   supportadmin: 'Support Admin',
  };
  return map[role.toLowerCase()] || role;
}

function formatDateDivider(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function needsDivider(msgs, i) {
  if (i === 0) return true;
  const prev = new Date(msgs[i - 1].createdAt);
  const curr = new Date(msgs[i].createdAt);
  return curr.getDate() !== prev.getDate();
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
    <svg className="adchat-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="adsg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#adsg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2}
          stroke="#FFD700" strokeOpacity="0.035" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.035;0.08;0.035"
            dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[120, 220, 340].map((r, i) => (
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707} width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.06" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${20 + i * 6}s`} repeatCount="indefinite" />
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
  const nodes = [[280, 130], [560, 180], [860, 90], [380, 530], [680, 630]];
  return (
    <svg className="adchat-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="adpbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.035" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#adpbg)" />
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#4f6ef7" strokeOpacity="0.07" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.07;0.18;0.07" dur={`${3 + i * 0.7}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#4f6ef7" fillOpacity="0.4">
          <animate attributeName="r" values="4;9;4" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.4;0;0.4" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
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
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves = [[130, 440], [715, 545], [1340, 515], [200, 30], [695, 95]];
  return (
    <svg className="adchat-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="adsbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#adsbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.055" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.055;0.14;0.055" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.12">
          <animate attributeName="fill-opacity" values="0.12;0.28;0.12" dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function AdminChat() {
  const { user, token } = useAppContext();

  const {
    conversations,
    fetchConversations,
    getConversation,
    startConversation,
    sendMessage,
    markAsRead,
    deleteMessage,
    searchAdmins,
    sendTyping,
    onSocketEvent,
  } = useMessages();

  const myId           = user?._id || user?.id;
  const myRole         = user?.role || '';
  const normalizedRole = myRole.replace('_', '').toLowerCase();

  /* ── state ── */
  const [loading, setLoading]             = useState(true);
  const [activeId, setActiveId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [loadingChat, setLoadingChat]     = useState(false);
  const [draft, setDraft]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [typing, setTyping]               = useState(false);
  const [typingName, setTypingName]       = useState('');
  const [searchQ, setSearchQ]             = useState('');
  const [searchRes, setSearchRes]         = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults]     = useState(false);
  /* seen: conversationId -> { seenByName, seenAt } */
  const [seenMap, setSeenMap]             = useState({});

  const feedRef       = useRef(null);
  const typingTimeout = useRef(null);
  const searchTimeout = useRef(null);
  const searchRef     = useRef(null);

  /* ── load conversations ── */
  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  /* ── real-time: new message ── */
  useEffect(() => {
    if (typeof onSocketEvent !== 'function') return;
    const off = onSocketEvent('new-message', ({ message, conversationId }) => {
      if (conversationId === activeId) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
        markAsRead(conversationId);
      }
      fetchConversations();
    });
    return off;
  }, [onSocketEvent, activeId, markAsRead, fetchConversations]);

  /* ── real-time: typing ── */
  useEffect(() => {
    if (typeof onSocketEvent !== 'function') return;
    const off = onSocketEvent('typing', ({ conversationId, senderName, isTyping }) => {
      if (conversationId !== activeId) return;
      setTyping(isTyping);
      setTypingName(senderName || '');
      if (isTyping) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 3000);
      }
    });
    return off;
  }, [onSocketEvent, activeId]);

  /* ── real-time: delete ── */
  useEffect(() => {
    if (typeof onSocketEvent !== 'function') return;
    const off = onSocketEvent('message-deleted', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, isDeleted: true, content: 'Message deleted' } : m
        )
      );
    });
    return off;
  }, [onSocketEvent]);

  /* ── real-time: seen receipt ── */
  useEffect(() => {
    if (typeof onSocketEvent !== 'function') return;
    const off = onSocketEvent('messages-seen', ({ conversationId, seenByName, seenAt }) => {
      if (!conversationId) return;
      setSeenMap((prev) => ({ ...prev, [conversationId]: { seenByName, seenAt } }));
    });
    return off;
  }, [onSocketEvent]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  /* ── open conversation ── */
  const openConversation = useCallback(async (id) => {
    setActiveId(id);
    setLoadingChat(true);
    setMessages([]);
    const data = await getConversation(id);
    if (data) {
      setMessages(data.messages || []);
      markAsRead(id);
    }
    setLoadingChat(false);
  }, [getConversation, markAsRead]);

  /* ── leave / close chat ── */
  const handleLeaveChat = async () => {
    if (!activeId) return;
    if (!window.confirm('Leave this conversation? It will be archived for you.')) return;
    try {
      await fetch(`${API_BASE}/messages/conversations/${activeId}/leave`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Leave chat error:', err);
    } finally {
      setActiveId(null);
      setMessages([]);
      fetchConversations();
    }
  };

  /* ── search admins ── */
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQ(q);
    setShowResults(q.trim().length > 0);
    clearTimeout(searchTimeout.current);
    
    if (!q.trim()) { 
      setSearchRes([]); 
      setShowResults(false);
      return; 
    }
    
    if (!searchAdmins) {
      console.warn('AdminChat: searchAdmins not available in MessageContext');
      return;
    }
    
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchAdmins(q);
        console.log('🔍 Search results:', res);
        setSearchRes(Array.isArray(res) ? res : []);
        setShowResults(true);
      } catch (err) {
        console.error('Search admins error:', err);
        setSearchRes([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAdmin = async (a) => {
    setSearchQ('');
    setSearchRes([]);
    setShowResults(false);
    try {
      const conv = await startConversation(a._id || a.id);
      if (conv) openConversation(conv._id);
    } catch (err) {
      console.error('Start conversation error:', err);
    }
  };

  /* ── send ── */
  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !activeId || sending) return;

    setSending(true);
    setDraft('');

    const optimistic = {
      _id: `opt-${Date.now()}`,
      senderId: myId,
      senderModel: 'Admin',
      content,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const saved = await sendMessage(activeId, content);
      setMessages((prev) =>
        prev.map((m) => (m._id === optimistic._id ? (saved || m) : m))
      );
    } catch (err) {
      console.error('Send message error:', err);
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
    } finally {
      setSending(false);
      fetchConversations();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    if (activeId && typeof sendTyping === 'function') sendTyping(activeId, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (activeId && typeof sendTyping === 'function') sendTyping(activeId, false);
    }, 1500);
  };

  const handleDelete = async (msgId) => {
    try {
      const ok = await deleteMessage(msgId);
      if (ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msgId ? { ...m, isDeleted: true, content: 'Message deleted' } : m
          )
        );
      }
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  /* ── derived ── */
  const activeConv = conversations.find((c) => c._id === activeId);
  const otherAdmin = activeConv?.otherParticipant;
  const activeSeen = seenMap[activeId];

  /* Only show admin-lane conversations */
  const adminConvos = conversations.filter(
    (c) => c.lane === 'admin' || c.participants?.every((p) => p.participantModel === 'Admin')
  );

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
  const accentRgb = themeColor === '#FFD700' ? '255, 215, 0' : 
                    themeColor === '#3B82F6' ? '59, 130, 246' : 
                    '34, 197, 94';

  return (
    <div className="adchat-root" data-role={normalizedRole}>

      {/* Animated background */}
      <div className="adchat-bg" aria-hidden="true">
        {(myRole === 'superadmin' || myRole === 'super_admin') && <SuperBg />}
        {(myRole === 'platformadmin' || myRole === 'platform_admin') && <PlatformBg />}
        {(myRole === 'supportadmin' || myRole === 'support_admin') && <SupportBg />}
      </div>

      {/* Grain overlay */}
      <div className="adchat-grain" aria-hidden="true" />

      {/* ══ SIDEBAR ══ */}
      <aside className="adchat-sidebar">
        <div className="adchat-sidebar__top">
          <p className="adchat-sidebar__label">Admin Channels</p>

          <div className="adchat-search" ref={searchRef} style={{ position: 'relative' }}>
            <svg className="adchat-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="adchat-search__input"
              type="text"
              placeholder="Find an admin…"
              value={searchQ}
              onChange={handleSearch}
              onFocus={() => searchQ.trim() && setShowResults(true)}
              autoComplete="off"
            />

            {showResults && (searchRes.length > 0 || searchLoading) && (
              <div className="adchat-search__results">
                {searchLoading ? (
                  <div className="adchat-search__result" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'default' }}>
                    Searching…
                  </div>
                ) : searchRes.length === 0 ? (
                  <div className="adchat-search__result" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'default' }}>
                    No admins found
                  </div>
                ) : (
                  searchRes.map((a) => (
                    <div key={a._id || a.id} className="adchat-search__result" onClick={() => handleSelectAdmin(a)}>
                      <div className="adchat-search__result-name">
                        {a.fullName || a.displayName || a.username || 'Admin'}
                      </div>
                      <div className="adchat-search__result-role" style={{ color: themeColor }}>
                        {roleLabel(a.role || '')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="adchat-list">
          {loading ? (
            <div className="adchat-list__empty">loading…</div>
          ) : adminConvos.length === 0 ? (
            <div className="adchat-list__empty">
              No conversations yet.<br />Search for an admin above to start.
            </div>
          ) : (
            adminConvos.map((c) => {
              const other  = c.otherParticipant;
              const myPart = c.participants?.find(
                (p) => p.participantId?.toString() === myId?.toString()
              );
              const unread = myPart?.unreadCount || 0;
              const name   = other?.displayName || other?.fullName || other?.username || 'Unknown';

              return (
                <div
                  key={c._id}
                  className={`adchat-row${c._id === activeId ? ' adchat-row--active' : ''}${unread > 0 ? ' adchat-row--unread' : ''}`}
                  onClick={() => openConversation(c._id)}
                >
                  <div className="adchat-row__icon" style={{ position: 'relative' }}>
                    {initials(name)}
                    {unread > 0 && <span className="adchat-row__unread-dot" />}
                  </div>
                  <div className="adchat-row__body">
                    <div className="adchat-row__name">{name}</div>
                    <div className="adchat-row__role">{roleLabel(other?.role || '')}</div>
                  </div>
                  {unread > 0 && (
                    <span className="adchat-row__badge">{unread > 9 ? '9+' : unread}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ══ MAIN CHAT ══ */}
      <main className="adchat-main">
        {!activeId ? (
          <div className="adchat-empty">
            <div className="adchat-empty__symbol">{'>//'}</div>
            <div className="adchat-empty__text">Select a channel</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="adchat__header">
              <div className="adchat__header-icon">
                {initials(otherAdmin?.displayName || otherAdmin?.fullName || '')}
              </div>
              <div className="adchat__header-info">
                <div className="adchat__header-name">
                  {otherAdmin?.displayName || otherAdmin?.fullName || otherAdmin?.username || 'Loading…'}
                </div>
                <div className="adchat__header-role">
                  {roleLabel(otherAdmin?.role || '')}
                </div>
              </div>

              <div className="adchat__header-actions">
                <button
                  className="adchat__header-action-btn adchat__header-action-btn--leave"
                  onClick={handleLeaveChat}
                  title="Leave / archive this conversation"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Leave Chat
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="adchat__feed" ref={feedRef}>
              {loadingChat ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-m)', fontSize: 11 }}>
                  No messages. Start the conversation.
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isSent  = msg.senderId?.toString() === myId?.toString();
                  const prev    = i > 0 ? messages[i - 1] : null;
                  const isGroup = !prev || prev.senderId?.toString() !== msg.senderId?.toString();
                  const isLast  = i === messages.length - 1;
                  const showSeen = isSent && isLast && activeSeen?.seenByName;

                  return (
                    <div key={msg._id}>
                      {needsDivider(messages, i) && (
                        <div className="adchat__date-div">
                          <span>{formatDateDivider(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`adchat__bubble-wrap adchat__bubble-wrap--${isSent ? 'sent' : 'recv'}${isGroup ? ' adchat__bubble-wrap--group-start' : ''}`}>
                        <div className={`adchat__bubble adchat__bubble--${isSent ? 'sent' : 'recv'}${msg.isDeleted ? ' adchat__bubble--deleted' : ''}`}>
                          {msg.isDeleted ? 'Message deleted' : msg.content}

                          <div className="adchat__bubble__time">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>

                          {showSeen && (
                            <div className="adchat__bubble__seen">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              Seen by {activeSeen.seenByName}
                            </div>
                          )}

                          {isSent && !msg.isDeleted && !msg._optimistic && (
                            <button
                              className="adchat__bubble__del"
                              onClick={() => handleDelete(msg._id)}
                              title="Delete message"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Typing */}
            <div className="adchat__typing">
              {typing && `${typingName} is typing…`}
            </div>

            {/* Compose */}
            <div className="adchat__compose">
              <textarea
                className="adchat__compose-input"
                placeholder="Message…"
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="adchat__compose-send"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}