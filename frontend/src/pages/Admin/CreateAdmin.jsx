/* eslint-disable no-unused-vars */
/* File: CreateAdmin.jsx */
import React, { useState } from "react";
import axios from "axios";
import "./CreateAdmin.css";
import { useAppContext } from "../../context/AppContext";

export default function CreateAdmin() {
  const { user } = useAppContext();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    dob: "",
    role: "platformadmin",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Debug: Check user and token
    console.log("=== CREATE ADMIN DEBUG INFO ===");
    console.log("User role:", user?.role);
    console.log("Is superadmin?", user?.role === "superadmin");
    const token = user?.token || localStorage.getItem("narraToken");
    console.log("Token exists:", !!token);
    console.log("Form data:", formData);

    // Validate passwords
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

    // Check if user is superadmin
    if (user?.role !== "superadmin") {
      setError("Only Super Admin can create new admins!");
      return;
    }

    try {
      setLoading(true);
      
      // Get token from user context or localStorage
      const token = user?.token || localStorage.getItem("narraToken");
      
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        setLoading(false);
        return;
      }

      // Prepare the data in the format expected by backend
      const requestData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        dateOfBirth: formData.dob
      };

      console.log("Sending request data:", requestData);
      console.log("Request URL: http://localhost:5000/api/admin/admins/create");

      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const res = await axios.post(
        "http://localhost:5000/api/admin/admins/create", 
        requestData, 
        { headers }
      );

      console.log("Response:", res.data);

      if (res.data.success || res.status === 201) {
        setSuccess(`Admin ${formData.name} created successfully!`);
        // Reset form
        setFormData({
          name: "",
          email: "",
          dob: "",
          role: "platformadmin",
          password: "",
          confirmPassword: "",
        });
      } else {
        setError(res.data.message || "Failed to create admin.");
      }
    } catch (err) {
      console.error("Create admin error:", err);
      
      // Detailed error logging
      if (err.response) {
        console.error("Response status:", err.response.status);
        console.error("Response data:", err.response.data);
        
        if (err.response.status === 403) {
          if (err.response.data?.message?.includes("Not authorized")) {
            setError("Access forbidden. Only Super Admin can create admins.");
          } else {
            setError("Access forbidden. You don't have permission to create admins.");
          }
        } else if (err.response.status === 401) {
          setError("Authentication failed. Please log in again.");
        } else if (err.response.status === 400) {
          setError(err.response.data?.message || "Validation error. Please check your input.");
        } else {
          setError(err.response.data?.message || "Failed to create admin.");
        }
      } else if (err.request) {
        console.error("No response received:", err.request);
        setError("No response from server. Check if backend is running on localhost:5000.");
      } else {
        console.error("Request setup error:", err.message);
        setError("Failed to send request: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Format date for display (YYYY-MM-DD for input type="date")
  const today = new Date().toISOString().split('T')[0];
  const minDate = "1900-01-01";

  return (
    <div className="create-admin-wrapper">
      <div className="create-admin-header">
        <h1>Create New Admin</h1>
        <p>Add new administrators to the platform</p>
      </div>

      <div className="admin-info-note">
        <p><strong>📌 Note:</strong> Only Super Admins can create new administrators.</p>
        <p>✅ New admins will be automatically verified and can log in immediately.</p>
        <p>🔒 Passwords must be at least 6 characters long.</p>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <form className="create-admin-form" onSubmit={handleSubmit}>
        <div className="form-group">
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
          />
        </div>

        <div className="form-group">
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
          />
        </div>

        <div className="form-group">
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
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select 
            id="role"
            name="role" 
            value={formData.role} 
            onChange={handleChange} 
            required
            disabled={loading}
          >
            <option value="platformadmin">Platform Admin</option>
            <option value="supportadmin">Support Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
          <small className="form-hint">
            Platform Admin: Full platform management<br/>
            Support Admin: Limited support and moderation access<br/>
            Super Admin: Full system access (use carefully)
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-wrapper">
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
            />
            <button
              type="button"
              className="show-hide-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <small className="form-hint">Minimum 6 characters</small>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-wrapper">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Confirm password"
            />
            <button
              type="button"
              className="show-hide-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              disabled={loading}
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button 
          className="create-admin-btn" 
          type="submit" 
          disabled={loading || user?.role !== "superadmin"}
        >
          {loading ? "Creating..." : "Create Admin"}
        </button>

        {user?.role !== "superadmin" && (
          <div className="permission-warning">
            ⚠️ You need Super Admin privileges to create new admins.
          </div>
        )}
      </form>
    </div>
  );
}