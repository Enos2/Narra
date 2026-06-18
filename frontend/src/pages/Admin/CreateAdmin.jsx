/* eslint-disable no-unused-vars */
/* File: CreateAdmin.jsx */
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./CreateAdmin.css";
import { useAppContext } from "../../context/AppContext";

// Animated background components
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ca-sg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ca-sg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4 + (i % 4)}s`} begin={`${i * 0.18}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[110, 200, 310, 440].map((r, i) => (
        <rect key={i} x={720 - r * 0.707} y={450 - r * 0.707} width={r * 1.414} height={r * 1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18 + i * 5}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}

function PlatformBg() {
  const traces = [
    "M0,180 H280 V130 H560 V180 H860 V90 H1440",
    "M0,380 H180 V330 H480 V430 H780 V380 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
    "M0,740 H90 V690 H380 V790 H680 V740 H1440",
    "M220,0 V180 H310 V490 H260 V900",
    "M620,0 V140 H710 V390 H660 V900",
    "M1080,0 V290 H1030 V590 H1130 V900",
  ];
  const nodes = [[280, 130], [560, 180], [860, 90], [180, 330], [480, 430], [380, 530], [680, 630], [380, 690]];
  return (
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ca-pbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#ca-pbg)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite" />
      </rect>
      {traces.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3 + i * 0.7}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
          <animate attributeName="r" values="4;9;4" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440" />
      </circle>
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,580 H380 V530 H680 V630 H980 V580 H1440" />
      </circle>
    </svg>
  );
}

function SupportBg() {
  const vines = [
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves = [[130, 440], [365, 490], [715, 545], [1055, 470], [1340, 515], [200, 30], [350, 0], [695, 95], [1070, 0], [1335, 40]];
  return (
    <svg className="ca-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ca-sbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#ca-sbg)" />
      {vines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </path>
      ))}
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.14" transform={`rotate(${i * 37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3 + i * 0.6}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30" />
      </circle>
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s" path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95" />
      </circle>
    </svg>
  );
}

