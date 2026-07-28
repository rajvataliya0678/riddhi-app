'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, getDocs, addDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Add / Schedule Meeting Modal ─────────────────────────
function AddMeetingModal({ onClose, onSaved, createdBy }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    title: '',
    recurrence: 'daily', // 'daily' (Daily Occurrence) | 'single' (Single Meeting)
    date: todayStr,
    time: '07:00',
    meetingUrl: '',
    visibleTo: 'customers', // 'customers' (For Customers - Available to Everyone) | 'coaches' (For Coaches Only)
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Meeting title required.'); return; }
    if (!form.time) { setError('Time required.'); return; }
    if (!form.meetingUrl.trim()) { setError('Meeting link required.'); return; }

    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'meetings'), {
        title: form.title.trim(),
        recurrence: form.recurrence,
        date: form.recurrence === 'single' ? form.date : todayStr,
        time: form.time,
        meetingUrl: form.meetingUrl.trim(),
        visibleTo: form.visibleTo,
        description: form.description.trim(),
        createdBy,
        createdAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving meeting:', err);
      setError('Failed to schedule meeting. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '500px', width: '94vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>🎥 Schedule Meeting</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Create a daily recurring meeting or a single event
            </p>
          </div>
          <button onClick={onClose} className="modal-close" id="add-meeting-close">×</button>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '12px 0 0' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          {/* Meeting Title */}
          <div className="form-group">
            <label className="form-label">Meeting Heading / Title *</label>
            <input
              id="meeting-title"
              className="form-input"
              placeholder="e.g. Daily Morning Fitness Club Zoom"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
            />
          </div>

          {/* Recurrence Selection: Daily vs Single */}
          <div className="form-group">
            <label className="form-label">Meeting Type (Recurrence) *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                id="type-daily-btn"
                onClick={() => set('recurrence', 'daily')}
                style={{
                  padding: '10px', borderRadius: '8px', border: form.recurrence === 'daily' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: form.recurrence === 'daily' ? 'var(--primary-light)' : 'var(--card-bg)',
                  color: form.recurrence === 'daily' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center',
                }}
              >
                🔁 Daily Occurrence
              </button>
              <button
                type="button"
                id="type-single-btn"
                onClick={() => set('recurrence', 'single')}
                style={{
                  padding: '10px', borderRadius: '8px', border: form.recurrence === 'single' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: form.recurrence === 'single' ? 'var(--primary-light)' : 'var(--card-bg)',
                  color: form.recurrence === 'single' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center',
                }}
              >
                📅 Single Meeting
              </button>
            </div>
          </div>

          {/* Time & Date */}
          <div className="form-row-2">
            {form.recurrence === 'single' && (
              <div className="form-group">
                <label className="form-label">Meeting Date *</label>
                <input
                  id="meeting-date"
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group" style={{ gridColumn: form.recurrence === 'daily' ? 'span 2' : 'auto' }}>
              <label className="form-label">Meeting Time *</label>
              <input
                id="meeting-time"
                type="time"
                className="form-input"
                value={form.time}
                onChange={e => set('time', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Meeting Link */}
          <div className="form-group">
            <label className="form-label">Meeting Link (Zoom / Google Meet URL) *</label>
            <input
              id="meeting-url"
              className="form-input"
              type="url"
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              value={form.meetingUrl}
              onChange={e => set('meetingUrl', e.target.value)}
              required
            />
          </div>

          {/* Target Audience / Feature Choice */}
          <div className="form-group">
            <label className="form-label">Target Audience (Who can see & join?) *</label>
            <select
              id="meeting-visible"
              className="form-input"
              value={form.visibleTo}
              onChange={e => set('visibleTo', e.target.value)}
              style={{ fontWeight: '700' }}
            >
              <option value="customers">👥 For Customers (Available for Everyone)</option>
              <option value="coaches">👨‍🏫 For Coaches Only (Coaches & Club Owner)</option>
            </select>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              * Customer meetings are automatically visible to all customers, coaches, and owners.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="meeting-save-btn" style={{ width: 'auto' }}>
              {saving ? '⏳ Saving...' : '✅ Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Format time ───────────────────────────────────────────
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Get Meeting Status ────────────────────────────────────
function getMeetingStatus(timeStr) {
  if (!timeStr) return 'upcoming';
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const meetingMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = meetingMinutes - nowMinutes;

  if (diff <= 0 && diff > -60) return 'ongoing';   // started within last 60 min
  if (diff > 0 && diff <= 15) return 'starting';  // starting in <=15 min
  if (diff > 0 && diff <= 60) return 'soon';      // starting in <=60 min
  if (diff > 60) return 'upcoming';
  return 'ended';
}

const STATUS_CONFIG = {
  ongoing:  { label: '🔴 Live Now', bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  starting: { label: '🟡 Starting Soon', bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
  soon:     { label: '🔵 In 1 hr', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  upcoming: { label: '⏰ Upcoming', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  ended:    { label: '✅ Ended', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
};

// ── Build Customized Zoom URL ──────────────────────────────
function buildCustomizedZoomUrl(baseUrl, user, userData) {
  if (!baseUrl) return '';

  const role = userData?.role || 'customer';
  const fullName = userData?.name || user?.displayName || 'Member';

  // Extract member first name
  let firstName = fullName.trim().split(' ')[0] || 'Member';
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  // Extract coach first name
  let coachFullName = userData?.coachName || (role !== 'customer' ? fullName : 'Coach');
  let coachFirstName = coachFullName.trim().split(' ')[0] || 'Coach';
  coachFirstName = coachFirstName.charAt(0).toUpperCase() + coachFirstName.slice(1);

  // Role tag: CM = Customer, CH = Coach/Admin
  const roleTag = role === 'customer' ? 'CM' : 'CH';

  // Construct parameter: PRV/<RoleTag>/<FirstName>/<CoachFirstName>
  // Customer: PRV/CM/<FirstName>/<CoachName> -> encoded: PRV%2FCM%2F<First_Name>%2F<Coach_Name>
  // Coach:    PRV/CH/<FirstName>/<CoachName> -> encoded: PRV%2FCH%2F<First_Name>%2F<Coach_Name>
  const unameRaw = `PRV/${roleTag}/${firstName}/${coachFirstName}`;
  const unameParam = `uname=${encodeURIComponent(unameRaw)}`;

  // Avoid duplicating if already present
  if (baseUrl.includes('uname=')) {
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${unameParam}`;
}

// ── Main Component ────────────────────────────────────────
export default function TodaysMeetings({ user, userData, userRole, userId }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [, setTick] = useState(0);

  const role = userRole || userData?.role || 'customer';
  const uid = userId || user?.uid || '';
  const canAdd = role === 'admin' || role === 'coach';

  const todayStr = new Date().toISOString().split('T')[0];

  // Live refresh every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchMeetings(); }, [uid, role]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'meetings'));
      const allMeetings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter meetings for today + role visibility
      const filtered = allMeetings.filter(m => {
        // 1. Date / Recurrence Match: Daily recurrence OR matches today's date
        const isToday = m.recurrence === 'daily' || m.date === todayStr;
        if (!isToday) return false;

        // 2. Role Visibility Match:
        // Everything for customer is available for everyone (customers, coaches, owners).
        if (m.visibleTo === 'customers' || m.visibleTo === 'all' || !m.visibleTo) {
          return true;
        }

        // Coaches-only meetings visible to coaches and owners
        if (m.visibleTo === 'coaches' && (role === 'coach' || role === 'admin')) {
          return true;
        }

        return false;
      });

      // Sort by time
      filtered.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      setMeetings(filtered);
    } catch (err) {
      console.error('Meetings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!confirm('Delete this meeting schedule?')) return;
    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
      fetchMeetings();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const liveCount = meetings.filter(m => ['ongoing', 'starting'].includes(getMeetingStatus(m.time))).length;

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

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
                padding: '3px 10px', borderRadius: '99px',
                background: '#fef2f2', color: '#dc2626',
                fontSize: '0.72rem', fontWeight: '800',
              }}>
                🔴 {liveCount} Live
              </span>
            )}
            {canAdd && (
              <button
                className="btn btn-primary"
                style={{ width: 'auto', fontSize: '0.78rem', padding: '6px 14px', fontWeight: '800' }}
                onClick={() => setShowAdd(true)}
                id="add-meeting-btn"
              >
                + Schedule
              </button>
            )}
          </div>
        </div>

        {/* ── Meeting List Container (Scrollable) ── */}
        <div style={{ maxHeight: '320px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading meetings...
            </div>
          ) : meetings.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', fontSize: '0.9rem' }}>No meetings scheduled today</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {canAdd ? 'Click "+ Schedule" to set up a daily or one-time meeting.' : 'Check back later for scheduled live sessions.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
              {meetings.map(m => {
                const st = getMeetingStatus(m.time);
                const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.upcoming;

                return (
                  <div
                    key={m.id}
                    id={`meeting-card-${m.id}`}
                    style={{
                      background: 'var(--card-bg)',
                      border: `1.5px solid ${cfg.border}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Top Row: Title + Badges */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                          {m.title}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>
                            ⏰ {formatTime(m.time)}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: '#f3f4f6', color: '#4b5563' }}>
                            {m.recurrence === 'daily' ? '🔁 Daily Occurrence' : '📅 Single Meeting'}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: m.visibleTo === 'coaches' ? '#fef3c7' : '#eff6ff', color: m.visibleTo === 'coaches' ? '#b45309' : '#2563eb' }}>
                            {m.visibleTo === 'coaches' ? '👨‍🏫 For Coaches' : '👥 For Customers (Everyone)'}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 10px', borderRadius: '99px',
                        background: cfg.bg, color: cfg.color,
                        fontSize: '0.72rem', fontWeight: '800', whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Join Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                      <button
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: '8px 14px',
                          fontSize: '0.82rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center',
                          gap: '6px',
                        }}
                        onClick={() => {
                          const finalUrl = buildCustomizedZoomUrl(
                            m.meetingUrl,
                            user,
                            userData
                          );
                          window.open(finalUrl, '_blank');
                        }}
                        id={`join-meeting-btn-${m.id}`}
                      >
                        📹 Join Meeting
                      </button>

                      {canAdd && (
                        <button
                          onClick={() => handleDelete(m.id)}
                          style={{
                            background: 'transparent', border: '1px solid var(--border-color)',
                            borderRadius: '6px', padding: '6px 10px', fontSize: '0.75rem',
                            color: 'var(--accent-danger)', cursor: 'pointer', fontWeight: '700',
                          }}
                          title="Delete meeting schedule"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Meeting Modal */}
      {showAdd && (
        <AddMeetingModal
          onClose={() => setShowAdd(false)}
          onSaved={fetchMeetings}
          createdBy={uid}
        />
      )}
    </>
  );
}
