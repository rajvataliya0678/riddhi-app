'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Scale Input Component ────────────────────────────────
function ScaleInput({ id, value, onChange, min = 1, max = 10, label }) {
  return (
    <div className="scale-input-wrap">
      <div className="scale-bubbles">
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const val = min + i;
          return (
            <button
              key={val}
              type="button"
              className={`scale-bubble ${value === val ? 'selected' : ''}`}
              onClick={() => onChange(val)}
              id={`${id}-${val}`}
            >
              {val}
            </button>
          );
        })}
      </div>
      {value && <span className="scale-value-display">{value} / {max}</span>}
    </div>
  );
}

// ── Multi-Select Component ───────────────────────────────
function MultiSelect({ id, options, value = [], onChange }) {
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div className="multiselect-wrap">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          className={`multiselect-chip ${value.includes(opt) ? 'selected' : ''}`}
          onClick={() => toggle(opt)}
          id={`${id}-${opt.replace(/\s/g, '-')}`}
        >
          {value.includes(opt) ? '✓ ' : ''}{opt}
        </button>
      ))}
    </div>
  );
}

// ── Field Renderer ───────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="followup-field">
      <label className="followup-field-label">
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{hint}</p>}
      {children}
    </div>
  );
}

// ── Common Check-in Section ──────────────────────────────
function CommonCheckinSection({ data = {}, setData, startingWeight, dayNum }) {
  const setField = (field, val) => setData(prev => ({ ...prev, [field]: val }));

  const currentWeight = parseFloat(data.todaysWeight) || 0;
  const startW = parseFloat(startingWeight) || 0;
  let weightDiffText = '';
  if (currentWeight > 0 && startW > 0) {
    const diff = (startW - currentWeight).toFixed(1);
    weightDiffText = diff > 0 ? `🔥 -${diff} kg lost since start` : diff < 0 ? `💪 +${Math.abs(diff)} kg gained` : `⚖️ Same as starting weight`;
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px'
    }}>
      <div className="followup-section-title" style={{ marginBottom: '12px', fontSize: '0.88rem' }}>
        📊 Day {dayNum} Daily Check-In
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Today's Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            className="form-input"
            placeholder="e.g. 72.5"
            value={data.todaysWeight || ''}
            onChange={e => setField('todaysWeight', e.target.value)}
            id="checkin-weight-input"
          />
          {weightDiffText && (
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--primary)', marginTop: '4px', display: 'block' }}>
              {weightDiffText}
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Water Intake Today</label>
          <select
            className="form-input"
            value={data.waterIntake || ''}
            onChange={e => setField('waterIntake', e.target.value)}
            id="checkin-water-select"
          >
            <option value="">Select Water Intake</option>
            <option value="1-2 Liters">💧 1-2 Liters</option>
            <option value="2-3 Liters">💧💧 2-3 Liters</option>
            <option value="3-4 Liters">💧💧💧 3-4 Liters</option>
            <option value="4+ Liters">💧💧💧💧 4+ Liters</option>
          </select>
        </div>
      </div>

      <div className="form-row-2" style={{ marginTop: '10px' }}>
        <div className="form-group">
          <label className="form-label">Meal Plan Adherence</label>
          <select
            className="form-input"
            value={data.mealAdherence || ''}
            onChange={e => setField('mealAdherence', e.target.value)}
            id="checkin-meal-select"
          >
            <option value="">Select Adherence</option>
            <option value="100% Followed">🥗 100% Followed</option>
            <option value="80% Followed">🥗 80% Followed</option>
            <option value="50% Followed">🥗 50% Followed</option>
            <option value="Cheated / Off Plan">🍕 Off Plan</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Energy Level (1-10)</label>
          <ScaleInput
            id="checkin-energy"
            value={data.energyLevel || 7}
            onChange={val => setField('energyLevel', val)}
            min={1}
            max={10}
          />
        </div>
      </div>
    </div>
  );
}

// ── Day-Specific Form Sections ─────────────────────────

function Day1Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const CHANGE_OPTS = ['Energy', 'Confidence', 'Clothes Fitting', 'Better Look', 'Stamina', 'Healthy Routine', 'Fitness', 'Better Sleep', 'Other'];
  return (
    <div>
      <Field label="1. તમે આ journey start કરવાનો નિર્ણય કેમ લીધો?" required>
        <textarea className="form-input" rows={3} value={data.journeyReason || ''} onChange={e => s('journeyReason', e.target.value)} placeholder="Customer ના exact words લખો..." style={{ resize: 'vertical' }} id="d1-journey-reason" />
      </Field>
      <Field label="2. Weight સિવાય કયો change જોઈએ છે?">
        <MultiSelect id="d1-desired-changes" options={CHANGE_OPTS} value={data.desiredChanges || []} onChange={v => s('desiredChanges', v)} />
      </Field>
      <Field label="3. હાલની problem તમને સૌથી વધારે ક્યારે feel થાય છે?">
        <textarea className="form-input" rows={3} value={data.problemFeelTime || ''} onChange={e => s('problemFeelTime', e.target.value)} style={{ resize: 'vertical' }} id="d1-problem-feel" />
      </Field>
      <Field label="4. પહેલાં તમે શું શું try કર્યું છે?">
        <textarea className="form-input" rows={3} value={data.pastAttempts || ''} onChange={e => s('pastAttempts', e.target.value)} style={{ resize: 'vertical' }} id="d1-past-attempts" />
      </Field>
      <Field label="5. જો 3 મહિનામાં desired result આવી જાય તો life માં શું change આવશે?">
        <textarea className="form-input" rows={3} value={data.lifeChange3Months || ''} onChange={e => s('lifeChange3Months', e.target.value)} style={{ resize: 'vertical' }} id="d1-life-change" />
      </Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>📝 Coach Notes</div>
        <Field label="Customer Emotional WHY">
          <textarea className="form-input" rows={2} value={data.emotionalWhy || ''} onChange={e => s('emotionalWhy', e.target.value)} style={{ resize: 'vertical' }} id="d1-emotional-why" />
        </Field>
        <Field label="Customer Pain Point">
          <textarea className="form-input" rows={2} value={data.painPoint || ''} onChange={e => s('painPoint', e.target.value)} style={{ resize: 'vertical' }} id="d1-pain-point" />
        </Field>
        <Field label="Dream Outcome">
          <textarea className="form-input" rows={2} value={data.dreamOutcome || ''} onChange={e => s('dreamOutcome', e.target.value)} style={{ resize: 'vertical' }} id="d1-dream-outcome" />
        </Field>
        <Field label="Coach Connection Notes">
          <textarea className="form-input" rows={2} value={data.connectionNotes || ''} onChange={e => s('connectionNotes', e.target.value)} style={{ resize: 'vertical' }} id="d1-connection-notes" />
        </Field>
      </div>
    </div>
  );
}

