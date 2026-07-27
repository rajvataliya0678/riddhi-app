'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FollowUpFormModal from './FollowUpFormModal';

// ── Build the customer object FollowUpFormModal expects ──
function buildFollowUpCustomer(customer, followups) {
  const daysCompleted = followups.length > 0 ? Math.max(...followups.map(f => f.day)) : 0;
  const coachReadinessScore = followups.find(f => f.day === 10)?.coachReadinessScore ?? null;
  return {
    id: customer.uid,
    uid: customer.uid,
    isUserBased: true,
    fullName: customer.name,
    customerId: customer.uid.substring(0, 8).toUpperCase(),
    primaryGoal: customer.diagnosis?.fitnessGoal || 'Fitness',
    startingWeight: customer.diagnosis?.initialWeight || 0,
    targetWeight: customer.diagnosis?.goalWeight || 0,
    joiningDate: customer.createdAt?.toDate
      ? customer.createdAt.toDate().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    mainWhy: '',
    status: 'Active Customer',
    daysCompleted,
    coachReadinessScore,
  };
}

// ── Mini Day Progress Bar ────────────────────────────────
function DayProgressBar({ daysCompleted }) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => {
        const day = i + 1;
        const done = day <= daysCompleted;
        return (
          <div
            key={day}
            title={`Day ${day}`}
            style={{
              width: '14px', height: '14px', borderRadius: '3px',
              background: done ? 'var(--primary)' : 'var(--bg-tertiary)',
              border: done ? 'none' : '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          />
        );
      })}
      <span style={{ marginLeft: '6px', fontSize: '0.75rem', fontWeight: '700', color: daysCompleted >= 10 ? 'var(--primary)' : 'var(--text-muted)' }}>
        {daysCompleted}/10
      </span>
    </div>
  );
}

// ── Status chip ──────────────────────────────────────────
function StatusChip({ daysCompleted }) {
  if (daysCompleted >= 10) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'99px', background:'#f0fdf4', color:'#16a34a', fontSize:'0.72rem', fontWeight:'700', whiteSpace:'nowrap' }}>
      ✅ Complete
    </span>
  );
  if (daysCompleted > 0) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'99px', background:'#fffbeb', color:'#d97706', fontSize:'0.72rem', fontWeight:'700', whiteSpace:'nowrap' }}>
      🟡 Day {daysCompleted}/10
    </span>
  );
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'99px', background:'#f3f4f6', color:'#6b7280', fontSize:'0.72rem', fontWeight:'700', whiteSpace:'nowrap' }}>
      ⏳ Pending
    </span>
  );
}

