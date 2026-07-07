/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
/**
 * context/MessageContext.jsx
 *
 * Manages Socket.IO connection, real-time events, and unread counts.
 * Works for both regular users (User model) and admins (Admin model).
 * FIXED: API endpoints now use correct /api prefix
 * FIXED: searchUsers handles empty results properly
 * FIXED: Added debug logging for search
 * FIXED: API_BASE now correctly handles production URL
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { io } from 'socket.io-client';
import { useAppContext } from './AppContext';

const MessageContext = createContext(null);

// API_BASE - remove /api if present, we'll add it back in fetch calls
const API_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
  : 'http://localhost:5000';
const SOCKET_URL = API_BASE;

console.log('🔧 MessageContext API_BASE:', API_BASE);

export function MessageProvider({ children }) {
  const { user, token } = useAppContext();

  const socketRef          = useRef(null);
  const [connected, setConnected]         = useState(false);
  const [totalUnread, setTotalUnread]     = useState(0);
  const [conversations, setConversations] = useState([]);

  /* ── helpers ── */
  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  /* ── connect socket when user logs in ── */
  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    let cancelled = false;
    let socket = null;

    const timer = setTimeout(() => {
      if (cancelled) return;

      socket = io(SOCKET_URL, {
        auth:       { token },
        transports: ['websocket', 'polling'],
        reconnection:         true,
        reconnectionAttempts: 5,
        reconnectionDelay:    2000,
      });

      socket.on('connect', () => {
        if (cancelled) { socket.disconnect(); return; }
        setConnected(true);
        console.log('💬 Messaging socket connected');
      });

      socket.on('disconnect', () => {
        if (!cancelled) setConnected(false);
      });

      socket.on('connect_error', (err) => {
        if (!cancelled) console.warn('Socket connect error:', err.message);
      });

      socket.on('new-message', ({ conversationId }) => {
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((c) =>
            c._id !== conversationId ? c : { ...c, _hasNewMessage: true }
          )
        );
      });

      socket.on('conversation-updated', ({ conversationId, lastMessage }) => {
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((c) =>
            c._id === conversationId ? { ...c, lastMessage } : c
          )
        );
        setTotalUnread((n) => n + 1);
      });

      socket.on('messages-read', ({ conversationId, readerId }) => {
        if (cancelled) return;
        if (readerId?.toString() !== (user._id || user.id)?.toString()) return;
        setTotalUnread((n) => Math.max(0, n - 1));
      });

      socketRef.current = socket;
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [token, user]);

  /* ── subscribe socket to conversation rooms ── */
  const subscribeToConversations = useCallback((ids) => {
    if (socketRef.current && ids?.length) {
      socketRef.current.emit('subscribe-conversations', ids);
    }
  }, []);

  /* ── typing ── */
  const sendTyping = useCallback((conversationId, isTyping) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  /* ── fast mark-read via socket ── */
  const socketMarkRead = useCallback((conversationId) => {
    socketRef.current?.emit('mark-read', { conversationId });
  }, []);

  /* ══════════════════════════════════════════
     HTTP API HELPERS - FIXED: All use /api prefix
  ══════════════════════════════════════════ */

  const fetchConversations = useCallback(async () => {
    if (!token) return [];
    try {
      const res  = await fetch(`${API_BASE}/api/messages/conversations`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        const unread = (data.conversations || []).reduce((sum, c) => {
          const me = c.participants?.find(
            (p) => p.participantId?.toString() === (user?._id || user?.id)?.toString()
          );
          return sum + (me?.unreadCount || 0);
        }, 0);
        setTotalUnread(unread);
        subscribeToConversations((data.conversations || []).map((c) => c._id));
        return data.conversations || [];
      }
      return [];
    } catch (err) {
      console.error('fetchConversations error:', err);
      return [];
    }
  }, [token, authHeader, subscribeToConversations, user]);

  const getConversation = useCallback(async (id, page = 1) => {
    if (!token) return null;
    try {
      const res  = await fetch(
        `${API_BASE}/api/messages/conversations/${id}?page=${page}&limit=50`,
        { headers: authHeader() }
      );
      const data = await res.json();
      return data.success ? data : null;
    } catch (err) {
      console.error('getConversation error:', err);
      return null;
    }
  }, [token, authHeader]);

  const startConversation = useCallback(async (recipientId) => {
    if (!token) return null;
    try {
      const res  = await fetch(`${API_BASE}/api/messages/conversations`, {
        method:  'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipientId }),
      });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) => {
          const exists = prev.find((c) => c._id === data.conversation._id);
          if (exists) return prev;
          return [data.conversation, ...prev];
        });
        subscribeToConversations([data.conversation._id]);
      }
      return data.success ? data.conversation : null;
    } catch (err) {
      console.error('startConversation error:', err);
      return null;
    }
  }, [token, authHeader, subscribeToConversations]);

  const sendMessage = useCallback(async (conversationId, content) => {
    if (!token) return null;
    try {
      const res  = await fetch(`${API_BASE}/api/messages/conversations/${conversationId}`, {
        method:  'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content }),
      });
      const data = await res.json();
      return data.success ? data.message : null;
    } catch (err) {
      console.error('sendMessage error:', err);
      return null;
    }
  }, [token, authHeader]);

  const markAsRead = useCallback(async (conversationId) => {
    if (!token) return;
    socketMarkRead(conversationId);
    try {
      await fetch(`${API_BASE}/api/messages/conversations/${conversationId}/read`, {
        method:  'PUT',
        headers: authHeader(),
      });
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id !== conversationId) return c;
          return {
            ...c,
            participants: c.participants?.map((p) =>
              p.participantId?.toString() === (user?._id || user?.id)?.toString()
                ? { ...p, unreadCount: 0 }
                : p
            ),
          };
        })
      );
      setTotalUnread((n) => Math.max(0, n - 1));
    } catch (err) {
      console.error('markAsRead error:', err);
    }
  }, [token, authHeader, socketMarkRead, user]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!token) return false;
    try {
      const res  = await fetch(`${API_BASE}/api/messages/${messageId}`, {
        method:  'DELETE',
        headers: authHeader(),
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error('deleteMessage error:', err);
      return false;
    }
  }, [token, authHeader]);

  // FIXED: searchUsers with better error handling and logging
  const searchUsers = useCallback(async (q) => {
    if (!token || !q || q.length < 2) {
      console.log('🔍 Search: query too short or no token');
      return [];
    }
    try {
      const url = `${API_BASE}/api/messages/search-users?q=${encodeURIComponent(q)}`;
      console.log('🔍 Searching users with URL:', url);
      
      const res = await fetch(url, { headers: authHeader() });
      const data = await res.json();
      console.log('🔍 Search response:', data);
      
      if (data.success) {
        return data.users || [];
      }
      return [];
    } catch (err) {
      console.error('🔍 searchUsers error:', err);
      return [];
    }
  }, [token, authHeader]);

  const searchAdmins = useCallback(async (q) => {
    if (!token || !q || q.length < 2) return [];
    try {
      const res  = await fetch(
        `${API_BASE}/api/messages/search-admins?q=${encodeURIComponent(q)}`,
        { headers: authHeader() }
      );
      const data = await res.json();
      return data.success ? data.admins || [] : [];
    } catch (err) {
      console.error('searchAdmins error:', err);
      return [];
    }
  }, [token, authHeader]);

  /* ══════════════════════════════════════════
     SOCKET REF EXPOSURE
  ══════════════════════════════════════════ */
  const onSocketEvent = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const value = {
    connected,
    totalUnread,
    conversations,
    setConversations,

    // HTTP
    fetchConversations,
    getConversation,
    startConversation,
    sendMessage,
    markAsRead,
    deleteMessage,
    searchUsers,
    searchAdmins,

    // Socket
    sendTyping,
    socketMarkRead,
    onSocketEvent,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessages must be used inside <MessageProvider>');
  return ctx;
}