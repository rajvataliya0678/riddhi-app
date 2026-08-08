'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CrmEnquiryModal from './CrmEnquiryModal';
import BulkAddLeadsModal from './BulkAddLeadsModal';
import ConvertLeadModal from './ConvertLeadModal';
import { ClipboardList, MoreVertical, Trash2, Edit3, UserCheck } from 'lucide-react';
import { logCrmCall } from '@/lib/logCrmCall';

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

export default function CrmTab({ coachUid, userRole = 'coach' }) {
  const [enquiries, setEnquiries]   = useState([]);
  const [coaches, setCoaches]       = useState([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filterStatus, setFilterStatus]     = useState('All');
  const [filterFollowUp, setFilterFollowUp] = useState('');

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
    const crmQuery = query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid));
    const unsubscribe = onSnapshot(crmQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setEnquiries(list);
      setLoading(false);
    }, (err) => {
      console.error('CRM enquiries snapshot error:', err);
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
          healthCondition: data.healthCondition || '',
          source: data.source,
          status: data.status,
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
          updateData.statusHistory = [
            ...currentHistory,
            {
              status: data.status,
              note: `Changed from "${data.oldStatus}" to "${data.status}"`,
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
          healthCondition: data.healthCondition || '',
          source: data.source || 'Direct Entry',
          status: data.status || 'New Lead',
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

  const getFilteredEnquiries = () => {
    let filtered = [...activeEnquiries];

    if (filterStatus !== 'All') {
      filtered = filtered.filter(e => e.status === filterStatus);
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

    return filtered;
  };

  const filteredEnquiries = getFilteredEnquiries();

  const stats = {
    total: activeEnquiries.length,
    newLead: activeEnquiries.filter(e => e.status === 'New Lead' || e.status === 'New').length,
    sess1: activeEnquiries.filter(e => e.status === '1 Session').length,
    sess2: activeEnquiries.filter(e => e.status === '2 Session').length,
    closing: activeEnquiries.filter(e => e.status === 'Closing').length,
    waiting: activeEnquiries.filter(e => e.status === 'Waiting List').length,
    rejected: activeEnquiries.filter(e => e.status === 'Rejected' || e.status === 'Not Interested').length,
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
      <div className="crm-pipeline-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('All')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === 'All' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
            background: filterStatus === 'All' ? 'var(--primary-light)' : 'var(--card-bg)',
          }}
          title="Click to view All leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-main)' }}>{stats.total}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>TOTAL</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('New Lead')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === 'New Lead' ? '2px solid #0ea5e9' : '1px solid var(--border-color)',
            background: filterStatus === 'New Lead' ? '#f0f9ff' : 'var(--card-bg)',
          }}
          title="Click to view New Leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0ea5e9' }}>{stats.newLead}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>NEW LEAD</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('1 Session')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === '1 Session' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
            background: filterStatus === '1 Session' ? '#f5f3ff' : 'var(--card-bg)',
          }}
          title="Click to view 1 Session leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#8b5cf6' }}>{stats.sess1}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>1 SESSION</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('2 Session')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === '2 Session' ? '2px solid #ec4899' : '1px solid var(--border-color)',
            background: filterStatus === '2 Session' ? '#fdf2f8' : 'var(--card-bg)',
          }}
          title="Click to view 2 Session leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#ec4899' }}>{stats.sess2}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>2 SESSION</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Closing')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === 'Closing' ? '2px solid #10b981' : '1px solid var(--border-color)',
            background: filterStatus === 'Closing' ? '#f0fdf4' : 'var(--card-bg)',
          }}
          title="Click to view Closing leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>{stats.closing}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>CLOSING</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Waiting List')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === 'Waiting List' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            background: filterStatus === 'Waiting List' ? '#fffbeb' : 'var(--card-bg)',
          }}
          title="Click to view Waiting List leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f59e0b' }}>{stats.waiting}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>WAITING LIST</span>
        </div>

        <div
          className="dashboard-card"
          onClick={() => setFilterStatus('Rejected')}
          style={{
            padding: '12px 10px', textAlign: 'center', gap: '2px', cursor: 'pointer',
            border: filterStatus === 'Rejected' ? '2px solid #ef4444' : '1px solid var(--border-color)',
            background: filterStatus === 'Rejected' ? '#fef2f2' : 'var(--card-bg)',
          }}
          title="Click to view Rejected leads"
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#ef4444' }}>{stats.rejected}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>REJECTED</span>
        </div>
      </div>

      {/* Toolbar: Filters */}
      <div className="crm-toolbar" style={{ marginBottom: '20px' }}>
        <select
          className="crm-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          id="crm-filter-status"
          style={{ fontWeight: '700' }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Stages' : s}</option>
          ))}
        </select>

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

                    {/* Black Lead Name + Status Badge + Staff Badge next to it */}
                    <td>
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
                    </td>

                    {/* Phone + Call Button */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {enquiry.phone}
                        </span>
                        {enquiry.phone && (
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
                            setMenuPos({
                              top: rect.bottom + 4,
                              right: window.innerWidth - rect.right,
                              left: 'auto',
                            });
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
                            right: menuPos.right,
                            left: menuPos.left,
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
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
