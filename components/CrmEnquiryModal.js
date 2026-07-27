'use client';

import React, { useState, useEffect } from 'react';

const STATUS_OPTIONS = ['New', 'Contacted', 'Interested', 'Converted', 'Not Interested'];
const SOURCE_OPTIONS = ['Referral', 'Social Media', 'Walk-in', 'Other'];

function getStatusBadgeClass(status) {
  const map = {
    'New': 'status-new',
    'Contacted': 'status-contacted',
    'Interested': 'status-interested',
    'Converted': 'status-converted',
    'Not Interested': 'status-not-interested',
  };
  return map[status] || 'status-new';
}

export default function CrmEnquiryModal({ enquiry, onSave, onClose }) {
  const isEditing = !!enquiry;

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
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Enquiry' : 'New Enquiry'}</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
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
              <label className="form-label" htmlFor="crm-phone">Phone Number</label>
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
