'use client';

import React from 'react';

// Mifflin-St Jeor BMR calculation (same as dashboard)
function calculateBMR(weight, height, age, gender) {
  if (!weight || !height || !age) return 0;
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else if (gender === 'female') {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 78);
  }
}

export default function CustomerDetailModal({ customer, diagnosis, weightHistory, onClose }) {
  const latestWeight = weightHistory.length > 0 ? weightHistory[0].weight : diagnosis?.initialWeight || 0;
  const bmr = diagnosis ? calculateBMR(latestWeight, diagnosis.height, diagnosis.age, diagnosis.gender) : 0;

  return (
    <div className="modal-overlay">
      <div className="detail-modal-card">
        <div className="modal-header">
          <h3>{customer.name}'s Health Profile</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div className="bmr-display" style={{ padding: '16px' }}>
            <span className="bmr-value" style={{ fontSize: '1.8rem' }}>{latestWeight}</span>
            <span className="bmr-label">Latest Weight (kg)</span>
          </div>
          <div className="bmr-display" style={{ padding: '16px' }}>
            <span className="bmr-value" style={{ fontSize: '1.8rem' }}>{bmr}</span>
            <span className="bmr-label">BMR (cal/day)</span>
          </div>
          <div className="bmr-display" style={{ padding: '16px' }}>
            <span className="bmr-value" style={{ fontSize: '1.8rem' }}>{diagnosis?.height || '—'}</span>
            <span className="bmr-label">Height (cm)</span>
          </div>
        </div>

        {/* Diagnosis Details */}
        {diagnosis && (
          <div>
            <h4 className="card-title">Diagnosis Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="profile-info-row">
                <span className="profile-info-label">Age / Gender</span>
                <span className="profile-info-value">{diagnosis.age} yrs / {diagnosis.gender}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Fitness Goal</span>
                <span className="profile-info-value" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                  {diagnosis.fitnessGoal}
                </span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Medical History</span>
                <span className="profile-info-value">{diagnosis.medicalHistory || 'None'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Breakfast</span>
                <span className="profile-info-value">{diagnosis.preferredTimes?.breakfast}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Lunch</span>
                <span className="profile-info-value">{diagnosis.preferredTimes?.lunch}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Dinner</span>
                <span className="profile-info-value">{diagnosis.preferredTimes?.dinner}</span>
              </div>
            </div>
          </div>
        )}

        {/* Weight History */}
        <div>
          <h4 className="card-title">Weight Log History</h4>
          {weightHistory.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <span className="empty-state-icon">⚖️</span>
              <p>No weight entries recorded yet.</p>
            </div>
          ) : (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight (kg)</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {weightHistory.map((item, index) => {
                    let changeText = '—';
                    let changeColor = 'var(--text-muted)';
                    if (index < weightHistory.length - 1) {
                      const prevWeight = weightHistory[index + 1].weight;
                      const diff = item.weight - prevWeight;
                      if (diff > 0) {
                        changeText = `+${diff.toFixed(1)} kg`;
                        changeColor = 'var(--accent-danger)';
                      } else if (diff < 0) {
                        changeText = `${diff.toFixed(1)} kg`;
                        changeColor = 'var(--accent-success)';
                      } else {
                        changeText = '0.0 kg';
                      }
                    }
                    return (
                      <tr key={item.id}>
                        <td>{new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</td>
                        <td style={{ fontWeight: '600' }}>{item.weight.toFixed(1)} kg</td>
                        <td style={{ color: changeColor, fontWeight: '500' }}>{changeText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn btn-outline" style={{ marginTop: '8px' }}>
          Close
        </button>
      </div>
    </div>
  );
}
