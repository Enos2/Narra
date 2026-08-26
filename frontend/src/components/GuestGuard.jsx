/* eslint-disable no-unused-vars */
/**
 * GuestGuard.jsx
 * Protects routes based on guest/authenticated status
 * FIXED: Shows the actual page content (with design) but adds an overlay for restricted actions
 * REMOVED: All emojis
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuest } from '../context/GuestContext';
import { useAppContext } from '../context/AppContext';

const GuestGuard = ({ 
  children, 
  requireAuth = false, 
  requireGuest = false,
  action = null,
  showOverlay = true
}) => {
  const { isGuest } = useGuest();
  const { isAuthReady, user, token } = useAppContext();
  const navigate = useNavigate();
  const [showRestrictedOverlay, setShowRestrictedOverlay] = useState(false);

  useEffect(() => {
    if (isAuthReady && requireGuest && token && user) {
      navigate('/');
    }
  }, [isAuthReady, requireGuest, token, user, navigate]);

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

  // If the route is for guests only and user is authenticated, redirect
  if (requireGuest && isAuthenticated) {
    navigate('/');
    return null;
  }

  // If requireAuth is true and user is a guest, show the page with overlay
  if (requireAuth && isGuest) {
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

    const message = action ? actionMessages[action] : 'Sign in to access this feature';

    return (
      <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
        {/* The actual page content - rendered with blur and reduced opacity */}
        <div style={{ 
          opacity: 0.25, 
          pointerEvents: 'none',
          filter: 'blur(6px)',
          userSelect: 'none',
          transition: 'all 0.3s ease'
        }}>
          {children}
        </div>
        
        {/* Overlay with sign-in prompt - centered on top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 999,
          padding: '20px',
          minHeight: '100vh'
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '440px',
            width: '100%',
            background: 'rgba(20, 20, 20, 0.95)',
            borderRadius: '16px',
            padding: '48px 40px',
            border: '1px solid rgba(204, 85, 0, 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          }}>
            <div style={{
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cc5500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 style={{
              color: '#fff',
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '8px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Authentication Required
            </h2>
            <p style={{
              color: '#999',
              fontSize: '14px',
              lineHeight: '1.6',
              marginBottom: '28px',
              fontFamily: 'Inter, system-ui, sans-serif'
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
                  padding: '12px 32px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #cc5500, #e67300)',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 20px rgba(204, 85, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                style={{
                  padding: '12px 32px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'transform 0.2s ease, background 0.2s ease',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.background = 'transparent';
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated or no restrictions, render children normally
  return children;
};

export default GuestGuard;