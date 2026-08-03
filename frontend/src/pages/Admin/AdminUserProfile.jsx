/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/static-components */
/* eslint-disable react-hooks/exhaustive-deps */
// File: frontend/src/pages/admin/AdminUserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { getUserById, getVideosByStatus, getFollowers, getFollowing } from '../../requests';
import './AdminUserProfile.css';

function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="aup-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="aup-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#aup-sg1)">
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
    <svg className="aup-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="aup-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#aup-pbg)" />
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
    <svg className="aup-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="aup-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22ff00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#aup-sbg)" />
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

const AdminUserProfile = () => {
  const { userId } = useParams();
  const { user, token } = useAppContext();
  const navigate = useNavigate();

  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [userVideos, setUserVideos] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [socialError, setSocialError] = useState(null);

  const baseUrl = 'http://localhost:5000';
  const currentRole = user?.role || 'superadmin';

  useEffect(() => {
    if (!user || !['superadmin', 'platformadmin', 'supportadmin'].includes(user.role)) {
      navigate('/admin-login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (token && userId) fetchUserData();
  }, [token, userId]);

  useEffect(() => {
    if (activeTab === 'videos' && targetUser && token) fetchUserVideos();
    if (activeTab === 'social' && targetUser && token) fetchUserSocial();
  }, [activeTab, targetUser, token]);

  const fetchUserData = async () => {
    setLoading(true); setError(null);
    try {
      const result = await getUserById(token, userId);
      if (result.success && result.user) setTargetUser(result.user);
      else setError(result.message || 'User not found');
    } catch (err) {
      setError(err.message || 'Failed to fetch user');
    } finally { setLoading(false); }
  };

  const fetchUserVideos = async () => {
    setLoadingVideos(true);
    try {
      const [pending, approved, released, rejected] = await Promise.all([
        getVideosByStatus(token, 'pending', userId),
        getVideosByStatus(token, 'approved', userId),
        getVideosByStatus(token, 'released', userId),
        getVideosByStatus(token, 'rejected', userId),
      ]);
      const all = [
        ...(pending.videos || []), ...(approved.videos || []),
        ...(released.videos || []), ...(rejected.videos || []),
      ];
      setUserVideos(all.filter((v, i, s) => i === s.findIndex(x => x._id === v._id)));
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally { setLoadingVideos(false); }
  };

  const fetchUserSocial = async () => {
    setLoadingSocial(true); setSocialError(null);
    try {
      const [fr, fg] = await Promise.all([
        getFollowers(token, userId, 1, 50),
        getFollowing(token, userId, 1, 50),
      ]);
      setFollowers(fr?.success ? (fr.data || []) : []);
      setFollowing(fg?.success ? (fg.data || []) : []);
    } catch (err) {
      setSocialError(err.message || 'Failed to load');
      setFollowers([]); setFollowing([]);
    } finally { setLoadingSocial(false); }
  };

  const getStatusClass = (status) => {
    const m = { released: 'aup-st-released', approved: 'aup-st-approved', pending: 'aup-st-pending', rejected: 'aup-st-rejected', removed: 'aup-st-removed' };
    return m[status] || '';
  };

  const getThumbUrl = (video) => {
    if (!video.thumbnailUrl) return null;
    if (video.thumbnailUrl.startsWith('http')) return video.thumbnailUrl;
    return `${baseUrl}${video.thumbnailUrl}`;
  };

  const getAvatarUrl = () => {
    if (!targetUser?.avatar) return null;
    if (targetUser.avatar.startsWith('http')) return targetUser.avatar;
    return `${baseUrl}${targetUser.avatar}`;
  };

  const BgLayer = () => (
    <>
      <div className="aup-bg" aria-hidden="true">
        {currentRole === 'superadmin' && <SuperBg />}
        {currentRole === 'platformadmin' && <PlatformBg />}
        {currentRole === 'supportadmin' && <SupportBg />}
      </div>
      <div className="aup-grain" aria-hidden="true" />
    </>
  );

  if (loading) {
    return (
      <div className={`aup-page aup-role-${currentRole}`}>
        <BgLayer />
        <div className="aup-loading">
          <div className="aup-ring" />
          <p>Loading profile&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className={`aup-page aup-role-${currentRole}`}>
        <BgLayer />
        <div className="aup-error-state">
          <div className="aup-error-code">404</div>
          <h3>User Not Found</h3>
          <p>{error || 'The requested user could not be found.'}</p>
          <Link to="/admin/users" className="aup-btn aup-btn--accent">Back to User Management</Link>
        </div>
      </div>
    );
  }

  const displayName = targetUser.firstName && targetUser.lastName
    ? `${targetUser.firstName} ${targetUser.lastName}`
    : targetUser.name || targetUser.username || targetUser.email;

  const avatarUrl = getAvatarUrl();
  const roleLabels = { superadmin: 'Super Admin', platformadmin: 'Platform Admin', supportadmin: 'Support Admin' };

  return (
    <div className={`aup-page aup-role-${currentRole}`}>
      <BgLayer />

      <div className="aup-content">

        {/* Nav */}
        <div className="aup-nav">
          <Link to="/admin/users" className="aup-back">
            <span>&#8592;</span>
            <span>Back to Users</span>
          </Link>
          <span className="aup-viewer-tag">{roleLabels[currentRole] || currentRole}</span>
        </div>

        {/* Hero */}
        <div className="aup-hero">
          <div className="aup-hero__topbar" />
          <div className="aup-hero__inner">
            <div className="aup-avatar-wrap">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="aup-avatar-img"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
              ) : null}
              <div className="aup-avatar-fall" style={{ display: avatarUrl ? 'none' : 'flex' }}>
                {displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="aup-avatar-ring" />
            </div>

            <div className="aup-hero__info">
              <div className="aup-hero__namerow">
                <h1 className="aup-hero__name">{displayName}</h1>
                <div className="aup-role-pill">
                  <span className="aup-role-pip" />
                  <span>{targetUser.role}</span>
                </div>
              </div>
              <div className="aup-hero__ids">
                {targetUser.username && <span className="aup-id-chip">@{targetUser.username}</span>}
                <span className="aup-id-chip">{targetUser.email}</span>
              </div>
              {targetUser.bio && <p className="aup-hero__bio">{targetUser.bio}</p>}
              <div className="aup-flags">
                {targetUser.isVerified && <span className="aup-flag aup-flag--v">Verified</span>}
                {targetUser.isBanned && <span className="aup-flag aup-flag--b">Banned</span>}
                {targetUser.isDeactivated && <span className="aup-flag aup-flag--d">Deactivated</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="aup-stats">
          {[
            { abbr: 'VID', label: 'Videos', value: userVideos.length },
            { abbr: 'FLW', label: 'Followers', value: targetUser.followers?.length || 0 },
            { abbr: 'FOL', label: 'Following', value: targetUser.following?.length || 0 },
            { abbr: 'TWN', label: 'Twins', value: targetUser.twins?.length || 0 },
          ].map(({ abbr, label, value }) => (
            <div key={abbr} className="aup-stat">
              <span className="aup-stat__abbr">{abbr}</span>
              <span className="aup-stat__val">{value}</span>
              <span className="aup-stat__lbl">{label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="aup-tabs">
          {[
            { key: 'videos', label: 'Films and Series', count: userVideos.length },
            { key: 'social', label: 'Social', count: followers.length + following.length },
            { key: 'details', label: 'Account Details', count: null },
          ].map(({ key, label, count }) => (
            <button key={key} className={`aup-tab ${activeTab === key ? 'aup-tab--on' : ''}`}
              onClick={() => setActiveTab(key)}>
              {label}
              {count !== null && <span className="aup-tab__ct">{count}</span>}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="aup-tab-body">

          {/* VIDEOS */}
          {activeTab === 'videos' && (
            loadingVideos ? (
              <div className="aup-pane-load"><div className="aup-ring aup-ring--sm" /><span>Loading videos&hellip;</span></div>
            ) : userVideos.length === 0 ? (
              <div className="aup-empty">
                <div className="aup-empty__icon" />
                <h3>No content uploaded</h3>
                <p>This user has not uploaded any videos yet</p>
              </div>
            ) : (
              <div className="aup-vgrid">
                {userVideos.map(video => {
                  const thumb = getThumbUrl(video);
                  const hasErr = imageErrors[video._id];
                  return (
                    <div key={video._id} className="aup-vcard" onClick={() => navigate(`/video/${video._id}`)}>
                      <div className="aup-vcard__thumb">
                        {thumb && !hasErr ? (
                          <img src={thumb} alt={video.title}
                            onError={() => setImageErrors(p => ({ ...p, [video._id]: true }))} />
                        ) : (
                          <div className="aup-vcard__fall">
                            <span>{video.type === 'series' ? 'SRS' : 'MOV'}</span>
                          </div>
                        )}
                        <span className={`aup-vbadge ${getStatusClass(video.status)}`}>{video.status}</span>
                      </div>
                      <div className="aup-vcard__bd">
                        <p className="aup-vcard__title">{video.title}</p>
                        <div className="aup-vcard__meta">
                          <span>{video.type}</span>
                          <span className="aup-dot" />
                          <span>{(video.views || 0).toLocaleString()} views</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* SOCIAL */}
          {activeTab === 'social' && (
            loadingSocial ? (
              <div className="aup-pane-load"><div className="aup-ring aup-ring--sm" /><span>Loading connections&hellip;</span></div>
            ) : socialError ? (
              <div className="aup-empty">
                <div className="aup-empty__icon" />
                <h3>Failed to load</h3>
                <p>{socialError}</p>
              </div>
            ) : (
              <div className="aup-social">
                {[{ title: 'Followers', list: followers }, { title: 'Following', list: following }].map(({ title, list }) => (
                  <div key={title} className="aup-social__col">
                    <div className="aup-social__hd">
                      <span className="aup-social__title">{title}</span>
                      <span className="aup-social__ct">{list.length}</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="aup-social__empty">No {title.toLowerCase()} yet</p>
                    ) : (
                      <div className="aup-ulist">
                        {list.map(u => (
                          <Link key={u._id} to={`/admin/users/${u._id}`} className="aup-uitem">
                            <div className="aup-uitem__av">
                              {u.avatar
                                ? <img src={u.avatar.startsWith('http') ? u.avatar : `${baseUrl}${u.avatar}`} alt="" />
                                : <span>{u.name?.[0] || u.email?.[0] || 'U'}</span>}
                            </div>
                            <div className="aup-uitem__info">
                              <span className="aup-uitem__name">{u.name || u.username || u.email}</span>
                              <span className="aup-uitem__role">{u.role || 'user'}</span>
                            </div>
                            <span className="aup-uitem__arr">&#8594;</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* DETAILS */}
          {activeTab === 'details' && (
            <div className="aup-details">
              {[
                { label: 'User ID', value: targetUser._id },
                { label: 'Email', value: targetUser.email },
                { label: 'Username', value: targetUser.username ? `@${targetUser.username}` : 'Not set' },
                { label: 'Full Name', value: displayName },
                { label: 'Role', value: targetUser.role },
                { label: 'Gender', value: targetUser.gender || 'Not specified' },
                { label: 'Date of Birth', value: targetUser.dateOfBirth ? new Date(targetUser.dateOfBirth).toLocaleDateString() : 'Not specified' },
                { label: 'Location', value: targetUser.location || 'Not specified' },
                { label: 'Member Since', value: new Date(targetUser.createdAt).toLocaleDateString() },
                { label: 'Balance', value: `$${targetUser.balance || 0}` },
                { label: 'Verified', value: targetUser.isVerified ? 'Yes' : 'No' },
                { label: 'Banned', value: targetUser.isBanned ? 'Yes' : 'No' },
                { label: 'Deactivated', value: targetUser.isDeactivated ? 'Yes' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="aup-detail-item">
                  <span className="aup-detail-item__lbl">{label}</span>
                  <span className="aup-detail-item__val">{value}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminUserProfile;