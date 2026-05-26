// FILE: src/components/AdminLayout.jsx
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { user, logout, isSuperAdmin, isPlatformAdmin, isSupportAdmin } = useAppContext();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const accent = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const handleLogout = () => {
    logout();
    navigate("/admin-login");
  };

  const getAdminTitle = () => {
    if (isSuperAdmin) return "Super Admin";
    if (isPlatformAdmin) return "Platform Admin";
    if (isSupportAdmin) return "Support Admin";
    return "Admin";
  };

  const navLinks = [
    { path: "/admin/dashboard", label: "Dashboard", icon: "📊", show: true },
    { path: "/admin/users", label: "Users", icon: "👥", show: true },
    { path: "/admin/video-approvals", label: "Video Approvals", icon: "🎬", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/live-approvals", label: "Live Approvals", icon: "🔴", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/admins", label: "Admins", icon: "👑", show: isSuperAdmin },
    { path: "/admin/inactive-admins", label: "Inactive Admins", icon: "⏸️", show: isSuperAdmin },
    { path: "/admin/create-admin", label: "Create Admin", icon: "➕", show: isSuperAdmin },
    { path: "/admin/audit-logs", label: "Audit Logs", icon: "📜", show: isSuperAdmin },
    { path: "/admin/messages", label: "Messages", icon: "💬", show: true },
    { path: "/admin/message-moderation", label: "Message Moderation", icon: "✏️", show: true },
    { path: "/admin/chat", label: "Live Chat", icon: "💭", show: true },
    { path: "/admin/campaigns", label: "Campaigns", icon: "📢", show: isPlatformAdmin || isSuperAdmin },
    { path: "/admin/profile", label: "Profile", icon: "👤", show: true },
  ];

  return (
    <div className="admin-layout">
      <button 
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ background: accent }}
      >
        {sidebarOpen ? "◀" : "▶"}
      </button>

      <aside 
        className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}
        style={{ background: "#0a0a0a", borderRight: `1px solid rgba(${accentRgb}, 0.2)` }}
      >
        <div className="admin-sidebar-header" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.2)` }}>
          <div className="admin-logo" style={{ color: accent }}>NARRA</div>
          <div className="admin-role-badge" style={{ background: `rgba(${accentRgb}, 0.2)`, color: accent }}>
            {getAdminTitle()}
          </div>
        </div>

        <nav className="admin-nav">
          {navLinks.filter(link => link.show).map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="admin-nav-link"
              style={({ isActive }) => ({
                background: isActive ? `rgba(${accentRgb}, 0.15)` : "transparent",
                borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                color: isActive ? accent : "#ccc"
              })}
            >
              <span className="admin-nav-icon">{link.icon}</span>
              <span className="admin-nav-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer" style={{ borderTop: `1px solid rgba(${accentRgb}, 0.2)` }}>
          <div className="admin-user-info">
            <div className="admin-user-avatar" style={{ background: `rgba(${accentRgb}, 0.3)` }}>
              {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "A"}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.firstName} {user?.lastName}</span>
              <span className="admin-user-email">{user?.email}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn" style={{ borderColor: `rgba(${accentRgb}, 0.3)`, color: accent }}>
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