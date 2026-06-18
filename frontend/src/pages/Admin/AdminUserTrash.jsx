/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
/**
 * FILE: frontend/src/pages/Admin/AdminUserTrash.jsx
 * Admin User Trash Page - Manage soft-deleted user videos
 * Features:
 * - View all videos moved to trash by users
 * - Restore videos to original owners
 * - Permanently delete videos from trash
 * - Bulk restore/delete operations
 * - View expiration dates (30-day retention)
 * - Search and filter capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
  getTrashedVideos,
  getTrashStats,
  adminRestoreTrashedVideo,
  adminPermanentDeleteTrashedVideo,
  adminBulkRestoreTrashedVideos,
  adminBulkDeleteTrashedVideos
} from '../../requests';
import './AdminUserTrash.css';

const MEDIA_BASE_URL = 'http://localhost:5000';

// Role-based theme getter
const getThemeAccent = (role) => {
  switch (role) {
    case "superadmin": return "#FFD700";
    case "platformadmin": return "#3B82F6";
    case "supportadmin": return "#22c55e";
    default: return "#FFD700";
  }
};

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="aut-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="aut-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#aut-sg1)">
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
    <svg className="aut-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="aut-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#aut-pbg)">
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
    <svg className="aut-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="aut-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#aut-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.14" transform={`rotate(${i * 37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30" />
      </circle>
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s" path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95" />
      </circle>
    </svg>
  );
}

function AdminUserTrash() {
  const { user, token, addNotification } = useAppContext();
  const navigate = useNavigate();
  const role = user?.role || "superadmin";
  const themeAccent = getThemeAccent(role);

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, expiringSoon: 0, expired: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmVideo, setConfirmVideo] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });

  const baseUrl = MEDIA_BASE_URL;

  // Check admin access
  useEffect(() => {
    if (!user || !['superadmin', 'platformadmin', 'supportadmin'].includes(user.role)) {
      navigate('/admin/dashboard');
      addNotification({ type: 'error', message: 'Admin access required' });
    }
  }, [user, navigate, addNotification]);

  const loadTrashStats = useCallback(async () => {
    try {
      const result = await getTrashStats(token);
      if (result.success) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to load trash stats:', err);
    }
  }, [token]);

  const loadTrashedVideos = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTrashedVideos(token, {
        search: searchTerm,
        page,
        limit: pagination.limit,
        sortBy: 'removedAt',
        sortOrder: 'desc'
      });
      if (result.success) {
        setVideos(result.videos || []);
        setPagination({
          page: result.page,
          limit: result.limit,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 0
        });
      } else {
        setError(result.message || 'Failed to load trashed videos');
      }
    } catch (err) {
      setError(err.message || 'Failed to load trashed videos');
    } finally {
      setLoading(false);
    }
  }, [token, searchTerm, pagination.limit]);

  useEffect(() => {
    if (token) {
      loadTrashStats();
      loadTrashedVideos(1);
    }
  }, [token, loadTrashStats, loadTrashedVideos, searchTerm]);

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${baseUrl}${url}`;
    return url;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Expired ${Math.abs(diffDays)} days ago`;
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays < 7) return `Expires in ${diffDays} days`;
    if (diffDays < 30) return `Expires in ${Math.floor(diffDays / 7)} weeks`;
    return `Expires on ${date.toLocaleDateString()}`;
  };

  const getExpiryClass = (expiresAt) => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'expiring-soon';
    return '';
  };

  const handleRestore = async (video) => {
    setConfirmAction('restore');
    setConfirmVideo(video);
    setShowConfirmModal(true);
  };

  const handlePermanentDelete = async (video) => {
    setConfirmAction('delete');
    setConfirmVideo(video);
    setShowConfirmModal(true);
  };

  const executeRestore = async (video) => {
    setActionLoading(video._id);
    try {
      const result = await adminRestoreTrashedVideo(token, video._id);
      if (result.success) {
        addNotification({ type: 'success', message: `Video restored successfully` });
        loadTrashedVideos(pagination.page);
        loadTrashStats();
      } else {
        addNotification({ type: 'error', message: result.message || 'Failed to restore' });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to restore video' });
    } finally {
      setActionLoading(null);
      setShowConfirmModal(false);
      setConfirmVideo(null);
      setConfirmAction(null);
    }
  };

  const executeDelete = async (video) => {
    setActionLoading(video._id);
    try {
      const result = await adminPermanentDeleteTrashedVideo(token, video._id);
      if (result.success) {
        addNotification({ type: 'success', message: `Video permanently deleted` });
        loadTrashedVideos(pagination.page);
        loadTrashStats();
      } else {
        addNotification({ type: 'error', message: result.message || 'Failed to delete' });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to delete video' });
    } finally {
      setActionLoading(null);
      setShowConfirmModal(false);
      setConfirmVideo(null);
      setConfirmAction(null);
    }
  };

  const handleSelectVideo = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v._id)));
    }
  };

  const handleBulkRestore = async () => {
    if (selectedVideos.size === 0) {
      addNotification({ type: 'warning', message: 'No videos selected' });
      return;
    }
    setBulkActionLoading(true);
    try {
      const result = await adminBulkRestoreTrashedVideos(token, Array.from(selectedVideos));
      if (result.success) {
        addNotification({ type: 'success', message: result.message });
        setSelectedVideos(new Set());
        loadTrashedVideos(pagination.page);
        loadTrashStats();
      } else {
        addNotification({ type: 'error', message: result.message || 'Bulk restore failed' });
      }
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to bulk restore videos' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.size === 0) {
      addNotification({ type: 'warning', message: 'No videos selected' });
      return;
    }
    if (window.confirm(`Are you sure you want to permanently delete ${selectedVideos.size} videos? This action cannot be undone.`)) {
      setBulkActionLoading(true);
      try {
        const result = await adminBulkDeleteTrashedVideos(token, Array.from(selectedVideos));
        if (result.success) {
          addNotification({ type: 'success', message: result.message });
          setSelectedVideos(new Set());
          loadTrashedVideos(pagination.page);
          loadTrashStats();
        } else {
          addNotification({ type: 'error', message: result.message || 'Bulk delete failed' });
        }
      } catch (err) {
        addNotification({ type: 'error', message: 'Failed to bulk delete videos' });
      } finally {
        setBulkActionLoading(false);
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadTrashedVideos(newPage);
    }
  };

  if (loading && videos.length === 0) {
    return (
      <div className={`aut-page aut-role-${role}`} style={{ "--theme-accent": themeAccent }}>
        <div className="aut-bg" aria-hidden="true">
          {role === "superadmin" && <SuperBg />}
          {role === "platformadmin" && <PlatformBg />}
          {role === "supportadmin" && <SupportBg />}
        </div>
        <div className="aut-grain" aria-hidden="true"></div>
        <div className="aut-loading">
          <div className="aut-loading__ring" style={{ borderTopColor: themeAccent }}></div>
          <p>Loading trashed videos...</p>
        </div>
      </div>
    );
  }

  const isSuperOrPlatformAdmin = ['superadmin', 'platformadmin'].includes(user?.role);

  return (
    <div className={`aut-page aut-role-${role}`} style={{ "--theme-accent": themeAccent }}>
      {/* Animated SVG background */}
      <div className="aut-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>

      {/* Grain overlay */}
      <div className="aut-grain" aria-hidden="true"></div>

      <div className="aut-container">
        <div className="aut-header">
          <h1>User Trash</h1>
          <p>Manage videos that users have moved to trash. Videos are automatically deleted after 30 days.</p>
        </div>

        {/* Stats Cards */}
        <div className="aut-stats-row">
          <div className="aut-stat-box">
            <span className="aut-stat-value">{stats.total}</span>
            <span className="aut-stat-label">Total Trashed</span>
          </div>
          <div className="aut-stat-box">
            <span className="aut-stat-value">{stats.expiringSoon}</span>
            <span className="aut-stat-label">Expiring Soon (7 days)</span>
          </div>
          <div className="aut-stat-box">
            <span className="aut-stat-value">{stats.expired}</span>
            <span className="aut-stat-label">Expired</span>
          </div>
        </div>

        {/* Controls */}
        <div className="aut-controls">
          <div className="aut-search-bar">
            <input
              type="text"
              placeholder="Search by title or creator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={() => loadTrashedVideos(1)} style={{ background: themeAccent, color: '#000000' }}>Search</button>
          </div>
          <div className="aut-bulk-actions">
            <button
              className="aut-bulk-restore"
              onClick={handleBulkRestore}
              disabled={selectedVideos.size === 0 || bulkActionLoading}
            >
              {bulkActionLoading ? 'Processing...' : `Restore Selected (${selectedVideos.size})`}
            </button>
            {isSuperOrPlatformAdmin && (
              <button
                className="aut-bulk-delete"
                onClick={handleBulkDelete}
                disabled={selectedVideos.size === 0 || bulkActionLoading}
              >
                {bulkActionLoading ? 'Processing...' : `Delete Selected (${selectedVideos.size})`}
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="aut-error">
            <div className="aut-error__icon"></div>
            <p>{error}</p>
            <button onClick={() => loadTrashedVideos(1)} className="aut-retry" style={{ background: themeAccent }}>Retry</button>
          </div>
        )}

        {/* Videos Table */}
        {videos.length === 0 && !loading ? (
          <div className="aut-empty">
            <div className="aut-empty__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={themeAccent} strokeWidth="1.5">
                <path d="M3 6h18M8 6V4h8v2M4 6h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
                <line x1="10" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <h3>No trashed videos</h3>
            <p>When users delete their videos, they will appear here.</p>
          </div>
        ) : (
          <div className="aut-table-container">
            <table className="aut-table">
              <thead>
                <tr>
                  <th className="aut-checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedVideos.size === videos.length && videos.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Thumbnail</th>
                  <th>Title</th>
                  <th>Creator</th>
                  <th>Deleted At</th>
                  <th>Expires</th>
                  <th>Restores Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => {
                  const thumbnailUrl = getFullUrl(video.thumbnailUrl);
                  const expiryClass = getExpiryClass(video.trashExpiresAt);
                  const restoresUsed = video.restoreCount || 0;
                  const restoresRemaining = Math.max(0, 3 - restoresUsed);
                  
                  return (
                    <tr key={video._id} className={expiryClass}>
                      <td className="aut-checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedVideos.has(video._id)}
                          onChange={() => handleSelectVideo(video._id)}
                        />
                      </td>
                      <td className="aut-thumbnail-col">
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={video.title} />
                        ) : (
                          <div className="aut-thumbnail-placeholder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <polygon points="10 8 16 12 10 16 10 8" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="aut-title-col">
                        <div className="aut-video-title">{video.title}</div>
                        <div className="aut-video-type">{video.type === 'series' ? 'Series' : 'Movie'}</div>
                      </td>
                      <td className="aut-creator-col">
                        <Link to={`/admin/users/${video.creator?._id}`} style={{ color: themeAccent }}>
                          {video.creator?.name || video.creator?.email || 'Unknown'}
                        </Link>
                      </td>
                      <td className="aut-date-col">
                        {video.removedAt ? new Date(video.removedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className={`aut-expiry-col ${expiryClass}`}>
                        {formatDate(video.trashExpiresAt)}
                      </td>
                      <td className="aut-restores-col">
                        <span className={`aut-restores-badge ${restoresRemaining === 0 ? 'danger' : restoresRemaining === 1 ? 'warning' : 'good'}`}
                          style={restoresRemaining === 0 ? { background: '#ef444420', color: '#ef4444' } : 
                                 restoresRemaining === 1 ? { background: `${themeAccent}20`, color: themeAccent } : 
                                 { background: '#22c55e20', color: '#22c55e' }}>
                          {restoresUsed}/3 used
                        </span>
                      </td>
                      <td className="aut-actions-col">
                        <button
                          className="aut-restore-btn"
                          onClick={() => handleRestore(video)}
                          disabled={actionLoading === video._id}
                          style={{ '--accent': themeAccent }}
                        >
                          {actionLoading === video._id ? '...' : 'Restore'}
                        </button>
                        {isSuperOrPlatformAdmin && (
                          <button
                            className="aut-delete-btn"
                            onClick={() => handlePermanentDelete(video)}
                            disabled={actionLoading === video._id}
                          >
                            {actionLoading === video._id ? '...' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="aut-pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </button>
            <span className="aut-page-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && confirmVideo && (
        <div className="aut-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="aut-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aut-modal-header">
              <h3>{confirmAction === 'restore' ? 'Restore Video' : 'Permanently Delete Video'}</h3>
              <button className="aut-modal-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div className="aut-modal-body">
              <p>
                {confirmAction === 'restore'
                  ? `Are you sure you want to restore "${confirmVideo.title}"?`
                  : `Are you sure you want to permanently delete "${confirmVideo.title}"? This action cannot be undone.`
                }
              </p>
              {confirmAction === 'restore' && confirmVideo.restoreCount >= 2 && (
                <p className="aut-warning-text" style={{ color: themeAccent }}>
                  This video has been restored {confirmVideo.restoreCount} times.
                  After 3 restores within 90 days, it will be permanently deleted.
                </p>
              )}
            </div>
            <div className="aut-modal-footer">
              <button className="aut-cancel-btn" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button
                className={confirmAction === 'restore' ? 'aut-confirm-restore' : 'aut-confirm-delete'}
                style={confirmAction === 'restore' ? { background: themeAccent, color: '#000000' } : { background: '#ef4444', color: '#ffffff' }}
                onClick={() => {
                  if (confirmAction === 'restore') executeRestore(confirmVideo);
                  else executeDelete(confirmVideo);
                }}
              >
                {confirmAction === 'restore' ? 'Restore' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserTrash;