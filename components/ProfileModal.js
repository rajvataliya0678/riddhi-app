'use client';

import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const FITNESS_GOALS = ['Weight Loss', 'Weight Gain', 'Maintenance', 'General Fitness'];

export default function ProfileModal({ user, userData, diagnosis, onClose, onSaved }) {
  // User fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Diagnosis fields
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('female');
  const [height, setHeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('Weight Loss');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [breakfastTime, setBreakfastTime] = useState('08:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('20:00');

  const [activeSection, setActiveSection] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Populate form from existing data
  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
    }
    if (diagnosis) {
      setAge(diagnosis.age?.toString() || '');
      setGender(diagnosis.gender || 'female');
      setHeight(diagnosis.height?.toString() || '');
      setGoalWeight(diagnosis.goalWeight?.toString() || '');
      setFitnessGoal(diagnosis.fitnessGoal || 'Weight Loss');
      setMedicalHistory(diagnosis.medicalHistory || '');
      setBreakfastTime(diagnosis.preferredTimes?.breakfast || '08:00');
      setLunchTime(diagnosis.preferredTimes?.lunch || '13:00');
      setDinnerTime(diagnosis.preferredTimes?.dinner || '20:00');
    }
  }, [userData, diagnosis]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!name.trim()) { setError('Name is required.'); return; }

    const ageNum = parseInt(age);
    const heightNum = parseFloat(height);

    if (age && (isNaN(ageNum) || ageNum <= 0 || ageNum > 120)) {
      setError('Enter a valid age (1–120).'); return;
    }
    if (height && (isNaN(heightNum) || heightNum < 50 || heightNum > 250)) {
      setError('Enter a valid height (50–250 cm).'); return;
    }

    setSaving(true);
    try {
      // 1. Update users collection
      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        phone: phone.trim(),
      });

      // 2. Update diagnosis collection
      await setDoc(doc(db, 'diagnosis', user.uid), {
        uid: user.uid,
        age: ageNum || diagnosis?.age,
        gender,
        height: heightNum || diagnosis?.height,
        initialWeight: diagnosis?.initialWeight,
        goalWeight: goalWeight ? parseFloat(goalWeight) : null,
        fitnessGoal,
        medicalHistory: medicalHistory.trim(),
        preferredTimes: {
          breakfast: breakfastTime,
          lunch: lunchTime,
          dinner: dinnerTime,
        },
        submittedAt: diagnosis?.submittedAt,
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'personal', label: '👤 Personal' },
    { id: 'health', label: '💪 Health' },
    { id: 'routine', label: '🕐 Routine' },
  ];

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div className="profile-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="profile-avatar-lg">
              {name ? name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Edit Profile</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{userData?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                background: activeSection === s.id ? 'var(--primary)' : 'transparent',
                color: activeSection === s.id ? 'var(--text-inverse)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: activeSection === s.id ? 'var(--primary)' : 'var(--border-color)',
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {error && <div className="alert alert-danger">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✓ {success}</div>}

        {/* Personal Section */}
        {activeSection === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Full Name</label>
                <input id="edit-name" type="text" className="form-input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-phone">Phone Number</label>
                <input id="edit-phone" type="tel" className="form-input" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-gender">Biological Gender</label>
                <select id="edit-gender" className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-age">Age (years)</label>
                <input id="edit-age" type="number" className="form-input" value={age}
                  onChange={e => setAge(e.target.value)} placeholder="25" min="1" max="120" />
              </div>
            </div>
          </div>
        )}

        {/* Health Section */}
        {activeSection === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-height">Height (cm)</label>
                <input id="edit-height" type="number" className="form-input" value={height}
                  onChange={e => setHeight(e.target.value)} placeholder="170" min="50" max="250" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-goal-weight">Goal Weight (kg)</label>
                <input id="edit-goal-weight" type="number" step="0.1" className="form-input" value={goalWeight}
                  onChange={e => setGoalWeight(e.target.value)} placeholder="65.0" min="10" max="300" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-fitness-goal">Primary Fitness Goal</label>
              <select id="edit-fitness-goal" className="form-select" value={fitnessGoal} onChange={e => setFitnessGoal(e.target.value)}>
                {FITNESS_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-medical">Medical History / Health Conditions</label>
              <textarea id="edit-medical" className="form-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="e.g. Asthma, High BP, or 'None'"
                value={medicalHistory}
                onChange={e => setMedicalHistory(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Routine Section */}
        {activeSection === 'routine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Set your preferred meal times. This helps personalize your wellness routine.
            </p>
            <div className="form-time-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-breakfast">🍳 Breakfast</label>
                <input id="edit-breakfast" type="time" className="form-input" value={breakfastTime}
                  onChange={e => setBreakfastTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-lunch">🍱 Lunch</label>
                <input id="edit-lunch" type="time" className="form-input" value={lunchTime}
                  onChange={e => setLunchTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-dinner">🍽️ Dinner</label>
                <input id="edit-dinner" type="time" className="form-input" value={dinnerTime}
                  onChange={e => setDinnerTime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} className="btn btn-outline" style={{ width: '35%' }} disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary" style={{ width: '65%' }} disabled={saving} id="profile-save-btn">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
