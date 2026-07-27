'use client';

import React, { useState, useEffect } from 'react';

const BADGES = [
  { id: 'first_log',    icon: '🌱', name: 'First Step',      desc: 'Logged your first weight',           check: (streak, totalDays, lostKg, pct) => totalDays >= 1 },
  { id: 'streak_3',    icon: '✨', name: '3-Day Streak',    desc: '3 days in a row',                    check: (streak) => streak >= 3 },
  { id: 'streak_7',    icon: '🔥', name: 'On Fire',         desc: '7-day streak achieved',              check: (streak) => streak >= 7 },
  { id: 'streak_14',   icon: '⚡', name: 'Momentum',        desc: '14 consecutive days',                check: (streak) => streak >= 14 },
  { id: 'streak_30',   icon: '💎', name: 'Unstoppable',     desc: '30-day streak — legend!',            check: (streak) => streak >= 30 },
  { id: 'lost_1kg',    icon: '📉', name: 'Down 1 kg',       desc: 'Lost your first kilogram',           check: (streak, totalDays, lostKg) => lostKg >= 1 },
  { id: 'lost_5kg',    icon: '💪', name: 'Down 5 kg',       desc: '5 kg down — incredible!',            check: (streak, totalDays, lostKg) => lostKg >= 5 },
  { id: 'lost_10kg',   icon: '🏅', name: 'Down 10 kg',      desc: '10 kg milestone crushed',            check: (streak, totalDays, lostKg) => lostKg >= 10 },
  { id: 'halfway',     icon: '🏆', name: 'Halfway There',   desc: '50% of your goal achieved',          check: (streak, totalDays, lostKg, pct) => pct >= 50 },
  { id: 'goal',        icon: '👑', name: 'Goal Reached!',   desc: 'You hit your target weight!',        check: (streak, totalDays, lostKg, pct) => pct >= 100 },
];

function calculateStreak(weightHistory) {
  if (!weightHistory || weightHistory.length === 0) return 0;
  // weightHistory is sorted newest first, dates are YYYY-MM-DD strings
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const dates = weightHistory.map(e => e.date).sort((a,b) => b.localeCompare(a)); // newest first
  let streak = 0;
  let expected = todayStr;

  // Check if today is logged; if not, start from yesterday
  if (dates[0] !== todayStr) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  }

  for (const date of dates) {
    if (date === expected) {
      streak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
    } else if (date < expected) {
      break;
    }
  }
  return streak;
}

function hasLoggedToday(weightHistory) {
  if (!weightHistory || weightHistory.length === 0) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return weightHistory.some(e => e.date === todayStr);
}

export default function StreakBadges({ weightHistory, startWeight: rawStart, goalWeight: rawGoal, currentWeight }) {
  const [newBadge, setNewBadge] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const startWeight = rawStart ? parseFloat(rawStart) : null;
  const goalWeight = rawGoal ? parseFloat(rawGoal) : null;

  const streak = calculateStreak(weightHistory);
  const loggedToday = hasLoggedToday(weightHistory);
  const totalDays = weightHistory?.length || 0;

  // How much lost (positive = loss, negative = gain)
  const lostKg = startWeight && currentWeight ? Math.max(0, startWeight - currentWeight) : 0;

  // Progress % toward goal
  let progressPct = 0;
  if (startWeight && goalWeight && startWeight !== goalWeight) {
    const totalNeeded = Math.abs(startWeight - goalWeight);
    const achieved = Math.abs(startWeight - currentWeight);
    progressPct = Math.min(100, Math.round((achieved / totalNeeded) * 100));
  }

  const unlockedBadges = BADGES.filter(b => b.check(streak, totalDays, lostKg, progressPct));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Streak Hero */}
      <div className="streak-hero">
        <div className="streak-flame-wrap">
          <span className={`streak-flame ${loggedToday ? 'flame-active' : 'flame-dim'}`}>🔥</span>
        </div>
        <div className="streak-info">
          <span className="streak-number">{streak}</span>
          <span className="streak-label">Day Streak</span>
        </div>
        <div className="streak-status">
          {loggedToday
            ? <span className="streak-logged">✓ Logged today</span>
            : <span className="streak-warn">⚠ Log today to keep streak!</span>
          }
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            {totalDays} total days logged
          </span>
        </div>
      </div>

      {/* Achievement Badges */}
      <div>
        <p style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Achievements — {unlockedBadges.length}/{BADGES.length} unlocked
        </p>
        <div className="badges-grid">
          {BADGES.map((badge) => {
            const unlocked = badge.check(streak, totalDays, lostKg, progressPct);
            return (
              <div
                key={badge.id}
                className={`badge-card ${unlocked ? 'badge-unlocked' : 'badge-locked'}`}
                title={unlocked ? badge.desc : 'Not yet unlocked'}
              >
                <span className="badge-icon">{unlocked ? badge.icon : '🔒'}</span>
                <span className="badge-name">{badge.name}</span>
                {unlocked && <span className="badge-desc">{badge.desc}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
