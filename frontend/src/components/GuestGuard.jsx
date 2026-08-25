/* eslint-disable no-unused-vars */
/**
 * GuestGuard.jsx
 * Protects routes based on guest/authenticated status
 * Shows appropriate messages for restricted actions
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuest } from '../context/GuestContext';
import { useAppContext } from '../context/AppContext';

const GuestGuard = ({ 
  children, 
  requireAuth = false, 
  requireGuest = false,
  showMessage = true,
  fallback = null,
  action = null // For specific actions like 'like', 'comment', 'upload'
}) => {
  const { isGuest } = useGuest();
  const { isAuthReady, user, token } = useAppContext();
  const navigate = useNavigate();

  // If auth is still loading, show nothing or a loader
  if (!isAuthReady) {
    return (
      <div className="guest-guard-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: '#666'
      }}>
        <span>Loading...</span>
      </div>
    );
  }

  const isAuthenticated = !!token && !!user;

  // If route requires authentication and user is a guest
  if (requireAuth && isGuest) {
    if (fallback) return fallback;
    
    // Specific action messages
    const actionMessages = {
      like: 'Sign in to like this video',
      comment: 'Sign in to comment',
      upload: 'Sign in to upload videos',
      live: 'Sign in to go live',
      follow: 'Sign in to follow users',
      save: 'Sign in to save videos',
      purchase: 'Sign in to purchase content',
      profile: 'Sign in to view your profile',
      messages: 'Sign in to view messages',
      notifications: 'Sign in to view notifications',
      dashboard: 'Sign in to access your dashboard',
      account: 'Sign in to manage your account',
      playlist: 'Sign in to create playlists',
    };

    const message = action ? actionMessages[action] : 'Please sign in to access this feature';

    return (
      <div className="guest-restricted" style={{
        textAlign: 'center',
        padding: '60px 20px',
        maxWidth: '500px',
        margin: '40px auto',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          display: 'block'
        }}>
          🔒
        </div>
        <h2 style={{
          marginBottom: '12px',
          color: '#fff',
          fontSize: '22px',
          fontWeight: '600'
        }}>
          Authentication Required
        </h2>
        <p style={{
          color: '#999',
          marginBottom: '24px',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 28px',
              border: 'none',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #cc5500, #e67300)',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '10px 28px',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              background: 'transparent',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  // If route is for guests only and user is authenticated
  if (requireGuest && isAuthenticated) {
    navigate('/');
    return null;
  }

  return children;
};

export default GuestGuard;