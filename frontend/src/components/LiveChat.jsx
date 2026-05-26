/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import EmojiPicker from 'emoji-picker-react';
import './LiveChat.css';

export default function LiveChat({
  messages = [],
  onSend,
  currentUserId,
  currentUserName,
  currentUserRole,
  chatEnabled = true,
  isLive = false,
  socketConnected = false,
  overlayMode = false,
}) {
  const [text, setText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const { theme } = useTheme();

  const themeAccent = theme.accent;
  const themeAccentRgb = theme.accentRgb;

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showEmojiPicker &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target) &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !onSend || !socketConnected) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
    setAutoScroll(true);
  }, [text, onSend, socketConnected]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  // NOTE: do NOT close picker here — user should be able to spam emojis
  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
    // keep picker open, keep focus on input so user can also type
    inputRef.current?.focus();
  };

  const getRoleBadge = (role) => {
    if (role === 'superadmin') return { label: 'SA', color: '#f8b305' };
    if (role === 'platformadmin') return { label: 'PA', color: themeAccent };
    if (role === 'supportadmin') return { label: 'MOD', color: '#00c85e' };
    return null;
  };

  const msgOwnerColor = (msg) => {
    const isOwn = msg.userId?.toString() === currentUserId?.toString();
    if (isOwn) return '#4ade80';
    const badge = getRoleBadge(msg.role);
    if (badge) return badge.color;
    return themeAccent;
  };

  /* ── Overlay mode: Twitch-style transparent ticker ── */
  if (overlayMode) {
    const visible = messages.filter((m) => !m.isSystem).slice(-12);
    return (
      <div className="lc-overlay" style={{ '--chat-accent': themeAccent, '--chat-accent-rgb': themeAccentRgb }}>
        <div className="lc-overlay-messages">
          {visible.map((msg) => {
            const badge = getRoleBadge(msg.role);
            return (
              <div key={msg.id} className="lc-overlay-msg">
                {badge && (
                  <span className="lc-overlay-badge" style={{ background: badge.color }}>
                    {badge.label}
                  </span>
                )}
                <span className="lc-overlay-name" style={{ color: msgOwnerColor(msg) }}>
                  {msg.name}
                </span>
                <span className="lc-overlay-colon">:</span>
                <span className="lc-overlay-text">{msg.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Normal sidebar mode ── */
  return (
    <div
      className="lc-root"
      style={{ '--chat-accent': themeAccent, '--chat-accent-rgb': themeAccentRgb }}
    >

      {/* Messages — anchored to bottom like Twitch */}
      <div className="lc-messages" ref={listRef} onScroll={handleScroll}>
        {/* Spacer pushes messages to the bottom when there are few */}
        <div className="lc-messages-spacer" />

        {messages.length === 0 && (
          <div className="lc-empty">
            {isLive
              ? 'No messages yet — say something!'
              : 'Chat opens when the stream starts.'}
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.userId?.toString() === currentUserId?.toString();
          const isSystem = msg.isSystem;
          const isWarning = msg.isWarning;

          if (isSystem) {
            return (
              <div key={msg.id} className={`lc-system-msg ${isWarning ? 'lc-system-warning' : ''}`}>
                <span className="lc-system-icon">{isWarning ? '⚠' : '●'}</span>
                {msg.text}
              </div>
            );
          }

          const badge = getRoleBadge(msg.role);
          return (
            <div key={msg.id} className={`lc-msg ${isOwn ? 'lc-msg-own' : ''}`}>
              <div className="lc-msg-line">
                {badge && (
                  <span className="lc-role-badge" style={{ background: badge.color }}>
                    {badge.label}
                  </span>
                )}
                <span className="lc-name" style={{ color: msgOwnerColor(msg) }}>
                  {msg.name}
                </span>
                <span className="lc-colon">:</span>
                <span className="lc-text">{msg.text}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && messages.length > 0 && (
        <button className="lc-scroll-btn" onClick={scrollToBottom}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New messages
        </button>
      )}

      {/* Input area */}
      {showInput && (
        <div className="lc-input-area">
          {!chatEnabled ? (
            <div className="lc-disabled-notice">Chat disabled for this stream.</div>
          ) : !isLive ? (
            <div className="lc-disabled-notice">Chat opens when stream goes live.</div>
          ) : (
            <>
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="lc-emoji-picker-container">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    autoFocusSearch={false}
                    theme="dark"
                    width="100%"
                    height="380px"
                    lazyLoadEmojis={true}
                    searchDisabled={false}
                    skinTonesDisabled={false}
                    previewConfig={{ showPreview: false }}
                    emojiStyle="native"
                  />
                </div>
              )}
              <div className="lc-input-row">
                <button
                  ref={emojiButtonRef}
                  className={`lc-emoji-btn ${showEmojiPicker ? 'lc-emoji-btn-active' : ''}`}
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  title="Emoji"
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="9" cy="10" r="1" fill="currentColor" />
                    <circle cx="15" cy="10" r="1" fill="currentColor" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  className="lc-input"
                  placeholder={socketConnected ? 'Send a message…' : 'Connecting…'}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 300))}
                  onKeyDown={handleKey}
                  maxLength={300}
                  disabled={!socketConnected}
                />
                <button
                  className="lc-send-btn"
                  onClick={handleSend}
                  disabled={!text.trim() || !socketConnected}
                  type="button"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {text.length > 240 && (
                <div className="lc-char-count">{300 - text.length} left</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}