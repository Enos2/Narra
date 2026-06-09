/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
// File: frontend/src/pages/admin/AdminVideoDetails.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import NarraVideoPlayer from '../../components/NarraVideoPlayer';
import {
  getVideoById,
  getVideoComments,
  deleteComment,
  getUserPlaylists,
  addVideoToPlaylist,
  checkVideoSaved,
  likeComment,
  dislikeComment
} from '../../requests';
import {
  restrictVideo,
  removeVideoRestriction,
  flagVideo,
  removeVideoFlag,
  shadowBanVideo,
  removeShadowBanVideo,
  adminSoftDeleteVideo,
  adminRestoreVideo,
  adminPermanentDeleteVideo
} from '../../requests';
import './AdminVideoDetails.css';

// Role-themed SVG Backgrounds
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="avd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="avd-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#avd-sg1)">
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
      {[[60, 60], [1380, 60], [60, 840], [1380, 840]].map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 24} y1={y} x2={x + 24} y2={y} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5" />
          <line x1={x} y1={y - 24} x2={x} y2={y + 24} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5" />
          <circle cx={x} cy={y} r="4" fill="#FFD700" fillOpacity="0.35">
            <animate attributeName="fill-opacity" values="0.35;0.8;0.35" dur="3s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
          </circle>
        </g>
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
    "M220,0 V180 H310 V490 H260 V900",
    "M620,0 V140 H710 V390 H660 V900",
    "M1080,0 V290 H1030 V590 H1130 V900",
  ];
  const nodes = [[280, 130], [560, 180], [860, 90], [180, 330], [480, 430], [380, 530], [680, 630], [380, 690]];
  return (
    <svg className="avd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="avd-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#avd-pbg)">
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
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,580 H380 V530 H680 V630 H980 V580 H1440" />
      </circle>
    </svg>
  );
}

function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves = [[130, 440], [365, 490], [715, 545], [1055, 470], [1340, 515], [200, 30], [350, 0], [695, 95], [1070, 0], [1335, 40]];
  return (
    <svg className="avd-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="avd-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22ff00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#avd-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22ff00" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22ff00" fillOpacity="0.14" transform={`rotate(${i * 37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30" />
      </circle>
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s" path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95" />
      </circle>
    </svg>
  );
}

// Helper functions
const getFullUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return `${base}${url.startsWith('/') ? url : '/' + url}`;
};

const fmt = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
};

const ago = (date) => {
  if (!date) return 'just now';
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  for (const [u, v] of Object.entries({ year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 })) {
    const i = Math.floor(s / v);
    if (i >= 1) return `${i} ${u}${i === 1 ? '' : 's'} ago`;
  }
  return 'just now';
};

