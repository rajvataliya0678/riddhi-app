'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FollowUpFormModal from './FollowUpFormModal';
import CustomerDetailsModal from './CustomerDetailsModal';
import { MonthAttendanceCalendar } from './AttendanceTab';

// ── Build customer object for FollowUpFormModal ──────────
function buildFollowUpCustomer(customer, followups = []) {
  if (!customer) return {};
  const uid = customer.uid || customer.id || 'CUSTOMER';
  const daysCompleted = (followups && followups.length > 0) ? Math.max(...followups.map(f => f.day)) : 0;
  const coachReadinessScore = followups ? (followups.find(f => f.day === 10)?.coachReadinessScore ?? null) : null;

  let joiningDateStr = new Date().toISOString().split('T')[0];
  if (customer.createdAt) {
    if (typeof customer.createdAt.toDate === 'function') {
      joiningDateStr = customer.createdAt.toDate().toISOString().split('T')[0];
    } else if (typeof customer.createdAt === 'string') {
      joiningDateStr = customer.createdAt.split('T')[0];
    } else if (typeof customer.createdAt === 'number') {
      joiningDateStr = new Date(customer.createdAt).toISOString().split('T')[0];
    }
  }

  return {
    id: uid,
    uid: uid,
    isUserBased: true,
    fullName: customer.name || customer.fullName || 'Customer',
    customerId: uid.substring(0, 8).toUpperCase(),
    primaryGoal: customer.diagnosis?.fitnessGoal || 'Fitness',
    startingWeight: customer.diagnosis?.initialWeight || 0,
    targetWeight: customer.diagnosis?.goalWeight || 0,
    joiningDate: joiningDateStr,
    mainWhy: '',
    status: 'Active Customer',
    daysCompleted,
    coachReadinessScore,
  };
}

