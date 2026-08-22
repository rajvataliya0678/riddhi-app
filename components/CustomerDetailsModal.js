'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MonthAttendanceCalendar } from './AttendanceTab';
import { openWhatsAppChat } from '@/lib/whatsapp';

const CALL_OUTCOME_OPTIONS = [
  { label: '📞 Called',                 color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
  { label: '📞 Answered & Interested', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: '📅 Follow-up Scheduled',  color: '#7e22ce', bg: '#fdf4ff', border: '#e9d5ff' },
  { label: '⏰ Call Back Later',      color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { label: '❌ No Answer / Busy',      color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  { label: '🚫 Not Interested',       color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
];

export default function CustomerDetailsModal({ customer, onClose, autoCallLogFocus = false, onCustomerUpdate }) {
  if (!customer) return null;

  const uid = customer.uid || customer.id;
  const [phone, setPhone]                     = useState(customer.phone || '');
  const [callLogs, setCallLogs]               = useState([]);

  // New & Inline Editing Call Log States
  const [editingLogId, setEditingLogId]       = useState(null);
  const [editingOutcome, setEditingOutcome]   = useState('📞 Called');
  const [editingNotes, setEditingNotes]       = useState('');

  const [newCallOutcome, setNewCallOutcome]   = useState('📞 Called');
  const [newCallNotes, setNewCallNotes]       = useState('');
  const [saving, setSaving]                   = useState(false);

  const [attendance, setAttendance]           = useState({ morning: {}, evening: {} });

  useEffect(() => {
    if (customer) {
      setPhone(customer.phone || '');
      const existingLogs = (customer.callLogs || []).map((l, i) => ({
        id: l.id || `log-${i}-${Date.now()}`,
        ...l,
      }));

      if (autoCallLogFocus) {
        punchAutoCallLog(customer, existingLogs);
      } else {
        setCallLogs(existingLogs);
      }

      fetchCustomerAttendance();
    }
  }, [customer, autoCallLogFocus]);

  const fetchCustomerAttendance = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(
          collection(db, 'meeting_attendance'),
          where('uid', '==', uid)
        )
      );

      const morningMap = {};
      const eveningMap = {};

      attSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.date || data.date < thirtyDaysAgoStr) return;
        if (data.sessionType === 'evening') {
          eveningMap[data.date] = true;
        } else {
          morningMap[data.date] = true;
        }
      });

      setAttendance({ morning: morningMap, evening: eveningMap });
    } catch (err) {
      console.error('Error fetching customer attendance:', err);
    }
  };

  // Save updated logs to Firestore users doc
  const saveLogsToFirestore = async (updatedLogs) => {
    try {
      setSaving(true);
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        callLogs: updatedLogs,
        updatedAt: serverTimestamp(),
      });
      if (onCustomerUpdate) onCustomerUpdate();
    } catch (err) {
      console.error('Error saving customer call log:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Bulletproof Auto-Punch Call Entry ──────────────────────
  const punchAutoCallLog = async (targetCustomer, currentLogs) => {
    const activePhone = targetCustomer.phone || phone;
    const newLogId = `call-${Date.now()}`;
    const autoEntry = {
      id: newLogId,
      outcome: '📞 Called',
      notes: '',
      calledAt: new Date().toISOString(),
    };

    const baseLogs = currentLogs || callLogs || [];
    const updatedLogs = [autoEntry, ...baseLogs];
    setCallLogs(updatedLogs);

    setEditingLogId(newLogId);
    setEditingOutcome(autoEntry.outcome);
    setEditingNotes('');

    await saveLogsToFirestore(updatedLogs);

    setTimeout(() => {
      const notesInput = document.getElementById(`cust-call-log-edit-notes-${newLogId}`);
      if (notesInput) {
        notesInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        notesInput.focus();
      }
    }, 300);
  };

  const handleCallClick = async () => {
    const activePhone = phone || customer.phone;
    if (activePhone) {
      window.location.href = `tel:${activePhone}`;
    }
  };

  const handleStartEditLog = (log) => {
    setEditingLogId(log.id);
    setEditingOutcome(log.outcome || '📞 Called');
    setEditingNotes(log.notes || '');
  };

  const handleSaveEditedLog = async (logId) => {
    const updatedLogs = callLogs.map(log => {
      if (log.id === logId) {
        return {
          ...log,
          outcome: editingOutcome,
          notes: editingNotes.trim(),
        };
      }
      return log;
    });

    setCallLogs(updatedLogs);
    setEditingLogId(null);
    await saveLogsToFirestore(updatedLogs);
  };

  const handleDeleteCallLog = async (logId) => {
    if (!window.confirm('શું તમે આ Call Log ની એન્ટ્રી ડીલીટ કરવા માંગો છો?')) {
      return;
    }
    const updatedLogs = callLogs.filter(log => (log.id || log.calledAt) !== logId);
    setCallLogs(updatedLogs);
    if (editingLogId === logId) {
      setEditingLogId(null);
    }
    await saveLogsToFirestore(updatedLogs);
  };

  const handleAddCallLog = async (e) => {
    e.preventDefault();
    if (!newCallNotes.trim()) {
      alert('Please enter call answer/discussion notes.');
      return;
    }

    const entry = {
      id: `call-${Date.now()}`,
      outcome: newCallOutcome,
      notes: newCallNotes.trim(),
      calledAt: new Date().toISOString(),
    };

    const updatedLogs = [entry, ...callLogs];
    setCallLogs(updatedLogs);
    setNewCallNotes('');
    await saveLogsToFirestore(updatedLogs);
  };

  const diag = customer.diagnosis || {};

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-card" style={{ maxWidth: '640px', width: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--primary), #2563eb)',
              color: 'white', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.4rem', fontWeight: '800',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
                  {customer.name}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: '800', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '99px' }}>
                  Active Customer
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Customer ID: {uid.substring(0, 8).toUpperCase()} • Joined {customer.createdAt ? new Date(customer.createdAt.toDate ? customer.createdAt.toDate() : customer.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        {/* Quick Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', margin: '14px 0', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>
              📱 Phone: {phone || 'Not provided'}
            </span>
          </div>

          {phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleCallClick}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                  fontSize: '0.8rem', fontWeight: '800', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}
                title={`Call ${customer.name} (${phone}) & log notes`}
                id="cust-modal-call-btn"
              >
                📞 Call Customer & Log
              </button>
              <button
                type="button"
                onClick={() => openWhatsAppChat(phone || customer?.phone)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                  background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                  fontSize: '0.8rem', fontWeight: '800', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}
                title={`WhatsApp Chat with ${customer.name} (${phone})`}
                id="cust-modal-chat-btn"
              >
                💬 Chat
              </button>
            </div>
          )}
        </div>

        {/* Customer Profile & Health Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: '800', display: 'block' }}>FITNESS GOAL</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e40af' }}>{diag.fitnessGoal || 'Weight Loss'}</span>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: '800', display: 'block' }}>STARTING WEIGHT</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#15803d' }}>{diag.initialWeight ? `${diag.initialWeight} kg` : '—'}</span>
          </div>

          <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <span style={{ fontSize: '0.68rem', color: '#7e22ce', fontWeight: '800', display: 'block' }}>TARGET WEIGHT</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#6b21a8' }}>{diag.goalWeight ? `${diag.goalWeight} kg` : '—'}</span>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: '800', display: 'block' }}>AGE / HEIGHT</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#92400e' }}>{diag.age ? `${diag.age} yrs` : '—'} {diag.height ? `(${diag.height} cm)` : ''}</span>
          </div>
        </div>

        {/* ──────────────── 📅 LIVE SESSION ATTENDANCE TRACKER BARS ──────────────── */}
        <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            📅 Live Session Attendance Calendars (Monthly View)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <MonthAttendanceCalendar
              label="Morning Live Session"
              icon="🌅"
              attendanceMap={attendance.morning}
              colorScheme="green"
            />
            <MonthAttendanceCalendar
              label="Evening Live Session"
              icon="🌇"
              attendanceMap={attendance.evening}
              colorScheme="purple"
            />
          </div>
        </div>

        {/* ──────────────── 📞 CALL LOG & INTERACTION SECTION ──────────────── */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              📞 Call Log & Customer Interactions
            </h4>
            {saving && <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '700' }}>💾 Saving...</span>}
          </div>

          {/* Record New Call Log Box */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Record Call Notes / Discussion:
            </div>
            <div className="form-row-2">
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Call Outcome</label>
                <select
                  className="form-input"
                  value={newCallOutcome}
                  onChange={e => setNewCallOutcome(e.target.value)}
                  style={{ fontSize: '0.82rem', fontWeight: '700' }}
                >
                  {CALL_OUTCOME_OPTIONS.map(opt => (
                    <option key={opt.label} value={opt.label}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Call Date/Time</label>
                <input
                  type="text"
                  className="form-input"
                  value={new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  readOnly
                  style={{ fontSize: '0.82rem', background: '#f3f4f6' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Discussion Notes *</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Record customer's response, diet questions, or next follow-up notes..."
                value={newCallNotes}
                onChange={e => setNewCallNotes(e.target.value)}
                style={{ fontSize: '0.82rem', resize: 'vertical' }}
              />
            </div>

            <button
              type="button"
              onClick={handleAddCallLog}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.8rem', fontWeight: '800', padding: '6px 12px' }}
              id="cust-add-call-log-btn"
            >
              + Add Call Log Entry
            </button>
          </div>

          {/* Call History Cards */}
          {callLogs && callLogs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)' }}>
                📞 Past Call Log History ({callLogs.length} entries):
              </span>
              {callLogs.map((log) => {
                const logId = log.id || log.calledAt;
                const isEditingThis = editingLogId === logId;

                if (isEditingThis) {
                  return (
                    <div
                      key={logId}
                      style={{
                        background: '#f0fdf4',
                        border: '2px solid #16a34a',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16a34a' }}>
                          📝 Editing Call Entry ({log.calledAt ? new Date(log.calledAt).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' }) : 'Just now'})
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingLogId(null)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                        >
                          ✖ Cancel
                        </button>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>Call Outcome</label>
                        <select
                          className="form-input"
                          value={editingOutcome}
                          onChange={e => setEditingOutcome(e.target.value)}
                          style={{ fontSize: '0.8rem', fontWeight: '700', padding: '4px 8px' }}
                        >
                          {CALL_OUTCOME_OPTIONS.map(opt => (
                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>Discussion / Answer Notes *</label>
                        <textarea
                          id={`cust-call-log-edit-notes-${logId}`}
                          className="form-input"
                          rows={2}
                          placeholder="Type customer's answer or notes here..."
                          value={editingNotes}
                          onChange={e => setEditingNotes(e.target.value)}
                          style={{ fontSize: '0.82rem', resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedLog(logId)}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, fontSize: '0.78rem', fontWeight: '800', padding: '6px 12px' }}
                          id={`cust-save-log-edit-btn-${logId}`}
                        >
                          💾 Save Call Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCallLog(logId)}
                          style={{
                            padding: '6px 12px', fontSize: '0.78rem', fontWeight: '800',
                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
                            borderRadius: '6px', cursor: 'pointer'
                          }}
                          title="Delete this call log entry"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={logId}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#2563eb' }}>
                        {log.outcome || '📞 Call Placed'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {log.calledAt ? new Date(log.calledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditLog(log)}
                          style={{
                            padding: '2px 8px', fontSize: '0.72rem', fontWeight: '800',
                            background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                            borderRadius: '4px', cursor: 'pointer',
                          }}
                          title="Edit notes & outcome for this call"
                        >
                          ✏️ Edit Log
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCallLog(logId)}
                          style={{
                            padding: '2px 8px', fontSize: '0.72rem', fontWeight: '800',
                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
                            borderRadius: '4px', cursor: 'pointer',
                          }}
                          title="Delete this call log entry"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: log.notes ? 'var(--text-main)' : 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      💬 {log.notes || <em>(No notes recorded yet — click Edit Log to add)</em>}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', margin: '10px 0' }}>
              No call logs recorded yet. Click 📞 Call Customer & Log above to record your first call.
            </p>
          )}
        </div>

        {/* Modal Close Button */}
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ width: '100%' }}>
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
}
