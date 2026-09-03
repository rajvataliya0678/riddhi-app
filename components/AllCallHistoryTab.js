'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logCrmCall } from '@/lib/logCrmCall';
import { openWhatsAppChat } from '@/lib/whatsapp';
import CrmEnquiryModal from './CrmEnquiryModal';
import { Phone, PhoneCall, PhoneIncoming, MessageCircle, Search, Calendar, User, Clock, Filter, CheckCircle2, AlertCircle } from 'lucide-react';

const OUTCOME_OPTIONS = [
  'All',
  '📞 Called',
  '📞 Answered & Interested',
  '📅 Follow-up Scheduled',
  '⏰ Call Back Later',
  '❌ No Answer / Busy',
  '🚫 Not Interested',
];

export default function AllCallHistoryTab({ coachUid, coachName = '', userRole = 'coach' }) {
  const [enquiries, setEnquiries]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [dateFilter, setDateFilter]       = useState('all'); // 'all', 'today', 'yesterday', 'week'
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!coachUid) return;

    const crmRef = collection(db, 'crm_enquiries');
    const q = isAdmin ? crmRef : query(crmRef, where('coachId', '==', coachUid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEnquiries(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error listening to CRM for call logs:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coachUid, isAdmin]);

  // Combine ALL call logs across all leads into a single time-wise array
  const allCallLogs = [];
  enquiries.forEach(e => {
    const logs = e.callLogs || [];
    logs.forEach((log, idx) => {
      allCallLogs.push({
        ...log,
        logIndex: idx,
        leadId: e.id,
        leadName: e.name || 'Unknown Prospect',
        phone: e.phone || '',
        leadStatus: e.status || 'New Lead',
        leadStaffName: e.staffName || e.coachName || coachName,
        leadObj: e,
        sortTime: log.calledAt ? new Date(log.calledAt).getTime() : 0,
      });
    });
  });

  // Sort newest first (like mobile phone call history!)
  allCallLogs.sort((a, b) => b.sortTime - a.sortTime);

  // Filter call logs
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const filteredLogs = allCallLogs.filter(log => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = log.leadName.toLowerCase().includes(q);
      const matchPhone = log.phone.includes(q);
      const matchStaff = (log.callerName || log.leadStaffName || '').toLowerCase().includes(q);
      const matchNotes = (log.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchStaff && !matchNotes) return false;
    }

    // Outcome filter
    if (outcomeFilter !== 'All') {
      const out = log.outcome || '📞 Called';
      if (!out.toLowerCase().includes(outcomeFilter.replace('📞 ', '').replace('📅 ', '').replace('⏰ ', '').replace('❌ ', '').replace('🚫 ', '').toLowerCase())) {
        return false;
      }
    }

    // Date filter
    if (dateFilter !== 'all' && log.calledAt) {
      const logDateStr = new Date(log.calledAt).toISOString().split('T')[0];
      if (dateFilter === 'today' && logDateStr !== todayStr) return false;
      if (dateFilter === 'yesterday' && logDateStr !== yesterdayStr) return false;
      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (new Date(log.calledAt) < weekAgo) return false;
      }
    }

    return true;
  });

  const todayCount = allCallLogs.filter(l => l.calledAt && new Date(l.calledAt).toISOString().split('T')[0] === todayStr).length;

  const handleLeadSaved = async (updatedData, leadId) => {
    if (leadId) {
      try {
        await updateDoc(doc(db, 'crm_enquiries', leadId), { ...updatedData, updatedAt: serverTimestamp() });
      } catch (err) {
        console.error('Error updating lead:', err);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ── HEADER BANNER ────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '16px',
        padding: '20px 24px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
          }}>
            📞
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff' }}>
              Combined Call History Log (કોલ હિસ્ટ્રી ટાઈમલાઈન)
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Mobile-style combined call logs timeline across all prospects & leads (Newest calls first)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '10px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', fontWeight: '600' }}>TOTAL LOGS</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#38bdf8' }}>{allCallLogs.length}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '10px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', fontWeight: '600' }}>TODAY'S CALLS</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#4ade80' }}>{todayCount}</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ─────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '14px',
        padding: '14px 18px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by prospect name, phone, notes, or staff..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.84rem' }}
          />
        </div>

        {/* Outcome Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value)}
            style={{ height: '40px', width: 'auto', fontSize: '0.82rem', fontWeight: '700' }}
          >
            {OUTCOME_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt === 'All' ? '👥 All Outcomes' : opt}</option>
            ))}
          </select>

          {/* Date Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: '7 Days' },
            ].map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateFilter(d.id)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '800',
                  border: 'none', cursor: 'pointer',
                  background: dateFilter === d.id ? 'var(--primary)' : 'transparent',
                  color: dateFilter === d.id ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CALL LOGS TIMELINE LIST (MOBILE DIALER STYLE) ────────── */}
      <div className="dashboard-card" style={{ padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            ⏳ Loading call history timeline...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <span className="empty-state-icon" style={{ fontSize: '2.6rem' }}>📞</span>
            <h4 style={{ fontSize: '1rem', margin: '8px 0 4px', fontWeight: '800' }}>No call history logs found</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {searchQuery || outcomeFilter !== 'All' || dateFilter !== 'all'
                ? 'Try clearing your filters or search term to see more calls.'
                : 'Click "📞 Call" next to any prospect in CRM to place calls and record call logs.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredLogs.map((log, idx) => {
              const formattedDate = log.calledAt
                ? new Date(log.calledAt).toLocaleString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                  })
                : '—';

              const outcomeText = log.outcome || '📞 Called';
              const callerNameStr = log.callerName || log.leadStaffName || 'Staff';

              let badgeStyle = { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
              if (outcomeText.includes('Answered') || outcomeText.includes('Interested')) {
                badgeStyle = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
              } else if (outcomeText.includes('Follow-up') || outcomeText.includes('Scheduled')) {
                badgeStyle = { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
              } else if (outcomeText.includes('No Answer') || outcomeText.includes('Busy')) {
                badgeStyle = { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' };
              } else if (outcomeText.includes('Later') || outcomeText.includes('Back')) {
                badgeStyle = { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
              } else if (outcomeText.includes('Not Interested')) {
                badgeStyle = { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' };
              }

              return (
                <div
                  key={log.id || `${log.leadId}-${idx}`}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Top Line: Avatar + Lead Name & Phone + Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#fff', fontWeight: '800', fontSize: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {log.leadName ? log.leadName.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4
                            onClick={() => setSelectedLeadModal(log.leadObj)}
                            style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)', cursor: 'pointer' }}
                            title="Click to view full lead details"
                          >
                            {log.leadName}
                          </h4>
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            Stage: {log.leadStatus}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          📱 {log.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Call & WhatsApp Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {log.phone && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              window.location.href = `tel:${log.phone}`;
                              await logCrmCall(db, log.leadId, log.leadObj, coachName);
                            }}
                            style={{
                              padding: '5px 12px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: '800',
                              background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            📞 Call
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsAppChat(log.phone)}
                            style={{
                              padding: '5px 12px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: '800',
                              background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            💬 Chat
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedLeadModal(log.leadObj)}
                        style={{
                          padding: '5px 10px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: '800',
                          background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', cursor: 'pointer'
                        }}
                      >
                        📋 Lead Details
                      </button>
                    </div>
                  </div>

                  {/* Middle Line: Outcome Badge + Call Type + Date & Time + Caller Staff */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px',
                    fontSize: '0.76rem'
                  }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900',
                      background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}`
                    }}>
                      {outcomeText}
                    </span>

                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800',
                      background: log.callType === 'Invitation' ? '#f0fdf4' : '#faf5ff',
                      color: log.callType === 'Invitation' ? '#16a34a' : '#7e22ce',
                      border: log.callType === 'Invitation' ? '1px solid #bbf7d0' : '1px solid #e9d5ff'
                    }}>
                      {log.callType === 'Invitation' ? '📩 Invitation Call' : '📞 Follow-up Call'}
                    </span>

                    <span style={{ color: 'var(--text-muted)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> {formattedDate}
                    </span>

                    <span style={{ color: '#2563eb', fontWeight: '800', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} /> Called By: {callerNameStr}
                    </span>
                  </div>

                  {/* Bottom Line: Discussion Notes */}
                  {log.notes ? (
                    <div style={{
                      fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '600',
                      background: '#fffbeb', padding: '8px 12px', borderRadius: '8px',
                      border: '1px solid #fde68a', wordBreak: 'break-word', lineHeight: '1.4'
                    }}>
                      📝 <strong>Discussion Notes:</strong> {log.notes}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.73rem', color: '#9ca3af', fontStyle: 'italic' }}>
                      (No discussion notes recorded for this call)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Lead Modal */}
      {selectedLeadModal && (
        <CrmEnquiryModal
          enquiry={selectedLeadModal}
          onSave={handleLeadSaved}
          onClose={() => setSelectedLeadModal(null)}
          coaches={[]}
          userRole={userRole}
          autoCallLogFocus={false}
        />
      )}
    </div>
  );
}
