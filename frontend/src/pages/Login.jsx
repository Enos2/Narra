/* eslint-disable react-hooks/set-state-in-effect */
/**
 * File: frontend/src/pages/Login.jsx
 * Updated to use ThemeContext accent color
 */

import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import "./Login.css";
import logo from "../assets/narra-logo.png";

function Login() {
  const { login, isAuthReady, user } = useAppContext();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const accent = theme.accent;
  const accentRgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (isAuthReady && user && user.role === "user") navigate("/");
  }, [isAuthReady, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    if (!identifier.trim()) { setError("Username or email required"); setLoading(false); return; }
    if (!password) { setError("Password required"); setLoading(false); return; }
    try {
      await login(identifier.trim(), password);
      navigate("/");
    } catch (err) {
      if (err.message.includes('Invalid credentials')) setError("Invalid username/email or password");
      else if (err.message.includes('banned')) setError("Account banned");
      else if (err.message.includes('deactivated')) setError("Account deactivated");
      else if (err.message.includes('Admins must use')) setError("Use admin portal");
      else setError(err.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>
      <div className="claw-background">
        <div className="claw claw-1"></div><div className="claw claw-2"></div>
        <div className="claw claw-3"></div><div className="claw claw-4"></div>
        <div className="claw claw-5"></div>
      </div>

      <div className="login-container" style={{ borderColor: `rgba(${accentRgb}, 0.3)`, boxShadow: `0 0 50px rgba(${accentRgb}, 0.1)` }}>
        <div className="visual-panel" style={{ borderRight: `1px solid rgba(${accentRgb}, 0.3)` }}>
          <div className="visual-content">
            <div className="slash-marks">
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
              <div className="slash" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}></div>
            </div>
            <div className="logo-container">
              <img src={logo} alt="Narra" className="narra-logo" />
              <div className="logo-glint" style={{ borderColor: `rgba(${accentRgb}, 0.5)` }}></div>
            </div>
            <h1 className="visual-title" style={{ textShadow: `0 0 20px rgba(${accentRgb}, 0.5)` }}>NARRA</h1>
            <p className="visual-tagline">Where stories bleed into reality</p>
            <div className="grip-mark" style={{ background: accent }}>
              <style>{`.login-page .grip-mark::before,.login-page .grip-mark::after{background:${accent}}`}</style>
            </div>
          </div>
        </div>

        <div className="form-panel">
          <div className="form-container">
            <div className="form-header">
              <div className="header-scar" style={{ background: accent }}>
                <style>{`.login-page .header-scar::before,.login-page .header-scar::after{background:${accent}}`}</style>
              </div>
              <h2 className="form-title">ENTER THE DARK</h2>
              <p className="form-subtitle">Sign in to continue your story</p>
            </div>

            {success && <div className="alert success"><span className="alert-icon">✦</span><span>{success}</span></div>}
            {error && <div className="alert error" style={{ borderLeftColor: accent }}><span className="alert-icon">⚠</span><span>{error}</span></div>}

            <form onSubmit={handleSubmit} className="login-form">
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

              <div className="input-group">
                <div className="input-rip" style={{ background: accent }}></div>
                <input
                  type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required disabled={loading}
                  style={{ borderColor: `rgba(${accentRgb}, 0.3)` }}
                />
                <button type="button" className="password-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "✕" : "◉"}
                </button>
                <div className="input-blood" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}></div>
              </div>

              <div className="form-options">
                <label className="checkmark">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className="checkmark-box" style={{ borderColor: `rgba(${accentRgb}, 0.5)` }}></span>
                  <span className="checkmark-text">Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-link" style={{}}>Lost password?</Link>
              </div>

              <button type="submit" className="submit-button" disabled={loading}
                style={{ borderColor: `rgba(${accentRgb}, 0.5)` }}>
                <span className="button-text">{loading ? "ENTERING..." : "ENTER THE DARK"}</span>
                <span className="button-slash"></span>
              </button>
            </form>

            <div className="divider">
              <span className="divider-text">NO RETURN</span>
              <div className="divider-line" style={{ background: `rgba(${accentRgb}, 0.3)` }}></div>
            </div>

            <div className="signup-area">
              <p>New here? <Link to="/register" className="signup-link" style={{ color: accent }}>CARVE YOUR MARK</Link></p>
            </div>

            <div className="blood-mark"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;