'use client';

import React, { useState } from 'react';
import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ConvertLeadModal({ lead, coachUid, onClose, onConverted }) {
  const [form, setForm] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: '',
    fitnessGoal: 'Weight Loss',
    initialWeight: '75',
    goalWeight: '68',
    height: '168',
    age: '28',
    gender: 'male',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Customer name required.'); return; }
    if (!form.phone.trim()) { setError('Phone number required.'); return; }

    setSaving(true);
    try {
      // 1. Generate unique user UID for the customer
      const userRef = doc(collection(db, 'users'));
      const customerUid = userRef.id;

      // 2. Create customer record in users collection
      await setDoc(userRef, {
        uid: customerUid,
        name: form.name.trim(),
        email: form.email.trim() || `${customerUid.substring(0, 8)}@vriddhi.local`,
        phone: form.phone.trim(),
        role: 'customer',
        coachId: coachUid,
        registrationCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Create initial diagnosis record
      await addDoc(collection(db, 'diagnosis'), {
        uid: customerUid,
        fitnessGoal: form.fitnessGoal,
        initialWeight: parseFloat(form.initialWeight) || 70,
        goalWeight: parseFloat(form.goalWeight) || 65,
        height: parseFloat(form.height) || 165,
        age: parseInt(form.age) || 25,
        gender: form.gender,
        createdAt: serverTimestamp(),
      });

      // 4. Initial weight history entry
      await addDoc(collection(db, 'weight_history'), {
        uid: customerUid,
        weight: parseFloat(form.initialWeight) || 70,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });

      // 5. Update CRM enquiry status to 'Closing' / 'Converted'
      if (lead?.id) {
        await updateDoc(doc(db, 'crm_enquiries', lead.id), {
          status: 'Closing',
          convertedCustomerUid: customerUid,
          updatedAt: serverTimestamp(),
        });
      }

      onConverted();
      onClose();
    } catch (err) {
      console.error('Convert lead error:', err);
      setError('Failed to convert lead to customer. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '540px', width: '94vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>🔄 Convert Lead to Customer</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Fill registration details to add {lead?.name || 'Lead'} as active customer
            </p>
          </div>
          <button onClick={onClose} className="modal-close" id="convert-lead-close">×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '12px 0 0' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input id="convert-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input id="convert-phone" className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} required />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Fitness Goal *</label>
              <select id="convert-goal" className="form-input" value={form.fitnessGoal} onChange={e => set('fitnessGoal', e.target.value)}>
                <option value="Weight Loss">🏋️ Weight Loss</option>
                <option value="Weight Gain">💪 Weight Gain</option>
                <option value="Fat Loss & Toning">🔥 Fat Loss & Toning</option>
                <option value="General Fitness">🏃 General Fitness</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select id="convert-gender" className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Initial Weight (kg) *</label>
              <input id="convert-initial-w" type="number" step="0.1" className="form-input" value={form.initialWeight} onChange={e => set('initialWeight', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Goal Weight (kg) *</label>
              <input id="convert-goal-w" type="number" step="0.1" className="form-input" value={form.goalWeight} onChange={e => set('goalWeight', e.target.value)} required />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Height (cm)</label>
              <input id="convert-height" type="number" className="form-input" value={form.height} onChange={e => set('height', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input id="convert-age" type="number" className="form-input" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="convert-lead-submit-btn" style={{ width: 'auto' }}>
              {saving ? '⏳ Converting...' : '🎉 Register & Convert Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
