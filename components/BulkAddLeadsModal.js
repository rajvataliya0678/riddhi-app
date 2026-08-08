'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function BulkAddLeadsModal({ coachUid, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [inputText, setInputText] = useState('');
  const [source, setSource]       = useState('Bulk Import');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!inputText.trim()) {
      setError('Please enter at least one phone number or lead entry.');
      return;
    }

    // Split input by commas, newlines, or semicolons
    const rawTokens = inputText.split(/[\n,;]+/);
    const validEntries = [];

    rawTokens.forEach((token, index) => {
      const cleaned = token.trim();
      if (cleaned.length > 0) {
        // If token has name:phone format (e.g. "Rahul: 9876543210")
        if (cleaned.includes(':')) {
          const parts = cleaned.split(':');
          validEntries.push({
            name: parts[0].trim() || `Lead ${index + 1}`,
            phone: parts[1].trim(),
          });
        } else {
          // Pure number or name
          validEntries.push({
            name: cleaned.match(/^[0-9+\-\s]+$/) ? `Lead ${cleaned.slice(-4)}` : cleaned,
            phone: cleaned,
          });
        }
      }
    });

    if (validEntries.length === 0) {
      setError('No valid lead entries found.');
      return;
    }

    setSaving(true);
    try {
      for (const entry of validEntries) {
        await addDoc(collection(db, 'crm_enquiries'), {
          coachId: coachUid,
          name: entry.name,
          phone: entry.phone,
          status: 'New Lead',
          followUpDate: '',
          nextMeetingDate: '',
          nextMeetingSession: 'morning',
          notes: 'Added via Bulk Import',
          statusHistory: [
            {
              status: 'New Lead',
              note: 'Bulk Lead Created',
              changedAt: new Date().toISOString(),
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Bulk save error:', err);
      setError('Failed to save bulk leads. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '520px', width: '94vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>⚡ Bulk Add Leads</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Paste multiple numbers or names to generate leads instantly
            </p>
          </div>
          <button onClick={onClose} className="modal-close" id="bulk-leads-close">×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '12px 0 0' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Lead Source</label>
            <input
              id="bulk-source-input"
              className="form-input"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="e.g. Instagram Ads, Referral, WhatsApp Group"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Numbers / Lead Entries *</label>
            <textarea
              id="bulk-leads-textarea"
              className="form-input"
              rows={6}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Paste entries separated by comma or new line:\n9876543210, 9123456789, 9988776655\nOR\nRahul: 9876543210\nVidhi: 9123456789`}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
              required
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tip: You can paste numbers like `9876543210, 9123456789` or name-number pairs like `Rahul: 9876543210`.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="bulk-leads-submit-btn" style={{ width: 'auto' }}>
              {saving ? '⏳ Creating Leads...' : '✅ Generate Leads'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
