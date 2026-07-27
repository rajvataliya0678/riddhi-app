'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ROLES = ['customer', 'coach', 'admin'];

function getRoleBadgeClass(role) {
  if (role === 'admin') return 'role-admin';
  if (role === 'coach') return 'role-coach';
  return 'role-customer';
}

export default function AdminTab({ currentAdminUid }) {
  const [users, setUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  // Track which rows are saving and which have just saved
  const [savingUids, setSavingUids] = useState({});
  const [savedUids, setSavedUids] = useState({});

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ ...d.data() }));
      // Sort by createdAt descending
      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return db2 - da;
      });
      setUsers(list);
      setCoaches(list.filter(u => u.role === 'coach' || u.role === 'admin'));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Change user's role
  const handleRoleChange = async (uid, newRole) => {
    setSavingUids(prev => ({ ...prev, [uid]: 'role' }));
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      setCoaches(prev => {
        const updated = users.map(u => u.uid === uid ? { ...u, role: newRole } : u);
        return updated.filter(u => u.role === 'coach' || u.role === 'admin');
      });
      showSaved(uid);
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setSavingUids(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }
  };

  // Assign a coach to a customer
  const handleCoachAssign = async (uid, coachId) => {
    setSavingUids(prev => ({ ...prev, [uid]: 'coach' }));
    try {
      const updateData = coachId === '' ? { coachId: '' } : { coachId };
      await updateDoc(doc(db, 'users', uid), updateData);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, coachId } : u));
      showSaved(uid);
    } catch (err) {
      console.error('Error assigning coach:', err);
    } finally {
      setSavingUids(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }
  };

  const showSaved = (uid) => {
    setSavedUids(prev => ({ ...prev, [uid]: true }));
    setTimeout(() => {
      setSavedUids(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }, 2000);
  };

  // Apply search + role filter
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery);
    const matchesRole = filterRole === 'All' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Stats
  const stats = {
    total: users.length,
    customers: users.filter(u => u.role === 'customer').length,
    coaches: users.filter(u => u.role === 'coach').length,
    admins: users.filter(u => u.role === 'admin').length,
    unassigned: users.filter(u => u.role === 'customer' && !u.coachId).length,
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading Club Owner data...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Club Owner Panel</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Manage all users, roles, and coach assignments
        </p>
      </div>

      {/* Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-number" style={{ color: 'var(--text-main)' }}>{stats.total}</span>
          <span className="admin-stat-label">Total Users</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-number" style={{ color: '#0ea5e9' }}>{stats.customers}</span>
          <span className="admin-stat-label">Customers</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-number" style={{ color: '#10b981' }}>{stats.coaches}</span>
          <span className="admin-stat-label">Coaches</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-number" style={{ color: '#a855f7' }}>{stats.admins}</span>
          <span className="admin-stat-label">Club Owners</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-number" style={{ color: '#f59e0b' }}>{stats.unassigned}</span>
          <span className="admin-stat-label">Unassigned</span>
        </div>
      </div>

      {/* Search + Filter Toolbar */}
      <div className="admin-toolbar">
        <input
          type="text"
          className="admin-search-input"
          placeholder="Search by name, email or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="admin-search"
        />
        <select
          className="crm-filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          id="admin-filter-role"
        >
          <option value="All">All Roles</option>
          <option value="customer">Customers</option>
          <option value="coach">Coaches</option>
          <option value="admin">Club Owners</option>
        </select>
        <button
          onClick={fetchAllUsers}
          className="btn btn-outline btn-sm"
          style={{ width: 'auto' }}
          id="admin-refresh-btn"
        >
          ↻ Refresh
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: 'auto' }}>
          {filteredUsers.length} of {users.length} users
        </span>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">👤</span>
          <h4>No users found</h4>
          <p>Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table" id="admin-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Assign Coach</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((userRow) => {
                const isSelf = userRow.uid === currentAdminUid;
                const isSaving = !!savingUids[userRow.uid];
                const isSaved = !!savedUids[userRow.uid];

                return (
                  <tr key={userRow.uid} id={`admin-row-${userRow.uid}`}>
                    {/* Name */}
                    <td>
                      <div style={{ fontWeight: '600' }}>{userRow.name}</div>
                      {isSelf && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>You</div>
                      )}
                    </td>

                    {/* Email */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {userRow.email}
                    </td>

                    {/* Phone */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {userRow.phone || '—'}
                    </td>

                    {/* Role Selector */}
                    <td>
                      <select
                        className="inline-select"
                        value={userRow.role || 'customer'}
                        onChange={(e) => handleRoleChange(userRow.uid, e.target.value)}
                        disabled={isSaving || isSelf}
                        title={isSelf ? "You cannot change your own role" : "Change role"}
                        id={`role-select-${userRow.uid}`}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>
                            {r === 'admin' ? 'Club Owner' : r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Coach Assignment (only for customers) */}
                    <td>
                      {userRow.role === 'customer' ? (
                        <select
                          className="inline-select"
                          value={userRow.coachId || ''}
                          onChange={(e) => handleCoachAssign(userRow.uid, e.target.value)}
                          disabled={isSaving}
                          id={`coach-select-${userRow.uid}`}
                        >
                          <option value="">— No Coach —</option>
                          {coaches.map(coach => (
                            <option key={coach.uid} value={coach.uid}>
                              {coach.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>N/A</span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {userRow.createdAt?.toDate
                        ? userRow.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Save Status */}
                    <td style={{ minWidth: '80px' }}>
                      {isSaving && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Saving...</span>
                      )}
                      {isSaved && !isSaving && (
                        <span className="save-indicator">✓ Saved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
