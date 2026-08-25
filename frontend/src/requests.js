/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/**
 * FILE: frontend/src/requests.js
 * Complete API requests for Narra platform
 * UPDATED: Fixed admin user endpoints, added admin user profile fetch
 * FIXED: API_BASE_URL now respects VITE_API_URL for local dev,
 *        falls back to production Render URL when not set (hosted site unaffected)
 * FIXED: getUserById now uses regular user endpoint instead of admin endpoint
 * ADDED: Guest mode support with X-Guest-ID headers
 * ADDED: getHeadersWithGuest helper function for guest authentication
 */

// Use env var for local dev (e.g. http://localhost:5000), falls back to
// production Render URL for the hosted deployment when VITE_API_URL is unset.
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://narra-q4p4.onrender.com";

/*
 * AUTH_ROUTES — 401 on these means "wrong credentials", NOT "session expired".
 * We must NOT clear session storage when a user simply types the wrong password.
 */
const AUTH_ROUTES = ['/auth/login', '/auth/admin/login', '/auth/register'];

function isAuthRoute(url = '') {
  return AUTH_ROUTES.some(route => url.includes(route));
}

async function handleResponse(res) {
  if (res.status === 401) {
    // Only treat as SESSION_EXPIRED for authenticated API calls, not login attempts.
    if (isAuthRoute(res.url)) {
      // Wrong credentials — surface the server's message to the UI.
      let errorMessage = 'Invalid email or password';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch { /* keep default */ }
      throw new Error(errorMessage);
    }

    // Authenticated route returned 401 — real session expiry.
    console.error('Authentication failed (401) — session expired');
    try {
      const currentRole = sessionStorage.getItem('narra_current_role');
      if (currentRole) {
        sessionStorage.removeItem(`narra_token_${currentRole}`);
        sessionStorage.removeItem(`narra_user_${currentRole}`);
        sessionStorage.removeItem('narra_current_role');
      }
    } catch (e) {
      console.error('Error clearing session:', e);
    }
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    let errorMessage = `HTTP error ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      if (errorData.requiresAuth) throw new Error('AUTH_REQUIRED');
    } catch (e) {
      if (e.message === 'AUTH_REQUIRED') throw e;
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.text();
}

function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl, window.location.origin);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
}

function getAuthHeaders(token) {
  if (!token) return { 'Content-Type': 'application/json' };
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
}

/**
 * Get headers with guest support
 * Adds X-Guest-ID header when in guest mode
 */
function getHeadersWithGuest(token, customHeaders = {}) {
  const guestMode = localStorage.getItem('guestMode') === 'true';
  const guestId = localStorage.getItem('guestId');
  
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (guestMode && guestId) {
    headers['X-Guest-ID'] = guestId;
  }
  
  return headers;
}

function isTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch (e) {
    return true;
  }
}

function ensureAbsoluteAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) return avatarPath;
  const baseUrl = API_BASE_URL;
  return `${baseUrl}${avatarPath.startsWith('/') ? avatarPath : '/' + avatarPath}`;
}

/* ======================================================
   AUTHENTICATION
====================================================== */

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(res);
  if (data?.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
  return data;
}

export async function loginAdminUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(res);
  if (data?.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
  return data;
}

export async function registerUser(firstName, lastName, middleName, username, email, password, dateOfBirth, gender) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, middleName, username, email, password, dateOfBirth, gender }),
  });
  const data = await handleResponse(res);
  if (data?.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
  return data;
}

export async function logoutUser(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

/* ======================================================
   USER PROFILE
====================================================== */

export async function getUserProfile(token) {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, { headers: getAuthHeaders(token) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data) {
    if (data.data?.avatar) data.data.avatar = ensureAbsoluteAvatarUrl(data.data.avatar);
    if (data.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
    if (data.avatar) data.avatar = ensureAbsoluteAvatarUrl(data.avatar);
  }
  return data;
}

export async function updateUserProfile(token, profileData) {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(profileData),
  });
  const data = await handleResponse(res);
  if (data?.data?.avatar) data.data.avatar = ensureAbsoluteAvatarUrl(data.data.avatar);
  return data;
}

export async function getUserById(token, userId) {
  // Use regular user endpoint for profile viewing (not admin)
  const endpoint = `${API_BASE_URL}/api/users/${userId}`;
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  
  try {
    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      if (res.status === 403) return { success: false, message: 'Access denied', user: null };
      if (res.status === 404) return { success: false, message: 'User not found', user: null };
      if (res.status === 401) return { success: false, message: 'Authentication required', user: null };
      return { success: false, message: `Error ${res.status}`, user: null };
    }
    const data = await res.json();
    let userData = data.data || data.user || (data._id ? data : null);
    if (userData?.avatar) userData.avatar = ensureAbsoluteAvatarUrl(userData.avatar);
    return { success: true, user: userData, data: userData };
  } catch (err) {
    console.error('getUserById error:', err);
    return { success: false, message: 'Failed to fetch user', user: null };
  }
}

export async function checkUsername(token, username) {
  const res = await fetch(`${API_BASE_URL}/api/users/check-username?username=${encodeURIComponent(username)}`, {
    headers: token ? getAuthHeaders(token) : { 'Content-Type': 'application/json' },
  });
  return await res.json();
}

/* ======================================================
   FILE UPLOADS
====================================================== */

export async function uploadAvatar(token, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('avatar', file);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          let avatarUrl = response.avatarUrl || response.data?.avatar || response.url || null;
          if (avatarUrl) avatarUrl = ensureAbsoluteAvatarUrl(avatarUrl);
          resolve({ success: true, avatarUrl, message: response.message || 'Avatar uploaded', data: response.data || response });
        } catch (e) { resolve({ success: true }); }
      } else {
        let msg = `Upload failed: ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).message || msg; } catch {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE_URL}/api/uploads/avatar`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function uploadCoverImage(token, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('cover', file);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); } }
      else { let msg = `Upload failed: ${xhr.status}`; try { msg = JSON.parse(xhr.responseText).message || msg; } catch {} reject(new Error(msg)); }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE_URL}/api/uploads/cover`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function uploadVerificationDocument(token, file, documentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); } }
      else { let msg = `Upload failed: ${xhr.status}`; try { msg = JSON.parse(xhr.responseText).message || msg; } catch {} reject(new Error(msg)); }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE_URL}/api/uploads/document`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function getUploadStatus(token) {
  const res = await fetch(`${API_BASE_URL}/api/users/upload-status`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, data: null };
  return await res.json();
}

export async function deleteFile(token, fileUrl) {
  const res = await fetch(`${API_BASE_URL}/api/uploads/file`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ fileUrl }),
  });
  return await handleResponse(res);
}

/* ======================================================
   FOLLOW / TWIN
====================================================== */

export async function followUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/follow`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function unfollowUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/follow`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getFollowers(token, userId, page = 1, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/followers?page=${page}&limit=${limit}`, {
    headers: token ? getAuthHeaders(token) : { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data?.data && Array.isArray(data.data)) data.data = data.data.map(f => ({ ...f, avatar: ensureAbsoluteAvatarUrl(f.avatar) }));
  if (res.ok && data.success) return { success: true, data: data.data || [], pagination: data.pagination };
  return { success: false, data: [] };
}

export async function getFollowing(token, userId, page = 1, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/following?page=${page}&limit=${limit}`, {
    headers: token ? getAuthHeaders(token) : { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data?.data && Array.isArray(data.data)) data.data = data.data.map(u => ({ ...u, avatar: ensureAbsoluteAvatarUrl(u.avatar) }));
  if (res.ok && data.success) return { success: true, data: data.data || [], pagination: data.pagination };
  return { success: false, data: [] };
}

export async function getTwins(token, userId, page = 1, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/twins?page=${page}&limit=${limit}`, {
    headers: token ? getAuthHeaders(token) : { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data?.data && Array.isArray(data.data)) data.data = data.data.map(t => ({ ...t, avatar: ensureAbsoluteAvatarUrl(t.avatar) }));
  if (res.ok && data.success) return { success: true, data: data.data || [], pagination: data.pagination };
  return { success: false, data: [] };
}

export async function checkFollowStatus(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/follow-status`, { headers: getAuthHeaders(token) });
  return await res.json();
}

export async function getFollowSuggestions(token, limit = 10) {
  const res = await fetch(`${API_BASE_URL}/api/users/suggestions?limit=${limit}`, { headers: getAuthHeaders(token) });
  const data = await res.json();
  if (data?.data && Array.isArray(data.data)) data.data = data.data.map(u => ({ ...u, avatar: ensureAbsoluteAvatarUrl(u.avatar) }));
  if (res.ok && data.success) return { success: true, data: data.data || [] };
  return { success: false, data: [] };
}

/* ======================================================
   VIDEOS
====================================================== */

export async function getVideos(token) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/videos`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  const videos = Array.isArray(data) ? data : data.videos || [];
  return videos.map(video => ({
    ...video,
    thumbnailUrl: video.thumbnailUrl ? ensureAbsoluteAvatarUrl(video.thumbnailUrl) : null,
    videoUrl: video.videoUrl ? ensureAbsoluteAvatarUrl(video.videoUrl) : null
  }));
}

export async function getVideoById(token, videoId) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const video = data.video || data.data || data;
  if (video) {
    if (video.thumbnailUrl) video.thumbnailUrl = ensureAbsoluteAvatarUrl(video.thumbnailUrl);
    if (video.videoUrl) video.videoUrl = ensureAbsoluteAvatarUrl(video.videoUrl);
    if (video.user?.avatar) video.user.avatar = ensureAbsoluteAvatarUrl(video.user.avatar);
  }
  return video;
}

