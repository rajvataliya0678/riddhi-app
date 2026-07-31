'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame, Sparkles, Zap, Gem, TrendingDown, Dumbbell, Medal, Trophy,
  Crown, Sprout, Lock, CheckCircle, AlertCircle
} from 'lucide-react';

const BADGES = [
  { id: 'first_log',  Icon: Sprout,       color: '#22c55e', bg: '#dcfce7', name: 'First Step',    desc: 'Logged your first weight',       check: (s, t)        => t >= 1 },
  { id: 'streak_3',   Icon: Sparkles,     color: '#f59e0b', bg: '#fef3c7', name: '3-Day Streak',  desc: '3 days in a row',                check: (s)           => s >= 3 },
  { id: 'streak_7',   Icon: Flame,        color: '#f97316', bg: '#ffedd5', name: 'On Fire',       desc: '7-day streak achieved',          check: (s)           => s >= 7 },
  { id: 'streak_14',  Icon: Zap,          color: '#8b5cf6', bg: '#f5f3ff', name: 'Momentum',      desc: '14 consecutive days',            check: (s)           => s >= 14 },
  { id: 'streak_30',  Icon: Gem,          color: '#06b6d4', bg: '#ecfeff', name: 'Unstoppable',   desc: '30-day streak — legend!',        check: (s)           => s >= 30 },
  { id: 'lost_1kg',   Icon: TrendingDown, color: '#059669', bg: '#ecfdf5', name: 'Down 1 kg',     desc: 'Lost your first kilogram',       check: (s, t, l)     => l >= 1 },
  { id: 'lost_5kg',   Icon: Dumbbell,     color: '#3b82f6', bg: '#dbeafe', name: 'Down 5 kg',     desc: '5 kg down — incredible!',        check: (s, t, l)     => l >= 5 },
  { id: 'lost_10kg',  Icon: Medal,        color: '#d97706', bg: '#fffbeb', name: 'Down 10 kg',    desc: '10 kg milestone crushed',        check: (s, t, l)     => l >= 10 },
  { id: 'halfway',    Icon: Trophy,       color: '#7c3aed', bg: '#f5f3ff', name: 'Halfway There', desc: '50% of your goal achieved',      check: (s, t, l, p)  => p >= 50 },
  { id: 'goal',       Icon: Crown,        color: '#eab308', bg: '#fefce8', name: 'Goal Reached!', desc: 'You hit your target weight!',   check: (s, t, l, p)  => p >= 100 },
];

function calculateStreak(weightHistory) {
  if (!weightHistory || weightHistory.length === 0) return 0;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dates = weightHistory.map(e => e.date).sort((a,b) => b.localeCompare(a));
  let streak = 0;
  let expected = todayStr;

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
  const startWeight = rawStart ? parseFloat(rawStart) : null;
  const goalWeight  = rawGoal  ? parseFloat(rawGoal)  : null;

  const streak     = calculateStreak(weightHistory);
  const loggedToday = hasLoggedToday(weightHistory);
  const totalDays  = weightHistory?.length || 0;
  const lostKg     = startWeight && currentWeight ? Math.max(0, startWeight - currentWeight) : 0;

  let progressPct = 0;
  if (startWeight && goalWeight && startWeight !== goalWeight) {
    const totalNeeded = Math.abs(startWeight - goalWeight);
    const achieved    = Math.abs(startWeight - currentWeight);
    progressPct = Math.min(100, Math.round((achieved / totalNeeded) * 100));
  }

  const unlockedBadges = BADGES.filter(b => b.check(streak, totalDays, lostKg, progressPct));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Streak Hero */}
      <div className="streak-hero">
        <div className="streak-flame-wrap" style={{ position: 'relative' }}>
          <div className={`streak-flame ${loggedToday ? 'flame-active' : 'flame-dim'}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={44} color={loggedToday ? '#f97316' : '#94a3b8'} fill={loggedToday ? '#fed7aa' : 'none'} />
          </div>
        </div>
        <div className="streak-info">
          <span className="streak-number">{streak}</span>
          <span className="streak-label">Day Streak</span>
        </div>
        <div className="streak-status">
          {loggedToday
            ? <span className="streak-logged" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={14} /> Logged today
              </span>
            : <span className="streak-warn" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertCircle size={14} /> Log today to keep streak!
              </span>
          }
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            {totalDays} total days logged
          </span>
        </div>
      </div>

      {/* Achievement Badges */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trophy size={13} color="var(--text-muted)" />
          Achievements — {unlockedBadges.length}/{BADGES.length} unlocked
        </p>
        <div className="badges-grid">
          {BADGES.map((badge) => {
            const unlocked = badge.check(streak, totalDays, lostKg, progressPct);
            const IconComp = badge.Icon;
            return (
              <div
                key={badge.id}
                className={`badge-card ${unlocked ? 'badge-unlocked' : 'badge-locked'}`}
                title={unlocked ? badge.desc : 'Not yet unlocked'}
              >
                <span className="badge-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unlocked
                    ? <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${badge.color}30` }}>
                        <IconComp size={20} color={badge.color} />
                      </div>
                    : <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={16} color="#94a3b8" />
                      </div>
                  }
                </span>
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
