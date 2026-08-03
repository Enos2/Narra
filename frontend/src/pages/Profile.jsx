/* eslint-disable react-hooks/immutability */
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/static-components */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { getUserById, followUser, unfollowUser, checkFollowStatus, getFollowers, getFollowing, getTwins, getVideosByStatus } from "../requests";
import "./Profile.css";

function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, token } = useAppContext();
  const { theme } = useTheme();

  const accent    = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followStatus, setFollowStatus] = useState({ isFollowing: false, isFollowedBy: false, isTwin: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activeTab, setActiveTab] = useState("videos");
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showTwins, setShowTwins] = useState(false);
  const [socialList, setSocialList] = useState([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [socialPagination, setSocialPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      setLoading(true); setError(null); setIsPrivate(false);
      try {
        const response = await getUserById(token, userId);
        if (response.success && response.user) {
          setProfile(response.user); setIsPrivate(false);
          if (token && currentUser && currentUser._id !== userId) {
            try {
              const statusRes = await checkFollowStatus(token, userId);
              if (statusRes.success) setFollowStatus({ isFollowing: statusRes.isFollowing || false, isFollowedBy: statusRes.isFollowedBy || false, isTwin: statusRes.isTwin || false });
            } catch (err) {}
          }
          await loadUserVideos(userId);
        } else if (response.message === 'This profile is private') {
          setIsPrivate(true); setError("This profile is private");
        } else { setError(response.message || "User not found"); }
      } catch (err) { setError("Failed to load profile"); }
      finally { setLoading(false); }
    };
    loadProfile();
  }, [userId, token, currentUser]);

  const loadUserVideos = async (uid) => {
    setLoadingVideos(true);
    try {
      const response = await getVideosByStatus(token, "approved", uid);
      if (response.success) setVideos(response.videos || []);
    } catch (err) {}
    finally { setLoadingVideos(false); }
  };

  const handleFollow = async () => {
    if (!token || !currentUser) { navigate("/login", { state: { from: `/profile/${userId}` } }); return; }
    if (currentUser._id === userId) return;
    setFollowLoading(true);
    try {
      if (followStatus.isFollowing) {
        const r = await unfollowUser(token, userId);
        if (r.success) { setFollowStatus({ isFollowing: false, isFollowedBy: followStatus.isFollowedBy, isTwin: false }); setProfile(prev => ({ ...prev, followerCount: Math.max(0, (prev.followerCount || 0) - 1) })); }
      } else {
        const r = await followUser(token, userId);
        if (r.success) { setFollowStatus({ isFollowing: true, isFollowedBy: followStatus.isFollowedBy, isTwin: r.isTwin || false }); setProfile(prev => ({ ...prev, followerCount: (prev.followerCount || 0) + 1 })); }
      }
    } catch (err) {}
    finally { setFollowLoading(false); }
  };

  const loadSocialList = async (type, page = 1) => {
    if (!token || !profile) return;
    setLoadingSocial(true); setSocialList([]);
    try {
      let response;
      if (type === "followers") response = await getFollowers(token, profile._id, page, socialPagination.limit);
      else if (type === "following") response = await getFollowing(token, profile._id, page, socialPagination.limit);
      else if (type === "twins") response = await getTwins(token, profile._id, page, socialPagination.limit);
      if (response.success) { setSocialList(response.data || []); setSocialPagination({ page: response.pagination?.page || page, limit: response.pagination?.limit || 20, total: response.pagination?.total || 0, pages: response.pagination?.pages || 0 }); }
    } catch (err) {}
    finally { setLoadingSocial(false); }
  };

  const openSocialList = (type) => {
    if (!token) { navigate("/login"); return; }
    if (type === "followers") { setShowFollowers(true); loadSocialList("followers", 1); }
    else if (type === "following") { setShowFollowing(true); loadSocialList("following", 1); }
    else if (type === "twins") { setShowTwins(true); loadSocialList("twins", 1); }
  };

  const closeSocialList = () => { setShowFollowers(false); setShowFollowing(false); setShowTwins(false); setSocialList([]); setSocialPagination({ page: 1, limit: 20, total: 0, pages: 0 }); };
  const loadMoreSocial = (type) => { if (socialPagination.page < socialPagination.pages) loadSocialList(type, socialPagination.page + 1); };
  const navigateToVideo = (videoId) => navigate(`/video/${videoId}`);
  const navigateToUser = (uid) => { closeSocialList(); navigate(`/profile/${uid}`); };
  const handleSendMessage = () => { if (!token) { navigate("/login", { state: { from: `/profile/${userId}` } }); return; } navigate(`/messages?user=${profile._id}`); };

  const ClawBg = () => (
    <div className="prf-claw-bg">
      {[...Array(12)].map((_, i) => <div key={i} className={`prf-claw prf-claw-${i+1}`}></div>)}
      {[...Array(4)].map((_, i) => <div key={i} className={`prf-scar-diag prf-scar-diag-${i+1}`}></div>)}
      {[...Array(5)].map((_, i) => <div key={i} className={`prf-scratch-h prf-scratch-h-${i+1}`}></div>)}
      {[...Array(4)].map((_, i) => <div key={i} className={`prf-scratch-v prf-scratch-v-${i+1}`}></div>)}
      {[1,2,3,4].map(i => <div key={i} className={`prf-triple prf-triple-${i}`}><span></span><span></span><span></span></div>)}
      {[1,2,3].map(i => <div key={i} className={`prf-scar-x prf-scar-x-${i}`}></div>)}
    </div>
  );

  if (loading) return (
    <div className="prf-wrapper">
      <ClawBg />
      <div className="prf-blood-stroke top"></div>
      <div className="prf-blood-stroke bottom"></div>
      <div className="prf-loading"><div className="prf-spinner" style={{ borderTopColor: accent }}></div><p>Loading profile...</p></div>
    </div>
  );

  if (error || !profile) return (
    <div className="prf-wrapper">
      <ClawBg />
      <div className="prf-blood-stroke top"></div>
      <div className="prf-blood-stroke bottom"></div>
      <div className="prf-error">
        <div className="prf-error-icon" style={{ color: accent }}>{isPrivate ? "[ LOCKED ]" : "[ 404 ]"}</div>
        <h2 style={{ color: accent }}>{isPrivate ? "Private Profile" : "User Not Found"}</h2>
        <p>{error}</p>
        {isPrivate && <p className="prf-private-msg" style={{ color: `rgba(${accentRgb}, 0.6)` }}>Follow this user to see their content.</p>}
        <button className="prf-back-btn" style={{ borderColor: accent, color: accent, background: `rgba(${accentRgb}, 0.15)` }} onClick={() => navigate("/")}>Go Back Home</button>
      </div>
    </div>
  );

  const isOwnProfile = currentUser && currentUser._id === profile._id;
  const canViewContent = isOwnProfile || profile.privacySettings?.profileVisibility !== 'private' || followStatus.isFollowing;
  const displayName = profile.name || profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username || 'User';

  const SocialModal = ({ title, type, onClose }) => (
    <div className="prf-social-modal" onClick={onClose}>
      <div className="prf-social-modal-content" style={{ borderColor: `rgba(${accentRgb}, 0.4)` }} onClick={e => e.stopPropagation()}>
        <div className="prf-social-modal-header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.15)` }}>
          <h2 style={{ color: accent }}>{title} ({socialPagination.total})</h2>
          <button className="prf-close-btn" style={{ borderColor: `rgba(${accentRgb}, 0.3)`, color: `rgba(${accentRgb}, 0.7)` }} onClick={onClose}>X</button>
        </div>
        <div className="prf-social-modal-body">
          {loadingSocial ? (
            <div className="prf-modal-loading"><div className="prf-spinner small" style={{ borderTopColor: accent }}></div></div>
          ) : socialList.length > 0 ? (
            <>
              {socialList.map(u => (
                <div key={u._id} className={`prf-social-user-item ${type === 'twins' ? 'highlight' : ''}`}
                  style={type === 'twins' ? { borderLeft: `3px solid ${accent}` } : {}}
                  onClick={() => navigateToUser(u._id)}>
                  {u.avatar ? <img src={u.avatar} alt={u.name} className="prf-modal-avatar" style={{ borderColor: `rgba(${accentRgb}, 0.4)` }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} /> : null}
                  <div className="prf-modal-avatar-placeholder" style={{ display: u.avatar ? 'none' : 'flex', color: accent, borderColor: `rgba(${accentRgb}, 0.3)` }}>{u.name?.[0] || u.username?.[0] || "U"}</div>
                  <div className="prf-modal-user-info">
                    <div className="prf-modal-name-row">
                      <span className="prf-modal-name">{u.name || u.username}</span>
                      {u.isVerified && <span className="prf-modal-verified">V</span>}
                      {u.isFollowing && <span className="prf-follows-you" style={{ background: `rgba(${accentRgb}, 0.12)`, color: accent, borderColor: `rgba(${accentRgb}, 0.3)` }}>Follows you</span>}
                    </div>
                    {u.bio && <p className="prf-modal-bio">{u.bio.substring(0, 60)}...</p>}
                  </div>
                  {u.isTwin && <span className="prf-twin-badge" style={{ background: `rgba(${accentRgb}, 0.2)`, color: accent, borderColor: `rgba(${accentRgb}, 0.5)` }}>Twin</span>}
                </div>
              ))}
              {socialPagination.page < socialPagination.pages && (
                <button className="prf-load-more-btn" style={{ borderColor: `rgba(${accentRgb}, 0.2)`, color: `rgba(${accentRgb}, 0.6)` }} onClick={() => loadMoreSocial(type)}>Load More</button>
              )}
            </>
          ) : <p className="prf-empty-list">Nothing to show here yet.</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="prf-wrapper">
      <ClawBg />
      <div className="prf-blood-stroke top"></div>
      <div className="prf-blood-stroke bottom"></div>

      <div className="prf-cover" style={{ backgroundImage: profile.coverImage ? `url(${profile.coverImage})` : undefined }}>
        <div className="cover-overlay" style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.35) 0%, rgba(0,0,0,0.72) 100%)` }}></div>
      </div>

      <div className="prf-content">
        <div className="prf-header">
          <div className="prf-avatar-wrapper">
            {profile.avatar ? <img src={profile.avatar} alt={displayName} className="prf-avatar" style={{ borderColor: accent, boxShadow: `0 0 20px rgba(${accentRgb},0.3)` }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} /> : null}
            <div className="prf-avatar-placeholder" style={{ display: profile.avatar ? 'none' : 'flex', borderColor: `rgba(${accentRgb},0.5)`, color: accent }}>{displayName[0]?.toUpperCase() || "U"}</div>
            {profile.online && <span className="prf-online-dot" title="Online"></span>}
          </div>

          <div className="prf-info">
            <div className="prf-name-section">
              <h1 className="prf-name">{displayName}{profile.isVerified && <span className="prf-verified-badge" title="Verified">V</span>}</h1>
              <p className="prf-username" style={{ color: `rgba(${accentRgb},0.6)` }}>@{profile.username || profile.email?.split('@')[0]}</p>
            </div>

            {profile.bio && <div className="prf-bio" style={{ borderLeft: `3px solid ${accent}` }}>{profile.bio}</div>}

            {(profile.location || profile.website) && (
              <div className="prf-details">
                {profile.location && <div className="prf-detail"><span className="prf-detail-label" style={{ color: `rgba(${accentRgb},0.6)` }}>Location:</span><span>{profile.location}</span></div>}
                {profile.website && <div className="prf-detail"><span className="prf-detail-label" style={{ color: `rgba(${accentRgb},0.6)` }}>Web:</span><a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="prf-detail-link" style={{ color: accent }}>{profile.website.replace(/^https?:\/\//, '')}</a></div>}
                <div className="prf-detail"><span className="prf-detail-label" style={{ color: `rgba(${accentRgb},0.6)` }}>Joined:</span><span>{new Date(profile.createdAt).toLocaleDateString()}</span></div>
              </div>
            )}

            <div className="prf-stats" style={{ background: `rgba(${accentRgb},0.04)`, borderColor: `rgba(${accentRgb},0.12)` }}>
              {[{ label: 'Followers', value: profile.followerCount || 0, type: 'followers' }, { label: 'Following', value: profile.followingCount || 0, type: 'following' }, { label: 'Twins', value: profile.twinCount || 0, type: 'twins', highlight: true }].map(s => (
                <div key={s.label} className={`prf-stat ${s.highlight ? 'prf-stat-twins' : ''} ${token ? 'prf-stat-clickable' : ''}`}
                  style={s.highlight ? { borderColor: `rgba(${accentRgb},0.35)`, background: `rgba(${accentRgb},0.05)` } : {}}
                  onClick={() => token && openSocialList(s.type)}>
                  <span className="prf-stat-value" style={{ color: accent }}>{s.value}</span>
                  <span className="prf-stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            {!isOwnProfile && (
              <div className="prf-actions">
                {token ? (
                  <>
                    <button className={`prf-follow-btn ${followStatus.isFollowing ? 'following' : ''} ${followStatus.isTwin ? 'twin' : ''}`}
                      style={followStatus.isFollowing ? { background: `rgba(${accentRgb},0.15)`, borderColor: accent, color: accent } : { background: accent, color: '#000' }}
                      onClick={handleFollow} disabled={followLoading}>
                      {followLoading ? '...' : followStatus.isTwin ? 'Twins' : followStatus.isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button className="prf-message-btn" style={{ borderColor: `rgba(${accentRgb},0.5)`, color: accent }} onClick={handleSendMessage}>Message</button>
                  </>
                ) : (
                  <button className="prf-follow-btn" style={{ background: accent }} onClick={() => navigate("/login", { state: { from: `/profile/${userId}` } })}>Login to Follow</button>
                )}
              </div>
            )}

            {isOwnProfile && (
              <button className="prf-edit-btn" style={{ background: `rgba(${accentRgb},0.1)`, borderColor: `rgba(${accentRgb},0.4)`, color: accent }} onClick={() => navigate("/account")}>Edit Profile</button>
            )}
          </div>
        </div>

        {canViewContent && (
          <>
            <div className="prf-tabs" style={{ borderBottom: `1px solid rgba(${accentRgb},0.15)` }}>
              <button className={`prf-tab-btn ${activeTab === "videos" ? "active" : ""}`}
                style={activeTab === "videos" ? { background: `rgba(${accentRgb},0.15)`, borderColor: accent, color: accent } : { borderColor: `rgba(${accentRgb},0.2)`, color: `rgba(${accentRgb},0.6)` }}
                onClick={() => setActiveTab("videos")}>Videos ({profile.uploadedVideos?.length || videos.length || 0})</button>
              {profile.isCreator && (
                <button className={`prf-tab-btn ${activeTab === "lives" ? "active" : ""}`}
                  style={activeTab === "lives" ? { background: `rgba(${accentRgb},0.15)`, borderColor: accent, color: accent } : { borderColor: `rgba(${accentRgb},0.2)`, color: `rgba(${accentRgb},0.6)` }}
                  onClick={() => setActiveTab("lives")}>Live Streams ({profile.uploadedLives?.length || 0})</button>
              )}
            </div>

            <div className="prf-tab-content">
              {activeTab === "videos" && (
                <div className="prf-videos-grid">
                  {loadingVideos ? (
                    <div className="prf-grid-loading"><div className="prf-spinner small" style={{ borderTopColor: accent }}></div></div>
                  ) : videos.length > 0 ? videos.map(video => (
                    <div key={video._id} className="prf-video-card" style={{ borderColor: `rgba(${accentRgb},0.12)` }} onClick={() => navigateToVideo(video._id)}>
                      <div className="prf-video-thumb">
                        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={video.title} /> : <div className="prf-thumb-placeholder" style={{ color: `rgba(${accentRgb},0.4)` }}>[ VIDEO ]</div>}
                        <span className="prf-video-duration" style={{ color: accent }}>{video.duration || "0:00"}</span>
                      </div>
                      <div className="prf-video-info">
                        <h3 className="prf-video-title">{video.title}</h3>
                        <div className="prf-video-meta"><span>{video.views || 0} views</span><span>{new Date(video.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  )) : (
                    <div className="prf-empty-state" style={{ borderColor: `rgba(${accentRgb},0.2)` }}>
                      <div className="prf-empty-label" style={{ color: `rgba(${accentRgb},0.5)` }}>[ NO VIDEOS ]</div>
                      <p>No videos uploaded yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "lives" && (
                <div className="prf-videos-grid">
                  {profile.uploadedLives?.length > 0 ? profile.uploadedLives.map(live => (
                    <div key={live._id} className="prf-video-card" onClick={() => navigate(`/live/${live._id}`)}>
                      <div className="prf-video-thumb">
                        {live.thumbnailUrl ? <img src={live.thumbnailUrl} alt={live.title} /> : <div className="prf-thumb-placeholder">[ LIVE ]</div>}
                        {live.isLive && <span className="prf-live-badge">LIVE</span>}
                      </div>
                      <div className="prf-video-info">
                        <h3 className="prf-video-title">{live.title}</h3>
                        <div className="prf-video-meta"><span>{live.viewers || 0} watching</span></div>
                      </div>
                    </div>
                  )) : (
                    <div className="prf-empty-state"><div className="prf-empty-label">[ NO STREAMS ]</div><p>No live streams yet</p></div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {!canViewContent && !isOwnProfile && (
          <div className="prf-private-block" style={{ borderColor: `rgba(${accentRgb},0.15)` }}>
            <div className="prf-private-label" style={{ color: accent }}>[ PRIVATE ]</div>
            <h3>This profile is private</h3>
            <p>Follow {displayName} to see their videos and content</p>
            {!followStatus.isFollowing && token && (
              <button className="prf-follow-btn" style={{ background: accent }} onClick={handleFollow} disabled={followLoading}>Follow to Unlock</button>
            )}
          </div>
        )}
      </div>

      {showFollowers && <SocialModal title="Followers" type="followers" onClose={closeSocialList} />}
      {showFollowing && <SocialModal title="Following" type="following" onClose={closeSocialList} />}
      {showTwins && <SocialModal title="Twins" type="twins" onClose={closeSocialList} />}
    </div>
  );
}

export default Profile;