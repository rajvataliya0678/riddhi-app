'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LanguageToggle from '@/components/LanguageToggle';

export default function DiagnosisPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuthGuard();
  const { user, refreshProfile, logout, t } = useAuth();

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
      const uid = user?.uid;
      if (!uid) {
        setError('User session expired. Please log in again.');
        setSubmitting(false);
        return;
      }
      
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

      await updateDoc(doc(db, 'users', uid), {
        registrationCompleted: true
      });

      await refreshProfile();
      router.replace('/dashboard');

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
        <p>{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="auth-wrapper" style={{ padding: '40px 20px' }}>
      <div className="decor-gradient"></div>
      
      <div className="auth-card" style={{ maxWidth: '600px' }}>
        {/* Language Toggle at top right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <LanguageToggle />
        </div>

        <div className="brand-header">
          <span className="brand-logo" id="app-logo">{t.brandName}</span>
          <h2>{t.diagTitle}</h2>
          <p className="brand-subtitle">{t.diagSub}</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="diagnosis-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="diag-age">{t.ageLabel}</label>
              <input
                type="number"
                id="diag-age"
                className="form-input"
                placeholder={t.agePlaceholder}
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-gender">{t.genderLabel}</label>
              <select
                id="diag-gender"
                className="form-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="female">{t.genderFemale}</option>
                <option value="male">{t.genderMale}</option>
                <option value="other">{t.genderOther}</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="diag-height">{t.heightLabel}</label>
              <input
                type="number"
                id="diag-height"
                className="form-input"
                placeholder={t.heightPlaceholder}
                min="50"
                max="250"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-weight">{t.weightLabel}</label>
              <input
                type="number"
                step="0.1"
                id="diag-weight"
                className="form-input"
                placeholder={t.weightPlaceholder}
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
              <label className="form-label" htmlFor="diag-goal-weight">{t.goalWeightLabel} <span style={{color:'var(--text-muted)',fontWeight:'400'}}>({t.optional})</span></label>
              <input
                type="number"
                step="0.1"
                id="diag-goal-weight"
                className="form-input"
                placeholder={t.goalWeightPlaceholder}
                min="10"
                max="300"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="diag-goal">{t.fitnessGoalLabel}</label>
              <select
                id="diag-goal"
                className="form-select"
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="Weight Loss">{t.goalWeightLoss}</option>
                <option value="Weight Gain">{t.goalWeightGain}</option>
                <option value="Maintenance">{t.goalMaintenance}</option>
                <option value="General Fitness">{t.goalFitness}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="diag-medical">{t.medicalHistoryLabel}</label>
            <textarea
              id="diag-medical"
              className="form-input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              placeholder={t.medicalHistoryPlaceholder}
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">{t.routineLabel}</label>
          </div>
          
          <div className="form-time-row">
            <div className="form-group">
              <label className="form-label" htmlFor="time-breakfast" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.breakfastTime}</label>
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
              <label className="form-label" htmlFor="time-lunch" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.lunchTime}</label>
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
              <label className="form-label" htmlFor="time-dinner" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.dinnerTime}</label>
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
              {t.cancelExitBtn}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              id="diagnosis-submit"
              disabled={submitting}
              style={{ width: '60%' }}
            >
              {submitting ? t.savingProfileBtn : t.completeRegistrationBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