export async function getRecommendedVideos(token, currentVideoId, limit = 10) {
  try {
    const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
    let url = `${API_BASE_URL}/api/videos/recommended?limit=${limit}`;
    if (currentVideoId && typeof currentVideoId === 'string' && currentVideoId.length > 0) {
      url += `&exclude=${encodeURIComponent(currentVideoId)}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    let videos = data.videos || (Array.isArray(data) ? data : data.data) || [];
    return videos.map(video => ({
      ...video,
      thumbnailUrl: video.thumbnailUrl ? ensureAbsoluteAvatarUrl(video.thumbnailUrl) : null,
      videoUrl: video.videoUrl ? ensureAbsoluteAvatarUrl(video.videoUrl) : null,
      avatar: video.avatar ? ensureAbsoluteAvatarUrl(video.avatar) : null
    }));
  } catch (error) {
    console.error('Error fetching recommended videos:', error);
    return [];
  }
}

export async function uploadVideo(token, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); }
      } else {
        let msg = `Upload failed: ${xhr.status}`;
        try { const errBody = JSON.parse(xhr.responseText); msg = errBody.message || errBody.error || errBody.errors?.[0]?.msg || msg; } catch {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE_URL}/api/uploads/video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function getVideosByStatus(token, status, userId = null) {
  let url = `${API_BASE_URL}/api/videos/status/${status}`;
  if (userId) url += `?userId=${userId}`;
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  const data = await res.json();
  if (data?.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(video => ({
      ...video,
      thumbnailUrl: video.thumbnailUrl ? ensureAbsoluteAvatarUrl(video.thumbnailUrl) : null,
      videoUrl: video.videoUrl ? ensureAbsoluteAvatarUrl(video.videoUrl) : null
    }));
  }
  return data;
}

export async function getApprovedForRelease(token, userId = null) {
  let url = `${API_BASE_URL}/api/videos/creator/approved`;
  if (userId) url += `?userId=${userId}`;
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  const data = await res.json();
  if (data?.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(video => ({
      ...video,
      thumbnailUrl: video.thumbnailUrl ? ensureAbsoluteAvatarUrl(video.thumbnailUrl) : null,
      videoUrl: video.videoUrl ? ensureAbsoluteAvatarUrl(video.videoUrl) : null
    }));
  }
  return data;
}

export async function releaseVideo(token, videoId, price = 0, currency = 'USD', releaseAllEpisodes = false) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/release`, {
    method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ price, currency, releaseAllEpisodes }),
  });
  return await handleResponse(res);
}

export async function releaseSeriesEpisode(token, videoId, seasonNumber, episodeNumber, price = 0) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/release-episode`, {
    method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ seasonNumber, episodeNumber, price }),
  });
  return await handleResponse(res);
}

export async function updateVideoStatus(token, videoId, status, rejectionReason = '', rejectionDetails = '') {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/admin/status`, {
    method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ status, rejectionReason, rejectionDetails }),
  });
  return await handleResponse(res);
}

export async function checkVideoAccess(token, videoId) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/access`, { headers });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return { success: false, hasAccess: false, requiresAuth: true };
    return { success: false, hasAccess: false };
  }
  return await res.json();
}

export async function purchaseVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/purchase`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function watchVideo(token, videoId, seasonNumber = null, episodeNumber = null) {
  let url = `${API_BASE_URL}/api/videos/${videoId}/watch`;
  const params = new URLSearchParams();
  if (seasonNumber) params.append('seasonNumber', seasonNumber);
  if (episodeNumber) params.append('episodeNumber', episodeNumber);
  if (params.toString()) url += `?${params.toString()}`;
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 402) throw new Error('PAYMENT_REQUIRED');
    if (res.status === 401) throw new Error('AUTH_REQUIRED');
    throw new Error(`Failed to watch video: ${res.status}`);
  }
  const data = await res.json();
  if (data?.videoUrl) data.videoUrl = ensureAbsoluteAvatarUrl(data.videoUrl);
  return data;
}

/* ======================================================
   VIDEO LIKES & DISLIKES
====================================================== */

export async function likeVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/like`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function dislikeVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/dislike`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getVideoInteractionStatus(token, videoId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/interaction-status`, { headers: getAuthHeaders(token) });
    if (!res.ok) return { hasLiked: false, hasDisliked: false, likesCount: 0, dislikesCount: 0 };
    return await res.json();
  } catch (error) {
    return { hasLiked: false, hasDisliked: false, likesCount: 0, dislikesCount: 0 };
  }
}

/* ======================================================
   WATCH HISTORY
====================================================== */

export async function recordWatchProgress(token, videoId, progress, duration, seasonNumber = null, episodeNumber = null) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/progress`, {
      method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ progress, duration, seasonNumber, episodeNumber }),
    });
    if (!res.ok) return { success: true };
    return await res.json();
  } catch (error) {
    return { success: true };
  }
}

export async function getResumePosition(token, videoId, seasonNumber = null, episodeNumber = null) {
  try {
    let url = `${API_BASE_URL}/api/videos/${videoId}/resume`;
    const params = new URLSearchParams();
    if (seasonNumber !== null) params.append('seasonNumber', seasonNumber);
    if (episodeNumber !== null) params.append('episodeNumber', episodeNumber);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await fetch(url, { headers: getAuthHeaders(token) });
    if (!res.ok) return { resumePosition: 0, shouldResume: false };
    return await res.json();
  } catch (error) {
    return { resumePosition: 0, shouldResume: false };
  }
}

export async function getContinueWatching(token, limit = 10) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/history/continue-watching?limit=${limit}`, { headers: getAuthHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.continueWatching && Array.isArray(data.continueWatching)) {
      data.continueWatching = data.continueWatching.map(item => ({
        ...item, thumbnailUrl: item.thumbnailUrl ? ensureAbsoluteAvatarUrl(item.thumbnailUrl) : null,
      }));
    }
    return data.continueWatching || [];
  } catch (error) {
    return [];
  }
}

export async function getWatchHistory(token, page = 1, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/api/history?page=${page}&limit=${limit}`, { headers: getAuthHeaders(token) });
  if (!res.ok) throw new Error(`Failed to get watch history: ${res.status}`);
  const data = await res.json();
  if (data.watchHistory && Array.isArray(data.watchHistory)) {
    data.watchHistory = data.watchHistory.map(item => ({
      ...item, thumbnailUrl: item.thumbnailUrl ? ensureAbsoluteAvatarUrl(item.thumbnailUrl) : null,
    }));
  }
  return data;
}

export async function clearWatchHistory(token) {
  const res = await fetch(`${API_BASE_URL}/api/history/clear`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function deleteHistoryEntry(token, historyId) {
  const res = await fetch(`${API_BASE_URL}/api/history/${historyId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

/* ======================================================
   PLAYLISTS
====================================================== */

export async function getUserPlaylists(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/playlists`, { headers: getAuthHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.playlists || [];
  } catch (error) {
    return [];
  }
}

export async function createPlaylist(token, name, description = '', isPublic = false) {
  const res = await fetch(`${API_BASE_URL}/api/playlists`, {
    method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ name, description, isPublic }),
  });
  return await handleResponse(res);
}

export async function updatePlaylist(token, playlistId, updates) {
  const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
    method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify(updates),
  });
  return await handleResponse(res);
}

export async function deletePlaylist(token, playlistId) {
  const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function addVideoToPlaylist(token, videoId, playlistId = null, notes = '') {
  const res = await fetch(`${API_BASE_URL}/api/playlists/add`, {
    method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ playlistId, videoId, notes }),
  });
  return await handleResponse(res);
}

export async function removeVideoFromPlaylist(token, playlistId, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/video/${videoId}`, {
    method: 'DELETE', headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

export async function checkVideoSaved(token, videoId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/playlists/saved/${videoId}`, { headers: getAuthHeaders(token) });
    if (!res.ok) return { saved: false, playlists: [] };
    return await res.json();
  } catch (error) {
    return { saved: false, playlists: [] };
  }
}

export async function getPlaylistVideos(token, playlistId, page = 1, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/videos?page=${page}&limit=${limit}`, { headers: getAuthHeaders(token) });
  if (!res.ok) throw new Error(`Failed to get playlist videos: ${res.status}`);
  const data = await res.json();
  if (data.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(video => ({
      ...video,
      thumbnailUrl: video.thumbnailUrl ? ensureAbsoluteAvatarUrl(video.thumbnailUrl) : null,
      videoUrl: video.videoUrl ? ensureAbsoluteAvatarUrl(video.videoUrl) : null,
    }));
  }
  return data;
}

/* ======================================================
   SHARE
====================================================== */

export async function trackShare(token, videoId, platform) {
  try {
    const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
    const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/share`, {
      method: 'POST', headers, body: JSON.stringify({ platform }),
    });
    if (!res.ok) console.warn(`Failed to track share: ${res.status}`);
    return { success: true };
  } catch (error) {
    return { success: true };
  }
}

/* ======================================================
   COMMENTS WITH FULL NESTED REPLY SUPPORT
====================================================== */

export async function getVideoComments(videoId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/comments/video/${videoId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      console.warn(`getVideoComments failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('getVideoComments error:', error);
    return [];
  }
}

export async function addComment(token, videoId, content, parentCommentId = null, replyToUserId = null) {
  if (!content || !content.trim()) throw new Error('Comment cannot be empty');

  const body = { content: content.trim() };

  if (parentCommentId && String(parentCommentId) !== 'null' && String(parentCommentId) !== 'undefined') {
    body.parentCommentId = String(parentCommentId);
  }
  if (replyToUserId && String(replyToUserId) !== 'null' && String(replyToUserId) !== 'undefined') {
    body.replyToUserId = String(replyToUserId);
  }

  const res = await fetch(`${API_BASE_URL}/api/comments/${videoId}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });

  return await handleResponse(res);
}