// ── Get Last 7 Days Date Strings ─────────────────────────────
function getLast7DaysDates() {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ── 7-Day Live Session Attendance Tracker Bar ──────────────
function SessionAttendanceBar({ label, icon, attendanceMap = {}, dates }) {
  const attendedCount = dates.filter(d => attendanceMap[d]).length;
  const pct = Math.round((attendedCount / 7) * 100);

  return (
    <div style={{
      background: 'var(--bg-secondary)', padding: '10px 12px',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-main)' }}>
          {icon} {label} (Last 7 Days)
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: '900', color: attendedCount >= 5 ? '#16a34a' : attendedCount >= 3 ? '#d97706' : '#dc2626' }}>
          {attendedCount}/7 Days ({pct}%)
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        {dates.map(dateStr => {
          const isAttended = !!attendanceMap[dateStr];
          const dateObj = new Date(dateStr + 'T00:00:00');
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });

          return (
            <div
              key={dateStr}
              title={`${dateStr} (${dayName}): ${isAttended ? 'Attended ✅' : 'Missed ⚪'}`}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '4px 2px',
                borderRadius: '6px',
                background: isAttended ? '#f0fdf4' : '#f9fafb',
                border: isAttended ? '1px solid #bbf7d0' : '1px solid var(--border-color)',
                color: isAttended ? '#16a34a' : 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase' }}>{dayName}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', marginTop: '1px' }}>
                {isAttended ? '✅' : '⚪'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress Bar Component ────────────────────────────────
function DayProgressBar({ daysCompleted }) {
  if (daysCompleted >= 10) {
    return (
      <span style={{
        fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)',
        background: '#f0fdf4', border: '1px solid var(--primary-mid)',
        padding: '3px 10px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '4px'
      }}>
        🔄 Ongoing (Day {daysCompleted})
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => {
        const day = i + 1;
        const done = day <= daysCompleted;
        return (
          <div
            key={day}
            title={`Day ${day}`}
            style={{
              width: '16px', height: '16px', borderRadius: '4px',
              background: done ? 'var(--primary)' : 'var(--bg-tertiary)',
              border: done ? 'none' : '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          />
        );
      })}
      <span style={{ marginLeft: '6px', fontSize: '0.78rem', fontWeight: '800', color: daysCompleted > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
        {daysCompleted}/10
      </span>
    </div>
  );
}

// ── Status Chip Component ─────────────────────────────────
function StatusChip({ daysCompleted }) {
  if (daysCompleted >= 10) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'99px', background:'#f0fdf4', color:'#16a34a', fontSize:'0.72rem', fontWeight:'700', whiteSpace:'nowrap' }}>
      🔄 3-Day Phase
    </span>
  );
  if (daysCompleted > 0) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'99px', background:'#fffbeb', color:'#d97706', fontSize:'0.72rem', fontWeight:'700', whiteSpace:'nowrap' }}>
      🟡 10-Day Phase
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
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading]           = useState(true);
  const [sortBy, setSortBy]             = useState('newest'); // 'newest' | 'oldest_pending' | 'name'
  const [viewMode, setViewMode]         = useState('boxes');  // 'boxes' | 'table'

  const [followUpCustomer, setFollowUpCustomer]   = useState(null);
  const [followUpFollowups, setFollowUpFollowups] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [autoCallLogFocus, setAutoCallLogFocus] = useState(false);

  const openCustomerDetails = (customer, callFocus = false) => {
    setSelectedCustomer(customer);
    setAutoCallLogFocus(callFocus);
  };

  const closeCustomerDetails = () => {
    setSelectedCustomer(null);
    setAutoCallLogFocus(false);
  };

  useEffect(() => { fetchData(); }, [coachUid]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('coachId', '==', coachUid))
      );

      const customerList = [];
      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const userData = { id: userDoc.id, uid: data.uid || userDoc.id, ...data };

        // Diagnosis
        const diagSnap = await getDocs(query(collection(db, 'diagnosis'), where('uid', '==', userData.uid)));
        userData.diagnosis = diagSnap.empty ? null : diagSnap.docs[0].data();

        // Weight logs
        const weightSnap = await getDocs(query(collection(db, 'weight_history'), where('uid', '==', userData.uid)));
        userData.weightLogs = weightSnap.docs.map(d => d.data());

        customerList.push(userData);
      }

      const followupsSnap = await getDocs(
        query(collection(db, 'customer_followups'), where('coachId', '==', coachUid))
      );
      const grouped = {};
      followupsSnap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const key = data.customerUid || data.customerProfileId;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(data);
      });

      // Fetch meeting attendance for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(collection(db, 'meeting_attendance'), where('date', '>=', thirtyDaysAgoStr))
      );

      const attMap = {};
      attSnap.docs.forEach(d => {
        const data = d.data();
        const u = data.uid;
        const date = data.date;
        const type = data.sessionType || 'morning';

        if (!attMap[u]) attMap[u] = { morning: {}, evening: {} };
        if (!attMap[u][type]) attMap[u][type] = {};
        attMap[u][type][date] = true;
      });

      setCustomers(customerList);
      setFollowupsMap(grouped);
      setAttendanceMap(attMap);
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

  const today = new Date();

  // ── Compute per-customer card data ───────────────────────
  const rows = customers.map(c => {
    const fus = followupsMap[c.uid] || [];
    const daysCompleted = fus.length > 0 ? Math.max(...fus.map(f => f.day)) : 0;
    const doneDays = fus.map(f => f.day).sort((a, b) => a - b);
    const nextDay = daysCompleted < 10
      ? daysCompleted + 1
      : (daysCompleted === 10 ? 13 : daysCompleted + 3);

    const pendingDays = daysCompleted < 10
      ? Array.from({ length: 10 }, (_, i) => i + 1).filter(d => !doneDays.includes(d))
      : [nextDay];

    const lastFu = fus.sort((a, b) => b.day - a.day)[0];
    const lastDate = lastFu?.followUpDate || null;

    // Calculate joining timestamp for sorting & days joined count
    const joinDate = c.createdAt?.toDate ? c.createdAt.toDate() : null;
    const joinTimestamp = joinDate ? joinDate.getTime() : 0;
    const daysJoined = joinDate ? Math.max(0, Math.floor((today - joinDate) / (1000 * 60 * 60 * 24))) : 0;

    // Calculate days pending age
    const baseDate = lastDate ? new Date(lastDate) : (joinDate || today);
    const daysPendingAge = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));

    // Calculate Result % Achieved
    const initialWeight = c.diagnosis?.initialWeight || c.startingWeight || 0;
    const goalWeight    = c.diagnosis?.goalWeight || c.targetWeight || 0;

    let latestWeight = initialWeight;
    const fusWithWeight = fus.filter(f => f.commonCheckin?.todaysWeight).sort((a, b) => b.day - a.day);
    if (fusWithWeight.length > 0) {
      latestWeight = fusWithWeight[0].commonCheckin.todaysWeight;
    } else if (c.weightLogs && c.weightLogs.length > 0) {
      latestWeight = c.weightLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].weight;
    }

    let resultPct = 0;
    let weightDiffText = '0 kg';

    if (initialWeight > 0 && goalWeight > 0 && latestWeight > 0) {
      const isWeightLoss = initialWeight > goalWeight;
      const targetDiff = Math.abs(initialWeight - goalWeight);
      if (isWeightLoss) {
        const diff = initialWeight - latestWeight;
        weightDiffText = diff > 0 ? `-${diff.toFixed(1)} kg` : `${diff.toFixed(1)} kg`;
        if (targetDiff > 0) {
          resultPct = Math.min(100, Math.max(0, Math.round((diff / targetDiff) * 100)));
        }
      } else {
        const diff = latestWeight - initialWeight;
        weightDiffText = diff > 0 ? `+${diff.toFixed(1)} kg` : `${diff.toFixed(1)} kg`;
        if (targetDiff > 0) {
          resultPct = Math.min(100, Math.max(0, Math.round((diff / targetDiff) * 100)));
        }
      }
    }

    return {
      customer: c,
      daysCompleted,
      doneDays,
      pendingDays,
      lastDate,
      nextDay,
      joinTimestamp,
      daysJoined,
      daysPendingAge,
      initialWeight,
      goalWeight,
      latestWeight,
      resultPct,
      weightDiffText,
    };
  });

  // ── Apply Sorting ─────────────────────────────────────────
  rows.sort((a, b) => {
    if (sortBy === 'newest') {
      if (b.joinTimestamp !== a.joinTimestamp) {
        return b.joinTimestamp - a.joinTimestamp;
      }
      return b.daysPendingAge - a.daysPendingAge;
    }

    if (sortBy === 'oldest_pending') {
      if (b.daysPendingAge !== a.daysPendingAge) {
        return b.daysPendingAge - a.daysPendingAge;
      }
      return b.joinTimestamp - a.joinTimestamp;
    }

    if (sortBy === 'name') {
      return (a.customer.name || '').localeCompare(b.customer.name || '');
    }

    return 0;
  });

  // Summary stats
  const total    = rows.length;
  const done     = rows.filter(r => r.daysCompleted >= 10).length;
  const inProg   = rows.filter(r => r.daysCompleted > 0 && r.daysCompleted < 10).length;
  const pending  = rows.filter(r => r.daysCompleted === 0).length;

  return (
    <div>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>My Customers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {total} customer{total !== 1 ? 's' : ''} assigned to you
          </p>
        </div>

        {/* Sort & View Mode Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer', outline: 'none' }}
              id="sort-customers-select"
            >
              <option value="newest">🆕 Joined Newest First</option>
              <option value="oldest_pending">⚠️ Oldest Pending Task First</option>
              <option value="name">🔤 Name (A-Z)</option>
            </select>
          </div>

          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('boxes')}
              id="view-mode-boxes"
              style={{
                padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: '700',
                background: viewMode === 'boxes' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'boxes' ? 'white' : 'var(--text-muted)',
              }}
            >
              📦 Boxes
            </button>
            <button
              onClick={() => setViewMode('table')}
              id="view-mode-table"
              style={{
                padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: '700',
                background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'table' ? 'white' : 'var(--text-muted)',
              }}
            >
              📋 Table
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Pills */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total',       value: total,   bg: '#f3f4f6', color: '#374151'  },
          { label: '3-Day Phase', value: done,    bg: '#f0fdf4', color: '#16a34a'  },
          { label: '10-Day Phase',value: inProg,  bg: '#fffbeb', color: '#d97706'  },
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
      ) : viewMode === 'boxes' ? (

        /* ── BOX GRID VIEW ────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {rows.map(({
            customer, daysCompleted, doneDays, pendingDays, lastDate, nextDay,
            daysJoined, daysPendingAge, resultPct, weightDiffText, latestWeight, goalWeight
          }) => (
            <div
              key={customer.uid}
              id={`customer-box-${customer.uid}`}
              className="dashboard-card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Card Top: Avatar, Name, Join Duration, Status */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      onClick={() => openCustomerDetails(customer)}
                      style={{
                        width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '1.1rem', fontWeight: '800',
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                      }}
                      title="Click to view customer details & call log"
                      id={`cust-avatar-${customer.uid}`}
                    >
                      {customer.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3
                          onClick={() => openCustomerDetails(customer)}
                          style={{ fontSize: '1.02rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', cursor: 'pointer' }}
                          title="Click to view customer details"
                          id={`cust-name-${customer.uid}`}
                        >
                          {customer.name}
                        </h3>
                        {customer.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (customer.phone) {
                                window.open(`tel:${customer.phone}`);
                              }
                              openCustomerDetails(customer, true);
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '3px 10px', borderRadius: '6px', cursor: 'pointer',
                              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                              fontSize: '0.74rem', fontWeight: '800',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                            title={`Call ${customer.name} (${customer.phone}) & log notes`}
                            id={`call-btn-${customer.uid}`}
                          >
                            📞 Call
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '700', background: 'var(--primary-light)', padding: '1px 7px', borderRadius: '4px' }}>
                          🗓️ Day {daysJoined + 1} ({daysJoined}d joined)
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusChip daysCompleted={daysCompleted} />
                </div>

                {/* Goal & Weight Target */}
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: '700', padding: '3px 10px', borderRadius: '6px',
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'
                  }}>
                    🏋️ {customer.diagnosis?.fitnessGoal || 'Fitness Goal'}
                  </span>
                  <span style={{ fontSize: '0.74rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                    Weight: {latestWeight > 0 ? `${latestWeight}kg` : '—'} {goalWeight > 0 && `(Target: ${goalWeight}kg)`}
                  </span>
                </div>

                {/* 🏆 Result Progress Insight Bar (% Achieved) */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  marginBottom: '14px', border: '1px solid var(--primary-mid)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)' }}>
                      🏆 Result Progress Insight
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#16a34a' }}>
                      {resultPct}% Result ({weightDiffText})
                    </span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${resultPct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #16a34a, #2563eb)',
                      borderRadius: '99px', transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* 10-Day Follow-up Progress Bar Section */}
                <div style={{
                  background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  marginBottom: '10px', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    10-Day Follow-Up Tracker Bar
                  </div>
                  <DayProgressBar daysCompleted={daysCompleted} />
                </div>

                {/* 🌅 Morning & 🌇 Evening Monthly Attendance Calendars */}
                {(() => {
                  const uAtt = attendanceMap[customer.uid] || { morning: {}, evening: {} };
                  return (
                    <div style={{ marginBottom: '6px' }}>
                      <MonthAttendanceCalendar
                        label="Morning Live Session"
                        icon="🌅"
                        attendanceMap={uAtt.morning}
                        colorScheme="green"
                      />
                      <MonthAttendanceCalendar
                        label="Evening Live Session"
                        icon="🌇"
                        attendanceMap={uAtt.evening}
                        colorScheme="purple"
                      />
                    </div>
                  );
                })()}

                {/* Days Done & Days Pending */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      DAYS DONE ({doneDays.length})
                    </span>
                    {doneDays.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None yet</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {doneDays.map(d => (
                          <span key={d} style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700', background: '#f0fdf4', color: '#16a34a' }}>
                            D{d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      NEXT PENDING
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {pendingDays.slice(0, 4).map(d => (
                        <span key={d} style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700', background: '#fef2f2', color: '#dc2626' }}>
                          D{d}
                        </span>
                      ))}
                      {pendingDays.length > 4 && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{pendingDays.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Followup & Pending Task info */}
                <div style={{
                  padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fcd34d',
                  marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#d97706' }}>
                      📋 Next Action: Fill Day {nextDay}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '2px' }}>
                      {lastDate ? `Last done: ${new Date(lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No follow-ups done yet'}
                    </div>
                  </div>
                  {daysPendingAge > 0 && (
                    <span style={{ fontSize: '0.68rem', fontWeight: '800', background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>
                      {daysPendingAge}d pending
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer: Action Button */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '0.85rem', fontWeight: '800', marginTop: '4px' }}
                onClick={() => openFollowUp(customer)}
                id={`box-open-followup-${customer.uid}`}
              >
                {daysCompleted === 0 ? '▶ Start Day 1 Follow-Up' : `✏️ Continue Day ${nextDay}`}
              </button>
            </div>
          ))}
        </div>
      ) : (

        /* ── TABLE VIEW ───────────────────────────────────────── */
        <div className="crm-table-container">
          <table className="crm-table" id="my-customers-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Customer</th>
                <th style={{ width: '100px' }}>Duration</th>
                <th style={{ width: '120px' }}>Result %</th>
                <th style={{ width: '160px' }}>Progress Bar</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '110px' }}>Days Done</th>
                <th style={{ width: '110px' }}>Days Pending</th>
                <th style={{ width: '110px' }}>Next Action</th>
                <th style={{ width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer, daysCompleted, doneDays, pendingDays, lastDate, nextDay, daysJoined, resultPct, weightDiffText }) => (
                <tr key={customer.uid} id={`customer-row-${customer.uid}`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        onClick={() => openCustomerDetails(customer)}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                          color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.85rem', fontWeight: '800',
                          cursor: 'pointer',
                        }}
                        title="Click to view customer details"
                      >
                        {customer.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            onClick={() => openCustomerDetails(customer)}
                            style={{ fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                            title="Click to view customer details"
                          >
                            {customer.name}
                          </span>
                          {customer.phone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (customer.phone) {
                                  window.open(`tel:${customer.phone}`);
                                }
                                openCustomerDetails(customer, true);
                              }}
                              style={{
                                color: '#16a34a', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer',
                                background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px'
                              }}
                              title={`Call ${customer.phone}`}
                            >
                              📞 Call
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--primary)' }}>
                          {customer.diagnosis?.fitnessGoal || 'Fitness'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      Day {daysJoined + 1}
                    </span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{daysJoined}d active</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', fontWeight: '900', color: '#16a34a' }}>
                      {resultPct}%
                    </span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{weightDiffText}</div>
                  </td>
                  <td><DayProgressBar daysCompleted={daysCompleted} /></td>
                  <td><StatusChip daysCompleted={daysCompleted} /></td>
                  <td>
                    {doneDays.length === 0 ? '—' : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {doneDays.map(d => (
                          <span key={d} style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700', background: '#f0fdf4', color: '#16a34a' }}>D{d}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {pendingDays.length === 0 ? (
                      <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: '600' }}>All done ✅</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {pendingDays.map(d => (
                          <span key={d} style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '700', background: '#fef2f2', color: '#dc2626' }}>D{d}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#d97706' }}>
                      📋 Day {nextDay}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700' }}
                      onClick={() => openFollowUp(customer)}
                      id={`open-followup-${customer.uid}`}
                    >
                      {daysCompleted === 0 ? '▶ Start' : '✏️ Continue'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Follow-Up Form Modal */}
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

      {/* Customer Details & Call Log Modal */}
      {selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          onClose={closeCustomerDetails}
          autoCallLogFocus={autoCallLogFocus}
          onCustomerUpdate={fetchData}
        />
      )}
    </div>
  );
}
