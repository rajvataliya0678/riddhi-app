'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logCrmCall } from '@/lib/logCrmCall';
import { openWhatsAppChat } from '@/lib/whatsapp';
import CrmEnquiryModal from './CrmEnquiryModal';
import { Search, Clock, User, Phone, MessageCircle, FileText, CheckCircle2, PhoneCall, Calendar } from 'lucide-react';

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
  const [dateFilter, setDateFilter]       = useState('all');
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);
  const listContainerRef = useRef(null);
  const [editingLogKey, setEditingLogKey] = useState(null);
  const [editOutcome, setEditOutcome]     = useState('📞 Called');
  const [editCallType, setEditCallType]   = useState('Follow-up');
  const [editNotes, setEditNotes]         = useState('');
  const [savingLog, setSavingLog]         = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!coachUid) return;

    const crmRef = collection(db, 'crm_enquiries');
    // Always filter by coachId so every user sees only their own call history
    const q = query(crmRef, where('coachId', '==', coachUid));

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

  // Exact Date Calculations for 6 Categories
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  // 1. Today
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

  // 2. Yesterday
  const yest = new Date(now);
  yest.setDate(date - 1);
  const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;

  // 3. This Week (Monday 00:00 to now)
  const currentDayOfWeek = now.getDay();
  const distanceToMonday = (currentDayOfWeek + 6) % 7;
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(date - distanceToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  // 4. Last Week (Monday 00:00 of prev week to Sunday 23:59 of prev week)
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setMilliseconds(-1);

  // 5. This Month (1st 00:00 of current month to now)
  const startOfThisMonth = new Date(year, month, 1, 0, 0, 0, 0);

  // 6. Last Month (1st 00:00 of prev month to last day 23:59 of prev month)
  const startOfLastMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Count variables for 6 cards
  let todayCount = 0;
  let yesterdayCount = 0;
  let thisWeekCount = 0;
  let lastWeekCount = 0;
  let thisMonthCount = 0;
  let lastMonthCount = 0;

  allCallLogs.forEach(log => {
    if (!log.calledAt) return;
    const logDate = new Date(log.calledAt);
    const logDateStr = logDate.toISOString().split('T')[0];

    if (logDateStr === todayStr) todayCount++;
    if (logDateStr === yesterdayStr) yesterdayCount++;

    if (logDate >= startOfThisWeek && logDate <= now) thisWeekCount++;
    if (logDate >= startOfLastWeek && logDate <= endOfLastWeek) lastWeekCount++;

    if (logDate >= startOfThisMonth && logDate <= now) thisMonthCount++;
    if (logDate >= startOfLastMonth && logDate <= endOfLastMonth) lastMonthCount++;
  });

  // Filter call logs list
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
      const cleanOpt = outcomeFilter.replace('📞 ', '').replace('📅 ', '').replace('⏰ ', '').replace('❌ ', '').replace('🚫 ', '').toLowerCase();
      if (!out.toLowerCase().includes(cleanOpt)) {
        return false;
      }
    }

    // Date filter
    if (dateFilter !== 'all' && log.calledAt) {
      const logDate = new Date(log.calledAt);
      const logDateStr = logDate.toISOString().split('T')[0];

      if (dateFilter === 'today' && logDateStr !== todayStr) return false;
      if (dateFilter === 'yesterday' && logDateStr !== yesterdayStr) return false;
      if (dateFilter === 'this_week' && !(logDate >= startOfThisWeek && logDate <= now)) return false;
      if (dateFilter === 'last_week' && !(logDate >= startOfLastWeek && logDate <= endOfLastWeek)) return false;
      if (dateFilter === 'this_month' && !(logDate >= startOfThisMonth && logDate <= now)) return false;
      if (dateFilter === 'last_month' && !(logDate >= startOfLastMonth && logDate <= endOfLastMonth)) return false;
    }

    return true;
  });

  const handleLeadSaved = async (updatedData, leadId, keepOpen = false) => {
    if (leadId) {
      try {
        await updateDoc(doc(db, 'crm_enquiries', leadId), { ...updatedData, updatedAt: serverTimestamp() });
        if (!keepOpen) {
          setSelectedLeadModal(null);
        }
      } catch (err) {
        console.error('Error updating lead:', err);
        throw err;
      }
    }
  };

  const startEditingLog = (log) => {
    const key = log.id || `${log.leadId}-${log.logIndex}-${log.calledAt}`;
    setEditingLogKey(key);
    setEditOutcome(log.outcome || '📞 Called');
    setEditCallType(log.callType === 'Invitation' ? 'Invitation' : 'Follow-up');
    setEditNotes(log.notes || '');
  };

  const handleSaveEditedLog = async (logItem) => {
    if (!logItem?.leadId) return;
    setSavingLog(true);
    try {
      const enquiry = enquiries.find(e => e.id === logItem.leadId);
      if (!enquiry) {
        setSavingLog(false);
        return;
      }
      const currentLogs = enquiry.callLogs || [];
      const updatedLogs = currentLogs.map((l, idx) => {
        const isMatch = (logItem.id && l.id === logItem.id) ||
                        (logItem.calledAt && l.calledAt === logItem.calledAt) ||
                        (idx === logItem.logIndex);
        if (isMatch) {
          return {
            ...l,
            outcome: editOutcome,
            callType: editCallType,
            notes: (editNotes || '').trim(),
          };
        }
        return l;
      });

      await updateDoc(doc(db, 'crm_enquiries', logItem.leadId), {
        callLogs: updatedLogs,
        updatedAt: serverTimestamp(),
      });
      setEditingLogKey(null);
    } catch (err) {
      console.error('Error saving call log:', err);
      alert('Failed to save call log: ' + err.message);
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      
      {/* ── STICKY FROZEN CONTROLS (stat cards + search + filter) ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-main)',
        paddingTop: '16px',
        paddingBottom: '12px',
        paddingLeft: '32px',
        paddingRight: '32px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
      }}>

        {/* ── 6 CALL STAT COUNTER CARDS (compact) ─────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {[
            { id: 'today',      label: "Today's",   count: todayCount,     color: '#16a34a', selBg: '#f0fdf4', selBorder: '#16a34a' },
            { id: 'yesterday',  label: 'Yesterday', count: yesterdayCount, color: '#0284c7', selBg: '#f0f9ff', selBorder: '#0284c7' },
            { id: 'this_week',  label: 'This Week', count: thisWeekCount,  color: '#7e22ce', selBg: '#faf5ff', selBorder: '#7e22ce' },
            { id: 'last_week',  label: 'Last Week', count: lastWeekCount,  color: '#ea580c', selBg: '#fff7ed', selBorder: '#ea580c' },
            { id: 'this_month', label: 'This Month',count: thisMonthCount, color: '#2563eb', selBg: '#eff6ff', selBorder: '#2563eb' },
            { id: 'last_month', label: 'Last Month',count: lastMonthCount, color: '#475569', selBg: '#f8fafc', selBorder: '#475569' },
          ].map(card => (
            <div
              key={card.id}
              className="dashboard-card"
              onClick={() => setDateFilter(dateFilter === card.id ? 'all' : card.id)}
              style={{
                padding: '8px 10px', gap: '2px', cursor: 'pointer', flexDirection: 'column',
                border: dateFilter === card.id ? `2px solid ${card.selBorder}` : '1px solid var(--border-color)',
                background: dateFilter === card.id ? card.selBg : 'var(--card-bg)',
                transition: 'all 0.15s ease', textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '0.58rem', fontWeight: '800', textTransform: 'uppercase', color: card.color, margin: 0, letterSpacing: '0.03em', lineHeight: 1 }}>
                {card.label}
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: '900', color: card.color, margin: 0, lineHeight: 1 }}>
                {card.count}
              </p>
            </div>
          ))}
        </div>

        {/* ── SEARCH & FILTER ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search name, phone, notes or staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '6px 12px 6px 32px', height: '38px', fontSize: '0.82rem' }}
            />
          </div>
          <select
            className="form-input"
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value)}
            style={{
              height: '38px',
              width: 'auto',
              fontSize: '0.82rem',
              fontWeight: '700',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            {OUTCOME_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt === 'All' ? '👥 All Outcomes' : opt}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yest.' },
              { id: 'this_week', label: 'This Wk' },
              { id: 'last_week', label: 'Last Wk' },
              { id: 'this_month', label: 'This Mo' },
              { id: 'last_month', label: 'Last Mo' },
            ].map(d => (
              <button key={d.id} type="button" onClick={() => setDateFilter(d.id)} style={{
                padding: '4px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '800',
                border: 'none', cursor: 'pointer',
                background: dateFilter === d.id ? 'var(--primary)' : 'transparent',
                color: dateFilter === d.id ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CALL LOGS TIMELINE LIST (scrollable) ─────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 32px 32px 32px' }}>
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
          <div ref={listContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowAnchor: 'auto' }}>
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

              const uniqueLogKey = log.id || `${log.leadId}-${log.logIndex}-${log.calledAt}`;
              const isEditingThis = editingLogKey === uniqueLogKey;

              return (
                <div
                  key={log.id || `${log.leadId}-${idx}`}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Row 1: Prospect Profile & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
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
                            style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', cursor: 'pointer' }}
                            title="Click to view full lead details"
                          >
                            {log.leadName}
                          </h4>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            Stage: {log.leadStatus}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          📱 {log.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                          padding: '5px 12px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: '800',
                          background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', cursor: 'pointer'
                        }}
                      >
                        📋 Lead Details
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Form OR Badges + Notes */}
                  {isEditingThis ? (
                    <div style={{
                      background: '#f8fafc',
                      border: '2px solid #3b82f6',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#1e40af', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          ✏️ Edit Call Log Entry
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          🕒 {formattedDate}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Call Outcome (પરિણામ):
                          </label>
                          <select
                            className="form-input"
                            value={editOutcome}
                            onChange={e => setEditOutcome(e.target.value)}
                            style={{ height: '38px', padding: '6px 12px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                          >
                            {OUTCOME_OPTIONS.filter(o => o !== 'All').map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Call Type (પ્રકાર):
                          </label>
                          <select
                            className="form-input"
                            value={editCallType}
                            onChange={e => setEditCallType(e.target.value)}
                            style={{ height: '38px', padding: '6px 12px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                          >
                            <option value="Invitation">📩 Invitation Call</option>
                            <option value="Follow-up">📞 Follow-up Call</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Discussion Notes (નોંધ):
                        </label>
                        <textarea
                          className="form-input"
                          rows={2}
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          placeholder="Enter discussion notes or remarks..."
                          style={{ fontSize: '0.84rem', padding: '8px 12px', resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                        <button
                          type="button"
                          disabled={savingLog}
                          onClick={() => setEditingLogKey(null)}
                          style={{
                            padding: '6px 14px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: '700',
                            background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingLog}
                          onClick={() => handleSaveEditedLog(log)}
                          style={{
                            padding: '6px 18px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: '800',
                            background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff',
                            border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                            boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                          }}
                        >
                          {savingLog ? '⏳ Saving...' : '💾 Save Log'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Row 2: Badges Bar */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
                        background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px',
                        fontSize: '0.76rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ color: '#2563eb', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <User size={13} /> Called By: {callerNameStr}
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditingLog(log)}
                            style={{
                              padding: '3px 9px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: '800',
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Edit this call log"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </div>

                      {/* Row 3: Discussion Notes */}
                      {log.notes ? (
                        <div style={{
                          fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '600',
                          background: '#fffbeb', padding: '8px 12px', borderRadius: '8px',
                          border: '1px solid #fde68a', wordBreak: 'break-word', lineHeight: '1.4'
                        }}>
                          📝 <strong>Discussion Notes:</strong> {log.notes}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                          (No discussion notes recorded for this call)
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Lead Details Modal */}
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
