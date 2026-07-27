'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DiagnosisPage() {
  // Route guard: Redirects to login if not logged in, or dashboard if already completed diagnosis
  const { loading: authLoading } = useAuthGuard();
  const { user, refreshProfile, logout } = useAuth();

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('female');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('Weight Loss');
  
  const [breakfastTime, setBreakfastTime] = useState('08:00');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('20:00');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!age || !height || !weight) {
      setError('Please fill in Age, Height, and Weight.');
      return;
    }

    const ageNum = parseInt(age);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      setError('Please enter a valid age (1-120).');
      return;
    }

    if (isNaN(heightNum) || heightNum <= 50 || heightNum > 250) {
      setError('Please enter a valid height in cm (50-250).');
      return;
    }

    if (isNaN(weightNum) || weightNum <= 10 || weightNum > 300) {
      setError('Please enter a valid weight in kg (10-300).');
      return;
    }

    setSubmitting(true);

    try {
      const uid = user.uid;
      
      // 1. Save Diagnosis Details
      const diagnosisData = {
        uid,
        age: ageNum,
        gender,
        height: heightNum,
        initialWeight: weightNum,
        goalWeight: goalWeight ? parseFloat(goalWeight) : null,
        medicalHistory: medicalHistory.trim(),
        fitnessGoal,
        preferredTimes: {
          breakfast: breakfastTime,
          lunch: lunchTime,
          dinner: dinnerTime
        },
        submittedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'diagnosis', uid), diagnosisData);

      // 2. Add starting weight to weight history
      // Get today's local date string in YYYY-MM-DD format
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      await addDoc(collection(db, 'weight_history'), {
        uid,
        weight: weightNum,
        date: dateStr,
        createdAt: serverTimestamp()
      });

      // 3. Mark user registration as complete
      await updateDoc(doc(db, 'users', uid), {
        registrationCompleted: true
      });

      // 4. Refresh auth state profile so route guard redirects to dashboard
      await refreshProfile();

    } catch (err) {
      console.error("Error submitting diagnosis form:", err);
      setError('An error occurred while saving your profile. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="auth-wrapper">
        <div className="decor-gradient"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-wrapper" style={{ padding: '40px 20px' }}>
      <div className="decor-gradient"></div>
      
      <div className="auth-card" style={{ maxWidth: '600px' }}>
        <div className="brand-header">
          <span className="brand-logo" id="app-logo">Vriddhi</span>
          <h2>Diagnosis & Health Profile</h2>
          <p className="brand-subtitle">Help us customize your wellness roadmap. This is a one-time questionnaire.</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="diagnosis-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="diag-age">Age (years)</label>
              <input
                type="number"
                id="diag-age"
                className="form-input"
                placeholder="25"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-gender">Biological Gender</label>
              <select
                id="diag-gender"
                className="form-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="diag-height">Height (cm)</label>
              <input
                type="number"
                id="diag-height"
                className="form-input"
                placeholder="170"
                min="50"
                max="250"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-weight">Starting Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                id="diag-weight"
                className="form-input"
                placeholder="70.5"
                min="10"
                max="300"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="diag-goal-weight">Goal Weight (kg) <span style={{color:'var(--text-muted)',fontWeight:'400'}}>(optional)</span></label>
              <input
                type="number"
                step="0.1"
                id="diag-goal-weight"
                className="form-input"
                placeholder="e.g. 65.0"
                min="10"
                max="300"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-goal">Primary Fitness Goal</label>
            <select
              id="diag-goal"
              className="form-select"
              value={fitnessGoal}
              onChange={(e) => setFitnessGoal(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="Weight Loss">Weight Loss</option>
              <option value="Weight Gain">Weight Gain</option>
              <option value="Maintenance">Maintenance</option>
              <option value="General Fitness">General Fitness</option>
            </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="diag-medical">Medical History / Health Conditions</label>
            <textarea
              id="diag-medical"
              className="form-input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              placeholder="e.g. Asthma, High Blood Pressure, Knee injury, food allergies, or write 'None'"
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Preferred Daily Routine (Meal Times)</label>
          </div>
          
          <div className="form-time-row">
            <div className="form-group">
              <label className="form-label" htmlFor="time-breakfast" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Breakfast</label>
              <input
                type="time"
                id="time-breakfast"
                className="form-input"
                value={breakfastTime}
                onChange={(e) => setBreakfastTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="time-lunch" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lunch</label>
              <input
                type="time"
                id="time-lunch"
                className="form-input"
                value={lunchTime}
                onChange={(e) => setLunchTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="time-dinner" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dinner</label>
              <input
                type="time"
                id="time-dinner"
                className="form-input"
                value={dinnerTime}
                onChange={(e) => setDinnerTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => logout()}
              disabled={submitting}
              style={{ width: '40%' }}
            >
              Cancel & Exit
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              id="diagnosis-submit"
              disabled={submitting}
              style={{ width: '60%' }}
            >
              {submitting ? 'Saving Profile...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
