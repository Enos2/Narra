/**
 * FILE: frontend/src/App.jsx
 * Main App component with routing configuration
 * ADDED: AdminUserTrash route for managing deleted user videos
 * ADDED: AdminConversationDetail route for viewing individual conversations
 * ADDED: AdminUserProfileTest route for debugging
 * ADDED: AdminDetails route for viewing admin profile details
 * FIXED: Admin login route changed to /admin-login
 * ADDED: Dynamic page titles based on current route
 * FIXED: Added /messages/:conversationId route so opening a conversation doesn't fall through to the catch-all redirect
 */

import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { MessageProvider } from "./context/MessageContext";
import { AppProvider } from "./context/AppContext";
import { AdminProvider } from "./context/AdminContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthGate from "./components/AuthGate";
import Navbar from "./components/Navbar";
import AdminLayout from "./components/AdminLayout";
import "./App.css";

// Lazy load pages for better performance
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const VideoDetails = lazy(() => import("./pages/VideoDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const Account = lazy(() => import("./pages/Account"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const LiveStream = lazy(() => import("./pages/LiveStream"));
const LiveWatch = lazy(() => import("./pages/LiveWatch"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Hub = lazy(() => import("./pages/Hub"));

// Admin pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const SuperAdminDashboard = lazy(() => import("./pages/Admin/SuperAdminDashboard"));
const PlatformAdminDashboard = lazy(() => import("./pages/Admin/PlatformAdminDashboard"));
const SupportAdminDashboard = lazy(() => import("./pages/Admin/SupportAdminDashboard"));
const AdminDashboardRouter = lazy(() => import("./pages/Admin/AdminDashboardRouter"));
const AdminVideoApprovals = lazy(() => import("./pages/Admin/AdminVideoApprovals"));
const AdminVideoDetails = lazy(() => import("./pages/Admin/AdminVideoDetails"));
const AdminList = lazy(() => import("./pages/Admin/AdminList"));
const AdminDetails = lazy(() => import("./pages/Admin/AdminDetails"));
const CreateAdmin = lazy(() => import("./pages/Admin/CreateAdmin"));
const InactiveAdmins = lazy(() => import("./pages/Admin/InactiveAdmins"));
const UserList = lazy(() => import("./pages/Admin/UserList"));
const AdminUserProfile = lazy(() => import("./pages/Admin/AdminUserProfile"));
const AdminUserProfileTest = lazy(() => import("./pages/Admin/AdminUserProfileTest"));
const AdminProfile = lazy(() => import("./pages/Admin/AdminProfile"));
const AdminChat = lazy(() => import("./pages/Admin/AdminChat"));
const AdminMessageCenter = lazy(() => import("./pages/Admin/AdminMessageCenter"));
const AdminConversationDetail = lazy(() => import("./pages/Admin/AdminConversationDetail"));
const AdminAuditLogs = lazy(() => import("./pages/Admin/AdminAuditLogs"));
const CampaignManagement = lazy(() => import("./pages/Admin/CampaignManagement"));
const CampaignCreate = lazy(() => import("./pages/Admin/CampaignCreate"));
const CampaignEdit = lazy(() => import("./pages/Admin/CampaignEdit"));
const CampaignAnalytics = lazy(() => import("./pages/Admin/CampaignAnalytics"));
const AdminLiveApprovals = lazy(() => import("./pages/Admin/AdminLiveApprovals"));
const MessageModeration = lazy(() => import("./pages/Admin/MessageModeration"));
const VideoModeration = lazy(() => import("./pages/Admin/VideoModeration"));
const AdminUserTrash = lazy(() => import("./pages/Admin/AdminUserTrash"));

/**
 * Error Boundary Component
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          background: '#000',
          color: '#fff'
        }}>
          <h1 style={{ color: '#ff6b6b' }}>Something went wrong</h1>
          <p>Please refresh the page or try again later.</p>
          <pre style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '1rem' }}>
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#ff6b6b',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Component that updates the page title based on current route
 */
function PageTitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const pageNames = {
      '/': 'Home',
      '/upload': 'Upload',
      '/dashboard': 'Dashboard',
      '/login': 'Login',
      '/register': 'Register',
      '/live': 'Live Stream',
      '/messages': 'Messages',
      '/notifications': 'Notifications',
      '/account': 'Account',
      '/profile': 'Profile',
      '/hub': 'Hub',
      '/forgot-password': 'Forgot Password',
      '/admin-login': 'Admin Login',
      '/admin': 'Admin Panel',
      '/video/': 'Video',
      '/reset-password/': 'Reset Password',
    };

    let pageName = 'Narra Sea';
    const currentPath = location.pathname;

    // Check exact matches first
    for (const [path, name] of Object.entries(pageNames)) {
      if (currentPath === path) {
        pageName = `${name} - Narra Sea`;
        break;
      }
    }

    // Check for dynamic routes (like /video/:id)
    if (pageName === 'Narra Sea') {
      for (const [path, name] of Object.entries(pageNames)) {
        if (currentPath.startsWith(path) && path.length > 1) {
          pageName = `${name} - Narra Sea`;
          break;
        }
      }
    }

    document.title = pageName;
  }, [location]);

  return null;
}

/**
 * Main App Component
 */
function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AppProvider>
            <AdminProvider>
              <MessageProvider>
                <AuthGate>
                  <Suspense fallback={<div className="loading-screen">Loading...</div>}>
                    <PageTitleUpdater />
                    <Routes>
                      {/* Admin Login - no layout - FIXED: changed to /admin-login */}
                      <Route path="/admin-login" element={<AdminLogin />} />
                      
                      {/* Admin Routes - with AdminLayout */}
                      <Route path="/admin" element={
                        <ProtectedRoute requireAdmin>
                          <AdminLayout />
                        </ProtectedRoute>
                      }>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboardRouter />} />
                        <Route path="super-admin" element={<SuperAdminDashboard />} />
                        <Route path="platform-admin" element={<PlatformAdminDashboard />} />
                        <Route path="support-admin" element={<SupportAdminDashboard />} />
                        <Route path="video-approvals" element={<AdminVideoApprovals />} />
                        <Route path="video-approvals/:id" element={<AdminVideoDetails />} />
                        <Route path="video-moderation" element={<VideoModeration />} />
                        <Route path="video-moderation/:id" element={<AdminVideoDetails />} />
                        <Route path="user-trash" element={<AdminUserTrash />} />
                        <Route path="admins" element={<AdminList />} />
                        <Route path="admins/create" element={<CreateAdmin />} />
                        <Route path="admins/inactive" element={<InactiveAdmins />} />
                        <Route path="admin-details/:id" element={<AdminDetails />} />
                        <Route path="users" element={<UserList />} />
                        <Route path="users/:id" element={<AdminUserProfile />} />
                        {/* TEST ROUTE - Remove after debugging */}
                        <Route path="users-test/:id" element={<AdminUserProfileTest />} />
                        <Route path="profile" element={<AdminProfile />} />
                        <Route path="chat" element={<AdminChat />} />
                        <Route path="messages" element={<AdminMessageCenter />} />
                        <Route path="messages/:type/:convId" element={<AdminConversationDetail />} />
                        <Route path="audit-logs" element={<AdminAuditLogs />} />
                        <Route path="campaigns" element={<CampaignManagement />} />
                        <Route path="campaigns/create" element={<CampaignCreate />} />
                        <Route path="campaigns/:id/edit" element={<CampaignEdit />} />
                        <Route path="campaigns/:id/analytics" element={<CampaignAnalytics />} />
                        <Route path="live-approvals" element={<AdminLiveApprovals />} />
                        <Route path="message-moderation" element={<MessageModeration />} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                      </Route>
                      
                      {/* Public Routes - with Navbar */}
                      <Route path="/" element={<><Navbar /><Outlet /></>}>
                        <Route index element={<Home />} />
                        <Route path="login" element={<Login />} />
                        <Route path="register" element={<Register />} />
                        <Route path="forgot-password" element={<ForgotPassword />} />
                        <Route path="reset-password/:token" element={<ResetPassword />} />
                        <Route path="video/:id" element={<VideoDetails />} />
                        <Route path="profile/:userId?" element={<Profile />} />
                        <Route path="hub" element={<Hub />} />
                        <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                        <Route path="upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                        <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                        <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                        <Route path="messages/:conversationId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                        <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                        <Route path="live" element={<ProtectedRoute><LiveStream /></ProtectedRoute>} />
                        <Route path="live/:id" element={<LiveWatch />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </AuthGate>
              </MessageProvider>
            </AdminProvider>
          </AppProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;