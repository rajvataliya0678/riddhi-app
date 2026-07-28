'use client';

import React, { useState, useEffect } from 'react';

const STATUS_OPTIONS = ['New Lead', '1 Session', '2 Session', 'Closing', 'Waiting List', 'Rejected'];
const SOURCE_OPTIONS = ['Referral', 'Social Media', 'Walk-in', 'Bulk Import', 'Other'];

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

export default function CrmEnquiryModal({ enquiry, onSave, onClose, onConvert }) {
  const isEditing = !!enquiry;

  const [showMenu, setShowMenu] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Referral');
  const [status, setStatus] = useState('New');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (enquiry) {
      setName(enquiry.name || '');
      setPhone(enquiry.phone || '');
      setSource(enquiry.source || 'Referral');
      setStatus(enquiry.status || 'New');
      setFollowUpDate(enquiry.followUpDate || '');
      setNotes(enquiry.notes || '');
    }
  }, [enquiry]);

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
        source,
        status,
        followUpDate,
        notes: notes.trim(),
      };

      // If editing and status changed, track the change
      if (isEditing && enquiry.status !== status) {
        data.statusChanged = true;
        data.oldStatus = enquiry.status;
      }

      await onSave(data, isEditing ? enquiry.id : null);
    } catch (err) {
      setError('Failed to save. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal-card" style={{ maxWidth: '540px' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>{isEditing ? 'Edit Lead Details' : 'New Lead'}</h3>
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
          <div className="alert alert-danger">⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-name">Name</label>
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
                <label className="form-label" htmlFor="crm-phone" style={{ margin: 0 }}>Phone Number</label>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '4px',
                      background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                      fontSize: '0.72rem', fontWeight: '800', textDecoration: 'none'
                    }}
                    title={`Call ${name} (${phone})`}
                  >
                    📞 Call Lead
                  </a>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="crm-source">Source</label>
              <select
                id="crm-source"
                className="form-select"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={submitting}
              >
                {SOURCE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="crm-status">Status</label>
              <select
                id="crm-status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={submitting}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="crm-followup">Follow-up Date</label>
            <input
              type="date"
              id="crm-followup"
              className="form-input"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="crm-notes">Notes</label>
            <textarea
              id="crm-notes"
              className="form-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="Add notes about this enquiry..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Status Change History (only when editing) */}
          {isEditing && enquiry.statusHistory && enquiry.statusHistory.length > 0 && (
            <div>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Status Change History</label>
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
                      {entry.changedAt ? new Date(entry.changedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
              style={{ width: '40%' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '60%' }}
              id="crm-save-btn"
            >
              {submitting ? 'Saving...' : (isEditing ? 'Update Enquiry' : 'Add Enquiry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
