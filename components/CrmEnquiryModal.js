'use client';

import React, { useState, useEffect } from 'react';

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

export default function CrmEnquiryModal({ enquiry, onSave, onClose, onConvert, autoCallLogFocus = false }) {
  const isEditing = !!enquiry;

  const [showMenu, setShowMenu]               = useState(false);
  const [callLogHighlight, setCallLogHighlight] = useState(false);
  const [name, setName]                       = useState('');
  const [phone, setPhone]                     = useState('');
  const [address, setAddress]                 = useState('');
  const [healthCondition, setHealthCondition] = useState('Weight Loss / Overweight');
  const [source, setSource]                   = useState('Referral');
  const [status, setStatus]                   = useState('New Lead');
  const [followUpDate, setFollowUpDate]       = useState('');
  const [notes, setNotes]                     = useState('');
  const [callLogs, setCallLogs]               = useState([]);

  // New Call Log Form
  const [newCallOutcome, setNewCallOutcome]   = useState('📞 Answered & Interested');
  const [newCallNotes, setNewCallNotes]       = useState('');

  const [error, setError]                     = useState('');
  const [submitting, setSubmitting]           = useState(false);

  useEffect(() => {
    if (enquiry) {
      setName(enquiry.name || '');
      setPhone(enquiry.phone || '');
      setAddress(enquiry.address || '');
      setHealthCondition(enquiry.healthCondition || 'Weight Loss / Overweight');
      setSource(enquiry.source || 'Referral');
      setStatus(enquiry.status || 'New Lead');
      setFollowUpDate(enquiry.followUpDate || '');
      setNotes(enquiry.notes || '');
      setCallLogs(enquiry.callLogs || []);

      if (autoCallLogFocus) {
        setCallLogHighlight(true);
        setTimeout(() => {
          const notesInput = document.getElementById('crm-call-log-notes');
          if (notesInput) {
            notesInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            notesInput.focus();
          }
        }, 400);
      }
    }
  }, [enquiry, autoCallLogFocus]);

  const handleCallClick = () => {
    if (!phone) return;
    window.open(`tel:${phone}`);
    setCallLogHighlight(true);
    setTimeout(() => {
      const notesInput = document.getElementById('crm-call-log-notes');
      if (notesInput) {
        notesInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        notesInput.focus();
      }
    }, 300);
  };

  const handleAddCallLog = (e) => {
    e.preventDefault();
    if (!newCallNotes.trim()) {
      alert('Please enter call answer/discussion notes.');
      return;
    }

    const entry = {
      outcome: newCallOutcome,
      notes: newCallNotes.trim(),
      calledAt: new Date().toISOString(),
    };

    setCallLogs(prev => [entry, ...prev]);
    setNewCallNotes('');
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
        followUpDate,
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-card" style={{ maxWidth: '620px', width: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
        
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
            {isEditing && onConvert && (enquiry.status !== 'Closing' && enquiry.status !== 'Converted') && (
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
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="modal-close">&times;</button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '12px' }}>⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Row 1: Name & Phone */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-name">Lead Name *</label>
              <input
                type="text"
                id="crm-name"
                className="form-input"
                placeholder="Full name"
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
              <label className="form-label" htmlFor="crm-followup">Next Follow-up Date</label>
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
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Call History ({callLogs.length} entries):
                </span>
                {callLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#2563eb' }}>
                        {log.outcome}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {log.calledAt ? new Date(log.calledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    {log.notes && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
                        💬 {log.notes}
                      </p>
                    )}
                  </div>
                ))}
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
    </div>
  );
}