function Day2Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const OUTSIDE_FREQ = ['Rare', '1–2 times/week', '3–4 times/week', 'Daily'];
  return (
    <div>
      <div className="form-row-2">
        <Field label="Wake-up Time"><input type="time" className="form-input" value={data.wakeTime || ''} onChange={e => s('wakeTime', e.target.value)} id="d2-wake-time" /></Field>
        <Field label="Breakfast Time"><input type="time" className="form-input" value={data.breakfastTime || ''} onChange={e => s('breakfastTime', e.target.value)} id="d2-breakfast-time" /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Lunch Time"><input type="time" className="form-input" value={data.lunchTime || ''} onChange={e => s('lunchTime', e.target.value)} id="d2-lunch-time" /></Field>
        <Field label="Evening Snack Time"><input type="time" className="form-input" value={data.eveningSnackTime || ''} onChange={e => s('eveningSnackTime', e.target.value)} id="d2-snack-time" /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Dinner Time"><input type="time" className="form-input" value={data.dinnerTime || ''} onChange={e => s('dinnerTime', e.target.value)} id="d2-dinner-time" /></Field>
        <Field label="Sleep Time"><input type="time" className="form-input" value={data.sleepTime || ''} onChange={e => s('sleepTime', e.target.value)} id="d2-sleep-time" /></Field>
      </div>
      <Field label="Work Timing"><input className="form-input" value={data.workTiming || ''} onChange={e => s('workTiming', e.target.value)} placeholder="e.g. 9 AM – 6 PM" id="d2-work-timing" /></Field>
      <Field label="Outside Food Frequency">
        <select className="form-input" value={data.outsideFoodFreq || ''} onChange={e => s('outsideFoodFreq', e.target.value)} id="d2-outside-food">
          <option value="">Select...</option>
          {OUTSIDE_FREQ.map(f => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Maximum Hunger Timing"><input className="form-input" value={data.maxHungerTime || ''} onChange={e => s('maxHungerTime', e.target.value)} placeholder="e.g. 4–6 PM" id="d2-hunger-time" /></Field>
      <Field label="Most Stressful Time"><input className="form-input" value={data.stressfulTime || ''} onChange={e => s('stressfulTime', e.target.value)} id="d2-stress-time" /></Field>
      <Field label="Weekend Routine Different?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.weekendDiff === opt ? 'selected' : ''}`} onClick={() => s('weekendDiff', opt)} id={`d2-weekend-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      {data.weekendDiff === 'Yes' && (
        <Field label="Weekend Routine Notes">
          <textarea className="form-input" rows={3} value={data.weekendNotes || ''} onChange={e => s('weekendNotes', e.target.value)} style={{ resize: 'vertical' }} id="d2-weekend-notes" />
        </Field>
      )}
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Analysis</div>
        <Field label="Main Danger Zone" hint="e.g. 5–7 PM craving / Late-night eating"><input className="form-input" value={data.mainDangerZone || ''} onChange={e => s('mainDangerZone', e.target.value)} id="d2-danger-zone" /></Field>
        <Field label="Main Routine Strength"><input className="form-input" value={data.routineStrength || ''} onChange={e => s('routineStrength', e.target.value)} id="d2-strength" /></Field>
        <Field label="Main Routine Weakness"><input className="form-input" value={data.routineWeakness || ''} onChange={e => s('routineWeakness', e.target.value)} id="d2-weakness" /></Field>
        <Field label="One Change For Tomorrow"><input className="form-input" value={data.tomorrowChange || ''} onChange={e => s('tomorrowChange', e.target.value)} id="d2-tomorrow-change" /></Field>
      </div>
    </div>
  );
}

function Day3Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const CRAVINGS = ['Sweet', 'Salty', 'Fried Food', 'Fast Food', 'Tea/Coffee', 'Late-night Food', 'Large Quantity', 'Other'];
  const OVEREAT_REASONS = ['Real Hunger', 'Stress', 'Boredom', 'Social Situation', 'Habit', 'Emotional Eating', 'Family Pressure', 'Other'];
  return (
    <div>
      <Field label="Favourite Food"><input className="form-input" value={data.favouriteFood || ''} onChange={e => s('favouriteFood', e.target.value)} id="d3-fav-food" /></Field>
      <Field label="Most Common Craving">
        <MultiSelect id="d3-cravings" options={CRAVINGS} value={data.cravings || []} onChange={v => s('cravings', v)} />
      </Field>
      <Field label="Craving Time"><input className="form-input" value={data.cravingTime || ''} onChange={e => s('cravingTime', e.target.value)} placeholder="e.g. 4 PM, After dinner" id="d3-craving-time" /></Field>
      <Field label="Why do you usually overeat?">
        <MultiSelect id="d3-overeat" options={OVEREAT_REASONS} value={data.overeatingReasons || []} onChange={v => s('overeatingReasons', v)} />
      </Field>
      <Field label="Food you don't want to completely stop"><input className="form-input" value={data.keepFood || ''} onChange={e => s('keepFood', e.target.value)} id="d3-keep-food" /></Field>
      <Field label="Who influences your food choices most?"><input className="form-input" value={data.foodInfluencer || ''} onChange={e => s('foodInfluencer', e.target.value)} id="d3-food-influencer" /></Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Analysis</div>
        <Field label="Biggest Food Challenge"><textarea className="form-input" rows={2} value={data.foodChallenge || ''} onChange={e => s('foodChallenge', e.target.value)} style={{ resize: 'vertical' }} id="d3-food-challenge" /></Field>
        <Field label="Main Food Trigger"><input className="form-input" value={data.foodTrigger || ''} onChange={e => s('foodTrigger', e.target.value)} id="d3-food-trigger" /></Field>
        <Field label="Coach Recommendation For Tomorrow"><input className="form-input" value={data.coachRecommendation || ''} onChange={e => s('coachRecommendation', e.target.value)} id="d3-recommendation" /></Field>
      </div>
    </div>
  );
}

