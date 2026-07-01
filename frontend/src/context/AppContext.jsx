/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-useless-catch */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-refresh/only-export-components */

/* AppContext.jsx - Manages user authentication and videos ONLY.
   Admin functions moved to AdminContext.jsx
   FIXED: Added proper token validation before setting isAuthReady
   FIXED: Added isTokenValid check from requests.js
   FIXED: Function order to prevent TDZ error with logout
   FIXED: Changed from sessionStorage to localStorage for persistent login across tabs
*/

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  getVideos as _getVideos,
  loginUser,
  loginAdminUser,
  registerUser,
  uploadVideo as _uploadVideo,
  getVideosByStatus as _getVideosByStatus,
  getApprovedForRelease as _getApprovedForRelease,
  releaseVideo as _releaseVideo,
  updateVideoStatus as _updateVideoStatus,
  getVideoById as _getVideoById,
  getUserProfile,
  isTokenValid,
} from "../requests";

/* ======================================================
   CONTEXT
====================================================== */
export const AppContext = createContext(null);

/* ======================================================
   CONSTANTS
====================================================== */
export const USER_STATUS = {
  ACTIVE: "active",
  RESTRICTED: "restricted",
  BANNED: "banned",
  PERMANENTLY_BANNED: "permanently_banned",
};

export const VIDEO_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  RELEASED: "released",
  REJECTED: "rejected",
  DRAFT: "draft",
};

// Use localStorage for persistent login across tabs
const storage = window.localStorage;

// Storage keys with role prefix
const getStorageKeys = (role) => ({
  user: `narra_user_${role}`,
  token: `narra_token_${role}`,
  role: "narra_current_role",
});

// Helper for absolute URLs
const ensureAbsoluteUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const baseUrl = API_BASE.replace("/api", "");
  return `${baseUrl}${path.startsWith("/") ? path : "/" + path}`;
};