export async function deleteComment(token, commentId) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

export async function likeComment(token, commentId) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}/like`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

export async function dislikeComment(token, commentId) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}/dislike`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

export async function editComment(token, commentId, content) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ content }),
  });
  return await handleResponse(res);
}

export async function getReplies(commentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/comments/replies/${commentId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.replies || [];
  } catch (error) {
    return [];
  }
}

/* ======================================================
   VIDEO MANAGEMENT (USER)
====================================================== */

export async function softDeleteVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/delete`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function restoreVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/restore`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function removeVideo(token, videoId) { return softDeleteVideo(token, videoId); }

/* ======================================================
   ADMIN VIDEO MANAGEMENT
====================================================== */

export async function adminSoftDeleteVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/remove`, { method: 'DELETE', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function adminRestoreVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/restore`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function adminPermanentDeleteVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/permanent`, { method: 'DELETE', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function adminRemoveVideo(token, videoId) { return adminSoftDeleteVideo(token, videoId); }
export async function adminPermanentDelete(token, videoId, reason = '') { return adminPermanentDeleteVideo(token, videoId, reason); }

/* ======================================================
   ADMIN USER TRASH PAGE
====================================================== */

export async function getTrashedVideos(token, filters = {}) {
  const { search = '', page = 1, limit = 20, sortBy = 'removedAt', sortOrder = 'desc' } = filters;
  const url = buildUrl(`${API_BASE_URL}/api/admin/trash/videos`, { search, page, limit, sortBy, sortOrder });
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, videos: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  const data = await res.json();
  if (data?.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(v => ({
      ...v,
      thumbnailUrl: v.thumbnailUrl ? ensureAbsoluteAvatarUrl(v.thumbnailUrl) : null,
      videoUrl: v.videoUrl ? ensureAbsoluteAvatarUrl(v.videoUrl) : null
    }));
  }
  return data;
}

export async function getTrashStats(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/trash/stats`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, stats: { total: 0, expiringSoon: 0, expired: 0 } };
  return await res.json();
}

export async function adminRestoreTrashedVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/trash/videos/${videoId}/restore`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function adminPermanentDeleteTrashedVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/trash/videos/${videoId}/permanent`, { method: 'DELETE', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function adminBulkRestoreTrashedVideos(token, videoIds) {
  const res = await fetch(`${API_BASE_URL}/api/admin/trash/videos/bulk-restore`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ videoIds }) });
  return await handleResponse(res);
}

export async function adminBulkDeleteTrashedVideos(token, videoIds, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/trash/videos/bulk-delete`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ videoIds, reason }) });
  return await handleResponse(res);
}

/* ======================================================
   ADMIN USERS
====================================================== */

export async function getUsers(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers: getAuthHeaders(token) });
  if (!res.ok) return [];
  const data = await res.json();
  let users = Array.isArray(data) ? data : (data.users || data.data || []);
  return users.map(u => ({ ...u, avatar: ensureAbsoluteAvatarUrl(u.avatar) }));
}

export async function banUser(token, userId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/ban`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function unbanUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/unban`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function verifyUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/verify`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function unverifyUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/unverify`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function deactivateUser(token, userId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/deactivate`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function activateUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/activate`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function deleteUser(token, userId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function permanentlyDeleteUser(token, userId, confirm = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/accounts/${userId}/permanent`, { method: 'DELETE', headers: getAuthHeaders(token), body: JSON.stringify({ confirm }) });
  return await handleResponse(res);
}

export async function applyShadowBanUser(token, userId, reason = '', countries = [], continents = []) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/shadow-ban`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ reason, countries, continents }) });
  return await handleResponse(res);
}

export async function removeShadowBanUser(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/remove-shadow-ban`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

/* ======================================================
   ADMIN MANAGEMENT
====================================================== */

export async function getAdmins(token, params = {}) {
  const url = buildUrl(`${API_BASE_URL}/api/admin/admins`, params);
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  if (!res.ok) return [];
  const data = await res.json();
  let admins = Array.isArray(data) ? data : (data.admins || data.data || []);
  return admins.map(a => ({ ...a, avatar: ensureAbsoluteAvatarUrl(a.avatar) }));
}

export async function createAdmin(token, adminData) {
  const res = await fetch(`${API_BASE_URL}/api/admin/admins`, { method: "POST", headers: getAuthHeaders(token), body: JSON.stringify(adminData) });
  return await handleResponse(res);
}

export async function promoteToAdmin(token, userId, role) {
  const res = await fetch(`${API_BASE_URL}/api/admin/roles/promote/${userId}`, { method: "PUT", headers: getAuthHeaders(token), body: JSON.stringify({ role }) });
  return await handleResponse(res);
}

