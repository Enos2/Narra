/**
 * FILE: frontend/src/pages/Dashboard.jsx
 * Creator Studio Dashboard - Manage user videos
 * UPDATED: Removed permanent delete, added 30-day trash retention
 * FIXED: Closing tags for table rows
 */

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-case-declarations */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import VideoPreviewModal from "../components/VideoPreviewModal";
import ReleaseModal from "../components/ReleaseModal";
import "./Dashboard.css";

const MEDIA_BASE_URL = 'http://localhost:5000';

function Dashboard() {
  const { user, addNotification, getVideosByStatus, getApprovedForRelease, releaseVideo, loadingVideos, token } = useAppContext();
  const { theme } = useTheme();

  const accent      = theme.accent;
  const accentLight = theme.accentLight || theme.accent;
  const accentRgb   = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const [activeTab, setActiveTab] = useState("pending");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewType, setPreviewType] = useState('trailer');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingVideoId, setPendingVideoId] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [expandedSidebarDesc, setExpandedSidebarDesc] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [fetchError, setFetchError] = useState(null);

  const [videos, setVideos] = useState({ pending: [], approved: [], released: [], rejected: [] });
  const [loading, setLoading] = useState({ pending: false, approved: false, released: false, rejected: false });
  const [stats, setStats] = useState({ totalVideos: 0, totalViews: 0, totalEarnings: 0 });

  const sidebarRef = useRef(null);
  const baseUrl = "http://localhost:5000";

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${MEDIA_BASE_URL}${url}`;
    return url;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPreviewModal || showReleaseModal || showReasonModal) return;
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target) && !event.target.closest('.review-btn')) {
        setIsSidebarOpen(false); setSelectedVideo(null);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isSidebarOpen && !showPreviewModal && !showReleaseModal && !showReasonModal) {
        setIsSidebarOpen(false); setSelectedVideo(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
  }, [isSidebarOpen, showPreviewModal, showReleaseModal, showReasonModal]);

  const fetchVideosByStatus = useCallback(async (status) => {
    if (!user?._id && !user?.id) return;
    setLoading(prev => ({ ...prev, [status]: true }));
    setFetchError(null);
    try {
      let result;
      if (status === 'approved') result = await getApprovedForRelease();
      else result = await getVideosByStatus(status);
      if (result && result.success) setVideos(prev => ({ ...prev, [status]: result.videos || [] }));
      else setVideos(prev => ({ ...prev, [status]: [] }));
    } catch (err) {
      console.error(`Error fetching ${status} videos:`, err);
      setFetchError(`Failed to load ${status} videos`);
      setVideos(prev => ({ ...prev, [status]: [] }));
    } finally { setLoading(prev => ({ ...prev, [status]: false })); }
  }, [user?._id, user?.id, getVideosByStatus, getApprovedForRelease]);

  useEffect(() => {
    if (!user?._id && !user?.id) return;
    ['pending', 'approved', 'released', 'rejected'].forEach(status => fetchVideosByStatus(status));
  }, [user?._id, user?.id, fetchVideosByStatus]);

  useEffect(() => {
    const allVideos = [...videos.pending, ...videos.approved, ...videos.released, ...videos.rejected];
    setStats({ totalVideos: allVideos.length, totalViews: allVideos.reduce((sum, v) => sum + (v.views || 0), 0), totalEarnings: videos.released.reduce((sum, v) => sum + (v.earnings || 0), 0) });
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const currentVideos = videos[activeTab] || [];
    if (!searchQuery.trim()) return currentVideos;
    return currentVideos.filter(video => video.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [videos, activeTab, searchQuery]);

  const handlePreview = (video, type) => { setSelectedVideo(video); setPreviewType(type); setShowPreviewModal(true); };

  const handleRelease = async (releaseData) => {
    if (!selectedVideo || !token) return;
    setActionLoading(selectedVideo._id);
    try {
      const result = await releaseVideo(selectedVideo._id, releaseData.price, releaseData.currency, releaseData.releaseAllEpisodes);
      if (result?.success) {
        addNotification({ type: 'success', message: 'Video released successfully!' });
        setShowReleaseModal(false); setIsSidebarOpen(false);
        fetchVideosByStatus('approved'); fetchVideosByStatus('released');
      }
    } catch (err) { addNotification({ type: 'error', message: 'Failed to release video' }); }
    finally { setActionLoading(null); }
  };

  const handleSoftDelete = async (video) => {
    if (!token || !video) return;
    setActionLoading(video._id);
    try {
      const { softDeleteVideo } = await import('../requests');
      const result = await softDeleteVideo(token, video._id);
      if (result?.success) { 
        addNotification({ 
          type: 'success', 
          message: `"${video.title}" moved to trash. You can restore it within 30 days.` 
        }); 
        setIsSidebarOpen(false); 
        ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); 
      }
    } catch (err) { 
      addNotification({ type: 'error', message: 'Failed to delete video' }); 
    }
    finally { setActionLoading(null); }
  };

  const handleRestore = async (videoId) => {
    if (!token) return;
    setActionLoading(videoId);
    try {
      const { restoreVideo } = await import('../requests');
      const result = await restoreVideo(token, videoId);
      if (result?.success) { 
        addNotification({ type: 'success', message: 'Video restored successfully!' }); 
        setIsSidebarOpen(false); 
        ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); 
      }
    } catch (err) { 
      addNotification({ type: 'error', message: 'Failed to restore' }); 
    }
    finally { setActionLoading(null); }
  };

  const handleApprove = async (videoId) => {
    if (!token) return;
    setActionLoading(videoId);
    try {
      const { approveVideo } = await import('../requests');
      const result = await approveVideo(token, videoId);
      if (result?.success) { addNotification({ type: 'success', message: 'Video approved' }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); }
    } catch (err) { addNotification({ type: 'error', message: 'Failed to approve' }); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (video) => {
    if (!token || !video) return;
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading(video._id);
    try {
      const { rejectVideo } = await import('../requests');
      const result = await rejectVideo(token, video._id, reason);
      if (result?.success) { addNotification({ type: 'success', message: 'Video rejected' }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); }
    } catch (err) { addNotification({ type: 'error', message: 'Failed to reject' }); }
    finally { setActionLoading(null); }
  };

  const promptForReason = (action, video) => { setPendingAction(action); setPendingVideoId(video._id); setSelectedVideo(video); setReasonText(''); setReasonError(''); setShowReasonModal(true); };

  const executeActionWithReason = async () => {
    if (!reasonText.trim()) { setReasonError('Please provide a reason for this action'); return; }
    setShowReasonModal(false); setActionLoading(pendingVideoId);
    try {
      let result;
      switch(pendingAction) {
        case 'flag': const { flagVideo } = await import('../requests'); result = await flagVideo(token, pendingVideoId, reasonText); break;
        case 'restrict': const { restrictVideo } = await import('../requests'); result = await restrictVideo(token, pendingVideoId, reasonText); break;
        case 'shadowBan': const { shadowBanVideo } = await import('../requests'); result = await shadowBanVideo(token, pendingVideoId, reasonText, [], []); break;
        default: return;
      }
      if (result?.success) { addNotification({ type: 'success', message: `${pendingAction} action completed` }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); }
    } catch (err) { addNotification({ type: 'error', message: `Failed to ${pendingAction} video` }); }
    finally { setActionLoading(null); setPendingAction(null); setPendingVideoId(null); }
  };

  const handleFlag = (video) => promptForReason('flag', video);
  const handleRestrict = (video) => promptForReason('restrict', video);
  const handleShadowBan = (video) => promptForReason('shadowBan', video);

  const handleRemoveFlag = async (videoId) => { if (!token) return; setActionLoading(videoId); try { const { removeVideoFlag } = await import('../requests'); const result = await removeVideoFlag(token, videoId); if (result?.success) { addNotification({ type: 'success', message: 'Flag removed' }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); } } catch (err) { addNotification({ type: 'error', message: 'Failed to remove flag' }); } finally { setActionLoading(null); } };
  const handleRemoveRestriction = async (videoId) => { if (!token) return; setActionLoading(videoId); try { const { removeVideoRestriction } = await import('../requests'); const result = await removeVideoRestriction(token, videoId); if (result?.success) { addNotification({ type: 'success', message: 'Restriction removed' }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); } } catch (err) { addNotification({ type: 'error', message: 'Failed to remove restriction' }); } finally { setActionLoading(null); } };
  const handleRemoveShadowBan = async (videoId) => { if (!token) return; setActionLoading(videoId); try { const { removeShadowBanVideo } = await import('../requests'); const result = await removeShadowBanVideo(token, videoId); if (result?.success) { addNotification({ type: 'success', message: 'Shadow ban removed' }); setIsSidebarOpen(false); ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); } } catch (err) { addNotification({ type: 'error', message: 'Failed to remove shadow ban' }); } finally { setActionLoading(null); } };

  const handleRefresh = () => { ['pending', 'approved', 'released', 'rejected'].forEach(s => fetchVideosByStatus(s)); addNotification({ type: 'info', message: 'Dashboard refreshed' }); };
  const openSidebar = (video) => { setSelectedVideo(video); setExpandedSidebarDesc(false); setIsSidebarOpen(true); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSelectedVideo(null); setExpandedSidebarDesc(false); };

  const isAdmin = ['superadmin', 'platformadmin', 'supportadmin'].includes(user?.role);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const tabs = [
    { id: 'pending',  label: 'Pending',  count: videos.pending.length,  color: '#f59e0b' },
    { id: 'approved', label: 'Ready',    count: videos.approved.length, color: '#10b981' },
    { id: 'released', label: 'Released', count: videos.released.length, color: '#3b82f6' },
    { id: 'rejected', label: 'Rejected', count: videos.rejected.length, color: '#ef4444' }
  ];

  const isLoading = loading[activeTab] || loadingVideos;
  const isInTrash = (video) => video?.isDeleted || video?.status === 'removed';

  if (!user) return <div className="dash-page"><div className="dash-empty-state">Please login</div></div>;

  return (
    <div className={`dash-page ${isSidebarOpen ? 'dash-sidebar-open' : ''}`}>
      <div className="dash-claw-bg">
        <div className="dash-claw dash-claw-1"></div><div className="dash-claw dash-claw-2"></div>
        <div className="dash-claw dash-claw-3"></div><div className="dash-claw dash-claw-4"></div>
        <div className="dash-claw dash-claw-5"></div><div className="dash-claw dash-claw-6"></div>
        <div className="dash-claw dash-claw-7"></div><div className="dash-claw dash-claw-8"></div>
        <div className="dash-claw dash-claw-9"></div><div className="dash-claw dash-claw-10"></div>
        <div className="dash-claw dash-claw-11"></div><div className="dash-claw dash-claw-12"></div>
        <div className="dash-scar-diag dash-scar-d1"></div><div className="dash-scar-diag dash-scar-d2"></div>
        <div className="dash-scar-diag dash-scar-d3"></div><div className="dash-scar-diag dash-scar-d4"></div>
        <div className="dash-scratch-h dash-sh-1"></div><div className="dash-scratch-h dash-sh-2"></div>
        <div className="dash-scratch-h dash-sh-3"></div><div className="dash-scratch-h dash-sh-4"></div>
        <div className="dash-scratch-h dash-sh-5"></div>
        <div className="dash-scratch-v dash-sv-1"></div><div className="dash-scratch-v dash-sv-2"></div>
        <div className="dash-scratch-v dash-sv-3"></div><div className="dash-scratch-v dash-sv-4"></div>
        <div className="dash-triple dash-t1"><span></span><span></span><span></span></div>
        <div className="dash-triple dash-t2"><span></span><span></span><span></span></div>
        <div className="dash-triple dash-t3"><span></span><span></span><span></span></div>
        <div className="dash-triple dash-t4"><span></span><span></span><span></span></div>
        <div className="dash-scar-x dash-sx-1"></div><div className="dash-scar-x dash-sx-2"></div><div className="dash-scar-x dash-sx-3"></div>
      </div>

      <div className="dash-blood-top"></div>
      <div className="dash-blood-bottom"></div>

      <div className="dash-content">
        <header className="dash-header" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}>
          <h1 style={{ background: `linear-gradient(135deg, #fff, ${accentLight})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Creator Studio</h1>
          <p>Welcome back <span style={{ color: accentLight }}>{user.name || user.email}</span></p>
        </header>

        <section className="dash-stats">
          <div className="dash-stats-grid">
            {[{ label: 'Total Videos', value: stats.totalVideos }, { label: 'Total Views', value: stats.totalViews.toLocaleString() }, { label: 'Earnings', value: `$${stats.totalEarnings.toFixed(2)}` }].map((s, i) => (
              <div key={i} className="dash-stat-card" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}>
                <div className="dash-stat-info">
                  <h2 style={{ color: accentLight }}>{s.value}</h2>
                  <p>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="dash-toolbar">
          <div className="dash-search-wrap">
            <input type="text" placeholder="Search your videos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ borderColor: accent }} />
          </div>
          <button className="dash-refresh-btn" onClick={handleRefresh} style={{ borderColor: accent }}>⟳</button>
        </div>

        <div className="dash-tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`dash-tab ${activeTab === tab.id ? 'dash-tab-active' : ''}`}
              style={activeTab === tab.id ? { background: `linear-gradient(135deg, ${accent}, ${accentLight})` } : {}}
              onClick={() => setActiveTab(tab.id)}>
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="dash-tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="dash-collection-header">
          <h2 style={{ background: `linear-gradient(135deg, #fff, ${accentLight})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block' }}>Film Collection</h2>
          <p>Manage and review your video content</p>
        </div>

        <div className="dash-table-wrap">
          <div className="dash-table-box">
            {isLoading ? (
              <div className="dash-state-box">
                <div className="dash-spinner" style={{ borderTopColor: accent }}></div>
                <p>Loading videos...</p>
              </div>
            ) : fetchError ? (
              <div className="dash-state-box">
                <div className="dash-state-icon">⚠️</div>
                <h3>Error Loading Videos</h3>
                <p>{fetchError}</p>
                <button className="dash-retry-btn" style={{ borderColor: accent, color: accentLight }} onClick={handleRefresh}>Retry</button>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="dash-state-box">
                <div className="dash-state-icon">📹</div>
                <h3>{searchQuery ? 'No videos match your search' : `No ${activeTab} videos`}</h3>
                <p>{searchQuery ? 'Try different keywords' : 'Upload a video to get started'}</p>
              </div>
            ) : (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Thumbnail</th><th>Title</th><th>Type</th><th>Date</th>
                    <th>Genre</th><th>Price</th><th>Status</th><th>Views</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVideos.map(video => {
                    const thumbnailUrl = !imageErrors[video._id] ? getFullUrl(video.thumbnailUrl) : null;
                    return (
                      <tr key={video._id}>
                        <td data-label="Thumbnail">
                          <div className="dash-thumb" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}>
                            {thumbnailUrl ? <img src={thumbnailUrl} alt={video.title} onError={() => setImageErrors(prev => ({ ...prev, [video._id]: true }))} /> : <div className="dash-thumb-placeholder" style={{ color: accent }}>🎬</div>}
                            {video.duration > 0 && <span className="dash-duration" style={{ borderColor: accent, color: accentLight }}>{formatDuration(video.duration)}</span>}
                          </div>
                        </td>
                        <td data-label="Title"><div className="dash-video-title" style={{ color: video.type === 'movie' ? '#4ade80' : '#a78bfa' }}>{video.title}</div></td>
                        <td data-label="Type"><span className={`dash-type-badge ${video.type === 'series' ? 'dash-type-series' : 'dash-type-movie'}`}>{video.type === 'series' ? 'Series' : 'Movie'}</span></td>
                        <td data-label="Date"><span className="dash-date">{formatDate(video.createdAt || video.uploadedAt)}</span></td>
                        <td data-label="Genre">
                          {video.genre?.length > 0 ? (
                            <div className="dash-genres">
                              {video.genre.slice(0, 2).map((g, i) => <span key={i} className="dash-genre-tag" style={{ background: `rgba(${accentRgb}, 0.15)`, borderColor: `rgba(${accentRgb}, 0.3)`, color: accentLight }}>{g}</span>)}
                              {video.genre.length > 2 && <span className="dash-genre-tag dash-genre-more">+{video.genre.length - 2}</span>}
                            </div>
                          ) : <span className="dash-no-genre">—</span>}
                        </td>
                        <td data-label="Price">
                          {video.isPaid ? <div className="dash-price"><span className="dash-price-amt" style={{ color: accentLight }}>${video.price || 0}</span><span className="dash-price-cur">{video.currency || 'USD'}</span></div> : <span className="dash-free">Free</span>}
                        </td>
                        <td data-label="Status">
                          <span className="dash-status-badge" style={{ backgroundColor: `${tabs.find(t => t.id === activeTab)?.color}20`, color: tabs.find(t => t.id === activeTab)?.color, borderColor: `${tabs.find(t => t.id === activeTab)?.color}60` }}>
                            {tabs.find(t => t.id === activeTab)?.label}
                          </span>
                        </td>
                        <td data-label="Views"><span className="dash-views" style={{ color: accentLight }}>{video.views?.toLocaleString() || 0}</span></td>
                        <td data-label="Action">
                          <button className="dash-review-btn" style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }} onClick={() => openSidebar(video)}>Review</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {isSidebarOpen && <div className="dash-sidebar-overlay" onClick={closeSidebar}></div>}

      <div className={`dash-sidebar ${isSidebarOpen ? 'dash-sidebar-visible' : ''}`} ref={sidebarRef} style={{ borderLeft: `3px solid ${accent}` }}>
        {selectedVideo && (
          <>
            <div className="dash-sidebar-header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.4)` }}>
              <div className="dash-sidebar-title-wrap">
                <div className="dash-sidebar-title-accent" style={{ background: `linear-gradient(180deg, ${accentLight}, ${accent})` }}></div>
                <h2 style={{ background: `linear-gradient(135deg, #fff, ${accentLight})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Review {selectedVideo.type === 'series' ? 'Series' : 'Movie'}</h2>
              </div>
              <button className="dash-sidebar-close" onClick={closeSidebar}>×</button>
            </div>

            <div className="dash-sidebar-body">
              <div className="dash-sidebar-thumb" style={{ borderColor: `rgba(${accentRgb}, 0.35)` }}>
                <img src={getFullUrl(selectedVideo.thumbnailUrl) || '/default-thumbnail.jpg'} alt={selectedVideo.title} />
                <div className="dash-sidebar-thumb-overlay">
                  <span className={`dash-sidebar-type-pill ${selectedVideo.type === 'series' ? 'series' : 'movie'}`}>{selectedVideo.type === 'series' ? '📺 Series' : '🎬 Movie'}</span>
                </div>
              </div>

              <div className="dash-sb-section">
                <label className="dash-sb-label" style={{ color: accent }}>Title</label>
                <div className="dash-sb-value dash-sb-title">{selectedVideo.title}</div>
              </div>

              {selectedVideo.description && (
                <div className="dash-sb-section">
                  <label className="dash-sb-label" style={{ color: accent }}>Description</label>
                  <div className="dash-sb-desc-wrap">
                    <p className="dash-sb-desc">{expandedSidebarDesc ? selectedVideo.description : `${selectedVideo.description.substring(0, 150)}${selectedVideo.description.length > 150 ? '...' : ''}`}</p>
                    {selectedVideo.description.length > 150 && (
                      <button className="dash-see-more" style={{ background: `rgba(${accentRgb}, 0.18)`, borderColor: `rgba(${accentRgb}, 0.4)`, color: accentLight }} onClick={() => setExpandedSidebarDesc(!expandedSidebarDesc)}>
                        {expandedSidebarDesc ? '↑ Less' : '↓ More'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="dash-sb-section">
                <label className="dash-sb-label" style={{ color: accent }}>Preview</label>
                <div className="dash-preview-btns">
                  {selectedVideo.trailerUrl && <button className="dash-preview-btn" style={{ borderColor: `rgba(${accentRgb}, 0.4)`, color: accentLight }} onClick={() => handlePreview(selectedVideo, 'trailer')}><span>▶</span> Trailer</button>}
                  {selectedVideo.type === 'movie' && selectedVideo.videoUrl && <button className="dash-preview-btn" style={{ borderColor: `rgba(${accentRgb}, 0.4)`, color: accentLight }} onClick={() => handlePreview(selectedVideo, 'video')}><span>🎬</span> Watch</button>}
                  <button className="dash-preview-btn" style={{ borderColor: `rgba(${accentRgb}, 0.4)`, color: accentLight }} onClick={() => handlePreview(selectedVideo, 'details')}><span>ℹ</span> Details</button>
                </div>
              </div>

              <div className="dash-sb-section dash-sb-actions-section">
                <label className="dash-sb-label" style={{ color: accent }}>Actions</label>
                <div className="dash-action-btns">
                  {!isInTrash(selectedVideo) ? (
                    <>
                      {activeTab === 'approved' && <button className="dash-action-btn dash-action-release" onClick={() => setShowReleaseModal(true)} disabled={actionLoading === selectedVideo._id}>🚀 Release Video</button>}
                      {activeTab === 'released' && <button className="dash-action-btn dash-action-view" onClick={() => window.open(`/video/${selectedVideo._id}`)} disabled={actionLoading === selectedVideo._id}>🌐 View Live</button>}
                      <button className="dash-action-btn dash-action-trash" onClick={() => { if (window.confirm(`Move "${selectedVideo.title}" to trash? It will be automatically deleted after 30 days.`)) handleSoftDelete(selectedVideo); }} disabled={actionLoading === selectedVideo._id}>🗑 Move to Trash</button>
                    </>
                  ) : (
                    <button className="dash-action-btn dash-action-restore" onClick={() => { if (window.confirm(`Restore "${selectedVideo.title}"? You have ${selectedVideo.restoreCount !== undefined ? (3 - selectedVideo.restoreCount) : 3} restores left in 90 days.`)) handleRestore(selectedVideo._id); }} disabled={actionLoading === selectedVideo._id}>↩ Restore Video</button>
                  )}
                  {isAdmin && activeTab === 'pending' && (
                    <>
                      <button className="dash-action-btn dash-action-approve" onClick={() => handleApprove(selectedVideo._id)} disabled={actionLoading === selectedVideo._id}>✓ Approve</button>
                      <button className="dash-action-btn dash-action-reject" onClick={() => handleReject(selectedVideo)} disabled={actionLoading === selectedVideo._id}>✗ Reject</button>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      {!selectedVideo.flagged ? <button className="dash-action-btn dash-action-flag" onClick={() => handleFlag(selectedVideo)} disabled={actionLoading === selectedVideo._id}>⚑ Flag</button> : <button className="dash-action-btn dash-action-unflag" onClick={() => handleRemoveFlag(selectedVideo._id)} disabled={actionLoading === selectedVideo._id}>⚑ Remove Flag</button>}
                      {!selectedVideo.restricted ? <button className="dash-action-btn dash-action-restrict" onClick={() => handleRestrict(selectedVideo)} disabled={actionLoading === selectedVideo._id}>🔒 Restrict</button> : <button className="dash-action-btn dash-action-unrestrict" onClick={() => handleRemoveRestriction(selectedVideo._id)} disabled={actionLoading === selectedVideo._id}>🔓 Remove Restriction</button>}
                      {!selectedVideo.shadowBanned ? <button className="dash-action-btn dash-action-shadow" onClick={() => handleShadowBan(selectedVideo)} disabled={actionLoading === selectedVideo._id}>👁 Shadow Ban</button> : <button className="dash-action-btn dash-action-unshadow" onClick={() => handleRemoveShadowBan(selectedVideo._id)} disabled={actionLoading === selectedVideo._id}>👁 Remove Shadow Ban</button>}
                    </>
                  )}
                </div>
              </div>

              <div className="dash-sb-section">
                <label className="dash-sb-label" style={{ color: accent }}>Current Status</label>
                <div className="dash-sb-status-pill" style={{ borderColor: `rgba(${accentRgb}, 0.5)`, color: accentLight, background: `rgba(${accentRgb}, 0.1)` }}>
                  {tabs.find(t => t.id === activeTab)?.label}
                </div>
              </div>
            </div>

            {actionLoading === selectedVideo._id && (
              <div className="dash-sidebar-loading" style={{ borderTop: `1px solid rgba(${accentRgb}, 0.3)` }}>
                <div className="dash-spinner-sm" style={{ borderTopColor: accent }}></div>
                <span>Processing...</span>
              </div>
            )}
          </>
        )}
      </div>

      {showReleaseModal && selectedVideo && (
        <div className="dash-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowReleaseModal(false); }}>
          <div className="dash-modal-inner" style={{ borderColor: accent }} onClick={(e) => e.stopPropagation()}>
            <ReleaseModal video={selectedVideo} onClose={() => setShowReleaseModal(false)} onConfirm={handleRelease} isSeries={selectedVideo.type === 'series'} />
          </div>
        </div>
      )}

      {showPreviewModal && selectedVideo && (
        <VideoPreviewModal video={selectedVideo} previewType={previewType} onClose={() => setShowPreviewModal(false)} mediaBaseUrl={baseUrl} />
      )}

      {showReasonModal && selectedVideo && (
        <div className="dash-modal-overlay" onClick={() => setShowReasonModal(false)}>
          <div className="dash-reason-modal" style={{ borderColor: accent }} onClick={(e) => e.stopPropagation()}>
            <div className="dash-reason-header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.4)` }}>
              <h3>{pendingAction === 'flag' && '⚑ Flag Video'}{pendingAction === 'restrict' && '🔒 Restrict Video'}{pendingAction === 'shadowBan' && '👁 Shadow Ban Video'}</h3>
              <button className="dash-reason-close" onClick={() => setShowReasonModal(false)}>×</button>
            </div>
            <div className="dash-reason-body">
              <p>Please provide a reason:</p>
              <textarea className="dash-reason-textarea" value={reasonText} onChange={(e) => { setReasonText(e.target.value); setReasonError(''); }} rows={4} autoFocus style={{ borderColor: accent }} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    executeActionWithReason();
                  }
                }}
              />
              {reasonError && <div className="dash-reason-error">{reasonError}</div>}
              <div className="dash-reason-actions">
                <button className="dash-reason-cancel" onClick={() => setShowReasonModal(false)}>Cancel</button>
                <button className="dash-reason-submit" style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }} onClick={executeActionWithReason}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

/**
 * END OF FILE: frontend/src/pages/Dashboard.jsx
 */