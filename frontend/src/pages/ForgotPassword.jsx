/* eslint-disable no-unused-vars */
/**
 * File: frontend/src/pages/ForgotPassword.jsx
 * Updated to use ThemeContext accent color
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import logo from "../assets/narra-logo.png";
import "./ForgotPassword.css";

function ForgotPassword() {
  const { forgotPassword } = useAppContext();
  const { theme } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const accent = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(""); setMessage(""); setLoading(true);
    try {
      const res = await forgotPassword(identifier.trim());
      setMessage(res.message || "Reset link sent to your email");
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="forgot-password-page">
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>
      <div className="claw-background">
        <div className="claw claw-1"></div><div className="claw claw-2"></div>
        <div className="claw claw-3"></div><div className="claw claw-4"></div>
        <div className="claw claw-5"></div>
      </div>

      <div className="forgot-container" style={{ borderColor: `rgba(${accentRgb}, 0.3)`, boxShadow: `0 0 50px rgba(${accentRgb}, 0.1)` }}>
        <div className="forgot-visual-panel" style={{ borderRight: `1px solid rgba(${accentRgb}, 0.3)` }}>
          <div className="forgot-visual-content">
            <div className="slash-marks">
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
            </div>
            <div className="logo-container">
              <img src={logo} alt="Narra" className="narra-logo" />
              <div className="logo-glint" style={{ borderColor: `rgba(${accentRgb}, 0.5)` }}></div>
            </div>
            <h1 className="visual-title" style={{ textShadow: `0 0 20px rgba(${accentRgb}, 0.5)` }}>LOST<br />ACCESS</h1>
            <p className="visual-tagline">We'll help you find your way back</p>
            <div className="message-container" style={{ borderLeft: `2px solid ${accent}`, background: `rgba(${accentRgb}, 0.1)` }}>
              <div className="message-icon" style={{ color: accent }}>✧</div>
              <p className="message-text">Enter your registered email or username to receive a recovery link</p>
            </div>
            <div className="grip-mark" style={{ background: accent }}>
              <style>{`.forgot-password-page .grip-mark::before,.forgot-password-page .grip-mark::after{background:${accent}}`}</style>
            </div>
            <div className="blood-drip" style={{ background: accent }}></div>
          </div>
        </div>

        <div className="forgot-form-panel">
          <div className="forgot-form-container">
            <div className="form-header">
              <div className="header-scar" style={{ background: accent }}>
                <style>{`.forgot-password-page .header-scar::before,.forgot-password-page .header-scar::after{background:${accent}}`}</style>
              </div>
              <h2 className="form-title">RECOVER ACCOUNT</h2>
              <p className="form-subtitle">We'll send you a reset link</p>
            </div>

            {error && <div className="alert error" style={{ borderLeftColor: accent }}><span className="alert-icon">⚠</span><span>{error}</span></div>}
            {message && <div className="alert success" style={{ borderLeftColor: accent }}><span className="alert-icon">✓</span><span>{message}</span></div>}

            <form onSubmit={handleSubmit} className="forgot-form">
              <div className={`input-group ${isFocused ? 'focused' : ''}`}>
                <div className="input-rip" style={{ background: accent }}></div>
                <input
                  type="text" placeholder="Username / Email" value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
                  required disabled={loading} autoFocus
                  style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}
                />
                <div className="input-blood" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}></div>
              </div>

              <button type="submit" className="submit-button" disabled={loading}
                style={{ borderColor: `rgba(${accentRgb}, 0.5)` }}>
                <span className="button-text">{loading ? "SENDING..." : "SEND RESET LINK"}</span>
                <span className="button-slash"></span>
              </button>
            </form>

            <div className="back-area">
              <Link to="/login" className="back-link" style={{ color: accent }}>← RETURN TO LOGIN</Link>
            </div>
            <div className="security-mark"><span>⚔️ CHECK YOUR SPAM FOLDER ⚔️</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;