export async function demoteAdmin(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/roles/demote/${userId}`, { method: "PUT", headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getInactiveAdmins(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/admins/inactive`, { headers: getAuthHeaders(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.admins || []).map(a => ({ ...a, avatar: ensureAbsoluteAvatarUrl(a.avatar) }));
}

export async function deactivateAdmin(token, adminId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/admins/${adminId}/deactivate`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
  });
  return await handleResponse(res);
}

export async function updateAdminRole(token, adminId, newRole) {
  const res = await fetch(`${API_BASE_URL}/api/admin/roles/promote/${adminId}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ role: newRole }),
  });
  return await handleResponse(res);
}

export async function updateUserRole(token, userId, newRole) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ role: newRole }),
  });
  return await handleResponse(res);
}

export async function getPendingVideos(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/moderation?status=pending`, {
    headers: getAuthHeaders(token),
  });
  if (!res.ok) return { success: false, videos: [] };
  const data = await res.json();
  if (data?.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(v => ({
      ...v,
      thumbnailUrl: v.thumbnailUrl ? ensureAbsoluteAvatarUrl(v.thumbnailUrl) : null,
      videoUrl: v.videoUrl ? ensureAbsoluteAvatarUrl(v.videoUrl) : null,
    }));
  }
  return data;
}

export async function getPlatformStats(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/platform/stats`, {
      headers: getAuthHeaders(token),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Primary platform stats endpoint failed:', err.message);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
      headers: getAuthHeaders(token),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Fallback platform stats endpoint failed:', err.message);
  }

  console.warn('Both platform stats endpoints failed');
  return { success: false, stats: null };
}

/* ======================================================
   AUDIT LOGS
====================================================== */

export async function getRecentAuditLogs(token, limit = 10) {
  const res = await fetch(`${API_BASE_URL}/api/admin/audit/logs/recent?limit=${limit}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, logs: [] };
  return await res.json();
}

export async function getAllAuditLogs(token, params = {}) {
  const url = buildUrl(`${API_BASE_URL}/api/admin/audit/logs`, params);
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, logs: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  return await res.json();
}

export async function getAuditFilterOptions(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/audit/filters`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, actionTypes: [], adminNames: [], targetTypes: [] };
  return await res.json();
}

export async function getAuditLogs(token, limit = 5) {
  const res = await fetch(`${API_BASE_URL}/api/admin/audit-logs?limit=${limit}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, logs: [] };
  return await res.json();
}

/* ======================================================
   VIDEO MODERATION
====================================================== */

export async function getVideosForModeration(token, status = 'pending') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/moderation?status=${status}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, videos: [] };
  const data = await res.json();
  if (data?.videos && Array.isArray(data.videos)) {
    data.videos = data.videos.map(v => ({
      ...v,
      thumbnailUrl: v.thumbnailUrl ? ensureAbsoluteAvatarUrl(v.thumbnailUrl) : null,
      videoUrl: v.videoUrl ? ensureAbsoluteAvatarUrl(v.videoUrl) : null
    }));
  }
  return data;
}

export async function getVideoModerationStats(token) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/statistics`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, stats: null };
  const data = await res.json();
  return { success: true, statistics: data.statistics || data.stats || {} };
}

export async function approveVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/approve`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function rejectVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/reject`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function restrictVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/restrict`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function removeVideoRestriction(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/remove-restriction`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function flagVideo(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/flag`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function removeVideoFlag(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/remove-flag`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function shadowBanVideo(token, videoId, reason = '', countries = [], continents = []) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/shadow-ban`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason, countries, continents }) });
  return await handleResponse(res);
}

export async function removeShadowBanVideo(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/videos/${videoId}/remove-shadow-ban`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

/* ======================================================
   ADS
====================================================== */

export async function getAds(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters.type && filters.type !== 'all') params.append('type', filters.type);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/all?${params.toString()}`, { headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getAdById(token, adId) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}`, { headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function createAd(token, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); } }
      else { let msg = `Failed: ${xhr.status}`; try { msg = JSON.parse(xhr.responseText).message || msg; } catch {} reject(new Error(msg)); }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('POST', `${API_BASE_URL}/api/ads/admin/create`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function updateAd(token, adId, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); } }
      else { let msg = `Failed: ${xhr.status}`; try { msg = JSON.parse(xhr.responseText).message || msg; } catch {} reject(new Error(msg)); }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('PUT', `${API_BASE_URL}/api/ads/admin/${adId}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function approveAd(token, adId) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}/approve`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function rejectAd(token, adId, reason) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}/reject`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function pauseAd(token, adId) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}/pause`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function resumeAd(token, adId) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}/resume`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function deleteAd(token, adId) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/${adId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getAdStats(token) {
  const res = await fetch(`${API_BASE_URL}/api/ads/admin/stats/summary`, { headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function trackAdImpression(adId, data = {}) {
  const sessionId = localStorage.getItem('sessionId') || 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  if (!localStorage.getItem('sessionId')) localStorage.setItem('sessionId', sessionId);
  const res = await fetch(`${API_BASE_URL}/api/ads/${adId}/impression`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId }, body: JSON.stringify({ ...data, sessionId }) });
  return await res.json();
}

export async function trackAdClick(adId, data = {}) {
  const sessionId = localStorage.getItem('sessionId');
  const res = await fetch(`${API_BASE_URL}/api/ads/${adId}/click`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId || '' }, body: JSON.stringify({ ...data, sessionId }) });
  return await res.json();
}

/* ======================================================
   LIVE STREAMING
====================================================== */

export async function createLiveStream(token, liveData) {
  const res = await fetch(`${API_BASE_URL}/api/lives`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify(liveData) });
  return await handleResponse(res);
}

export async function getLiveStreams(token) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/lives`, { headers });
  if (!res.ok) return { success: false, lives: [] };
  const data = await res.json();
  if (data?.lives && Array.isArray(data.lives)) {
    data.lives = data.lives.map(s => ({ ...s, thumbnailUrl: s.thumbnailUrl ? ensureAbsoluteAvatarUrl(s.thumbnailUrl) : null }));
  }
  return data;
}

