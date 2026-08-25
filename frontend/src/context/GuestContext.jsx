/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
/**
 * GuestContext.jsx
 * Provides guest mode functionality for the Narra platform
 * Allows users to browse content without signing up
 * Implements rate limiting, session management, and security features
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const GuestContext = createContext();

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return context;
};

export const GuestProvider = ({ children }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const actionTimestamps = useRef({});

  // Generate a secure guest session ID
  const generateGuestSession = useCallback(() => {
    const timestamp = Date.now();
    const random1 = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    const random3 = Math.random().toString(36).substring(2, 15);
    // Create a more secure guest ID with timestamp and triple random
    return `guest_${timestamp}_${random1}_${random2}_${random3}`;
  }, []);

  // Validate guest session
  const validateGuestSession = useCallback((sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') return false;
    
    // Check format: guest_timestamp_random1_random2_random3
    const parts = sessionId.split('_');
    if (parts.length < 4) return false;
    
    const timestamp = parseInt(parts[1]);
    if (isNaN(timestamp) || timestamp <= 0) return false;
    
    // Session expires after 24 hours
    const expiryTime = 24 * 60 * 60 * 1000;
    const isExpired = (Date.now() - timestamp) > expiryTime;
    
    if (isExpired) {
      console.log('Guest session expired:', sessionId);
      return false;
    }
    
    return true;
  }, []);

  // Initialize guest mode from localStorage
  useEffect(() => {
    try {
      const guestMode = localStorage.getItem('guestMode') === 'true';
      const storedGuestId = localStorage.getItem('guestId');
      const sessionData = localStorage.getItem('guestSession');
      
      if (guestMode && storedGuestId) {
        // Validate existing session
        if (validateGuestSession(storedGuestId)) {
          setIsGuest(true);
          setGuestId(storedGuestId);
          
          if (sessionData) {
            try {
              const parsed = JSON.parse(sessionData);
              // Check if session data is still valid
              if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
                setGuestSession(parsed);
              } else {
                // Session data expired, regenerate
                const newGuestId = generateGuestSession();
                const newSession = {
                  createdAt: Date.now(),
                  expiresAt: Date.now() + (24 * 60 * 60 * 1000),
                  guestId: newGuestId,
                  lastActivity: Date.now()
                };
                localStorage.setItem('guestId', newGuestId);
                localStorage.setItem('guestSession', JSON.stringify(newSession));
                setGuestId(newGuestId);
                setGuestSession(newSession);
              }
            } catch (e) {
              // Invalid session data, regenerate
              const newGuestId = generateGuestSession();
              const newSession = {
                createdAt: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000),
                guestId: newGuestId,
                lastActivity: Date.now()
              };
              localStorage.setItem('guestId', newGuestId);
              localStorage.setItem('guestSession', JSON.stringify(newSession));
              setGuestId(newGuestId);
              setGuestSession(newSession);
            }
          } else {
            // No session data, create it
            const newSession = {
              createdAt: Date.now(),
              expiresAt: Date.now() + (24 * 60 * 60 * 1000),
              guestId: storedGuestId,
              lastActivity: Date.now()
            };
            localStorage.setItem('guestSession', JSON.stringify(newSession));
            setGuestSession(newSession);
          }
        } else {
          // Session expired, generate new one
          const newGuestId = generateGuestSession();
          const newSession = {
            createdAt: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000),
            guestId: newGuestId,
            lastActivity: Date.now()
          };
          localStorage.setItem('guestId', newGuestId);
          localStorage.setItem('guestMode', 'true');
          localStorage.setItem('guestSession', JSON.stringify(newSession));
          setIsGuest(true);
          setGuestId(newGuestId);
          setGuestSession(newSession);
        }
      }
    } catch (error) {
      console.error('Error initializing guest mode:', error);
      // Reset guest state on error
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestId');
      localStorage.removeItem('guestSession');
      setIsGuest(false);
      setGuestId(null);
      setGuestSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [generateGuestSession, validateGuestSession]);

  // Enable guest mode
  const enableGuestMode = useCallback(() => {
    try {
      const newGuestId = generateGuestSession();
      const newSession = {
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        guestId: newGuestId,
        lastActivity: Date.now()
      };
      
      localStorage.setItem('guestMode', 'true');
      localStorage.setItem('guestId', newGuestId);
      localStorage.setItem('guestSession', JSON.stringify(newSession));
      
      setIsGuest(true);
      setGuestId(newGuestId);
      setGuestSession(newSession);
      
      return true;
    } catch (error) {
      console.error('Error enabling guest mode:', error);
      return false;
    }
  }, [generateGuestSession]);

  // Disable guest mode
  const disableGuestMode = useCallback(() => {
    try {
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestId');
      localStorage.removeItem('guestSession');
      
      setIsGuest(false);
      setGuestId(null);
      setGuestSession(null);
      
      // Clear action timestamps
      actionTimestamps.current = {};
      
      return true;
    } catch (error) {
      console.error('Error disabling guest mode:', error);
      return false;
    }
  }, []);

  // Rate limiting for guest actions
  const canPerformAction = useCallback((actionType, cooldownMs = null) => {
    if (!isGuest) return true;
    
    const now = Date.now();
    const key = `guest_action_${actionType}`;
    const lastAction = actionTimestamps.current[key] || parseInt(localStorage.getItem(key) || '0');
    
    // Different cooldowns for different actions
    const cooldowns = {
      view: 1000,      // 1 second
      search: 2000,    // 2 seconds
      scroll: 500,     // 0.5 seconds
      video_load: 3000, // 3 seconds
      comment_load: 2000, // 2 seconds
      profile_view: 2000, // 2 seconds
    };
    
    const cooldown = cooldownMs || cooldowns[actionType] || 1000;
    
    if (lastAction && (now - lastAction) < cooldown) {
      return false;
    }
    
    // Update timestamps
    actionTimestamps.current[key] = now;
    localStorage.setItem(key, now.toString());
    
    return true;
  }, [isGuest]);

  // Track guest activity (extend session)
  const trackActivity = useCallback(() => {
    if (!isGuest || !guestSession) return;
    
    try {
      const sessionData = localStorage.getItem('guestSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.lastActivity = Date.now();
        // Extend session by 1 hour on activity
        session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem('guestSession', JSON.stringify(session));
        setGuestSession(session);
      }
    } catch (error) {
      // Silent fail
    }
  }, [isGuest, guestSession]);

  // Check if guest session is about to expire (within 1 hour)
  const isSessionExpiring = useCallback(() => {
    if (!isGuest || !guestSession) return false;
    const timeUntilExpiry = guestSession.expiresAt - Date.now();
    return timeUntilExpiry < 60 * 60 * 1000; // Less than 1 hour
  }, [isGuest, guestSession]);

  // Get remaining session time in minutes
  const getSessionRemaining = useCallback(() => {
    if (!isGuest || !guestSession) return 0;
    const remaining = Math.max(0, (guestSession.expiresAt - Date.now()) / 60000);
    return Math.floor(remaining);
  }, [isGuest, guestSession]);

  // Clear all guest data
  const clearGuestData = useCallback(() => {
    try {
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestId');
      localStorage.removeItem('guestSession');
      
      // Clear all guest action timestamps
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('guest_action_')) {
          localStorage.removeItem(key);
        }
      });
      
      setIsGuest(false);
      setGuestId(null);
      setGuestSession(null);
      actionTimestamps.current = {};
    } catch (error) {
      console.error('Error clearing guest data:', error);
    }
  }, []);

  const value = {
    isGuest,
    guestId,
    guestSession,
    isLoading,
    enableGuestMode,
    disableGuestMode,
    canPerformAction,
    trackActivity,
    isSessionExpiring,
    getSessionRemaining,
    clearGuestData,
    generateGuestSession,
    validateGuestSession,
  };

  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
};

export default GuestProvider;