export default function MyCustomersTab({ coachUid, coachName }) {
  const [customers, setCustomers]       = useState([]);
  const [followupsMap, setFollowupsMap] = useState({});
  const [loading, setLoading]           = useState(true);
  const [followUpCustomer, setFollowUpCustomer] = useState(null);
  const [followUpFollowups, setFollowUpFollowups] = useState([]);

  useEffect(() => { fetchData(); }, [coachUid]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. All customers assigned to this coach
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('coachId', '==', coachUid))
      );

      const customerList = [];
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();

        // Diagnosis (for goal)
        const diagSnap = await getDocs(
          query(collection(db, 'diagnosis'), where('uid', '==', userData.uid))
        );
        const diagnosis = diagSnap.empty ? null : diagSnap.docs[0].data();

        customerList.push({ ...userData, diagnosis });
      }

      // 2. All follow-ups for this coach
      const fuSnap = await getDocs(
        query(collection(db, 'customer_followups'), where('coachId', '==', coachUid))
      );
      const grouped = {};
      for (const fd of fuSnap.docs) {
        const d = { id: fd.id, ...fd.data() };
        const key = d.customerUid || d.customerProfileId;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
      }

      setCustomers(customerList);
      setFollowupsMap(grouped);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openFollowUp = (customer) => {
    const fus = followupsMap[customer.uid] || [];
    setFollowUpCustomer(buildFollowUpCustomer(customer, fus));
    setFollowUpFollowups(fus);
  };
  const closeFollowUp = () => { setFollowUpCustomer(null); setFollowUpFollowups([]); };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
        <p>Loading customers...</p>
      </div>
    );
  }

  // ── Compute per-customer stats ───────────────────────────
  const rows = customers.map(c => {
    const fus = followupsMap[c.uid] || [];
    const daysCompleted = fus.length > 0 ? Math.max(...fus.map(f => f.day)) : 0;
    const doneDays = fus.map(f => f.day).sort((a, b) => a - b);
    const pendingDays = Array.from({ length: 10 }, (_, i) => i + 1).filter(d => !doneDays.includes(d));
    const lastFu = fus.sort((a, b) => b.day - a.day)[0];
    const lastDate = lastFu?.followUpDate || null;
    const nextDay = daysCompleted < 10 ? daysCompleted + 1 : null;
    return { customer: c, daysCompleted, doneDays, pendingDays, lastDate, nextDay };
  });

  // Sort: in-progress first, then pending, then complete
  rows.sort((a, b) => {
    if (a.daysCompleted >= 10 && b.daysCompleted < 10) return 1;
    if (b.daysCompleted >= 10 && a.daysCompleted < 10) return -1;
    return b.daysCompleted - a.daysCompleted;
  });

  // Summary stats
  const total    = rows.length;
  const done     = rows.filter(r => r.daysCompleted >= 10).length;
  const inProg   = rows.filter(r => r.daysCompleted > 0 && r.daysCompleted < 10).length;
  const pending  = rows.filter(r => r.daysCompleted === 0).length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>My Customers</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          {total} customer{total !== 1 ? 's' : ''} — 10-Day Follow-Up Tracker
        </p>
      </div>

      {/* Quick summary pills */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total',       value: total,   bg: '#f3f4f6', color: '#374151'  },
          { label: 'Complete',    value: done,    bg: '#f0fdf4', color: '#16a34a'  },
          { label: 'In Progress', value: inProg,  bg: '#fffbeb', color: '#d97706'  },
          { label: 'Pending',     value: pending, bg: '#eff6ff', color: '#2563eb'  },
        ].map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 16px', borderRadius:'99px', background:s.bg, color:s.color }}>
            <span style={{ fontSize:'1.1rem', fontWeight:'900' }}>{s.value}</span>
            <span style={{ fontSize:'0.75rem', fontWeight:'600' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">👥</span>
          <h4>No customers assigned yet</h4>
          <p>When customers are assigned to you, they will appear here.</p>
        </div>
      ) : (
        <div className="crm-table-container">
          <table className="crm-table" id="my-customers-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Customer</th>
                <th style={{ width: '120px' }}>Goal</th>
                <th style={{ width: '200px' }}>10-Day Progress</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '130px' }}>Days Done</th>
                <th style={{ width: '130px' }}>Days Pending</th>
                <th style={{ width: '100px' }}>Last Follow-up</th>
                <th style={{ width: '120px' }}>Next Action</th>
                <th style={{ width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer, daysCompleted, doneDays, pendingDays, lastDate, nextDay }) => (
                <tr key={customer.uid} id={`customer-row-${customer.uid}`}>

                  {/* Name */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: '800',
                      }}>
                        {customer.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {customer.name}
                      </span>
                    </div>
                  </td>

                  {/* Goal */}
                  <td>
                    <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '600' }}>
                      {customer.diagnosis?.fitnessGoal || '—'}
                    </span>
                  </td>

                  {/* Progress bar */}
                  <td>
                    <DayProgressBar daysCompleted={daysCompleted} />
                  </td>

                  {/* Status */}
                  <td>
                    <StatusChip daysCompleted={daysCompleted} />
                  </td>

                  {/* Days Done */}
                  <td>
                    {doneDays.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {doneDays.map(d => (
                          <span key={d} style={{
                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700',
                            background: '#f0fdf4', color: '#16a34a',
                          }}>D{d}</span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Days Pending */}
                  <td>
                    {pendingDays.length === 0 ? (
                      <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: '600' }}>All done ✅</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {pendingDays.map(d => (
                          <span key={d} style={{
                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700',
                            background: '#fef2f2', color: '#dc2626',
                          }}>D{d}</span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Last follow-up date */}
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {lastDate
                      ? new Date(lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
                      : '—'}
                  </td>

                  {/* Next Action */}
                  <td>
                    {nextDay ? (
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#d97706' }}>
                        📋 Fill Day {nextDay}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Review / Re-follow</span>
                    )}
                  </td>

                  {/* Open button */}
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700' }}
                      onClick={() => openFollowUp(customer)}
                      id={`open-followup-${customer.uid}`}
                    >
                      {daysCompleted >= 10 ? '📖 View' : daysCompleted > 0 ? '✏️ Continue' : '▶ Start'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Follow-up Form Modal */}
      {followUpCustomer && (
        <FollowUpFormModal
          customer={followUpCustomer}
          followups={followUpFollowups}
          coachUid={coachUid}
          coachName={coachName}
          onClose={closeFollowUp}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
