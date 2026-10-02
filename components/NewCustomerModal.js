'use client';

import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const PRIMARY_GOALS = [
  'Weight Loss', 'Weight Gain', 'Energy', 'Fitness', 'Healthy Lifestyle', 'Other',
];
const CUSTOMER_STATUSES = [
  'New Customer', 'Active Customer', 'Needs Attention', 'Good Progress',
  'Potential Sharer', 'Potential Coach', 'Coach Discussion Done', 'Not Interested', 'Inactive',
];
const GENDERS = ['Male', 'Female', 'Other'];

async function generateCustomerId() {
  const year = new Date().getFullYear();
  const snap = await getDocs(query(collection(db, 'customer_profiles')));
  const count = snap.size + 1;
  return `CUST-${year}-${String(count).padStart(3, '0')}`;
}

export default function NewCustomerModal({ coachUid, coachName, clubId = 'main', onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    age: '',
    gender: 'Female',
    joiningDate: today,
    referredBy: '',
    primaryGoal: 'Weight Loss',
    startingWeight: '',
    targetWeight: '',
    targetDate: '',
    mainWhy: '',
    status: 'New Customer',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) { setError('Full Name required.'); return; }
    if (!form.mobile.trim()) { setError('Mobile number required.'); return; }
    if (!form.startingWeight) { setError('Starting weight required.'); return; }

    setSaving(true);
    try {
      const customerId = await generateCustomerId();
      await addDoc(collection(db, 'customer_profiles'), {
        customerId,
        clubId: clubId || 'main',
        coachId: coachUid,
        assignedCoach: coachName || '',
        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        age: Number(form.age) || 0,
        gender: form.gender,
        joiningDate: form.joiningDate,
        referredBy: form.referredBy.trim(),
        primaryGoal: form.primaryGoal,
        startingWeight: parseFloat(form.startingWeight) || 0,
        targetWeight: parseFloat(form.targetWeight) || 0,
        targetDate: form.targetDate,
        mainWhy: form.mainWhy.trim(),
        status: form.status,
        daysCompleted: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '640px', width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>➕ New Customer</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Section A — Customer Master Profile (one-time setup)</p>
          </div>
          <button onClick={onClose} className="modal-close" id="new-customer-close-btn">×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '16px 0 0' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ padding: '0' }}>

          {/* ── Basic Info ── */}
          <div className="followup-section-block">
            <div className="followup-section-title">👤 Basic Information</div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="nc-fullname" className="form-input" placeholder="e.g. Priya Shah" value={form.fullName} onChange={e => set('fullName', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input id="nc-mobile" className="form-input" type="tel" placeholder="e.g. 9876543210" value={form.mobile} onChange={e => set('mobile', e.target.value)} required />
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Age</label>
                <input id="nc-age" className="form-input" type="number" min="10" max="100" placeholder="e.g. 32" value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select id="nc-gender" className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Joining Date</label>
                <input id="nc-joining-date" className="form-input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Referred By</label>
                <input id="nc-referred-by" className="form-input" placeholder="Name or Customer ID" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Coach</label>
                <input className="form-input" value={coachName || 'You'} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>

          {/* ── Goal & Weight ── */}
          <div className="followup-section-block">
            <div className="followup-section-title">🎯 Goal & Weight</div>

            <div className="form-group">
              <label className="form-label">Primary Goal</label>
              <select id="nc-primary-goal" className="form-input" value={form.primaryGoal} onChange={e => set('primaryGoal', e.target.value)}>
                {PRIMARY_GOALS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Starting Weight (kg) *</label>
                <input id="nc-start-weight" className="form-input" type="number" step="0.1" min="20" max="300" placeholder="e.g. 78.5" value={form.startingWeight} onChange={e => set('startingWeight', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Target Weight (kg)</label>
                <input id="nc-target-weight" className="form-input" type="number" step="0.1" min="20" max="300" placeholder="e.g. 65.0" value={form.targetWeight} onChange={e => set('targetWeight', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Date</label>
                <input id="nc-target-date" className="form-input" type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── WHY & Status ── */}
          <div className="followup-section-block">
            <div className="followup-section-title">💬 Why & Status</div>

            <div className="form-group">
              <label className="form-label">Customer Main WHY</label>
              <textarea id="nc-main-why" className="form-input" rows={3} placeholder="What is the deeper reason behind their health journey?" value={form.mainWhy} onChange={e => set('mainWhy', e.target.value)} style={{ resize: 'vertical' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Current Customer Status</label>
              <select id="nc-status" className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                {CUSTOMER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px', padding: '0 24px 24px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving} style={{ width: '40%' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="nc-submit-btn" style={{ width: '60%' }}>
              {saving ? '⏳ Saving...' : '✅ Create Customer Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
