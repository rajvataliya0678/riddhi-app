'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Add Meeting Modal ────────────────────────────────────
function AddMeetingModal({ onClose, onSaved, createdBy }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    title: '',
    date: todayStr,
    time: '',
    meetingUrl: '',
    description: '',
    visibleTo: 'all', // 'all' | 'coaches' | 'customers'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Meeting title required.'); return; }
    if (!form.date) { setError('Date required.'); return; }
    if (!form.time) { setError('Time required.'); return; }
    if (!form.meetingUrl.trim()) { setError('Meeting link required.'); return; }

    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'meetings'), {
        title: form.title.trim(),
        date: form.date,
        time: form.time,
        meetingUrl: form.meetingUrl.trim(),
        description: form.description.trim(),
        visibleTo: form.visibleTo,
        createdBy,
        createdAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '480px', width: '94vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>📅 Schedule Meeting</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Add a meeting for today or any upcoming date</p>
          </div>
          <button onClick={onClose} className="modal-close" id="add-meeting-close">×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '12px 0 0' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Meeting Title *</label>
            <input id="meeting-title" className="form-input" placeholder="e.g. Weekly Team Zoom" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input id="meeting-date" type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Time *</label>
              <input id="meeting-time" type="time" className="form-input" value={form.time} onChange={e => set('time', e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Meeting Link (Zoom / Google Meet) *</label>
            <input id="meeting-url" className="form-input" type="url" placeholder="https://zoom.us/j/..." value={form.meetingUrl} onChange={e => set('meetingUrl', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea id="meeting-desc" className="form-input" rows={2} placeholder="What is this meeting about?" value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div className="form-group">
            <label className="form-label">Visible To</label>
            <select id="meeting-visible" className="form-input" value={form.visibleTo} onChange={e => set('visibleTo', e.target.value)}>
              <option value="all">All Members</option>
              <option value="coaches">Coaches Only</option>
              <option value="customers">Customers Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving} style={{ width: '40%' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="meeting-save-btn" style={{ width: '60%' }}>
              {saving ? '⏳ Saving...' : '✅ Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Format time to 12hr AM/PM ────────────────────────────
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Is meeting happening soon (within 15 min or ongoing) ─
function getMeetingStatus(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const meetingMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = meetingMinutes - nowMinutes;

  if (diff <= 0 && diff > -60) return 'ongoing';   // started, within last 60 min
  if (diff > 0 && diff <= 15) return 'starting';  // starting in ≤15 min
  if (diff > 0 && diff <= 60) return 'soon';      // starting in ≤60 min
  if (diff > 60) return 'upcoming';
  return 'ended'; // more than 60 min ago
}

const STATUS_CONFIG = {
  ongoing: { label: '🔴 Live Now', bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', pulse: true },
  starting: { label: '🟡 Starting Soon', bg: '#fffbeb', color: '#d97706', border: '#fcd34d', pulse: true },
  soon: { label: '🔵 In 1 hr', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', pulse: false },
  upcoming: { label: '⏰ Upcoming', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', pulse: false },
  ended: { label: '✅ Ended', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', pulse: false },
};

// ── Main Component ────────────────────────────────────────
export default function TodaysMeetings({ userRole, userId }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tick, setTick] = useState(0); // for live status refresh

  const todayStr = new Date().toISOString().split('T')[0];
  const canAdd = userRole === 'coach' || userRole === 'admin';

  // Live refresh every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchMeetings(); }, [userId]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'meetings'), where('date', '==', todayStr))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter by visibleTo
      const filtered = list.filter(m => {
        if (m.visibleTo === 'all') return true;
        if (m.visibleTo === 'coaches' && (userRole === 'coach' || userRole === 'admin')) return true;
        if (m.visibleTo === 'customers' && userRole === 'customer') return true;
        return false;
      });

      // Sort by time
      filtered.sort((a, b) => a.time.localeCompare(b.time));
      setMeetings(filtered);
    } catch (err) {
      console.error('Meetings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!confirm('Delete this meeting?')) return;
    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
      fetchMeetings();
    } catch (err) {
      console.error(err);
    }
  };

  const liveCount = meetings.filter(m => ['ongoing', 'starting'].includes(getMeetingStatus(m.time))).length;
  const totalCount = meetings.length;

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #fdf4ff, #eff6ff)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>🎥</span>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0 }}>Today's Meetings</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {liveCount > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 10px', borderRadius: '99px',
                background: '#fef2f2', color: '#dc2626',
                fontSize: '0.72rem', fontWeight: '800',
                animation: 'pulseDot 1.5s infinite',
              }}>
                🔴 {liveCount} Live
              </span>
            )}
            {canAdd && (
              <button
                className="btn btn-outline btn-sm"
                style={{ width: 'auto', fontSize: '0.75rem', padding: '5px 12px' }}
                onClick={() => setShowAdd(true)}
                id="add-meeting-btn"
              >
                + Schedule
              </button>
            )}
          </div>
        </div>

        {/* ── Meeting List ── */}
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading meetings...
            </div>
          ) : meetings.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', fontSize: '0.9rem' }}>No meetings today</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {canAdd ? 'Click "+ Schedule" to add a meeting.' : 'No meetings scheduled for today.'}
              </p>
            </div>
          ) : (
            meetings.map((meeting, idx) => {
              const status = getMeetingStatus(meeting.time);
              const cfg = STATUS_CONFIG[status];
              return (
                <div
                  key={meeting.id}
                  id={`meeting-card-${meeting.id}`}
                  style={{
                    padding: '14px 20px',
                    borderBottom: idx < meetings.length - 1 ? '1px solid var(--bg-secondary)' : 'none',
                    background: status === 'ongoing' || status === 'starting'
                      ? 'linear-gradient(135deg, #fff5f5, #fdf4ff)'
                      : 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>

                    {/* Left: info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {meeting.title}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '800',
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                        🕐 {formatTime(meeting.time)}
                      </div>

                      {/* Description */}
                      {meeting.description && (
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                          {meeting.description}
                        </p>
                      )}

                      {/* Audience */}
                      {meeting.visibleTo !== 'all' && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '3px', display: 'inline-block' }}>
                          👥 {meeting.visibleTo === 'coaches' ? 'Coaches only' : 'Customers only'}
                        </span>
                      )}
                    </div>

                    {/* Right: buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'flex-end' }}>
                      {/* JOIN BUTTON */}
                      <a
                        href={meeting.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        id={`join-meeting-${meeting.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '8px', textDecoration: 'none',
                          fontWeight: '800', fontSize: '0.8rem', letterSpacing: '0.02em',
                          background: status === 'ongoing' || status === 'starting'
                            ? 'linear-gradient(135deg, #dc2626, #7c3aed)'
                            : 'var(--primary)',
                          color: 'white',
                          boxShadow: status === 'ongoing' || status === 'starting'
                            ? '0 4px 14px rgba(220,38,38,0.35)'
                            : '0 2px 8px rgba(22,163,74,0.25)',
                          transition: 'all 0.2s',
                          animation: (status === 'ongoing' || status === 'starting') ? 'joinPulse 2s infinite' : 'none',
                        }}
                      >
                        📹 Join Now
                      </a>

                      {/* Delete (admin/creator only) */}
                      {(meeting.createdBy === userId || userRole === 'admin') && (
                        <button
                          onClick={() => handleDelete(meeting.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.68rem', color: 'var(--text-muted)', padding: '2px 4px',
                          }}
                          id={`delete-meeting-${meeting.id}`}
                          title="Delete meeting"
                        >
                          🗑 Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer: total count ── */}
        {!loading && totalCount > 0 && (
          <div style={{
            padding: '8px 20px',
            background: 'var(--bg-secondary)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'right',
          }}>
            {totalCount} meeting{totalCount !== 1 ? 's' : ''} today
          </div>
        )}
      </div>

      {/* Add Meeting Modal */}
      {showAdd && (
        <AddMeetingModal
          onClose={() => setShowAdd(false)}
          onSaved={fetchMeetings}
          createdBy={userId}
        />
      )}

      {/* Pulse animation style */}
      <style>{`
        @keyframes joinPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(220,38,38,0.35); }
          50%       { box-shadow: 0 4px 22px rgba(220,38,38,0.6); transform: scale(1.02); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
