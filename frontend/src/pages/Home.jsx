/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import VideoCard from '../components/VideoCard';
import UserVideoPreview from '../components/UserVideoPreview';
import SpotlightBanner from '../components/SpotlightBanner';
import './Home.css';

const EyeIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: 4, verticalAlign: '-1px', flexShrink: 0 }}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

function Home() {
  const { user, token } = useAppContext();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [movies,         setMovies]         = useState([]);
  const [series,         setSeries]         = useState([]);
  const [liveStreams,    setLiveStreams]     = useState([]);
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [currentSlide,   setCurrentSlide]   = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeTab,      setActiveTab]      = useState('all');
  const [showAuthModal,  setShowAuthModal]  = useState(false);
  const [selectedVideo,  setSelectedVideo]  = useState(null);
  const [showPreview,    setShowPreview]    = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults,  setSearchResults]  = useState({ videos: [], users: [] });

  const movieScrollRef    = useRef(null);
  const seriesScrollRef   = useRef(null);
  const liveScrollRef     = useRef(null);
  const followingScrollRef = useRef(null);
  const slideInterval     = useRef(null);
  const slideLock         = useRef(false);
  const abortControllerRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const accent      = theme.accent;
  const accentLight = theme.accentLight || theme.accent;
  const accentRgb   = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const scrollLeft  = (ref) => { if (ref.current) ref.current.scrollBy({ left: -280, behavior: 'smooth' }); };
  const scrollRight = (ref) => { if (ref.current) ref.current.scrollBy({ left: 280,  behavior: 'smooth' }); };

  const [showScrollButtons, setShowScrollButtons] = useState({
    movies: false, series: false, live: false, following: false,
  });

  const checkScrollButtons = (ref, type) => {
    if (ref.current) {
      const { scrollWidth, clientWidth } = ref.current;
      setShowScrollButtons(prev => ({ ...prev, [type]: scrollWidth > clientWidth }));
    }
  };

  useEffect(() => {
    const refs = [
      { ref: movieScrollRef,     type: 'movies' },
      { ref: seriesScrollRef,    type: 'series' },
      { ref: liveScrollRef,      type: 'live' },
      { ref: followingScrollRef, type: 'following' },
    ];
    const handlers = [];
    refs.forEach(({ ref, type }) => {
      if (ref.current) {
        const handler = () => checkScrollButtons(ref, type);
        ref.current.addEventListener('scroll', handler);
        handlers.push({ ref: ref.current, handler });
        checkScrollButtons(ref, type);
      }
    });
    return () => { handlers.forEach(({ ref, handler }) => ref.removeEventListener('scroll', handler)); };
  }, [movies, series, liveStreams]);

  const goToSlide = useCallback((nextIndex) => {
    if (isTransitioning || nextIndex === currentSlide || slideLock.current) return;
    slideLock.current = true;
    setIsTransitioning(true);
    setPrevSlideIndex(currentSlide);
    setCurrentSlide(nextIndex);
    setTimeout(() => { setPrevSlideIndex(null); setIsTransitioning(false); slideLock.current = false; }, 750);
  }, [currentSlide, isTransitioning]);

  useEffect(() => {
    if (trendingVideos.length > 1) {
      if (slideInterval.current) clearInterval(slideInterval.current);
      slideInterval.current = setInterval(() => {
        if (!slideLock.current && !isTransitioning) {
          setCurrentSlide(prev => {
            const next = (prev + 1) % trendingVideos.length;
            setPrevSlideIndex(prev);
            setIsTransitioning(true);
            setTimeout(() => { setPrevSlideIndex(null); setIsTransitioning(false); }, 750);
            return next;
          });
        }
      }, 6000);
      return () => { if (slideInterval.current) clearInterval(slideInterval.current); };
    }
  }, [trendingVideos.length, isTransitioning]);

  const nextSlide = () => goToSlide((currentSlide + 1) % trendingVideos.length);
  const prevSlide = () => goToSlide((currentSlide - 1 + trendingVideos.length) % trendingVideos.length);

  const fetchContent = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      setError(null);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const fetchVideos = async (type, status = 'released', limit = 20) => {
        try {
          const params = new URLSearchParams({ type, status, limit, sortBy: 'views', sortOrder: 'desc' });
          const res = await fetch(`${API_BASE}/api/videos?${params}`, { headers, signal });
          if (!res.ok) return [];
          const data = await res.json();
          return data.videos?.filter(v => !v.isDeleted) || [];
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          return [];
        }
      };

      const fetchLiveStreams = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/lives`, { headers, signal });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.lives || []).map(live => ({
            ...live,
            type: 'live',
            status: live.status,
            isLive: live.status === 'live',
            creator: live.host,
            thumbnailUrl: live.thumbnailUrl || '',
            views: live.totalViews || 0,
            viewerCount: live.viewerCount || live.viewers?.length || 0,
            playbackUrl: live.playbackUrl || live.hlsUrl || null,
            _id: live._id,
          }));
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          return [];
        }
      };

      const [moviesData, seriesData, liveData] = await Promise.all([
        fetchVideos('movie', 'released', 20),
        fetchVideos('series', 'released', 20),
        fetchLiveStreams(),
      ]);

      setMovies(moviesData);
      setSeries(seriesData);
      setLiveStreams(liveData);

      const top5Movies = moviesData.slice(0, 5);
      const top5Series = seriesData.slice(0, 5);
      const mixedTrending = [...top5Movies, ...top5Series];
      for (let i = mixedTrending.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mixedTrending[i], mixedTrending[j]] = [mixedTrending[j], mixedTrending[i]];
      }
      setTrendingVideos(mixedTrending);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('fetchContent error:', err);
        setError('Failed to load content');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => {
    fetchContent();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, [fetchContent]);

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`, { headers });
        if (res.ok) { const data = await res.json(); setSearchResults(data); setShowSearchResults(true); }
      } catch (err) { console.error('Search error:', err); }
    }
  };

  const enrichVideoForPreview = (video) => ({
    ...video,
    thumbnailUrl: getFullUrl(video.thumbnailUrl),
    videoUrl: getFullUrl(video.videoUrl),
    creatorName: video.creator?.name || video.creator?.username || video.creatorName || 'Unknown Creator',
    creatorAvatar: getFullUrl(video.creator?.avatar) || video.creatorAvatar || null,
  });

  const handleVideoClick = (video) => {
    if (!user) { setSelectedVideo(video); setShowAuthModal(true); return; }
    if (video.type === 'live' || video.isLive) { navigate(`/live/${video._id}`); return; }
    setSelectedVideo(enrichVideoForPreview(video));
    setShowPreview(true);
  };

  const handleAuthModalClose = () => { setShowAuthModal(false); setSelectedVideo(null); };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const getFullUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url.startsWith('/') ? url : `/uploads/${url}`}`;
  };

  const getFollowingContent = useCallback(() => {
    if (!user || !user.following) return [];
    const followingIds = user.following.map(id => id.toString());
    const followingMovies = movies.filter(m => followingIds.includes(m.creator?._id?.toString() || m.creator?.toString()));
    const followingSeries = series.filter(s => followingIds.includes(s.creator?._id?.toString() || s.creator?.toString()));
    const followingLives = liveStreams.filter(l => followingIds.includes(l.creator?._id?.toString() || l.host?._id?.toString() || l.creator?.toString()));
    const all = [...followingMovies, ...followingSeries, ...followingLives];
    return all.sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt));
  }, [user, movies, series, liveStreams]);

  const renderLiveCard = (live) => (
    <div key={live._id} className="video-card-wrapper live-card-wrapper" onClick={() => handleVideoClick(live)} style={{ cursor: 'pointer' }}>
      <div className="live-home-card">
        <div className="live-home-thumb">
          {live.thumbnailUrl ? <img src={getFullUrl(live.thumbnailUrl)} alt={live.title} /> : <div className="live-home-thumb-placeholder" />}
          {live.isLive && <div className="live-home-badge"><span className="live-home-dot" />LIVE</div>}
          {live.isLive && (
            <div className="live-home-viewers">
              <EyeIcon />
              {live.viewerCount || 0}
            </div>
          )}
        </div>
        <div className="live-home-info">
          <p className="live-home-title">{live.title}</p>
          <p className="live-home-host">{live.host?.username || live.host?.firstName || live.creator?.username || 'Streamer'}</p>
          {live.category && <span className="live-home-category">{live.category}</span>}
        </div>
      </div>
    </div>
  );

  const renderRow = (title, items, type, scrollRef) => {
    if (!items || items.length === 0) return null;
    const isLiveRow = type === 'live';
    return (
      <section className="content-row" key={type}>
        <div className="row-header">
          <h2 className="row-title">
            {title}
            {isLiveRow && items.some(l => l.isLive) && <span className="live-row-dot" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />}
            <span className="row-count">{items.length}</span>
          </h2>
          {showScrollButtons[type] && (
            <div className="row-scroll-buttons">
              <button className="scroll-arrow scroll-left" style={{ background: `rgba(${accentRgb}, 0.8)`, borderColor: `rgba(${accentRgb}, 0.5)` }} onClick={() => scrollLeft(scrollRef)} aria-label="Scroll left">&lsaquo;</button>
              <button className="scroll-arrow scroll-right" style={{ background: `rgba(${accentRgb}, 0.8)`, borderColor: `rgba(${accentRgb}, 0.5)` }} onClick={() => scrollRight(scrollRef)} aria-label="Scroll right">&rsaquo;</button>
            </div>
          )}
        </div>
        <div className="row-content" ref={scrollRef} style={{ overflowX: 'auto', scrollBehavior: 'smooth' }}>
          {isLiveRow
            ? items.slice(0, 20).map(renderLiveCard)
            : items.slice(0, 20).map((item) => (
                <div key={item._id} className="video-card-wrapper">
                  <VideoCard
                    video={{ ...item, thumbnailUrl: getFullUrl(item.thumbnailUrl), videoUrl: getFullUrl(item.videoUrl), title: item.title, creator: item.creator, isLive: item.status === 'live', requiresAuth: !user }}
                    onClick={() => handleVideoClick(item)}
                    isAuthenticated={!!user}
                    user={user}
                    token={token}
                  />
                </div>
              ))
          }
        </div>
      </section>
    );
  };

  const getContentToDisplay = () => {
    if (activeTab === 'movie')   return renderRow('Movies', movies, 'movies', movieScrollRef);
    if (activeTab === 'series')  return renderRow('Series', series, 'series', seriesScrollRef);
    if (activeTab === 'live')    return renderRow('Live Now', liveStreams, 'live', liveScrollRef);
    if (activeTab === 'following') {
      const fc = getFollowingContent();
      if (!user) return (
        <div className="no-content-full">
          <div className="no-content-icon" />
          <h3>Sign in to see following content</h3>
          <p>Follow creators to see their latest videos here</p>
          <button onClick={() => navigate('/login')} style={{ borderColor: accent, color: accent }}>Sign In</button>
        </div>
      );
      if (fc.length === 0) return (
        <div className="no-content-full">
          <div className="no-content-icon" />
          <h3>No following content yet</h3>
          <p>Follow creators to see their movies, series, and live streams here</p>
          <button onClick={() => setActiveTab('all')} style={{ borderColor: accent, color: accent }}>Browse Content</button>
        </div>
      );
      return renderRow('Following', fc, 'following', followingScrollRef);
    }
    return (
      <>
        {renderRow('Movies', movies, 'movies', movieScrollRef)}
        <SpotlightBanner placement="between-rows" token={token} />
        {renderRow('Series', series, 'series', seriesScrollRef)}
        <SpotlightBanner placement="between-rows" token={token} />
        {liveStreams.length > 0 && renderRow('Live Now ', liveStreams, 'live', liveScrollRef)}
      </>
    );
  };

  const renderSearchResults = () => {
    if (!showSearchResults || !searchQuery.trim()) return null;
    const hasResults = searchResults.videos?.length > 0 || searchResults.users?.length > 0;
    return (
      <div className="search-results-dropdown">
        <div className="search-results-header">
          <h3>SEARCH RESULTS</h3>
          <button className="close-results" onClick={() => setShowSearchResults(false)}>x</button>
        </div>
        {!hasResults ? (
          <div className="no-results">No results found for "{searchQuery}"</div>
        ) : (
          <>
            {searchResults.users?.length > 0 && (
              <div className="results-section">
                <h4 className="section-title">CREATORS</h4>
                <div className="users-list">
                  {searchResults.users.map(u => (
                    <div key={u._id} className="user-result-item" onClick={() => handleUserClick(u._id)}>
                      <div className="user-avatar">
                        {u.avatar ? <img src={getFullUrl(u.avatar)} alt={u.name} /> : <span>{u.name?.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div className="user-info">
                        <span className="user-name">{u.name}</span>
                        <span className="user-email">{u.email}</span>
                      </div>
                      {u.isVerified && <span className="verified-badge">v</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {searchResults.videos?.length > 0 && (
              <div className="results-section">
                <h4 className="section-title">VIDEOS</h4>
                <div className="videos-list">
                  {searchResults.videos.map(v => (
                    <div key={v._id} className="video-result-item" onClick={() => handleVideoClick(v)}>
                      <div className="video-thumbnail">
                        <img src={getFullUrl(v.thumbnailUrl)} alt={v.title} />
                        {v.type === 'movie'  && <span className="video-type-badge">Movie</span>}
                        {v.type === 'series' && <span className="video-type-badge series">Series</span>}
                      </div>
                      <div className="video-info">
                        <span className="video-title">{v.title}</span>
                        <span className="video-creator">by {v.creator?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="home-page">
      <div className="claw-background">
        <div className="claw claw-1" /><div className="claw claw-2" />
        <div className="claw claw-3" /><div className="claw claw-4" />
        <div className="claw claw-5" /><div className="claw claw-6" />
        <div className="claw claw-7" /><div className="claw claw-8" />
        <div className="claw claw-9" /><div className="claw claw-10" />
        <div className="claw claw-11" /><div className="claw claw-12" />
        <div className="scar-diagonal scar-diag-1" /><div className="scar-diagonal scar-diag-2" />
        <div className="scar-diagonal scar-diag-3" /><div className="scar-diagonal scar-diag-4" />
        <div className="scratch-horizontal scratch-h-1" /><div className="scratch-horizontal scratch-h-2" />
        <div className="scratch-horizontal scratch-h-3" /><div className="scratch-horizontal scratch-h-4" />
        <div className="scratch-horizontal scratch-h-5" />
        <div className="scratch-vertical scratch-v-1" /><div className="scratch-vertical scratch-v-2" />
        <div className="scratch-vertical scratch-v-3" /><div className="scratch-vertical scratch-v-4" />
        <div className="triple-claw triple-1"><span /><span /><span /></div>
        <div className="triple-claw triple-2"><span /><span /><span /></div>
        <div className="triple-claw triple-3"><span /><span /><span /></div>
        <div className="triple-claw triple-4"><span /><span /><span /></div>
        <div className="scar-x scar-x-1" /><div className="scar-x scar-x-2" /><div className="scar-x scar-x-3" />
      </div>

      <div className="blood-stroke top" />
      <div className="blood-stroke bottom" />

      {!loading && trendingVideos.length > 0 && (
        <section className="hero-slider-section">
          <div className="slider-container">
            <div className="slider-track">
              {trendingVideos.map((video, idx) => {
                const isActive = idx === currentSlide;
                const isPrev   = idx === prevSlideIndex;
                const contentType = video.type === 'movie' ? 'MOVIE' : 'SERIES';
                return (
                  <div key={video._id} className={`hero-slide${isActive ? ' active' : ''}${isPrev ? ' prev' : ''}`}>
                    <div className="hero-backdrop">
                      <img src={getFullUrl(video.thumbnailUrl) || '/default-hero.jpg'} alt={video.title} className="hero-backdrop-image" loading="eager" />
                      <div className="hero-overlay-bottom" />
                      <div className="hero-overlay-left" />
                    </div>
                    <div className="hero-content">
                      <div className="hero-text">
                        <div className="hero-badge" style={{ borderLeft: `3px solid ${accent}` }}>
                          <span className="badge-scar" style={{ background: accent }} />
                          {contentType} · TRENDING NOW
                        </div>
                        <h1 className="hero-title">{video.title}</h1>
                        <p className="hero-description">
                          {video.description?.substring(0, 120) || 'Watch this amazing content on Narra'}
                          {video.description?.length > 120 ? '...' : ''}
                        </p>
                        <div className="hero-meta">
                          <span className="hero-creator" style={{ color: accentLight }}>by {video.creator?.name || 'Creator'}</span>
                          <span className="hero-views">{video.views?.toLocaleString() || 0} views</span>
                          {video.ageRating && <span className="hero-age">{video.ageRating}</span>}
                        </div>
                        <button className="hero-cta" style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }} onClick={() => handleVideoClick(video)}>
                          Watch Now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="slider-arrow prev" onClick={prevSlide} aria-label="Previous slide">&lsaquo;</button>
            <button className="slider-arrow next" onClick={nextSlide} aria-label="Next slide">&rsaquo;</button>
            <div className="slider-indicators">
              {trendingVideos.map((_, idx) => (
                <button key={idx} className={`indicator-dot ${idx === currentSlide ? 'active' : ''}`}
                  style={idx === currentSlide ? { background: accent, width: '56px' } : {}}
                  onClick={() => goToSlide(idx)} aria-label={`Go to slide ${idx + 1}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      <div style={{ padding: '0 2rem' }}>
        <SpotlightBanner placement="home-banner" token={token} />
      </div>

      <div className="search-section">
        <div className="search-filter-bar" style={{ borderColor: accent }}>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search movies, series, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
              className="search-input"
              aria-label="Search"
            />
            {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">x</button>}
          </div>

          <button
            className={`filter-btn following-btn ${activeTab === 'following' ? 'active' : ''}`}
            style={activeTab === 'following' ? { background: accent, color: '#fff' } : { borderColor: accent, color: accentLight }}
            onClick={() => setActiveTab('following')}
          >
            Following
          </button>

          <div className="filter-buttons" role="tablist">
            {['all', 'movie', 'series', 'live'].map(tab => (
              <button key={tab}
                className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                style={activeTab === tab ? { background: accent, color: '#fff' } : {}}
                onClick={() => setActiveTab(tab)}
                role="tab" aria-selected={activeTab === tab}
              >
                {tab === 'all' ? 'All' : tab === 'movie' ? 'Movies' : tab === 'series' ? 'Series' : ' Live'}
              </button>
            ))}
          </div>
        </div>
        {renderSearchResults()}
      </div>

      <div className="home-content-wrapper">
        {error && (
          <div className="error-message" style={{ borderLeft: `3px solid ${accent}` }}>
            <span>Warning</span>
            <span>{error}</span>
            <button onClick={fetchContent} style={{ borderColor: accent, color: accentLight }}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" style={{ borderTopColor: accent }} />
            <p>Loading content...</p>
          </div>
        ) : (
          <div className="content-rows">
            {getContentToDisplay()}
            {movies.length === 0 && series.length === 0 && liveStreams.length === 0 && activeTab !== 'following' && (
              <div className="no-content-full">
                <div className="no-content-icon" />
                <h3>No content found</h3>
                <p>{searchQuery ? `No matches for "${searchQuery}"` : 'Check back later for new content!'}</p>
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ borderColor: accent, color: accentLight }}>Clear Search</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {showAuthModal && selectedVideo && (
        <div className="auth-modal-overlay" onClick={handleAuthModalClose}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ borderColor: accent }}>
            <button className="auth-modal-close" onClick={handleAuthModalClose} aria-label="Close">x</button>
            <div className="auth-modal-content">
              <div className="auth-modal-icon" />
              <h2>Join Narra</h2>
              <p>Sign in to watch this content and discover more.</p>
              <div className="auth-modal-buttons">
                <button onClick={() => navigate('/login')} style={{ borderColor: accent, color: accentLight }}>Log In</button>
                <button onClick={() => navigate('/register')} style={{ background: accent }}>Create Account</button>
              </div>
              <button className="auth-modal-later" onClick={handleAuthModalClose}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && user && !selectedVideo.isLive && (
        <UserVideoPreview
          video={selectedVideo}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onWatch={(video) => { setShowPreview(false); navigate(`/watch/${video._id}`); }}
          user={user}
        />
      )}
    </div>
  );
}

export default Home;