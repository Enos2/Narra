/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
/* ======================================================
   AdminContext.jsx - Manages all admin-specific state and functions
   - User management (ban, delete, update roles)
   - Admin management (create, deactivate, change roles)
   - Video approvals (approve, reject, release)
   - Audit logs
   - Platform statistics
   
   This context ONLY loads when an admin is logged in.
   FIXED: Added token validation before fetching data
   FIXED: Added proper dependencies to useEffect
   FIXED: Added loading state for token readiness
   ===================================================== */

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { useAppContext } from './AppContext';
import {
  getUsers as _getUsers,
  getAdmins as _getAdmins,
  createAdmin as _createAdmin,
  updateAdminRole as _updateAdminRole,
  deactivateAdmin as _deactivateAdmin,
  getAuditLogs as _getAuditLogs,
  getPendingVideos as _getPendingVideos,
  approveVideo as _approveVideo,
  rejectVideo as _rejectVideo,
  getPlatformStats as _getPlatformStats,
  banUser as _banUser,
  deleteUser as _deleteUser,
  updateUserRole as _updateUserRole,
  isTokenValid,
} from "../requests";

export const AdminContext = createContext(null);

// Helper for absolute avatar URLs
const ensureAbsoluteUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const baseUrl = API_BASE.replace('/api', '');
  return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
};

