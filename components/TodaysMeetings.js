'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  scheduleMeetingReminders,
} from '@/lib/meetingNotifications';

// ── Add / Schedule Meeting Modal ─────────────────────────
function AddMeetingModal({ onClose, onSaved, createdBy }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    title: '',
    recurrence: 'daily', // 'daily' (Daily Occurrence) | 'single' (Single Meeting)
    date: todayStr,
    time: '07:00',
    meetingUrl: '',
    visibleTo: 'customers', // 'customers' (For Customers) | 'coaches' (For Coaches Only)
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Meeting title required.'); return; }
    if (!form.time) { setError('Time required.'); return; }

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

          {/* Quick Time Presets */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Quick Session Time Presets</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => { set('time', '11:00'); set('visibleTo', 'customers'); }}
                style={{
                  padding: '6px 4px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                  border: form.time === '11:00' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                  background: form.time === '11:00' ? '#e0f2fe' : 'white',
                  color: form.time === '11:00' ? '#0369a1' : 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                🌅 Morning 11:00 AM
              </button>
              <button
                type="button"
                onClick={() => { set('time', '19:45'); set('visibleTo', 'customers'); }}
                style={{
                  padding: '6px 4px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                  border: form.time === '19:45' ? '2px solid #7e22ce' : '1px solid var(--border-color)',
                  background: form.time === '19:45' ? '#faf5ff' : 'white',
                  color: form.time === '19:45' ? '#6b21a8' : 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                🌇 Evening 07:45 PM
              </button>
              <button
                type="button"
                onClick={() => { set('time', '13:45'); set('visibleTo', 'coaches'); set('recurrence', 'single'); }}
                style={{
                  padding: '6px 4px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                  border: form.time === '13:45' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                  background: form.time === '13:45' ? '#eff6ff' : 'white',
                  color: form.time === '13:45' ? '#1d4ed8' : 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                🎓 Thu Training 01:45 PM
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

          {/* Meeting Link (OPTIONAL) */}
          <div className="form-group">
            <label className="form-label">Meeting Link (Zoom / Google Meet URL - Optional)</label>
            <input
              id="meeting-url"
              className="form-input"
              type="url"
              placeholder="https://zoom.us/j/... (Can be added 5 mins before session)"
              value={form.meetingUrl}
              onChange={e => set('meetingUrl', e.target.value)}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              * Link is optional. You can add or paste the link 5 minutes before the meeting starts.
            </p>
          </div>

          {/* Target Audience */}
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

// ── Quick Add/Edit Link Modal ─────────────────────────────
function QuickLinkModal({ meeting, onClose, onSaved }) {
  const [url, setUrl] = useState(meeting?.meetingUrl || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'meetings', meeting.id), {
        meetingUrl: url.trim(),
        updatedAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error updating meeting link:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '440px', width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
              🔗 {meeting?.meetingUrl ? 'Edit Meeting Link' : 'Add Meeting Link'}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {meeting?.title}
            </p>
          </div>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        <form onSubmit={handleSave} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Zoom / Google Meet URL</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              * You can paste or update the link anytime before session starts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
              {saving ? '⏳ Saving...' : '💾 Save Link'}
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

  let firstName = fullName.trim().split(' ')[0] || 'Member';
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  let coachFullName = userData?.coachName || (role !== 'customer' ? fullName : 'Coach');
  let coachFirstName = coachFullName.trim().split(' ')[0] || 'Coach';
  coachFirstName = coachFirstName.charAt(0).toUpperCase() + coachFirstName.slice(1);

  const roleTag = role === 'customer' ? 'CM' : 'CH';
  const unameRaw = `PRV/${roleTag}/${firstName}/${coachFirstName}`.toUpperCase();
  const unameParam = `uname=${encodeURIComponent(unameRaw)}`;

  if (baseUrl.includes('uname=')) {
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${unameParam}`;
}

// ── Main Component ────────────────────────────────────────
export default function TodaysMeetings({ user, userData, userRole, userId }) {
  const { t, language } = useAuth();
  const [meetings, setMeetings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [, setTick]                     = useState(0);

  const role = userRole || userData?.role || 'customer';
  const uid = userId || user?.uid || '';
  const canAdd = role === 'admin'; // Only Club Owners (admins) can schedule, edit, add links, or delete meetings

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchMeetings(); }, [uid, role]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'meetings')));
      const allMeetings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const filtered = allMeetings.filter(m => {
        const isToday = m.recurrence === 'daily' || m.date === todayStr;
        if (!isToday) return false;

        if (m.visibleTo === 'customers' || m.visibleTo === 'all' || !m.visibleTo) {
          return true;
        }

        if (m.visibleTo === 'coaches' && (role === 'coach' || role === 'admin')) {
          return true;
        }

        return false;
      });

      // ── Smart sort: Active/Ongoing/Upcoming first → Ended (after 60 mins) last ────
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const toMinutes = (timeStr = '') => {
        if (!timeStr) return 0;
        const ampm = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (ampm) {
          let h = parseInt(ampm[1]);
          const m = parseInt(ampm[2]);
          const period = ampm[3].toUpperCase();
          if (period === 'PM' && h !== 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        }
        const parts = timeStr.split(':');
        return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      };

      // Meetings stay active during their 60-minute duration
      const active = filtered.filter(m => toMinutes(m.time) + 60 >= nowMinutes);
      const ended  = filtered.filter(m => toMinutes(m.time) + 60 <  nowMinutes);

      active.sort((a, b) => toMinutes(a.time) - toMinutes(b.time)); // soonest first
      ended.sort((a, b)  => toMinutes(a.time) - toMinutes(b.time));

      const sorted = [...active, ...ended];
      // ── End smart sort ───────────────────────────────────────────────────────
      setMeetings(sorted);

      // ── Schedule a notification for each upcoming meeting ──────────────────
      // We pass the first meeting's URL as a fallback for the action listener.
      scheduleMeetingReminders(filtered, user, userData);
    } catch (err) {
      console.error('Meetings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!confirm(language === 'gu' ? 'શું તમે આ મીટિંગ રદ કરવા માંગો છો?' : 'Delete this meeting schedule?')) return;
    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
      fetchMeetings();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

// ── Strict Attendance Time Slot Validator ──────────────────────
// Locked Time Windows:
//  - Morning Session: 11:00 AM to 12:00 PM (660 to 720 mins)
//  - Evening Session: 07:45 PM to 08:45 PM (1185 to 1245 mins)
//  - Thursday Coach Training: 01:45 PM to 02:45 PM (825 to 885 mins, Thu Only)
function resolveAllowedAttendanceSession(meeting, now = new Date()) {
  const dayOfWeek = now.getDay(); // 0 = Sun, 4 = Thu
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = (hours * 60) + minutes;

  // Thursday Coach Training (Thu 1:45 PM to 2:45 PM)
  if (dayOfWeek === 4 && totalMinutes >= 825 && totalMinutes <= 885) {
    return 'training';
  }

  // Morning Session (11:00 AM to 12:00 PM)
  if (totalMinutes >= 660 && totalMinutes <= 720) {
    return 'morning';
  }

  // Evening Session (07:45 PM to 08:45 PM)
  if (totalMinutes >= 1185 && totalMinutes <= 1245) {
    return 'evening';
  }

  // Outside allowed slots → return null
  return null;
}

  const handleJoin = async (m) => {
    if (!m?.meetingUrl) return;

    let urlToOpen = buildCustomizedZoomUrl(m.meetingUrl, user, userData);
    if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
      urlToOpen = 'https://' + urlToOpen;
    }

    const sessionTypeToMark = resolveAllowedAttendanceSession(m, new Date());
    const targetUid = uid || user?.uid || '';

    if (sessionTypeToMark && targetUid) {
      try {
        await addDoc(collection(db, 'meeting_attendance'), {
          uid: targetUid,
          customerName: userData?.name || user?.displayName || 'Member',
          coachId: userData?.coachId || userData?.coachUid || '',
          userRole: role,
          date: todayStr,
          sessionType: sessionTypeToMark,
          meetingId: m.id || '',
          meetingTitle: m.title || 'Live Session',
          attendedAt: serverTimestamp(),
        });
        console.log('[Attendance] Successfully recorded present for:', sessionTypeToMark, targetUid);
      } catch (err) {
        console.error('[Attendance] Attendance mark error:', err);
      }
    } else {
      console.log('[Attendance] Joined outside allowed time window — attendance not recorded.');
    }

    if (typeof window !== 'undefined') {
      window.open(urlToOpen, '_blank', 'noopener,noreferrer');
    }
  };

  const liveCount = meetings.filter(m => ['ongoing', 'starting'].includes(getMeetingStatus(m.time))).length;

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #fdf4ff, #eff6ff)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>🎥</span>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0 }}>
                {t.todayMeetingsTitle}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {new Date().toLocaleDateString(language === 'gu' ? 'gu-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                + {language === 'gu' ? 'મીટિંગ ઉમેરો' : 'Schedule'}
              </button>
            )}
          </div>
        </div>

        {/* Meeting List Container */}
        <div style={{ maxHeight: '320px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ {t.loading}
            </div>
          ) : meetings.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span className="empty-state-icon" style={{ fontSize: '2rem' }}>📅</span>
              <h4 style={{ fontSize: '0.9rem', margin: '8px 0 4px' }}>{t.noMeetingsToday}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {canAdd ? (language === 'gu' ? 'નવી મીટિંગ ગોઠવવા માટે "+ મીટિંગ ઉમેરો" દબાવો.' : 'Click "+ Schedule" to set up a daily or one-time meeting.') : (language === 'gu' ? 'મીટિંગનો સમય થશે એટલે નોટિફિકેશન આવશે.' : 'Check back later for scheduled live sessions.')}
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

                    {/* Meeting Link / Join Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                      {m.meetingUrl ? (
                        <button
                          className="btn btn-primary"
                          style={{
                            flex: 1,
                            padding: '13px 18px',
                            fontSize: '1rem',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            borderRadius: '10px',
                            letterSpacing: '0.01em',
                            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                          }}
                          onClick={() => handleJoin(m)}
                          id={`join-meeting-btn-${m.id}`}
                        >
                          📹 Join Meeting
                        </button>
                      ) : (
                        <div style={{
                          flex: 1, padding: '7px 12px', borderRadius: '6px',
                          background: '#fffbeb', border: '1px solid #fcd34d', color: '#d97706',
                          fontSize: '0.75rem', fontWeight: '800', textAlign: 'center',
                        }}>
                          ⏳ Link Updating 5 Mins Before Session
                        </div>
                      )}

                      {canAdd && (
                        <button
                          type="button"
                          onClick={() => setEditingMeeting(m)}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800',
                            background: m.meetingUrl ? '#f3f4f6' : 'var(--primary)',
                            color: m.meetingUrl ? 'var(--text-main)' : 'white',
                            border: m.meetingUrl ? '1px solid var(--border-color)' : 'none',
                            cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                          title="Add or update Zoom/Meet link"
                        >
                          {m.meetingUrl ? '✏️ Edit Link' : '🔗 + Add Link'}
                        </button>
                      )}

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

      {/* Quick Add / Edit Link Modal */}
      {editingMeeting && (
        <QuickLinkModal
          meeting={editingMeeting}
          onClose={() => setEditingMeeting(null)}
          onSaved={fetchMeetings}
        />
      )}
    </>
  );
}