const fmtTime = (s) => {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const ageColor = (r) => ({ G: '#22c55e', PG: '#f59e0b', 'PG-13': '#f97316', '13+': '#f97316', '16+': '#ef4444', '18+': '#991b1b' }[r] || '#6b7280');

const displayName = (u) => {
  if (!u) return 'Anonymous';
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.username || u.name || 'User';
};

const avatarUrl = (av, name = 'User') => {
  if (av?.startsWith('http')) return av;
  if (av) return getFullUrl(av);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7f1d1d&color=fff&bold=true&size=40`;
};

// Playlist Modal
function PlaylistModal({ open, onClose, videoId, token, addNotification }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    getUserPlaylists(token).then(p => { setPlaylists(p || []); setLoading(false); }).catch(() => setLoading(false));
  }, [open, token]);

  const save = async (id) => {
    setSaving(true);
    try {
      await addVideoToPlaylist(token, videoId, id);
      addNotification({ type: 'success', message: 'Saved to playlist' });
      onClose();
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const createAndSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { createPlaylist } = await import('../../requests');
      const r = await createPlaylist(token, newName.trim());
      if (r.success && r.playlist) {
        await addVideoToPlaylist(token, videoId, r.playlist._id);
        addNotification({ type: 'success', message: `Saved to "${newName}"` });
        onClose();
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="avd-overlay" onClick={onClose}>
      <div className="avd-modal" onClick={e => e.stopPropagation()}>
        <div className="avd-modal-hd"><span>Save to List</span><button onClick={onClose}>×</button></div>
        <div className="avd-modal-bd">
          {loading ? <p className="avd-modal-loading">Loading...</p> : (
            <>
              <div className="avd-pl-list">
                {playlists.map(pl => (
                  <button key={pl._id} className="avd-pl-item" onClick={() => save(pl._id)} disabled={saving}>
                    <span>{pl.name}</span><span className="avd-pl-ct">{pl.videoCount || 0}</span>
                  </button>
                ))}
              </div>
              {!creating
                ? <button className="avd-pl-new" onClick={() => setCreating(true)}>+ New List</button>
                : (
                  <div className="avd-pl-create">
                    <input placeholder="List name" value={newName} onChange={e => setNewName(e.target.value)} maxLength={50} />
                    <div className="avd-pl-create-btns">
                      <button onClick={createAndSave} disabled={saving || !newName.trim()}>{saving ? 'Saving...' : 'Create & Save'}</button>
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

// Comment Node
function CommentNode({ comment, depth, videoCreatorId, currentUser, token, onDelete, onLike, onDislike, addNote }) {
  const name = displayName(comment.user);
  const av = avatarUrl(comment.user?.avatar, name);
  const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;
  const replyToName = comment.replyToUser ? displayName(comment.replyToUser) : null;
  const likes = comment.likeCount ?? comment.likes?.length ?? 0;
  const dislikes = comment.dislikeCount ?? comment.dislikes?.length ?? 0;
  const [open, setOpen] = useState(true);

  const isOwnComment = currentUser && comment.user?._id && currentUser._id === comment.user._id.toString();
  const isCreatorComment = videoCreatorId && comment.user?._id && videoCreatorId.toString() === comment.user._id.toString();

  const canDelete = !!token && (isOwnComment);
  const userId = comment.user?._id || comment.user?.id;

  return (
    <div className={`avd-cnode${depth > 0 ? ' avd-cnode-child' : ''}${isCreatorComment ? ' avd-cnode-creator' : ''}`}>
      <div className="avd-cnode-row">
        <img src={av} alt="" className={`avd-cnode-av${depth > 0 ? ' avd-cnode-av-sm' : ''}`} />
        <div className="avd-cnode-body">
          <div className="avd-cnode-head">
            <Link to={`/admin/users/${userId}`} className={`avd-cnode-name${isCreatorComment ? ' avd-cnode-name-creator' : ''}`}>
              {name}
            </Link>
            {isCreatorComment && <span className="avd-cnode-creator-badge">CREATOR</span>}
            {comment.user?.isVerified && (
              <span className="avd-cnode-verified-icon" title="Verified">
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </span>
            )}
            <span className="avd-cnode-ts">{ago(comment.createdAt)}</span>
            {comment.isEdited && <span className="avd-cnode-edited">edited</span>}
          </div>
          {replyToName && (
            <div className="avd-cnode-reply-to">
              replying to <strong>@{replyToName}</strong>
            </div>
          )}
          <p className="avd-cnode-text">{comment.content}</p>
          <div className="avd-cnode-acts">
            <button className="avd-cnode-act avd-cnode-act-like" onClick={() => onLike(comment._id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              {likes > 0 && <span>{fmt(likes)}</span>}
            </button>
            <button className="avd-cnode-act avd-cnode-act-dis" onClick={() => onDislike(comment._id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
              {dislikes > 0 && <span>{fmt(dislikes)}</span>}
            </button>
            {canDelete && (
              <button className="avd-cnode-act avd-cnode-act-del" onClick={() => onDelete(comment._id)}>
                Delete
              </button>
            )}
            {hasReplies && (
              <button className="avd-cnode-act avd-cnode-act-toggle" onClick={() => setOpen(v => !v)}>
                {open ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        </div>
      </div>
      {hasReplies && open && (
        <div className="avd-cnode-children">
          {comment.replies.map(r => (
            <CommentNode
              key={r._id}
              comment={r}
              depth={depth + 1}
              videoCreatorId={videoCreatorId}
              currentUser={currentUser}
              token={token}
              onDelete={onDelete}
              onLike={onLike}
              onDislike={onDislike}
              addNote={addNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Comments Section
function Comments({ videoId, token, user, addNote, videoCreatorId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');

  const load = useCallback(async () => {
    try {
      const d = await getVideoComments(videoId);
      setComments(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error('load comments:', e);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    try {
      await deleteComment(token, id);
      addNote({ type: 'success', message: 'Comment deleted' });
      await load();
    } catch (e) {
      addNote({ type: 'error', message: e.message || 'Failed to delete' });
    }
  };

  const like = async (id) => {
    if (!token) { addNote({ type: 'info', message: 'Sign in to like' }); return; }
    try {
      await likeComment(token, id);
      await load();
    } catch {}
  };

  const dislike = async (id) => {
    if (!token) { addNote({ type: 'info', message: 'Sign in to react' }); return; }
    try {
      await dislikeComment(token, id);
      await load();
    } catch {}
  };

  const sorted = [...comments].sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return (b.likes?.length || 0) - (a.likes?.length || 0);
  });

  return (
    <div className="avd-comments">
      <div className="avd-comments-header">
        <h3 className="avd-comments-title">
          Comments <span className="avd-comments-count">{comments.length}</span>
        </h3>
        {comments.length > 1 && (
          <select className="avd-comments-sort" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="top">Top</option>
          </select>
        )}
      </div>

      <div className="avd-comments-notice">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Admin view — you can delete comments but cannot post new ones</span>
      </div>

      <div className="avd-comments-list">
        {loading ? (
          <div className="avd-comments-skeleton">
            {[1, 2, 3].map(i => (
              <div key={i} className="avd-comments-skel-row">
                <div className="avd-comments-skel-av" />
                <div className="avd-comments-skel-lines">
                  <div className="avd-comments-skel-line" />
                  <div className="avd-comments-skel-line avd-short" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length > 0 ? (
          sorted.map(c => (
            <CommentNode
              key={c._id}
              comment={c}
              depth={0}
              videoCreatorId={videoCreatorId}
              currentUser={user}
              token={token}
              onDelete={del}
              onLike={like}
              onDislike={dislike}
              addNote={addNote}
            />
          ))
        ) : (
          <div className="avd-comments-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No comments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Episodes Carousel
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

  if (!video || video.type !== 'series') return null;

  const visibleEpisodes = episodes.slice(scrollIndex, scrollIndex + visibleCount);

  return (
    <div className="avd-eps-carousel">
      <div className="avd-eps-carousel-header">
        <div className="avd-eps-title-group">
          <span className="avd-eps-title">EPISODES</span>
          {season && <span className="avd-eps-season-badge">Season {season.seasonNumber}</span>}
        </div>
        {video.seasons?.length > 1 && (
          <select
            className="avd-season-sel"
            value={season?.seasonNumber || ''}
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

      <div className="avd-eps-carousel-container">
        {canScrollPrev && (
          <button className="avd-carousel-nav avd-carousel-prev" onClick={() => setScrollIndex(scrollIndex - 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        <div className="avd-eps-carousel-track">
          {visibleEpisodes.map(ep => {
            const selected = episode?._id === ep._id;
            const canWatch = access || ep.published;
            return (
              <div
                key={ep.episodeNumber}
                className={`avd-ep-carousel-item${selected ? ' avd-ep-sel' : ''}${!canWatch ? ' avd-ep-lock' : ''}`}
                onClick={() => canWatch && changeEpisode(ep)}
              >
                <div className="avd-ep-thumb">
                  <img
                    src={getFullUrl(ep.thumbnailUrl || video.thumbnailUrl) || 'https://placehold.co/160x90/0a0a0a/7f1d1d?text=Episode'}
                    alt={ep.title || `Episode ${ep.episodeNumber}`}
                  />
                  {!canWatch && (
                    <div className="avd-ep-lock-overlay">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                  )}
                  {ep.duration > 0 && <span className="avd-ep-duration">{fmtTime(ep.duration)}</span>}
                </div>
                <div className="avd-ep-info">
                  <span className="avd-ep-num">{ep.episodeNumber}</span>
                  <span className="avd-ep-title">{ep.title || `Episode ${ep.episodeNumber}`}</span>
                </div>
              </div>
            );
          })}
        </div>

        {canScrollNext && (
          <button className="avd-carousel-nav avd-carousel-next" onClick={() => setScrollIndex(scrollIndex + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function AdminVideoDetails() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user, token, addNotification } = useAppContext();

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [season, setSeason] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [playerSrc, setPlayerSrc] = useState(null);
  const [playerPoster, setPlayerPoster] = useState(null);
  const [playerTitle, setPlayerTitle] = useState('');
  const [playerOpen, setPlayerOpen] = useState(false);

  // Episode queue for auto-play
  const [episodeQueue, setEpisodeQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Moderation state
  const [actionLoading, setActionLoading] = useState(false);
  const [moderationMsg, setModerationMsg] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState('soft');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const currentRole = user?.role || 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  const canModerate = ['superadmin', 'platformadmin', 'supportadmin'].includes(user?.role);

  useEffect(() => {
    if (!user || !canModerate) {
      navigate('/admin-login');
    }
  }, [user, navigate, canModerate]);

  useEffect(() => {
    if (token && videoId) fetchVideo();
  }, [token, videoId]);

  useEffect(() => {
    if (video && token) loadSaved();
  }, [video, token]);

  // Build episode queue for auto-play - flattens all episodes from all seasons
  useEffect(() => {
    if (video?.type === 'series' && video.seasons?.length) {
      const allEpisodes = [];
      video.seasons.forEach(season => {
        if (season.episodes?.length) {
          season.episodes.forEach(ep => {
            allEpisodes.push({
              ...ep,
              seasonNumber: season.seasonNumber,
              seasonId: season._id
            });
          });
        }
      });
      setEpisodeQueue(allEpisodes);
      
      if (episode) {
        const idx = allEpisodes.findIndex(ep => ep._id === episode._id);
        setCurrentQueueIndex(idx >= 0 ? idx : 0);
      }
    }
  }, [video, episode]);

  const fetchVideo = async () => {
    setLoading(true);
    try {
      const data = await getVideoById(token, videoId);
      if (data) {
        setVideo(data);
        if (data.type === 'series' && data.seasons?.length > 0) {
          const s = data.seasons[0];
          setSeason(s);
          if (s.episodes?.length > 0) {
            setEpisode(s.episodes[0]);
            setEpisodes(s.episodes);
          }
        }
      } else {
        addNotification({ type: 'error', message: 'Video not found' });
        navigate('/admin/dashboard/videos');
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed to load video' });
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    try {
      const r = await checkVideoSaved(token, videoId);
      setSaved(r.saved || false);
    } catch {}
  };

  const openPlayer = (src, title, poster = '') => {
    setPlayerSrc(src ? getFullUrl(src) : null);
    setPlayerTitle(title);
    setPlayerPoster(poster ? getFullUrl(poster) : '');
    setPlayerOpen(true);
  };

  // Handle next episode auto-play
  const handleNextEpisode = useCallback(() => {
    if (episodeQueue.length > 0 && currentQueueIndex < episodeQueue.length - 1) {
      const nextEp = episodeQueue[currentQueueIndex + 1];
      
      // Find the season for this episode
      const nextSeason = video?.seasons?.find(s => s.seasonNumber === nextEp.seasonNumber);
      if (nextSeason) {
        setSeason(nextSeason);
        setEpisode(nextEp);
        setEpisodes(nextSeason.episodes || []);
        setCurrentQueueIndex(currentQueueIndex + 1);
        
        // Auto-update player with new episode
        const nextSrc = nextEp.videoUrl || nextEp.trailerUrl || video?.trailerUrl;
        const nextPoster = nextEp.thumbnailUrl || video?.thumbnailUrl;
        const nextTitle = `${video?.title} - Ep ${nextEp.episodeNumber}: ${nextEp.title || ''}`;
        
        setPlayerSrc(nextSrc ? getFullUrl(nextSrc) : null);
        setPlayerTitle(nextTitle);
        setPlayerPoster(nextPoster ? getFullUrl(nextPoster) : '');
      }
    }
  }, [episodeQueue, currentQueueIndex, video]);

  // Handle episode ended for tracking
  const handleEpisodeEnded = useCallback(() => {
    console.log('Episode ended:', episode?._id);
  }, [episode]);

  // Moderation Actions
  const promptReason = (action) => {
    setPendingAction(action);
    setReasonText('');
    setShowReasonModal(true);
  };

  const execWithReason = async () => {
    if (!reasonText.trim()) {
      addNotification({ type: 'error', message: 'Please provide a reason' });
      return;
    }
    setShowReasonModal(false);
    setActionLoading(true);
    try {
      let res;
      if (pendingAction === 'flag') res = await flagVideo(token, videoId, reasonText);
      else if (pendingAction === 'restrict') res = await restrictVideo(token, videoId, reasonText);
      else if (pendingAction === 'shadowBan') res = await shadowBanVideo(token, videoId, reasonText, [], []);
      if (res?.success) {
        setModerationMsg({ type: 'success', text: `Video ${pendingAction}ed successfully` });
        await fetchVideo();
        setTimeout(() => setModerationMsg(null), 3000);
      } else {
        addNotification({ type: 'error', message: res?.message || 'Failed' });
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const execDirect = async (action) => {
    setActionLoading(true);
    try {
      let res;
      if (action === 'removeFlag') res = await removeVideoFlag(token, videoId);
      else if (action === 'removeRestriction') res = await removeVideoRestriction(token, videoId);
      else if (action === 'removeShadowBan') res = await removeShadowBanVideo(token, videoId);
      else if (action === 'restore') res = await adminRestoreVideo(token, videoId);
      if (res?.success) {
        setModerationMsg({ type: 'success', text: `Action completed successfully` });
        await fetchVideo();
        setTimeout(() => setModerationMsg(null), 3000);
      } else {
        addNotification({ type: 'error', message: res?.message || 'Failed' });
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    setActionLoading(true);
    try {
      const r = await adminSoftDeleteVideo(token, videoId, 'Deleted by admin');
      if (r?.success) {
        setModerationMsg({ type: 'success', text: 'Video moved to trash' });
        setTimeout(() => navigate('/admin/dashboard/videos'), 1500);
      } else {
        addNotification({ type: 'error', message: r?.message || 'Failed' });
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handlePermDelete = async () => {
    setActionLoading(true);
    try {
      const r = await adminPermanentDeleteVideo(token, videoId, 'Permanently deleted by admin');
      if (r?.success) {
        setModerationMsg({ type: 'success', text: 'Video permanently deleted' });
        setTimeout(() => navigate('/admin/dashboard/videos'), 1500);
      } else {
        addNotification({ type: 'error', message: r?.message || 'Failed' });
      }
    } catch (e) {
      addNotification({ type: 'error', message: e.message || 'Failed' });
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const getVideoSource = () => {
    if (!video) return null;
    if (video.type === 'series' && episode) {
      return episode.videoUrl || episode.trailerUrl || video.trailerUrl;
    }
    return video.videoUrl || video.trailerUrl;
  };

  const getPoster = () => {
    if (!video) return null;
    if (video.type === 'series' && episode) {
      return episode.thumbnailUrl || video.thumbnailUrl;
    }
    return video.thumbnailUrl;
  };

  const ac = ageColor(video?.ageRating);

  if (loading) {
    return (
      <div className={`avd-page avd-role-${currentRole}`}>
        <div className="avd-bg">
          {currentRole === 'superadmin' && <SuperBg />}
          {currentRole === 'platformadmin' && <PlatformBg />}
          {currentRole === 'supportadmin' && <SupportBg />}
        </div>
        <div className="avd-grain" />
        <div className="avd-loading">
          <div className="avd-loading-spinner" />
          <p>Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className={`avd-page avd-role-${currentRole}`}>
        <div className="avd-bg">
          {currentRole === 'superadmin' && <SuperBg />}
          {currentRole === 'platformadmin' && <PlatformBg />}
          {currentRole === 'supportadmin' && <SupportBg />}
        </div>
        <div className="avd-grain" />
        <div className="avd-error">
          <h2>Video Not Found</h2>
          <Link to="/admin/dashboard/videos" className="avd-back-btn">Back to Videos</Link>
        </div>
      </div>
    );
  }

  const thumbUrl = getFullUrl(getPoster());
  const isSeries = video.type === 'series';

  return (
    <div className={`avd-page avd-role-${currentRole}`}>
      <div className="avd-bg">
        {currentRole === 'superadmin' && <SuperBg />}
        {currentRole === 'platformadmin' && <PlatformBg />}
        {currentRole === 'supportadmin' && <SupportBg />}
      </div>
      <div className="avd-grain" />

      <PlaylistModal open={saveOpen} onClose={() => setSaveOpen(false)} videoId={videoId} token={token} addNotification={addNotification} />

      {/* Reason Modal */}
      {showReasonModal && (
        <div className="avd-overlay" onClick={() => setShowReasonModal(false)}>
          <div className="avd-reason-box" onClick={e => e.stopPropagation()}>
            <div className="avd-reason-box__hd">
              <h3>{pendingAction === 'flag' && 'Flag Video'}{pendingAction === 'restrict' && 'Restrict Video'}{pendingAction === 'shadowBan' && 'Shadow Ban Video'}</h3>
              <button onClick={() => setShowReasonModal(false)}>×</button>
            </div>
            <div className="avd-reason-box__bd">
              <p>Reason for {pendingAction}:</p>
              <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} placeholder="Enter reason..." rows={4} autoFocus />
              <div className="avd-reason-box__ft">
                <button onClick={() => setShowReasonModal(false)}>Cancel</button>
                <button onClick={execWithReason}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="avd-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="avd-modal avd-modal-delete" onClick={e => e.stopPropagation()}>
            <div className="avd-modal-hd">
              <span>Delete Video</span>
              <button onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="avd-modal-bd">
              <p>{deleteType === 'soft' ? `Move "${video.title}" to trash? It can be restored later.` : `PERMANENTLY delete "${video.title}"? This cannot be undone!`}</p>
              {deleteType === 'permanent' && (
                <div className="avd-delete-warning">⚠️ This will permanently remove all video data from the database!</div>
              )}
              <div className="avd-modal-actions">
                <button className="avd-btn-danger" onClick={deleteType === 'soft' ? handleSoftDelete : handlePermDelete} disabled={actionLoading}>
                  {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="avd-layout">
        <div className="avd-main">
          {/* Moderation Message */}
          {moderationMsg && (
            <div className={`avd-mod-msg avd-mod-msg--${moderationMsg.type}`}>
              <span>{moderationMsg.text}</span>
              <button onClick={() => setModerationMsg(null)}>×</button>
            </div>
          )}

          {/* Video Player */}
          <div className="avd-player-wrapper">
            {playerOpen ? (
              <NarraVideoPlayer
                src={playerSrc}
                poster={playerPoster}
                title={playerTitle}
                role={currentRole}
                onClose={() => setPlayerOpen(false)}
                episodeQueue={episodeQueue}
                currentEpisodeIndex={currentQueueIndex}
                onNextEpisode={handleNextEpisode}
                onEpisodeEnded={handleEpisodeEnded}
              />
            ) : (
              <div className="avd-player-placeholder" onClick={() => openPlayer(getVideoSource(), video.title, getPoster())}>
                {thumbUrl ? (
                  <img src={thumbUrl} alt={video.title} />
                ) : (
                  <div className="avd-player-placeholder-fallback">
                    <span>{isSeries ? 'SRS' : 'MOV'}</span>
                  </div>
                )}
                {video.ageRating && (
                  <div className="avd-age-badge" style={{ borderColor: ac, color: ac }}>{video.ageRating}</div>
                )}
              </div>
            )}
          </div>

          {/* Episodes Carousel */}
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

          {/* Video Info */}
          <div className="avd-info">
            <h1 className="avd-title">{video.title}</h1>

            <div className="avd-meta-bar">
              <div className="avd-meta-left">
                <span>{fmt(video.views)} views</span>
                <span className="avd-dot">·</span>
                <span>{ago(video.uploadedAt)}</span>
                {video.ageRating && <span className="avd-age-chip" style={{ borderColor: ac, color: ac }}>{video.ageRating}</span>}
              </div>
              <div className="avd-actions">
                <button className={`avd-action ${saved ? 'avd-action-saved' : ''}`} onClick={() => { setSaveOpen(true); }}>
                  <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>

            {/* Creator Info */}
            <div className="avd-creator">
              <div className="avd-creator-avatar">
                <img src={avatarUrl(video.creator?.avatar, displayName(video.creator))} alt="" />
              </div>
              <div className="avd-creator-info">
                <Link to={`/admin/users/${video.creator?._id}`} className="avd-creator-name">
                  {displayName(video.creator)}
                </Link>
                {video.creator?.isVerified && (
                  <span className="avd-creator-verified-icon" title="Verified">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="avd-description">
              {video.genre?.length > 0 && (
                <div className="avd-genres">
                  {video.genre.map((g, i) => <span key={i} className="avd-genre">{g}</span>)}
                </div>
              )}
              <p className="avd-description-text">{video.description || 'No description provided.'}</p>
            </div>

            {/* Comments */}
            <Comments
              videoId={videoId}
              token={token}
              user={user}
              addNote={addNotification}
              videoCreatorId={video.creator?._id}
            />
          </div>
        </div>

        {/* Moderation Panel - Sticky Sidebar */}
        <div className="avd-sidebar">
          <div className="avd-mod-panel">
            <div className="avd-mod-panel__accent-line" />
            <div className="avd-mod-panel__header">
              <span className="avd-mod-panel__title">Moderation</span>
              <div className={`avd-mod-panel__status avd-mod-panel__status--${video.status}`}>
                {video.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>

            <div className="avd-mod-panel__actions">
              {video.status !== 'flagged' ? (
                <button className="avd-mod-action avd-mod-action--flag" onClick={() => promptReason('flag')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">🚩</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Flag Video</span>
                    <span className="avd-mod-action__desc">Mark for review — reason required</span>
                  </div>
                </button>
              ) : (
                <button className="avd-mod-action avd-mod-action--undo" onClick={() => execDirect('removeFlag')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">✓</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Remove Flag</span>
                    <span className="avd-mod-action__desc">Clear flag status</span>
                  </div>
                </button>
              )}

              {video.status !== 'restricted' ? (
                <button className="avd-mod-action avd-mod-action--restrict" onClick={() => promptReason('restrict')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">🔒</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Restrict</span>
                    <span className="avd-mod-action__desc">Limit visibility — reason required</span>
                  </div>
                </button>
              ) : (
                <button className="avd-mod-action avd-mod-action--undo" onClick={() => execDirect('removeRestriction')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">🔓</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Lift Restriction</span>
                    <span className="avd-mod-action__desc">Restore normal access</span>
                  </div>
                </button>
              )}

              {video.status !== 'shadowBanned' ? (
                <button className="avd-mod-action avd-mod-action--shadow" onClick={() => promptReason('shadowBan')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">👻</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Shadow Ban</span>
                    <span className="avd-mod-action__desc">Hide from feeds — reason required</span>
                  </div>
                </button>
              ) : (
                <button className="avd-mod-action avd-mod-action--undo" onClick={() => execDirect('removeShadowBan')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">👁️</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Remove Shadow Ban</span>
                    <span className="avd-mod-action__desc">Restore feed visibility</span>
                  </div>
                </button>
              )}

              {video.status !== 'removed' ? (
                <button className="avd-mod-action avd-mod-action--trash" onClick={() => { setDeleteType('soft'); setShowDeleteModal(true); }} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">🗑️</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Move to Trash</span>
                    <span className="avd-mod-action__desc">Soft delete — restorable</span>
                  </div>
                </button>
              ) : (
                <button className="avd-mod-action avd-mod-action--restore" onClick={() => execDirect('restore')} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">↩️</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Restore</span>
                    <span className="avd-mod-action__desc">Recover from trash</span>
                  </div>
                </button>
              )}

              {isSuperAdmin && (
                <button className="avd-mod-action avd-mod-action--perm" onClick={() => { setDeleteType('permanent'); setShowDeleteModal(true); }} disabled={actionLoading}>
                  <span className="avd-mod-action__icon">💀</span>
                  <div className="avd-mod-action__content">
                    <span className="avd-mod-action__label">Permanent Delete</span>
                    <span className="avd-mod-action__desc">Cannot be undone — superadmin only</span>
                  </div>
                </button>
              )}
            </div>

            {actionLoading && (
              <div className="avd-mod-panel__loading">
                <div className="avd-loading-spinner avd-loading-spinner--sm" />
                <span>Processing...</span>
              </div>
            )}

            {/* Navigation links - horizontal side by side */}
            <div className="avd-mod-panel__nav-links">
              <Link to="/admin/dashboard/videos" className="avd-nav-link">
                ← Back to Videos
              </Link>
              <button className="avd-nav-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                ↑ Back to Top
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}