/* ======================================================
   PROVIDER
====================================================== */
export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessionId] = useState(
    () => crypto.randomUUID?.() || Math.random().toString(36).substring(2)
  );

  // Video state
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [pendingVideos, setPendingVideos] = useState([]);
  const [approvedVideos, setApprovedVideos] = useState([]);
  const [releasedVideos, setReleasedVideos] = useState([]);
  const [rejectedVideos, setRejectedVideos] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  /* -------------------------- HELPER FUNCTIONS -------------------------- */
  const clearSession = useCallback(() => {
    try {
      Object.keys(storage).forEach((key) => {
        if (key.startsWith("narra_")) storage.removeItem(key);
      });
    } catch (error) {
      console.error("Error clearing session:", error);
    }
  }, []);

  /* -------------------------- LOGOUT (DEFINED FIRST) -------------------------- */
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
    setVideos([]);
    setPendingVideos([]);
    setApprovedVideos([]);
    setReleasedVideos([]);
    setRejectedVideos([]);
  }, [clearSession]);

  const validateToken = useCallback((tok, userData) => {
    if (!tok || !userData) return false;
    if (typeof tok !== "string" || tok.length < 10) return false;
    if (!userData.id && !userData._id) return false;
    if (!userData.role) return false;
    
    // Check if token is expired using isTokenValid from requests
    if (!isTokenValid(tok)) {
      console.warn('AppContext: Token expired or invalid');
      return false;
    }
    
    return true;
  }, []);

  /* -------------------------- LOAD SESSION -------------------------- */
  useEffect(() => {
    try {
      const currentRole = storage.getItem("narra_current_role");
      if (!currentRole) {
        setIsAuthReady(true);
        return;
      }

      const keys = getStorageKeys(currentRole);
      const storedUser = storage.getItem(keys.user);
      const storedToken = storage.getItem(keys.token);

      if (storedUser && storedToken) {
        let parsedUser = JSON.parse(storedUser);

        if (parsedUser?.avatar)
          parsedUser.avatar = ensureAbsoluteUrl(parsedUser.avatar);
        if (!parsedUser.restrictions)
          parsedUser.restrictions = { upload: false, goLive: false, comment: false };
        if (!parsedUser.status)
          parsedUser.status = "active";

        // Validate token before setting
        if (validateToken(storedToken, parsedUser) && isTokenValid(storedToken)) {
          setUser(parsedUser);
          setToken(storedToken);
          console.log('✅ AppContext: Session loaded with valid token');
        } else {
          console.warn('⚠️ AppContext: Invalid token, clearing session');
          clearSession();
        }
      } else {
        clearSession();
      }
    } catch (error) {
      console.error("Error loading session:", error);
      clearSession();
    } finally {
      setIsAuthReady(true);
    }
  }, [validateToken, clearSession]);

  /* -------------------------- SAVE SESSION -------------------------- */
  const saveSession = useCallback((userData, tokenData) => {
    try {
      if (!userData || !tokenData) return false;
      
      // Validate token before saving
      if (!isTokenValid(tokenData)) {
        console.error('AppContext: Cannot save invalid token');
        return false;
      }

      const role = (userData.role || "user").toLowerCase();
      const keys = getStorageKeys(role);

      let avatarUrl = userData.avatar ? ensureAbsoluteUrl(userData.avatar) : null;

      const normalizedUser = {
        id: userData.id || userData._id,
        _id: userData._id || userData.id,
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        middleName: userData.middleName || "",
        username: userData.username || "",
        name: userData.name || `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
        email: userData.email,
        role,
        gender: userData.gender || "",
        avatar: avatarUrl,
        bio: userData.bio || "",
        location: userData.location || "",
        website: userData.website || "",
        phoneNumber: userData.phoneNumber || "",
        dateOfBirth: userData.dateOfBirth || null,
        createdAt: userData.createdAt || new Date().toISOString(),
        isBanned: userData.isBanned || false,
        isDeactivated: userData.isDeactivated || false,
        canGoLive: userData.canGoLive || false,
        status: userData.status || (userData.isBanned ? "banned" : userData.isDeactivated ? "deactivated" : "active"),
        restrictions: {
          upload: userData.restrictions?.upload ?? false,
          goLive: userData.restrictions?.goLive ?? false,
          comment: userData.restrictions?.comment ?? false,
        },
        balance: userData.balance ?? 0,
        isVerified: userData.isVerified ?? false,
        isCreator: userData.isCreator ?? false,
        followers: userData.followers || [],
        following: userData.following || [],
        theme: userData.theme || "system",
        purchasedVideoIds: userData.purchasedVideoIds || [],
        tokenVersion: userData.tokenVersion || 0,
      };

      // Clear existing narra keys then save fresh
      Object.keys(storage).forEach((key) => {
        if (key.startsWith("narra_")) storage.removeItem(key);
      });
      storage.setItem(keys.user, JSON.stringify(normalizedUser));
      storage.setItem(keys.token, tokenData);
      storage.setItem(keys.role, role);
      storage.setItem("narra_current_role", role);

      setUser(normalizedUser);
      setToken(tokenData);
      console.log('✅ AppContext: Session saved successfully');
      return true;
    } catch (error) {
      console.error("Error saving session:", error);
      return false;
    }
  }, []);

  /* -------------------------- UPDATE USER DATA -------------------------- */
  const updateUserData = useCallback(async () => {
    if (!token) return null;
    
    // Check if token is still valid
    if (!isTokenValid(token)) {
      console.warn('AppContext: Token expired, logging out');
      logout();
      return null;
    }

    try {
      const response = await getUserProfile(token);

      let freshUserData = null;
      if (response?.success && response?.data) freshUserData = response.data;
      else if (response?.data) freshUserData = response.data;
      else if (response?.user) freshUserData = response.user;
      else if (response?._id) freshUserData = response;

      if (freshUserData) {
        const avatarUrl = freshUserData.avatar ? ensureAbsoluteUrl(freshUserData.avatar) : null;
        const role = freshUserData.role || user?.role || "user";
        const keys = getStorageKeys(role.toLowerCase());

        const normalizedUser = {
          ...freshUserData,
          id: freshUserData.id || freshUserData._id,
          _id: freshUserData._id || freshUserData.id,
          username: freshUserData.username || "",
          avatar: avatarUrl,
          firstName: freshUserData.firstName || "",
          lastName: freshUserData.lastName || "",
          restrictions: freshUserData.restrictions || { upload: false, goLive: false, comment: false },
          status: freshUserData.status || (freshUserData.isBanned ? "banned" : freshUserData.isDeactivated ? "deactivated" : "active"),
        };

        storage.setItem(keys.user, JSON.stringify(normalizedUser));
        if (token) storage.setItem(keys.token, token);
        storage.setItem(keys.role, role);
        storage.setItem("narra_current_role", role);

        setUser(normalizedUser);
        return normalizedUser;
      }
      return null;
    } catch (err) {
      console.error("Failed to update user data:", err);
      return null;
    }
  }, [token, user?.role, logout]);

  /* -------------------------- AUTH -------------------------- */
  const login = async (email, password) => {
    try {
      const data = await loginUser(email, password);
      if (["supportadmin", "platformadmin", "superadmin"].includes(data.user.role?.toLowerCase())) {
        throw new Error("Admins must use the Admin Login page");
      }
      saveSession(data.user, data.token);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  const adminLogin = async (email, password) => {
    try {
      const data = await loginAdminUser(email, password);
      const userWithNormalizedRole = {
        ...data.user,
        role: data.user.role?.toLowerCase(),
      };
      saveSession(userWithNormalizedRole, data.token);
      return userWithNormalizedRole;
    } catch (error) {
      throw error;
    }
  };

  const register = async (firstName, lastName, middleName, username, email, password, dateOfBirth, gender) => {
    try {
      const data = await registerUser(firstName, lastName, middleName, username, email, password, dateOfBirth, gender);
      saveSession(data.user, data.token);
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  /* -------------------------- VIDEOS -------------------------- */
  const fetchVideos = useCallback(async () => {
    if (!token) return;
    
    // Check token validity before making request
    if (!isTokenValid(token)) {
      console.warn('AppContext: Token expired, cannot fetch videos');
      logout();
      return;
    }
    
    setLoadingVideos(true);
    try {
      const data = await _getVideos(token);
      setVideos(data);
      const userId = user?.id || user?._id;
      if (userId) {
        setPendingVideos(data.filter(v => v.status === VIDEO_STATUS.PENDING && (v.userId === userId || v.user === userId)));
        setApprovedVideos(data.filter(v => v.status === VIDEO_STATUS.APPROVED && (v.userId === userId || v.user === userId)));
        setReleasedVideos(data.filter(v => v.status === VIDEO_STATUS.RELEASED && (v.userId === userId || v.user === userId)));
        setRejectedVideos(data.filter(v => v.status === VIDEO_STATUS.REJECTED && (v.userId === userId || v.user === userId)));
      } else {
        setPendingVideos(data.filter(v => v.status === VIDEO_STATUS.PENDING));
        setApprovedVideos(data.filter(v => v.status === VIDEO_STATUS.APPROVED));
        setReleasedVideos(data.filter(v => v.status === VIDEO_STATUS.RELEASED));
        setRejectedVideos(data.filter(v => v.status === VIDEO_STATUS.REJECTED));
      }
    } catch (err) {
      console.error("fetchVideos error:", err);
      if (err.message?.includes("401") || err.message?.includes("SESSION_EXPIRED")) {
        logout();
      }
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }, [token, user?.id, user?._id, logout]);

  useEffect(() => {
    if (token && isAuthReady && isTokenValid(token)) {
      fetchVideos();
    }
  }, [fetchVideos, token, isAuthReady]);

  const uploadVideo = useCallback(async (formData, onProgress) => {
    if (!token) throw new Error("No token available. Please log in again.");
    if (!user) throw new Error("No user data available. Please log in again.");
    if (user.restrictions?.upload === true) throw new Error("Your account cannot upload videos");
    
    if (!isTokenValid(token)) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }
    
    try {
      const result = await _uploadVideo(token, formData, onProgress);
      setTimeout(() => fetchVideos(), 1000);
      return result;
    } catch (err) {
      throw err;
    }
  }, [token, user, fetchVideos, logout]);

  const getVideosByStatus = useCallback(async (status) => {
    if (!token) return { success: false, videos: [] };
    if (!user?.id && !user?._id) return { success: false, videos: [] };
    
    if (!isTokenValid(token)) {
      logout();
      return { success: false, videos: [], message: "Session expired" };
    }
    
    try {
      const userId = user.id || user._id;
      const result = await _getVideosByStatus(token, status, userId);
      if (result.success && result.videos) {
        switch (status) {
          case "pending": setPendingVideos(result.videos); break;
          case "approved": setApprovedVideos(result.videos); break;
          case "released": setReleasedVideos(result.videos); break;
          case "rejected": setRejectedVideos(result.videos); break;
          default: break;
        }
      }
      return result;
    } catch (err) {
      console.error(`getVideosByStatus error:`, err);
      return { success: false, videos: [], message: err.message };
    }
  }, [token, user?.id, user?._id, logout]);

  const getApprovedForRelease = useCallback(async () => {
    if (!token) return { success: false, videos: [] };
    if (!user?.id && !user?._id) return { success: false, videos: [] };
    
    if (!isTokenValid(token)) {
      logout();
      return { success: false, videos: [], message: "Session expired" };
    }
    
    try {
      const userId = user.id || user._id;
      const result = await _getApprovedForRelease(token, userId);
      if (result.success && result.videos) setApprovedVideos(result.videos);
      return result;
    } catch (err) {
      console.error("getApprovedForRelease error:", err);
      return { success: false, videos: [], message: err.message };
    }
  }, [token, user?.id, user?._id, logout]);

  const releaseVideo = useCallback(async (videoId, price = 0, currency = "USD", releaseAllEpisodes = false) => {
    if (!token) throw new Error("Not authenticated");
    
    if (!isTokenValid(token)) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }
    
    try {
      const result = await _releaseVideo(token, videoId, price, currency, releaseAllEpisodes);
      setTimeout(() => {
        fetchVideos();
        if (user?.id || user?._id) {
          getVideosByStatus("approved");
          getVideosByStatus("released");
        }
      }, 500);
      return result;
    } catch (err) {
      console.error("releaseVideo error:", err);
      throw err;
    }
  }, [token, fetchVideos, getVideosByStatus, user?.id, user?._id, logout]);

  const updateVideoStatus = useCallback(async (videoId, status, rejectionReason = "", rejectionDetails = "") => {
    if (!token) throw new Error("Not authenticated");
    
    if (!isTokenValid(token)) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }
    
    try {
      const result = await _updateVideoStatus(token, videoId, status, rejectionReason, rejectionDetails);
      setTimeout(() => fetchVideos(), 500);
      return result;
    } catch (err) {
      console.error("updateVideoStatus error:", err);
      throw err;
    }
  }, [token, fetchVideos, logout]);

  const getVideoById = useCallback(async (videoId) => {
    if (!token) return null;
    
    if (!isTokenValid(token)) {
      logout();
      return null;
    }
    
    try {
      return await _getVideoById(token, videoId);
    } catch (err) {
      console.error("getVideoById error:", err);
      return null;
    }
  }, [token, logout]);

  /* -------------------------- PERMISSIONS -------------------------- */
  const isAdmin = ["supportadmin", "platformadmin", "superadmin"].includes(user?.role);
  const isSuperAdmin = user?.role === "superadmin";
  const isActive = user && !user.isBanned && !user.isDeactivated && (user.status === USER_STATUS.ACTIVE || !user.status);
  const canUpload = isActive && user?.restrictions?.upload !== true;
  const canGoLive = isActive && (user?.canGoLive === true || user?.role !== "user") && user?.restrictions?.goLive !== true;
  const canComment = isActive && user?.restrictions?.comment !== true;

  /* -------------------------- NOTIFICATIONS -------------------------- */
  const addNotification = (notification) => {
    setNotifications((p) => [
      {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
        isRead: false,
        createdAt: Date.now(),
        ...notification,
      },
      ...p,
    ]);
  };

  const refreshAllData = useCallback(() => {
    if (token && isTokenValid(token)) {
      fetchVideos();
      updateUserData();
    }
  }, [token, fetchVideos, updateUserData]);

  // Cross-tab logout - listen for storage changes across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "narra_current_role" && !e.newValue) logout();
      // Also handle if token is removed from another tab
      if (e.key?.startsWith("narra_token_") && !e.newValue) {
        logout();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [logout]);

  // Periodic token validation (every 60 seconds)
  useEffect(() => {
    if (!token) return;
    
    const interval = setInterval(() => {
      if (!isTokenValid(token)) {
        console.warn('AppContext: Token expired during periodic check');
        logout();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [token, logout]);

  /* -------------------------- CONTEXT VALUE -------------------------- */
  const contextValue = {
    // Auth
    user,
    token,
    isAuthReady,
    login,
    adminLogin,
    register,
    logout,
    updateUserData,

    // Constants
    USER_STATUS,
    VIDEO_STATUS,

    // Permissions
    isAdmin,
    isSuperAdmin,
    canUpload,
    canGoLive,
    canComment,

    // Video functions
    uploadVideo,
    getVideosByStatus,
    getApprovedForRelease,
    releaseVideo,
    updateVideoStatus,
    getVideoById,

    // Video state
    videos,
    fetchVideos,
    loadingVideos,
    pendingVideos,
    approvedVideos,
    releasedVideos,
    rejectedVideos,

    // Notifications
    notifications,
    addNotification,

    // Utility
    refreshAllData,
    sessionId,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

/* ======================================================
   HOOKS
====================================================== */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}

export function useAuth() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAuth must be used inside <AppProvider>");
  const { user, token, login, logout, adminLogin, register, updateUserData } = ctx;
  return { user, token, login, logout, adminLogin, register, updateUserData };
}

/**
 * END OF FILE: frontend/src/context/AppContext.jsx
 */