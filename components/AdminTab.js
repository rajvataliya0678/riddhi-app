'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, updateDoc, deleteDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
  const [activeMenuUid, setActiveMenuUid] = useState(null);
  // Track which rows are saving and which have just saved
  const [savingUids, setSavingUids] = useState({});
  const [savedUids, setSavedUids] = useState({});

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data() }));
      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return db2 - da;
      });
      setUsers(list);
      setCoaches(list.filter(u => u.role === 'coach' || u.role === 'admin'));
      setLoading(false);
    }, (err) => {
      console.error('Error in users real-time listener:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ ...d.data() }));
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

  // Assign Senior Coach Name for a coach/admin (sets coachName field in Firestore)
  const handleSeniorCoachAssign = async (uid, seniorCoachName) => {
    const trimmed = seniorCoachName.trim();
    const currentUserDoc = users.find(u => u.uid === uid);
    if (currentUserDoc && (currentUserDoc.coachName || '') === trimmed) return;

    setSavingUids(prev => ({ ...prev, [uid]: 'seniorCoach' }));
    try {
      await updateDoc(doc(db, 'users', uid), { coachName: trimmed });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, coachName: trimmed } : u));
      showSaved(uid);
    } catch (err) {
      console.error('Error setting senior coach name:', err);
    } finally {
      setSavingUids(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuUid(null);
    if (activeMenuUid) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuUid]);

  // Delete a user entry permanently (e.g. for duplicate registrations)
  const handleDeleteUser = async (uid, name, e) => {
    if (e) e.stopPropagation();
    if (uid === currentAdminUid) {
      alert('તમે તમારું પોતાનું ઓનર એકાઉન્ટ ડિલીટ કરી શકતા નથી.');
      return;
    }
    if (!window.confirm(`શું તમે ખરેખર "${name || 'User'}" ની નોંધણી/એન્ટ્રી કાયમ માટે ડિલીટ કરવા માંગો છો?`)) {
      return;
    }
    setSavingUids(prev => ({ ...prev, [uid]: 'delete' }));
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (err) {
      console.error('Error deleting user entry:', err);
      alert('એન્ટ્રી ડિલીટ કરવામાં ભૂલ થઈ. ફરી ટ્રાય કરો.');
    } finally {
      setSavingUids(prev => { const n = { ...prev }; delete n[uid]; return n; });
    }
  };

  // Toggle whether user is marked as CRM Staff (for CRM dropdown selection)
  const handleStaffToggle = async (uid, currentVal) => {
    const newVal = !currentVal;
    setSavingUids(prev => ({ ...prev, [uid]: 'isStaff' }));
    try {
      await updateDoc(doc(db, 'users', uid), { isStaff: newVal });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isStaff: newVal } : u));
      showSaved(uid);
    } catch (err) {
      console.error('Error toggling staff status:', err);
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
                <th>CRM Staff (લિસ્ટ પસંદગી)</th>
                <th>App Version & Device</th>
                <th>Assign Coach / Senior Coach</th>
                <th>Joined</th>
                <th>Status</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
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

                    {/* CRM Staff Toggle */}
                    <td>
                      <button
                        type="button"
                        onClick={() => handleStaffToggle(userRow.uid, !!userRow.isStaff)}
                        disabled={isSaving}
                        style={{
                          padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800',
                          cursor: 'pointer', border: userRow.isStaff ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          background: userRow.isStaff ? '#eff6ff' : '#f8fafc',
                          color: userRow.isStaff ? '#1d4ed8' : '#64748b',
                          boxShadow: userRow.isStaff ? '0 2px 4px rgba(59,130,246,0.15)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        title="Toggle whether this user appears in the CRM Staff selection list"
                        id={`staff-toggle-btn-${userRow.uid}`}
                      >
                        {userRow.isStaff ? '👤 Staff: YES' : '👤 Staff: NO'}
                      </button>
                    </td>

                    {/* App Version & Device */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {(() => {
                          const v = userRow.appVersion || '1.0';
                          const isUpToDate = parseFloat(v) >= 1.1;
                          return (
                            <span style={{
                              padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800',
                              background: isUpToDate ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: isUpToDate ? '#059669' : '#d97706',
                              border: isUpToDate ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                              display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content'
                            }}>
                              v{v} {isUpToDate ? '✓ Latest' : '⚠️ Outdated'}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          📱 {userRow.platform || 'Mobile / Web'}
                        </span>
                      </div>
                    </td>

                    {/* Coach Assignment (for customers) / Senior Coach Name (for coaches & admins) */}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <input
                            type="text"
                            className="inline-select"
                            style={{ minWidth: '150px', padding: '4px 8px', fontSize: '0.8rem', background: 'var(--card-bg)' }}
                            placeholder="Senior Coach (e.g. Ramesh)"
                            defaultValue={userRow.coachName || ''}
                            onBlur={(e) => handleSeniorCoachAssign(userRow.uid, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSeniorCoachAssign(userRow.uid, e.target.value)}
                            disabled={isSaving}
                            id={`senior-coach-input-${userRow.uid}`}
                          />
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {userRow.coachName ? `Zoom Coach: ${userRow.coachName}` : 'Set Senior Coach'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {userRow.createdAt?.toDate
                        ? userRow.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Actions Menu */}
                    <td style={{ textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuUid(activeMenuUid === userRow.uid ? null : userRow.uid);
                        }}
                        style={{
                          background: activeMenuUid === userRow.uid ? 'var(--bg-secondary)' : 'transparent',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: 'var(--text-main)',
                          fontSize: '1.1rem',
                          fontWeight: '900',
                          lineHeight: 1,
                        }}
                        title="User Options"
                        id={`admin-menu-btn-${userRow.uid}`}
                      >
                        ⋮
                      </button>

                      {activeMenuUid === userRow.uid && (
                        <div style={{
                          position: 'absolute', right: '10px', top: '40px', zIndex: 99,
                          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                          borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                          padding: '6px', minWidth: '160px', textAlign: 'left'
                        }}>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteUser(userRow.uid, userRow.name, e)}
                            disabled={isSelf}
                            style={{
                              width: '100%', padding: '8px 12px', border: 'none', background: 'transparent',
                              color: isSelf ? '#94a3b8' : '#ef4444', fontWeight: '800', fontSize: '0.8rem',
                              borderRadius: '6px', cursor: isSelf ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            title={isSelf ? "Cannot delete your own account" : "Delete duplicate user entry"}
                            id={`admin-delete-user-btn-${userRow.uid}`}
                          >
                            🗑️ Delete Entry
                          </button>
                        </div>
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
