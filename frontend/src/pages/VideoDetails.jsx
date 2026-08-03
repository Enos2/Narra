/* eslint-disable no-empty */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/**
 * FILE: frontend/src/pages/VideoDetails.jsx
 * Narra — Cinematic video detail page
 * Dark editorial aesthetic, crimson/obsidian palette
 * Episodes HORIZONTAL CAROUSEL below player (5 visible, prev/next buttons, NO dots)
 * NARRA logo ONLY (no container/background) top-right of player - LARGER SIZE
 * Single click anywhere on player to play/pause
 * Episode title ONLY on thumbnail preview (NOT during playback)
 * Elegant serif typography throughout (Cormorant Garamond)
 */

/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  getVideoById, checkVideoAccess, purchaseVideo,
  followUser, unfollowUser, checkFollowStatus,
  getFollowers, getFollowing, getTwins,
  getRecommendedVideos, likeVideo, dislikeVideo,
  getVideoInteractionStatus, recordWatchProgress, getResumePosition,
  addVideoToPlaylist, checkVideoSaved, getUserPlaylists, trackShare,
  getVideoComments, addComment, deleteComment, likeComment, dislikeComment
} from "../requests";
import "./VideoDetails.css";
import narraLogo from "../assets/narra-logo.png";

/* ─── Helpers ─── */
const getFullUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${base}${url.startsWith("/") ? url : "/" + url}`;
};

const fmt = (num) => {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
};

const ago = (date) => {
  if (!date) return "just now";
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  for (const [u, v] of Object.entries({ year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 })) {
    const i = Math.floor(s / v);
    if (i >= 1) return `${i} ${u}${i === 1 ? "" : "s"} ago`;
  }
  return "just now";
};

const fmtTime = (s) => {
  if (!s) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const ageColor = (r) => ({ G: "#22c55e", PG: "#f59e0b", "PG-13": "#f97316", "13+": "#f97316", "16+": "#ef4444", "18+": "#991b1b" }[r] || "#6b7280");

const displayName = (u) => {
  if (!u) return "Anonymous";
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.username || u.name || "User";
};

const avatarUrl = (av, name = "User") => {
  if (av?.startsWith("http")) return av;
  if (av) return getFullUrl(av);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7f1d1d&color=fff&bold=true&size=40`;
};

// Returns true if the user is typing in any text field — suppresses player shortcuts
const focusedOnInput = () => {
  const el = document.activeElement;
  if (!el) return false;
  return ["input", "textarea"].includes(el.tagName.toLowerCase()) || el.isContentEditable;
};

/* ─── Background decoration ─── */
function SceneDecor() {
  return (
    <div className="nd-decor" aria-hidden="true">
      {[...Array(16)].map((_, i) => <div key={i} className={`nd-claw nd-claw-${i + 1}`} />)}
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`nd-triple nd-triple-${i + 1}`}><span /><span /><span /></div>
      ))}
      {[...Array(8)].map((_, i) => <div key={i} className={`nd-drip nd-drip-${i + 1}`} />)}
      {[...Array(5)].map((_, i) => <div key={i} className={`nd-splat nd-splat-${i + 1}`} />)}
    </div>
  );
}

