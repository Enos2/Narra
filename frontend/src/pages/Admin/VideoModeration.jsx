/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/exhaustive-deps */
// File: frontend/src/pages/admin/VideoModeration.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import AdminVideoDeleteModal from '../../components/AdminVideoDeleteModal';
import NarraVideoPlayer from '../../components/NarraVideoPlayer';
import {
  getVideosForModeration,
  restrictVideo, removeVideoRestriction,
  flagVideo, removeVideoFlag,
  shadowBanVideo, removeShadowBanVideo,
  getVideoModerationStats,
  adminSoftDeleteVideo, adminRestoreVideo, adminPermanentDeleteVideo
} from '../../requests';
import './VideoModeration.css';

function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="vm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="vmsg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13"/>
        <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
      </radialGradient></defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#vmsg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite"/>
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4+(i%4)}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>
        </line>
      ))}
      {[110,200,310,440].map((r,i)=>(
        <rect key={i} x={720-r*0.707} y={450-r*0.707} width={r*1.414} height={r*1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18+i*5}s`} repeatCount="indefinite"/>
        </rect>
      ))}
    </svg>
  );
}
function PlatformBg() {
  const traces = ["M0,180 H280 V130 H560 V180 H860 V90 H1440","M0,380 H180 V330 H480 V430 H780 V380 H1440","M0,580 H380 V530 H680 V630 H980 V580 H1440","M220,0 V180 H310 V490 H260 V900","M620,0 V140 H710 V390 H660 V900","M1080,0 V290 H1030 V590 H1130 V900"];
  const nodes = [[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630]];
  return (
    <svg className="vm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="vmpbg" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5"/>
      </pattern></defs>
      <rect width="1440" height="900" fill="url(#vmpbg)"/>
      {traces.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3+i*0.7}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
      </path>))}
      {nodes.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
        <animate attributeName="r" values="4;9;4" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
      </circle>))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9"><animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440"/></circle>
    </svg>
  );
}
function SupportBg() {
  const vines = ["M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30","M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0","M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95","M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0","M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40"];
  const leaves = [[130,440],[365,490],[715,545],[1055,470],[1340,515],[200,30],[350,0],[695,95]];
  return (
    <svg className="vm-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="vmsbg" cx="50%" cy="100%" r="60%">
        <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08"/>
        <stop offset="100%" stopColor="#22ff00" stopOpacity="0"/>
      </radialGradient></defs>
      <rect width="1440" height="900" fill="url(#vmsbg)"/>
      {vines.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#22ff00" strokeOpacity="0.065" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
      </path>))}
      {leaves.map(([x,y],i)=>(<ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22ff00" fillOpacity="0.14">
        <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3+i*0.6}s`} begin={`${i*0.45}s`} repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14+i*2}s`} repeatCount="indefinite"/>
      </ellipse>))}
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9"><animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/></circle>
    </svg>
  );
}

const VideoModeration = () => {
  const { user, token } = useAppContext();
  const navigate = useNavigate();

  const [mode, setMode] = useState('movie');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [stats, setStats] = useState({ approved:0, restricted:0, flagged:0, shadowBanned:0, removed:0, released:0, total:0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeSeason, setActiveSeason] = useState(0);
  const [activeEpisode, setActiveEpisode] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingVideoId, setPendingVideoId] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerSrc, setPlayerSrc] = useState('');
  const [playerPoster, setPlayerPoster] = useState('');
  const [playerTitle, setPlayerTitle] = useState('');

  const baseUrl = 'http://localhost:5000';
  const currentRole = user?.role || 'superadmin';

  const getUploaderName = (v) => {
    const check = (u) => {
      if (!u || typeof u !== 'object') return null;
      if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
      if (u.firstName) return u.firstName;
      if (u.name && u.name !== 'undefined undefined') return u.name;
      if (u.username) return u.username;
      if (u.email) return u.email.split('@')[0];
      return null;
    };
    return check(v.uploadedBy) || check(v.creator) || check(v.user) || 'Unknown';
  };
  const getUserId = (v) => {
    const u = v.uploadedBy || v.creator || v.user;
    return (u && typeof u === 'object') ? (u._id || u.id) : null;
  };
  const getRating = (v) => { const r = v.averageRating || v.rating || v.score || v.ratings?.average; return r > 0 ? parseFloat(r).toFixed(1) : '0.0'; };
  const getReleaseYear = (v) => { if (v.releaseYear && v.releaseYear !== 0) return v.releaseYear; if (v.year && v.year !== 0) return v.year; if (v.uploadedAt) return new Date(v.uploadedAt).getFullYear(); return 'N/A'; };
  const getImageUrl = (p) => { if (!p) return null; if (p.startsWith('http')) return p; return `${baseUrl}${p}`; };
  const getVideoUrl = (p) => { if (!p) return null; if (p.startsWith('http')) return p; return `${baseUrl}${p}`; };
  const totalEps = (v) => v?.seasons?.reduce((a,s) => a + (s.episodes?.length||0), 0) || 0;
  const statusClass = (s) => ({ approved:'vm-st-approved', released:'vm-st-released', restricted:'vm-st-restricted', flagged:'vm-st-flagged', shadowBanned:'vm-st-shadow', removed:'vm-st-removed' }[s] || '');

  const openPlayer = (src, title, poster='') => {
    setPlayerSrc(src ? getVideoUrl(src) : '');
    setPlayerTitle(title);
    setPlayerPoster(poster ? getImageUrl(poster) : '');
    setPlayerOpen(true);
  };

  useEffect(() => {
    if (!user || !['superadmin','platformadmin','supportadmin'].includes(user.role)) navigate('/login');
  }, [user]);

  useEffect(() => { if (token) loadData(); }, [token, mode]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { setShowDeleteModal(false); setShowReasonModal(false); setPlayerOpen(false); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const sr = await getVideoModerationStats(token);
      if (sr.success) {
        const s = sr.statistics || {};
        setStats({ approved: s.byStatus?.approved||s.approved||0, restricted: s.byStatus?.restricted||s.restricted||0, flagged: s.byStatus?.flagged||s.flagged||0, shadowBanned: s.byStatus?.shadowBanned||s.shadowBanned||0, removed: s.byStatus?.removed||s.removed||0, released: s.byStatus?.released||s.released||0, total: s.byStatus?.total||s.total||0 });
      }
      const r = await getVideosForModeration(token, 'all');
      if (r.success) {
        setVideos((r.videos||[]).filter(v => ['approved','released','restricted','flagged','shadowBanned','removed'].includes(v.status) && v.type === mode));
      } else setError(r.message || 'Failed to load videos');
    } catch (e) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const filtered = videos.filter(v => {
    const ms = filterStatus === 'all' || v.status === filterStatus;
    const mq = !searchTerm || v.title?.toLowerCase().includes(searchTerm.toLowerCase()) || getUploaderName(v).toLowerCase().includes(searchTerm.toLowerCase());
    return ms && mq;
  });

  const openDetail = (video) => { setSelectedVideo(video); setDetailOpen(true); setActiveSeason(0); setActiveEpisode(null); };
  const closeDetail = () => { setDetailOpen(false); setTimeout(() => setSelectedVideo(null), 350); };

  const promptReason = (action, id) => { setPendingAction(action); setPendingVideoId(id); setReasonText(''); setReasonError(''); setShowReasonModal(true); };

  const execWithReason = async () => {
    if (!reasonText.trim()) { setReasonError('Please provide a reason'); return; }
    setShowReasonModal(false); setActionLoading(pendingVideoId);
    try {
      let res;
      if (pendingAction === 'flag') res = await flagVideo(token, pendingVideoId, reasonText);
      else if (pendingAction === 'restrict') res = await restrictVideo(token, pendingVideoId, reasonText);
      else if (pendingAction === 'shadowBan') res = await shadowBanVideo(token, pendingVideoId, reasonText, [], []);
      if (res?.success) { setSuccess('Action completed'); await loadData(); }
      else setError(res?.message || 'Failed');
    } catch (e) { setError(e.message||'Failed'); }
    finally { setActionLoading(null); setPendingAction(null); setPendingVideoId(null); }
  };

  const execDirect = async (action, id) => {
    setActionLoading(id);
    try {
      let res;
      if (action==='removeFlag') res = await removeVideoFlag(token, id);
      else if (action==='removeRestriction') res = await removeVideoRestriction(token, id);
      else if (action==='removeShadowBan') res = await removeShadowBanVideo(token, id);
      else if (action==='restore') res = await adminRestoreVideo(token, id);
      if (res?.success) { setSuccess('Action completed'); await loadData(); }
      else setError(res?.message||'Failed');
    } catch (e) { setError(e.message||'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleAction = (action, id) => ['flag','restrict','shadowBan'].includes(action) ? promptReason(action,id) : execDirect(action,id);

  const handleSoftDelete = async (video, reason='') => {
    setActionLoading(video._id);
    try {
      const r = await adminSoftDeleteVideo(token, video._id, reason);
      if (r?.success) { setSuccess(`"${video.title}" moved to trash`); await loadData(); closeDetail(); setShowDeleteModal(false); setVideoToDelete(null); }
      else setError(r?.message||'Failed');
    } catch(e){setError(e.message||'Failed');}finally{setActionLoading(null);}
  };

  const handlePermDelete = async (video, reason='') => {
    setActionLoading(video._id);
    try {
      const r = await adminPermanentDeleteVideo(token, video._id, reason);
      if (r?.success) { setSuccess(`"${video.title}" permanently deleted`); await loadData(); closeDetail(); setShowDeleteModal(false); setVideoToDelete(null); }
      else setError(r?.message||'Failed');
    } catch(e){setError(e.message||'Failed');}finally{setActionLoading(null);}
  };

  const handleRestore = async (id) => {
    setActionLoading(id);
    try { const r = await adminRestoreVideo(token, id); if (r?.success){setSuccess('Restored');await loadData();}else setError(r?.message||'Failed'); }
    catch(e){setError(e.message||'Failed');}finally{setActionLoading(null);}
  };

  const handleDeleteConfirm = (type, reason) => {
    if (!videoToDelete) return;
    if (type==='soft') handleSoftDelete(videoToDelete, reason);
    else handlePermDelete(videoToDelete, reason);
  };

  if (loading) return (
    <div className={`vm-page vm-role-${currentRole}`}>
      <div className="vm-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
      <div className="vm-grain"/>
      <div className="vm-loading"><div className="vm-ring"/><p>Loading moderation queue&hellip;</p></div>
    </div>
  );

  const curSeason = selectedVideo?.seasons?.[activeSeason];

  return (
    <div className={`vm-page vm-role-${currentRole} ${detailOpen?'vm-has-detail':''}`}>
      <div className="vm-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
      <div className="vm-grain"/>

      {/* Portals */}
      {showDeleteModal && videoToDelete && createPortal(
        <AdminVideoDeleteModal video={videoToDelete} user={user}
          onClose={()=>{setShowDeleteModal(false);setVideoToDelete(null);}}
          onConfirm={handleDeleteConfirm} actionLoading={actionLoading===videoToDelete._id}/>, document.body)}

      {playerOpen && createPortal(
        <div className="vm-player-bd" onClick={()=>setPlayerOpen(false)}>
          <div className="vm-player-shell" onClick={e=>e.stopPropagation()}>
            <NarraVideoPlayer src={playerSrc} poster={playerPoster} title={playerTitle} role={currentRole} onClose={()=>setPlayerOpen(false)}/>
          </div>
        </div>, document.body)}

      {showReasonModal && createPortal(
        <div className="vm-overlay" onClick={()=>setShowReasonModal(false)}>
          <div className="vm-reason-box" onClick={e=>e.stopPropagation()}>
            <div className="vm-reason-box__top"/>
            <div className="vm-reason-box__hd">
              <h3>{pendingAction==='flag'&&'Flag Video'}{pendingAction==='restrict'&&'Restrict Video'}{pendingAction==='shadowBan'&&'Shadow Ban Video'}</h3>
              <button onClick={()=>setShowReasonModal(false)}>&#215;</button>
            </div>
            <div className="vm-reason-box__bd">
              <p>{pendingAction==='flag'&&'Reason for flagging:'}{pendingAction==='restrict'&&'Reason for restriction:'}{pendingAction==='shadowBan'&&'Reason for shadow ban:'}</p>
              <textarea className="vm-reason-ta" value={reasonText} onChange={e=>{setReasonText(e.target.value);setReasonError('');}} placeholder="Enter reason..." rows={4} autoFocus/>
              {reasonError && <span className="vm-reason-err">{reasonError}</span>}
              <div className="vm-reason-box__ft">
                <button className="vm-btn vm-btn--ghost" onClick={()=>setShowReasonModal(false)}>Cancel</button>
                <button className="vm-btn vm-btn--accent" onClick={execWithReason}>Confirm</button>
              </div>
            </div>
          </div>
        </div>, document.body)}

      {/* Page shell */}
      <div className="vm-shell">
        {/* Header */}
        <header className="vm-hdr">
          <div className="vm-hdr__bar"/>
          <h1 className="vm-headline">Video Moderation</h1>
          <p className="vm-sub">Live content review and enforcement</p>
          <div className="vm-hdr__bar"/>
        </header>

        {/* Alerts */}
        {error && <div className="vm-alert vm-alert--err"><span>Error</span><span className="vm-alert__msg">{error}</span><button onClick={()=>setError(null)}>&#215;</button></div>}
        {success && <div className="vm-alert vm-alert--ok"><span>Done</span><span className="vm-alert__msg">{success}</span><button onClick={()=>setSuccess(null)}>&#215;</button></div>}

        {/* Stats */}
        <div className="vm-statsrow">
          {[{k:'approved',l:'Approved',v:stats.approved},{k:'released',l:'Released',v:stats.released},{k:'flagged',l:'Flagged',v:stats.flagged},{k:'restricted',l:'Restricted',v:stats.restricted},{k:'shadow',l:'Shadow Ban',v:stats.shadowBanned},{k:'removed',l:'Removed',v:stats.removed},{k:'total',l:'Total',v:stats.total}].map(({k,l,v})=>(
            <div key={k} className="vm-spill">
              <span className={`vm-spill__n vm-sn-${k}`}>{v||0}</span>
              <span className="vm-spill__l">{l}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="vm-ctrl">
          <div className="vm-typeswitch">
            <button className={`vm-tybtn ${mode==='movie'?'vm-tybtn--on':''}`} onClick={()=>setMode('movie')}>Films</button>
            <button className={`vm-tybtn ${mode==='series'?'vm-tybtn--on':''}`} onClick={()=>setMode('series')}>Series</button>
          </div>
          <input className="vm-srch" type="text" placeholder="Search title or creator..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
          <select className="vm-sel" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="released">Released</option>
            <option value="flagged">Flagged</option>
            <option value="restricted">Restricted</option>
            <option value="shadowBanned">Shadow Banned</option>
            <option value="removed">Removed</option>
          </select>
          <button className="vm-rfsh" onClick={loadData}>Refresh</button>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="vm-empty">
            <div className="vm-empty__ring"/>
            <h3>No {mode==='movie'?'films':'series'} found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          <div className="vm-grid">
            {filtered.map((video, idx) => {
              const thumb = imageErrors[video._id] ? null : getImageUrl(video.thumbnailUrl);
              const active = selectedVideo?._id === video._id && detailOpen;
              return (
                <div key={video._id} className={`vm-card ${active?'vm-card--active':''}`}
                  style={{animationDelay:`${idx*0.045}s`}}
                  onClick={()=>active?closeDetail():openDetail(video)}>
                  <div className="vm-card__poster">
                    {thumb ? <img src={thumb} alt={video.title} onError={()=>setImageErrors(p=>({...p,[video._id]:true}))}/> : <div className="vm-card__fall"><span>{video.type==='series'?'SRS':'MOV'}</span></div>}
                    <div className="vm-card__gloss"/>
                    <span className={`vm-chip vm-chip--st ${statusClass(video.status)}`}>{video.status}</span>
                    {video.type==='series'&&<span className="vm-chip vm-chip--eps">{totalEps(video)} eps</span>}
                    {video.ageRating&&<span className="vm-chip vm-chip--age">{video.ageRating}</span>}
                  </div>
                  <div className="vm-card__bd">
                    <h3 className="vm-card__title">{video.title||'Untitled'}</h3>
                    <p className="vm-card__creator">
                      {getUserId(video)
                        ? <Link to={`/admin/users/${getUserId(video)}`} className="vm-clink" onClick={e=>e.stopPropagation()}>{getUploaderName(video)}</Link>
                        : getUploaderName(video)}
                    </p>
                    <div className="vm-card__meta">
                      <span>{getReleaseYear(video)}</span><span className="vm-dot"/><span>{(video.views||0).toLocaleString()} views</span><span className="vm-dot"/><span>{getRating(video)}/10</span>
                    </div>
                    {video.genre?.length>0&&<div className="vm-card__tags">{video.genre.slice(0,3).map((g,i)=><span key={i} className="vm-gtag">{g}</span>)}</div>}
                  </div>
                  <div className="vm-card__foot">
                    <span className="vm-card__cta">{active?'Close':'Review'}</span>
                    <span className={`vm-card__arr ${active?'vm-card__arr--open':''}`}>&#8594;</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-in Detail Panel */}
      <aside className={`vm-panel ${detailOpen?'vm-panel--open':''}`}>
        {selectedVideo && (<>
          <div className="vm-panel__topbar"/>
          <div className="vm-panel__hd">
            <div>
              <h2 className="vm-panel__title">{selectedVideo.title}</h2>
              <p className="vm-panel__sub">{selectedVideo.type==='movie'?'Film':'Series'} &middot; {getReleaseYear(selectedVideo)}</p>
            </div>
            <button className="vm-panel__close" onClick={closeDetail}>&#215;</button>
          </div>

          <div className="vm-panel__scroll">
            {/* Hero */}
            <div className="vm-panel__hero">
              <div className="vm-panel__thumb">
                {getImageUrl(selectedVideo.thumbnailUrl)
                  ? <img src={getImageUrl(selectedVideo.thumbnailUrl)} alt={selectedVideo.title}/>
                  : <div className="vm-panel__thumb-fall">{selectedVideo.type==='series'?'SRS':'MOV'}</div>}
              </div>
              <div className="vm-panel__info">
                <span className={`vm-chip vm-chip--st ${statusClass(selectedVideo.status)}`}>{selectedVideo.status}</span>
                {[
                  ['Creator', getUserId(selectedVideo) ? <Link to={`/admin/users/${getUserId(selectedVideo)}`} className="vm-clink">{getUploaderName(selectedVideo)}</Link> : getUploaderName(selectedVideo)],
                  ['Rating', `${getRating(selectedVideo)} / 10`],
                  ['Views', (selectedVideo.views||0).toLocaleString()],
                  ['Year', getReleaseYear(selectedVideo)],
                  ...(selectedVideo.ageRating ? [['Age', selectedVideo.ageRating]] : []),
                ].map(([label, val], i) => (
                  <div key={i} className="vm-panel__row"><span className="vm-panel__row-l">{label}</span><span className="vm-panel__row-v">{val}</span></div>
                ))}
                {selectedVideo.genre?.length>0&&(
                  <div className="vm-panel__row"><span className="vm-panel__row-l">Genres</span><div className="vm-panel__tags">{selectedVideo.genre.map((g,i)=><span key={i} className="vm-gtag">{g}</span>)}</div></div>
                )}
              </div>
            </div>

            {/* Description */}
            {selectedVideo.description&&(
              <div className="vm-panel__sec">
                <h4>Description</h4>
                <p className="vm-panel__desc">{selectedVideo.description}</p>
              </div>
            )}

            {/* MOVIE previews */}
            {selectedVideo.type==='movie'&&(
              <div className="vm-panel__sec">
                <h4>Preview Content</h4>
                <div className="vm-prevrow">
                  {selectedVideo.thumbnailUrl&&<button className="vm-pbtn" onClick={()=>openPlayer('',selectedVideo.title,selectedVideo.thumbnailUrl)}>Poster</button>}
                  {selectedVideo.trailerUrl&&<button className="vm-pbtn" onClick={()=>openPlayer(selectedVideo.trailerUrl,`Trailer — ${selectedVideo.title}`,selectedVideo.thumbnailUrl)}>Trailer</button>}
                  {selectedVideo.videoUrl&&<button className="vm-pbtn vm-pbtn--main" onClick={()=>openPlayer(selectedVideo.videoUrl,selectedVideo.title,selectedVideo.thumbnailUrl)}>Watch Film</button>}
                </div>
              </div>
            )}

            {/* SERIES episodes */}
            {selectedVideo.type==='series'&&selectedVideo.seasons?.length>0&&(
              <div className="vm-panel__sec">
                <h4>Episodes — Season by Season</h4>
                <div className="vm-seas-tabs">
                  {selectedVideo.seasons.map((s,si)=>(
                    <button key={si} className={`vm-seas-btn ${activeSeason===si?'vm-seas-btn--on':''}`}
                      onClick={()=>{setActiveSeason(si);setActiveEpisode(null);}}>
                      S{s.seasonNumber||si+1}
                      {s.title&&<span className="vm-seas-sub">{s.title}</span>}
                    </button>
                  ))}
                </div>

                {curSeason&&(
                  <div className="vm-ep-list">
                    <p className="vm-ep-list__head">{curSeason.episodes?.length||0} episode{curSeason.episodes?.length!==1?'s':''} in Season {curSeason.seasonNumber||activeSeason+1}</p>
                    {curSeason.episodes?.map((ep,ei)=>{
                      const isOpen = activeEpisode===ei;
                      return (
                        <div key={ei} className={`vm-ep ${isOpen?'vm-ep--open':''}`}>
                          <button className="vm-ep__tog" onClick={()=>setActiveEpisode(isOpen?null:ei)}>
                            <div className="vm-ep__left">
                              <span className="vm-ep__num">E{ep.episodeNumber||ei+1}</span>
                              <div className="vm-ep__info">
                                <span className="vm-ep__name">{ep.title||`Episode ${ei+1}`}</span>
                                {ep.duration&&<span className="vm-ep__dur">{ep.duration}m</span>}
                              </div>
                            </div>
                            <span className={`vm-chev ${isOpen?'vm-chev--up':''}`}/>
                          </button>
                          {isOpen&&(
                            <div className="vm-ep__body">
                              {ep.description&&<p className="vm-ep__desc">{ep.description}</p>}
                              <div className="vm-ep__prevrow">
                                {ep.trailerUrl&&<button className="vm-pbtn" onClick={()=>openPlayer(ep.trailerUrl,`S${activeSeason+1}E${ei+1} Trailer`,selectedVideo.thumbnailUrl)}>Trailer</button>}
                                {ep.videoUrl&&<button className="vm-pbtn vm-pbtn--main" onClick={()=>openPlayer(ep.videoUrl,`S${activeSeason+1}E${ei+1} — ${ep.title}`,ep.thumbnailUrl||selectedVideo.thumbnailUrl)}>Watch Episode</button>}
                                {!ep.trailerUrl&&!ep.videoUrl&&<p className="vm-ep__none">No video files attached</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Moderation Actions */}
            <div className="vm-panel__sec">
              <h4>Moderation Actions</h4>
              <div className="vm-acts">
                {selectedVideo.status!=='flagged'
                  ? <button className="vm-act vm-act--flag" onClick={()=>handleAction('flag',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Flag</span><span className="vm-act__h">Mark for review — reason required</span></button>
                  : <button className="vm-act vm-act--undo" onClick={()=>handleAction('removeFlag',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Remove Flag</span><span className="vm-act__h">Clear flag status</span></button>}

                {selectedVideo.status!=='restricted'
                  ? <button className="vm-act vm-act--restrict" onClick={()=>handleAction('restrict',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Restrict</span><span className="vm-act__h">Limit visibility — reason required</span></button>
                  : <button className="vm-act vm-act--undo" onClick={()=>handleAction('removeRestriction',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Lift Restriction</span><span className="vm-act__h">Restore normal access</span></button>}

                {selectedVideo.status!=='shadowBanned'
                  ? <button className="vm-act vm-act--shadow" onClick={()=>handleAction('shadowBan',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Shadow Ban</span><span className="vm-act__h">Hide from feeds — reason required</span></button>
                  : <button className="vm-act vm-act--undo" onClick={()=>handleAction('removeShadowBan',selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Remove Shadow Ban</span><span className="vm-act__h">Restore feed visibility</span></button>}

                {selectedVideo.status!=='removed'
                  ? <button className="vm-act vm-act--trash" onClick={()=>{setVideoToDelete(selectedVideo);setShowDeleteModal(true);}} disabled={!!actionLoading}><span className="vm-act__n">Move to Trash</span><span className="vm-act__h">Soft delete — restorable</span></button>
                  : <button className="vm-act vm-act--restore" onClick={()=>handleRestore(selectedVideo._id)} disabled={!!actionLoading}><span className="vm-act__n">Restore</span><span className="vm-act__h">Recover from trash</span></button>}

                {user?.role==='superadmin'&&selectedVideo.status==='removed'&&(
                  <button className="vm-act vm-act--perm" onClick={()=>{setVideoToDelete(selectedVideo);setShowDeleteModal(true);}} disabled={!!actionLoading}><span className="vm-act__n">Permanent Delete</span><span className="vm-act__h">Cannot be undone — superadmin only</span></button>
                )}
              </div>
              {actionLoading===selectedVideo._id&&(
                <div className="vm-proc"><div className="vm-ring vm-ring--sm"/>Processing&hellip;</div>
              )}
            </div>
          </div>
        </>)}
      </aside>

      {detailOpen&&<div className="vm-panel-bd" onClick={closeDetail}/>}
    </div>
  );
};
export default VideoModeration;