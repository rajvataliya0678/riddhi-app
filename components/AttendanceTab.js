'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

// ── Get Last 4 Thursdays ─────────────────────────────────────
function getLast4Thursdays() {
  const dates = [];
  const d = new Date();
  // Go back to find the most recent Thursday (or today if Thursday)
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 4; i++) {
    dates.unshift(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() - 7);
  }
  return dates;
}

// ── 7-Day Attendance Tracker Bar ──────────────────────────────
function AttendanceTrackerBar({ label, icon, attendanceMap = {}, dates, color = '#16a34a' }) {
  const attendedCount = dates.filter(d => attendanceMap[d]).length;
  const total = dates.length;
  const pct = Math.round((attendedCount / total) * 100);

  return (
    <div style={{
      background: 'var(--card-bg)', padding: '12px 14px',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)' }}>
          {icon} {label}
        </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: '900',
          color: attendedCount >= Math.ceil(total * 0.7) ? '#16a34a' : attendedCount >= Math.ceil(total * 0.4) ? '#d97706' : '#dc2626'
        }}>
          {attendedCount}/{total} ({pct}%)
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        {dates.map(dateStr => {
          const isAttended = !!attendanceMap[dateStr];
          const dateObj = new Date(dateStr + 'T00:00:00');
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
          const dayNum = dateObj.getDate();

          return (
            <div
              key={dateStr}
              title={`${dateStr}: ${isAttended ? 'Present ✅' : 'Absent ⚪'}`}
              style={{
                flex: 1, textAlign: 'center', padding: '5px 2px',
                borderRadius: '6px',
                background: isAttended ? '#f0fdf4' : '#f9fafb',
                border: isAttended ? '1px solid #bbf7d0' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{dayName}</div>
              <div style={{ fontSize: '0.62rem', fontWeight: '700', color: 'var(--text-muted)' }}>{dayNum}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', marginTop: '2px', color: isAttended ? '#16a34a' : 'var(--text-muted)' }}>
                {isAttended ? '✅' : '⚪'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Person Attendance Card ────────────────────────────────────
function PersonAttendanceCard({ name, role, morningMap, eveningMap, trainingMap, dates7, datesThurs, showTraining }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '14px',
    }}>
      {/* Person Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          background: role === 'coach' ? 'linear-gradient(135deg, #10b981, #2563eb)' : 'linear-gradient(135deg, var(--primary), #2563eb)',
          color: 'white', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.95rem', fontWeight: '800',
        }}>
          {name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-main)' }}>{name}</h4>
          <span style={{
            fontSize: '0.68rem', fontWeight: '700', padding: '1px 8px', borderRadius: '4px',
            background: role === 'coach' ? '#eff6ff' : '#f0fdf4',
            color: role === 'coach' ? '#2563eb' : '#16a34a',
            border: role === 'coach' ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
          }}>
            {role === 'coach' ? '👨‍🏫 Coach' : role === 'admin' ? '👑 Club Owner' : '👤 Customer'}
          </span>
        </div>
      </div>

      {/* Tracker Bars */}
      <AttendanceTrackerBar label="Morning Session (Last 7 Days)" icon="🌅" attendanceMap={morningMap} dates={dates7} />
      <AttendanceTrackerBar label="Evening Session (Last 7 Days)" icon="🌇" attendanceMap={eveningMap} dates={dates7} />
      {showTraining && (
        <AttendanceTrackerBar label="Thursday Training (Last 4 Weeks)" icon="🎓" attendanceMap={trainingMap} dates={datesThurs} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── MAIN ATTENDANCE TAB COMPONENT ────────────────────────────
// ══════════════════════════════════════════════════════════════
export default function AttendanceTab({ user, userData }) {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [users, setUsers]                         = useState([]);
  const [loading, setLoading]                     = useState(true);

  const uid = user?.uid || '';
  const role = userData?.role || 'customer';
  const isCoach = role === 'coach' || role === 'admin';
  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchData();
  }, [uid, role]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch attendance records for last 30 days (covers 4 Thursdays)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(collection(db, 'meeting_attendance'), where('date', '>=', thirtyDaysAgoStr))
      );
      const attList = attSnap.docs.map(d => d.data());

      // Fetch users if coach or admin
      let userList = [];
      if (isCoach) {
        const usersSnap = await getDocs(collection(db, 'users'));
        userList = usersSnap.docs.map(d => ({ id: d.id, uid: d.data().uid || d.id, ...d.data() }));
      }

      setAttendanceRecords(attList);
      setUsers(userList);
    } catch (err) {
      console.error('Error fetching attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📅</div>
        <p>Loading Attendance Data...</p>
      </div>
    );
  }

  // ── Build attendance maps per user ────────────────────────────
  const buildMaps = (targetUid) => {
    const morning = {};
    const evening = {};
    const training = {};

    attendanceRecords.forEach(r => {
      if (r.uid !== targetUid) return;
      if (r.sessionType === 'morning') morning[r.date] = true;
      else if (r.sessionType === 'evening') evening[r.date] = true;
      else if (r.sessionType === 'training') training[r.date] = true;
    });

    return { morning, evening, training };
  };

  const dates7 = getLast7DaysDates();
  const datesThurs = getLast4Thursdays();
  const myMaps = buildMaps(uid);

  // Assigned customers (for coaches) or all customers (for admin)
  const assignedCustomers = isAdmin
    ? users.filter(u => u.role === 'customer' || !u.role)
    : isCoach
      ? users.filter(u => (u.coachId === uid || u.coachUid === uid) && (u.role === 'customer' || !u.role))
      : [];

  // Coaches (for admin only)
  const coachUsers = isAdmin
    ? users.filter(u => u.role === 'coach')
    : [];

  // Summary stats
  const customerMorningAvg = assignedCustomers.length > 0
    ? Math.round(assignedCustomers.reduce((sum, c) => {
        const m = buildMaps(c.uid);
        return sum + dates7.filter(d => m.morning[d]).length;
      }, 0) / assignedCustomers.length * 100 / 7)
    : 0;

  const customerEveningAvg = assignedCustomers.length > 0
    ? Math.round(assignedCustomers.reduce((sum, c) => {
        const m = buildMaps(c.uid);
        return sum + dates7.filter(d => m.evening[d]).length;
      }, 0) / assignedCustomers.length * 100 / 7)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── HEADER ── */}
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📅 Attendance Tracker
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Track daily Morning & Evening live session attendance{isCoach ? ', Thursday Training sessions,' : ''} and team participation
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: MY OWN ATTENDANCE                                */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="dashboard-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), #2563eb)',
            color: 'white', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.1rem', fontWeight: '800',
          }}>
            {userData?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
              My Attendance
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {userData?.name || 'User'} — {isAdmin ? '👑 Club Owner' : isCoach ? '👨‍🏫 Coach' : '👤 Customer'}
            </span>
          </div>
        </div>

        <AttendanceTrackerBar label="Morning Session (Last 7 Days)" icon="🌅" attendanceMap={myMaps.morning} dates={dates7} />
        <AttendanceTrackerBar label="Evening Session (Last 7 Days)" icon="🌇" attendanceMap={myMaps.evening} dates={dates7} />
        {isCoach && (
          <AttendanceTrackerBar label="Thursday Training (Last 4 Weeks)" icon="🎓" attendanceMap={myMaps.training} dates={datesThurs} />
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: COACHES ATTENDANCE (Club Owner Only)             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {isAdmin && coachUsers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              👨‍🏫 Coaches' Attendance ({coachUsers.length})
            </h3>

            {/* Thursday Training Summary */}
            {(() => {
              const thisThurs = datesThurs[datesThurs.length - 1];
              const attended = coachUsers.filter(c => {
                const m = buildMaps(c.uid);
                return m.training[thisThurs];
              }).length;
              return (
                <span style={{
                  fontSize: '0.75rem', fontWeight: '800', padding: '4px 12px', borderRadius: '6px',
                  background: attended === coachUsers.length ? '#f0fdf4' : '#fef3c7',
                  color: attended === coachUsers.length ? '#16a34a' : '#b45309',
                  border: attended === coachUsers.length ? '1px solid #bbf7d0' : '1px solid #fde68a',
                }}>
                  🎓 This Thursday: {attended}/{coachUsers.length} Attended
                </span>
              );
            })()}
          </div>

          {coachUsers.map(coach => {
            const cMaps = buildMaps(coach.uid);
            return (
              <PersonAttendanceCard
                key={coach.uid}
                name={coach.name}
                role="coach"
                morningMap={cMaps.morning}
                eveningMap={cMaps.evening}
                trainingMap={cMaps.training}
                dates7={dates7}
                datesThurs={datesThurs}
                showTraining={true}
              />
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: CUSTOMERS ATTENDANCE (Coaches & Club Owner)      */}
      {/* ════════════════════════════════════════════════════════════ */}
      {isCoach && assignedCustomers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              👥 {isAdmin ? "All Customers'" : "My Customers'"} Attendance ({assignedCustomers.length})
            </h3>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', display: 'block' }}>
                🌅 AVG MORNING ATTENDANCE
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#15803d' }}>
                {customerMorningAvg}%
              </span>
            </div>

            <div style={{
              background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>
                🌇 AVG EVENING ATTENDANCE
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#6b21a8' }}>
                {customerEveningAvg}%
              </span>
            </div>
          </div>

          {assignedCustomers.map(cust => {
            const cMaps = buildMaps(cust.uid);
            return (
              <PersonAttendanceCard
                key={cust.uid}
                name={cust.name}
                role="customer"
                morningMap={cMaps.morning}
                eveningMap={cMaps.evening}
                trainingMap={{}}
                dates7={dates7}
                datesThurs={datesThurs}
                showTraining={false}
              />
            );
          })}
        </div>
      )}

      {/* Empty state for customers with no data */}
      {!isCoach && assignedCustomers.length === 0 && (
        <div className="dashboard-card" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Your attendance is tracked above. Keep joining morning and evening sessions to maintain your streak! 💪
          </p>
        </div>
      )}

    </div>
  );
}
