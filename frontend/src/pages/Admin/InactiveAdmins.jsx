/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/immutability */
/* File: InactiveAdmins.jsx */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import "./InactiveAdmins.css";

export default function InactiveAdmins() {
  const { user } = useAppContext();
  const [inactiveAdmins, setInactiveAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch inactive admins on component mount
  useEffect(() => {
    fetchInactiveAdmins();
  }, []);

  const fetchInactiveAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = user?.token || localStorage.getItem("narraToken");
      
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        setLoading(false);
        return;
      }

      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const response = await axios.get(
        "http://localhost:5000/api/admin/admins/inactive",
        { headers }
      );

      if (response.data.success) {
        setInactiveAdmins(response.data.admins || []);
      } else {
        setError(response.data.message || "Failed to fetch inactive admins");
      }
    } catch (err) {
      console.error("Fetch inactive admins error:", err);
      if (err.response?.status === 403) {
        setError("Access forbidden. You don't have permission to view inactive admins.");
      } else if (err.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError(err.response?.data?.message || "Failed to fetch inactive admins");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (adminId, adminName) => {
    if (!window.confirm(`Are you sure you want to reactivate ${adminName}?`)) {
      return;
    }

    try {
      setActionLoading(adminId);
      setError(null);
      setSuccess(null);
      
      const token = user?.token || localStorage.getItem("narraToken");
      
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        setActionLoading(null);
        return;
      }

      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const response = await axios.put(
        `http://localhost:5000/api/admin/admins/reactivate/${adminId}`,
        {},
        { headers }
      );

      if (response.data.success) {
        setSuccess(`${adminName} has been reactivated successfully!`);
        // Refresh the list
        fetchInactiveAdmins();
      } else {
        setError(response.data.message || "Failed to reactivate admin");
      }
    } catch (err) {
      console.error("Reactivate admin error:", err);
      if (err.response?.status === 403) {
        setError("Access forbidden. You don't have permission to reactivate admins.");
      } else if (err.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError(err.response?.data?.message || "Failed to reactivate admin");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "superadmin":
        return "role-badge superadmin";
      case "platformadmin":
        return "role-badge platformadmin";
      case "supportadmin":
        return "role-badge supportadmin";
      default:
        return "role-badge";
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case "superadmin":
        return "Super Admin";
      case "platformadmin":
        return "Platform Admin";
      case "supportadmin":
        return "Support Admin";
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="inactive-admins-wrapper">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading inactive admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inactive-admins-wrapper">
      <div className="inactive-admins-header">
        <h1>Inactive Administrators</h1>
        <p>Manage deactivated admin accounts</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span className="alert-message">{error}</span>
          <button className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <span className="alert-message">{success}</span>
          <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      <div className="inactive-admins-stats">
        <div className="stat-card">
          <div className="stat-number">{inactiveAdmins.length}</div>
          <div className="stat-label">Inactive Admins</div>
        </div>
      </div>

      {inactiveAdmins.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No Inactive Admins</h3>
          <p>All administrators are currently active in the system.</p>
        </div>
      ) : (
        <div className="inactive-admins-table-container">
          <table className="inactive-admins-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Deactivated On</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inactiveAdmins.map((admin) => (
                <tr key={admin._id}>
                  <td className="admin-name">
                    <div className="admin-avatar">
                      {admin.name?.charAt(0)?.toUpperCase() || "A"}
                    </div>
                    <span>{admin.name}</span>
                  </td>
                  <td className="admin-email">{admin.email}</td>
                  <td>
                    <span className={getRoleBadgeClass(admin.role)}>
                      {getRoleDisplayName(admin.role)}
                    </span>
                  </td>
                  <td className="admin-date">
                    {formatDate(admin.adminDeactivatedAt)}
                  </td>
                  <td className="admin-reason">
                    {admin.adminDeactivationReason || "No reason provided"}
                  </td>
                  <td className="admin-actions">
                    <button
                      className="btn-reactivate"
                      onClick={() => handleReactivate(admin._id, admin.name)}
                      disabled={actionLoading === admin._id}
                    >
                      {actionLoading === admin._id ? (
                        <>
                          <span className="spinner-small"></span>
                          Reactivating...
                        </>
                      ) : (
                        "Reactivate"
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="info-note">
        <p>
          <strong>💡 Note:</strong> Reactivated admins will regain full access to the system.
          They will receive a notification upon reactivation.
        </p>
      </div>
    </div>
  );
}