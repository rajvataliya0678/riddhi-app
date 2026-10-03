'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, updateDoc, deleteDoc, doc, setDoc, getDoc, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/dateUtils';

const ROLES = ['customer', 'coach', 'admin'];

function getRoleBadgeClass(role) {
  if (role === 'admin') return 'role-admin';
  if (role === 'coach') return 'role-coach';
  return 'role-customer';
}

export default function AdminTab({ currentAdminUid, clubId = 'main' }) {
  const [users, setUsers] = useState([]);
  const [rawAllUsers, setRawAllUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [activeClubId, setActiveClubId] = useState(clubId || 'main');
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [activeMenuUid, setActiveMenuUid] = useState(null);
  // Track which rows are saving and which have just saved
  const [savingUids, setSavingUids] = useState({});
  const [savedUids, setSavedUids] = useState({});

  // Duplicate Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState('');
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState(null);
  const [duplicateError, setDuplicateError] = useState('');
  const [duplicateForm, setDuplicateForm] = useState({
    clubName: '',
    clubId: '',
    ownerType: 'existing', // 'existing' | 'new'
    selectedOwnerUid: '',
    newOwnerName: '',
    newOwnerPhone: '',
    newOwnerEmail: '',
    newOwnerPassword: '',
    selectedMemberUids: [],
  });

  // Listen to clubs collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clubs'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hasMain = list.some(c => c.id === 'main');
      if (!hasMain) {
        list.unshift({ id: 'main', name: 'PRV', clubCode: 'PRV' });
      }
      setClubs(list);
    }, (err) => console.warn('Clubs listener warning:', err));
    return () => unsub();
  }, []);

  // Listen to users collection and filter by activeClubId
  useEffect(() => {
    setLoading(true);
    setPermissionError(false);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), uid: d.id || d.data().uid }));
      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return db2 - da;
      });
      setRawAllUsers(list);

      const filtered = list.filter(u => (u.clubId || 'main') === activeClubId);
      setUsers(filtered);
      setCoaches(filtered.filter(u => u.role === 'coach' || u.role === 'admin'));
      setPermissionError(false);
      setLoading(false);
    }, (err) => {
      console.error('Error in users real-time listener:', err);
      setPermissionError(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeClubId]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ ...d.data(), uid: d.id || d.data().uid }));
      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return db2 - da;
      });
      setRawAllUsers(list);
      const filtered = list.filter(u => (u.clubId || 'main') === activeClubId);
      setUsers(filtered);
      setCoaches(filtered.filter(u => u.role === 'coach' || u.role === 'admin'));
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
      const selectedCoach = coaches.find(c => (c.uid || c.id) === coachId);
      const coachName = selectedCoach ? (selectedCoach.name || selectedCoach.displayName || '') : '';
      const updateData = coachId === '' ? { coachId: '', coachName: '' } : { coachId, coachName };
      await updateDoc(doc(db, 'users', uid), updateData);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, coachId, coachName } : u));
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

  // Open Duplicate Modal and prefill defaults
  const openDuplicateModal = () => {
    setDuplicateError('');
    setDuplicateSuccess(null);
    setDuplicateProgress('');
    setDuplicateForm({
      clubName: '',
      clubId: '',
      ownerType: 'existing',
      selectedOwnerUid: coaches[0]?.uid || users[0]?.uid || '',
      newOwnerName: '',
      newOwnerPhone: '',
      newOwnerEmail: '',
      newOwnerPassword: '',
      selectedMemberUids: users.map(u => u.uid),
    });
    setShowDuplicateModal(true);
  };

  // Toggle user selection in duplicate list
  const toggleMemberSelection = (uid) => {
    setDuplicateForm(prev => {
      const current = prev.selectedMemberUids;
      const next = current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid];
      return { ...prev, selectedMemberUids: next };
    });
  };

  const selectAllMembers = (select) => {
    setDuplicateForm(prev => ({
      ...prev,
      selectedMemberUids: select ? users.map(u => u.uid) : []
    }));
  };

  // Handle Duplication execution
  const handleExecuteDuplication = async (e) => {
    e.preventDefault();
    setDuplicateError('');
    setDuplicateProgress('');

    const clubName = duplicateForm.clubName.trim();
    if (!clubName) {
      setDuplicateError('કૃપા કરીને નવી ક્લબનું નામ લખો.');
      return;
    }

    // Determine target clubId
    let generatedClubId = duplicateForm.clubId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!generatedClubId) {
      generatedClubId = 'club_' + clubName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) + '_' + Math.floor(1000 + Math.random() * 9000);
    }

    // Validate owner
    let ownerName = '';
    let ownerPhone = '';
    let ownerEmail = '';
    let ownerUid = '';

    if (duplicateForm.ownerType === 'existing') {
      const chosenCoach = users.find(u => u.uid === duplicateForm.selectedOwnerUid);
      if (!chosenCoach) {
        setDuplicateError('કૃપા કરીને ક્લબ ઓનર પસંદ કરો.');
        return;
      }
      ownerName = chosenCoach.name || '';
      ownerPhone = duplicateForm.newOwnerPhone || chosenCoach.phone || '';
      ownerEmail = duplicateForm.newOwnerEmail || chosenCoach.email || '';
      ownerUid = chosenCoach.uid;
    } else {
      if (!duplicateForm.newOwnerName.trim() || !duplicateForm.newOwnerPhone.trim()) {
        setDuplicateError('કૃપા કરીને નવા ઓનરનું નામ અને મોબાઈલ નંબર લખો.');
        return;
      }
      ownerName = duplicateForm.newOwnerName.trim();
      ownerPhone = duplicateForm.newOwnerPhone.trim();
      ownerEmail = duplicateForm.newOwnerEmail.trim();
      ownerUid = doc(collection(db, 'users')).id;
    }

    const cleanOwnerPhone = ownerPhone.replace(/[^0-9]/g, '');
    if (!ownerEmail) {
      ownerEmail = cleanOwnerPhone ? `${cleanOwnerPhone}@vriddhi.local` : `owner_${generatedClubId}@vriddhi.local`;
    }

    setDuplicateLoading(true);
    try {
      setDuplicateProgress('૧/૪ નવી ક્લબ બનાવી રહ્યા છીએ...');

      // 1. Save new Club document
      await setDoc(doc(db, 'clubs', generatedClubId), {
        id: generatedClubId,
        name: clubName.trim(),
        clubCode: clubName.trim().toUpperCase(),
        ownerUid: ownerUid,
        ownerName: ownerName,
        ownerPhone: ownerPhone,
        ownerEmail: ownerEmail,
        parentClubId: activeClubId,
        createdBy: currentAdminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setDuplicateProgress('૨/૪ નવા ક્લબ ઓનરનું એકાઉન્ટ સેટ કરી રહ્યા છીએ...');

      // 2. Set up Club Owner in users collection with role: 'admin'
      if (duplicateForm.ownerType === 'existing') {
        await updateDoc(doc(db, 'users', ownerUid), {
          role: 'admin',
          clubId: generatedClubId,
          clubName: clubName.trim(),
          clubCode: clubName.trim().toUpperCase(),
          isStaff: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', ownerUid), {
          uid: ownerUid,
          name: ownerName,
          phone: ownerPhone,
          email: ownerEmail,
          role: 'admin',
          clubId: generatedClubId,
          clubName: clubName.trim(),
          clubCode: clubName.trim().toUpperCase(),
          registrationCompleted: true,
          isStaff: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setDuplicateProgress('૩/૪ પસંદ કરેલા સભ્યોને નવી પેનલમાં ટ્રાન્સફર કરી રહ્યા છીએ...');

      // 3. Transfer selected team members to the new club in parallel
      const membersToTransfer = duplicateForm.selectedMemberUids.filter(uid => uid !== ownerUid);

      await Promise.all(
        membersToTransfer.map(memberUid =>
          updateDoc(doc(db, 'users', memberUid), {
            clubId: generatedClubId,
            clubName: clubName.trim(),
            clubCode: clubName.trim().toUpperCase(),
            updatedAt: serverTimestamp(),
          })
        )
      );

      // Collect all transferred UIDs (Owner + Members)
      const allTransferredUids = new Set([ownerUid, ...membersToTransfer]);

      setDuplicateProgress('૪/૪ ટ્રાન્સફર થયેલા સભ્યોનો પોતાનો ડેટા સુરક્ષિત રીતે શિફ્ટ કરી રહ્યા છીએ...');

      // 4. Fast atomic batch update for personal CRM leads, customer profiles, follow-ups
      try {
        const batch = writeBatch(db);
        let batchOps = 0;

        // a) CRM Enquiries belonging to transferred coaches
        const crmSnap = await getDocs(collection(db, 'crm_enquiries'));
        for (const lDoc of crmSnap.docs) {
          const lData = lDoc.data();
          if (allTransferredUids.has(lData.coachId) || allTransferredUids.has(lData.staffUid)) {
            batch.update(doc(db, 'crm_enquiries', lDoc.id), {
              clubId: generatedClubId,
              updatedAt: serverTimestamp(),
            });
            batchOps++;
          }
        }

        // b) Customer Profiles belonging to transferred coaches or members
        const profSnap = await getDocs(collection(db, 'customer_profiles'));
        for (const pDoc of profSnap.docs) {
          const pData = pDoc.data();
          if (allTransferredUids.has(pData.coachId) || allTransferredUids.has(pData.uid) || allTransferredUids.has(pDoc.id)) {
            batch.update(doc(db, 'customer_profiles', pDoc.id), {
              clubId: generatedClubId,
              updatedAt: serverTimestamp(),
            });
            batchOps++;
          }
        }

        // c) Customer Follow-ups belonging to transferred coaches
        const fuSnap = await getDocs(collection(db, 'customer_followups'));
        for (const fDoc of fuSnap.docs) {
          const fData = fDoc.data();
          if (allTransferredUids.has(fData.coachId) || allTransferredUids.has(fData.customerUid)) {
            batch.update(doc(db, 'customer_followups', fDoc.id), {
              clubId: generatedClubId,
              updatedAt: serverTimestamp(),
            });
            batchOps++;
          }
        }

        if (batchOps > 0) {
          await batch.commit();
        }
      } catch (batchErr) {
        console.warn('Personal data batch shift note:', batchErr);
      }

      setDuplicateSuccess({
        clubName: clubName.trim(),
        clubId: generatedClubId,
        ownerName,
        ownerPhone,
        ownerEmail,
        totalMembersCloned: allTransferredUids.size,
      });
    } catch (err) {
      console.error('Error duplicating club:', err);
      setDuplicateError('ડુપ્લિકેશન દરમિયાન ભૂલ આવી: ' + (err.message || 'અજ્ઞાત ભૂલ'));
    } finally {
      setDuplicateLoading(false);
      setDuplicateProgress('');
    }
  };

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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Club Owner Panel</h2>
            <span style={{
              background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '800'
            }}>
              {clubs.find(c => c.id === activeClubId)?.name || (activeClubId === 'main' ? 'PRV' : activeClubId)}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage all users, roles, coach assignments, and club panel duplication
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {clubs.length > 0 && (
            <select
              value={activeClubId}
              onChange={(e) => setActiveClubId(e.target.value)}
              className="crm-filter-select"
              style={{ fontWeight: '700', borderColor: '#8b5cf6' }}
              title="Switch Viewing Club"
              id="admin-club-switcher"
            >
              <option value="main">🏢 PRV (મુખ્ય પેનલ)</option>
              {clubs.filter(c => c.id !== 'main').map(c => (
                <option key={c.id} value={c.id}>🏢 {c.name || c.clubCode || c.id}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={openDuplicateModal}
            className="btn btn-primary"
            style={{
              width: 'auto', gap: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none', boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
              padding: '9px 18px', fontWeight: '800', fontSize: '0.86rem'
            }}
            id="duplicate-club-panel-btn"
          >
            🏢 આખી ટીમ / પેનલ ડુપ્લિકેટ કરો
          </button>
        </div>
      </div>

      {permissionError && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '4px' }}>
            ⚠️ Cloud Firestore Rules Permission Notice
          </div>
          <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
            તમારા Firebase ડેટાબેઝ (`vriddhi-76142`) ના Firestore Security Rules મા કલેક્શન રીડ પરમિશન ઓટો-એક્સપાયર થયેલ હોઈ શકે છે.
          </p>
          <p style={{ fontSize: '0.82rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '10px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
            Firebase Console ➔ Build ➔ Cloud Firestore ➔ Rules મા આ 1 લાઇન પેસ્ટ કરીને Publish કરો:
            {`\nrules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`}
          </p>
          <button onClick={() => fetchAllUsers()} className="btn btn-primary btn-sm" style={{ marginTop: '10px', width: 'auto' }}>
            🔄 Retry Loading All Users & Roles
          </button>
        </div>
      )}

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
                        ? formatDate(userRow.createdAt.toDate())
                        : formatDate(userRow.createdAt)}
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
      {/* ── DUPLICATE CLUB PANEL MODAL ── */}
      {showDuplicateModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-card" style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {duplicateSuccess ? '🎉 પેનલ ડુપ્લિકેટ સફળ!' : '🏢 નવી પેનલ અને ટીમ ડુપ્લિકેટ કરો'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                  {duplicateSuccess
                    ? 'નવી પેનલ અને ટીમ તૈયાર થઈ ગઈ છે'
                    : 'આ પેનલમાંથી નવી ક્લબ બનાવો, ઓનર પસંદ કરો અને ટીમ ડુપ્લિકેટ કરો'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateSuccess(null);
                  setDuplicateError('');
                }}
                className="modal-close"
              >
                &times;
              </button>
            </div>

            {duplicateSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px', padding: '18px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                  <h4 style={{ color: '#059669', fontSize: '1.2rem', marginBottom: '6px' }}>
                    નવી પેનલ સફળતાપૂર્વક બની ગઈ છે!
                  </h4>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    બધા નિયમો, રોલ્સ, CRM અને અટેન્ડન્સ નવી પેનલ માટે સેટ થઈ ગયા છે.
                  </p>
                </div>

                <div style={{
                  background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                  borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>ક્લબનું નામ:</span>
                    <span style={{ fontWeight: '800' }}>{duplicateSuccess.clubName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Club ID:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#6366f1' }}>{duplicateSuccess.clubId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>નવા Club Owner:</span>
                    <span style={{ fontWeight: '800', color: '#7c3aed' }}>{duplicateSuccess.ownerName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>લોગિન મોબાઈલ / ઈમેલ:</span>
                    <span style={{ fontWeight: '700' }}>{duplicateSuccess.ownerPhone || duplicateSuccess.ownerEmail}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>ડુપ્લિકેટ થયેલ સભ્યો:</span>
                    <span style={{ fontWeight: '800', color: '#10b981' }}>{duplicateSuccess.totalMembersCloned} સભ્યો</span>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)',
                  padding: '12px', borderRadius: '10px', lineHeight: 1.5
                }}>
                  💡 <strong>માહિતી:</strong> નવા Club Owner હવે તેમના મોબાઈલ નંબરથી સીધા લોગિન કરી શકશે. સોફ્ટવેરમાં તમે જે પણ ફેરફાર કરશો તે આપોઆપ આ નવી પેનલમાં પણ દેખાશે.
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClubId(duplicateSuccess.clubId);
                      setShowDuplicateModal(false);
                      setDuplicateSuccess(null);
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1, fontWeight: '800' }}
                  >
                    🏢 નવી પેનલ જુઓ (View New Club)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicateModal(false);
                      setDuplicateSuccess(null);
                    }}
                    className="btn btn-outline"
                    style={{ width: 'auto' }}
                  >
                    બંધ કરો (Close)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteDuplication} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '12px' }}>
                {duplicateError && (
                  <div className="alert alert-danger" style={{ fontSize: '0.86rem' }}>
                    ⚠️ {duplicateError}
                  </div>
                )}

                {/* 1. Club Name & Zoom Club Code */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '800' }}>
                    ૧. નવી ક્લબનું નામ / Zoom Club Code <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
                    (મુખ્ય ક્લબનું નામ <b>PRV</b> છે. અહીં જે નામ આપશો એ જ તેમના Zoom meeting માં club code બનશે.)
                  </p>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="દા.ત. PRV2 અથવા SURAT"
                    value={duplicateForm.clubName}
                    onChange={(e) => setDuplicateForm(prev => ({ ...prev, clubName: e.target.value }))}
                    disabled={duplicateLoading}
                    required
                  />
                </div>

                {/* 2. Choose Club Owner */}
                <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '12px' }}>
                  <label className="form-label" style={{ fontWeight: '800', marginBottom: '10px', display: 'block' }}>
                    ૨. આ નવી પેનલમાં Club Owner કોણ રહેશે? <span style={{ color: '#ef4444' }}>*</span>
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setDuplicateForm(prev => ({ ...prev, ownerType: 'existing' }))}
                      className={`btn btn-sm ${duplicateForm.ownerType === 'existing' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1, width: 'auto', fontWeight: '700' }}
                    >
                      👤 હાલના સભ્ય / કોચમાંથી પસંદ કરો
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateForm(prev => ({ ...prev, ownerType: 'new' }))}
                      className={`btn btn-sm ${duplicateForm.ownerType === 'new' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1, width: 'auto', fontWeight: '700' }}
                    >
                      ➕ નવો યુઝર ઉમેરો
                    </button>
                  </div>

                  {duplicateForm.ownerType === 'existing' ? (
                    <div>
                      <select
                        className="form-input"
                        value={duplicateForm.selectedOwnerUid}
                        onChange={(e) => {
                          const uid = e.target.value;
                          const found = users.find(u => u.uid === uid);
                          setDuplicateForm(prev => ({
                            ...prev,
                            selectedOwnerUid: uid,
                            newOwnerPhone: found?.phone || '',
                            newOwnerEmail: found?.email || ''
                          }));
                        }}
                        disabled={duplicateLoading}
                        style={{ fontWeight: '600' }}
                      >
                        <option value="">— Club Owner પસંદ કરો —</option>
                        {users.map(u => (
                          <option key={u.uid} value={u.uid}>
                            {u.name} ({u.role === 'coach' ? 'Coach' : u.role === 'admin' ? 'Club Owner' : 'Customer'}) - {u.phone || u.email}
                          </option>
                        ))}
                      </select>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        ℹ️ આ વ્યક્તિ નવી પેનલમાં <strong>Club Owner (Admin)</strong> બની જશે અને બધી પરમિશનો મળશે.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>ઓનરનું પૂરું નામ *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="દા.ત. રમેશભાઈ પટેલ"
                          value={duplicateForm.newOwnerName}
                          onChange={(e) => setDuplicateForm(prev => ({ ...prev, newOwnerName: e.target.value }))}
                          disabled={duplicateLoading}
                          required={duplicateForm.ownerType === 'new'}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>મોબાઈલ નંબર *</label>
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="દા.ત. 9876543210"
                          value={duplicateForm.newOwnerPhone}
                          onChange={(e) => setDuplicateForm(prev => ({ ...prev, newOwnerPhone: e.target.value }))}
                          disabled={duplicateLoading}
                          required={duplicateForm.ownerType === 'new'}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Team Members selection */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: '800', margin: 0 }}>
                      ૩. સાથે કયા કયા સભ્યોને ડુપ્લિકેટ કરવા છે? ({duplicateForm.selectedMemberUids.length}/{users.length})
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => selectAllMembers(true)}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', padding: '2px 8px', width: 'auto' }}
                      >
                        બધા સિલેક્ટ
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAllMembers(false)}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.72rem', padding: '2px 8px', width: 'auto' }}
                      >
                        ક્લિયર
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    પસંદ કરેલા સભ્યો અને <strong>તેમનો પોતાનો તમામ ડેટા (CRM લીડ્સ, ફોલો-અપ, હાજરી)</strong> સુરક્ષિત રીતે નવી પેનલમાં ટ્રાન્સફર થશે. કોઈ ડેટા મર્જ કે ડુપ્લિકેટ નહીં થાય.
                  </p>

                  <div style={{
                    maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)',
                    borderRadius: '10px', padding: '8px', background: 'var(--card-bg)'
                  }}>
                    {users.map(u => {
                      const isOwner = duplicateForm.ownerType === 'existing' && u.uid === duplicateForm.selectedOwnerUid;
                      const isChecked = duplicateForm.selectedMemberUids.includes(u.uid);

                      return (
                        <label
                          key={u.uid}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px',
                            borderRadius: '6px', cursor: isOwner ? 'default' : 'pointer',
                            background: isOwner ? 'rgba(124, 58, 237, 0.08)' : isChecked ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                            marginBottom: '4px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked || isOwner}
                            disabled={isOwner || duplicateLoading}
                            onChange={() => toggleMemberSelection(u.uid)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: '600', fontSize: '0.85rem', flex: 1 }}>
                            {u.name} {isOwner && <strong style={{ color: '#7c3aed' }}>(નવા Club Owner)</strong>}
                          </span>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '8px',
                            background: u.role === 'coach' ? '#ecfdf5' : u.role === 'admin' ? '#f3e8ff' : '#eff6ff',
                            color: u.role === 'coach' ? '#059669' : u.role === 'admin' ? '#7c3aed' : '#2563eb'
                          }}>
                            {u.role || 'customer'}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {u.phone || ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {duplicateLoading && (
                  <div style={{
                    padding: '14px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)', color: '#4f46e5',
                    fontWeight: '700', fontSize: '0.88rem', textAlign: 'center'
                  }}>
                    ⏳ {duplicateProgress || 'ટ્રાન્સફર ચાલુ છે, કૃપા કરીને રાહ જુઓ...'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    disabled={duplicateLoading}
                    className="btn btn-outline"
                    style={{ width: '35%' }}
                  >
                    રદ કરો (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={duplicateLoading}
                    className="btn btn-primary"
                    style={{
                      width: '65%', fontWeight: '800',
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                    }}
                    id="submit-duplicate-club-btn"
                  >
                    {duplicateLoading ? 'ટ્રાન્સફર થઈ રહ્યું છે...' : '🚀 ટીમ અને નવી પેનલ ટ્રાન્સફર કરો'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
