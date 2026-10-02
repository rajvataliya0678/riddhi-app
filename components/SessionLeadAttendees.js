'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logCrmCall } from '@/lib/logCrmCall';
import CrmEnquiryModal from './CrmEnquiryModal';
import { openWhatsAppChat } from '@/lib/whatsapp';

// Quick Reschedule / Schedule Next Meeting Modal Component
function QuickRescheduleModal({ lead, onClose, onSaved, viewingDate, viewingSession }) {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [meetingDate, setMeetingDate] = useState(tomorrowStr);
  const [meetingSession, setMeetingSession] = useState('evening');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'crm_enquiries', lead.id);

      // Preserve existing scheduledSessions
      const existingSessions = Array.isArray(lead.scheduledSessions) ? [...lead.scheduledSessions] : [];

      // Ensure previous nextMeetingDate is kept in history
      if (lead.nextMeetingDate) {
        const oldSession = lead.nextMeetingSession || 'morning';
        if (!existingSessions.some(s => (typeof s === 'object' ? s.date === lead.nextMeetingDate && (s.session || 'morning') === oldSession : s === lead.nextMeetingDate))) {
          existingSessions.push({ date: lead.nextMeetingDate, session: oldSession, addedAt: new Date().toISOString() });
        }
      }

      // Ensure the session being viewed when rescheduled is kept in history
      const curDate = viewingDate || lead.currentSessionDate;
      const curSess = viewingSession || lead.currentSessionType || 'morning';
      if (curDate) {
        if (!existingSessions.some(s => (typeof s === 'object' ? s.date === curDate && (s.session || 'morning') === curSess : s === curDate))) {
          existingSessions.push({ date: curDate, session: curSess, addedAt: new Date().toISOString() });
        }
      }

      // Add the new target meeting date/session
      if (!existingSessions.some(s => (typeof s === 'object' ? s.date === meetingDate && (s.session || 'morning') === meetingSession : s === meetingDate))) {
        existingSessions.push({ date: meetingDate, session: meetingSession, addedAt: new Date().toISOString() });
      }

      await updateDoc(docRef, {
        nextMeetingDate: meetingDate,
        nextMeetingSession: meetingSession,
        scheduledSessions: existingSessions,
        updatedAt: serverTimestamp(),
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error rescheduling lead:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '420px', width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
              📅 {lead.modalTitle || 'Schedule Next Session'}: {lead.name}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Set date & session time for the prospect's next live meeting
            </p>
          </div>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Next Meeting Date *</label>
            <input
              type="date"
              className="form-input"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Session Time *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMeetingSession('morning')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                  border: meetingSession === 'morning' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                  background: meetingSession === 'morning' ? '#e0f2fe' : 'white',
                  color: meetingSession === 'morning' ? '#0369a1' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                🌅 Morning (11:00 AM)
              </button>
              <button
                type="button"
                onClick={() => setMeetingSession('evening')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                  border: meetingSession === 'evening' ? '2px solid #7e22ce' : '1px solid var(--border-color)',
                  background: meetingSession === 'evening' ? '#faf5ff' : 'white',
                  color: meetingSession === 'evening' ? '#6b21a8' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                🌇 Evening (07:45 PM)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Skip</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
              {saving ? '⏳ Saving...' : '💾 Schedule & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Checks if a lead was scheduled or attended for a specific date & session.
 * Ensures the prospect is NEVER removed from historical session view.
 */
export function isLeadInSession(l, dateStr, sessionType = 'morning') {
  if (!l || !dateStr) return false;
  const targetSession = sessionType || 'morning';

  // 1. Current nextMeetingDate match
  if (l.nextMeetingDate === dateStr) {
    const s = l.nextMeetingSession || 'morning';
    if (s === targetSession) return true;
  }

  // 2. Scheduled sessions list match
  if (Array.isArray(l.scheduledSessions)) {
    const matched = l.scheduledSessions.some(entry => {
      if (typeof entry === 'string') {
        if (entry === `${dateStr}_${targetSession}`) return true;
        if (entry === dateStr && targetSession === 'morning') return true;
        return false;
      }
      if (entry && typeof entry === 'object') {
        const entrySession = entry.session || 'morning';
        return entry.date === dateStr && entrySession === targetSession;
      }
      return false;
    });
    if (matched) return true;
  }

  // 3. Attended sessions list match
  if (Array.isArray(l.attendedSessions)) {
    const matched = l.attendedSessions.some(entry => {
      if (typeof entry === 'string') {
        if (entry === `${dateStr}_${targetSession}`) return true;
        if (entry === dateStr && targetSession === 'morning') return true;
        return false;
      }
      if (entry && typeof entry === 'object') {
        const entrySession = entry.session || 'morning';
        return entry.date === dateStr && entrySession === targetSession;
      }
      return false;
    });
    if (matched) return true;
  }

  // 4. Backward-compatible lastAttendedDate match
  if (l.lastAttendedDate === dateStr) {
    const attSession = l.lastAttendedSession || l.nextMeetingSession || 'morning';
    if (attSession === targetSession) return true;
  }

  return false;
}

export default function SessionLeadAttendees({ coachUid, userRole = 'coach', clubId = 'main' }) {
  const [leads, setLeads]               = useState([]);
  const [loading, setLoading]           = useState(true);

  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const currentHour = new Date().getHours();
  const defaultSession = currentHour >= 14 ? 'evening' : 'morning';
  const [activeSession, setActiveSession] = useState(defaultSession);

  // Modals
  const [selectedLeadForEdit, setSelectedLeadForEdit]   = useState(null);
  const [selectedLeadForReschedule, setSelectedLeadForReschedule] = useState(null);

  // Real-time listener for live updates — strictly restricted to the coach's own leads
  useEffect(() => {
    if (!coachUid) {
      setLeads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const crmRef = collection(db, 'crm_enquiries');
    const q = query(crmRef, where('coachId', '==', coachUid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeads(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to session leads:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coachUid]);

  const fetchLeads = async () => {
    // onSnapshot listener keeps leads updated in real time
  };

  const handleDateOffset = (offsetDays) => {
    const parts = selectedDate.split('-');
    const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    cur.setDate(cur.getDate() + offsetDays);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const formatDisplayDate = (dStr) => {
    if (dStr === todayStr) return "Today's";
    if (dStr === yesterdayStr) return "Yesterday's";
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  // Zero-loss list: prospects scheduled or attended for a session are NEVER removed, strictly for this coach
  const myLeads = leads.filter(l => l.coachId === coachUid && (l.clubId || 'main') === clubId);
  const morningLeads = myLeads.filter(l => isLeadInSession(l, selectedDate, 'morning'));
  const eveningLeads = myLeads.filter(l => isLeadInSession(l, selectedDate, 'evening'));

  const currentList = activeSession === 'morning' ? morningLeads : eveningLeads;

  const handleMarkAttended = async (lead) => {
    let nextStatus = '1 Session';
    let modalTitle = 'Schedule 2nd Live Meeting';

    if (lead.status === '1 Session') {
      nextStatus = '2 Session';
      modalTitle = 'Schedule Next / Closing Session';
    } else if (lead.status === '2 Session') {
      nextStatus = 'Closing';
      modalTitle = 'Schedule Closing Follow-up';
    } else if (lead.status === 'Closing') {
      nextStatus = 'Converted / Active Customer';
    }

    try {
      const docRef = doc(db, 'crm_enquiries', lead.id);
      const newHistory = [
        ...(lead.statusHistory || []),
        { from: lead.status || 'New Lead', to: nextStatus, timestamp: new Date().toISOString() }
      ];

      // Record this attendance in attendedSessions and scheduledSessions
      const existingAttended = Array.isArray(lead.attendedSessions) ? [...lead.attendedSessions] : [];
      if (!existingAttended.some(s => (typeof s === 'object' ? s.date === selectedDate && (s.session || 'morning') === activeSession : s === `${selectedDate}_${activeSession}`))) {
        existingAttended.push({ date: selectedDate, session: activeSession, attendedAt: new Date().toISOString() });
      }

      const existingScheduled = Array.isArray(lead.scheduledSessions) ? [...lead.scheduledSessions] : [];
      if (!existingScheduled.some(s => (typeof s === 'object' ? s.date === selectedDate && (s.session || 'morning') === activeSession : s === selectedDate))) {
        existingScheduled.push({ date: selectedDate, session: activeSession, addedAt: new Date().toISOString() });
      }

      await updateDoc(docRef, {
        status: nextStatus,
        lastAttendedDate: selectedDate,
        lastAttendedSession: activeSession,
        attendedSessions: existingAttended,
        scheduledSessions: existingScheduled,
        statusHistory: newHistory,
        updatedAt: serverTimestamp(),
      });

      // Open schedule modal for next meeting while retaining current session context
      setSelectedLeadForReschedule({
        ...lead,
        status: nextStatus,
        modalTitle,
        currentSessionDate: selectedDate,
        currentSessionType: activeSession,
        scheduledSessions: existingScheduled,
        attendedSessions: existingAttended,
      });
    } catch (err) {
      console.error('Error updating lead stage on attended:', err);
    }
  };

  const handleCrmSave = async (updatedData, leadId) => {
    if (leadId) {
      const docRef = doc(db, 'crm_enquiries', leadId);
      const leadDoc = leads.find(l => l.id === leadId);
      const updatePayload = { ...updatedData, updatedAt: serverTimestamp() };

      // Ensure scheduledSessions preserves selectedDate & activeSession and any existing sessions
      const existingSessions = Array.isArray(updatedData.scheduledSessions) 
        ? [...updatedData.scheduledSessions] 
        : Array.isArray(leadDoc?.scheduledSessions) 
          ? [...leadDoc.scheduledSessions] 
          : [];

      // Ensure current viewing date/session is kept
      if (selectedDate) {
        if (!existingSessions.some(s => (typeof s === 'object' ? s.date === selectedDate && (s.session || 'morning') === activeSession : s === selectedDate))) {
          existingSessions.push({ date: selectedDate, session: activeSession, addedAt: new Date().toISOString() });
        }
      }

      // If new nextMeetingDate is specified in updatedData, add it too
      if (updatedData.nextMeetingDate) {
        const nextSess = updatedData.nextMeetingSession || 'morning';
        if (!existingSessions.some(s => (typeof s === 'object' ? s.date === updatedData.nextMeetingDate && (s.session || 'morning') === nextSess : s === updatedData.nextMeetingDate))) {
          existingSessions.push({ date: updatedData.nextMeetingDate, session: nextSess, addedAt: new Date().toISOString() });
        }
      }

      updatePayload.scheduledSessions = existingSessions;

      if (updatedData.statusChanged) {
        const currentHistory = leadDoc?.statusHistory || [];
        updatePayload.statusHistory = [
          ...currentHistory,
          {
            status: updatedData.status,
            note: `Changed from "${updatedData.oldStatus}" to "${updatedData.status}"`,
            changedAt: new Date().toISOString(),
          }
        ];
      }
      await updateDoc(docRef, updatePayload);
    }
    setSelectedLeadForEdit(null);
  };

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #fef3c7, #e0f2fe)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', margin: 0 }}>
                {formatDisplayDate(selectedDate)} Session CRM Prospects
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                Leads scheduled to join live Zoom sessions
              </p>
            </div>
          </div>

          {/* Right side controls: Date Picker + Session Toggle Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

            {/* Date Navigation & Calendar Picker */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              background: '#ffffff', padding: '2px 6px', borderRadius: '8px',
              border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <button
                type="button"
                onClick={() => handleDateOffset(-1)}
                title="Previous Day"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)',
                  padding: '2px 3px', lineHeight: 1
                }}
              >
                ◀
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', fontSize: '0.75rem',
                  fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer',
                  outline: 'none', padding: '0 2px'
                }}
              />
              <button
                type="button"
                onClick={() => handleDateOffset(1)}
                title="Next Day"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)',
                  padding: '2px 3px', lineHeight: 1
                }}
              >
                ▶
              </button>
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  style={{
                    fontSize: '0.65rem', fontWeight: '800', padding: '2px 5px',
                    borderRadius: '5px', background: '#eff6ff', color: '#1d4ed8',
                    border: '1px solid #bfdbfe', cursor: 'pointer'
                  }}
                  title="Reset to Today"
                >
                  Today
                </button>
              )}
            </div>

            {/* Session Toggle Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveSession('morning')}
                style={{
                  padding: '3px 9px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                  background: activeSession === 'morning' ? '#0284c7' : '#e0f2fe',
                  color: activeSession === 'morning' ? 'white' : '#0369a1',
                }}
              >
                🌅 Morning ({morningLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSession('evening')}
                style={{
                  padding: '3px 9px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                  background: activeSession === 'evening' ? '#7e22ce' : '#faf5ff',
                  color: activeSession === 'evening' ? 'white' : '#6b21a8',
                }}
              >
                🌇 Evening ({eveningLeads.length})
              </button>
            </div>
          </div>
        </div>

        {/* Lead List Container */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading session prospects...
            </div>
          ) : currentList.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                {activeSession === 'morning' ? '🌅' : '🌇'}
              </div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', fontSize: '0.88rem' }}>
                No CRM leads scheduled for {formatDisplayDate(selectedDate)} {activeSession === 'morning' ? 'Morning (11:00 AM)' : 'Evening (7:45 PM)'} session
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Set "Schedule Next Meeting" in CRM lead details to track attendee prospects here.
              </p>
            </div>
          ) : (
            currentList.map((lead, idx) => {
              const isAttendedThisSession = (
                (Array.isArray(lead.attendedSessions) && lead.attendedSessions.some(s => (
                  typeof s === 'object' 
                    ? s.date === selectedDate && (s.session || 'morning') === activeSession 
                    : s === `${selectedDate}_${activeSession}` || s === selectedDate
                ))) ||
                (lead.lastAttendedDate === selectedDate && (lead.lastAttendedSession || lead.nextMeetingSession || 'morning') === activeSession)
              );

              const isRescheduledFromThis = Boolean(
                lead.nextMeetingDate && 
                (lead.nextMeetingDate !== selectedDate || (lead.nextMeetingSession || 'morning') !== activeSession)
              );

              return (
                <div
                  key={lead.id}
                  id={`session-lead-item-${lead.id}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < currentList.length - 1 ? '1px solid var(--border-color)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'var(--card-bg)',
                  }}
                >
                  {/* Row 1: Avatar + Name + Stage Badge + Status Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div
                      onClick={() => setSelectedLeadForEdit(lead)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, cursor: 'pointer' }}
                      title={`Click to open lead details for ${lead.name}`}
                    >
                      <div
                        style={{
                          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                          background: activeSession === 'morning'
                            ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                            : 'linear-gradient(135deg, #7e22ce, #db2777)',
                          color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.88rem', fontWeight: '800',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                        }}
                        title={`Click to open lead details for ${lead.name}`}
                      >
                        {lead.name?.charAt(0)?.toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                            {lead.name}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: '800',
                            background: lead.status === '1 Session' ? '#e0f2fe' : lead.status === '2 Session' ? '#faf5ff' : '#f3f4f6',
                            color: lead.status === '1 Session' ? '#0369a1' : lead.status === '2 Session' ? '#6b21a8' : '#374151',
                            border: '1px solid var(--border-color)',
                            whiteSpace: 'nowrap'
                          }}>
                            {lead.status || 'New Lead'}
                          </span>
                          {isAttendedThisSession && (
                            <span style={{
                              padding: '2px 8px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: '800',
                              background: '#dcfce7', color: '#15803d', border: '1px solid #86efac',
                              whiteSpace: 'nowrap'
                            }}>
                              ✓ Attended
                            </span>
                          )}
                          {isRescheduledFromThis && (
                            <span style={{
                              padding: '2px 8px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: '800',
                              background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                              whiteSpace: 'nowrap'
                            }}>
                              Next: {lead.nextMeetingDate} ({lead.nextMeetingSession === 'evening' ? 'Eve' : 'Morn'})
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Scheduled {formatDisplayDate(selectedDate)} ({activeSession === 'morning' ? '🌅 Morning' : '🌇 Evening'})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {lead.phone && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            window.location.href = `tel:${lead.phone}`;
                            if (lead.id) {
                              logCrmCall(db, lead.id, lead);
                            }
                          }}
                          style={{
                            color: '#16a34a', fontSize: '0.74rem', fontWeight: '800',
                            background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 10px', borderRadius: '6px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                          }}
                          title={`Call ${lead.phone}`}
                        >
                          📞 Call
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsAppChat(lead.phone)}
                          style={{
                            color: '#15803d', fontSize: '0.74rem', fontWeight: '800',
                            background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 10px', borderRadius: '6px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                          }}
                          title={`WhatsApp Chat with ${lead.name}`}
                          id={`session-lead-chat-${lead.id}`}
                        >
                          💬 Chat
                        </button>
                      </>
                    )}

                    {isAttendedThisSession ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '5px 12px', fontSize: '0.74rem', fontWeight: '800', width: 'auto' }}
                          onClick={() => setSelectedLeadForReschedule({
                            ...lead,
                            currentSessionDate: selectedDate,
                            currentSessionType: activeSession,
                            modalTitle: lead.status === '1 Session' ? 'Schedule 2nd Live Meeting' : 'Schedule Next Session'
                          })}
                          title="Schedule next live meeting date and session time"
                        >
                          📅 Schedule Next Meeting
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: '5px 10px', fontSize: '0.74rem', fontWeight: '800', borderRadius: '6px',
                            background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', cursor: 'pointer'
                          }}
                          onClick={() => setSelectedLeadForReschedule({
                            ...lead,
                            currentSessionDate: selectedDate,
                            currentSessionType: activeSession,
                            modalTitle: 'Reschedule Session'
                          })}
                          title="Reschedule session date"
                        >
                          📅 Reschedule
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '5px 10px', fontSize: '0.74rem', fontWeight: '800', width: 'auto' }}
                          onClick={() => handleMarkAttended(lead)}
                          title="Mark attended: Advances lead stage & opens schedule next meeting modal"
                        >
                          ✅ Attended
                        </button>

                        <button
                          type="button"
                          style={{
                            padding: '5px 10px', fontSize: '0.74rem', fontWeight: '800', borderRadius: '6px',
                            background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', cursor: 'pointer'
                          }}
                          onClick={() => setSelectedLeadForReschedule({
                            ...lead,
                            currentSessionDate: selectedDate,
                            currentSessionType: activeSession,
                            modalTitle: 'Reschedule Missed Session'
                          })}
                          title="Reschedule next meeting date if lead missed today"
                        >
                          📅 Reschedule
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedLeadForEdit && (
        <CrmEnquiryModal
          enquiry={selectedLeadForEdit}
          onSave={handleCrmSave}
          onClose={() => setSelectedLeadForEdit(null)}
          coachUid={coachUid}
          userRole={userRole}
          autoCallLogFocus={false}
        />
      )}

      {selectedLeadForReschedule && (
        <QuickRescheduleModal
          lead={selectedLeadForReschedule}
          viewingDate={selectedDate}
          viewingSession={activeSession}
          onClose={() => setSelectedLeadForReschedule(null)}
          onSaved={fetchLeads}
        />
      )}
    </>
  );
}
