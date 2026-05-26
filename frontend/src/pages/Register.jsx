/* eslint-disable react-hooks/set-state-in-effect */
/**
 * File: frontend/src/pages/Register.jsx
 * CINEMATIC CLAW MARK THEME - Dark, aggressive, creative
 * UPDATED: Full distributed claw mark background
 */

import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import logo from "../assets/narra-logo.png";
import { useState, useEffect } from "react";
import "./Register.css";

function Register() {
  const { register, isAuthReady, user } = useAppContext();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isFocused, setIsFocused] = useState(null);

  useEffect(() => {
    if (isAuthReady && user) {
      navigate("/");
    }
  }, [isAuthReady, user, navigate]);

  useEffect(() => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
    setPasswordStrength(strength);
  }, [password]);

  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameAvailable(true);
        return;
      }
      
      setCheckingUsername(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/check-username?username=${username}`);
        const data = await response.json();
        setUsernameAvailable(data.available);
      } catch (err) {
        console.error("Username check failed:", err);
      } finally {
        setCheckingUsername(false);
      }
    };
    
    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const getPasswordStrengthText = () => {
    const texts = ["WEAK", "FAIR", "GOOD", "STRONG"];
    const colors = ["#8b0000", "#cc5500", "#ffaa00", "#ffffff"];
    return {
      text: texts[passwordStrength - 1] || "VERY WEAK",
      color: colors[passwordStrength - 1] || "#8b0000",
      width: `${(passwordStrength / 4) * 100}%`
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!firstName.trim()) { setError("First name required"); return; }
    if (firstName.length < 2) { setError("First name must be at least 2 characters"); return; }
    if (!lastName.trim()) { setError("Last name required"); return; }
    if (lastName.length < 2) { setError("Last name must be at least 2 characters"); return; }
    if (!username.trim()) { setError("Username required"); return; }
    
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      setError("Username: 3-30 chars, letters, numbers, underscores");
      return;
    }
    if (!usernameAvailable) { setError("Username already taken"); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Valid email required"); return; }

    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (passwordStrength < 2) { setError("Choose a stronger password"); return; }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) { setError("Invalid date of birth"); return; }

    let age = new Date().getFullYear() - dob.getFullYear();
    const m = new Date().getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;
    if (age < 13) { setError("You must be at least 13 years old"); return; }

    if (!gender) { setError("Please select your gender"); return; }
    if (!acceptedTerms) { setError("You must accept the Terms of Service"); return; }

    setLoading(true);
    try {
      await register(
        firstName.trim(),
        lastName.trim(),
        "",
        username.trim().toLowerCase(),
        email.trim().toLowerCase(),
        password,
        dateOfBirth,
        gender
      );
      navigate("/login", { state: { message: "Registration successful! Please login." } });
    } catch (err) {
      if (err.message.includes("Email already in use")) setError("Email already registered");
      else if (err.message.includes("Username already taken")) setError("Username already taken");
      else setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* Blood Stroke Lines */}
      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>
      
      {/* Distributed Claw Mark Background - Full */}
      <div className="claw-background">
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

      <div className="register-container">
        {/* Left Panel - Visual */}
        <div className="register-visual-panel">
          <div className="register-visual-content">
            <div className="slash-marks">
              <div className="slash"></div>
              <div className="slash"></div>
              <div className="slash"></div>
              <div className="slash"></div>
            </div>
            <div className="logo-container">
              <img src={logo} alt="Narra" className="narra-logo" />
              <div className="logo-glint"></div>
            </div>
            <h1 className="visual-title">CARVE<br />YOUR MARK</h1>
            <p className="visual-tagline">Join the bloodline of storytellers</p>
            
            <div className="benefits-list">
              <div className="benefit-item">
                <div className="benefit-dot"></div>
                <span>Upload & share your vision</span>
              </div>
              <div className="benefit-item">
                <div className="benefit-dot"></div>
                <span>Go live to the world</span>
              </div>
              <div className="benefit-item">
                <div className="benefit-dot"></div>
                <span>Connect with creators</span>
              </div>
              <div className="benefit-item">
                <div className="benefit-dot"></div>
                <span>Monetize your craft</span>
              </div>
            </div>
            
            <div className="grip-mark"></div>
            <div className="blood-drip"></div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="register-form-panel">
          <div className="register-form-container">
            <div className="form-header">
              <div className="header-scar"></div>
              <h2 className="form-title">BEGIN THE RITUAL</h2>
              <p className="form-subtitle">Create your identity</p>
            </div>

            {error && (
              <div className="alert error">
                <span className="alert-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="register-form" noValidate>
              <div className="form-row">
                <div className={`input-group half ${isFocused === 'first' ? 'focused' : ''}`}>
                  <div className="input-rip"></div>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onFocus={() => setIsFocused('first')}
                    onBlur={() => setIsFocused(null)}
                    disabled={loading}
                    autoFocus
                  />
                  <div className="input-blood"></div>
                </div>

                <div className={`input-group half ${isFocused === 'last' ? 'focused' : ''}`}>
                  <div className="input-rip"></div>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onFocus={() => setIsFocused('last')}
                    onBlur={() => setIsFocused(null)}
                    disabled={loading}
                  />
                  <div className="input-blood"></div>
                </div>
              </div>

              <div className={`input-group ${isFocused === 'username' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  onFocus={() => setIsFocused('username')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                />
                {checkingUsername && <span className="input-status">...</span>}
                {username.length >= 3 && !checkingUsername && (
                  <span className={`input-status ${usernameAvailable ? 'available' : 'taken'}`}>
                    {usernameAvailable ? '✓' : '✗'}
                  </span>
                )}
                <div className="input-blood"></div>
              </div>

              <div className={`input-group ${isFocused === 'email' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsFocused('email')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                />
                <div className="input-blood"></div>
              </div>

              <div className={`input-group ${isFocused === 'dob' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  onFocus={() => setIsFocused('dob')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                />
                <div className="input-blood"></div>
              </div>

              <div className="gender-group">
                <div className="gender-label">GENDER</div>
                <div className="gender-options">
                  <button
                    type="button"
                    className={`gender-option ${gender === 'male' ? 'active' : ''}`}
                    onClick={() => setGender('male')}
                  >
                    MALE
                  </button>
                  <button
                    type="button"
                    className={`gender-option ${gender === 'female' ? 'active' : ''}`}
                    onClick={() => setGender('female')}
                  >
                    FEMALE
                  </button>
                </div>
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

              {password && (
                <div className="strength-bar-container">
                  <div className="strength-track">
                    <div 
                      className="strength-fill" 
                      style={{ 
                        width: getPasswordStrengthText().width,
                        background: getPasswordStrengthText().color
                      }}
                    ></div>
                  </div>
                  <span className="strength-text" style={{ color: getPasswordStrengthText().color }}>
                    {getPasswordStrengthText().text}
                  </span>
                </div>
              )}

              <div className={`input-group ${isFocused === 'confirm' ? 'focused' : ''}`}>
                <div className="input-rip"></div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setIsFocused('confirm')}
                  onBlur={() => setIsFocused(null)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-eye"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "✕" : "◉"}
                </button>
                <div className="input-blood"></div>
              </div>

              <div className="terms-group">
                <label className="checkmark">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                  <span className="checkmark-box"></span>
                  <span className="checkmark-text">I accept the <Link to="/terms">Terms</Link> & <Link to="/privacy">Privacy</Link></span>
                </label>
              </div>

              <button type="submit" className="submit-button" disabled={loading || !usernameAvailable}>
                <span className="button-text">{loading ? "CARVING..." : "CARVE YOUR MARK"}</span>
                <span className="button-slash"></span>
              </button>
            </form>

            <div className="signin-area">
              <p>Already have a mark? <Link to="/login" className="signin-link">ENTER THE DARK</Link></p>
            </div>

            <div className="blood-mark"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;