function Day4Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const COACHING_STYLES = ['Strict', 'Friendly', 'Motivational', 'Direct Feedback', 'Soft Guidance', 'Mix'];
  return (
    <div>
      <Field label="Current Goal Seriousness (1-10)">
        <ScaleInput id="d4-seriousness" value={data.goalSeriousness} onChange={v => s('goalSeriousness', v)} />
      </Field>
      <Field label="Why did you select this score?">
        <textarea className="form-input" rows={3} value={data.scoreReason || ''} onChange={e => s('scoreReason', e.target.value)} style={{ resize: 'vertical' }} id="d4-score-reason" />
      </Field>
      <Field label="What will increase this score by 1 point?">
        <textarea className="form-input" rows={2} value={data.scoreImprove || ''} onChange={e => s('scoreImprove', e.target.value)} style={{ resize: 'vertical' }} id="d4-score-improve" />
      </Field>
      <Field label="Past Achievement They Are Proud Of">
        <textarea className="form-input" rows={3} value={data.pastAchievement || ''} onChange={e => s('pastAchievement', e.target.value)} style={{ resize: 'vertical' }} id="d4-past-achievement" />
      </Field>
      <Field label="Preferred Coaching Style">
        <select className="form-input" value={data.coachingStyle || ''} onChange={e => s('coachingStyle', e.target.value)} id="d4-coaching-style">
          <option value="">Select...</option>
          {COACHING_STYLES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Can coach directly correct you when you make a mistake?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.directCorrection === opt ? 'selected' : ''}`} onClick={() => s('directCorrection', opt)} id={`d4-correct-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <Field label="Current Confidence Level (1-10)">
        <ScaleInput id="d4-confidence" value={data.confidenceLevel} onChange={v => s('confidenceLevel', v)} />
      </Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Analysis</div>
        <Field label="Biggest Motivation"><input className="form-input" value={data.biggestMotivation || ''} onChange={e => s('biggestMotivation', e.target.value)} id="d4-motivation" /></Field>
        <Field label="Biggest Mental Barrier"><input className="form-input" value={data.mentalBarrier || ''} onChange={e => s('mentalBarrier', e.target.value)} id="d4-barrier" /></Field>
        <Field label="Coach Motivation Notes"><textarea className="form-input" rows={2} value={data.motivationNotes || ''} onChange={e => s('motivationNotes', e.target.value)} style={{ resize: 'vertical' }} id="d4-motivation-notes" /></Field>
      </div>
    </div>
  );
}

function Day5Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  return (
    <div>
      <Field label="Occupation / Business"><input className="form-input" value={data.occupation || ''} onChange={e => s('occupation', e.target.value)} id="d5-occupation" /></Field>
      <Field label="What do you enjoy doing?">
        <textarea className="form-input" rows={2} value={data.enjoyDoing || ''} onChange={e => s('enjoyDoing', e.target.value)} style={{ resize: 'vertical' }} id="d5-enjoy" />
      </Field>
      <Field label="Hobbies / Interests"><input className="form-input" value={data.hobbies || ''} onChange={e => s('hobbies', e.target.value)} id="d5-hobbies" /></Field>
      <Field label="Family Details">
        <textarea className="form-input" rows={2} value={data.familyDetails || ''} onChange={e => s('familyDetails', e.target.value)} style={{ resize: 'vertical' }} id="d5-family" />
      </Field>
      <Field label="Who are you closest to in family?"><input className="form-input" value={data.closestFamilyMember || ''} onChange={e => s('closestFamilyMember', e.target.value)} id="d5-closest" /></Field>
      <Field label="Top Life Priorities">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', minWidth: '16px' }}>{n}.</span>
              <input className="form-input" value={data[`priority${n}`] || ''} onChange={e => s(`priority${n}`, e.target.value)} placeholder={`Priority ${n}`} id={`d5-priority-${n}`} />
            </div>
          ))}
        </div>
      </Field>
      <Field label="What makes you happiest?">
        <textarea className="form-input" rows={2} value={data.happiest || ''} onChange={e => s('happiest', e.target.value)} style={{ resize: 'vertical' }} id="d5-happiest" />
      </Field>
      <Field label="2–3 Year Personal Dream">
        <textarea className="form-input" rows={2} value={data.personalDream || ''} onChange={e => s('personalDream', e.target.value)} style={{ resize: 'vertical' }} id="d5-dream" />
      </Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Notes</div>
        <Field label="Important People In Their Life"><input className="form-input" value={data.importantPeople || ''} onChange={e => s('importantPeople', e.target.value)} id="d5-important-people" /></Field>
        <Field label="Important Upcoming Event" hint="e.g. Marriage / Birthday / Trip / Function / Career Goal"><input className="form-input" value={data.upcomingEvent || ''} onChange={e => s('upcomingEvent', e.target.value)} id="d5-event" /></Field>
        <Field label="Relationship Notes For Future Conversations"><textarea className="form-input" rows={2} value={data.relationshipNotes || ''} onChange={e => s('relationshipNotes', e.target.value)} style={{ resize: 'vertical' }} id="d5-relationship-notes" /></Field>
      </div>
    </div>
  );
}

