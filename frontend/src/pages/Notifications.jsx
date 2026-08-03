 
 /*src/pages/Notifications.jsx - Notifications page component for displaying user notifications with filtering and read/unread status.*/
 
/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { Link } from "react-router-dom";
import "./Notifications.css";

const TABS = ["All", "Admin", "Messages", "System"];

export default function Notifications() {
  const { user, token } = useAppContext();
  const { theme } = useTheme();

  const accent    = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const [activeTab, setActiveTab] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const isAdminNotification = (n) => {
    const adminActionTypes = ['video_approved','video_rejected','video_restricted','video_restriction_removed','video_flagged','video_flag_removed','video_shadow_banned','video_shadow_ban_removed','video_deleted','video_restored','APPROVE_VIDEO','REJECT_VIDEO','RESTRICT_VIDEO','REMOVE_RESTRICTION','FLAG_VIDEO','REMOVE_FLAG','SHADOW_BAN_VIDEO','REMOVE_SHADOW_BAN_VIDEO','REMOVE_VIDEO','RESTORE_VIDEO','FEATURE_VIDEO','BAN_USER','UNBAN_USER','VERIFY_USER','CREATE_ADMIN','DEACTIVATE_ADMIN','REACTIVATE_ADMIN','live_privilege_granted','live_privilege_revoked','live_strike'];
    if (n.actionType && adminActionTypes.includes(n.actionType)) return true;
    const adminTypes = ['moderation','admin','flag','video_approved','video_rejected','video_restricted','video_flagged'];
    if (n.type && adminTypes.includes(n.type)) return true;
    return false;
  };

  const isSystemNotification = (n) => {
    if (n.type === 'follow' || n.type === 'twin') return false;
    if (n.type === 'system') return true;
    if (n.type === 'message' || n.type === 'admin') return false;
    if (isAdminNotification(n)) return false;
    if (n.actionType) return false;
    return true;
  };

  // Load notifications from API only (removed MessageContext dependency)
  useEffect(() => {
    if (!token) return;
    
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/notifications/user`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (response.ok) {
          const data = await response.json();
          // Ensure we always have an array
          const notificationsList = data.notifications || [];
          setNotifications(notificationsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } else {
          setNotifications([]);
        }
      } catch (error) { 
        console.error('Error loading notifications:', error);
        setNotifications([]);
      } finally { 
        setLoading(false); 
      }
    };
    
    loadNotifications();
  }, [token, API_BASE]);

  const handleToggleExpand = async (notificationId) => {
    setExpandedId(expandedId === notificationId ? null : notificationId);
    const notification = notifications.find(n => n._id === notificationId);
    if (notification && !notification.read && notification._id) {
      await markAsRead(notificationId);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => 
          n._id === notificationId ? { ...n, read: true } : n
        ));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/mark-all-read`, { 
        method: 'PUT', 
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        } 
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (n) => {
    if (n.type === 'follow') return 'F';
    if (n.type === 'twin') return 'T';
    if (isAdminNotification(n)) return 'A';
    if (isSystemNotification(n)) return 'S';
    if (n.type === 'message') return 'M';
    return 'N';
  };

  const getNotificationMessage = (n) => {
    if (isAdminNotification(n)) {
      const actionType = n.actionType || n.type;
      const videoTitle = n.targetName || n.data?.videoTitle || 'your content';
      const adminName = n.adminName || n.triggeredBy?.name || 'an administrator';
      switch (actionType) {
        case 'video_approved': case 'APPROVE_VIDEO': return `Your video "${videoTitle}" has been approved by ${adminName}.`;
        case 'video_rejected': case 'REJECT_VIDEO': return `Your video "${videoTitle}" was not approved. Reason: ${n.reason || 'Not specified'}`;
        case 'video_restricted': case 'RESTRICT_VIDEO': return `Your video "${videoTitle}" has been restricted. Reason: ${n.reason || n.data?.reason || 'Not specified'}`;
        case 'video_flagged': case 'FLAG_VIDEO': return `Your video "${videoTitle}" has been flagged. Reason: ${n.reason || n.data?.reason || 'Not specified'}`;
        case 'live_privilege_granted': return `Admin ${adminName} granted you live streaming privileges!`;
        case 'live_privilege_revoked': return `Admin ${adminName} revoked your live streaming privileges.`;
        default: return n.description || n.message || `An admin action was performed by ${adminName}.`;
      }
    }
    if (n.type === 'follow') return `${n.triggeredBy?.name || 'Someone'} started following you!`;
    if (n.type === 'twin') return `${n.triggeredBy?.name || 'Someone'} started following you back! You are now twins!`;
    if (n.type === 'message') return n.message || `New message from ${n.triggeredBy?.name || 'Someone'}`;
    return n.message || n.description || 'New notification';
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "All") return true;
    if (activeTab === "Admin") return isAdminNotification(n);
    if (activeTab === "Messages") return n.type === 'message';
    if (activeTab === "System") return isSystemNotification(n);
    return true;
  });

  const unreadCounts = {
    All: notifications.filter(n => !n.read).length,
    Admin: notifications.filter(n => isAdminNotification(n) && !n.read).length,
    Messages: notifications.filter(n => n.type === 'message' && !n.read).length,
    System: notifications.filter(n => isSystemNotification(n) && !n.read).length
  };

  if (loading) return (
    <div className="notifications-page">
      <div className="notifications-claw-background">
        {[...Array(12)].map((_, i) => <div key={i} className={`claw claw-${i+1}`}></div>)}
      </div>
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>
      <div className="notifications-content">
        <h1 style={{ background: `linear-gradient(135deg, #fff, ${accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Notifications</h1>
        <div className="loading-spinner" style={{ borderTopColor: accent }}></div>
        <p className="loading-text">Loading notifications...</p>
      </div>
    </div>
  );

  return (
    <div className="notifications-page">
      <div className="notifications-claw-background">
        {[...Array(12)].map((_, i) => <div key={i} className={`claw claw-${i+1}`}></div>)}
      </div>
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>

      <div className="notifications-content">
        <div className="notifications-header">
          <h1 style={{ background: `linear-gradient(135deg, #fff, ${accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Notifications</h1>
          {unreadCounts.All > 0 && (
            <div className="header-actions">
              <span className="unread-count" style={{ background: `rgba(${accentRgb}, 0.2)`, color: accent }}>{unreadCounts.All} unread</span>
              <button className="mark-all-read" style={{ borderColor: `rgba(${accentRgb}, 0.4)`, color: accent }} onClick={handleMarkAllAsRead}>Mark all as read</button>
            </div>
          )}
        </div>

        <div className="notification-tabs" style={{ borderBottom: `1px solid rgba(${accentRgb}, 0.15)` }}>
          {TABS.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""}
              style={activeTab === tab ? { background: `rgba(${accentRgb}, 0.2)`, color: accent, borderColor: accent } : { borderColor: `rgba(${accentRgb}, 0.25)`, color: `rgba(${accentRgb}, 0.8)` }}
              onClick={() => { setActiveTab(tab); setExpandedId(null); }}>
              {tab}
              {unreadCounts[tab] > 0 && <span className="tab-badge" style={{ background: `rgba(${accentRgb}, 0.35)` }}>{unreadCounts[tab]}</span>}
            </button>
          ))}
        </div>

        <div className="notification-list">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state" style={{ borderColor: `rgba(${accentRgb}, 0.12)` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: `rgba(${accentRgb}, 0.4)` }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <h3>No notifications</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const isUnread = !notification.read;
              const isExpanded = expandedId === notification._id;
              const userId = notification.triggeredBy?._id || notification.data?.followerId;
              const userName = notification.triggeredBy?.name || notification.data?.followerName;

              return (
                <div key={notification._id || notification.id}
                  className={`notification-row ${isUnread ? 'unread' : 'read'} ${isExpanded ? 'expanded' : ''}`}
                  style={isUnread ? { borderLeft: `3px solid ${accent}`, background: `rgba(${accentRgb}, 0.08)` } : {}}
                  onClick={() => handleToggleExpand(notification._id)}>
                  <div className="notification-icon" style={{ background: `rgba(${accentRgb}, 0.15)` }}>
                    <span className="icon">{getNotificationIcon(notification)}</span>
                  </div>
                  <div className="notification-content">
                    <div className="notification-message">
                      <p>
                        {(notification.type === 'follow' || notification.type === 'twin') && userId ? (
                          <><Link to={`/profile/${userId}`} className="profile-link" style={{ color: accent }} onClick={(e) => e.stopPropagation()}>{userName || 'Someone'}</Link>{notification.type === 'follow' ? ' started following you!' : ' started following you back! You are now twins!'}</>
                        ) : notification.type === 'message' && userId ? (
                          <><Link to={`/profile/${userId}`} className="profile-link" style={{ color: accent }} onClick={(e) => e.stopPropagation()}>{userName || 'Someone'}</Link>{notification.message ? `: ${notification.message}` : ' sent you a message'}</>
                        ) : getNotificationMessage(notification)}
                      </p>
                    </div>
                    <div className="notification-footer">
                      <span className="time">{formatTime(notification.createdAt)}</span>
                      {notification.type === 'message' && <Link to="/messages" className="reply-link" style={{ background: `rgba(${accentRgb}, 0.12)`, color: accent }} onClick={(e) => e.stopPropagation()}>Reply</Link>}
                      <button className="expand-btn" style={{ color: `rgba(${accentRgb}, 0.6)` }} onClick={(e) => { e.stopPropagation(); handleToggleExpand(notification._id); }}>{isExpanded ? 'See less' : 'See more'}</button>
                    </div>
                    {isExpanded && (notification.reason || notification.data?.reason) && (
                      <div className="notification-expanded-details" style={{ borderTop: `1px solid rgba(${accentRgb}, 0.1)` }}>
                        <div className="details-reason"><strong style={{ color: accent }}>Reason:</strong> {notification.reason || notification.data?.reason}</div>
                        {notification.targetName && <div className="details-video"><strong style={{ color: accent }}>Video:</strong> {notification.targetName}</div>}
                      </div>
                    )}
                  </div>
                  {isUnread && <span className="unread-dot" style={{ background: accent }}></span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}