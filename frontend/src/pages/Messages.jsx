/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMessages } from '../context/MessageContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import './Messages.css';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

function avatar(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}
function initials(name = '') { return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2); }
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date); const now = new Date(); const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatDateDivider(date) {
  const d = new Date(date); const now = new Date(); const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function needsDivider(msgs, index) {
  if (index === 0) return true;
  const prev = new Date(msgs[index - 1].createdAt); const curr = new Date(msgs[index].createdAt);
  return curr.getDate() !== prev.getDate();
}

function Avatar({ src, name, size = 40, className = '', userId, onClick }) {
  const [err, setErr] = useState(false);
  const url = avatar(src);
  const content = (!url || err) ? (
    <div className={`msg-convo-row__avatar-placeholder ${className}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>{initials(name)}</div>
  ) : (
    <img src={url} alt={name} className={`msg-convo-row__avatar ${className}`} style={{ width: size, height: size }} onError={() => setErr(true)} />
  );
  if (userId) return <Link to={`/profile/${userId}`} className="msg-avatar-link">{content}</Link>;
  return content;
}

function ConvoRow({ conv, isActive, onClick, myId, accent, accentRgb }) {
  const other = conv.otherParticipant;
  const myPart = conv.participants?.find((p) => p.participantId?.toString() === myId?.toString());
  const unread = myPart?.unreadCount || 0;
  const name = other?.displayName || other?.username || 'Unknown';
  const preview = conv.lastMessage?.content || 'No messages yet';
  const time = conv.lastMessage?.sentAt || conv.updatedAt;
  const otherUserId = other?._id || other?.id;
  return (
    <div className={`msg-convo-row${isActive ? ' msg-convo-row--active' : ''}${unread > 0 ? ' msg-convo-row--unread' : ''}`}
      style={isActive ? { borderLeft: `2px solid ${accent}`, background: `rgba(${accentRgb}, 0.12)` } : {}}
      onClick={onClick}>
      <div className="msg-convo-row__avatar-wrap">
        <Avatar src={other?.avatar} name={name} userId={otherUserId} />
        {unread > 0 && <span className="msg-convo-row__unread-dot" style={{ background: accent }} />}
      </div>
      <div className="msg-convo-row__body">
        <Link to={`/profile/${otherUserId}`} className="msg-convo-row__name-link" onClick={(e) => e.stopPropagation()}>
          <div className="msg-convo-row__name" style={unread > 0 ? { color: accent } : {}}>{name}</div>
        </Link>
        <div className="msg-convo-row__preview">{preview}</div>
      </div>
      <div className="msg-convo-row__meta">
        <span className="msg-convo-row__time">{formatTime(time)}</span>
        {unread > 0 && <span className="msg-convo-row__badge" style={{ background: accent }}>{unread > 9 ? '9+' : unread}</span>}
      </div>
    </div>
  );
}

export default function Messages() {
  const { conversationId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user'); // e.g. /messages?user=<id> from a "Message" button elsewhere
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { theme } = useTheme();
  const { conversations, fetchConversations, getConversation, startConversation, sendMessage, markAsRead, deleteMessage, searchUsers, sendTyping, onSocketEvent } = useMessages();

  const accent    = theme.accent;
  const accentLight = theme.accentLight || theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const myId = user?._id || user?.id;

  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(paramId || null);
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingName, setTypingName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [resolvingUserParam, setResolvingUserParam] = useState(false);

  const feedRef = useRef(null);
  const composeRef = useRef(null);
  const typingTimeout = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => { fetchConversations().finally(() => setLoading(false)); }, [fetchConversations]);
  useEffect(() => { if (paramId && paramId !== activeId) openConversation(paramId); }, [paramId]);

  // FIXED: handle links that navigate to /messages?user=<id> instead of /messages/:conversationId
  // (e.g. a "Message" button on a profile page). Resolve the user id to an existing or new
  // conversation, then navigate into it properly.
  useEffect(() => {
    if (!loading && userIdParam && !resolvingUserParam) {
      resolveUserParam(userIdParam);
    }
  }, [loading, userIdParam]);

  const resolveUserParam = useCallback(async (userId) => {
    setResolvingUserParam(true);
    try {
      const existingConv = conversations.find((c) => {
        const otherId = c.otherParticipant?._id || c.otherParticipant?.id;
        return otherId === userId;
      });
      if (existingConv) {
        await openConversation(existingConv._id);
        return;
      }
      const conv = await startConversation(userId);
      if (conv && conv._id) {
        await openConversation(conv._id);
        await fetchConversations();
      } else {
        console.error('Could not start conversation for user param:', userId);
        navigate('/messages', { replace: true });
      }
    } catch (err) {
      console.error('Error resolving ?user= param:', err);
      navigate('/messages', { replace: true });
    }
    setResolvingUserParam(false);
  }, [conversations, startConversation, fetchConversations, navigate]);

  useEffect(() => {
    const off = onSocketEvent('new-message', ({ message, conversationId }) => {
      if (conversationId === activeId) { setMessages((prev) => [...prev, message]); scrollToBottom(); markAsRead(conversationId); }
      fetchConversations();
    });
    return off;
  }, [onSocketEvent, activeId, markAsRead, fetchConversations]);

  useEffect(() => {
    const off = onSocketEvent('typing', ({ conversationId, senderName, isTyping }) => {
      if (conversationId !== activeId) return;
      setTyping(isTyping); setTypingName(senderName || '');
      if (isTyping) { clearTimeout(typingTimeout.current); typingTimeout.current = setTimeout(() => setTyping(false), 3000); }
    });
    return off;
  }, [onSocketEvent, activeId]);

  useEffect(() => {
    const off = onSocketEvent('message-deleted', ({ messageId }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, isDeleted: true, content: 'Message deleted' } : m));
    });
    return off;
  }, [onSocketEvent]);

  const scrollToBottom = useCallback(() => { setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 50); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const openConversation = useCallback(async (id) => {
    if (!id) return;
    setActiveId(id); 
    setLoadingChat(true); 
    setMessages([]); 
    setMobileShowChat(true);
    navigate(`/messages/${id}`, { replace: true });
    try {
      const data = await getConversation(id);
      if (data && data.messages) {
        setMessages(data.messages || []);
        markAsRead(id);
      }
    } catch (err) {
      console.error('Error opening conversation:', err);
    }
    setLoadingChat(false);
  }, [getConversation, markAsRead, navigate]);

  const handleSearch = (e) => {
    const q = e.target.value; 
    setSearchQ(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchRes([]); return; }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => { 
      try {
        const res = await searchUsers(q); 
        setSearchRes(res || []); 
      } catch (err) {
        console.error('Search error:', err);
        setSearchRes([]);
      }
      setSearchLoading(false); 
    }, 300);
  };

  // FIXED: handleSelectUser with proper conversation handling and navigation
  const handleSelectUser = async (u) => {
    if (!u || !u._id) {
      console.error('No user selected');
      return;
    }
    
    // Clear search
    setSearchQ('');
    setSearchRes([]);
    setSearchLoading(false);
    
    try {
      console.log('🔍 Selecting user:', u._id, u.username || u.firstName);
      
      // Check if conversation already exists in the current list
      let existingConv = null;
      for (const c of conversations) {
        const otherId = c.otherParticipant?._id || c.otherParticipant?.id;
        if (otherId === u._id) {
          existingConv = c;
          break;
        }
      }
      
      if (existingConv) {
        console.log('✅ Found existing conversation:', existingConv._id);
        // Navigate to existing conversation
        navigate(`/messages/${existingConv._id}`);
        setActiveId(existingConv._id);
        setMobileShowChat(true);
        // Fetch messages
        const data = await getConversation(existingConv._id);
        if (data && data.messages) {
          setMessages(data.messages || []);
          markAsRead(existingConv._id);
        }
        return;
      }
      
      // Start a new conversation
      console.log('🆕 Starting new conversation with:', u._id);
      const conv = await startConversation(u._id);
      
      if (conv && conv._id) {
        console.log('✅ Conversation created:', conv._id);
        // Navigate to the new conversation
        navigate(`/messages/${conv._id}`);
        setActiveId(conv._id);
        setMobileShowChat(true);
        // Fetch messages (should be empty for new conversation)
        const data = await getConversation(conv._id);
        if (data && data.messages) {
          setMessages(data.messages || []);
          markAsRead(conv._id);
        }
        // Refresh conversations list to include the new one
        await fetchConversations();
      } else {
        console.error('❌ Failed to start conversation');
        // Try to refresh conversations and find it
        await fetchConversations();
        // Check if the conversation now exists
        const found = conversations.find(
          (c) => {
            const otherId = c.otherParticipant?._id || c.otherParticipant?.id;
            return otherId === u._id;
          }
        );
        if (found) {
          console.log('✅ Found conversation after refresh:', found._id);
          navigate(`/messages/${found._id}`);
          setActiveId(found._id);
          setMobileShowChat(true);
          const data = await getConversation(found._id);
          if (data && data.messages) {
            setMessages(data.messages || []);
            markAsRead(found._id);
          }
        } else {
          console.error('❌ Conversation still not found after refresh');
        }
      }
    } catch (err) {
      console.error('❌ Error starting conversation:', err);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !activeId || sending) return;
    setSending(true); 
    setDraft('');
    const optimistic = { _id: `opt-${Date.now()}`, senderId: myId, senderModel: 'User', content, createdAt: new Date().toISOString(), _optimistic: true };
    setMessages((prev) => [...prev, optimistic]); 
    scrollToBottom();
    try {
      const saved = await sendMessage(activeId, content);
      setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? (saved || m) : m)));
    } catch (err) {
      console.error('Send message error:', err);
    }
    setSending(false); 
    fetchConversations();
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    if (activeId) sendTyping(activeId, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { if (activeId) sendTyping(activeId, false); }, 1500);
  };

  const handleDelete = async (msgId) => {
    const ok = await deleteMessage(msgId);
    if (ok) setMessages((prev) => prev.map((m) => m._id === msgId ? { ...m, isDeleted: true, content: 'Message deleted' } : m));
  };

  const activeConv = conversations.find((c) => c._id === activeId);
  const otherUser = activeConv?.otherParticipant;
  const otherUserId = otherUser?._id || otherUser?.id;

  return (
    <div className="msg-root">
      <div className="msg-claw-bg">
        {[...Array(12)].map((_, i) => <div key={i} className={`msg-claw msg-claw-${i+1}`}></div>)}
        {[...Array(4)].map((_, i) => <div key={i} className={`msg-scar-diag msg-scar-d${i+1}`}></div>)}
        {[...Array(5)].map((_, i) => <div key={i} className={`msg-scratch-h msg-sh-${i+1}`}></div>)}
        {[...Array(4)].map((_, i) => <div key={i} className={`msg-scratch-v msg-sv-${i+1}`}></div>)}
        {[1,2,3,4].map(i => <div key={i} className={`msg-triple msg-t${i}`}><span></span><span></span><span></span></div>)}
        {[1,2,3].map(i => <div key={i} className={`msg-scar-x msg-sx-${i}`}></div>)}
      </div>

      <div className="msg-blood-top"></div>
      <div className="msg-blood-bottom"></div>

      <aside className={`msg-sidebar${!mobileShowChat ? ' msg-sidebar--visible' : ''}`} style={{ borderRight: `1px solid rgba(${accentRgb}, 0.2)` }}>
        <div className="msg-sidebar__header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.15)` }}>
          <p className="msg-sidebar__title" style={{ color: accent }}>Messages</p>
          <div className="msg-search">
            <svg className="msg-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input className="msg-search__input" type="text" placeholder="Search users..." value={searchQ} onChange={handleSearch} autoComplete="off"
              style={{ borderColor: `rgba(${accentRgb}, 0.3)` }} />
            {(searchRes.length > 0 || searchLoading) && (
              <div className="msg-search__results" style={{ borderColor: `rgba(${accentRgb}, 0.2)` }}>
                {searchLoading ? <div style={{ padding: '12px 16px', color: '#55556a', fontSize: 12 }}>Searching...</div> : (
                  searchRes.map((u) => (
                    <div key={u._id} className="msg-search__result" onClick={() => handleSelectUser(u)} style={{ cursor: 'pointer' }}>
                      <Avatar src={u.avatar} name={u.username || `${u.firstName} ${u.lastName}`} size={30} className="msg-search__result-avatar" userId={u._id} />
                      <div>
                        <div className="msg-search__result-name">{u.firstName} {u.lastName}</div>
                        <div className="msg-search__result-sub">@{u.username}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="msg-list">
          {loading ? (
            <div className="msg-skeleton">
              {[...Array(5)].map((_, i) => <div key={i} className="msg-skeleton__row"><div className="msg-skeleton__circle" /><div className="msg-skeleton__lines"><div className="msg-skeleton__line" /><div className="msg-skeleton__line msg-skeleton__line--short" /></div></div>)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="msg-list__empty">
              <div className="msg-list__empty-label">No conversations</div>
              Search for a user above to start chatting.
            </div>
          ) : (
            conversations.map((c) => <ConvoRow key={c._id} conv={c} isActive={c._id === activeId} myId={myId} accent={accent} accentRgb={accentRgb} onClick={() => openConversation(c._id)} />)
          )}
        </div>
      </aside>

      <main className="msg-main">
        {!activeId ? (
          <div className="msg-empty-state" style={{ borderColor: `rgba(${accentRgb}, 0.2)` }}>
            <div className="msg-empty-state__glyph">[ ]</div>
            <div className="msg-empty-state__label">{resolvingUserParam ? 'Opening conversation...' : 'Select a conversation'}</div>
          </div>
        ) : (
          <>
            <div className="msg-chat__header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.15)` }}>
              <button className="msg-chat__header__back" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }} onClick={() => { setMobileShowChat(false); setActiveId(null); navigate('/messages'); }} aria-label="Back">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <Avatar src={otherUser?.avatar} name={otherUser?.displayName || otherUser?.username || ''} size={36} userId={otherUserId} className="msg-chat__header-avatar" />
              <div className="msg-chat__header-info">
                <Link to={`/profile/${otherUserId}`} className="msg-chat__header-name-link">
                  <div className="msg-chat__header-name">{otherUser?.displayName || otherUser?.username || 'Loading...'}</div>
                </Link>
                <div className="msg-chat__header-sub">@{otherUser?.username || '...'}</div>
              </div>
            </div>

            <div className="msg-feed" ref={feedRef}>
              {loadingChat ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#55556a', fontSize: 12 }}>Loading...</div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#55556a', fontSize: 12 }}>No messages yet. Say something.</div>
              ) : (
                messages.map((msg, i) => {
                  const isSent = msg.senderId?.toString() === myId?.toString();
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const isGroupStart = !prevMsg || prevMsg.senderId?.toString() !== msg.senderId?.toString();
                  return (
                    <div key={msg._id}>
                      {needsDivider(messages, i) && (
                        <div className="msg-date-divider">
                          <span>{formatDateDivider(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`msg-bubble-wrap msg-bubble-wrap--${isSent ? 'sent' : 'recv'}${isGroupStart ? ' msg-bubble-wrap--group-start' : ''}`}>
                        <div className={`msg-bubble msg-bubble--${isSent ? 'sent' : 'recv'}${msg.isDeleted ? ' msg-bubble--deleted' : ''}`}
                          style={isSent ? { borderColor: `rgba(${accentRgb}, 0.35)` } : {}}>
                          {msg.isDeleted ? 'Message deleted' : msg.content}
                          <div className="msg-bubble__time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          {isSent && !msg.isDeleted && !msg._optimistic && (
                            <button className="msg-bubble__delete-btn" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }} onClick={() => handleDelete(msg._id)} title="Delete message">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="msg-typing">
              {typing && (<>{typingName} is typing<span className="msg-typing__dots"><span style={{ background: accent }} /><span style={{ background: accent }} /><span style={{ background: accent }} /></span></>)}
            </div>

            <div className="msg-compose" style={{ borderTop: `1px solid rgba(${accentRgb}, 0.15)` }}>
              <textarea ref={composeRef} className="msg-compose__input" placeholder="Write a message..." value={draft} onChange={handleDraftChange} onKeyDown={handleKeyDown} rows={1}
                style={{ borderColor: `rgba(${accentRgb}, 0.3)` }} />
              <button className="msg-compose__send" onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Send"
                style={{ background: accent }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}