export async function joinLiveStream(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/join`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function checkLiveAccess(token, liveId) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/access`, { headers });
  if (!res.ok) return { success: false, hasAccess: false };
  return await res.json();
}

export async function startLiveStream(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/start`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function stopLiveStream(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/stop`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function getLiveStreamStatus(token, liveId) {
  const headers = token ? getAuthHeaders(token) : getHeadersWithGuest(token);
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/status`, { headers });
  if (!res.ok) return { success: false, isLive: false };
  return await res.json();
}

export async function purchaseLiveAccess(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/lives/${liveId}/purchase`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

/* ======================================================
   LIVE QUALIFICATION
====================================================== */

export async function checkLiveQualification(token) {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/my-qualification`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, qualified: false };
  return await res.json();
}

export async function getUserLiveDetails(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/user/${userId}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, user: null };
  const data = await res.json();
  if (data?.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
  return data;
}

export async function setLivePrivilege(token, userId, canGoLive, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/privileges`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ userId, canGoLive, reason }) });
  return await handleResponse(res);
}

export async function addLiveStrike(token, userId, reason) {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/strikes`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ userId, reason }) });
  return await handleResponse(res);
}

export async function getUsersNeedingLiveApproval(token) {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/pending-approval`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, users: [] };
  const data = await res.json();
  if (data?.users && Array.isArray(data.users)) data.users = data.users.map(u => ({ ...u, avatar: ensureAbsoluteAvatarUrl(u.avatar) }));
  return data;
}

export async function checkUserLivePrivilege(token, userId) {
  const res = await fetch(`${API_BASE_URL}/api/live-qualification/user/${userId}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, canGoLive: false };
  const data = await res.json();
  if (data?.user?.avatar) data.user.avatar = ensureAbsoluteAvatarUrl(data.user.avatar);
  return { success: true, canGoLive: data.user?.canGoLive || false, reason: data.user?.canGoLiveReason || 'unknown', user: data.user };
}

/* ======================================================
   LIVE MODERATION
====================================================== */

export async function getLiveStreamsForModeration(token, params = {}) {
  const url = buildUrl(`${API_BASE_URL}/api/admin/live-streams`, params);
  const res = await fetch(url, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, streams: [] };
  const data = await res.json();
  if (data?.streams && Array.isArray(data.streams)) data.streams = data.streams.map(s => ({ ...s, thumbnailUrl: s.thumbnailUrl ? ensureAbsoluteAvatarUrl(s.thumbnailUrl) : null }));
  return data;
}

export async function getLiveStreamDetailsForModeration(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, stream: null };
  const data = await res.json();
  if (data?.stream?.thumbnailUrl) data.stream.thumbnailUrl = ensureAbsoluteAvatarUrl(data.stream.thumbnailUrl);
  return data;
}

export async function endLiveStreamAdmin(token, liveId, reason) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}/end`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function sendStreamWarning(token, liveId, warningData) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}/warning`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify(warningData) });
  return await handleResponse(res);
}

export async function getLiveStreamReports(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}/reports`, { headers: getAuthHeaders(token) });
  if (!res.ok) return { success: false, reports: [] };
  return await res.json();
}

