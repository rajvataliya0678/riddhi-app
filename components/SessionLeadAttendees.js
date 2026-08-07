'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CrmEnquiryModal from './CrmEnquiryModal';

// Quick Reschedule / Schedule Next Meeting Modal Component
function QuickRescheduleModal({ lead, onClose, onSaved }) {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [meetingDate, setMeetingDate] = useState(tomorrowStr);
  const [meetingSession, setMeetingSession] = useState('evening');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'crm_enquiries', lead.id);
      await updateDoc(docRef, {
        nextMeetingDate: meetingDate,
        nextMeetingSession: meetingSession,
        updatedAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error rescheduling lead:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '420px', width: '92vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
              📅 {lead.modalTitle || 'Schedule Next Session'}: {lead.name}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Set date & session time for the prospect's next live meeting
            </p>
          </div>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Next Meeting Date *</label>
            <input
              type="date"
              className="form-input"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Session Time *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMeetingSession('morning')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                  border: meetingSession === 'morning' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                  background: meetingSession === 'morning' ? '#e0f2fe' : 'white',
                  color: meetingSession === 'morning' ? '#0369a1' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                🌅 Morning (11:00 AM)
              </button>
              <button
                type="button"
                onClick={() => setMeetingSession('evening')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800',
                  border: meetingSession === 'evening' ? '2px solid #7e22ce' : '1px solid var(--border-color)',
                  background: meetingSession === 'evening' ? '#faf5ff' : 'white',
                  color: meetingSession === 'evening' ? '#6b21a8' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                🌇 Evening (07:45 PM)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Skip</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
              {saving ? '⏳ Saving...' : '💾 Schedule & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SessionLeadAttendees({ coachUid, userRole = 'coach' }) {
  const [leads, setLeads]               = useState([]);
  const [loading, setLoading]           = useState(true);

  const currentHour = new Date().getHours();
  const defaultSession = currentHour >= 14 ? 'evening' : 'morning';
  const [activeSession, setActiveSession] = useState(defaultSession);

  // Modals
  const [selectedLeadForEdit, setSelectedLeadForEdit]   = useState(null);
  const [selectedLeadForReschedule, setSelectedLeadForReschedule] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchLeads();
  }, [coachUid, userRole]);

  const fetchLeads = async () => {
    if (!coachUid) return;
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeads(list);
    } catch (err) {
      console.error('Error fetching session lead attendees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter leads scheduled for TODAY (excluding converted customers)
  const todayLeads = leads.filter(l => l.nextMeetingDate === todayStr && l.status !== 'Converted / Active Customer' && l.status !== 'Converted' && !l.isConverted && !l.convertedCustomerUid);
  const morningLeads = todayLeads.filter(l => (l.nextMeetingSession || 'morning') === 'morning');
  const eveningLeads = todayLeads.filter(l => l.nextMeetingSession === 'evening');

  const currentList = activeSession === 'morning' ? morningLeads : eveningLeads;

  const handleMarkAttended = async (lead) => {
    let nextStatus = '1 Session';
    let modalTitle = 'Schedule 2nd Live Meeting';

    if (lead.status === '1 Session') {
      nextStatus = '2 Session';
      modalTitle = 'Schedule Next / Closing Session';
    } else if (lead.status === '2 Session') {
      nextStatus = 'Closing';
      modalTitle = 'Schedule Closing Follow-up';
    } else if (lead.status === 'Closing') {
      nextStatus = 'Converted / Active Customer';
    }

    try {
      const docRef = doc(db, 'crm_enquiries', lead.id);
      const newHistory = [
        ...(lead.statusHistory || []),
        { from: lead.status || 'New Lead', to: nextStatus, timestamp: new Date().toISOString() }
      ];

      await updateDoc(docRef, {
        status: nextStatus,
        lastAttendedDate: todayStr,
        statusHistory: newHistory,
        updatedAt: serverTimestamp(),
      });

      fetchLeads();

      // Open schedule modal for next meeting
      setSelectedLeadForReschedule({
        ...lead,
        status: nextStatus,
        modalTitle,
      });
    } catch (err) {
      console.error('Error updating lead stage on attended:', err);
    }
  };

  const handleCrmSave = async (updatedData, leadId) => {
    if (leadId) {
      const docRef = doc(db, 'crm_enquiries', leadId);
      await updateDoc(docRef, { ...updatedData, updatedAt: serverTimestamp() });
    }
    setSelectedLeadForEdit(null);
    fetchLeads();
  };

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #fef3c7, #e0f2fe)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', margin: 0 }}>Today's Session CRM Prospects</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                Leads scheduled to join today's live Zoom sessions
              </p>
            </div>
          </div>

          {/* Session Toggle Tabs (Auto-switched by time) */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveSession('morning')}
              style={{
                padding: '3px 9px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                background: activeSession === 'morning' ? '#0284c7' : '#e0f2fe',
                color: activeSession === 'morning' ? 'white' : '#0369a1',
              }}
            >
              🌅 Morning ({morningLeads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSession('evening')}
              style={{
                padding: '3px 9px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                background: activeSession === 'evening' ? '#7e22ce' : '#faf5ff',
                color: activeSession === 'evening' ? 'white' : '#6b21a8',
              }}
            >
              🌇 Evening ({eveningLeads.length})
            </button>
          </div>
        </div>

        {/* Lead List Container */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading session prospects...
            </div>
          ) : currentList.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                {activeSession === 'morning' ? '🌅' : '🌇'}
              </div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', fontSize: '0.88rem' }}>
                No CRM leads scheduled for today's {activeSession === 'morning' ? 'Morning (11:00 AM)' : 'Evening (7:45 PM)'} session
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Set "Schedule Next Meeting" in CRM lead details to track attendee prospects here.
              </p>
            </div>
          ) : (
            currentList.map((lead, idx) => {
              const isAttendedToday = lead.lastAttendedDate === todayStr;

              return (
                <div
                  key={lead.id}
                  id={`session-lead-item-${lead.id}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < currentList.length - 1 ? '1px solid var(--border-color)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'var(--card-bg)',
                  }}
                >
                  {/* Row 1: Avatar + Name + Stage Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: activeSession === 'morning'
                          ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                          : 'linear-gradient(135deg, #7e22ce, #db2777)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.88rem', fontWeight: '800',
                      }}>
                        {lead.name?.charAt(0)?.toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            {lead.name}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: '800',
                            background: lead.status === '1 Session' ? '#e0f2fe' : lead.status === '2 Session' ? '#faf5ff' : '#f3f4f6',
                            color: lead.status === '1 Session' ? '#0369a1' : lead.status === '2 Session' ? '#6b21a8' : '#374151',
                            border: '1px solid var(--border-color)',
                            whiteSpace: 'nowrap'
                          }}>
                            {lead.status || 'New Lead'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Scheduled Today ({activeSession === 'morning' ? '🌅 Morning' : '🌇 Evening'})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        style={{
                          color: '#16a34a', fontSize: '0.74rem', fontWeight: '800', textDecoration: 'none',
                          background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 10px', borderRadius: '6px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                        title={`Call ${lead.phone}`}
                      >
                        📞 Call
                      </a>
                    )}

                    {isAttendedToday ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ padding: '5px 12px', fontSize: '0.74rem', fontWeight: '800', width: 'auto' }}
                        onClick={() => setSelectedLeadForReschedule({
                          ...lead,
                          modalTitle: lead.status === '1 Session' ? 'Schedule 2nd Live Meeting' : 'Schedule Next Session'
                        })}
                        title="Schedule next live meeting date and session time"
                      >
                        📅 Schedule Next Meeting
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '5px 10px', fontSize: '0.74rem', fontWeight: '800', width: 'auto' }}
                          onClick={() => handleMarkAttended(lead)}
                          title="Mark attended: Advances lead stage & opens schedule next meeting modal"
                        >
                          ✅ Attended
                        </button>

                        <button
                          type="button"
                          style={{
                            padding: '5px 10px', fontSize: '0.74rem', fontWeight: '800', borderRadius: '6px',
                            background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', cursor: 'pointer'
                          }}
                          onClick={() => setSelectedLeadForReschedule({ ...lead, modalTitle: 'Reschedule Missed Session' })}
                          title="Reschedule next meeting date if lead missed today"
                        >
                          📅 Reschedule
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedLeadForEdit && (
        <CrmEnquiryModal
          enquiry={selectedLeadForEdit}
          onSave={handleCrmSave}
          onClose={() => setSelectedLeadForEdit(null)}
          autoCallLogFocus={true}
        />
      )}

      {selectedLeadForReschedule && (
        <QuickRescheduleModal
          lead={selectedLeadForReschedule}
          onClose={() => setSelectedLeadForReschedule(null)}
          onSaved={fetchLeads}
        />
      )}
    </>
  );
}