function Day6Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const CHANGES = ['Weight', 'Energy', 'Hunger Control', 'Better Routine', 'Better Sleep', 'Confidence', 'Clothes Fitting', 'Digestion', 'Discipline', 'Other'];
  return (
    <div>
      <Field label="Changes Customer Has Noticed">
        <MultiSelect id="d6-changes" options={CHANGES} value={data.noticedChanges || []} onChange={v => s('noticedChanges', v)} />
      </Field>
      <Field label="Biggest Improvement">
        <textarea className="form-input" rows={3} value={data.biggestImprovement || ''} onChange={e => s('biggestImprovement', e.target.value)} style={{ resize: 'vertical' }} id="d6-biggest-improvement" />
      </Field>
      <Field label="Proudest Moment In Last 6 Days">
        <textarea className="form-input" rows={3} value={data.proudestMoment || ''} onChange={e => s('proudestMoment', e.target.value)} style={{ resize: 'vertical' }} id="d6-proudest" />
      </Field>
      <Field label="Has anyone else noticed the change?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.othersNoticed === opt ? 'selected' : ''}`} onClick={() => s('othersNoticed', opt)} id={`d6-noticed-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      {data.othersNoticed === 'Yes' && (
        <>
          <Field label="Who noticed it?"><input className="form-input" value={data.whoNoticed || ''} onChange={e => s('whoNoticed', e.target.value)} id="d6-who-noticed" /></Field>
          <Field label="What did they say?">
            <textarea className="form-input" rows={2} value={data.whatTheySaid || ''} onChange={e => s('whatTheySaid', e.target.value)} style={{ resize: 'vertical' }} id="d6-what-said" />
          </Field>
        </>
      )}
      <Field label="Customer Satisfaction Level (1-10)">
        <ScaleInput id="d6-satisfaction" value={data.satisfactionLevel} onChange={v => s('satisfactionLevel', v)} />
      </Field>
      <Field label="Customer Belief In Program (1-10)">
        <ScaleInput id="d6-belief" value={data.beliefInProgram} onChange={v => s('beliefInProgram', v)} />
      </Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Notes</div>
        <Field label="Best Result Story Point"><textarea className="form-input" rows={2} value={data.storyPoint || ''} onChange={e => s('storyPoint', e.target.value)} style={{ resize: 'vertical' }} id="d6-story-point" /></Field>
        <Field label="Possible Testimonial Later?">
          <div style={{ display: 'flex', gap: '10px' }}>
            {['Yes', 'Maybe', 'No'].map(opt => (
              <button key={opt} type="button" className={`multiselect-chip ${data.testimonialPossible === opt ? 'selected' : ''}`} onClick={() => s('testimonialPossible', opt)} id={`d6-testimonial-${opt.toLowerCase()}`}>{opt}</button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Day7Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const ReferenceBlock = ({ num, required }) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>Reference {num} {!required && '(Optional)'}</div>
      <Field label="Name"><input className="form-input" value={data[`ref${num}Name`] || ''} onChange={e => s(`ref${num}Name`, e.target.value)} id={`d7-ref${num}-name`} /></Field>
      <Field label="Relationship"><input className="form-input" value={data[`ref${num}Relation`] || ''} onChange={e => s(`ref${num}Relation`, e.target.value)} id={`d7-ref${num}-relation`} /></Field>
      <Field label="Possible Goal / Problem"><input className="form-input" value={data[`ref${num}Goal`] || ''} onChange={e => s(`ref${num}Goal`, e.target.value)} id={`d7-ref${num}-goal`} /></Field>
      <Field label="Customer Comfortable Introducing?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'Maybe', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data[`ref${num}Comfortable`] === opt ? 'selected' : ''}`} onClick={() => s(`ref${num}Comfortable`, opt)} id={`d7-ref${num}-comfortable-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <Field label="Contact Shared?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data[`ref${num}ContactShared`] === opt ? 'selected' : ''}`} onClick={() => s(`ref${num}ContactShared`, opt)} id={`d7-ref${num}-contact-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
    </div>
  );
  return (
    <div>
      <Field label="Has anyone asked what you are doing?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.anyoneAsked === opt ? 'selected' : ''}`} onClick={() => s('anyoneAsked', opt)} id={`d7-asked-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      {data.anyoneAsked === 'Yes' && (
        <>
          <Field label="Who Asked?"><input className="form-input" value={data.whoAsked || ''} onChange={e => s('whoAsked', e.target.value)} id="d7-who-asked" /></Field>
          <Field label="What Did They Ask?"><textarea className="form-input" rows={2} value={data.whatAsked || ''} onChange={e => s('whatAsked', e.target.value)} style={{ resize: 'vertical' }} id="d7-what-asked" /></Field>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <ReferenceBlock num={1} required />
        <ReferenceBlock num={2} required={false} />
        <ReferenceBlock num={3} required={false} />
      </div>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Follow-up</div>
        <Field label="Reference Follow-up Required?">
          <div style={{ display: 'flex', gap: '10px' }}>
            {['Yes', 'No'].map(opt => (
              <button key={opt} type="button" className={`multiselect-chip ${data.referenceFollowUpRequired === opt ? 'selected' : ''}`} onClick={() => s('referenceFollowUpRequired', opt)} id={`d7-followup-${opt.toLowerCase()}`}>{opt}</button>
            ))}
          </div>
        </Field>
        {data.referenceFollowUpRequired === 'Yes' && (
          <Field label="Reference Follow-up Date"><input type="date" className="form-input" value={data.referenceFollowUpDate || ''} onChange={e => s('referenceFollowUpDate', e.target.value)} id="d7-followup-date" /></Field>
        )}
        <Field label="Coach Note"><textarea className="form-input" rows={2} value={data.coachNote || ''} onChange={e => s('coachNote', e.target.value)} style={{ resize: 'vertical' }} id="d7-coach-note" /></Field>
      </div>
    </div>
  );
}