export default function CreateAdmin() {
  const { user, token: contextToken } = useAppContext();
  const navigate = useNavigate();
  const role = user?.role || "superadmin";
  
  const getThemeColor = () => {
    switch(role) {
      case 'superadmin': return '#FFD700';
      case 'platformadmin': return '#3B82F6';
      case 'supportadmin': return '#22c55e';
      default: return '#FFD700';
    }
  };
  
  const themeColor = getThemeColor();
  
  // Empty initial state - NO pre-filled data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    dob: "",
    role: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const getToken = () => {
    return contextToken || localStorage.getItem("narraToken");
  };

  // Generate random password
  const generatePassword = () => {
    const length = 12;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData(prev => ({
      ...prev,
      password: password,
      confirmPassword: password
    }));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();

    if (!formData.name.trim()) {
      setError("Full name is required!");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required!");
      return;
    }

    if (!formData.role) {
      setError("Please select a role for the admin!");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    if (!formData.dob) {
      setError("Date of Birth is required!");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long!");
      return;
    }

    if (user?.role !== "superadmin") {
      setError("Only Super Admin can create new admins!");
      return;
    }

    if (!token) {
      setError("Authentication token missing. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      
      const requestData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        dateOfBirth: formData.dob
      };

      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(
        `${API_BASE}/api/admin/admins/create`, 
        requestData, 
        { headers }
      );

      if (res.data.success || res.status === 201) {
        setSuccess(`Admin ${formData.name} created successfully! Redirecting...`);
        
        // Clear form completely after success
        setFormData({
          name: "",
          email: "",
          dob: "",
          role: "",
          password: "",
          confirmPassword: "",
        });
        
        setTimeout(() => {
          navigate("/admin/admins");
        }, 2000);
      } else {
        setError(res.data.message || "Failed to create admin.");
      }
    } catch (err) {
      console.error("Create admin error:", err);
      
      if (err.response) {
        if (err.response.status === 403) {
          setError("Access forbidden. Only Super Admin can create admins.");
        } else if (err.response.status === 401) {
          setError("Authentication failed. Please log in again.");
        } else if (err.response.status === 400) {
          setError(err.response.data?.message || "Validation error. Please check your input.");
        } else if (err.response.status === 409) {
          setError("An admin with this email already exists!");
        } else {
          setError(err.response.data?.message || "Failed to create admin.");
        }
      } else if (err.request) {
        setError("No response from server. Check if backend is running.");
      } else {
        setError("Failed to send request: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const minDate = "1900-01-01";

  return (
    <div className={`ca-page ca-role-${role}`} style={{ "--theme-accent": themeColor }}>
      <div className="ca-bg" aria-hidden="true">
        {role === "superadmin" && <SuperBg />}
        {role === "platformadmin" && <PlatformBg />}
        {role === "supportadmin" && <SupportBg />}
      </div>
      <div className="ca-grain" aria-hidden="true"></div>

      <div className="ca-container">
        <div className="ca-header">
          <h1 className="ca-title">Create New Admin</h1>
          <p className="ca-description">Add new administrators to the platform</p>
        </div>

        <div className="ca-info-note">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="ca-info-content">
            <p><strong>Note:</strong> Only Super Admins can create new administrators.</p>
            <p>New admins will be automatically verified and can log in immediately.</p>
            <p>Password must be at least 6 characters long.</p>
          </div>
        </div>

        {error && (
          <div className="ca-alert ca-alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            <button className="ca-alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="ca-alert ca-alert-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{success}</span>
            <button className="ca-alert-close" onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <form 
          className="ca-form" 
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <div className="ca-form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter full name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          <div className="ca-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter email address"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          <div className="ca-form-group">
            <label htmlFor="dob">Date of Birth</label>
            <input
              id="dob"
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              required
              disabled={loading}
              min={minDate}
              max={today}
              autoComplete="off"
            />
          </div>

          <div className="ca-form-group">
            <label htmlFor="role">Role</label>
            <select 
              id="role"
              name="role" 
              value={formData.role} 
              onChange={handleChange} 
              required
              disabled={loading}
              autoComplete="off"
            >
              <option value="" disabled>Select a role</option>
              <option value="platformadmin">Platform Admin</option>
              <option value="supportadmin">Support Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <small className="ca-form-hint">
              Platform Admin: Full platform management<br/>
              Support Admin: Limited support and moderation access<br/>
              Super Admin: Full system access (use carefully)
            </small>
          </div>

          <div className="ca-form-group">
            <label htmlFor="password">Password</label>
            <div className="ca-password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter password"
                minLength="6"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ca-password-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <div className="ca-password-actions">
              <small className="ca-form-hint">Minimum 6 characters</small>
              <button
                type="button"
                className="ca-generate-btn"
                onClick={generatePassword}
                disabled={loading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2L9 14" />
                  <path d="M12 2L3 2L3 11" />
                  <path d="M3 21L15 9" />
                  <path d="M12 21L21 21L21 12" />
                </svg>
                Generate Password
              </button>
            </div>
          </div>

          <div className="ca-form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="ca-password-wrapper">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ca-password-btn"
                onClick={() => setShowConfirm((prev) => !prev)}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showConfirm ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="ca-form-actions">
            <button 
              className="ca-submit-btn" 
              type="submit" 
              disabled={loading || user?.role !== "superadmin"}
              style={{ background: themeColor, color: '#000000' }}
            >
              {loading ? "Creating..." : "Create Admin"}
            </button>
            
            <button 
              type="button"
              className="ca-cancel-btn"
              onClick={() => navigate("/admin/admins")}
            >
              Cancel
            </button>
          </div>

          {user?.role !== "superadmin" && (
            <div className="ca-permission-warning" style={{ borderColor: themeColor, color: themeColor }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              You need Super Admin privileges to create new admins.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}