// FILE: src/components/AdminLayout.jsx
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useState, useEffect } from "react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { user, logout } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Get role from user object
  const role = user?.role || "superadmin";
  
  // Role-based accent colors
  const getRoleAccent = () => {
    switch(role) {
      case "superadmin": return "#FFD700";
      case "platformadmin": return "#3B82F6";
      case "supportadmin": return "#22c55e";
      default: return "#FFD700";
    }
  };

  const getRoleAccentRgb = () => {
    switch(role) {
      case "superadmin": return "255, 215, 0";
      case "platformadmin": return "59, 130, 246";
      case "supportadmin": return "34, 197, 94";
      default: return "255, 215, 0";
    }
  };

  const getAdminTitle = () => {
    switch(role) {
      case "superadmin": return "SUPER ADMIN";
      case "platformadmin": return "PLATFORM ADMIN";
      case "supportadmin": return "SUPPORT ADMIN";
      default: return "ADMIN";
    }
  };

  const accent = getRoleAccent();
  const accentRgb = getRoleAccentRgb();

  const isSuperAdmin = role === "superadmin";
  const isPlatformAdmin = role === "platformadmin";
  const isSupportAdmin = role === "supportadmin";

  const handleLogout = () => {
    logout();
    navigate("/admin-login");
  };

  // Listen for closeSidebar event from video panel
  useEffect(() => {
    const handleCloseSidebar = () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('closeSidebar', handleCloseSidebar);
    return () => window.removeEventListener('closeSidebar', handleCloseSidebar);
  }, [sidebarOpen]);

  // Listen for panel state changes from video panel
  useEffect(() => {
    const handlePanelStateChange = (e) => {
      if (e.detail?.isOpen && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('videoPanelStateChange', handlePanelStateChange);
    return () => window.removeEventListener('videoPanelStateChange', handlePanelStateChange);
  }, [sidebarOpen]);

  // CORRECTED: Fixed paths for all routes
  const navLinks = [
    { path: "/admin/dashboard", label: "Dashboard", show: true },
    { path: "/admin/users", label: "Users", show: true },
    { path: "/admin/video-approvals", label: "Video Approvals", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/video-moderation", label: "Video Moderation", show: isPlatformAdmin || isSuperAdmin || isSupportAdmin },
    { path: "/admin/user-trash", label: "User Trash", show: isPlatformAdmin || isSuperAdmin || isSupportAdmin },
    { path: "/admin/live-approvals", label: "Live Approvals", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/admins", label: "Admins", show: isSuperAdmin },
    { path: "/admin/admins/inactive", label: "Inactive Admins", show: isSuperAdmin },
    { path: "/admin/admins/create", label: "Create Admin", show: isSuperAdmin },
    { path: "/admin/audit-logs", label: "Audit Logs", show: isSuperAdmin },
    { path: "/admin/messages", label: "Messages", show: true },
    { path: "/admin/message-moderation", label: "Message Moderation", show: true },
    { path: "/admin/chat", label: "Live Chat", show: true },
    { path: "/admin/campaigns", label: "Campaigns", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/profile", label: "Profile", show: true },
  ];

  // Helper function to check if a link is active
  const isLinkActive = (linkPath) => {
    if (linkPath === "/admin/messages") {
      // Messages tab should be active for /admin/messages AND any /admin/messages/:type/:convId
      return location.pathname === linkPath || location.pathname.startsWith("/admin/messages/");
    }
    return location.pathname === linkPath;
  };

  const getIconSvg = (label) => {
    switch(label) {
      case "Dashboard":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        );
      case "Users":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "Video Approvals":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="16" height="12" rx="2" />
            <path d="M22 8l-4 4 4 4" />
          </svg>
        );
      case "Video Moderation":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        );
      case "User Trash":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
            <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
          </svg>
        );
      case "Live Approvals":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        );
      case "Admins":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 4 8 12 8 12s8-8 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        );
      case "Inactive Admins":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        );
      case "Create Admin":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      case "Audit Logs":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case "Messages":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case "Message Moderation":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case "Live Chat":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        );
      case "Campaigns":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 6L12 13 2 6" />
            <path d="M22 13L12 20 2 13" />
            <path d="M22 20L12 27 2 20" transform="translate(0, -3)" />
          </svg>
        );
      case "Profile":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    if (newState) {
      window.dispatchEvent(new CustomEvent('closeVideoPanel'));
    }
  };

  return (
    <div className="admin-layout">
      <button 
        className="admin-sidebar-toggle"
        onClick={toggleSidebar}
        style={{ background: accent }}
      >
        <svg className="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={sidebarOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </button>

      <aside 
        className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}
        style={{ 
          background: "#000000", 
          borderRight: `1px solid rgba(${accentRgb}, 0.15)`
        }}
      >
        <div className="admin-sidebar-header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.15)` }}>
          <div className="admin-logo" style={{ color: accent }}>NARRA</div>
          <div className="admin-role-badge" style={{ background: `rgba(${accentRgb}, 0.12)`, color: accent }}>
            {getAdminTitle()}
          </div>
        </div>

        <nav className="admin-nav">
          {navLinks.filter(link => link.show).map((link) => {
            const isActive = isLinkActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className="admin-nav-link"
                style={{
                  background: isActive ? `rgba(${accentRgb}, 0.1)` : "transparent",
                  borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                  color: isActive ? accent : "rgba(255,255,255,0.7)"
                }}
              >
                <span className="admin-nav-icon">
                  {getIconSvg(link.label)}
                </span>
                <span className="admin-nav-label">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer" style={{ borderTop: `1px solid rgba(${accentRgb}, 0.15)` }}>
          <div className="admin-user-info">
            <div className="admin-user-avatar" style={{ background: `rgba(${accentRgb}, 0.15)`, color: accent }}>
              {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "A"}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.firstName} {user?.lastName}</span>
              <span className="admin-user-email">{user?.email}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn" style={{ borderColor: `rgba(${accentRgb}, 0.25)`, color: accent }}>
            <svg className="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/**
 * END OF FILE: frontend/src/components/AdminLayout.jsx
 */