function Day8Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const traits = [
    { key: 'sharesJourney', label: 'Do they enjoy sharing their journey?' },
    { key: 'comfortableTalking', label: 'Comfortable talking to people?' },
    { key: 'helpingNature', label: 'Helping Nature' },
    { key: 'communication', label: 'Communication' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'positiveAttitude', label: 'Positive Attitude' },
    { key: 'learningAttitude', label: 'Learning Attitude' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'peopleConnection', label: 'People Connection' },
  ];
  const COACH_POTENTIAL = ['Low', 'Medium', 'High', 'Not Enough Information'];
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {traits.map(t => (
          <Field key={t.key} label={`${t.label} (1–5)`}>
            <ScaleInput id={`d8-${t.key}`} value={data[t.key]} onChange={v => s(t.key, v)} min={1} max={5} />
          </Field>
        ))}
      </div>
      <Field label="Do people normally ask them for advice?">
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.peopleAskAdvice === opt ? 'selected' : ''}`} onClick={() => s('peopleAskAdvice', opt)} id={`d8-advice-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <Field label="Would they enjoy helping someone get results?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'Maybe', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.enjoyHelpingOthers === opt ? 'selected' : ''}`} onClick={() => s('enjoyHelpingOthers', opt)} id={`d8-helping-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Assessment</div>
        <Field label="Coach Potential">
          <select className="form-input" value={data.coachPotential || ''} onChange={e => s('coachPotential', e.target.value)} id="d8-coach-potential">
            <option value="">Select...</option>
            {COACH_POTENTIAL.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Coach Observation"><textarea className="form-input" rows={3} value={data.coachObservation || ''} onChange={e => s('coachObservation', e.target.value)} style={{ resize: 'vertical' }} id="d8-coach-obs" /></Field>
      </div>
    </div>
  );
}

function Day9Form({ data, setData }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const INTEREST_AREAS = ['Helping People', 'Health & Nutrition', 'Personal Development', 'Community', 'Recognition', 'Leadership', 'Learning', 'Flexible Work', 'Additional Income Opportunity', 'Not Interested Currently'];
  const READY_OPTIONS = ['Yes', 'Maybe Later', 'Need More Result First', 'Not Interested'];
  return (
    <div>
      <Field label="After achieving your goal, would you like health to remain part of your lifestyle?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'Maybe', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.healthLifestyle === opt ? 'selected' : ''}`} onClick={() => s('healthLifestyle', opt)} id={`d9-lifestyle-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <Field label="Would you enjoy helping others using what you learn?">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Yes', 'Maybe', 'No'].map(opt => (
            <button key={opt} type="button" className={`multiselect-chip ${data.helpingOthers === opt ? 'selected' : ''}`} onClick={() => s('helpingOthers', opt)} id={`d9-helping-${opt.toLowerCase()}`}>{opt}</button>
          ))}
        </div>
      </Field>
      <Field label="Interest Areas">
        <MultiSelect id="d9-interests" options={INTEREST_AREAS} value={data.interestAreas || []} onChange={v => s('interestAreas', v)} />
      </Field>
      <Field label="Interest In Coaching (1-10)">
        <ScaleInput id="d9-coaching-interest" value={data.coachingInterest} onChange={v => s('coachingInterest', v)} />
      </Field>
      <Field label="What attracts them most?"><input className="form-input" value={data.whatAttracts || ''} onChange={e => s('whatAttracts', e.target.value)} id="d9-attracts" /></Field>
      <Field label="What concern do they have?"><textarea className="form-input" rows={2} value={data.concerns || ''} onChange={e => s('concerns', e.target.value)} style={{ resize: 'vertical' }} id="d9-concerns" /></Field>
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Decision</div>
        <Field label="Ready For Coach Discussion?">
          <select className="form-input" value={data.readyForDiscussion || ''} onChange={e => s('readyForDiscussion', e.target.value)} id="d9-ready">
            <option value="">Select...</option>
            {READY_OPTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Recommended Next Step"><input className="form-input" value={data.recommendedNextStep || ''} onChange={e => s('recommendedNextStep', e.target.value)} id="d9-next-step" /></Field>
      </div>
    </div>
  );
}

