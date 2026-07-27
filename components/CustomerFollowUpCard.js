'use client';

import React from 'react';

const DAY_STATUS_CONFIG = {
  completed: { icon: '✅', color: '#16a34a', bg: '#f0fdf4', label: 'Completed' },
  due_today: { icon: '🟡', color: '#d97706', bg: '#fffbeb', label: 'Due Today' },
  missed:    { icon: '🔴', color: '#dc2626', bg: '#fef2f2', label: 'Missed' },
  upcoming:  { icon: '🔵', color: '#2563eb', bg: '#eff6ff', label: 'Upcoming' },
  attention: { icon: '⚠️', color: '#f59e0b', bg: '#fffbeb', label: 'Needs Attention' },
  locked:    { icon: '🔒', color: '#9ca3af', bg: '#f3f4f6', label: 'Locked' },
};

const STATUS_BADGE_COLORS = {
  'New Customer':        { bg: '#eff6ff', color: '#2563eb' },
  'Active Customer':     { bg: '#f0fdf4', color: '#16a34a' },
  'Needs Attention':     { bg: '#fef2f2', color: '#dc2626' },
  'Good Progress':       { bg: '#f0fdf4', color: '#059669' },
  'Potential Sharer':    { bg: '#fdf4ff', color: '#7e22ce' },
  'Potential Coach':     { bg: '#fdf4ff', color: '#a21caf' },
  'Coach Discussion Done': { bg: '#fff7ed', color: '#ea580c' },
  'Not Interested':      { bg: '#f9fafb', color: '#6b7280' },
  'Inactive':            { bg: '#f3f4f6', color: '#9ca3af' },
};

function getDayStatus(dayNum, daysCompleted, joiningDate) {
  if (dayNum <= daysCompleted) return 'completed';

  const joinDate = new Date(joiningDate);
  const today = new Date();
  const daysSinceJoin = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
  const expectedDay = daysSinceJoin + 1;

  if (dayNum === daysCompleted + 1) {
    if (dayNum === expectedDay) return 'due_today';
    if (dayNum < expectedDay) return 'missed';
    return 'upcoming';
  }

  if (dayNum < expectedDay) return 'missed';
  return 'locked';
}

export default function CustomerFollowUpCard({ customer, followups, onClick }) {
  const { fullName, primaryGoal, startingWeight, status, joiningDate, daysCompleted = 0, mainWhy } = customer;

  // Calculate current weight from latest followup
  const sortedFollowups = [...(followups || [])].sort((a, b) => b.day - a.day);
  const latestFollowup = sortedFollowups[0];
  const currentWeight = latestFollowup?.commonCheckin?.todaysWeight || startingWeight;
  const weightChange = currentWeight && startingWeight ? (currentWeight - startingWeight).toFixed(1) : null;
  const isLoss = weightChange < 0;
  const isGain = weightChange > 0;

  // Coach readiness score (Day 8+ )
  const day8Data = followups?.find(f => f.day === 8)?.daySpecificData;
  const coachScore = customer.coachReadinessScore || null;

  // Next follow-up day
  const nextDay = daysCompleted < 10 ? daysCompleted + 1 : null;

  const statusColors = STATUS_BADGE_COLORS[status] || STATUS_BADGE_COLORS['New Customer'];

  return (
    <div
      className="followup-customer-card"
      onClick={onClick}
      id={`followup-card-${customer.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Card Header */}
      <div className="followup-card-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
          <div className="followup-card-avatar">
            {fullName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="followup-card-name">{fullName}</div>
            <div className="followup-card-goal">{primaryGoal}</div>
            {customer.customerId && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                {customer.customerId}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span className="followup-status-badge" style={{ background: statusColors.bg, color: statusColors.color }}>
            {status}
          </span>
          {nextDay && (
            <span style={{ fontSize: '0.72rem', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700', padding: '2px 8px', borderRadius: '99px' }}>
              Day {daysCompleted}/10
            </span>
          )}
          {daysCompleted >= 10 && (
            <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#16a34a', fontWeight: '700', padding: '2px 8px', borderRadius: '99px' }}>
              ✅ Completed
            </span>
          )}
        </div>
      </div>

      {/* Day Progress Tracker */}
      <div className="followup-day-tracker">
        {Array.from({ length: 10 }, (_, i) => {
          const dayNum = i + 1;
          const dayStatus = getDayStatus(dayNum, daysCompleted, joiningDate);
          const cfg = DAY_STATUS_CONFIG[dayStatus];
          return (
            <div key={dayNum} className="followup-day-pill" style={{ background: cfg.bg, color: cfg.color }} title={`Day ${dayNum}: ${cfg.label}`}>
              <span style={{ fontSize: '0.6rem', fontWeight: '800' }}>D{dayNum}</span>
              <span style={{ fontSize: '0.7rem' }}>{cfg.icon}</span>
            </div>
          );
        })}
      </div>

      {/* Stats Row */}
      <div className="followup-card-stats">
        <div className="followup-stat-item">
          <span className="followup-stat-value">{startingWeight} kg</span>
          <span className="followup-stat-label">Start</span>
        </div>
        <div className="followup-stat-item">
          <span className="followup-stat-value" style={{ color: currentWeight !== startingWeight ? (isLoss ? '#16a34a' : '#dc2626') : 'var(--text-main)' }}>
            {currentWeight} kg
          </span>
          <span className="followup-stat-label">Current</span>
        </div>
        <div className="followup-stat-item">
          <span className="followup-stat-value" style={{ color: isLoss ? '#16a34a' : isGain ? '#dc2626' : 'var(--text-muted)' }}>
            {weightChange !== null ? (isLoss ? weightChange : isGain ? `+${weightChange}` : '0.0') + ' kg' : '—'}
          </span>
          <span className="followup-stat-label">Change</span>
        </div>
        {coachScore !== null && (
          <div className="followup-stat-item">
            <span className="followup-stat-value" style={{ color: coachScore >= 12 ? '#7e22ce' : coachScore >= 7 ? '#2563eb' : 'var(--text-muted)' }}>
              {coachScore}/16
            </span>
            <span className="followup-stat-label">Coach Score</span>
          </div>
        )}
      </div>

      {/* Bottom: WHY snippet + next action */}
      {mainWhy && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 16px 8px', lineHeight: '1.4',
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          "{mainWhy}"
        </div>
      )}

      <div className="followup-card-footer">
        {nextDay && nextDay <= 10 ? (
          <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.78rem' }}>
            📋 Next: Fill Day {nextDay} →
          </span>
        ) : daysCompleted >= 10 ? (
          <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.78rem' }}>🎉 10-Day Journey Complete!</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No days filled yet</span>
        )}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Joined {joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}
        </span>
      </div>
    </div>
  );
}
