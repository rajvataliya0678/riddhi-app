'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logCrmCall } from '@/lib/logCrmCall';
import { openWhatsAppChat } from '@/lib/whatsapp';
import CrmEnquiryModal from './CrmEnquiryModal';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { Search, Clock, User, Phone, MessageCircle, FileText, CheckCircle2, PhoneCall, Calendar, X } from 'lucide-react';

const OUTCOME_OPTIONS = [
  'All',
  '📞 Called',
  '📞 Answered & Interested',
  '📅 Session 1 Scheduled',
  '📅 Session 2 Scheduled',
  '⏰ Call Back Later',
  '❌ No Answer / Busy',
  '🚫 Not Interested',
];

export default function AllCallHistoryTab({ coachUid, coachName = '', userRole = 'coach', clubId = 'main' }) {
  const [enquiries, setEnquiries]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [dateFilter, setDateFilter]       = useState('all');
  const [customDate, setCustomDate]       = useState('');
  const [selectedLeadModal, setSelectedLeadModal] = useState(null);
  const listContainerRef = useRef(null);
  const datePickerRef    = useRef(null);
  const loadMoreRef      = useRef(null);

  const [editingLogKey, setEditingLogKey] = useState(null);
  const [editOutcome, setEditOutcome]     = useState('📞 Called');
  const [editCallType, setEditCallType]   = useState('Follow-up');
  const [editNotes, setEditNotes]         = useState('');
  const [savingLog, setSavingLog]         = useState(false);

  // Progressive infinite scroll limit (prevents mobile DOM lock)
  const [visibleCount, setVisibleCount]   = useState(30);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!coachUid) return;

    const crmRef = collection(db, 'crm_enquiries');
    // Always filter by coachId so every user sees only their own call history
    const q = query(crmRef, where('coachId', '==', coachUid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (e.clubId || 'main') === clubId);
      setEnquiries(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error listening to CRM for call logs:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coachUid, isAdmin, clubId]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, outcomeFilter, dateFilter, customDate]);

  // Combine ALL call logs across all leads into a single time-wise array (Memoized)
  const allCallLogs = useMemo(() => {
    const logs = [];
    enquiries.forEach(e => {
      const eLogs = e.callLogs || [];
      eLogs.forEach((log, idx) => {
        let sortTime = 0;
        if (log.calledAt) {
          const t = new Date(log.calledAt).getTime();
          if (!isNaN(t)) sortTime = t;
        }
        logs.push({
          ...log,
          logIndex: idx,
          leadId: e.id,
          leadName: e.name || 'Unknown Prospect',
          phone: e.phone || '',
          leadStatus: e.status || 'New Lead',
          leadStaffName: e.staffName || e.coachName || coachName,
          leadObj: e,
          sortTime,
        });
      });
    });
    logs.sort((a, b) => b.sortTime - a.sortTime);
    return logs;
  }, [enquiries, coachName]);

  // Exact Date Calculations for 6 Categories (Memoized)
  const statCounts = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

    const yest = new Date(now);
    yest.setDate(date - 1);
    const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;

    const currentDayOfWeek = now.getDay();
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(date - distanceToMonday);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setMilliseconds(-1);

    const startOfThisMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const startOfLastMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfLastMonth = new Date(year, month, 0, 23, 59, 59, 999);

    let todayCount = 0;
    let yesterdayCount = 0;
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    let thisMonthCount = 0;
    let lastMonthCount = 0;

    allCallLogs.forEach(log => {
      if (!log.calledAt) return;
      const logDate = new Date(log.calledAt);
      if (isNaN(logDate.getTime())) return;
      const logYear = logDate.getFullYear();
      const logMonth = String(logDate.getMonth() + 1).padStart(2, '0');
      const logDay = String(logDate.getDate()).padStart(2, '0');
      const logDateStr = `${logYear}-${logMonth}-${logDay}`;

      if (logDateStr === todayStr) todayCount++;
      if (logDateStr === yesterdayStr) yesterdayCount++;

      if (logDate >= startOfThisWeek && logDate <= now) thisWeekCount++;
      if (logDate >= startOfLastWeek && logDate <= endOfLastWeek) lastWeekCount++;

      if (logDate >= startOfThisMonth && logDate <= now) thisMonthCount++;
      if (logDate >= startOfLastMonth && logDate <= endOfLastMonth) lastMonthCount++;
    });

    return {
      todayStr,
      yesterdayStr,
      startOfThisWeek,
      startOfLastWeek,
      endOfLastWeek,
      startOfThisMonth,
      startOfLastMonth,
      endOfLastMonth,
      now,
      todayCount,
      yesterdayCount,
      thisWeekCount,
      lastWeekCount,
      thisMonthCount,
      lastMonthCount,
    };
  }, [allCallLogs]);

  // Filter call logs list (Memoized)
  const filteredLogs = useMemo(() => {
    const {
      todayStr,
      yesterdayStr,
      startOfThisWeek,
      startOfLastWeek,
      endOfLastWeek,
      startOfThisMonth,
      startOfLastMonth,
      endOfLastMonth,
      now,
    } = statCounts;

    return allCallLogs.filter(log => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (log.leadName || '').toLowerCase().includes(q);
        const matchPhone = (log.phone || '').includes(q);
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
        if (isNaN(logDate.getTime())) return false;
        const logYear = logDate.getFullYear();
        const logMonth = String(logDate.getMonth() + 1).padStart(2, '0');
        const logDay = String(logDate.getDate()).padStart(2, '0');
        const logDateStr = `${logYear}-${logMonth}-${logDay}`;

        if (dateFilter === 'custom') {
          if (logDateStr !== customDate) return false;
        } else {
          if (dateFilter === 'today' && logDateStr !== todayStr) return false;
          if (dateFilter === 'yesterday' && logDateStr !== yesterdayStr) return false;
          if (dateFilter === 'this_week' && !(logDate >= startOfThisWeek && logDate <= now)) return false;
          if (dateFilter === 'last_week' && !(logDate >= startOfLastWeek && logDate <= endOfLastWeek)) return false;
          if (dateFilter === 'this_month' && !(logDate >= startOfThisMonth && logDate <= now)) return false;
          if (dateFilter === 'last_month' && !(logDate >= startOfLastMonth && logDate <= endOfLastMonth)) return false;
        }
      }

      return true;
    });
  }, [allCallLogs, statCounts, searchQuery, outcomeFilter, dateFilter, customDate]);

  // Progressive slice for 60fps rendering & instant scrolling
  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Auto load more when scrolling near bottom
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 30, filteredLogs.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredLogs.length, visibleCount]);

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

  const {
    todayCount,
    yesterdayCount,
    thisWeekCount,
    lastWeekCount,
    thisMonthCount,
    lastMonthCount,
  } = statCounts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      
      {/* ── CONTROLS HEADER (stat cards + search + filter) ── */}
      <div style={{
        background: 'var(--bg-main)',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>

        {/* ── 6 CALL STAT COUNTER CARDS (compact & responsive) ─────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px' }}>
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
              <button key={d.id} type="button" onClick={() => { setDateFilter(d.id); setCustomDate(''); }} style={{
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

          {/* Calendar / Custom Date Picker formatted in DD-MM-YYYY */}
          <div
            onClick={() => {
              try {
                datePickerRef.current?.showPicker?.();
              } catch (e) {
                datePickerRef.current?.focus?.();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: dateFilter === 'custom' && customDate ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
              border: dateFilter === 'custom' && customDate ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
              borderRadius: '7px',
              padding: '4px 10px',
              height: '38px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s ease',
              userSelect: 'none',
            }}
            title="Pick a specific date (DD-MM-YYYY)"
          >
            <Calendar size={15} style={{ color: dateFilter === 'custom' && customDate ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: '800',
                color: dateFilter === 'custom' && customDate ? 'var(--primary)' : 'var(--text-muted)',
                letterSpacing: '0.3px',
              }}
            >
              {customDate ? formatDate(customDate) : 'DD-MM-YYYY'}
            </span>

            {/* Hidden native date input that triggers OS date picker */}
            <input
              ref={datePickerRef}
              type="date"
              value={customDate}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDate(val);
                if (val) {
                  setDateFilter('custom');
                } else {
                  setDateFilter('all');
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              tabIndex={-1}
            />

            {customDate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomDate('');
                  setDateFilter('all');
                }}
                title="Clear date filter"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '50%',
                  zIndex: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CALL LOGS TIMELINE LIST ─────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
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
          <div ref={listContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visibleLogs.map((log, idx) => {
              const formattedDate = formatDateTime(log.calledAt);

              const outcomeText = log.outcome || '📞 Called';
              const callerNameStr = log.callerName || log.leadStaffName || 'Staff';

              let badgeStyle = { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
              if (outcomeText.includes('Not Interested')) {
                badgeStyle = { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' };
              } else if (outcomeText.includes('Answered') || outcomeText.includes('Interested')) {
                badgeStyle = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
              } else if (outcomeText.includes('Session 1') || outcomeText.includes('Follow-up') || outcomeText.includes('Scheduled')) {
                badgeStyle = { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' };
              } else if (outcomeText.includes('Session 2')) {
                badgeStyle = { bg: '#fce7f3', color: '#9d174d', border: '#f472b6' };
              } else if (outcomeText.includes('No Answer') || outcomeText.includes('Busy')) {
                badgeStyle = { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' };
              } else if (outcomeText.includes('Later') || outcomeText.includes('Back')) {
                badgeStyle = { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
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
                      <div
                        onClick={() => setSelectedLeadModal(log.leadObj)}
                        title="Click to view lead details"
                        style={{
                          width: '42px', height: '42px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                          color: '#fff', fontWeight: '800', fontSize: '1rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      >
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

            {/* Progressive Infinite Scroll Sentinel & Load More button */}
            {visibleCount < filteredLogs.length && (
              <div ref={loadMoreRef} style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => Math.min(prev + 30, filteredLogs.length))}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                  }}
                >
                  👇 Load More Calls ({filteredLogs.length - visibleCount} more)
                </button>
              </div>
            )}
            {filteredLogs.length > 30 && visibleCount >= filteredLogs.length && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: '700' }}>
                ✓ All {filteredLogs.length} call logs loaded
              </div>
            )}
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