function Day10Form({ data, setData, customer, allFollowups, coachReadinessScore }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  const PATHS = [
    { value: 'PATH_A', label: 'PATH A – CUSTOMER', desc: 'Continue focusing on personal result.' },
    { value: 'PATH_B', label: 'PATH B – SHARER', desc: 'Comfortable sharing own result and giving references.' },
    { value: 'PATH_C', label: 'PATH C – FUTURE COACH', desc: 'Interested in learning how to help others.' },
    { value: 'PATH_D', label: 'PATH D – ACTIVE COACH PROSPECT', desc: 'Ready for a separate coach opportunity discussion.' },
  ];

  const day1Followup = allFollowups?.find(f => f.day === 1);
  const originalWhy = day1Followup?.daySpecificData?.journeyReason || customer?.mainWhy || '—';

  const sortedFollowups = [...(allFollowups || [])].sort((a, b) => b.day - a.day);
  const currentWeight = sortedFollowups[0]?.commonCheckin?.todaysWeight || customer?.startingWeight;
  const weightChange = currentWeight && customer?.startingWeight ? (currentWeight - customer.startingWeight).toFixed(1) : '0';

  // Score classification
  const scoreCategory =
    coachReadinessScore >= 12 ? 'STRONG COACH PROSPECT' :
    coachReadinessScore >= 7  ? 'POTENTIAL SHARER / FUTURE COACH' :
    'CUSTOMER';

  return (
    <div>
      {/* Auto-filled summary */}
      <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>📊 10-Day Journey Summary (Auto-filled)</div>
        <div className="form-row-3" style={{ marginBottom: '8px' }}>
          <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>{customer?.startingWeight} kg</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Starting Weight</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>{currentWeight} kg</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Current Weight</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: weightChange < 0 ? '#16a34a' : weightChange > 0 ? '#dc2626' : 'var(--text-muted)' }}>
              {weightChange > 0 ? '+' : ''}{weightChange} kg
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Change</div>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px', background: 'white', borderRadius: '8px' }}>
          <span style={{ fontWeight: '700' }}>Original WHY (Day 1): </span>{originalWhy}
        </div>
      </div>

      <Field label="Biggest 10-Day Change">
        <textarea className="form-input" rows={3} value={data.biggest10DayChange || ''} onChange={e => s('biggest10DayChange', e.target.value)} style={{ resize: 'vertical' }} id="d10-biggest-change" />
      </Field>
      <Field label="What did customer learn about themselves?">
        <textarea className="form-input" rows={3} value={data.customerLearning || ''} onChange={e => s('customerLearning', e.target.value)} style={{ resize: 'vertical' }} id="d10-learning" />
      </Field>
      <Field label="Customer's Next 30-Day Goal">
        <textarea className="form-input" rows={2} value={data.next30DayGoal || ''} onChange={e => s('next30DayGoal', e.target.value)} style={{ resize: 'vertical' }} id="d10-30day-goal" />
      </Field>
      <Field label="Customer Confidence Now (1-10)">
        <ScaleInput id="d10-confidence" value={data.confidenceNow} onChange={v => s('confidenceNow', v)} />
      </Field>
      <Field label="Program Satisfaction (1-10)">
        <ScaleInput id="d10-satisfaction" value={data.programSatisfaction} onChange={v => s('programSatisfaction', v)} />
      </Field>
      <Field label="Coach's Genuine Appreciation" hint="e.g. 'You are very consistent.' / 'You accept correction very positively.'">
        <textarea className="form-input" rows={3} value={data.coachAppreciation || ''} onChange={e => s('coachAppreciation', e.target.value)} style={{ resize: 'vertical' }} id="d10-appreciation" />
      </Field>

      {/* Next Path */}
      <div style={{ marginTop: '16px' }}>
        <div className="followup-section-title">🛤️ Next Path</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {PATHS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => s('selectedPath', p.value)}
              id={`d10-path-${p.value}`}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '2px solid',
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                borderColor: data.selectedPath === p.value ? 'var(--primary)' : 'var(--border-color)',
                background: data.selectedPath === p.value ? 'var(--primary-light)' : 'var(--card-bg)',
              }}
            >
              <div style={{ fontWeight: '700', color: data.selectedPath === p.value ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.88rem' }}>{p.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{p.desc}</div>
            </button>
          ))}
        </div>
        <Field label="Reason For Selected Path">
          <textarea className="form-input" rows={2} value={data.pathReason || ''} onChange={e => s('pathReason', e.target.value)} style={{ resize: 'vertical' }} id="d10-path-reason" />
        </Field>
      </div>

      {/* Follow-up planning */}
      <div className="form-row-2" style={{ marginTop: '8px' }}>
        <Field label="Next Follow-up Date"><input type="date" className="form-input" value={data.nextFollowUpDate || ''} onChange={e => s('nextFollowUpDate', e.target.value)} id="d10-followup-date" /></Field>
        <Field label="Next Follow-up Purpose"><input className="form-input" value={data.nextFollowUpPurpose || ''} onChange={e => s('nextFollowUpPurpose', e.target.value)} id="d10-followup-purpose" /></Field>
      </div>

      {/* Internal Coach Readiness Score */}
      <div style={{ background: '#1e1b4b', color: 'white', borderRadius: 'var(--radius-md)', padding: '20px', marginTop: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '12px', color: '#a5b4fc' }}>
          🔒 INTERNAL COACH READINESS SCORE (Customer ને દેખાડવો નથી)
        </div>
        {[
          { key: 'scoreConsistency', label: 'Program Consistency' },
          { key: 'scoreCommunication', label: 'Communication' },
          { key: 'scoreHelping', label: 'Helping Nature' },
          { key: 'scorePositive', label: 'Positive Attitude' },
          { key: 'scoreLearning', label: 'Learning Mindset' },
          { key: 'scoreShares', label: 'Shares Journey Naturally' },
          { key: 'scorePeople', label: 'People Connection' },
          { key: 'scoreInterest', label: 'Interest In Coaching' },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.8rem', color: '#c7d2fe' }}>{item.label}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(v => (
                <button key={v} type="button" onClick={() => s(item.key, v)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)',
                    background: data[item.key] === v ? '#6366f1' : 'transparent',
                    color: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                  }}
                  id={`d10-score-${item.key}-${v}`}
                >{v}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(99,102,241,0.2)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#a5b4fc' }}>{coachReadinessScore} / 16</div>
          <div style={{ fontSize: '0.78rem', color: '#c7d2fe', marginTop: '4px' }}>{scoreCategory}</div>
        </div>
      </div>
    </div>
  );
}

