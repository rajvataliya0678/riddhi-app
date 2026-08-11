'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, X, ExternalLink, Clock, CheckCheck } from 'lucide-react';

function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export default function NotificationModal({ uid, userRole, userCreatedAt, onClose, onReadUpdated }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [uid, userRole, userCreatedAt]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'broadcast_notifications'), orderBy('sentAt', 'desc'))
      );

      const regDate = parseTimestamp(userCreatedAt);

      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => {
          if (n.deleted) return false;

          // Sent time filter: ONLY show notifications sent AFTER user registered
          const sentDate = parseTimestamp(n.sentAt);
          if (regDate && sentDate && sentDate.getTime() < (regDate.getTime() - 60000)) {
            return false;
          }

          // Audience filter
          if (n.audience === 'all') return true;
          if (n.audience === 'coaches' && (userRole === 'coach' || userRole === 'admin')) return true;
          if (n.audience === 'customers' && userRole === 'customer') return true;
          return false;
        });

      setNotifications(filtered);

      // Auto mark unread notifications as read when modal opens
      const unread = filtered.filter(n => !(n.readBy || []).includes(uid));
      if (unread.length > 0 && uid) {
        for (const un of unread) {
          updateDoc(doc(db, 'broadcast_notifications', un.id), {
            readBy: arrayUnion(uid),
          }).catch(e => console.warn(e));
        }
        if (onReadUpdated) onReadUpdated();
      }
    } catch (err) {
      console.error('Error fetching notification history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSentTime = (sentAt) => {
    if (!sentAt) return 'Just now';
    const dateObj = sentAt.toDate ? sentAt.toDate() : new Date(sentAt);
    if (isNaN(dateObj.getTime())) return 'Recently';

    const now = new Date();
    const isToday = now.toDateString() === dateObj.toDateString();

    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${dateStr}, ${timeStr}`;
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-card" style={{ maxWidth: '480px', width: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Bell size={18} color="#a5b4fc" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>Notifications</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#c7d2fe' }}>
                Announcements & updates sent to your account
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '8px', padding: '6px', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            id="close-notif-modal-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <span className="empty-state-icon" style={{ fontSize: '2.2rem' }}>🔔</span>
              <h4 style={{ fontSize: '0.92rem', margin: '8px 0 4px', fontWeight: '800' }}>No notifications yet</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                You will see announcements and updates sent after your registration here.
              </p>
            </div>
          ) : (
            notifications.map(n => {
              const isRead = (n.readBy || []).includes(uid);
              return (
                <div
                  key={n.id}
                  style={{
                    background: isRead ? 'var(--card-bg)' : 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
                    border: isRead ? '1px solid var(--border-color)' : '1px solid #93c5fd',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: isRead ? 'none' : '0 4px 12px rgba(59,130,246,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                      {n.title}
                    </h4>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                    }}>
                      <Clock size={12} />
                      {formatSentTime(n.sentAt)}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    {n.body}
                  </p>

                  {n.link && (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{
                        alignSelf: 'flex-start', marginTop: '4px',
                        padding: '5px 12px', fontSize: '0.74rem', borderRadius: '8px',
                        display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none'
                      }}
                    >
                      <span>Join / Open Link</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
