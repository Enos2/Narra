// File: frontend/src/components/Navbar.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useMessages } from "../context/MessageContext";
import { useTheme } from "../context/ThemeContext";
import { useGuest } from "../context/GuestContext";
import { useState, useEffect, useRef } from "react";
import logo from "../assets/narra-logo.png";
import "./Navbar.css";

function Navbar() {
  const { user, logout } = useAppContext();
  const { unreadCount } = useMessages();
  const { theme } = useTheme();
  const { isGuest, enableGuestMode, disableGuestMode } = useGuest();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const navbarRef = useRef(null);

  const accent = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user || !user.token) return;
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setNotificationCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target)) {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [menuOpen]);

  const closeAll = () => { setMenuOpen(false); setUserMenuOpen(false); };

  const handleLogout = () => { logout(); closeAll(); navigate("/"); };

  // Handle navigation for a tags (keep SPA behavior)
  const handleNavClick = (e, path) => {
    // If middle click or ctrl+click, allow default behavior (open in new tab)
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      return; // Let the browser handle it normally
    }
    e.preventDefault();
    navigate(path);
    closeAll();
  };

  const isActive = (path) => location.pathname === path;

  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${API_BASE}${avatarPath.startsWith('/') ? avatarPath : `/uploads/${avatarPath}`}`;
  };

  const getDisplayName = () => {
    if (user?.username) return user.username;
    if (user?.name) return user.name;
    return 'User';
  };

  const getUserInitial = () => getDisplayName().charAt(0).toUpperCase();

  const totalUnread = (unreadCount || 0) + (notificationCount || 0);
  const hasNotifications = totalUnread > 0;

  // Guest mode handlers
  const handleGuestToggle = () => {
    if (isGuest) {
      disableGuestMode();
    } else {
      enableGuestMode();
    }
    closeAll();
  };

  return (
    <nav ref={navbarRef} className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      {/* Logo - uses a tag for new tab support */}
      <a href="/" className="logo-container" onClick={(e) => handleNavClick(e, "/")}>
        <img src={logo} alt="Narra logo" />
      </a>

      <div className="nav-links desktop-only">
        <a
          href="/"
          className={`nav-link ${isActive("/") ? "active" : ""}`}
          onClick={(e) => handleNavClick(e, "/")}
        >
          <span className="link-text" style={isActive("/") ? { color: accent } : {}}>Home</span>
          <span className="link-indicator" style={isActive("/") ? { background: `linear-gradient(90deg, transparent, ${accent}, ${theme.accentLight || accent}, ${accent}, transparent)`, transform: 'translateX(-50%) scaleX(1)' } : {}} />
        </a>
        {user && (
          <>
            <a
              href="/upload"
              className={`nav-link ${isActive("/upload") ? "active" : ""}`}
              onClick={(e) => handleNavClick(e, "/upload")}
            >
              <span className="link-text" style={isActive("/upload") ? { color: accent } : {}}>Upload</span>
              <span className="link-indicator" style={isActive("/upload") ? { background: `linear-gradient(90deg, transparent, ${accent}, ${theme.accentLight || accent}, ${accent}, transparent)`, transform: 'translateX(-50%) scaleX(1)' } : {}} />
            </a>
            <a
              href="/live"
              className={`nav-link ${isActive("/live") ? "active" : ""}`}
              onClick={(e) => handleNavClick(e, "/live")}
            >
              <span className="link-text" style={isActive("/live") ? { color: accent } : {}}>Live Stream</span>
              <span className="link-indicator" style={isActive("/live") ? { background: `linear-gradient(90deg, transparent, ${accent}, ${theme.accentLight || accent}, ${accent}, transparent)`, transform: 'translateX(-50%) scaleX(1)' } : {}} />
            </a>
            <a
              href="/dashboard"
              className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
              onClick={(e) => handleNavClick(e, "/dashboard")}
            >
              <span className="link-text" style={isActive("/dashboard") ? { color: accent } : {}}>Dashboard</span>
              <span className="link-indicator" style={isActive("/dashboard") ? { background: `linear-gradient(90deg, transparent, ${accent}, ${theme.accentLight || accent}, ${accent}, transparent)`, transform: 'translateX(-50%) scaleX(1)' } : {}} />
            </a>
          </>
        )}
      </div>

      <div className="nav-right">
        {!user ? (
          <div className="auth-links desktop-only">
            {/* Guest Mode Toggle - Show before login/register */}
            <button 
              className={`guest-toggle ${isGuest ? 'active' : ''}`}
              onClick={handleGuestToggle}
              style={{
                background: isGuest ? `rgba(${accentRgb}, 0.15)` : 'transparent',
                border: `1px solid ${isGuest ? accent : 'rgba(255,255,255,0.2)'}`,
                color: isGuest ? accent : '#888',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.3s ease',
                marginRight: '8px',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = isGuest ? `rgba(${accentRgb}, 0.25)` : 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = isGuest ? `rgba(${accentRgb}, 0.15)` : 'transparent';
              }}
            >
              <span style={{ marginRight: '4px' }}>👤</span>
              {isGuest ? 'Exit Guest' : 'Guest Mode'}
            </button>

            <a href="/login" className="auth-link login" onClick={(e) => handleNavClick(e, "/login")}>
              <span>Login</span>
            </a>
            <a
              href="/register"
              className="auth-link register"
              style={{ background: `linear-gradient(135deg, rgba(${accentRgb}, 0.8), rgba(${accentRgb}, 0.9))` }}
              onClick={(e) => handleNavClick(e, "/register")}
            >
              <span>Register</span>
              <span className="btn-glow" />
            </a>
          </div>
        ) : (
          <div className="user-menu">
            <button
              className={`user-avatar-btn ${hasNotifications ? 'has-notifications' : ''}`}
              style={hasNotifications ? { background: `rgba(${accentRgb}, 0.15)` } : {}}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="User menu"
            >
              {user.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt={getDisplayName()} className="avatar-image"
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex'; }} />
              ) : null}
              <div className="avatar-fallback" style={{ display: user.avatar ? 'none' : 'flex', background: `linear-gradient(135deg, ${accent}, ${theme.accentLight || accent})` }}>
                {getUserInitial()}
              </div>
              <span className="username-display">{getDisplayName()}</span>
              {hasNotifications && (
                <span className="notification-badge avatar-badge" style={{ background: accent }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>

            {userMenuOpen && (
              <div className="user-dropdown" style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}>
                <div className="dropdown-header">
                  <div className="dropdown-user-info">
                    <div className="dropdown-avatar">
                      {user.avatar ? (
                        <img src={getAvatarUrl(user.avatar)} alt={getDisplayName()}
                          onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.querySelector('.dropdown-avatar-fallback').style.display = 'flex'; }} />
                      ) : null}
                      <div className="dropdown-avatar-fallback" style={{ display: user.avatar ? 'none' : 'flex', background: `linear-gradient(135deg, ${accent}, ${theme.accentLight || accent})` }}>
                        {getUserInitial()}
                      </div>
                    </div>
                    <div className="dropdown-user-text">
                      <span className="user-name">{getDisplayName()}</span>
                      <span className="user-email">{user.email || ''}</span>
                    </div>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <a href="/account" onClick={(e) => handleNavClick(e, "/account")}>
                  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Account Settings
                </a>
                <a href="/messages" onClick={(e) => handleNavClick(e, "/messages")} className="messages-link">
                  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Messages
                  {unreadCount > 0 && <span className="unread-badge-nav" style={{ background: accent }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </a>
                <a href="/notifications" onClick={(e) => handleNavClick(e, "/notifications")}>
                  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  Notifications
                  {notificationCount > 0 && <span className="unread-badge-nav" style={{ background: accent }}>{notificationCount > 9 ? '9+' : notificationCount}</span>}
                </a>
                <button onClick={handleLogout} className="logout-btn">
                  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Guest Badge - shown when in guest mode */}
        {isGuest && (
          <span className="guest-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: `rgba(${accentRgb}, 0.12)`,
            color: accent,
            padding: '4px 12px 4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            border: `1px solid rgba(${accentRgb}, 0.2)`,
            marginRight: '12px'
          }}>
            <span>👤</span> Guest
          </span>
        )}

        <div
          className={`hamburger mobile-only ${menuOpen ? 'active' : ''} ${hasNotifications ? 'has-notifications' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="bar" style={menuOpen ? { background: accent } : {}} />
          <div className="bar" style={menuOpen ? { background: accent } : {}} />
          <div className="bar" style={menuOpen ? { background: accent } : {}} />
          {hasNotifications && <span className="notification-badge hamburger-badge" style={{ background: accent }}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
        </div>
      </div>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} style={{ borderLeft: `1px solid rgba(${accentRgb}, 0.3)` }}>
        {user && (
          <div className="mobile-user-info">
            <div className="mobile-user-avatar">
              {user.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt={getDisplayName()}
                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.querySelector('.mobile-user-avatar-fallback').style.display = 'flex'; }} />
              ) : null}
              <div className="mobile-user-avatar-fallback" style={{ display: user.avatar ? 'none' : 'flex', background: `linear-gradient(135deg, ${accent}, ${theme.accentLight || accent})` }}>
                {getUserInitial()}
              </div>
            </div>
            <div className="mobile-user-details">
              <span className="mobile-user-name">{getDisplayName()}</span>
              <span className="mobile-user-email">{user.email || ''}</span>
            </div>
          </div>
        )}
        
        {/* Guest badge in mobile menu */}
        {isGuest && !user && (
          <div className="mobile-guest-badge" style={{
            padding: '12px 20px',
            borderBottom: `1px solid rgba(${accentRgb}, 0.1)`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '20px' }}>👤</span>
            <span style={{ 
              background: `rgba(${accentRgb}, 0.12)`,
              color: accent,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500',
              border: `1px solid rgba(${accentRgb}, 0.2)`
            }}>
              Guest Mode
            </span>
          </div>
        )}

        <div className="mobile-menu-content">
          <a href="/" onClick={(e) => handleNavClick(e, "/")}>
            <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>Home
          </a>
          
          {user && (
            <>
              <a href="/upload" onClick={(e) => handleNavClick(e, "/upload")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>Upload
              </a>
              <a href="/live" onClick={(e) => handleNavClick(e, "/live")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2" /><path d="M12 6a6 6 0 0 0-6 6" /><path d="M12 2a10 10 0 0 0-10 10" /><path d="M12 22a10 10 0 0 0 10-10" /></svg>Live Stream
              </a>
              <a href="/dashboard" onClick={(e) => handleNavClick(e, "/dashboard")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>Dashboard
              </a>
              <a href="/messages" onClick={(e) => handleNavClick(e, "/messages")} className="mobile-messages-link">
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Messages
                {unreadCount > 0 && <span className="mobile-unread-badge" style={{ background: accent }}>{unreadCount}</span>}
              </a>
            </>
          )}
          
          <div className="mobile-divider" />
          
          {!user ? (
            <>
              {/* Guest mode toggle in mobile menu */}
              <button 
                onClick={handleGuestToggle}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isGuest ? accent : '#fff',
                  padding: '12px 20px',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontFamily: 'inherit'
                }}
              >
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {isGuest ? 'Exit Guest Mode' : 'Guest Mode'}
                {isGuest && <span style={{ marginLeft: 'auto', fontSize: '12px', color: accent }}>● Active</span>}
              </button>
              <a href="/login" onClick={(e) => handleNavClick(e, "/login")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>Login
              </a>
              <a href="/register" onClick={(e) => handleNavClick(e, "/register")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="16" /><line x1="23" y1="11" x2="17" y2="11" /></svg>Register
              </a>
            </>
          ) : (
            <>
              <a href="/account" onClick={(e) => handleNavClick(e, "/account")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>Account Settings
              </a>
              <a href="/notifications" onClick={(e) => handleNavClick(e, "/notifications")}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                Notifications
                {notificationCount > 0 && <span className="mobile-unread-badge" style={{ background: accent }}>{notificationCount}</span>}
              </a>
              <button className="mobile-logout" onClick={handleLogout}>
                <svg className="mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;