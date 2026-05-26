// FILE: src/pages/admin/AdminDashboardRouter.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

// Import dashboard components (create these or use placeholders)
import SuperAdminDashboard from "./SuperAdminDashboard";
import PlatformAdminDashboard from "./PlatformAdminDashboard";
import SupportAdminDashboard from "./SupportAdminDashboard";

export default function AdminDashboardRouter() {
  const { user } = useAppContext();
  const role = user?.role;

  if (role === "superadmin") {
    return <SuperAdminDashboard />;
  }
  
  if (role === "platformadmin") {
    return <PlatformAdminDashboard />;
  }
  
  if (role === "supportadmin") {
    return <SupportAdminDashboard />;
  }
  
  return <Navigate to="/admin" replace />;
}