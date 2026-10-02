'use client';

import React, { useState, useEffect } from 'react';
import { doc, setDoc, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { User, Dumbbell, Clock4, Settings2, X, UtensilsCrossed } from 'lucide-react';

const FITNESS_GOALS = ['Weight Loss', 'Weight Gain', 'Maintenance', 'General Fitness'];

export default function ProfileModal({ user, userData, diagnosis, onClose, onSaved }) {
  const { changeLanguage } = useAuth();

  // User fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLang, setPreferredLang] = useState('en');

  // Diagnosis fields
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('female');
  const [height, setHeight] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
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
      setPreferredLang(userData.preferredLanguage || 'en');
    }
    if (diagnosis) {
      setAge(diagnosis.age?.toString() || '');
      setGender(diagnosis.gender || 'female');
      setHeight(diagnosis.height?.toString() || '');
      setInitialWeight(diagnosis.initialWeight?.toString() || '');
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
    const initWeightNum = parseFloat(initialWeight);
    const goalWeightNum = parseFloat(goalWeight);

    if (age && (isNaN(ageNum) || ageNum <= 0 || ageNum > 120)) {
      setError('Enter a valid age (1–120).'); return;
    }
    if (height && (isNaN(heightNum) || heightNum < 50 || heightNum > 250)) {
      setError('Enter a valid height (50–250 cm).'); return;
    }
    if (initialWeight && (isNaN(initWeightNum) || initWeightNum < 10 || initWeightNum > 300)) {
      setError('Enter a valid starting weight (10–300 kg).'); return;
    }
    if (goalWeight && (isNaN(goalWeightNum) || goalWeightNum < 10 || goalWeightNum > 300)) {
      setError('Enter a valid goal weight (10–300 kg).'); return;
    }

    setSaving(true);
    try {
      // 1. Update users collection (using setDoc merge to safely handle both existing and new user records)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name.trim(),
        phone: phone.trim(),
        preferredLanguage: preferredLang || 'en',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. Prepare diagnosis collection payload without any undefined values
      const diagPayload = {
        uid: user.uid,
        gender: gender || 'female',
        fitnessGoal: fitnessGoal || 'Weight Loss',
        medicalHistory: (medicalHistory || '').trim(),
        preferredTimes: {
          breakfast: breakfastTime || '08:00',
          lunch: lunchTime || '13:00',
          dinner: dinnerTime || '20:00',
        },
        updatedAt: serverTimestamp(),
      };

      if (!isNaN(ageNum) && ageNum > 0) {
        diagPayload.age = ageNum;
      } else if (diagnosis?.age) {
        diagPayload.age = diagnosis.age;
      }

      if (!isNaN(heightNum) && heightNum > 0) {
        diagPayload.height = heightNum;
      } else if (diagnosis?.height) {
        diagPayload.height = diagnosis.height;
      }

      if (!isNaN(initWeightNum) && initWeightNum > 0) {
        diagPayload.initialWeight = initWeightNum;
      } else if (diagnosis?.initialWeight) {
        diagPayload.initialWeight = diagnosis.initialWeight;
      }

      if (!isNaN(goalWeightNum) && goalWeightNum > 0) {
        diagPayload.goalWeight = goalWeightNum;
      } else if (diagnosis?.goalWeight) {
        diagPayload.goalWeight = diagnosis.goalWeight;
      }

      if (diagnosis?.submittedAt) {
        diagPayload.submittedAt = diagnosis.submittedAt;
      } else {
        diagPayload.submittedAt = serverTimestamp();
      }

      const targetDocId = diagnosis?.docId || user.uid;
      await setDoc(doc(db, 'diagnosis', targetDocId), diagPayload, { merge: true });

      // If starting weight was entered and user has no weight history yet, add the first entry
      if (!isNaN(initWeightNum) && initWeightNum > 0) {
        try {
          const weightSnap = await getDocs(query(collection(db, 'weight_history'), where('uid', '==', user.uid)));
          if (weightSnap.empty) {
            const today = new Date();
            const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            await addDoc(collection(db, 'weight_history'), {
              uid: user.uid,
              weight: initWeightNum,
              date: todayDateStr,
              createdAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.warn('Could not auto-add initial weight history:', e);
        }
      }

      setSuccess('Profile & Settings updated successfully!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err?.message ? `Failed to save: ${err.message}` : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'personal', Icon: User,     label: 'Personal' },
    { id: 'health',   Icon: Dumbbell, label: 'Health' },
    { id: 'routine',  Icon: Clock4,   label: 'Routine' },
    { id: 'settings', Icon: Settings2,label: 'Settings' },
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
              <h3 style={{ margin: 0 }}>Edit Profile & Settings</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{userData?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close"><X size={14} /></button>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', overflowX: 'auto' }}>
          {sections.map(s => {
            const IconComp = s.Icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  background: activeSection === s.id ? 'var(--primary)' : 'transparent',
                  color: activeSection === s.id ? 'var(--text-inverse)' : 'var(--text-muted)',
                  border: '1.5px solid',
                  borderColor: activeSection === s.id ? 'var(--primary)' : 'var(--border-color)',
                  borderRadius: '20px',
                  padding: '5px 14px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: activeSection === s.id ? '0 2px 10px rgba(5,150,105,0.25)' : 'none',
                }}
              >
                {IconComp && <IconComp size={13} />}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {error   && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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
                <label className="form-label" htmlFor="edit-initial-weight">Starting Weight (kg)</label>
                <input id="edit-initial-weight" type="number" step="0.1" className="form-input" value={initialWeight}
                  onChange={e => setInitialWeight(e.target.value)} placeholder="70.0" min="10" max="300" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-goal-weight">Goal Weight (kg)</label>
                <input id="edit-goal-weight" type="number" step="0.1" className="form-input" value={goalWeight}
                  onChange={e => setGoalWeight(e.target.value)} placeholder="65.0" min="10" max="300" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-fitness-goal">Primary Fitness Goal</label>
                <select id="edit-fitness-goal" className="form-select" value={fitnessGoal} onChange={e => setFitnessGoal(e.target.value)}>
                  {FITNESS_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
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

        {/* Settings / Language Section */}
        {activeSection === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '700' }}>🌐 Preferred App Language / પસંદગીની ભાષા</label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 12px' }}>
                Choose your preferred language for the Vriddhi App
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setPreferredLang('en'); changeLanguage('en'); }}
                  style={{
                    padding: '12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800',
                    border: preferredLang === 'en' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: preferredLang === 'en' ? 'var(--primary-light)' : 'var(--card-bg)',
                    color: preferredLang === 'en' ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => { setPreferredLang('gu'); changeLanguage('gu'); }}
                  style={{
                    padding: '12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800',
                    border: preferredLang === 'gu' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: preferredLang === 'gu' ? 'var(--primary-light)' : 'var(--card-bg)',
                    color: preferredLang === 'gu' ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  🇮🇳 ગુજરાતી (Gujarati)
                </button>
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
