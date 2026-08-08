'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const STATUS_OPTIONS = ['New Lead', '1 Session', '2 Session', 'Closing', 'Waiting List', 'Rejected'];
const SOURCE_OPTIONS = ['Referral', 'Social Media', 'Walk-in', 'Bulk Import', 'Other'];
const HEALTH_OPTIONS = [
  'Weight Loss / Overweight',
  'Fat Loss & Toning',
  'Diabetes / High Sugar',
  'Blood Pressure (BP)',
  'Thyroid Issue',
  'Joint / Knee Pain',
  'Low Energy / Fatigue',
  'General Fitness',
  'Other / Custom',
];

const CALL_OUTCOME_OPTIONS = [
  { label: '📞 Answered & Interested', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: '📅 Session 1 Scheduled',   color: '#7e22ce', bg: '#fdf4ff', border: '#e9d5ff' },
  { label: '📅 Session 2 Scheduled',   color: '#9d174d', bg: '#fce7f3', border: '#f472b6' },
  { label: '⏰ Call Back Later',      color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { label: '❌ No Answer / Busy',      color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  { label: '🚫 Not Interested',       color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
];

function getStatusBadgeClass(status) {
  const map = {
    'New Lead': 'status-new',
    'New': 'status-new',
    '1 Session': 'status-interested',
    '2 Session': 'status-contacted',
    'Closing': 'status-converted',
    'Converted': 'status-converted',
    'Waiting List': 'status-interested',
    'Rejected': 'status-not-interested',
    'Not Interested': 'status-not-interested',
  };
  return map[status] || 'status-new';
}

export default function CrmEnquiryModal({ enquiry, onSave, onClose, onConvert, onDelete, coaches = [], userRole = 'coach', autoCallLogFocus = false }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isEditing = !!enquiry;

  const [showMenu, setShowMenu]               = useState(false);
  const [callLogHighlight, setCallLogHighlight] = useState(false);
  const [name, setName]                       = useState('');
  const [phone, setPhone]                     = useState('');
  const [address, setAddress]                 = useState('');
  const [healthCondition, setHealthCondition] = useState('Weight Loss / Overweight');
  const [source, setSource]                   = useState('Referral');
  const [status, setStatus]                   = useState('New Lead');
  const [assignedCoachId, setAssignedCoachId] = useState('');
  const [staffName, setStaffName]             = useState('');
  const [followUpDate, setFollowUpDate]       = useState('');
  const [nextMeetingDate, setNextMeetingDate] = useState('');
  const [nextMeetingSession, setNextMeetingSession] = useState('morning');
  const [notes, setNotes]                     = useState('');
  const [callLogs, setCallLogs]               = useState([]);

  // New & Editing Call Log States
  const [editingLogId, setEditingLogId]       = useState(null);
  const [editingOutcome, setEditingOutcome]   = useState('📞 Answered & Interested');
  const [editingNotes, setEditingNotes]       = useState('');

  const [newCallOutcome, setNewCallOutcome]   = useState('📞 Answered & Interested');
  const [newCallNotes, setNewCallNotes]       = useState('');

  const [error, setError]                     = useState('');
  const [loadError, setLoadError]             = useState('');
  const [submitting, setSubmitting]           = useState(false);

  // Escape key → close modal (safety for mobile freeze)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!enquiry) return;
    try {
      setName(enquiry.name || '');
      setPhone(enquiry.phone || '');
      setAddress(enquiry.address || '');
      setHealthCondition(enquiry.healthCondition || 'Weight Loss / Overweight');
      setSource(enquiry.source || 'Referral');
      setStatus(enquiry.status || 'New Lead');
      setAssignedCoachId(enquiry.coachId || enquiry.coachUid || '');
      setStaffName(enquiry.staffName || enquiry.coachName || '');
      setFollowUpDate(enquiry.followUpDate || '');
      setNextMeetingDate(enquiry.nextMeetingDate || '');
      setNextMeetingSession(enquiry.nextMeetingSession || 'morning');
      setNotes(enquiry.notes || '');

      // Ensure each call log entry has an id
      const existingLogs = (enquiry.callLogs || []).map((l, i) => ({
        id: l.id || `log-${i}-${Date.now()}`,
        ...l,
      }));

      if (autoCallLogFocus) {
        punchAutoCallLog(enquiry, existingLogs);
      } else {
        setCallLogs(existingLogs);
      }
    } catch (err) {
      console.error('[CrmModal useEffect] Error loading enquiry:', err);
      setLoadError(err?.message || 'Lead load error');
      // Close modal after short delay to free the screen
      setTimeout(() => onClose?.(), 1200);
    }
  }, [enquiry, autoCallLogFocus]);

  // ── Bulletproof Auto-Punch Call Log Entry ──────────────────────
  const punchAutoCallLog = async (targetEnquiry, currentLogs) => {
    const currentStatus = targetEnquiry?.status || status || 'New Lead';
    const isNewLead = currentStatus === 'New Lead' || currentStatus === 'New';
    const callType = isNewLead ? 'Invitation' : 'Follow-up';

    const newLogId = `call-${Date.now()}`;
    const autoEntry = {
      id: newLogId,
      callType,
      statusAtCall: currentStatus,
      outcome: '📞 Answered & Interested',
      notes: '',
      calledAt: new Date().toISOString(),
    };

    const baseLogs = currentLogs || callLogs || [];
    const updatedLogs = [autoEntry, ...baseLogs];
    setCallLogs(updatedLogs);

    setEditingLogId(newLogId);
    setEditingOutcome(autoEntry.outcome);
    setEditingNotes('');

    if (targetEnquiry?.id) {
      try {
        await onSave({
          name: targetEnquiry.name || name || '',
          phone: targetEnquiry.phone || phone || '',
          address: targetEnquiry.address || address || '',
          healthCondition: targetEnquiry.healthCondition || healthCondition || 'Weight Loss / Overweight',
          source: targetEnquiry.source || source || 'Referral',
          status: targetEnquiry.status || status || 'New Lead',
          followUpDate: targetEnquiry.followUpDate || followUpDate || '',
          nextMeetingDate: targetEnquiry.nextMeetingDate || nextMeetingDate || '',
          nextMeetingSession: targetEnquiry.nextMeetingSession || nextMeetingSession || 'morning',
          notes: targetEnquiry.notes || notes || '',
          callLogs: updatedLogs,
        }, targetEnquiry.id, true);
      } catch (err) {
        console.error('Punch auto log save error:', err);
      }
    }

    setTimeout(() => {
      const notesInput = document.getElementById(`call-log-edit-notes-${newLogId}`);
      if (notesInput) {
        notesInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        notesInput.focus();
      }
    }, 300);
  };

  const handleCallClick = async () => {
    const activePhone = phone || enquiry?.phone;
    try {
      if (activePhone) {
        window.location.href = `tel:${activePhone}`;
      }
      await punchAutoCallLog(enquiry || { phone: activePhone }, callLogs);
    } catch (err) {
      console.error('Call click error:', err);
    }
  };

  const handleStartEditLog = (log) => {
    setEditingLogId(log.id);
    setEditingOutcome(log.outcome || '📞 Answered & Interested');
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

    // Save to Firestore
    if (isEditing && enquiry?.id) {
      try {
        await onSave({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          healthCondition,
          source,
          status,
          followUpDate,
          nextMeetingDate,
          nextMeetingSession,
          notes: notes.trim(),
          callLogs: updatedLogs,
        }, enquiry.id, true);
      } catch (err) {
        console.error('Update call log error:', err);
      }
    }
  };

  const handleAddCallLog = async (e) => {
    e.preventDefault();
    if (!newCallNotes.trim()) {
      alert('Please enter call answer/discussion notes.');
      return;
    }

    const isNewLead = status === 'New Lead' || status === 'New';
    const callType = isNewLead ? 'Invitation' : 'Follow-up';

    const entry = {
      id: `call-${Date.now()}`,
      callType,
      statusAtCall: status,
      outcome: newCallOutcome,
      notes: newCallNotes.trim(),
      calledAt: new Date().toISOString(),
    };

    const updatedLogs = [entry, ...callLogs];
    setCallLogs(updatedLogs);
    setNewCallNotes('');

    // Instant save to Firestore
    if (isEditing && enquiry?.id) {
      try {
        await onSave({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          healthCondition,
          source,
          status,
          followUpDate,
          nextMeetingDate,
          nextMeetingSession,
          notes: notes.trim(),
          callLogs: updatedLogs,
        }, enquiry.id, true);
      } catch (err) {
        console.error('Instant save call log error:', err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Name and Phone Number are required.');
      return;
    }

    setSubmitting(true);

    try {
      const data = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        healthCondition,
        source,
        status,
        coachId: assignedCoachId,
        staffName: staffName.trim(),
        followUpDate,
        nextMeetingDate,
        nextMeetingSession,
        notes: notes.trim(),
        callLogs,
      };

      if (isEditing && enquiry.status !== status) {
        data.statusChanged = true;
        data.oldStatus = enquiry.status;
      }

      await onSave(data, isEditing ? enquiry.id : null);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save. Please try again.');
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-card" style={{ maxWidth: '620px', width: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Load error fallback — shows if useEffect throws */}
        {loadError && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
            <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '700', marginBottom: '8px' }}>Lead load error</p>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '16px' }}>{loadError}</p>
            <button onClick={onClose} style={{ padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Close</button>
          </div>
        )}
        
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
              {isEditing ? `Lead Details: ${enquiry.name}` : '➕ New Lead Entry'}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Manage lead information, status history, and phone call logs
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isEditing && (onConvert || onDelete) && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '1.2rem',
                    fontWeight: '900',
                    borderRadius: '6px',
                    background: showMenu ? 'var(--primary-light)' : 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  title="Lead Options"
                  id="crm-lead-three-dots-btn"
                >
                  ⋮
                </button>

                {showMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '36px',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 100,
                      minWidth: '200px',
                      padding: '6px 0',
                    }}
                  >
                    {onConvert && (enquiry.status !== 'Closing' && enquiry.status !== 'Converted') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onClose();
                          onConvert(enquiry);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          color: '#10b981',
                          fontSize: '0.84rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        id="crm-menu-convert-action"
                      >
                        🔄 Convert to Customer
                      </button>
                    )}

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onClose();
                          onDelete(enquiry.id, enquiry.name);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          fontSize: '0.84rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderTop: onConvert ? '1px solid var(--border-color)' : 'none',
                        }}
                        id="crm-menu-delete-action"
                      >
                        🗑️ Delete Lead
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="modal-close">&times;</button>
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          
          {/* Assigned Staff (Internal tag — Club Owner only) */}
          {userRole === 'admin' && coaches && coaches.length > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="crm-staff-name" style={{ fontSize: '0.78rem', fontWeight: '800' }}>
                👤 Internal Staff Tag (જવાબદાર સ્ટાફ/કોચ - ઈન્ટરનલ રેકોર્ડ માટે)
              </label>
              <select
                id="crm-staff-name"
                className="form-input"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                disabled={submitting}
                style={{ fontWeight: '700' }}
              >
                <option value="">— Select Staff Member —</option>
                {coaches.map(c => (
                  <option key={c.uid || c.id} value={c.name || c.fullName}>
                    {c.name || c.fullName} ({c.role === 'admin' ? 'Club Owner' : 'Coach'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Row 1: Name & Phone */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-name">Lead Full Name *</label>
              <input
                type="text"
                id="crm-name"
                className="form-input"
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" htmlFor="crm-phone" style={{ margin: 0 }}>Mobile Number *</label>
                {phone && (
                  <button
                    type="button"
                    onClick={handleCallClick}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 10px', borderRadius: '4px',
                      background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                      fontSize: '0.74rem', fontWeight: '800', cursor: 'pointer',
                    }}
                    title={`Call ${name} (${phone}) & Auto-log entry`}
                    id="crm-modal-call-lead-btn"
                  >
                    📞 Call & Log Response
                  </button>
                )}
              </div>
              <input
                type="tel"
                id="crm-phone"
                className="form-input"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Row 2: Address & Health Condition */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-address">Address / City</label>
              <input
                type="text"
                id="crm-address"
                className="form-input"
                placeholder="e.g. Surat, Gujarat"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crm-health">Health Condition</label>
              <select
                id="crm-health"
                className="form-input"
                value={healthCondition}
                onChange={(e) => setHealthCondition(e.target.value)}
                disabled={submitting}
              >
                {HEALTH_OPTIONS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Pipeline Stage & Follow-up Date */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-status">Pipeline Stage</label>
              <select
                id="crm-status"
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={submitting}
                style={{ fontWeight: '800' }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crm-followup">Next Follow-up Date (Optional)</label>
              <input
                type="date"
                id="crm-followup"
                className="form-input"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Schedule Next Live Meeting (Morning or Evening) */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            marginTop: '2px',
          }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              🎥 Schedule Next Live Meeting Session
            </label>
            <div className="form-row-2" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Meeting Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={nextMeetingDate}
                  onChange={(e) => setNextMeetingDate(e.target.value)}
                  disabled={submitting}
                  id="crm-next-meeting-date"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Session Time</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setNextMeetingSession('morning')}
                    id="crm-session-morning-btn"
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                      border: nextMeetingSession === 'morning' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                      background: nextMeetingSession === 'morning' ? '#e0f2fe' : 'white',
                      color: nextMeetingSession === 'morning' ? '#0369a1' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    🌅 Morning
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextMeetingSession('evening')}
                    id="crm-session-evening-btn"
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                      border: nextMeetingSession === 'evening' ? '2px solid #7e22ce' : '1px solid var(--border-color)',
                      background: nextMeetingSession === 'evening' ? '#faf5ff' : 'white',
                      color: nextMeetingSession === 'evening' ? '#6b21a8' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    🌇 Evening
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="crm-notes">General Notes</label>
            <textarea
              id="crm-notes"
              className="form-input"
              style={{ minHeight: '60px', resize: 'vertical' }}
              placeholder="Key notes about this prospect..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* ──────────────── 📞 CALL LOG SECTION ──────────────── */}
          <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '10px', color: 'var(--text-main)' }}>
              📞 Call Log & Interaction Notes
            </h4>

            {/* Add Call Log Box */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Record New Call Entry:
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
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: callLogHighlight ? '#16a34a' : 'var(--text-main)' }}>
                  {callLogHighlight ? '👉 Record Call Answer / Discussion Notes *' : 'Answer / Discussion Notes *'}
                </label>
                <textarea
                  id="crm-call-log-notes"
                  className="form-input"
                  rows={2}
                  placeholder="Record prospect's answer, questions asked, or agreed next steps..."
                  value={newCallNotes}
                  onChange={e => setNewCallNotes(e.target.value)}
                  style={{
                    fontSize: '0.82rem', resize: 'vertical',
                    border: callLogHighlight ? '2px solid #16a34a' : '1px solid var(--border-color)',
                    boxShadow: callLogHighlight ? '0 0 0 3px rgba(22, 163, 74, 0.15)' : 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleAddCallLog}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.8rem', fontWeight: '800', padding: '6px 12px' }}
                id="crm-add-call-log-btn"
              >
                + Add Call Log Entry
              </button>
            </div>

            {/* Call Log History Cards */}
            {callLogs && callLogs.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  📞 Call History ({callLogs.length} entries):
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
                            id={`call-log-edit-notes-${logId}`}
                            className="form-input"
                            rows={2}
                            placeholder="Type prospect's answer or notes here..."
                            value={editingNotes}
                            onChange={e => setEditingNotes(e.target.value)}
                            style={{ fontSize: '0.82rem', resize: 'vertical' }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveEditedLog(logId)}
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', fontSize: '0.78rem', fontWeight: '800', padding: '6px 12px' }}
                          id={`save-call-log-edit-btn-${logId}`}
                        >
                          💾 Save Call Details
                        </button>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#2563eb' }}>
                            {log.outcome || '📞 Call Placed'}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                            background: (log.callType === 'Invitation' || (!log.callType && (status === 'New Lead' || status === 'New'))) ? '#f0fdf4' : '#fdf4ff',
                            color: (log.callType === 'Invitation' || (!log.callType && (status === 'New Lead' || status === 'New'))) ? '#16a34a' : '#7e22ce',
                            border: (log.callType === 'Invitation' || (!log.callType && (status === 'New Lead' || status === 'New'))) ? '1px solid #bbf7d0' : '1px solid #e9d5ff'
                          }}>
                            {(log.callType === 'Invitation' || (!log.callType && (status === 'New Lead' || status === 'New'))) ? '📩 Invitation Call' : '📞 Follow-up Call'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        </div>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: log.notes ? 'var(--text-main)' : 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        💬 {log.notes || <em>(No notes recorded yet — click Edit Log to add)</em>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ──────────────── STATUS HISTORY ──────────────── */}
          {isEditing && enquiry.statusHistory && enquiry.statusHistory.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '0.85rem', fontWeight: '800' }}>
                📜 Pipeline Stage Change History
              </label>
              <div className="status-history-log">
                {enquiry.statusHistory.map((entry, idx) => (
                  <div key={idx} className="status-history-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                        {entry.status}
                      </span>
                      {entry.note && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          — {entry.note}
                        </span>
                      )}
                    </div>
                    <span className="status-history-date">
                      {entry.changedAt ? new Date(entry.changedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save / Cancel Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
              style={{ width: '35%' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '65%', fontWeight: '800' }}
              id="crm-save-btn"
            >
              {submitting ? 'Saving...' : (isEditing ? '💾 Save Lead Updates' : '✅ Add Lead')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
