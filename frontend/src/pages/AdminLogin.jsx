/* eslint-disable no-unused-vars */
/**
 * File: frontend/src/pages/AdminLogin.jsx
 * CINEMATIC CLAW MARK THEME - Three Admin Ranks
 * UPDATED: Full distributed claw mark background
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import "./AdminLogin.css";

// Import the admin logos
import superAdminLogo from "../assets/Admin/Super-admin.png";
import platformAdminLogo from "../assets/Admin/Platform-admin.png";
import supportAdminLogo from "../assets/Admin/Support-admin.png";
import narraLogo from "../assets/narra-logo.png";

export default function AdminLogin() {
  const { adminLogin, isAuthReady, user } = useAppContext();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isFocused, setIsFocused] = useState(null);

  useEffect(() => {
    if (isAuthReady && user) {
      const adminRoles = ["superadmin", "platformadmin", "supportadmin"];
      if (adminRoles.includes(user.role)) {
        navigate("/admin/dashboard");
      }
    }
  }, [isAuthReady, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!identifier.trim()) {
      setError("Username or email required");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Password required");
      setLoading(false);
      return;
    }

    try {
      const loggedInUser = await adminLogin(identifier.trim(), password);
      
      switch(loggedInUser.role?.toLowerCase()) {
        case 'superadmin':
          navigate("/admin/dashboard");
          break;
        case 'platformadmin':
          navigate("/admin/dashboard");
          break;
        case 'supportadmin':
          navigate("/admin/dashboard");
          break;
        default:
          navigate("/admin/dashboard");
      }
    } catch (err) {
      if (err.message.includes('Invalid credentials')) {
        setError("Invalid credentials");
      } else if (err.message.includes('banned')) {
        setError("Account banned");
      } else if (err.message.includes('deactivated')) {
        setError("Account deactivated");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password", { state: { isAdmin: true } });
  };

  return (
    <div className="admin-login-page">
      {/* Distributed Claw Mark Background */}
      <div className="admin-claw-background">
        {/* Edge claws */}
        <div className="claw claw-1"></div>
        <div className="claw claw-2"></div>
        <div className="claw claw-3"></div>
        <div className="claw claw-4"></div>
        <div className="claw claw-5"></div>
        
        {/* Center distributed claws */}
        <div className="claw claw-6"></div>
        <div className="claw claw-7"></div>
        <div className="claw claw-8"></div>
        <div className="claw claw-9"></div>
        <div className="claw claw-10"></div>
        <div className="claw claw-11"></div>
        <div className="claw claw-12"></div>
        <div className="claw claw-13"></div>
        <div className="claw claw-14"></div>
        <div className="claw claw-15"></div>
        <div className="claw claw-16"></div>
        <div className="claw claw-17"></div>
        <div className="claw claw-18"></div>
        <div className="claw claw-19"></div>
        <div className="claw claw-20"></div>
        
        {/* Diagonal scar lines */}
        <div className="scar-diagonal scar-diag-1"></div>
        <div className="scar-diagonal scar-diag-2"></div>
        <div className="scar-diagonal scar-diag-3"></div>
        <div className="scar-diagonal scar-diag-4"></div>
        <div className="scar-diagonal scar-diag-5"></div>
        <div className="scar-diagonal scar-diag-6"></div>
        <div className="scar-diagonal scar-diag-7"></div>
        <div className="scar-diagonal scar-diag-8"></div>
        <div className="scar-diagonal scar-diag-9"></div>
        <div className="scar-diagonal scar-diag-10"></div>
        
        {/* Horizontal scratch marks */}
        <div className="scratch-horizontal scratch-h-1"></div>
        <div className="scratch-horizontal scratch-h-2"></div>
        <div className="scratch-horizontal scratch-h-3"></div>
        <div className="scratch-horizontal scratch-h-4"></div>
        <div className="scratch-horizontal scratch-h-5"></div>
        <div className="scratch-horizontal scratch-h-6"></div>
        <div className="scratch-horizontal scratch-h-7"></div>
        <div className="scratch-horizontal scratch-h-8"></div>
        <div className="scratch-horizontal scratch-h-9"></div>
        <div className="scratch-horizontal scratch-h-10"></div>
        
        {/* Vertical scratch marks */}
        <div className="scratch-vertical scratch-v-1"></div>
        <div className="scratch-vertical scratch-v-2"></div>
        <div className="scratch-vertical scratch-v-3"></div>
        <div className="scratch-vertical scratch-v-4"></div>
        <div className="scratch-vertical scratch-v-5"></div>
        <div className="scratch-vertical scratch-v-6"></div>
        <div className="scratch-vertical scratch-v-7"></div>
        <div className="scratch-vertical scratch-v-8"></div>
        <div className="scratch-vertical scratch-v-9"></div>
        <div className="scratch-vertical scratch-v-10"></div>
        
        {/* Triple claw marks */}
        <div className="triple-claw triple-1"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-2"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-3"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-4"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-5"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-6"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-7"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-8"><span></span><span></span><span></span></div>
        
        {/* X-shaped scars */}
        <div className="scar-x scar-x-1"></div>
        <div className="scar-x scar-x-2"></div>
        <div className="scar-x scar-x-3"></div>
        <div className="scar-x scar-x-4"></div>
        <div className="scar-x scar-x-5"></div>
        <div className="scar-x scar-x-6"></div>
        <div className="scar-x scar-x-7"></div>
        <div className="scar-x scar-x-8"></div>
      </div>

      {/* Blood Stroke Lines */}
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>

      <div className="admin-login-container">
        {/* Left Panel - Three Admin Ranks Display */}
        <div className="admin-visual-panel">
          <div className="admin-visual-content">
            <div className="slash-marks">
              <div className="slash"></div>
              <div className="slash"></div>
              <div className="slash"></div>
            </div>
            
            <div className="logo-container">
              <img src={narraLogo} alt="Narra" className="narra-logo" />
              <div className="logo-glint"></div>
            </div>
            
            <h1 className="visual-title">ADMIN<br />SANCTUM</h1>
            <p className="visual-tagline">Three pillars of power</p>
            
            {/* Three Admin Ranks with Colors */}
            <div className="rank-triad">
              <div className="rank-card super">
                <div className="rank-glow gold"></div>
                <img src={superAdminLogo} alt="Super Admin" className="rank-logo" />
                <span className="rank-name">SUPER</span>
                <span className="rank-desc">Absolute Authority</span>
              </div>
              <div className="rank-card platform">
                <div className="rank-glow blue"></div>
                <img src={platformAdminLogo} alt="Platform Admin" className="rank-logo" />
                <span className="rank-name">PLATFORM</span>
                <span className="rank-desc">Content Control</span>
              </div>
              <div className="rank-card support">
                <div className="rank-glow green"></div>
                <img src={supportAdminLogo} alt="Support Admin" className="rank-logo" />
                <span className="rank-name">SUPPORT</span>
                <span className="rank-desc">Community Care</span>
              </div>
            </div>
            
            <div className="grip-mark"></div>
            <div className="blood-drip"></div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="admin-form-panel">
          <div className="admin-form-container">
            <div className="form-header">
              <div className="header-scar"></div>
              <h2 className="form-title">ENTER THE THRONE</h2>
              <p className="form-subtitle">Authorized personnel only</p>
            </div>

            {error && (
              <div className="alert error">
                <span className="alert-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="admin-form">
              <div className={`input-group ${isFocused === 'identifier' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type="text"
                  placeholder="Username / Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setIsFocused('identifier')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                  autoFocus
                />
                <div className="input-blood"></div>
              </div>

              <div className={`input-group ${isFocused === 'password' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFocused('password')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "✕" : "◉"}
                </button>
                <div className="input-blood"></div>
              </div>

              <div className="form-options">
                <label className="checkmark">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className="checkmark-box"></span>
                  <span className="checkmark-text">Remember me</span>
                </label>
                <button type="button" className="forgot-link" onClick={handleForgotPassword}>
                  Lost access?
                </button>
              </div>

              <button type="submit" className="submit-button" disabled={loading}>
                <span className="button-text">{loading ? "ENTERING..." : "ENTER THE THRONE"}</span>
                <span className="button-slash"></span>
              </button>
            </form>

            <div className="divider">
              <span className="divider-text">RESTRICTED ZONE</span>
              <div className="divider-line"></div>
            </div>

            <div className="back-area">
              <Link to="/login" className="back-link">← RETURN TO THE REALM</Link>
            </div>

            <div className="security-mark"></div>
          </div>
        </div>
      </div>
    </div>
  );
}