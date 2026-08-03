/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
// File: frontend/src/pages/admin/AdminVideoApprovals.jsx
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AppContext";
import {
  getVideosForModeration, approveVideo, rejectVideo,
  adminSoftDeleteVideo, adminRestoreVideo, adminPermanentDeleteVideo
} from "../../requests";
import AdminVideoDeleteModal from "../../components/AdminVideoDeleteModal";
import NarraVideoPlayer from "../../components/NarraVideoPlayer";
import "./AdminVideoApprovals.css";

const MOVIE_TYPES = ["Drama","Romance","Comedy","Thriller","Horror","Action","Sci-Fi","Fantasy","Crime","Mystery","Adventure","Documentary","Animation"];
const AGE_RATINGS = ["G","PG","13+","16+","18+"];

const ROLE_LABELS = {
  superadmin:    "Super Admin",
  platformadmin: "Platform Admin",
  supportadmin:  "Support Admin",
};

const AdminVideoApprovals = () => {
  const { user, token } = useAuth();
  const role = user?.role || "superadmin";

  const [movies, setMovies]                     = useState([]);
  const [series, setSeries]                     = useState([]);
  const [filteredMovies, setFilteredMovies]     = useState([]);
  const [filteredSeries, setFilteredSeries]     = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [actionLoading, setActionLoading]       = useState(null);
  const [error, setError]                       = useState("");
  const [rejectingVideo, setRejectingVideo]     = useState(null);
  const [rejectionReason, setRejectionReason]   = useState("");
  const [searchQuery, setSearchQuery]           = useState("");
  const [activeTab, setActiveTab]               = useState("movies");
  const [statusFilter, setStatusFilter]         = useState("pending");
  const [imageErrors, setImageErrors]           = useState({});
  const [expandedSeries, setExpandedSeries]     = useState(null);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [videoToDelete, setVideoToDelete]       = useState(null);
  const [approvingVideo, setApprovingVideo]     = useState(null);
  const [approvalData, setApprovalData]         = useState({ genre:[], ageRating:"" });
  const [playerOpen, setPlayerOpen]             = useState(false);
  const [playerSrc, setPlayerSrc]               = useState("");
  const [playerPoster, setPlayerPoster]         = useState("");
  const [playerTitle, setPlayerTitle]           = useState("");

  const baseUrl = "http://localhost:5000";

  const getUploaderName = (v) => {
    const s = v.uploadedBy || v.creator || {};
    return (typeof s==="object" && (s.name||s.username||(s.email?s.email.split("@")[0]:null))) || "Unknown";
  };
  const getImageUrl = (p) => {
    if (!p) return "/default-thumbnail.jpg";
    if (p.startsWith("http")) return p;
    return `${baseUrl}${p.startsWith("/")?p:"/"+p}`;
  };
  const getVideoUrl = (p) => {
    if (!p) return null;
    if (p.startsWith("http")) return p;
    return `${baseUrl}${p.startsWith("/")?p:"/"+p}`;
  };

  const openPlayer = (src, title, poster="") => {
    setPlayerSrc(src ? getVideoUrl(src) : "");
    setPlayerTitle(title);
    setPlayerPoster(poster ? getImageUrl(poster) : "");
    setPlayerOpen(true);
  };

  // Fetch
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true); setError("");
      if (!token) { setError("Authentication required."); setLoading(false); return; }
      const r = await getVideosForModeration(token, statusFilter);
      if (r.success) {
        const v = r.videos||[];
        const m=v.filter(x=>x.type==="movie"), s=v.filter(x=>x.type==="series");
        setMovies(m); setSeries(s); setFilteredMovies(m); setFilteredSeries(s);
      } else setError(r.message||"Failed to load");
    } catch { setError("Failed to load videos."); }
    finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { if (token) fetchVideos(); else { setError("No token"); setLoading(false); } }, [token, fetchVideos]);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    const f = list => !q ? list : list.filter(v=>
      v.title?.toLowerCase().includes(q)||getUploaderName(v).toLowerCase().includes(q)||v.tags?.some(t=>t.toLowerCase().includes(q))
    );
    setFilteredMovies(f(movies)); setFilteredSeries(f(series));
  }, [searchQuery, movies, series]);

  const rem = (id, type) => {
    if (type==="movie") { setMovies(p=>p.filter(v=>v._id!==id)); setFilteredMovies(p=>p.filter(v=>v._id!==id)); }
    else                { setSeries(p=>p.filter(v=>v._id!==id)); setFilteredSeries(p=>p.filter(v=>v._id!==id)); }
  };

  const openApproveModal = v => { setApprovingVideo(v); setApprovalData({genre:v.genre||[],ageRating:v.ageRating||""}); };
  const toggleGenre = g => setApprovalData(p=>({...p,genre:p.genre.includes(g)?p.genre.filter(x=>x!==g):[...p.genre,g]}));

  const handleApproveWithClassification = async () => {
    if (!approvingVideo) return;
    if (!approvalData.ageRating) { alert("Please select an age rating"); return; }
    if (!approvalData.genre.length) { alert("Please select at least one genre"); return; }
    setActionLoading(approvingVideo._id);
    try {
      await fetch(`${baseUrl}/api/admin/videos/${approvingVideo._id}/classify`,{
        method:"PUT", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({ageRating:approvalData.ageRating,genre:approvalData.genre})
      });
      await approveVideo(token, approvingVideo._id);
      rem(approvingVideo._id, approvingVideo.type);
      setApprovingVideo(null); setApprovalData({genre:[],ageRating:""});
    } catch(e) { alert(e.message||"Failed"); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectingVideo||!rejectionReason.trim()) { alert("Provide a reason"); return; }
    setActionLoading(rejectingVideo._id);
    try { await rejectVideo(token,rejectingVideo._id,rejectionReason.trim()); rem(rejectingVideo._id,rejectingVideo.type); setRejectingVideo(null); setRejectionReason(""); }
    catch(e) { alert(e.message||"Failed"); }
    finally { setActionLoading(null); }
  };

  const handleSoftDelete = async (v, reason="") => {
    setActionLoading(v._id);
    try { const r=await adminSoftDeleteVideo(token,v._id,reason); if(r.success) rem(v._id,v.type); else alert(r.message||"Failed"); }
    catch(e) { alert(e.message||"Failed"); }
    finally { setActionLoading(null); setShowDeleteModal(false); setVideoToDelete(null); }
  };

  const handlePermDelete = async (v, reason="") => {
    setActionLoading(v._id);
    try { const r=await adminPermanentDeleteVideo(token,v._id,reason); if(r.success) rem(v._id,v.type); else alert(r.message||"Failed"); }
    catch(e) { alert(e.message||"Failed"); }
    finally { setActionLoading(null); setShowDeleteModal(false); setVideoToDelete(null); }
  };

  const handleRestore = async (v) => {
    setActionLoading(v._id);
    try { const r=await adminRestoreVideo(token,v._id); if(r.success){rem(v._id,v.type);await fetchVideos();}else alert(r.message||"Failed"); }
    catch(e) { alert(e.message||"Failed"); }
    finally { setActionLoading(null); }
  };

  const handleDeleteConfirm = (t,r) => videoToDelete && (t==="soft"?handleSoftDelete(videoToDelete,r):handlePermDelete(videoToDelete,r));

  const handleImageError = id => setImageErrors(p=>({...p,[id]:true}));
  const toggleExpand = id => setExpandedSeries(p=>p===id?null:id);
  const getCount = s => [...movies,...series].filter(v=>v.status===s).length;
  const isSuperAdmin = user?.role==="superadmin";
  const currentList = activeTab==="movies" ? filteredMovies : filteredSeries;

  const renderEpisodes = (sv) => {
    if (!sv.seasons?.length) return <p className="vap-no-eps">No seasons found</p>;
    return (
      <div className="vap-eps-tree">
        {sv.seasons.map((season,si)=>(
          <div key={si} className="vap-season-node">
            <div className="vap-season-label">
              Season {season.seasonNumber||si+1}
              {season.title && <span className="vap-season-sub"> — {season.title}</span>}
            </div>
            <div className="vap-eps-list">
              {season.episodes?.map((ep,ei)=>(
                <div key={ei} className="vap-ep-row">
                  <span className="vap-ep-num">E{ep.episodeNumber||ei+1}</span>
                  <span className="vap-ep-title">{ep.title}</span>
                  <div className="vap-ep-btns">
                    {ep.videoUrl && <button className="vap-ep-btn" onClick={()=>openPlayer(ep.videoUrl,`${sv.title} · S${si+1}E${ei+1} · ${ep.title}`,sv.thumbnailUrl)}>Watch</button>}
                    {ep.trailerUrl && <button className="vap-ep-btn vap-ep-btn--outline" onClick={()=>openPlayer(ep.trailerUrl,`Trailer · ${ep.title}`,sv.thumbnailUrl)}>Trailer</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className={`vap-loading vap-role-${role}`}>
      <div className="vap-loading__ring"/>
      <p>Loading content&hellip;</p>
    </div>
  );

  return (
    <div className={`vap-page vap-role-${role}`}>

      {/* Animated SVG background */}
      <div className="vap-bg" aria-hidden="true">
        {role==="superadmin"    && <SuperBg/>}
        {role==="platformadmin" && <PlatformBg/>}
        {role==="supportadmin"  && <SupportBg/>}
      </div>

      {/* Grain */}
      <div className="vap-grain" aria-hidden="true"/>

      {/* Modals */}
      {showDeleteModal && videoToDelete && (
        <AdminVideoDeleteModal video={videoToDelete} user={user}
          onClose={()=>{setShowDeleteModal(false);setVideoToDelete(null);}}
          onConfirm={handleDeleteConfirm} actionLoading={actionLoading===videoToDelete._id}/>
      )}

      {/* Header */}
      <header className="vap-header">
        <div className="vap-header__line"/>
        <h1 className="vap-headline">Video Moderation</h1>
        <p className="vap-sub">Review · Classify · Manage uploaded content</p>
        <div className="vap-header__line"/>
      </header>

      {/* Stats */}
      <div className="vap-stats">
        {[{k:"pending",l:"Pending"},{k:"approved",l:"Approved"},{k:"rejected",l:"Rejected"},{k:"removed",l:"Removed"}].map(({k,l})=>(
          <div key={k} className={`vap-stat vap-stat--${k}`}>
            <span className="vap-stat__num">{getCount(k)}</span>
            <span className="vap-stat__label">{l}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="vap-tabs">
        <button className={`vap-tab ${activeTab==="movies"?"vap-tab--active":""}`} onClick={()=>setActiveTab("movies")}>
          Films <span className="vap-tab-count">{movies.length}</span>
        </button>
        <button className={`vap-tab ${activeTab==="series"?"vap-tab--active":""}`} onClick={()=>setActiveTab("series")}>
          Series <span className="vap-tab-count">{series.length}</span>
        </button>
      </div>

      {/* Controls */}
      <div className="vap-controls">
        <input className="vap-search" type="text" placeholder={`Search ${activeTab}…`}
          value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
        <div className="vap-filters">
          {["pending","approved","rejected","removed"].map(s=>(
            <button key={s} className={`vap-filter-btn ${statusFilter===s?"vap-filter-btn--active":""}`}
              onClick={()=>setStatusFilter(s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="vap-error"><p>{error}</p><button onClick={fetchVideos} className="vap-retry">Retry</button></div>}

      {/* Grid */}
      {currentList.length===0 ? (
        <div className="vap-empty">
          <div className="vap-empty__icon"/>
          <h3>No {activeTab} found</h3>
          <p>Nothing matches your current filters</p>
        </div>
      ) : (
        <div className="vap-grid">
          {currentList.map((video,idx)=>{
            const thumb = imageErrors[video._id] ? "/default-thumbnail.jpg" : getImageUrl(video.thumbnailUrl);
            const expanded = expandedSeries===video._id;
            const totalEps = video.type==="series" ? video.seasons?.reduce((a,s)=>a+(s.episodes?.length||0),0)||0 : null;

            return (
              <article key={video._id} className="vap-card" style={{animationDelay:`${idx*0.04}s`}}>

                {/* Poster */}
                <div className="vap-card__poster">
                  <img src={thumb} alt={video.title} className="vap-card__img" onError={()=>handleImageError(video._id)}/>
                  <div className="vap-card__poster-overlay">
                    {video.trailerUrl && (
                      <button className="vap-play-btn" onClick={()=>openPlayer(video.trailerUrl,`Trailer · ${video.title}`,video.thumbnailUrl)}>Trailer</button>
                    )}
                    {video.type==="movie" && video.videoUrl && (
                      <button className="vap-play-btn vap-play-btn--main" onClick={()=>openPlayer(video.videoUrl,video.title,video.thumbnailUrl)}>Watch Film</button>
                    )}
                    {video.type==="series" && (
                      <button className="vap-play-btn vap-play-btn--series" onClick={()=>toggleExpand(video._id)}>View Episodes</button>
                    )}
                  </div>
                  <span className={`vap-badge vap-badge--status vap-badge--${video.status}`}>{video.status}</span>
                  <span className="vap-badge vap-badge--type">{video.type==="movie"?"Film":"Series"}</span>
                  {video.ageRating && <span className="vap-badge vap-badge--age">{video.ageRating}</span>}
                </div>

                {/* Body */}
                <div className="vap-card__body">
                  <h2 className="vap-card__title">{video.title}</h2>
                  <div className="vap-card__meta">
                    <span className="vap-meta-chip">{getUploaderName(video)}</span>
                    <span className="vap-meta-dot"/>
                    <span className="vap-meta-chip">
                      {new Date(video.uploadedAt||video.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                    </span>
                    {totalEps!==null && <><span className="vap-meta-dot"/><span className="vap-meta-chip">{totalEps} ep{totalEps!==1?"s":""}</span></>}
                  </div>
                  {video.genre?.length>0 && (
                    <div className="vap-genres">{video.genre.slice(0,4).map((g,i)=><span key={i} className="vap-genre-tag">{g}</span>)}</div>
                  )}
                  <ExpandableDesc text={video.description}/>
                  {video.rejectionReason && video.status==="rejected" && (
                    <div className="vap-rejection-note"><strong>Rejection reason:</strong> {video.rejectionReason}</div>
                  )}
                  {video.type==="series" && video.seasons?.length>0 && (
                    <div className="vap-accordion">
                      <button className="vap-accordion__toggle" onClick={()=>toggleExpand(video._id)}>
                        <span>{expanded?"Hide Episodes":"View Episodes"}</span>
                        <span className={`vap-chevron ${expanded?"vap-chevron--open":""}`}/>
                      </button>
                      {expanded && <div className="vap-accordion__body">{renderEpisodes(video)}</div>}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="vap-card__footer">
                  <div className="vap-btn-row">
                    <button className="vap-btn vap-btn--ghost" onClick={()=>openPlayer("",video.title,video.thumbnailUrl)}>Poster</button>
                    {video.trailerUrl && <button className="vap-btn vap-btn--ghost" onClick={()=>openPlayer(video.trailerUrl,`Trailer · ${video.title}`,video.thumbnailUrl)}>Trailer</button>}
                    {video.type==="movie" && video.videoUrl && <button className="vap-btn vap-btn--ghost" onClick={()=>openPlayer(video.videoUrl,video.title,video.thumbnailUrl)}>Watch</button>}
                  </div>
                  {video.status==="pending" && (
                    <div className="vap-btn-row">
                      <button className="vap-btn vap-btn--approve" onClick={()=>openApproveModal(video)} disabled={actionLoading===video._id}>{actionLoading===video._id?"…":"Approve"}</button>
                      <button className="vap-btn vap-btn--reject"  onClick={()=>setRejectingVideo(video)} disabled={actionLoading===video._id}>Reject</button>
                    </div>
                  )}
                  {(video.status==="approved"||video.status==="rejected"||video.status==="removed") && (
                    <div className="vap-btn-row">
                      {video.status==="removed"
                        ? <button className="vap-btn vap-btn--restore" onClick={()=>handleRestore(video)} disabled={actionLoading===video._id}>Restore</button>
                        : <button className="vap-btn vap-btn--delete"  onClick={()=>{setVideoToDelete(video);setShowDeleteModal(true);}} disabled={actionLoading===video._id}>Move to Trash</button>
                      }
                      {isSuperAdmin && video.status!=="removed" && (
                        <button className="vap-btn vap-btn--perm" onClick={()=>handlePermDelete(video)} disabled={actionLoading===video._id}>Delete Permanently</button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Approve modal — PORTALED, role-themed ── */}
      {approvingVideo && createPortal(
        <div className={`vap-modal-backdrop vap-modal-backdrop--${role}`} onClick={() => setApprovingVideo(null)}>
          <div className={`vap-modal vap-modal--${role}`} onClick={e => e.stopPropagation()}>

            <div className="vap-modal__header">
              <div className="vap-modal__header-row">
                <div className="vap-modal__title-group">
                  <span className="vap-modal__title">Classify &amp; Approve</span>
                  <span className="vap-modal__role-badge">{ROLE_LABELS[role] || role}</span>
                </div>
                <button className="vap-modal__close" onClick={() => setApprovingVideo(null)}>✕ Close</button>
              </div>
            </div>

            <div className="vap-modal__body">
              <p className="vap-modal__video-name">{approvingVideo.title}</p>
              <p className="vap-modal__creator">uploaded by {getUploaderName(approvingVideo)}</p>

              <div className="vap-modal__divider"/>

              <div className="vap-form-group">
                <label className="vap-form-label">Age Rating</label>
                <div className="vap-option-grid">
                  {AGE_RATINGS.map(r=>(
                    <button key={r} type="button"
                      className={`vap-option-btn ${approvalData.ageRating===r?"vap-option-btn--active":""}`}
                      onClick={()=>setApprovalData(p=>({...p,ageRating:r}))}>{r}</button>
                  ))}
                </div>
              </div>

              <div className="vap-form-group">
                <label className="vap-form-label">Genre — select at least one</label>
                <div className="vap-option-grid vap-option-grid--genres">
                  {MOVIE_TYPES.map(g=>(
                    <button key={g} type="button"
                      className={`vap-option-btn ${approvalData.genre.includes(g)?"vap-option-btn--active":""}`}
                      onClick={()=>toggleGenre(g)}>{g}</button>
                  ))}
                </div>
                <small className="vap-form-hint">{approvalData.genre.length} genre{approvalData.genre.length!==1?"s":""} selected</small>
              </div>
            </div>

            <div className="vap-modal__footer">
              <button className="vap-btn vap-btn--ghost" onClick={()=>setApprovingVideo(null)}>Cancel</button>
              <button className="vap-btn vap-btn--approve" onClick={handleApproveWithClassification}
                disabled={!approvalData.ageRating||!approvalData.genre.length||actionLoading===approvingVideo._id}>
                {actionLoading===approvingVideo._id?"Processing…":"Confirm Approval"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── Reject modal — PORTALED, role-themed ── */}
      {rejectingVideo && createPortal(
        <div className={`vap-modal-backdrop vap-modal-backdrop--${role}`} onClick={() => setRejectingVideo(null)}>
          <div className={`vap-modal vap-modal--${role}`} onClick={e => e.stopPropagation()}>

            <div className="vap-modal__header">
              <div className="vap-modal__header-row">
                <div className="vap-modal__title-group">
                  <span className="vap-modal__title">Reject Content</span>
                  <span className="vap-modal__role-badge">{ROLE_LABELS[role] || role}</span>
                </div>
                <button className="vap-modal__close" onClick={() => setRejectingVideo(null)}>✕ Close</button>
              </div>
            </div>

            <div className="vap-modal__body">
              <p className="vap-modal__video-name">{rejectingVideo.title}</p>
              <p className="vap-modal__creator">uploaded by {getUploaderName(rejectingVideo)}</p>

              <div className="vap-modal__divider"/>

              <div className="vap-form-group">
                <label className="vap-form-label">Reason for rejection <span className="vap-required">*</span></label>
                <textarea className="vap-textarea" rows={5} placeholder="Provide a clear reason visible to the uploader…"
                  value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)}/>
              </div>
            </div>

            <div className="vap-modal__footer">
              <button className="vap-btn vap-btn--ghost" onClick={()=>setRejectingVideo(null)}>Cancel</button>
              <button className="vap-btn vap-btn--reject" onClick={handleReject}
                disabled={!rejectionReason.trim()||actionLoading===rejectingVideo._id}>
                {actionLoading===rejectingVideo._id?"Processing…":"Confirm Rejection"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Player modal - PORTALED to body */}
      {playerOpen && createPortal(
        <div className="vap-player-backdrop" onClick={() => setPlayerOpen(false)}>
          <div className="vap-player-shell" onClick={e => e.stopPropagation()}>
            <NarraVideoPlayer src={playerSrc} poster={playerPoster} title={playerTitle} role={role} onClose={() => setPlayerOpen(false)}/>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ── Inline expandable description ─────────────────────────────────────────────
const ExpandableDesc = ({ text }) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 120;
  return (
    <div className="vap-desc">
      <p className={`vap-desc__text ${!open&&long?"vap-desc__text--clamped":""}`}>{text}</p>
      {long && <button className="vap-desc__toggle" onClick={()=>setOpen(p=>!p)}>{open?"Show less":"Read more"}</button>}
    </div>
  );
};

// ── SUPER ADMIN background — radiating sovereign crown geometry ────────────────
function SuperBg() {
  const rays = Array.from({length:24},(_,i)=>{
    const a=(i*360/24)*Math.PI/180;
    return {x2:720+Math.cos(a)*950, y2:450+Math.sin(a)*950};
  });
  return (
    <svg className="vap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13"/>
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#sg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite"/>
      </ellipse>
      {rays.map(({x2,y2},i)=>(
        <line key={i} x1="720" y1="450" x2={x2} y2={y2}
          stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045"
            dur={`${4+(i%4)}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>
        </line>
      ))}
      {[110,200,310,440].map((r,i)=>(
        <rect key={i} x={720-r*0.707} y={450-r*0.707} width={r*1.414} height={r*1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07"
            dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate"
            from="45 720 450" to="90 720 450" dur={`${18+i*5}s`} repeatCount="indefinite"/>
        </rect>
      ))}
      {[[60,60],[1380,60],[60,840],[1380,840]].map(([x,y],i)=>(
        <g key={i}>
          <line x1={x-24} y1={y} x2={x+24} y2={y} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5"/>
          <line x1={x} y1={y-24} x2={x} y2={y+24} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5"/>
          <circle cx={x} cy={y} r="4" fill="#FFD700" fillOpacity="0.35">
            <animate attributeName="fill-opacity" values="0.35;0.8;0.35" dur="3s" begin={`${i*0.8}s`} repeatCount="indefinite"/>
          </circle>
        </g>
      ))}
    </svg>
  );
}

// ── PLATFORM ADMIN background — electric circuit traces ───────────────────────
function PlatformBg() {
  const traces=[
    "M0,180 H280 V130 H560 V180 H860 V90 H1440",
    "M0,380 H180 V330 H480 V430 H780 V380 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
    "M0,740 H90 V690 H380 V790 H680 V740 H1440",
    "M220,0 V180 H310 V490 H260 V900",
    "M620,0 V140 H710 V390 H660 V900",
    "M1080,0 V290 H1030 V590 H1130 V900",
  ];
  const nodes=[[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630],[380,690]];
  return (
    <svg className="vap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#pbg)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite"/>
      </rect>
      {traces.map((d,i)=>(
        <path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08"
            dur={`${3+i*0.7}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {nodes.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
          <animate attributeName="r" values="4;9;4" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
          <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440"/>
      </circle>
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,580 H380 V530 H680 V630 H980 V580 H1440"/>
      </circle>
    </svg>
  );
}

// ── SUPPORT ADMIN background — growing organic vine network ───────────────────
function SupportBg() {
  const vines=[
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves=[[130,440],[365,490],[715,545],[1055,470],[1340,515],[200,30],[350,0],[695,95],[1070,0],[1335,40]];
  return (
    <svg className="vap-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#22ff00" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#sbg)"/>
      {vines.map((d,i)=>(
        <path key={i} d={d} fill="none" stroke="#22ff00" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065"
            dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {leaves.map(([x,y],i)=>(
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5"
          fill="#22ff00" fillOpacity="0.14"
          transform={`rotate(${i*37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14"
            dur={`${3+i*0.6}s`} begin={`${i*0.45}s`} repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${x} ${y}`} to={`360 ${x} ${y}`}
            dur={`${14+i*2}s`} repeatCount="indefinite"/>
        </ellipse>
      ))}
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite"
          path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/>
      </circle>
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s"
          path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95"/>
      </circle>
    </svg>
  );
}

export default AdminVideoApprovals;