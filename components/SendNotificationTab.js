'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, serverTimestamp, orderBy, query, updateDoc, doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, Send, Users, GraduationCap, Globe, CheckCircle, Clock, Trash2 } from 'lucide-react';

// ── Audience config ────────────────────────────────────────
const AUDIENCE_OPTIONS = [
  { id: 'all',       label: 'Everyone',        sub: 'All customers & coaches', Icon: Globe,          color: '#6366f1' },
  { id: 'customers', label: 'Customers Only',  sub: 'All registered customers', Icon: Users,         color: '#0891b2' },
  { id: 'coaches',   label: 'Coaches Only',    sub: 'All coaches & club owner', Icon: GraduationCap, color: '#059669' },
];

// ── Quick Message Templates ────────────────────────────────
const TEMPLATES = [
  { title: '⚡ Session Alert',       body: 'Your Zoom session is starting in 5 minutes! Open the app and join now.' },
  { title: '📅 Schedule Change',     body: 'Today\'s session time has changed. Please check Today\'s Meetings for updated time.' },
  { title: '🏖️ Holiday Notice',      body: 'There will be no session today. Enjoy your rest day and see you tomorrow!' },
  { title: '💪 Motivation',          body: 'Keep pushing! Every workout brings you closer to your goal. See you on the call!' },
  { title: '📋 Reminder',            body: 'Please log your weight for today in the app so your coach can track your progress.' },
];

export default function SendNotificationTab({ adminUid, clubId = 'main' }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', link: '' });
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');
  const [history, setHistory]   = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Fetch sent notifications history ─────────────────────
  useEffect(() => { fetchHistory(); }, [clubId]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const snap = await getDocs(
        query(collection(db, 'broadcast_notifications'), orderBy('sentAt', 'desc'))
      );
      setHistory(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(n => (n.clubId || 'main') === clubId)
      );
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Send Notification ─────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title required.'); return; }
    if (!form.body.trim())  { setError('Message body required.'); return; }

    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'broadcast_notifications'), {
        title:     form.title.trim(),
        body:      form.body.trim(),
        audience:  form.audience,
        link:      form.link.trim() || '',
        sentBy:    adminUid,
        clubId:    clubId || 'main',
        sentAt:    serverTimestamp(),
        readBy:    [], // array of UIDs who have seen it
      });

      setSent(true);
      setForm({ title: '', body: '', audience: 'all', link: '' });
      fetchHistory();
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      console.error('Send error:', err);
      setError('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Delete notification from history ──────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this notification from history?')) return;
    try {
      await updateDoc(doc(db, 'broadcast_notifications', id), { deleted: true });
      fetchHistory();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const selectedAudience = AUDIENCE_OPTIONS.find(a => a.id === form.audience);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Compose Notification ─────────────────────────── */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '20px' }}>
          <Bell size={18} color="#6366f1" style={{ flexShrink: 0 }} />
          Send Notification to Users
        </h3>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>⚠️ {error}</div>
        )}
        {sent && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px',
            padding: '12px 16px', marginBottom: '16px', color: '#16a34a',
            fontWeight: '700', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <CheckCircle size={16} /> Notification sent successfully! Users will see it on next app open.
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Audience Selector */}
          <div className="form-group">
            <label className="form-label">Send To *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {AUDIENCE_OPTIONS.map(opt => {
                const IconComp = opt.Icon;
                const selected = form.audience === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set('audience', opt.id)}
                    style={{
                      padding: '12px 8px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer',
                      border: selected ? `2px solid ${opt.color}` : '1px solid var(--border-color)',
                      background: selected ? `${opt.color}15` : 'var(--card-bg)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <IconComp size={18} color={selected ? opt.color : 'var(--text-muted)'} style={{ marginBottom: '4px' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: selected ? opt.color : 'var(--text-main)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Templates */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Quick Templates</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => { set('title', t.title); set('body', t.body); }}
                  style={{
                    padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    border: '1px solid var(--border-color)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Notification Title *</label>
            <input
              id="notif-title"
              className="form-input"
              placeholder="e.g. ⚡ Session Starting Now!"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              maxLength={80}
              required
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {form.title.length}/80 characters
            </p>
          </div>

          {/* Body */}
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea
              id="notif-body"
              className="form-input"
              placeholder="Type your message to users..."
              value={form.body}
              onChange={e => set('body', e.target.value)}
              rows={3}
              maxLength={200}
              required
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {form.body.length}/200 characters
            </p>
          </div>

          {/* Optional Link */}
          <div className="form-group">
            <label className="form-label">Link (Optional — Zoom / Meeting URL)</label>
            <input
              id="notif-link"
              className="form-input"
              type="url"
              placeholder="https://zoom.us/j/... (Optional)"
              value={form.link}
              onChange={e => set('link', e.target.value)}
            />
          </div>

          {/* Preview */}
          {(form.title || form.body) && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              borderRadius: '12px', padding: '14px 16px',
              border: '1px solid rgba(99,102,241,0.3)',
            }}>
              <p style={{ fontSize: '0.68rem', fontWeight: '800', color: '#a5b4fc', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📱 Preview
              </p>
              <p style={{ color: '#fff', fontWeight: '800', fontSize: '0.88rem', margin: '0 0 4px' }}>
                {form.title || 'Notification Title'}
              </p>
              <p style={{ color: '#c7d2fe', fontSize: '0.78rem', margin: 0, lineHeight: '1.5' }}>
                {form.body || 'Message body...'}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending}
            style={{ width: 'auto', alignSelf: 'flex-start', gap: '8px', padding: '12px 28px', fontSize: '0.9rem', fontWeight: '800' }}
            id="send-notif-btn"
          >
            <Send size={16} />
            {sending ? 'Sending...' : `Send to ${selectedAudience?.label}`}
          </button>
        </form>
      </div>

      {/* ── Sent History ─────────────────────────────────── */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '16px' }}>
          <Clock size={17} color="#6b7280" style={{ flexShrink: 0 }} />
          Sent History
        </h3>

        {loadingHistory ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏳ Loading...</p>
        ) : history.filter(n => !n.deleted).length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon"><Bell size={36} color="#94a3b8" /></span>
            <h4>No notifications sent yet</h4>
            <p>Compose a message above and send it to your users.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.filter(n => !n.deleted).map(n => (
              <div key={n.id} style={{
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      {n.title}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                      background: n.audience === 'all' ? '#ede9fe' : n.audience === 'coaches' ? '#dcfce7' : '#dbeafe',
                      color:      n.audience === 'all' ? '#6d28d9' : n.audience === 'coaches' ? '#059669' : '#1d4ed8',
                    }}>
                      {n.audience === 'all' ? '🌐 Everyone' : n.audience === 'coaches' ? '👨‍🏫 Coaches' : '👥 Customers'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 4px', lineHeight: '1.5' }}>
                    {n.body}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>
                    👁 Seen by {n.readBy?.length || 0} users
                    {n.sentAt?.toDate && ` · ${n.sentAt.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-color)',
                    borderRadius: '6px', padding: '5px 8px', cursor: 'pointer',
                    color: 'var(--accent-danger)', flexShrink: 0,
                  }}
                  title="Delete from history"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