export function AdminProvider({ children }) {
  const { token, user, isAdmin, isSuperAdmin, isAuthReady } = useAppContext();
  
  // State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [pendingVideos, setPendingVideos] = useState([]);
  const [pendingVideosLoading, setPendingVideosLoading] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  
  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);
  
  // Validate token when it changes
  useEffect(() => {
    if (token && typeof token === 'string' && token.length > 20) {
      // Check if token is valid format and not expired
      const isValid = isTokenValid(token);
      setIsTokenReady(isValid);
      if (!isValid) {
        console.warn('AdminContext: Token is invalid or expired');
      }
    } else {
      setIsTokenReady(false);
    }
  }, [token]);
  
  const shouldFetch = isAdmin && token && isTokenReady && isAuthReady;

  /* ======================================================
     USER MANAGEMENT (All admins can do this)
  ===================================================== */
  
  const fetchUsers = useCallback(async () => {
    if (!token || !isAdmin || !isTokenReady) {
      console.log('AdminContext: Skipping fetchUsers - not ready');
      return [];
    }
    
    setUsersLoading(true);
    try {
      console.log('👑 AdminContext: Fetching all users');
      const data = await _getUsers(token);
      const userList = Array.isArray(data) ? data : data.users || [];
      
      // Filter out admins (only regular users)
      const regularUsers = userList.filter(
        (u) => !["superadmin", "platformadmin", "supportadmin"].includes(u.role?.toLowerCase())
      );
      
      const usersWithAbsoluteAvatars = regularUsers.map(u => ({
        ...u,
        avatar: ensureAbsoluteUrl(u.avatar)
      }));
      
      setUsers(usersWithAbsoluteAvatars);
      console.log(`✅ AdminContext: Loaded ${usersWithAbsoluteAvatars.length} users`);
      return usersWithAbsoluteAvatars;
    } catch (err) {
      console.error("AdminContext fetchUsers error:", err);
      // Don't clear users on 401 - token might have expired
      if (err.message?.includes('401') || err.message?.includes('SESSION_EXPIRED')) {
        console.warn('AdminContext: Session expired, will retry on next render');
      }
      return [];
    } finally {
      setUsersLoading(false);
    }
  }, [token, isAdmin, isTokenReady]);
  
  const updateUserRole = useCallback(async (userId, newRole) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      throw new Error('Only Super Admin can change user roles');
    }
    
    try {
      console.log(`👑 AdminContext: Updating user ${userId} role to ${newRole}`);
      const result = await _updateUserRole(token, userId, newRole);
      await fetchUsers(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext updateUserRole error:', err);
      throw err;
    }
  }, [token, isSuperAdmin, isTokenReady, fetchUsers]);
  
  const banUser = useCallback(async (userId, reason, duration = 'permanent') => {
    if (!token || !isAdmin || !isTokenReady) {
      throw new Error('Admin access required');
    }
    
    try {
      console.log(`🔨 AdminContext: Banning user ${userId} - Reason: ${reason}, Duration: ${duration}`);
      const result = await _banUser(token, userId, reason, duration);
      await fetchUsers(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext banUser error:', err);
      throw err;
    }
  }, [token, isAdmin, isTokenReady, fetchUsers]);
  
  const deleteUser = useCallback(async (userId) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      throw new Error('Only Super Admin can delete users');
    }
    
    try {
      console.log(`🗑️ AdminContext: Deleting user ${userId}`);
      const result = await _deleteUser(token, userId);
      await fetchUsers(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext deleteUser error:', err);
      throw err;
    }
  }, [token, isSuperAdmin, isTokenReady, fetchUsers]);

  /* ======================================================
     ADMIN MANAGEMENT (Super Admin only)
  ===================================================== */
  
  const fetchAdmins = useCallback(async () => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      console.log('AdminContext: Skipping fetchAdmins - not super admin or not ready');
      return [];
    }
    
    setAdminsLoading(true);
    try {
      console.log('👑 AdminContext: Fetching all admins');
      const data = await _getAdmins(token);
      const adminList = Array.isArray(data) ? data : data.admins || [];
      
      const adminsWithAbsoluteAvatars = adminList.map(a => ({
        ...a,
        avatar: ensureAbsoluteUrl(a.avatar)
      }));
      
      setAdmins(adminsWithAbsoluteAvatars);
      console.log(`✅ AdminContext: Loaded ${adminsWithAbsoluteAvatars.length} admins`);
      return adminsWithAbsoluteAvatars;
    } catch (err) {
      console.error("AdminContext fetchAdmins error:", err);
      return [];
    } finally {
      setAdminsLoading(false);
    }
  }, [token, isSuperAdmin, isTokenReady]);
  
  const createAdmin = useCallback(async (adminData) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      throw new Error('Only Super Admin can create new admins');
    }
    
    try {
      console.log('👑 AdminContext: Creating new admin', adminData.email);
      const result = await _createAdmin(token, adminData);
      await fetchAdmins(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext createAdmin error:', err);
      throw err;
    }
  }, [token, isSuperAdmin, isTokenReady, fetchAdmins]);
  
  const updateAdminRole = useCallback(async (adminId, newRole) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      throw new Error('Only Super Admin can change admin roles');
    }
    
    try {
      console.log(`👑 AdminContext: Updating admin ${adminId} role to ${newRole}`);
      const result = await _updateAdminRole(token, adminId, newRole);
      await fetchAdmins(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext updateAdminRole error:', err);
      throw err;
    }
  }, [token, isSuperAdmin, isTokenReady, fetchAdmins]);
  
  const deactivateAdmin = useCallback(async (adminId) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      throw new Error('Only Super Admin can deactivate admins');
    }
    
    try {
      console.log(`🔨 AdminContext: Deactivating admin ${adminId}`);
      const result = await _deactivateAdmin(token, adminId);
      await fetchAdmins(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext deactivateAdmin error:', err);
      throw err;
    }
  }, [token, isSuperAdmin, isTokenReady, fetchAdmins]);

  /* ======================================================
     VIDEO APPROVALS (Platform Admin & Super Admin)
  ===================================================== */
  
  const fetchPendingVideos = useCallback(async () => {
    if (!token || !isAdmin || !isTokenReady) {
      console.log('AdminContext: Skipping fetchPendingVideos - not admin or not ready');
      return [];
    }
    
    setPendingVideosLoading(true);
    try {
      console.log('🎬 AdminContext: Fetching pending videos');
      const data = await _getPendingVideos(token);
      const videoList = Array.isArray(data) ? data : data.videos || [];
      
      setPendingVideos(videoList);
      console.log(`✅ AdminContext: Loaded ${videoList.length} pending videos`);
      return videoList;
    } catch (err) {
      console.error("AdminContext fetchPendingVideos error:", err);
      return [];
    } finally {
      setPendingVideosLoading(false);
    }
  }, [token, isAdmin, isTokenReady]);
  
  const approveVideo = useCallback(async (videoId, releaseNow = false, price = 0) => {
    if (!token || !isAdmin || !isTokenReady) {
      throw new Error('Admin access required');
    }
    
    try {
      console.log(`✅ AdminContext: Approving video ${videoId}, Release now: ${releaseNow}, Price: ${price}`);
      const result = await _approveVideo(token, videoId, { releaseNow, price });
      await fetchPendingVideos(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext approveVideo error:', err);
      throw err;
    }
  }, [token, isAdmin, isTokenReady, fetchPendingVideos]);
  
  const rejectVideo = useCallback(async (videoId, reason, details = '') => {
    if (!token || !isAdmin || !isTokenReady) {
      throw new Error('Admin access required');
    }
    
    try {
      console.log(`❌ AdminContext: Rejecting video ${videoId}, Reason: ${reason}`);
      const result = await _rejectVideo(token, videoId, { reason, details });
      await fetchPendingVideos(); // Refresh list
      return result;
    } catch (err) {
      console.error('AdminContext rejectVideo error:', err);
      throw err;
    }
  }, [token, isAdmin, isTokenReady, fetchPendingVideos]);

  /* ======================================================
     AUDIT LOGS (Super Admin only)
  ===================================================== */
  
  const fetchAuditLogs = useCallback(async (filters = {}) => {
    if (!token || !isSuperAdmin || !isTokenReady) {
      console.log('AdminContext: Skipping fetchAuditLogs - not super admin or not ready');
      return [];
    }
    
    setAuditLogsLoading(true);
    try {
      console.log('📋 AdminContext: Fetching audit logs', filters);
      const data = await _getAuditLogs(token, filters);
      const logs = Array.isArray(data) ? data : data.logs || [];
      
      setAuditLogs(logs);
      console.log(`✅ AdminContext: Loaded ${logs.length} audit logs`);
      return logs;
    } catch (err) {
      console.error("AdminContext fetchAuditLogs error:", err);
      return [];
    } finally {
      setAuditLogsLoading(false);
    }
  }, [token, isSuperAdmin, isTokenReady]);

  /* ======================================================
     PLATFORM STATISTICS (All admins)
  ===================================================== */
  
  const fetchPlatformStats = useCallback(async () => {
    if (!token || !isAdmin || !isTokenReady) {
      console.log('AdminContext: Skipping fetchPlatformStats - not admin or not ready');
      return null;
    }
    
    setStatsLoading(true);
    try {
      console.log('📊 AdminContext: Fetching platform stats');
      const stats = await _getPlatformStats(token);
      
      setPlatformStats(stats);
      console.log('✅ AdminContext: Platform stats loaded', stats);
      return stats;
    } catch (err) {
      console.error("AdminContext fetchPlatformStats error:", err);
      setPlatformStats(null);
      return null;
    } finally {
      setStatsLoading(false);
    }
  }, [token, isAdmin, isTokenReady]);

  /* ======================================================
     AUTO-FETCH WHEN ADMIN LOGS IN - FIXED
     Now waits for token to be ready and auth to be complete
  ===================================================== */
  
  useEffect(() => {
    // Only fetch if all conditions are met
    if (shouldFetch && !initialFetchDone.current) {
      console.log('🔄 AdminContext: Auto-fetching admin data for', user?.role);
      console.log('   Token ready:', isTokenReady);
      console.log('   Auth ready:', isAuthReady);
      
      // Mark that we've started fetching
      initialFetchDone.current = true;
      
      // Use setTimeout to ensure token is fully propagated
      const timer = setTimeout(() => {
        // All admins can fetch these
        fetchUsers();
        fetchPendingVideos();
        fetchPlatformStats();
        
        // Only Super Admin can fetch these
        if (isSuperAdmin) {
          fetchAdmins();
          fetchAuditLogs();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    } else if (!shouldFetch) {
      // Reset fetch flag when conditions are not met
      initialFetchDone.current = false;
      
      // Clear data when not admin
      setUsers([]);
      setAdmins([]);
      setPendingVideos([]);
      setAuditLogs([]);
      setPlatformStats(null);
    }
  }, [shouldFetch, isSuperAdmin, user?.role, fetchUsers, fetchPendingVideos, fetchPlatformStats, fetchAdmins, fetchAuditLogs, isTokenReady, isAuthReady]);

  /* ======================================================
     REFRESH ALL DATA
  ===================================================== */
  
  const refreshAllAdminData = useCallback(() => {
    if (shouldFetch) {
      console.log('🔄 AdminContext: Manually refreshing all admin data');
      fetchUsers();
      fetchPendingVideos();
      fetchPlatformStats();
      if (isSuperAdmin) {
        fetchAdmins();
        fetchAuditLogs();
      }
    }
  }, [shouldFetch, isSuperAdmin, fetchUsers, fetchPendingVideos, fetchPlatformStats, fetchAdmins, fetchAuditLogs]);

  /* ======================================================
     ADMIN TYPE HELPERS
  ===================================================== */
  
  const adminType = user?.role || null;
  const isPlatformAdmin = user?.role === 'platformadmin';
  const isSupportAdmin = user?.role === 'supportadmin';

  /* ======================================================
     CONTEXT VALUE
  ===================================================== */
  
  const contextValue = {
    // User management
    users,
    usersLoading,
    fetchUsers,
    updateUserRole,
    banUser,
    deleteUser,
    
    // Admin management (Super Admin only)
    admins,
    adminsLoading,
    fetchAdmins,
    createAdmin,
    updateAdminRole,
    deactivateAdmin,
    
    // Video approvals
    pendingVideos,
    pendingVideosLoading,
    fetchPendingVideos,
    approveVideo,
    rejectVideo,
    
    // Audit logs (Super Admin only)
    auditLogs,
    auditLogsLoading,
    fetchAuditLogs,
    
    // Platform stats
    platformStats,
    statsLoading,
    fetchPlatformStats,
    
    // Admin type helpers
    isSuperAdmin,
    isPlatformAdmin,
    isSupportAdmin,
    adminType,
    
    // Utility
    refreshAllAdminData,
    isTokenReady, // Expose token ready state
  };
  
  console.log('📤 AdminContext: Provider ready', {
    adminType: adminType,
    usersCount: users.length,
    adminsCount: admins.length,
    pendingVideosCount: pendingVideos.length,
    hasStats: !!platformStats,
    isSuperAdmin,
    isPlatformAdmin,
    isSupportAdmin,
    isTokenReady,
    isAuthReady
  });
  
  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
}

/* ======================================================
   HOOK
====================================================== */
export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext must be used inside <AdminProvider>");
  }
  return ctx;
}

/**
 * END OF FILE: frontend/src/context/AdminContext.jsx
 */