export async function applyShadowBanToLive(token, liveId, reason) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}/shadow-ban`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

export async function removeShadowBanFromLive(token, liveId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/live-streams/${liveId}/remove-shadow-ban`, { method: 'POST', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function removeStrike(token, userId, strikeId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/strikes/${strikeId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function banUserFromStreaming(token, userId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/ban-streaming`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

/* ======================================================
   FUNDRAISER
====================================================== */

export async function approveFundraiser(token, videoId) {
  const res = await fetch(`${API_BASE_URL}/api/admin/fundraisers/${videoId}/approve`, { method: 'PUT', headers: getAuthHeaders(token) });
  return await handleResponse(res);
}

export async function rejectFundraiser(token, videoId, reason = '') {
  const res = await fetch(`${API_BASE_URL}/api/admin/fundraisers/${videoId}/reject`, { method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify({ reason }) });
  return await handleResponse(res);
}

/* ======================================================
   CONTENT MODERATION
====================================================== */

export async function applyShadowBanContent(token, contentId, targetType, reason = '', countries = [], continents = []) {
  const res = await fetch(`${API_BASE_URL}/api/admin/content/${contentId}/shadow-ban`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ targetType, reason, countries, continents }) });
  return await handleResponse(res);
}

export async function removeShadowBanContent(token, contentId, targetType) {
  const res = await fetch(`${API_BASE_URL}/api/admin/content/${contentId}/remove-shadow-ban`, { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ targetType }) });
  return await handleResponse(res);
}

/* ======================================================
   UTILITY
====================================================== */

export async function checkServerStatus() {
  try { const res = await fetch(`${API_BASE_URL}/api/health`); return res.ok; }
  catch { return false; }
}

export async function checkStreamingStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/streaming/status`);
    if (!res.ok) return { success: false, streamingEnabled: false };
    return await res.json();
  } catch { return { success: false, streamingEnabled: false }; }
}

export { isTokenValid, ensureAbsoluteAvatarUrl };

export default {
  loginUser, loginAdminUser, registerUser, logoutUser,
  getUserProfile, updateUserProfile, getUserById, checkUsername,
  uploadAvatar, uploadCoverImage, uploadVerificationDocument, getUploadStatus, deleteFile,
  followUser, unfollowUser, getFollowers, getFollowing, getTwins, checkFollowStatus, getFollowSuggestions,
  getVideos, getVideoById, getRecommendedVideos, uploadVideo,
  getVideosByStatus, getApprovedForRelease, releaseVideo, releaseSeriesEpisode,
  updateVideoStatus, checkVideoAccess, purchaseVideo, watchVideo,
  likeVideo, dislikeVideo, getVideoInteractionStatus,
  recordWatchProgress, getResumePosition, getContinueWatching, getWatchHistory, clearWatchHistory, deleteHistoryEntry,
  getUserPlaylists, createPlaylist, updatePlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist, checkVideoSaved, getPlaylistVideos,
  trackShare,
  getVideoComments, addComment, deleteComment, likeComment, dislikeComment, editComment, getReplies,
  softDeleteVideo, restoreVideo, removeVideo,
  adminSoftDeleteVideo, adminRestoreVideo, adminPermanentDeleteVideo, adminRemoveVideo, adminPermanentDelete,
  getTrashedVideos, getTrashStats, adminRestoreTrashedVideo, adminPermanentDeleteTrashedVideo, adminBulkRestoreTrashedVideos, adminBulkDeleteTrashedVideos,
  getUsers, banUser, unbanUser, verifyUser, unverifyUser, deactivateUser, activateUser, deleteUser,
  permanentlyDeleteUser, applyShadowBanUser, removeShadowBanUser,
  getAdmins, createAdmin, promoteToAdmin, demoteAdmin, getInactiveAdmins,
  deactivateAdmin, updateAdminRole, updateUserRole, getPendingVideos, getPlatformStats,
  getRecentAuditLogs, getAllAuditLogs, getAuditFilterOptions, getAuditLogs,
  getVideosForModeration, getVideoModerationStats, approveVideo, rejectVideo,
  restrictVideo, removeVideoRestriction, flagVideo, removeVideoFlag, shadowBanVideo, removeShadowBanVideo,
  getAds, getAdById, createAd, updateAd, approveAd, rejectAd, pauseAd, resumeAd, deleteAd, getAdStats,
  trackAdImpression, trackAdClick,
  createLiveStream, getLiveStreams, joinLiveStream, checkLiveAccess, startLiveStream,
  stopLiveStream, getLiveStreamStatus, purchaseLiveAccess,
  checkLiveQualification, getUserLiveDetails, setLivePrivilege, addLiveStrike,
  getUsersNeedingLiveApproval, checkUserLivePrivilege,
  getLiveStreamsForModeration, getLiveStreamDetailsForModeration, endLiveStreamAdmin,
  sendStreamWarning, getLiveStreamReports, applyShadowBanToLive, removeShadowBanFromLive,
  removeStrike, banUserFromStreaming,
  approveFundraiser, rejectFundraiser,
  applyShadowBanContent, removeShadowBanContent,
  checkServerStatus, checkStreamingStatus,
  isTokenValid, ensureAbsoluteAvatarUrl
};