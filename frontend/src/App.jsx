// FILE: frontend/src/App.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import ProtectedRoute from "./components/ProtectedRoute";
import { MessageProvider } from "./context/MessageContext";

import Navbar from "./components/Navbar";
import AdminLayout from "./components/AdminLayout";

// Public pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VideoDetails from "./pages/VideoDetails";
import AdminLogin from "./pages/AdminLogin";
import Profile from "./pages/Profile";

// User pages
import Account from "./pages/Account";
import Upload from "./pages/Upload";
import Hub from "./pages/Hub";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Dashboard from "./pages/Dashboard";
import LiveStream from "./pages/LiveStream";
import LiveWatch from "./pages/LiveWatch";

// Admin dashboard router
import AdminDashboardRouter from "./pages/admin/AdminDashboardRouter";

// Admin pages
import UserList from "./pages/admin/UserList";
import AdminList from "./pages/admin/AdminList";
import InactiveAdmins from "./pages/admin/InactiveAdmins";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminLiveApprovals from "./pages/admin/AdminLiveApprovals";
import CreateAdmin from "./pages/admin/CreateAdmin";
import AdminVideoApprovals from "./pages/admin/AdminVideoApprovals";
import VideoModeration from "./pages/admin/VideoModeration";
import AdminMessageCenter from "./pages/admin/AdminMessageCenter";
import MessageModeration from "./pages/admin/MessageModeration";
import AdminChat from "./pages/admin/AdminChat";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminUserProfile from "./pages/admin/AdminUserProfile";
import AdminVideoDetails from "./pages/admin/AdminVideoDetails";

// Campaign management pages (internal code name: campaign; user-facing: Campaign)
import CampaignManagement from "./pages/admin/CampaignManagement";
import CampaignCreate from "./pages/admin/CampaignCreate";
import CampaignEdit from "./pages/admin/CampaignEdit";
import CampaignAnalytics from "./pages/admin/CampaignAnalytics";

function App() {
  return (
    <AuthGate>
      <MessageProvider>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<><Navbar /><Home /></>} />
          <Route path="/video/:id" element={<><Navbar /><VideoDetails /></>} />
          <Route path="/profile/:userId" element={<><Navbar /><Profile /></>} />
          <Route path="/login" element={<><Navbar /><Login /></>} />
          <Route path="/register" element={<><Navbar /><Register /></>} />
          <Route path="/forgot-password" element={<><Navbar /><ForgotPassword /></>} />
          <Route path="/reset-password/:token" element={<><Navbar /><ResetPassword /></>} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* PROTECTED USER ROUTES */}
          <Route path="/account" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Account /></>
            </ProtectedRoute>
          } />

          <Route path="/upload" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Upload /></>
            </ProtectedRoute>
          } />

          <Route path="/hub" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Hub /></>
            </ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Notifications /></>
            </ProtectedRoute>
          } />

          <Route path="/messages" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Messages /></>
            </ProtectedRoute>
          } />

          <Route path="/messages/:conversationId" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Messages /></>
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><Dashboard /></>
            </ProtectedRoute>
          } />

          <Route path="/live" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><LiveStream /></>
            </ProtectedRoute>
          } />

          <Route path="/live/:id" element={
            <ProtectedRoute allowedRoles={["user"]}>
              <><Navbar /><LiveWatch /></>
            </ProtectedRoute>
          } />

          {/* ADMIN ROUTES */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={["superadmin", "platformadmin", "supportadmin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard */}
            <Route path="dashboard/*" element={<AdminDashboardRouter />} />

            {/* Profile */}
            <Route path="profile" element={<AdminProfile />} />

            {/* User Management */}
            <Route path="users" element={<UserList />} />
            <Route path="users/:userId" element={<AdminUserProfile />} />

            {/* Video Moderation — static before dynamic */}
            <Route path="videos" element={<VideoModeration />} />
            <Route path="videos/:videoId" element={<AdminVideoDetails />} />

            {/* Admin Management */}
            <Route path="admins" element={<AdminList />} />
            <Route path="inactive-admins" element={<InactiveAdmins />} />
            <Route path="create-admin" element={<CreateAdmin />} />

            {/* Video Approvals */}
            <Route path="video-approvals" element={<AdminVideoApprovals />} />

            {/* Live Streaming */}
            <Route path="live-approvals" element={<AdminLiveApprovals />} />

            {/* Messaging */}
            <Route path="messages" element={<AdminMessageCenter />} />
            <Route path="message-moderation" element={<MessageModeration />} />
            <Route path="chat" element={<AdminChat />} />

            {/* Audit */}
            <Route path="audit-logs" element={<AdminAuditLogs />} />

            {/*
              Campaign Management
              Routes live at /admin/campaigns/* (direct access)
              AND at /admin/dashboard/campaigns/* (via AdminDashboardRouter)
              Both are needed because CampaignManagement.jsx uses navigate("/admin/campaigns/...")
            */}
            <Route path="campaigns" element={<CampaignManagement />} />
            <Route path="campaigns/create" element={<CampaignCreate />} />
            <Route path="campaigns/:id/edit" element={<CampaignEdit />} />
            <Route path="campaigns/:id/analytics" element={<CampaignAnalytics />} />

            {/* Legacy /admin/ads/* aliases — redirect to /admin/campaigns/* */}
            <Route path="ads" element={<Navigate to="/admin/campaigns" replace />} />
            <Route path="ads/create" element={<Navigate to="/admin/campaigns/create" replace />} />
            <Route path="ads/:id/edit" element={<CampaignEdit />} />
            <Route path="ads/:id/analytics" element={<CampaignAnalytics />} />

            {/* Default */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MessageProvider>
    </AuthGate>
  );
}

export default App;