// ── Ongoing 3-Day Check-in Form (After Day 10) ────────────
function Ongoing3DayForm({ data, setData, dayNum }) {
  const s = (k, v) => setData(d => ({ ...d, [k]: v }));
  return (
    <div>
      <div style={{ background: '#f0fdf4', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
          🔄 Every 3rd Day Ongoing Maintenance Check-in — Day {dayNum}
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
          Customer is in the 3-day ongoing maintenance phase. Track their 3-day progress, routine adjustments, and next commitments.
        </p>
      </div>

      <Field label="Overall 3-Day Progress & Adherence (1-10)">
        <ScaleInput id={`d${dayNum}-progress`} value={data.adherenceScore} onChange={v => s('adherenceScore', v)} />
      </Field>

      <Field label="3-Day Key Wins / Progress Highlights">
        <textarea className="form-input" rows={2} value={data.threeDayWins || ''} onChange={e => s('threeDayWins', e.target.value)} placeholder="What went well in the last 3 days?" style={{ resize: 'vertical' }} id={`d${dayNum}-wins`} />
      </Field>

      <Field label="3-Day Challenges / Obstacles">
        <textarea className="form-input" rows={2} value={data.threeDayChallenges || ''} onChange={e => s('threeDayChallenges', e.target.value)} placeholder="Any diet, cravings, or routine issues?" style={{ resize: 'vertical' }} id={`d${dayNum}-challenges`} />
      </Field>

      <Field label="Diet / Program Adjustment">
        <textarea className="form-input" rows={2} value={data.routineAdjustment || ''} onChange={e => s('routineAdjustment', e.target.value)} placeholder="Any changes made to meal plan, water, or exercise?" style={{ resize: 'vertical' }} id={`d${dayNum}-adjustment`} />
      </Field>

      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>📝 Coach Ongoing Guidance</div>
        <Field label="Coach Recommendation For Next 3 Days">
          <textarea className="form-input" rows={2} value={data.coachRecommendation || ''} onChange={e => s('coachRecommendation', e.target.value)} style={{ resize: 'vertical' }} id={`d${dayNum}-recommendation`} />
        </Field>
        <Field label="Customer Next 3-Day Commitment">
          <input className="form-input" value={data.nextCommitment || ''} onChange={e => s('nextCommitment', e.target.value)} placeholder="e.g. 3L water daily, 8k steps" id={`d${dayNum}-commitment`} />
        </Field>
        <Field label="Next 3-Day Follow-Up Date">
          <input type="date" className="form-input" value={data.nextFollowUpDate || ''} onChange={e => s('nextFollowUpDate', e.target.value)} id={`d${dayNum}-next-date`} />
        </Field>
      </div>
    </div>
  );
}

// ── Day Config ────────────────────────────────────────────
const BASE_DAY_CONFIG = [
  { day: 1, icon: '📖', title: 'DAY 1 – Customer Story & WHY', purpose: 'Customer ને deeply સમજવો અને strong connection start કરવો.' },
  { day: 2, icon: '🕐', title: 'DAY 2 – Daily Routine Diagnosis', purpose: 'Customer ના daily lifestyle અને weak timings સમજવા.' },
  { day: 3, icon: '🍽️', title: 'DAY 3 – Food & Craving Diagnosis', purpose: 'Eating triggers અને habits સમજવા.' },
  { day: 4, icon: '💪', title: 'DAY 4 – Motivation & Mindset', purpose: 'Customer ને શું motivate કરે છે તે સમજવું.' },
  { day: 5, icon: '🤝', title: 'DAY 5 – Personal Connection', purpose: 'Customer ને person તરીકે ઓળખવો.' },
  { day: 6, icon: '🏆', title: 'DAY 6 – Result & Recognition', purpose: 'Customer ને પોતાનો improvement recognise કરાવવો.' },
  { day: 7, icon: '🔗', title: 'DAY 7 – Reference Discovery', purpose: 'Natural references identify કરવા.' },
  { day: 8, icon: '🔍', title: 'DAY 8 – Coach Personality Discovery', purpose: 'Customer માં future coach potential identify કરવું.' },
  { day: 9, icon: '🌟', title: 'DAY 9 – Future Vision & Coach Interest', purpose: 'Business pitch કર્યા વગર future possibility explore કરવી.' },
  { day: 10, icon: '🎉', title: 'DAY 10 – Journey Review & Next Step', purpose: '10-day journey summarise કરીને next path decide કરવો.' },
];

function buildDaysList(followups) {
  const list = [...BASE_DAY_CONFIG];
  const maxDay = followups.length > 0 ? Math.max(...followups.map(f => f.day)) : 0;

  if (maxDay >= 10) {
    const doneOngoing = followups.map(f => f.day).filter(d => d > 10).sort((a, b) => a - b);
    const nextOngoing = doneOngoing.length > 0 ? Math.max(...doneOngoing) + 3 : 13;
    const allOngoing = Array.from(new Set([...doneOngoing, nextOngoing])).sort((a, b) => a - b);

    for (const d of allOngoing) {
      list.push({
        day: d,
        icon: '🔄',
        title: `DAY ${d} – 3-Day Ongoing Check-in`,
        purpose: 'Every 3rd day maintenance, progress review & routine adjustment.',
      });
    }
  }

  return list;
}

// ── Main Modal ────────────────────────────────────────────
export default function FollowUpFormModal({ customer, followups = [], coachUid, coachName, onClose, onSaved }) {
  const existingDays = followups.map(f => f.day);
  const maxCompletedDay = followups.length > 0 ? Math.max(...followups.map(f => f.day)) : 0;

  // Next day to fill: if <10 then next sequential day, if >=10 then next 3rd day (13, 16, 19...)
  const nextDayToFill = maxCompletedDay < 10
    ? maxCompletedDay + 1
    : (maxCompletedDay === 10 ? 13 : maxCompletedDay + 3);

  const [selectedDay, setSelectedDay] = useState(nextDayToFill);

  const daysList = buildDaysList(followups);
  const existingFollowup = followups.find(f => f.day === selectedDay);

  const [commonCheckin, setCommonCheckin] = useState(existingFollowup?.commonCheckin || {});
  const [dayData, setDayData] = useState(existingFollowup?.daySpecificData || {});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  // Recalculate coach readiness score from day 10 form data
  const scoreKeys = ['scoreConsistency', 'scoreCommunication', 'scoreHelping', 'scorePositive', 'scoreLearning', 'scoreShares', 'scorePeople', 'scoreInterest'];
  const coachReadinessScore = scoreKeys.reduce((sum, k) => sum + (typeof dayData[k] === 'number' ? dayData[k] : 0), 0);

  useEffect(() => {
    const existing = followups.find(f => f.day === selectedDay);
    setCommonCheckin(existing?.commonCheckin || {});
    setDayData(existing?.daySpecificData || {});
    setSaveMsg('');
    setError('');
  }, [selectedDay]);

  const isLocked = (dayNum) => {
    if (dayNum <= 10) return dayNum > maxCompletedDay + 1;
    // For post day 10: lock if > max completed day + 3
    const maxOngoing = Math.max(10, maxCompletedDay);
    return dayNum > maxOngoing + 3;
  };

  const isDone = (dayNum) => existingDays.includes(dayNum);


  const handleSave = async () => {
    if (!commonCheckin.todaysWeight) {
      setError("Today's Weight is required in the daily check-in.");
      return;
    }
    setSaving(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = !existingDays.includes(selectedDay);

      const followupData = {
        customerProfileId: customer.isUserBased ? null : customer.id,
        customerUid: customer.uid || customer.id, // always store uid for lookup
        coachId: coachUid,
        day: selectedDay,
        followUpDate: today,
        commonCheckin,
        daySpecificData: dayData,
        coachReadinessScore: selectedDay === 10 ? coachReadinessScore : null,
        updatedAt: serverTimestamp(),
      };

      if (isNewDay || !existingFollowup) {
        await addDoc(collection(db, 'customer_followups'), {
          ...followupData,
          createdAt: serverTimestamp(),
        });
        // Only update customer_profiles if this is a profile-based customer
        if (!customer.isUserBased && selectedDay > daysCompleted) {
          const profileRef = doc(db, 'customer_profiles', customer.id);
          await updateDoc(profileRef, {
            daysCompleted: selectedDay,
            coachReadinessScore: selectedDay === 10 ? coachReadinessScore : (customer.coachReadinessScore || null),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        const docRef = doc(db, 'customer_followups', existingFollowup.id);
        await updateDoc(docRef, followupData);
        if (!customer.isUserBased && selectedDay === 10) {
          const profileRef = doc(db, 'customer_profiles', customer.id);
          await updateDoc(profileRef, { coachReadinessScore, updatedAt: serverTimestamp() });
        }
      }


      setSaveMsg(`✅ Day ${selectedDay} saved successfully!`);
      onSaved();

      // Auto-advance to next day after 1.2 seconds
      if (isNewDay) {
        const nextDay = selectedDay < 10 ? selectedDay + 1 : (selectedDay === 10 ? 13 : selectedDay + 3);
        setTimeout(() => setSelectedDay(nextDay), 1200);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentDayConfig = daysList.find(d => d.day === selectedDay);


  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ alignItems: 'flex-start', paddingTop: '20px' }}>
      <div style={{ display: 'flex', width: '95vw', maxWidth: '1100px', height: '90vh', background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>

        {/* ── Left: Day Navigator ── */}
        <div style={{ width: '200px', flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '20px 0', overflowY: 'auto' }}>
          {/* Customer mini-profile */}
          <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            <div style={{ fontWeight: '800', fontSize: '0.88rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.fullName}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{customer.primaryGoal}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{customer.customerId}</div>
          </div>

          {daysList.map(({ day, icon, title }) => {
            const done = isDone(day);
            const locked = isLocked(day);
            const active = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => !locked && setSelectedDay(day)}
                disabled={locked}
                id={`followup-nav-day-${day}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                  textAlign: 'left', border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'white' : locked ? 'var(--text-muted)' : 'var(--text-main)',
                  borderLeft: active ? '3px solid white' : '3px solid transparent',
                  transition: 'all 0.15s',
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>{done ? '✅' : locked ? '🔒' : icon}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: active ? '700' : '500', lineHeight: 1.3 }}>
                  Day {day}
                </span>
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button onClick={onClose} className="btn btn-outline btn-sm" style={{ width: '100%' }} id="followup-form-close-btn">✕ Close</button>
          </div>
        </div>

        {/* ── Right: Form Content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Day header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{currentDayConfig?.icon} {currentDayConfig?.title}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{currentDayConfig?.purpose}</p>
              </div>
              {isDone(selectedDay) && (
                <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700' }}>✅ Saved</span>
              )}
            </div>
          </div>

          {/* Scrollable form body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* Coach Rule Banner */}
            {selectedDay === 1 && !isDone(1) && (
              <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', fontSize: '0.82rem', color: '#7e22ce', lineHeight: 1.6 }}>
                💜 <strong>Coach Rule:</strong> "Do not rush the customer toward references or coaching. First build result, trust and relationship. Ask questions, listen carefully and record real answers. Coaching opportunity should arise naturally."
              </div>
            )}

            {/* Common Check-in */}
            <CommonCheckinSection
              data={commonCheckin}
              setData={setCommonCheckin}
              startingWeight={customer.startingWeight}
              dayNum={selectedDay}
            />

            {/* Day-specific section */}
            <div>
              <div className="followup-section-title" style={{ marginBottom: '12px' }}>
                {currentDayConfig?.icon} Day {selectedDay} — {selectedDay > 10 ? 'Ongoing Maintenance Questions' : 'Specific Questions'}
              </div>
              {selectedDay === 1  && <Day1Form  data={dayData} setData={setDayData} />}
              {selectedDay === 2  && <Day2Form  data={dayData} setData={setDayData} />}
              {selectedDay === 3  && <Day3Form  data={dayData} setData={setDayData} />}
              {selectedDay === 4  && <Day4Form  data={dayData} setData={setDayData} />}
              {selectedDay === 5  && <Day5Form  data={dayData} setData={setDayData} />}
              {selectedDay === 6  && <Day6Form  data={dayData} setData={setDayData} />}
              {selectedDay === 7  && <Day7Form  data={dayData} setData={setDayData} />}
              {selectedDay === 8  && <Day8Form  data={dayData} setData={setDayData} />}
              {selectedDay === 9  && <Day9Form  data={dayData} setData={setDayData} />}
              {selectedDay === 10 && <Day10Form data={dayData} setData={setDayData} customer={customer} allFollowups={followups} coachReadinessScore={coachReadinessScore} />}
              {selectedDay > 10  && <Ongoing3DayForm data={dayData} setData={setDayData} dayNum={selectedDay} />}
            </div>
          </div>

          {/* Footer with save */}
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {error && <span style={{ color: '#dc2626', fontSize: '0.82rem', flex: 1 }}>⚠️ {error}</span>}
            {saveMsg && <span style={{ color: '#16a34a', fontSize: '0.82rem', flex: 1, fontWeight: '600' }}>{saveMsg}</span>}
            {!error && !saveMsg && <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fill all required fields and save.</span>}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              id={`followup-save-day-${selectedDay}`}
              style={{ width: 'auto', minWidth: '160px' }}
            >
              {saving ? '⏳ Saving...' : `💾 Save Day ${selectedDay}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