/* ─── Share modal ─── */
function ShareModal({ open, onClose, videoId, title, onShared }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const url = `${window.location.origin}/video/${videoId}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); onShared("copy"); setTimeout(() => setCopied(false), 2200); }
    catch {}
  };
  const open2 = (plat) => {
    const links = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Watch " + title + " on Narra")}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(title + " — " + url)}`,
    };
    onShared(plat);
    window.open(links[plat], "_blank", "width=600,height=400");
  };
  return (
    <div className="nd-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-hd"><span>Share</span><button onClick={onClose}>&#215;</button></div>
        <div className="nd-modal-bd">
          <p className="nd-modal-sub">"{title}"</p>
          <div className="nd-share-row">
            <input readOnly value={url} />
            <button className={copied ? "nd-copied" : ""} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="nd-share-plats">
            <button className="nd-plat-fb" onClick={() => open2("facebook")}>Facebook</button>
            <button className="nd-plat-tw" onClick={() => open2("twitter")}>X / Twitter</button>
            <button className="nd-plat-wa" onClick={() => open2("whatsapp")}>WhatsApp</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Playlist modal ─── */
function PlaylistModal({ open, onClose, videoId, token, addNotification }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    getUserPlaylists(token).then(p => { setPlaylists(p || []); setLoading(false); }).catch(() => setLoading(false));
  }, [open, token]);

  const save = async (id) => {
    setSaving(true);
    try { await addVideoToPlaylist(token, videoId, id); addNotification({ type: "success", message: "Saved to playlist" }); onClose(); }
    catch (e) { addNotification({ type: "error", message: e.message || "Failed" }); }
    finally { setSaving(false); }
  };

  const createAndSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { createPlaylist } = await import("../requests");
      const r = await createPlaylist(token, newName.trim());
      if (r.success && r.playlist) { await addVideoToPlaylist(token, videoId, r.playlist._id); addNotification({ type: "success", message: `Saved to "${newName}"` }); onClose(); }
    } catch (e) { addNotification({ type: "error", message: e.message || "Failed" }); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="nd-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-hd"><span>Save to List</span><button onClick={onClose}>&#215;</button></div>
        <div className="nd-modal-bd">
          {loading ? <p className="nd-modal-loading">Loading...</p> : (
            <>
              <div className="nd-pl-list">
                {playlists.map(pl => (
                  <button key={pl._id} className="nd-pl-item" onClick={() => save(pl._id)} disabled={saving}>
                    <span>{pl.name}</span><span className="nd-pl-ct">{pl.videoCount || 0}</span>
                  </button>
                ))}
              </div>
              {!creating
                ? <button className="nd-pl-new" onClick={() => setCreating(true)}>+ New List</button>
                : (
                  <div className="nd-pl-create">
                    <input placeholder="List name" value={newName} onChange={e => setNewName(e.target.value)} maxLength={50} />
                    <div className="nd-pl-create-btns">
                      <button onClick={createAndSave} disabled={saving || !newName.trim()}>{saving ? "Saving..." : "Create & Save"}</button>
                      <button onClick={() => setCreating(false)}>Cancel</button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Comment node (recursive, handles unlimited depth) ─── */
function CommentNode({ comment, depth, videoCreatorId, currentUser, token, onDelete, onLike, onDislike, onReply, addNote }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(true);
  const taRef = useRef(null);

  const name = displayName(comment.user);
  const av = avatarUrl(comment.user?.avatar, name);
  const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;
  const replyToName = comment.replyToUser ? displayName(comment.replyToUser) : null;
  const likes = comment.likeCount ?? comment.likes?.length ?? 0;
  const dislikes = comment.dislikeCount ?? comment.dislikes?.length ?? 0;

  const isOwnComment = currentUser && comment.user?._id && currentUser._id === comment.user._id.toString();
  const isOwner = currentUser && videoCreatorId && currentUser._id === videoCreatorId.toString();
  const isCreatorComment = videoCreatorId && comment.user?._id && videoCreatorId.toString() === comment.user._id.toString();
  const canDelete = !!token && (isOwnComment || isOwner);

  const postReply = async () => {
    if (!replyText.trim() || !token) return;
    setPosting(true);
    try {
      await onReply(comment._id, comment.user?._id, name, replyText.trim());
      setReplyText(""); setReplyOpen(false); setOpen(true);
    } catch (e) { addNote({ type: "error", message: e.message || "Failed to post reply" }); }
    finally { setPosting(false); }
  };

  const stopKeys = e => e.stopPropagation();
  const onKeyDown = e => { e.stopPropagation(); if (e.key === "Enter" && e.ctrlKey) postReply(); };
  const openReply = () => { setReplyOpen(true); setTimeout(() => taRef.current?.focus(), 60); };

  return (
    <div className={`nc-node${depth > 0 ? " nc-child" : ""}`}>
      <div className="nc-row">
        <img src={av} alt="" className={`nc-av${depth > 0 ? " nc-av-sm" : ""}`} />
        <div className="nc-body">
          <div className="nc-head">
            <span className="nc-name">{name}</span>
            {comment.user?.isVerified && <span className="nc-badge nc-verified">V</span>}
            {isCreatorComment && <span className="nc-badge nc-creator">CREATOR</span>}
            <span className="nc-ts">{ago(comment.createdAt)}</span>
            {comment.isEdited && <span className="nc-edited">edited</span>}
          </div>
          {replyToName && (
            <div className="nc-reply-to">
              replying to <strong>@{replyToName}</strong>
            </div>
          )}
          <p className="nc-text">{comment.content}</p>
          <div className="nc-acts">
            <button className="nc-act nc-act-like" onClick={() => onLike(comment._id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              {likes > 0 && <span>{fmt(likes)}</span>}
            </button>
            <button className="nc-act nc-act-dis" onClick={() => onDislike(comment._id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
              {dislikes > 0 && <span>{fmt(dislikes)}</span>}
            </button>
            {token && <button className="nc-act nc-act-reply" onClick={openReply}>Reply</button>}
            {canDelete && (
              <button className="nc-act nc-act-del" onClick={() => onDelete(comment._id)}>Delete</button>
            )}
            {hasReplies && (
              <button className="nc-act nc-act-toggle" onClick={() => setOpen(v => !v)}>
                {open ? "Hide" : "Show"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
          {replyOpen && (
            <div className="nc-reply-box">
              <img src={avatarUrl(currentUser?.avatar, displayName(currentUser))} alt="" className="nc-reply-av" />
              <div className="nc-reply-inner">
                <textarea
                  ref={taRef}
                  placeholder={`Reply to ${name}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={onKeyDown}
                  onKeyUp={stopKeys}
                  onKeyPress={stopKeys}
                  onClick={stopKeys}
                  rows={2}
                />
                <div className="nc-reply-btns">
                  <span className="nc-hint">Ctrl+Enter to post</span>
                  <button className="nc-btn-cancel" onClick={() => { setReplyOpen(false); setReplyText(""); }}>Cancel</button>
                  <button className="nc-btn-post" onClick={postReply} disabled={posting || !replyText.trim()}>
                    {posting ? "Posting..." : "Post Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {hasReplies && open && (
        <div className="nc-children">
          {comment.replies.map(r => (
            <CommentNode key={r._id} comment={r} depth={depth + 1}
              videoCreatorId={videoCreatorId} currentUser={currentUser} token={token}
              onDelete={onDelete} onLike={onLike} onDislike={onDislike} onReply={onReply} addNote={addNote} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Comments section ─── */
function Comments({ videoId, token, user, hasAccess, isPaid, onPurchase, addNote, videoCreatorId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [sort, setSort] = useState("newest");

  const load = useCallback(async () => {
    try { const d = await getVideoComments(videoId); setComments(Array.isArray(d) ? d : []); }
    catch (e) { console.error("load comments:", e); }
    finally { setLoading(false); }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!text.trim() || !token) { if (!token) addNote({ type: "info", message: "Sign in to comment" }); return; }
    setPosting(true);
    try { await addComment(token, videoId, text.trim(), null, null); setText(""); await load(); }
    catch (e) { addNote({ type: "error", message: e.message || "Failed to post comment" }); }
    finally { setPosting(false); }
  };

  const reply = async (parentId, replyToUserId, replyToName, content) => {
    await addComment(token, videoId, content, parentId, replyToUserId);
    addNote({ type: "success", message: `Replied to ${replyToName}` });
    await load();
  };

  const del = async (id) => {
    try { await deleteComment(token, id); addNote({ type: "success", message: "Deleted" }); await load(); }
    catch (e) { addNote({ type: "error", message: e.message || "Failed to delete" }); }
  };

  const like = async (id) => {
    if (!token) { addNote({ type: "info", message: "Sign in to like" }); return; }
    try { await likeComment(token, id); await load(); } catch {}
  };

  const dislike = async (id) => {
    if (!token) { addNote({ type: "info", message: "Sign in to react" }); return; }
    try { await dislikeComment(token, id); await load(); } catch {}
  };

  const stopKeys = e => e.stopPropagation();
  const onKD = e => { e.stopPropagation(); if (e.key === "Enter" && e.ctrlKey) post(); };

  const sorted = [...comments].sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    return (b.likes?.length || 0) - (a.likes?.length || 0);
  });

  if (!hasAccess && isPaid) return (
    <div className="nc-section">
      <div className="nc-locked">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="38" height="38"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p>Purchase to access the conversation</p>
        <button className="nc-unlock" onClick={onPurchase}>Unlock</button>
      </div>
    </div>
  );

  return (
    <div className="nc-section">
      <div className="nc-header">
        <h3 className="nc-title">Comments <span className="nc-ct">{comments.length}</span></h3>
        {comments.length > 1 && (
          <select className="nc-sort" value={sort} onChange={e => setSort(e.target.value)} onClick={stopKeys}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="top">Top</option>
          </select>
        )}
      </div>

      <div className="nc-compose">
        <img src={avatarUrl(user?.avatar, displayName(user))} alt="" className="nc-compose-av" />
        <div className="nc-compose-wrap">
          <textarea
            placeholder={token ? "Write a comment..." : "Sign in to comment"}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKD}
            onKeyUp={stopKeys}
            onKeyPress={stopKeys}
            onClick={stopKeys}
            disabled={!token || posting}
            rows={3}
          />
          {text.trim() && (
            <div className="nc-compose-btns">
              <span className="nc-hint">Ctrl+Enter to post</span>
              <button className="nc-btn-cancel" onClick={() => setText("")}>Cancel</button>
              <button className="nc-btn-post" onClick={post} disabled={posting || !text.trim()}>
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="nc-list">
        {loading ? (
          <div className="nc-skeleton">
            {[1, 2, 3].map(i => (
              <div key={i} className="nc-skel-row">
                <div className="nc-skel-av" />
                <div className="nc-skel-lines"><div className="nc-skel-line" /><div className="nc-skel-line nd-short" /></div>
              </div>
            ))}
          </div>
        ) : sorted.length > 0 ? sorted.map(c => (
          <CommentNode key={c._id} comment={c} depth={0}
            videoCreatorId={videoCreatorId} currentUser={user} token={token}
            onDelete={del} onLike={like} onDislike={dislike} onReply={reply} addNote={addNote} />
        )) : (
          <div className="nc-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p>No comments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Recommended card ─── */
function RecCard({ video, onClick }) {
  return (
    <div className="nd-rec-card" onClick={() => onClick(video._id)}>
      <div className="nd-rec-thumb">
        <img src={getFullUrl(video.thumbnailUrl) || "https://placehold.co/160x90/0a0a0a/7f1d1d?text=No+Image"} alt={video.title} />
        <span className="nd-rec-dur">{fmtTime(video.duration)}</span>
      </div>
      <div className="nd-rec-info">
        <p className="nd-rec-title">{video.title}</p>
        <p className="nd-rec-creator">{displayName(video.creator)}</p>
        <p className="nd-rec-meta">{fmt(video.views)} views · {ago(video.uploadedAt)}</p>
      </div>
    </div>
  );
}

/* ─── Ad placeholder ─── */
function AdPlaceholder() {
  return (
    <div className="nd-ad">
      <span className="nd-ad-tag">Ad</span>
      <div className="nd-ad-body">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="26" height="26" opacity="0.25"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        <span>Advertisement</span>
      </div>
    </div>
  );
}

/* ─── Episodes Panel (HORIZONTAL CAROUSEL - NO DOTS, JUST PREV/NEXT) ─── */
function EpisodesPanel({ video, season, setSeason, episode, setEpisode, episodes, setEpisodes, access }) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const updateVisibleCount = () => {
      if (window.innerWidth >= 1200) setVisibleCount(5);
      else if (window.innerWidth >= 900) setVisibleCount(4);
      else if (window.innerWidth >= 600) setVisibleCount(3);
      else setVisibleCount(2);
    };
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  const changeSeason = (s) => {
    setSeason(s);
    setEpisodes(s.episodes || []);
    if (s.episodes?.length) {
      setEpisode(s.episodes[0]);
    }
    setScrollIndex(0);
  };

  const changeEpisode = (ep) => {
    setEpisode(ep);
  };

  const canScrollPrev = scrollIndex > 0;
  const canScrollNext = scrollIndex + visibleCount < episodes.length;

  const scrollPrev = () => {
    if (canScrollPrev) setScrollIndex(scrollIndex - 1);
  };

  const scrollNext = () => {
    if (canScrollNext) setScrollIndex(scrollIndex + 1);
  };

  if (!video || video.type !== "series") return null;

  const visibleEpisodes = episodes.slice(scrollIndex, scrollIndex + visibleCount);

  return (
    <div className="nd-eps-carousel">
      <div className="nd-eps-carousel-header">
        <div className="nd-eps-title-group">
          <span className="nd-eps-title">EPISODES</span>
          {season && <span className="nd-eps-season-badge">Season {season.seasonNumber}</span>}
        </div>
        {video.seasons?.length > 1 && (
          <select 
            className="nd-season-sel" 
            value={season?.seasonNumber || ""} 
            onChange={(e) => {
              const s = video.seasons.find(s => s.seasonNumber === parseInt(e.target.value));
              if (s) changeSeason(s);
            }}
          >
            {video.seasons.map(s => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                Season {s.seasonNumber}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="nd-eps-carousel-container">
        {canScrollPrev && (
          <button className="nd-carousel-nav nd-carousel-prev" onClick={scrollPrev}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        <div className="nd-eps-carousel-track">
          {visibleEpisodes.map(ep => {
            const selected = episode?._id === ep._id;
            const canWatch = access || ep.published;
            return (
              <div
                key={ep.episodeNumber}
                className={`nd-ep-carousel-item${selected ? " nd-ep-sel" : ""}${!canWatch ? " nd-ep-lock" : ""}`}
                onClick={() => canWatch && changeEpisode(ep)}
              >
                <div className="nd-ep-thumb">
                  <img 
                    src={getFullUrl(ep.thumbnailUrl || video.thumbnailUrl) || "https://placehold.co/160x90/0a0a0a/7f1d1d?text=Episode"} 
                    alt={ep.title || `Episode ${ep.episodeNumber}`}
                  />
                  {!canWatch && (
                    <div className="nd-ep-lock-overlay">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                  )}
                  {ep.duration > 0 && <span className="nd-ep-duration">{fmtTime(ep.duration)}</span>}
                </div>
                <div className="nd-ep-info">
                  <span className="nd-ep-num">{ep.episodeNumber}</span>
                  <span className="nd-ep-title">{ep.title || `Episode ${ep.episodeNumber}`}</span>
                </div>
              </div>
            );
          })}
        </div>

        {canScrollNext && (
          <button className="nd-carousel-nav nd-carousel-next" onClick={scrollNext}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function VideoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token, addNotification } = useAppContext();

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const ctRef = useRef(null);
  const piRef = useRef(null);
  const tapRef = useRef(0);
  const tapPosRef = useRef(null);
  const indRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(false);
  const [vidUrl, setVidUrl] = useState(null);
  const [showVid, setShowVid] = useState(false);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showCtrl, setShowCtrl] = useState(false);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volSlider, setVolSlider] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCt, setLikeCt] = useState(0);
  const [dislikeCt, setDislikeCt] = useState(0);
  const [ldLoading, setLdLoading] = useState(false);
  const [fullDesc, setFullDesc] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [fs, setFs] = useState(false);
  const [skipFb, setSkipFb] = useState(false);
  const [skipDir, setSkipDir] = useState(null);
  const [ppInd, setPpInd] = useState(false);
  const [ppIcon, setPpIcon] = useState("play");
  const [shareOpen, setShareOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resumePos, setResumePos] = useState(0);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [followSt, setFollowSt] = useState({ isFollowing: false, isTwin: false, loading: false });
  const [crStats, setCrStats] = useState({ followers: 0 });
  const [season, setSeason] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [episodes, setEpisodes] = useState([]);

  const pct = dur > 0 ? `${(prog / dur) * 100}%` : "0%";

  const showInd = (icon) => {
    setPpIcon(icon); setPpInd(true);
    if (indRef.current) clearTimeout(indRef.current);
    indRef.current = setTimeout(() => setPpInd(false), 500);
  };

  const startRec = useCallback(() => {
    if (piRef.current) clearInterval(piRef.current);
    piRef.current = setInterval(() => {
      if (videoRef.current && playing && access && token) {
        const cp = videoRef.current.currentTime, td = videoRef.current.duration;
        if (td > 0 && cp > 0) recordWatchProgress(token, id, cp, td, season?.seasonNumber, episode?.episodeNumber).catch(() => {});
      }
    }, 10000);
  }, [playing, access, token, id, season, episode]);

  const stopRec = useCallback(() => { if (piRef.current) { clearInterval(piRef.current); piRef.current = null; } }, []);

  const loadInteract = useCallback(async () => {
    if (!token) return;
    try {
      const s = await getVideoInteractionStatus(token, id);
      setLiked(s.hasLiked || false); setDisliked(s.hasDisliked || false);
      setLikeCt(s.likesCount || 0); setDislikeCt(s.dislikesCount || 0);
    } catch {}
  }, [token, id]);

  const loadSaved = useCallback(async () => {
    if (!token) return;
    try { const r = await checkVideoSaved(token, id); setSaved(r.saved || false); } catch {}
  }, [token, id]);

  const loadResume = useCallback(async () => {
    if (!token || !access) return;
    try {
      const r = await getResumePosition(token, id, season?.seasonNumber, episode?.episodeNumber);
      if (r.shouldResume && r.resumePosition > 5) { setResumePos(r.resumePosition); setResumePrompt(true); }
    } catch {}
  }, [token, id, access, season, episode]);

  const checkFollow = async (creatorId) => {
    try {
      const r = await checkFollowStatus(token, creatorId);
      const isFollowing = r?.status?.isFollowing ?? r?.isFollowing ?? false;
      const isTwin = r?.status?.isTwin ?? r?.isTwin ?? false;
      setFollowSt({ isFollowing, isTwin, loading: false });
    } catch {}
  };

  const loadCreatorStats = async (creatorId) => {
    try {
      const [fr] = await Promise.all([getFollowers(token, creatorId, 1, 1)]);
      setCrStats({ followers: fr.pagination?.total || 0 });
    } catch {}
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getVideoById(token, id);
        if (!data) return;
        setVideo(data);
        setLikeCt(data.likes?.length || 0);
        setDislikeCt(data.dislikes?.length || 0);
        if (data.type === "series" && data.seasons?.length > 0) {
          const s = data.seasons[0];
          setSeason(s);
          if (s.episodes?.length > 0) { 
            setEpisode(s.episodes[0]); 
            setEpisodes(s.episodes); 
          }
        }
        if (token) {
          const ac = await checkVideoAccess(token, id);
          setAccess(ac.hasAccess || false);
          if (data.creator?._id && user?._id !== data.creator._id) {
            checkFollow(data.creator._id);
            loadCreatorStats(data.creator._id);
          }
          await loadInteract();
          await loadSaved();
        } else {
          setAccess(!data.isPaid && data.status === "released");
        }
        try { setRecs(await getRecommendedVideos(token, id) || []); } catch { setRecs([]); }
      } catch (e) { addNotification({ type: "error", message: e.message || "Failed to load" }); }
      finally { setLoading(false); }
    };
    if (id) fetch();
  }, [id, token, user]);

  useEffect(() => { if (access && video && !showVid) loadResume(); }, [access, video, loadResume]);

  useEffect(() => {
    if (!video || !showVid) return;
    if (video.type === "series" && episode) {
      setVidUrl(getFullUrl(access ? episode.videoUrl : (episode.trailerUrl || video.trailerUrl)));
    } else {
      setVidUrl(getFullUrl(access ? video.videoUrl : video.trailerUrl));
    }
  }, [video, access, showVid, episode]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onUpdate = () => setProg(v.currentTime);
    const onMeta = () => setDur(v.duration);
    const onEnd = () => { setEnded(true); setShowVid(false); setPlaying(false); stopRec(); };
    const onPlay = () => { setPlaying(true); startRec(); };
    const onPause = () => { setPlaying(false); stopRec(); };
    const onVol = () => { setMuted(v.muted); setVol(v.volume); };
    v.addEventListener("timeupdate", onUpdate);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnd);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("timeupdate", onUpdate);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVol);
      stopRec();
    };
  }, [vidUrl, startRec, stopRec]);

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (focusedOnInput()) return;
      if (!showVid || !videoRef.current) return;
      switch (e.key) {
        case " ": case "Space": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowUp": e.preventDefault(); changeVol(0.1); break;
        case "ArrowDown": e.preventDefault(); changeVol(-0.1); break;
        case "m": case "M": e.preventDefault(); toggleMute(); break;
        case "f": case "F": e.preventDefault(); toggleFs(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showVid]);

  const showCtrlFor = (ms = 3000) => {
    setShowCtrl(true);
    if (ctRef.current) clearTimeout(ctRef.current);
    ctRef.current = setTimeout(() => { if (playing) setShowCtrl(false); }, ms);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); showCtrlFor(); }
    else { v.pause(); setPlaying(false); setShowCtrl(true); }
  };

  const skip = (sec) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime += sec;
    showCtrlFor(1000);
  };

  const changeVol = (d) => {
    const v = videoRef.current;
    if (!v) return;
    const nv = Math.max(0, Math.min(1, v.volume + d));
    v.volume = nv; v.muted = false;
    setVol(nv); setMuted(false);
  };

  const toggleMute = () => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; };

  const toggleFs = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) playerRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleLike = async () => {
    if (!token) { navigate("/login", { state: { from: `/video/${id}` } }); return; }
    if (ldLoading) return;
    setLdLoading(true);
    try {
      const r = await likeVideo(token, id);
      setLiked(r.action === "liked"); if (r.action === "unliked") setDisliked(false);
      setLikeCt(r.likes); setDislikeCt(r.dislikes);
    } catch (e) { addNotification({ type: "error", message: e.message || "Failed" }); }
    finally { setLdLoading(false); }
  };

  const handleDislike = async () => {
    if (!token) { navigate("/login", { state: { from: `/video/${id}` } }); return; }
    if (ldLoading) return;
    setLdLoading(true);
    try {
      const r = await dislikeVideo(token, id);
      setDisliked(r.action === "disliked"); if (r.action === "disliked") setLiked(false);
      setLikeCt(r.likes); setDislikeCt(r.dislikes);
    } catch (e) { addNotification({ type: "error", message: e.message || "Failed" }); }
    finally { setLdLoading(false); }
  };

  const handleFollow = async () => {
    if (!token) { navigate("/login"); return; }
    if (!video?.creator?._id) return;
    setFollowSt(p => ({ ...p, loading: true }));
    try {
      if (followSt.isFollowing) {
        const r = await unfollowUser(token, video.creator._id);
        if (r.success) {
          setFollowSt({ isFollowing: false, isTwin: false, loading: false });
          setCrStats(p => ({ followers: Math.max(0, p.followers - 1) }));
        }
      } else {
        const r = await followUser(token, video.creator._id);
        if (r.success) {
          setFollowSt({ isFollowing: true, isTwin: r.isTwin || false, loading: false });
          setCrStats(p => ({ followers: p.followers + 1 }));
          addNotification({ type: "success", message: r.isTwin ? "You are now twins!" : `Following ${displayName(video.creator)}` });
        }
      }
    } catch { setFollowSt(p => ({ ...p, loading: false })); }
  };

  const handlePurchase = async () => {
    if (!user) { navigate("/login"); return; }
    setPurchasing(true);
    try { await purchaseVideo(token, video._id); setAccess(true); addNotification({ type: "success", message: "Purchased!" }); }
    catch (e) { addNotification({ type: "error", message: e.message || "Purchase failed" }); }
    finally { setPurchasing(false); }
  };

  const handlePlay = () => {
    showInd("play"); setShowVid(true); setEnded(false);
    setTimeout(() => {
      if (videoRef.current && !resumePos) { videoRef.current.play(); setPlaying(true); showCtrlFor(); }
    }, 100);
  };

  // SINGLE CLICK anywhere on player to play/pause
  const onPlayerClick = (e) => {
    if (e.target.closest(".nd-ctrl") || e.target.closest(".nd-ctrl-btn")) return;
    showInd(videoRef.current?.paused ? "play" : "pause");
    togglePlay();
  };

  const onMouseMove = () => showCtrlFor();

  const onTouchStart = (e) => {
    if (!showVid || !videoRef.current) return;
    const x = e.touches[0].clientX - e.currentTarget.getBoundingClientRect().left;
    const w = e.currentTarget.getBoundingClientRect().width;
    tapPosRef.current = x < w / 3 ? "L" : x > (2 * w) / 3 ? "R" : "M";
  };

  const onTouchEnd = () => {
    if (!showVid || !videoRef.current) return;
    const now = Date.now();
    if (now - tapRef.current < 300) {
      if (tapPosRef.current === "L") { skip(-10); setSkipDir("b"); setSkipFb(true); setTimeout(() => setSkipFb(false), 500); }
      else if (tapPosRef.current === "R") { skip(10); setSkipDir("f"); setSkipFb(true); setTimeout(() => setSkipFb(false), 500); }
      else { showInd(videoRef.current.paused ? "play" : "pause"); togglePlay(); }
    }
    tapRef.current = now;
  };

  if (loading) return (
    <div className="nd-wrapper nd-loading">
      <SceneDecor />
      <div className="nd-stroke nd-stroke-t" /><div className="nd-stroke nd-stroke-b" />
      <div className="nd-load-inner"><div className="nd-spinner" /><p>Loading</p></div>
    </div>
  );

  if (!video) return (
    <div className="nd-wrapper nd-loading">
      <SceneDecor />
      <div className="nd-stroke nd-stroke-t" /><div className="nd-stroke nd-stroke-b" />
      <div className="nd-load-inner"><p>Content not found</p></div>
    </div>
  );

  const isSeries = video.type === "series";
  const isPaid = !access && video.isPaid;
  const thumbUrl = getFullUrl(isSeries && episode ? (episode.thumbnailUrl || video.thumbnailUrl) : video.thumbnailUrl);
  const ac = ageColor(video.ageRating);
  const isOwn = user && video.creator?._id && user._id === video.creator._id;

  return (
    <div className={`nd-wrapper${fs ? " nd-fs" : ""}`}>
      <SceneDecor />
      <div className="nd-stroke nd-stroke-t" />
      <div className="nd-stroke nd-stroke-b" />

      {/* Resume prompt */}
      {resumePrompt && (
        <div className="nd-resume">
          <p>Continue from <strong>{fmtTime(resumePos)}</strong>?</p>
          <div className="nd-resume-btns">
            <button className="nd-rbtn-yes" onClick={() => { if (videoRef.current) videoRef.current.currentTime = resumePos; setResumePrompt(false); }}>Resume</button>
            <button className="nd-rbtn-no" onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; setResumePrompt(false); }}>Start over</button>
          </div>
        </div>
      )}

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} videoId={id} title={video.title} onShared={(p) => { if (token) trackShare(token, id, p).catch(() => {}); }} />
      <PlaylistModal open={saveOpen} onClose={() => setSaveOpen(false)} videoId={id} token={token} addNotification={addNotification} />

      <div className="nd-page">

        {/* ── Player column + info ── */}
        <div className="nd-left">

          {/* Video player */}
          <div className="nd-player-wrapper">
            <div
              className="nd-player"
              ref={playerRef}
              onMouseMove={onMouseMove}
              onMouseLeave={() => playing && setShowCtrl(false)}
              onClick={onPlayerClick}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* NARRA logo ONLY - no container/background, just the image - LARGER SIZE */}
              <img src={narraLogo} alt="Narra" className="nd-watermark" />

              {/* Age badge */}
              {video.ageRating && (
                <div className="nd-age" style={{ borderColor: ac, color: ac }}>{video.ageRating}</div>
              )}

              {/* Skip feedback */}
              {skipFb && <div className={`nd-skip-fb${skipDir === "f" ? " nd-skip-fwd" : " nd-skip-bwd"}`}>{skipDir === "f" ? "+10s" : "-10s"}</div>}

              {/* Play/pause indicator */}
              <div className={`nd-pp-ind${ppInd ? " nd-pp-show" : ""}`}>{ppIcon === "play" ? "▶" : "⏸"}</div>

              {/* Thumbnail or video */}
              {!showVid ? (
                <div className="nd-thumb" onClick={handlePlay}>
                  <img src={thumbUrl || "https://placehold.co/1280x720/080808/7f1d1d?text=Narra"} alt={video.title} className={ended ? "nd-thumb-img nd-dimmed" : "nd-thumb-img"} />
                  <div className="nd-play-ring">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30"><polygon points="5,3 19,12 5,21"/></svg>
                  </div>
                  {/* Episode title badge - ONLY on thumbnail preview, NOT during playback */}
                  {isSeries && episode && (
                    <div className="nd-ep-badge">
                      <span className="nd-ep-code">S{season?.seasonNumber} · E{episode.episodeNumber}</span>
                      <span className="nd-ep-name">{episode.title}</span>
                    </div>
                  )}
                </div>
              ) : (
                <video ref={videoRef} src={vidUrl} />
              )}

              {/* Controls - only show when video is playing */}
              {showVid && (
                <div className={`nd-ctrl${showCtrl ? " nd-ctrl-show" : ""}`}>
                  {/* Progress */}
                  <div className="nd-prog-wrap" onClick={e => e.stopPropagation()}>
                    <input
                      type="range"
                      className="nd-prog"
                      min="0"
                      max={dur || 100}
                      value={prog}
                      style={{ "--pct": pct }}
                      onChange={e => { const v = parseFloat(e.target.value); if (videoRef.current) videoRef.current.currentTime = v; setProg(v); }}
                    />
                  </div>
                  {/* Buttons */}
                  <div className="nd-ctrl-row">
                    <div className="nd-ctrl-l">
                      <button className="nd-ctrl-btn" onClick={e => { e.stopPropagation(); skip(-10); }} title="-10s">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                        <span className="nd-ctrl-lbl">10</span>
                      </button>
                      <button className="nd-ctrl-btn nd-ctrl-play" onClick={e => { e.stopPropagation(); togglePlay(); }}>
                        {playing
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          : <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5,3 19,12 5,21"/></svg>
                        }
                      </button>
                      <button className="nd-ctrl-btn" onClick={e => { e.stopPropagation(); skip(10); }} title="+10s">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.51"/></svg>
                        <span className="nd-ctrl-lbl">10</span>
                      </button>
                      <div className="nd-vol-wrap" onMouseEnter={() => setVolSlider(true)} onMouseLeave={() => setVolSlider(false)}>
                        <button className="nd-ctrl-btn" onClick={e => { e.stopPropagation(); toggleMute(); }}>
                          {muted || vol === 0
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                          }
                        </button>
                        <input
                          type="range"
                          className={`nd-vol-sl${volSlider ? " nd-vol-show" : ""}`}
                          min="0" max="1" step="0.05" value={vol}
                          onChange={e => { const v = parseFloat(e.target.value); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = false; } setVol(v); setMuted(false); }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <span className="nd-time">{fmtTime(prog)} / {fmtTime(dur)}</span>
                    </div>
                    <div className="nd-ctrl-r">
                      <button className="nd-ctrl-btn" onClick={e => { e.stopPropagation(); toggleFs(); }}>
                        {fs
                          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase overlay */}
              {isPaid && showVid && (
                <div className="nd-purchase-overlay">
                  <div className="nd-po-box">
                    <div className="nd-po-label">Preview ended</div>
                    <h3>Unlock Full {isSeries ? "Series" : "Film"}</h3>
                    <button className="nd-po-btn" onClick={handlePurchase} disabled={purchasing}>
                      {purchasing ? "Processing..." : `Purchase — $${video.price}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Episodes panel - HORIZONTAL CAROUSEL below player (NO DOTS) */}
          {isSeries && (
            <EpisodesPanel 
              video={video}
              season={season}
              setSeason={setSeason}
              episode={episode}
              setEpisode={setEpisode}
              episodes={episodes}
              setEpisodes={setEpisodes}
              access={access}
            />
          )}

          {/* ── Video info ── */}
          <div className="nd-info">
            <h1 className="nd-title">{video.title}</h1>

            <div className="nd-meta-bar">
              <div className="nd-meta-l">
                <span>{fmt(video.views)} views</span>
                <span className="nd-dot">·</span>
                <span>{ago(video.uploadedAt)}</span>
                {video.ageRating && <span className="nd-age-chip" style={{ borderColor: ac, color: ac }}>{video.ageRating}</span>}
              </div>
              <div className="nd-actions">
                <button className={`nd-action${liked ? " nd-action-on" : ""}`} onClick={handleLike} disabled={ldLoading}>
                  <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  {fmt(likeCt)}
                </button>
                <button className={`nd-action${disliked ? " nd-action-dim" : ""}`} onClick={handleDislike} disabled={ldLoading}>
                  <svg viewBox="0 0 24 24" fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                  {fmt(dislikeCt)}
                </button>
                <button className="nd-action" onClick={() => setShareOpen(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                <button className={`nd-action${saved ? " nd-action-saved" : ""}`} onClick={() => { if (!token) { navigate("/login"); return; } setSaveOpen(true); }}>
                  <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            {/* Creator */}
            <div className="nd-creator">
              <div className="nd-cr-av-wrap" onClick={() => video.creator?._id && navigate(`/profile/${video.creator._id}`)}>
                <img src={avatarUrl(video.creator?.avatar, displayName(video.creator))} alt="" className="nd-cr-av" />
              </div>
              <div className="nd-cr-info">
                <div className="nd-cr-name-row">
                  <span className="nd-cr-name" onClick={() => video.creator?._id && navigate(`/profile/${video.creator._id}`)}>{displayName(video.creator)}</span>
                  {video.creator?.isVerified && <span className="nd-cr-v">V</span>}
                  {followSt.isTwin && <span className="nd-cr-twin">TWINS</span>}
                </div>
                <span className="nd-cr-sub">{fmt(crStats.followers)} followers</span>
              </div>
              <div className="nd-cr-btns">
                {!isOwn && token && (
                  <button className={`nd-follow${followSt.isFollowing ? " nd-following" : ""}${followSt.isTwin ? " nd-twin" : ""}`} onClick={handleFollow} disabled={followSt.loading}>
                    {followSt.loading ? "..." : followSt.isTwin ? "TWINS" : followSt.isFollowing ? "FOLLOWING" : "FOLLOW"}
                  </button>
                )}
                {!token && <button className="nd-follow" onClick={() => navigate("/login")}>FOLLOW</button>}
                <button className="nd-msg" onClick={() => navigate(`/messages?user=${video.creator?._id}`)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="nd-desc-card">
              {video.genre?.length > 0 && (
                <div className="nd-genres">{video.genre.map((g, i) => <span key={i} className="nd-genre">{g}</span>)}</div>
              )}
              <p className={`nd-desc-text${fullDesc ? "" : " nd-desc-clamp"}`}>
                {video.description || "No description provided."}
              </p>
              {(video.description?.length || 0) > 200 && (
                <button className="nd-desc-more" onClick={() => setFullDesc(v => !v)}>{fullDesc ? "Show less" : "Show more"}</button>
              )}
            </div>

            {/* Comments */}
            <Comments
              videoId={id}
              token={token}
              user={user}
              hasAccess={access}
              isPaid={video.isPaid}
              onPurchase={handlePurchase}
              addNote={addNotification}
              videoCreatorId={video.creator?._id}
            />
          </div>
        </div>

        {/* ── Right sidebar: ads + recommendations ── */}
        <div className="nd-right">
          <AdPlaceholder />
          <div className="nd-recs">
            <h3 className="nd-recs-title">Up Next</h3>
            {recs.length > 0
              ? recs.map(r => <RecCard key={r._id} video={r} onClick={vid => { navigate(`/video/${vid}`); window.scrollTo({ top: 0 }); }} />)
              : <p className="nd-recs-empty">Nothing to show right now</p>
            }
          </div>
        </div>

      </div>
    </div>
  );
}