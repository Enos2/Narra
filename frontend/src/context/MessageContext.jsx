/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
/**
 * context/MessageContext.jsx
 *
 * Manages Socket.IO connection, real-time events, and unread counts.
 * Works for both regular users (User model) and admins (Admin model).
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

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

    const socket = io(SOCKET_URL, {
      auth:       { token },
      transports: ['websocket', 'polling'],
      reconnection:       true,
      reconnectionAttempts: 5,
      reconnectionDelay:  2000,
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('💬 Messaging socket connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
    });

    /* New message arriving — bump unread if not in that conversation */
    socket.on('new-message', ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id !== conversationId) return c;
          // Will be cleared when user opens the conversation
          return { ...c, _hasNewMessage: true };
        })
      );
    });

    /* Conversation metadata updated (last message snapshot) */
    socket.on('conversation-updated', ({ conversationId, lastMessage }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId ? { ...c, lastMessage } : c
        )
      );
      setTotalUnread((n) => n + 1);
    });

    socket.on('messages-read', ({ conversationId, readerId }) => {
      if (readerId?.toString() !== (user._id || user.id)?.toString()) return;
      setTotalUnread((n) => Math.max(0, n - 1));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
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
     HTTP API HELPERS
  ══════════════════════════════════════════ */

  const fetchConversations = useCallback(async () => {
    if (!token) return [];
    try {
      const res  = await fetch(`${API_BASE}/messages/conversations`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations);
        const unread = data.conversations.reduce((sum, c) => {
          const me = c.participants?.find(
            (p) => p.participantId?.toString() === (user?._id || user?.id)?.toString()
          );
          return sum + (me?.unreadCount || 0);
        }, 0);
        setTotalUnread(unread);

        // Subscribe socket to all conversation rooms
        subscribeToConversations(data.conversations.map((c) => c._id));

        return data.conversations;
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
        `${API_BASE}/messages/conversations/${id}?page=${page}&limit=50`,
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
      const res  = await fetch(`${API_BASE}/messages/conversations`, {
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
      const res  = await fetch(`${API_BASE}/messages/conversations/${conversationId}`, {
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
      await fetch(`${API_BASE}/messages/conversations/${conversationId}/read`, {
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
      const res  = await fetch(`${API_BASE}/messages/${messageId}`, {
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

  const searchUsers = useCallback(async (q) => {
    if (!token || !q) return [];
    try {
      const res  = await fetch(
        `${API_BASE}/messages/search-users?q=${encodeURIComponent(q)}`,
        { headers: authHeader() }
      );
      const data = await res.json();
      return data.success ? data.users : [];
    } catch {
      return [];
    }
  }, [token, authHeader]);

  const searchAdmins = useCallback(async (q) => {
    if (!token || !q) return [];
    try {
      const res  = await fetch(
        `${API_BASE}/messages/search-admins?q=${encodeURIComponent(q)}`,
        { headers: authHeader() }
      );
      const data = await res.json();
      return data.success ? data.admins : [];
    } catch {
      return [];
    }
  }, [token, authHeader]);

  /* ══════════════════════════════════════════
     SOCKET REF EXPOSURE (for components
     that need to listen to real-time events)
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