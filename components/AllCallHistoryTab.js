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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
      
      {/* ── 6 CALL STAT COUNTER CARDS ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {/* Today */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'today' ? 'all' : 'today')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'today' ? '2px solid #16a34a' : '1px solid var(--border-color)',
            background: dateFilter === 'today' ? '#f0fdf4' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter Today's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#16a34a', letterSpacing: '0.04em' }}>
              🟢 Today's Calls
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>આજના</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#16a34a', margin: 0, lineHeight: 1 }}>
            {todayCount}
          </p>
        </div>

        {/* Yesterday */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'yesterday' ? 'all' : 'yesterday')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'yesterday' ? '2px solid #0284c7' : '1px solid var(--border-color)',
            background: dateFilter === 'yesterday' ? '#f0f9ff' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter Yesterday's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.04em' }}>
              🔵 Yesterday
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ગઈકાલના</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0284c7', margin: 0, lineHeight: 1 }}>
            {yesterdayCount}
          </p>
        </div>

        {/* This Week */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'this_week' ? 'all' : 'this_week')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'this_week' ? '2px solid #7e22ce' : '1px solid var(--border-color)',
            background: dateFilter === 'this_week' ? '#faf5ff' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter This Week's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#7e22ce', letterSpacing: '0.04em' }}>
              🟣 This Week
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>આ અઠવાડિયું</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#7e22ce', margin: 0, lineHeight: 1 }}>
            {thisWeekCount}
          </p>
        </div>

        {/* Last Week */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'last_week' ? 'all' : 'last_week')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'last_week' ? '2px solid #ea580c' : '1px solid var(--border-color)',
            background: dateFilter === 'last_week' ? '#fff7ed' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter Last Week's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#ea580c', letterSpacing: '0.04em' }}>
              🟠 Last Week
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ગયું અઠવાડિયું</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#ea580c', margin: 0, lineHeight: 1 }}>
            {lastWeekCount}
          </p>
        </div>

        {/* This Month */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'this_month' ? 'all' : 'this_month')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'this_month' ? '2px solid #2563eb' : '1px solid var(--border-color)',
            background: dateFilter === 'this_month' ? '#eff6ff' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter This Month's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#2563eb', letterSpacing: '0.04em' }}>
              📅 This Month
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>આ મહિનો</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#2563eb', margin: 0, lineHeight: 1 }}>
            {thisMonthCount}
          </p>
        </div>

        {/* Last Month */}
        <div
          className="dashboard-card"
          onClick={() => setDateFilter(dateFilter === 'last_month' ? 'all' : 'last_month')}
          style={{
            padding: '14px 16px', gap: '6px', cursor: 'pointer',
            border: dateFilter === 'last_month' ? '2px solid #475569' : '1px solid var(--border-color)',
            background: dateFilter === 'last_month' ? '#f8fafc' : 'var(--card-bg)',
            transition: 'all 0.15s ease'
          }}
          title="Click to filter Last Month's calls"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
              🗓️ Last Month
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ગયો મહિનો</span>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#475569', margin: 0, lineHeight: 1 }}>
            {lastMonthCount}
          </p>
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
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search prospect name, phone, notes, or staff..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.84rem' }}
          />
        </div>

        {/* Outcome Filter Dropdown */}
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
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: "Today's" },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
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

      {/* ── CALL LOGS TIMELINE LIST ──────────────────────────────── */}
      <div className="dashboard-card" style={{ padding: '16px' }}>
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

                    <div style={{ color: '#2563eb', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} /> Called By: {callerNameStr}
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
