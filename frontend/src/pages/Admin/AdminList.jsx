/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
// File: src/pages/admin/AdminList.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminList.css';

const AdminList = () => {
  const [admins, setAdmins] = useState([]);
  const [inactiveAdmins, setInactiveAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem('token');

  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password: '',
    role: 'supportadmin',
    dateOfBirth: ''
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const [activeRes, inactiveRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/admins`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/api/admin/admins/inactive`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAdmins(activeRes.data.admins || []);
      setInactiveAdmins(inactiveRes.data.admins || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setActionLoading('create');
    try {
      await axios.post(`${API_BASE}/api/admin/admins`, newAdmin, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateModal(false);
      setNewAdmin({ name: '', email: '', password: '', role: 'supportadmin', dateOfBirth: '' });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (adminId) => {
    if (!confirm('Deactivate this admin?')) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (adminId) => {
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (adminId, currentRole) => {
    if (currentRole === 'superadmin') {
      alert('Cannot promote super admin');
      return;
    }
    if (!confirm(`Promote this admin to ${currentRole === 'supportadmin' ? 'platformadmin' : 'superadmin'}?`)) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to promote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (adminId, currentRole) => {
    if (currentRole === 'supportadmin') {
      alert('Cannot demote support admin further');
      return;
    }
    if (!confirm(`Demote this admin to ${currentRole === 'superadmin' ? 'platformadmin' : 'supportadmin'}?`)) return;
    setActionLoading(adminId);
    try {
      await axios.put(`${API_BASE}/api/admin/admins/${adminId}/demote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to demote admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (adminId) => {
    if (!confirm('PERMANENTLY DELETE this admin? This action cannot be undone.')) return;
    setActionLoading(adminId);
    try {
      await axios.delete(`${API_BASE}/api/admin/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete admin');
    } finally {
      setActionLoading(null);
    }
  };

  const displayAdmins = showInactive ? inactiveAdmins : admins;

  const getRoleClass = (role) => {
    switch(role) {
      case 'superadmin': return 'role-superadmin';
      case 'platformadmin': return 'role-platformadmin';
      case 'supportadmin': return 'role-supportadmin';
      default: return '';
    }
  };

  if (loading) {
    return <div className="admin-list-loading">Loading admins...</div>;
  }

  if (error) {
    return (
      <div className="admin-list-error">
        <p>{error}</p>
        <button onClick={fetchAdmins}>Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-list-container">
      <div className="admin-list-header">
        <div>
          <h1>Admin Management</h1>
          <p>Manage system administrators and their roles</p>
        </div>
        <div className="admin-list-actions">
          <button 
            className={`toggle-btn ${showInactive ? 'active' : ''}`}
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Show Active' : `Show Inactive (${inactiveAdmins.length})`}
          </button>
          <button className="create-btn" onClick={() => setShowCreateModal(true)}>
            + Create Admin
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>Total Admins</h3>
          <div className="stat-value">{admins.length + inactiveAdmins.length}</div>
        </div>
        <div className="stat-card">
          <h3>Active Admins</h3>
          <div className="stat-value">{admins.length}</div>
        </div>
        <div className="stat-card">
          <h3>Inactive Admins</h3>
          <div className="stat-value">{inactiveAdmins.length}</div>
        </div>
      </div>

      {displayAdmins.length === 0 ? (
        <div className="admin-list-empty">
          No {showInactive ? 'inactive' : 'active'} admins found
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayAdmins.map((admin) => (
                <tr key={admin._id}>
                  <td>{admin.name || admin.username || 'N/A'}</td>
                  <td>{admin.email}</td>
                  <td>
                    <span className={`role-badge ${getRoleClass(admin.role)}`}>
                      {admin.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${admin.isActive !== false ? 'status-active' : 'status-inactive'}`}>
                      {admin.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      {admin.isActive !== false ? (
                        <button 
                          className="action-btn action-deactivate"
                          onClick={() => handleDeactivate(admin._id)}
                          disabled={actionLoading === admin._id}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button 
                          className="action-btn action-reactivate"
                          onClick={() => handleReactivate(admin._id)}
                          disabled={actionLoading === admin._id}
                        >
                          Reactivate
                        </button>
                      )}
                      <button 
                        className="action-btn action-promote"
                        onClick={() => handlePromote(admin._id, admin.role)}
                        disabled={actionLoading === admin._id || admin.role === 'superadmin'}
                      >
                        Promote
                      </button>
                      <button 
                        className="action-btn action-demote"
                        onClick={() => handleDemote(admin._id, admin.role)}
                        disabled={actionLoading === admin._id || admin.role === 'supportadmin'}
                      >
                        Demote
                      </button>
                      <button 
                        className="action-btn action-delete"
                        onClick={() => handleDelete(admin._id)}
                        disabled={actionLoading === admin._id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Admin</h2>
            <form onSubmit={handleCreateAdmin}>
              <div className="modal-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                />
              </div>
              <div className="modal-form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                />
              </div>
              <div className="modal-form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                />
              </div>
              <div className="modal-form-group">
                <label>Role</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                >
                  <option value="supportadmin">Support Admin</option>
                  <option value="platformadmin">Platform Admin</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  required
                  value={newAdmin.dateOfBirth}
                  onChange={(e) => setNewAdmin({ ...newAdmin, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit" disabled={actionLoading === 'create'}>
                  {actionLoading === 'create' ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminList;