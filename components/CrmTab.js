'use client';

import React, { useState, useEffect, Component } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CrmEnquiryModal from './CrmEnquiryModal';
import BulkAddLeadsModal from './BulkAddLeadsModal';
import ConvertLeadModal from './ConvertLeadModal';
import { ClipboardList, MoreVertical, Trash2, Edit3, UserCheck, MessageCircle, Search } from 'lucide-react';
import { logCrmCall } from '@/lib/logCrmCall';
import { openWhatsAppChat } from '@/lib/whatsapp';

const STATUS_OPTIONS = [
  'All',
  'New Lead',
  '1 Session',
  '2 Session',
  'Closing',
  'Waiting List',
  'Rejected'
];

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'New Lead':
    case 'New':
      return { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
    case '1 Session':
      return { bg: '#f3e8ff', color: '#6b21a8', border: '#c084fc' };
    case '2 Session':
      return { bg: '#fce7f3', color: '#9d174d', border: '#f472b6' };
    case 'Closing':
    case 'Converted':
      return { bg: '#d1fae5', color: '#065f46', border: '#34d399' };
    case 'Waiting List':
    case 'Interested':
      return { bg: '#fef3c7', color: '#92400e', border: '#fbbf24' };
    case 'Rejected':
    case 'Not Interested':
      return { bg: '#fee2e2', color: '#991b1b', border: '#f87171' };
    default:
      return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  }
}

function getLeadCallPriority(enquiry) {
  if (enquiry.nextMeetingDate) {
    return {
      key: 'meeting_scheduled',
      label: `🎥 Meeting (${enquiry.nextMeetingSession === 'evening' ? 'Evening' : 'Morning'} ${enquiry.nextMeetingDate})`,
      bg: enquiry.nextMeetingSession === 'evening' ? '#faf5ff' : '#e0f2fe',
      color: enquiry.nextMeetingSession === 'evening' ? '#7e22ce' : '#0369a1',
      border: enquiry.nextMeetingSession === 'evening' ? '#e9d5ff' : '#bae6fd',
      priorityRank: 2,
    };
  }

  if (enquiry.followUpDate) {
    return {
      key: 'followup_scheduled',
      label: `📅 Follow-up (${enquiry.followUpDate})`,
      bg: '#eff6ff',
      color: '#1d4ed8',
      border: '#bfdbfe',
      priorityRank: 3,
    };
  }

  const logs = enquiry.callLogs || [];
  if (!logs || logs.length === 0) {
    return {
      key: 'first_call_pending',
      label: '🚨 First Call Pending',
      bg: '#fff1f2',
      color: '#e11d48',
      border: '#fecdd3',
      priorityRank: 1, // Highest Priority!
    };
  }

  const lastLog = logs[0];
  const outcome = lastLog?.outcome || '📞 Call Placed';

  if (outcome === '📞 Called' || outcome.includes('Called')) {
    return {
      key: 'outcome_called',
      label: '📞 Called',
      bg: '#e0f2fe',
      color: '#0369a1',
      border: '#bae6fd',
      priorityRank: 2,
    };
  }

  if (outcome.includes('Answered') || outcome.includes('Interested')) {
    return {
      key: 'outcome_answered',
      label: outcome,
      bg: '#f0fdf4',
      color: '#15803d',
      border: '#bbf7d0',
      priorityRank: 4,
    };
  }
  if (outcome.includes('Later') || outcome.includes('Back')) {
    return {
      key: 'outcome_callback',
      label: outcome,
      bg: '#fffbeb',
      color: '#b45309',
      border: '#fde68a',
      priorityRank: 2,
    };
  }
  if (outcome.includes('No Answer') || outcome.includes('Busy')) {
    return {
      key: 'outcome_noanswer',
      label: outcome,
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '#fca5a5',
      priorityRank: 1, // High Priority to retry!
    };
  }
  if (outcome.includes('Not Interested')) {
    return {
      key: 'outcome_not_interested',
      label: outcome,
      bg: '#f3f4f6',
      color: '#4b5563',
      border: '#e5e7eb',
      priorityRank: 5,
    };
  }

  return {
    key: 'other',
    label: outcome,
    bg: '#f3f4f6',
    color: '#374151',
    border: '#d1d5db',
    priorityRank: 4,
  };
}

// Local Error Boundary — catches CrmEnquiryModal crashes without crashing the whole page
class ModalErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, msg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, msg: error?.message || 'Unknown error' }; }
  componentDidCatch(error) { console.error('[CRM Modal Error]', error); }
  render() {
    if (this.state.hasError) {
      if (typeof window === 'undefined') return null;
      return createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => { this.setState({ hasError: false, msg: '' }); this.props.onClose?.(); }}>
          <div className="modal-card" style={{ maxWidth: '440px', width: '92vw', padding: '24px', textAlign: 'center', background: '#ffffff', borderRadius: '16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#dc2626', marginBottom: '8px' }}>Lead Details Error</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Lead વિગતો ખોલવામાં સહેજ સમસ્યા આવી.
            </p>
            <p style={{ fontSize: '0.72rem', color: '#6b7280', fontFamily: 'monospace', background: '#f3f4f6', padding: '8px', borderRadius: '6px', marginBottom: '16px', wordBreak: 'break-word' }}>
              {this.state.msg}
            </p>
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, msg: '' }); this.props.onClose?.(); }}
              style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
            >
              ✕ બંધ કરો (Close)
            </button>
          </div>
        </div>,
        document.body
      );
    }
    return this.props.children;
  }
}

export default function CrmTab({ coachUid, coachName = '', userRole = 'coach' }) {
  const [enquiries, setEnquiries]   = useState([]);
  const [coaches, setCoaches]       = useState([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filterStatus, setFilterStatus]     = useState('All');
  const [filterFollowUp, setFilterFollowUp] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('All');
  const [filterStaff, setFilterStaff]         = useState('my_leads');
  const [sortBy, setSortBy]                   = useState('priority');
  const [searchQuery, setSearchQuery]         = useState('');

  // Modals & Menu
  const [showModal, setShowModal]           = useState(false);
  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [convertLead, setConvertLead]       = useState(null);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [autoCallLogFocus, setAutoCallLogFocus] = useState(false);
  const [activeMenuId, setActiveMenuId]     = useState(null);
  const [menuPos, setMenuPos]               = useState({ top: 0, right: 0, left: 'auto' });

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    if (activeMenuId) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  const handleDeleteEnquiry = async (enquiryId, enquiryName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`શું તમે ખરેખર "${enquiryName}" લીડ ડીલીટ કરવા માંગો છો?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'crm_enquiries', enquiryId));
      await fetchEnquiries();
    } catch (error) {
      console.error('Error deleting enquiry:', error);
      alert('Error deleting lead. Please try again.');
    }
  };

  useEffect(() => {
    if (!coachUid) return;

    setLoading(true);

    // Load coaches/staff list once
    getDocs(collection(db, 'users')).then(usersSnap => {
      const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const designatedStaff = allUsers.filter(u => u.isStaff === true);
      const coachesList = designatedStaff.length > 0
        ? designatedStaff
        : allUsers.filter(u => u.role === 'coach' || u.role === 'admin');
      setCoaches(coachesList);
    }).catch(console.error);

    // Real-time live listener for CRM enquiries
    const crmRef = collection(db, 'crm_enquiries');
    const primaryQuery = (userRole === 'admin')
      ? crmRef
      : query(crmRef, where('coachId', '==', coachUid));

    const handleSnap = (snap) => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setEnquiries(list);
      setLoading(false);
    };

    const unsubscribe = onSnapshot(primaryQuery, handleSnap, (err) => {
      console.warn('CRM snapshot error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coachUid, userRole]);

  const fetchEnquiries = async () => {
    // No-op: real-time onSnapshot handles updates automatically
  };

  const handleSaveEnquiry = async (data, existingId, keepOpen = false) => {
    try {
      const assignedStaffName = data.staffName || data.coachName || '';

      if (existingId) {
        const docRef = doc(db, 'crm_enquiries', existingId);
        const updateData = {
          name: data.name,
          phone: data.phone,
          address: data.address || '',
          weight: data.weight || '',
          age: data.age || '',
          height: data.height || '',
          healthCondition: data.healthCondition || '',
          source: data.source,
          status: data.status,
          waitingListReason: data.waitingListReason || '',
          coachId: coachUid,
          staffName: assignedStaffName,
          followUpDate: data.followUpDate || '',
          nextMeetingDate: data.nextMeetingDate || '',
          nextMeetingSession: data.nextMeetingSession || 'morning',
          notes: data.notes,
          callLogs: data.callLogs || [],
          updatedAt: serverTimestamp(),
        };

        if (data.statusChanged) {
          const existingEnquiry = enquiries.find(e => e.id === existingId);
          const currentHistory = existingEnquiry?.statusHistory || [];
          const reasonNote = data.status === 'Waiting List' && data.waitingListReason ? ` (Reason: ${data.waitingListReason})` : '';
          updateData.statusHistory = [
            ...currentHistory,
            {
              status: data.status,
              note: `Changed from "${data.oldStatus}" to "${data.status}"${reasonNote}`,
              changedAt: new Date().toISOString(),
            },
          ];
        }

        await updateDoc(docRef, updateData);
      } else {
        await addDoc(collection(db, 'crm_enquiries'), {
          coachId: coachUid,
          staffName: assignedStaffName,
          name: data.name,
          phone: data.phone,
          address: data.address || '',
          weight: data.weight || '',
          age: data.age || '',
          height: data.height || '',
          healthCondition: data.healthCondition || '',
          source: data.source || 'Direct Entry',
          status: data.status || 'New Lead',
          waitingListReason: data.waitingListReason || '',
          followUpDate: data.followUpDate || '',
          nextMeetingDate: data.nextMeetingDate || '',
          nextMeetingSession: data.nextMeetingSession || 'morning',
          notes: data.notes,
          callLogs: data.callLogs || [],
          statusHistory: [
            {
              status: data.status || 'New Lead',
              note: 'Enquiry created',
              changedAt: new Date().toISOString(),
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await fetchEnquiries();
      if (!keepOpen) {
        setShowModal(false);
        setEditingEnquiry(null);
      }
    } catch (error) {
      console.error('Error saving enquiry:', error);
      throw error;
    }
  };

  const openAddModal = () => { setEditingEnquiry(null); setAutoCallLogFocus(false); setShowModal(true); };
  const openEditModal = (enquiry, callFocus = false) => {
    setEditingEnquiry(enquiry);
    setAutoCallLogFocus(callFocus);
    setShowModal(true);
  };

  // Active pipeline excludes leads converted to customers
  const activeEnquiries = enquiries.filter(e => !e.isConverted && !e.convertedCustomerUid && e.status !== 'Converted' && e.status !== 'Converted / Active Customer');

  // Scoped enquiries based on selected staff filter
  const getScopedEnquiries = () => {
    if (filterStaff === 'my_leads' || userRole !== 'admin') {
      return activeEnquiries.filter(e => e.coachId === coachUid);
    }
    return activeEnquiries.filter(e => e.coachId === filterStaff || e.staffName === filterStaff);
  };

  const scopedEnquiries = getScopedEnquiries();

  const getFilteredEnquiries = () => {
    let filtered = [...scopedEnquiries];

    if (filterStatus !== 'All') {
      filtered = filtered.filter(e => e.status === filterStatus);
    }

    // Search by name, phone, address
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        (e.address || '').toLowerCase().includes(q)
      );
    }

    if (filterFollowUp) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      if (filterFollowUp === 'overdue') {
        filtered = filtered.filter(e => e.followUpDate && e.followUpDate < todayStr);
      } else if (filterFollowUp === 'today') {
        filtered = filtered.filter(e => e.followUpDate === todayStr);
      } else if (filterFollowUp === 'upcoming') {
        filtered = filtered.filter(e => e.followUpDate && e.followUpDate > todayStr);
      }
    }

    if (filterCallStatus !== 'All') {
      filtered = filtered.filter(e => {
        const prio = getLeadCallPriority(e);
        return prio.key === filterCallStatus;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const prioA = getLeadCallPriority(a).priorityRank;
        const prioB = getLeadCallPriority(b).priorityRank;
        if (prioA !== prioB) return prioA - prioB;
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      } else if (sortBy === 'oldest') {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateA - dateB;
      } else if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else {
        // newest
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      }
    });

    return filtered;
  };

  const filteredEnquiries = getFilteredEnquiries();

  const stats = {
    total: scopedEnquiries.length,
    pendingCall: scopedEnquiries.filter(e => getLeadCallPriority(e).key === 'first_call_pending').length,
    newLead: scopedEnquiries.filter(e => e.status === 'New Lead' || e.status === 'New').length,
    sess1: scopedEnquiries.filter(e => e.status === '1 Session').length,
    sess2: scopedEnquiries.filter(e => e.status === '2 Session').length,
    closing: scopedEnquiries.filter(e => e.status === 'Closing').length,
    waiting: scopedEnquiries.filter(e => e.status === 'Waiting List').length,
    rejected: scopedEnquiries.filter(e => e.status === 'Rejected' || e.status === 'Not Interested').length,
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading CRM data...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>CRM — Pipeline & Leads</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Click any lead row to open details, update stage, or convert to active customer
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowBulkModal(true)}
            className="btn btn-secondary"
            id="crm-bulk-add-btn"
            style={{ width: 'auto', fontSize: '0.85rem', fontWeight: '800' }}
          >
            ⚡ Bulk Add Leads
          </button>
          <button
            onClick={openAddModal}
            className="btn btn-primary"
            id="crm-add-enquiry-btn"
            style={{ width: 'auto', fontSize: '0.85rem', fontWeight: '800' }}
          >
            + Add Single Lead
          </button>
        </div>
      </div>

      {/* Pipeline Quick Stats (Interactive cards for all 7 stages) */}
      <div className="crm-pipeline-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '4px', marginBottom: '12px' }}>
        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('All')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === 'All' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
            background: filterStatus === 'All' ? 'var(--primary-light)' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view All leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)', lineHeight: 1 }}>{stats.total}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>TOTAL</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => { setFilterStatus('All'); setFilterCallStatus('first_call_pending'); }}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterCallStatus === 'first_call_pending' ? '1.5px solid #e11d48' : '1px solid #fecdd3',
            background: filterCallStatus === 'first_call_pending' ? '#fff1f2' : '#fff1f2',
            overflow: 'hidden',
          }}
          title="Click to view First Call Pending leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#e11d48', lineHeight: 1 }}>{stats.pendingCall}</span>
          <span style={{ fontSize: '0.58rem', color: '#e11d48', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CALL PENDING</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('New Lead')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === 'New Lead' ? '1.5px solid #0ea5e9' : '1px solid var(--border-color)',
            background: filterStatus === 'New Lead' ? '#f0f9ff' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view New Leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0ea5e9', lineHeight: 1 }}>{stats.newLead}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>NEW LEAD</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('1 Session')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === '1 Session' ? '1.5px solid #8b5cf6' : '1px solid var(--border-color)',
            background: filterStatus === '1 Session' ? '#f5f3ff' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view 1 Session leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#8b5cf6', lineHeight: 1 }}>{stats.sess1}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>1 SESSION</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('2 Session')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === '2 Session' ? '1.5px solid #ec4899' : '1px solid var(--border-color)',
            background: filterStatus === '2 Session' ? '#fdf2f8' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view 2 Session leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#ec4899', lineHeight: 1 }}>{stats.sess2}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>2 SESSION</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Closing')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === 'Closing' ? '1.5px solid #10b981' : '1px solid var(--border-color)',
            background: filterStatus === 'Closing' ? '#f0fdf4' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view Closing leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>{stats.closing}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CLOSING</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Waiting List')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === 'Waiting List' ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
            background: filterStatus === 'Waiting List' ? '#fffbeb' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view Waiting List leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#f59e0b', lineHeight: 1 }}>{stats.waiting}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>WAITING LIST</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Rejected')}
          style={{
            padding: '5px 3px', textAlign: 'center', gap: '0px', cursor: 'pointer',
            border: filterStatus === 'Rejected' ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
            background: filterStatus === 'Rejected' ? '#fef2f2' : 'var(--card-bg)',
            overflow: 'hidden',
          }}
          title="Click to view Rejected leads"
        >
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#ef4444', lineHeight: 1 }}>{stats.rejected}</span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>REJECTED</span>
        </div>
      </div>

      {/* Toolbar: Filters & Sorting */}
      <div className="crm-toolbar" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--card-bg)',
          border: searchQuery ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0 12px',
          flex: '1 1 auto',
          width: '100%',
          boxSizing: 'border-box',
          height: '38px',
          minHeight: '38px',
          maxHeight: '38px',
          transition: 'border-color 0.15s ease',
        }}>
          <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginRight: '8px' }} />
          <input
            type="text"
            id="crm-search-input"
            placeholder="Search by name, mobile, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              outline: 'none',
              padding: '6px 0',
              fontWeight: '500',
              width: '100%',
              minWidth: 0,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                color: 'var(--text-muted)', lineHeight: 1, padding: '2px', marginLeft: '4px',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>


        <select
          className="crm-filter-select"
          value={filterFollowUp}
          onChange={(e) => setFilterFollowUp(e.target.value)}
          id="crm-filter-followup"
        >
          <option value="">All Follow-ups</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
        </select>

        <select
          className="crm-filter-select"
          value={filterCallStatus}
          onChange={(e) => setFilterCallStatus(e.target.value)}
          id="crm-filter-call-status"
          style={{ fontWeight: '700' }}
        >
          <option value="All">All Call Statuses</option>
          <option value="first_call_pending">🚨 First Call Pending</option>
          <option value="outcome_called">📞 Called</option>
          <option value="meeting_scheduled">🎥 Meeting Scheduled</option>
          <option value="followup_scheduled">📅 Follow-up Scheduled</option>
          <option value="outcome_answered">📞 Answered & Interested</option>
          <option value="outcome_callback">⏰ Call Back Later</option>
          <option value="outcome_noanswer">❌ No Answer / Busy</option>
          <option value="outcome_not_interested">🚫 Not Interested</option>
        </select>

        {/* Staff Filter Dropdown (Club Owner ONLY) */}
        {userRole === 'admin' && (
          <select
            className="crm-filter-select"
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            id="crm-filter-staff"
            style={{ fontWeight: '700', borderColor: filterStaff !== 'my_leads' ? 'var(--primary)' : undefined }}
          >
            <option value="my_leads">👤 My Assigned Leads Only</option>
            {coaches.map(c => (
              <option key={c.uid || c.id} value={c.uid || c.name}>
                👤 {c.name || c.email}'s Leads
              </option>
            ))}
          </select>
        )}

        <select
          className="crm-filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          id="crm-sort-by"
          style={{ fontWeight: '800', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
        >
          <option value="priority">⚡ Priority (Pending Calls First)</option>
          <option value="newest">📅 Newest First</option>
          <option value="oldest">🗓️ Oldest First</option>
          <option value="name">🔤 Name (A-Z)</option>
        </select>

        {(filterStatus !== 'All' || filterFollowUp || filterCallStatus !== 'All' || sortBy !== 'priority' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setFilterStatus('All');
              setFilterFollowUp('');
              setFilterCallStatus('All');
              setSortBy('priority');
              setSearchQuery('');
            }}
            style={{
              padding: '6px 12px', fontSize: '0.78rem', fontWeight: '800',
              background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5',
              borderRadius: '8px', cursor: 'pointer'
            }}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Enquiries Table */}
      {filteredEnquiries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon"><ClipboardList size={40} color="#94a3b8" /></span>
          <h4>{enquiries.length === 0 ? 'No leads in CRM pipeline' : 'No leads match your filter'}</h4>
          <p>{enquiries.length === 0 ? 'Click "+ Bulk Add Leads" or "+ Add Single Lead" to start your pipeline.' : 'Try changing your status filter.'}</p>
        </div>
      ) : (
        <div className="crm-table-container">
          <table className="crm-table" id="crm-enquiries-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '340px' }}>Lead Name & Status</th>
                <th style={{ width: '220px' }}>Phone</th>
                <th style={{ width: '160px' }}>Follow-up</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnquiries.map((enquiry, index) => {
                const badge = getStatusBadgeStyle(enquiry.status);
                const callPrio = getLeadCallPriority(enquiry);

                return (
                  <tr
                    key={enquiry.id}
                    id={`crm-row-${enquiry.id}`}
                    onClick={() => openEditModal(enquiry)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view lead details & history"
                  >
                    {/* Index Number */}
                    <td style={{ fontWeight: '800', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      #{index + 1}
                    </td>

                    {/* Black Lead Name + Status Badge + Staff Badge + Call Status Badge */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#000000', fontWeight: '900', fontSize: '0.92rem' }}>
                            {enquiry.name}
                          </span>
                          <span style={{
                            padding: '2px 9px', borderRadius: '99px',
                            fontSize: '0.72rem', fontWeight: '800', whiteSpace: 'nowrap',
                            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                          }}>
                            {enquiry.status}
                          </span>
                          {(enquiry.staffName || enquiry.coachName) && (
                            <span style={{
                              padding: '2px 8px', borderRadius: '6px',
                              fontSize: '0.7rem', fontWeight: '800', whiteSpace: 'nowrap',
                              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1'
                            }}>
                              👤 Staff: {enquiry.staffName || enquiry.coachName}
                            </span>
                          )}
                        </div>

                        {/* Last Call / Priority Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px',
                            fontSize: '0.72rem', fontWeight: '800', whiteSpace: 'nowrap',
                            background: callPrio.bg, color: callPrio.color, border: `1px solid ${callPrio.border}`
                          }}>
                            {callPrio.label}
                          </span>

                          {(enquiry.status === 'Waiting List' || enquiry.waitingListReason) && (
                            enquiry.waitingListReason ? (
                              <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '4px',
                                padding: '4px 9px', borderRadius: '6px',
                                background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                                fontSize: '0.74rem', fontWeight: '800', wordBreak: 'break-word',
                                lineHeight: '1.35', width: 'fit-content', maxWidth: '100%'
                              }}>
                                <span style={{ flexShrink: 0, fontWeight: '800', color: '#b45309' }}>📝 Reason:</span>
                                <span style={{ fontWeight: '700', color: '#92400e' }}>
                                  {enquiry.waitingListReason}
                                </span>
                              </div>
                            ) : (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px',
                                padding: '4px 9px', borderRadius: '6px',
                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
                                fontSize: '0.74rem', fontWeight: '800',
                                lineHeight: '1.35', width: 'fit-content'
                              }}>
                                <span style={{ fontWeight: '900', color: '#dc2626' }}>
                                  ⚠️ Reason: No reason specified
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone + Call/Chat Buttons */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {enquiry.phone}
                        </span>
                        {enquiry.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (enquiry.phone) {
                                    window.location.href = `tel:${enquiry.phone}`;
                                  }
                                  // Auto-log call immediately — onSnapshot will update the list
                                  await logCrmCall(db, enquiry.id, enquiry);
                                } catch (err) {
                                  console.error('Call/log error:', err);
                                }
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '6px',
                                background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                                fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}
                              title={`Call ${enquiry.name} (${enquiry.phone}) & log response`}
                              id={`crm-call-btn-${enquiry.id}`}
                            >
                              📞 Call
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsAppChat(enquiry.phone);
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '6px',
                                background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                                fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}
                              title={`WhatsApp Chat with ${enquiry.name} (${enquiry.phone})`}
                              id={`crm-chat-btn-${enquiry.id}`}
                            >
                              💬 Chat
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Follow-up & Meeting Schedule */}
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {enquiry.nextMeetingDate ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: enquiry.nextMeetingSession === 'evening' ? '#faf5ff' : '#e0f2fe',
                          color: enquiry.nextMeetingSession === 'evening' ? '#7e22ce' : '#0369a1',
                          border: enquiry.nextMeetingSession === 'evening' ? '1px solid #e9d5ff' : '1px solid #bae6fd',
                          padding: '2px 7px', borderRadius: '4px', fontWeight: '800'
                        }}>
                          {enquiry.nextMeetingSession === 'evening' ? '🌇 Evening' : '🌅 Morning'} ({enquiry.nextMeetingDate})
                        </span>
                      ) : enquiry.followUpDate ? (
                        new Date(enquiry.followUpDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Three-dots Action Menu */}
                    <td style={{ textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeMenuId === enquiry.id) {
                            setActiveMenuId(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 175;
                            const menuHeight = 175;
                            const spaceBelow = window.innerHeight - rect.bottom;

                            let top = rect.bottom + 4;
                            if (spaceBelow < menuHeight && rect.top > menuHeight) {
                              top = rect.top - menuHeight - 4;
                            }

                            let left = rect.right - menuWidth;
                            if (left < 10) left = 10;
                            if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;

                            setMenuPos({ top, left });
                            setActiveMenuId(enquiry.id);
                          }
                        }}
                        style={{
                          background: activeMenuId === enquiry.id ? 'var(--bg-secondary)' : 'transparent',
                          border: '1px solid transparent',
                          padding: '6px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        title="Lead Options"
                        id={`crm-menu-btn-${enquiry.id}`}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeMenuId === enquiry.id && (
                        <div
                          style={{
                            position: 'fixed',
                            top: menuPos.top,
                            left: menuPos.left,
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
                            zIndex: 99999,
                            minWidth: '170px',
                            padding: '6px 0',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              openWhatsAppChat(enquiry.phone);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '9px 14px', background: 'none', border: 'none',
                              width: '100%', textAlign: 'left', cursor: 'pointer',
                              fontSize: '0.84rem', fontWeight: '700', color: '#16a34a',
                            }}
                            id={`crm-whatsapp-btn-${enquiry.id}`}
                          >
                            <MessageCircle size={15} color="#16a34a" /> WhatsApp Chat
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              openEditModal(enquiry);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '9px 14px', background: 'none', border: 'none',
                              width: '100%', textAlign: 'left', cursor: 'pointer',
                              fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)',
                            }}
                          >
                            <Edit3 size={15} color="#059669" /> Edit Details
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setConvertLead(enquiry);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '9px 14px', background: 'none', border: 'none',
                              width: '100%', textAlign: 'left', cursor: 'pointer',
                              fontSize: '0.84rem', fontWeight: '700', color: '#2563eb',
                            }}
                          >
                            <UserCheck size={15} color="#2563eb" /> Convert Lead
                          </button>

                          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                          <button
                            type="button"
                            onClick={(e) => {
                              setActiveMenuId(null);
                              handleDeleteEnquiry(enquiry.id, enquiry.name, e);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '9px 14px', background: 'none', border: 'none',
                              width: '100%', textAlign: 'left', cursor: 'pointer',
                              fontSize: '0.84rem', fontWeight: '800', color: '#dc2626',
                            }}
                            id={`crm-delete-btn-${enquiry.id}`}
                          >
                            <Trash2 size={15} color="#dc2626" /> Delete Lead
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

      {/* CRM Details / Edit Modal */}
      {showModal && (
        <ModalErrorBoundary onClose={() => setShowModal(false)}>
          <CrmEnquiryModal
            enquiry={editingEnquiry}
            onSave={handleSaveEnquiry}
            onClose={() => setShowModal(false)}
            onConvert={(enquiry) => setConvertLead(enquiry)}
            onDelete={(id, name) => handleDeleteEnquiry(id, name)}
            coaches={coaches}
            userRole={userRole}
            autoCallLogFocus={autoCallLogFocus}
          />
        </ModalErrorBoundary>
      )}

      {/* Bulk Add Leads Modal */}
      {showBulkModal && (
        <BulkAddLeadsModal
          coachUid={coachUid}
          onClose={() => setShowBulkModal(false)}
          onSaved={fetchEnquiries}
        />
      )}

      {/* Convert Lead to Customer Modal */}
      {convertLead && (
        <ConvertLeadModal
          lead={convertLead}
          coachUid={coachUid}
          onClose={() => setConvertLead(null)}
          onConverted={fetchEnquiries}
        />
      )}
    </div>
  );
}
