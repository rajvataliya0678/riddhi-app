'use client';

import React from 'react';

const QUOTES = {
  'Weight Loss': [
    "Small daily improvements lead to stunning results.",
    "You didn't gain it overnight. You won't lose it overnight. Keep going.",
    "Every kg you lose is a victory. Celebrate it.",
    "Progress is progress, no matter how small.",
    "The body achieves what the mind believes.",
    "Discipline is choosing between what you want now and what you want most.",
    "Don't stop when you're tired. Stop when you're done.",
    "Your future self is watching you right now through your memories.",
    "Success is the sum of small efforts repeated day in and day out.",
    "It always seems impossible until it's done.",
  ],
  'Weight Gain': [
    "Building a stronger you, one day at a time.",
    "Consistency over intensity. Every single day.",
    "Your body is a work in progress — and the progress is real.",
    "Growth requires patience. Trust the process.",
    "Feed your ambition like you feed your gains.",
    "Every rep, every meal, every rest day — it all counts.",
    "Strong bodies are built in months. Legendary ones in years.",
    "Show up for yourself today. Your future self will thank you.",
    "You are stronger than you were yesterday.",
    "Hard work beats talent when talent doesn't work hard.",
  ],
  'Maintenance': [
    "Consistency is the key to lasting change.",
    "You've worked hard to get here. Now own it.",
    "Maintaining is as powerful as achieving.",
    "Balance is not something you find — it's something you create.",
    "Showing up every day is your superpower.",
    "Stability is underrated. You're thriving.",
    "Health is a lifelong journey, not a destination.",
    "Every day you maintain is a day you succeed.",
    "You are exactly where you need to be.",
    "Steady wins the race.",
  ],
  'General Fitness': [
    "Fitness is not about being better than someone else. It's about being better than you used to be.",
    "Take care of your body. It's the only place you have to live.",
    "Movement is medicine.",
    "A little progress each day adds up to big results.",
    "Your health is your wealth.",
    "Be the energy you want to attract.",
    "Make your body the best version it can be.",
    "You are one workout away from a good mood.",
    "Strong is the new everything.",
    "Every day is a chance to be better.",
  ],
};

function getDailyQuote(fitnessGoal) {
  const goalQuotes = QUOTES[fitnessGoal] || QUOTES['General Fitness'];
  // Seed by day-of-year so it changes daily but is consistent throughout the day
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return goalQuotes[dayOfYear % goalQuotes.length];
}

export default function WeeklyInsight({ weightHistory, fitnessGoal, startWeight: rawStart, goalWeight: rawGoal, currentWeight }) {
  const quote = getDailyQuote(fitnessGoal);
  const startWeight = rawStart ? parseFloat(rawStart) : null;
  const goalWeight = rawGoal ? parseFloat(rawGoal) : null;

  // Weekly comparison
  const getThisWeekChange = () => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const sorted = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0]?.weight;

    // Find entry ~7 days ago
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth()+1).padStart(2,'0')}-${String(weekAgo.getDate()).padStart(2,'0')}`;

    // Find closest entry to 7 days ago
    const weekEntry = sorted.find(e => e.date <= weekAgoStr);
    if (!weekEntry) return null;

    const diff = latest - weekEntry.weight;
    return { diff: parseFloat(diff.toFixed(1)), baseline: weekEntry.weight };
  };

  const weekChange = getThisWeekChange();

  // Progress toward goal
  let progressPct = 0;
  let progressKg = 0;
  let remainingKg = 0;

  if (startWeight && goalWeight && currentWeight) {
    const totalNeeded = Math.abs(startWeight - goalWeight);
    progressKg = parseFloat(Math.abs(startWeight - currentWeight).toFixed(1));
    remainingKg = parseFloat(Math.max(0, totalNeeded - progressKg).toFixed(1));
    progressPct = Math.min(100, Math.round((progressKg / totalNeeded) * 100));
  }

  const isWeightLoss = fitnessGoal === 'Weight Loss';
  const goodChange = isWeightLoss ? weekChange?.diff < 0 : weekChange?.diff > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Progress Bar toward goal */}
      {goalWeight && startWeight && (
        <div className="goal-progress-wrap">
          <div className="goal-progress-header">
            <span className="goal-progress-label">Progress to Goal</span>
            <span className="goal-progress-pct">{progressPct}%</span>
          </div>
          <div className="goal-progress-track">
            <div
              className="goal-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="goal-progress-stats">
            <span>Start: <strong>{startWeight} kg</strong></span>
            <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
              {progressKg > 0 ? `${isWeightLoss ? '−' : '+'}${progressKg} kg` : 'Just started!'}
            </span>
            <span>Goal: <strong>{goalWeight} kg</strong></span>
          </div>
          {remainingKg > 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {remainingKg} kg to go 💪
            </p>
          )}
          {progressPct >= 100 && (
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--accent-success)', fontWeight: '700', marginTop: '4px' }}>
              🎉 Goal achieved! You're incredible!
            </p>
          )}
        </div>
      )}

      {/* Weekly change card */}
      {weekChange !== null && (
        <div className={`weekly-insight-card ${goodChange ? 'insight-positive' : weekChange.diff === 0 ? 'insight-neutral' : 'insight-negative'}`}>
          <span className="weekly-insight-icon">
            {weekChange.diff === 0 ? '➡️' : goodChange ? '🎉' : '💪'}
          </span>
          <div className="weekly-insight-text">
            <span className="weekly-insight-title">This Week</span>
            <span className="weekly-insight-value">
              {weekChange.diff === 0
                ? 'No change from last week'
                : goodChange
                  ? `${Math.abs(weekChange.diff)} kg ${isWeightLoss ? 'lost' : 'gained'} this week!`
                  : `${Math.abs(weekChange.diff)} kg ${isWeightLoss ? 'gained' : 'lost'} — refocus this week`
              }
            </span>
          </div>
        </div>
      )}

      {/* Motivational quote */}
      <div className="quote-card">
        <span className="quote-mark">"</span>
        <p className="quote-text">{quote}</p>
      </div>
    </div>
  );
}
