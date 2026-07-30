'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Get Calendar Grid Cells for a given Month & Year ──────────
function getMonthCalendarGrid(year, month) {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 6 = Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // Total days in month (28-31)

  const cells = [];
  // Empty offset cells for days before the 1st of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ isOffset: true, key: `offset-${i}` });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const dayOfWeek = new Date(year, month, day).getDay();

    cells.push({
      isOffset: false,
      dayNum: day,
      dateStr,
      dayOfWeek,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      key: dateStr,
    });
  }

  return cells;
}

// ── Month Calendar Attendance Grid Component ─────────────────
export function MonthAttendanceCalendar({
  label,
  icon,
  attendanceMap = {},
  year = new Date().getFullYear(),
  month = new Date().getMonth(),
  isTrainingOnly = false,
  colorScheme = 'green', // 'green' | 'purple' | 'blue'
}) {
  const cells = getMonthCalendarGrid(year, month);
  const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long' });

  // Filter valid day cells
  const dayCells = cells.filter(c => !c.isOffset);
  const pastOrTodayCells = dayCells.filter(c => !c.isFuture);
  const activeTrackableCells = isTrainingOnly
    ? pastOrTodayCells.filter(c => c.dayOfWeek === 4) // Thursdays only
    : pastOrTodayCells;

  const attendedCount = activeTrackableCells.filter(c => attendanceMap[c.dateStr]).length;
  const totalTrackable = activeTrackableCells.length || 1;
  const pct = Math.round((attendedCount / totalTrackable) * 100);

  // Badge colors per scheme
  const theme = colorScheme === 'purple' ? {
    headerColor: '#7e22ce',
    attendedBg: '#faf5ff',
    attendedBorder: '#e9d5ff',
    attendedText: '#7e22ce',
  } : colorScheme === 'blue' ? {
    headerColor: '#2563eb',
    attendedBg: '#eff6ff',
    attendedBorder: '#bfdbfe',
    attendedText: '#1d4ed8',
  } : {
    headerColor: '#16a34a',
    attendedBg: '#f0fdf4',
    attendedBorder: '#bbf7d0',
    attendedText: '#15803d',
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '8px 10px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      marginBottom: '6px',
    }}>
      {/* Calendar Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.8rem' }}>{icon}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {label} ({monthName} {year})
          </span>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: '900',
          color: attendedCount >= Math.ceil(totalTrackable * 0.7) ? '#16a34a' : attendedCount >= Math.ceil(totalTrackable * 0.4) ? '#d97706' : '#dc2626'
        }}>
          {attendedCount}/{totalTrackable} ({pct}%)
        </span>
      </div>

      {/* Days of Week Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        textAlign: 'center',
        marginBottom: '2px',
      }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, idx) => (
          <div key={idx} style={{
            fontSize: '0.55rem',
            fontWeight: '800',
            color: idx === 4 && isTrainingOnly ? '#2563eb' : 'var(--text-muted)',
            padding: '1px 0',
          }}>
            {dayName}
          </div>
        ))}
      </div>

      {/* Month Calendar Grid (Small Compact Boxes) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
      }}>
        {cells.map(cell => {
          if (cell.isOffset) {
            return <div key={cell.key} style={{ minHeight: '22px' }} />;
          }

          const isAttended = !!attendanceMap[cell.dateStr];
          const isThursday = cell.dayOfWeek === 4;
          const isDisabled = isTrainingOnly && !isThursday;

          let bg = isAttended ? theme.attendedBg : cell.isFuture ? '#f9fafb' : '#f3f4f6';
          let border = cell.isToday ? '2px solid #2563eb' : isAttended ? `1px solid ${theme.attendedBorder}` : '1px solid var(--border-color)';
          let textColor = isAttended ? theme.attendedText : cell.isFuture ? '#cbd5e1' : '#64748b';

          if (isDisabled) {
            bg = '#f8fafc';
            border = '1px dashed #e2e8f0';
            textColor = '#cbd5e1';
          }

          return (
            <div
              key={cell.key}
              title={`${cell.dateStr}: ${isAttended ? 'Present ✅' : isDisabled ? 'No Training Scheduled' : 'Absent ⚪'}`}
              style={{
                borderRadius: '4px',
                background: bg,
                border: border,
                padding: '2px 1px',
                textAlign: 'center',
                minHeight: '22px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                boxShadow: cell.isToday ? '0 0 0 1px rgba(37, 99, 235, 0.25)' : 'none',
              }}
            >
              <span style={{ fontSize: '0.58rem', fontWeight: '800', color: textColor, lineHeight: 1 }}>
                {cell.dayNum}
              </span>
              <span style={{ fontSize: '0.5rem', marginTop: '1px', lineHeight: 1 }}>
                {isAttended ? '✅' : isDisabled ? '•' : cell.isFuture ? '' : '⚪'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Person Attendance Card Component ──────────────────────────
function PersonAttendanceCard({ name, role, morningMap, eveningMap, trainingMap, year, month, showTraining }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '12px',
    }}>
      {/* Person Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: role === 'coach' ? 'linear-gradient(135deg, #10b981, #2563eb)' : 'linear-gradient(135deg, var(--primary), #2563eb)',
          color: 'white', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.85rem', fontWeight: '800',
        }}>
          {name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>{name}</h4>
          <span style={{
            fontSize: '0.64rem', fontWeight: '700', padding: '1px 6px', borderRadius: '4px',
            background: role === 'coach' ? '#eff6ff' : '#f0fdf4',
            color: role === 'coach' ? '#2563eb' : '#16a34a',
            border: role === 'coach' ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
          }}>
            {role === 'coach' ? '👨‍🏫 Coach' : role === 'admin' ? '👑 Club Owner' : '👤 Customer'}
          </span>
        </div>
      </div>

      {/* Month Calendar Grids (Side-by-side) */}
      <div style={{ display: 'grid', gridTemplateColumns: showTraining ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr 1fr', gap: '8px' }}>
        <MonthAttendanceCalendar
          label="Morning Session"
          icon="🌅"
          attendanceMap={morningMap}
          year={year}
          month={month}
          colorScheme="green"
        />
        <MonthAttendanceCalendar
          label="Evening Session"
          icon="🌇"
          attendanceMap={eveningMap}
          year={year}
          month={month}
          colorScheme="purple"
        />
        {showTraining && (
          <MonthAttendanceCalendar
            label="Thursday Training"
            icon="🎓"
            attendanceMap={trainingMap}
            year={year}
            month={month}
            isTrainingOnly={true}
            colorScheme="blue"
          />
        )}
      </div>
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

  // Month navigation state (default: current year & month)
  const now = new Date();
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

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

      // Fetch attendance records for last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(collection(db, 'meeting_attendance'), where('date', '>=', ninetyDaysAgoStr))
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

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📅</div>
        <p>Loading Attendance Calendar...</p>
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

  // Calculate Month Days Stats for Customers
  const selectedMonthCells = getMonthCalendarGrid(selectedYear, selectedMonth).filter(c => !c.isOffset && !c.isFuture);
  const trackableCount = selectedMonthCells.length || 1;

  const customerMorningAvg = assignedCustomers.length > 0
    ? Math.round(assignedCustomers.reduce((sum, c) => {
        const m = buildMaps(c.uid);
        return sum + selectedMonthCells.filter(d => m.morning[d.dateStr]).length;
      }, 0) / assignedCustomers.length * 100 / trackableCount)
    : 0;

  const customerEveningAvg = assignedCustomers.length > 0
    ? Math.round(assignedCustomers.reduce((sum, c) => {
        const m = buildMaps(c.uid);
        return sum + selectedMonthCells.filter(d => m.evening[d.dateStr]).length;
      }, 0) / assignedCustomers.length * 100 / trackableCount)
    : 0;

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── HEADER & MONTH NAVIGATOR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 Monthly Attendance Calendar
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Visual calendar grid tracking for Morning, Evening & Thursday Training sessions
          </p>
        </div>

        {/* Month Selector Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--card-bg)', border: '1px solid var(--border-color)',
          padding: '6px 12px', borderRadius: 'var(--radius-md)'
        }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="btn btn-sm btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.8rem' }}
          >
            ◀
          </button>
          <span style={{ fontWeight: '800', fontSize: '0.9rem', minWidth: '120px', textAlign: 'center', color: 'var(--text-main)' }}>
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="btn btn-sm btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.8rem' }}
          >
            ▶
          </button>
          <button
            type="button"
            onClick={handleCurrentMonth}
            className="btn btn-sm btn-primary"
            style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: '800' }}
          >
            Today
          </button>
        </div>
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
              My Attendance Calendar
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {userData?.name || 'User'} — {isAdmin ? '👑 Club Owner' : isCoach ? '👨‍🏫 Coach' : '👤 Customer'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          <MonthAttendanceCalendar
            label="Morning Session"
            icon="🌅"
            attendanceMap={myMaps.morning}
            year={selectedYear}
            month={selectedMonth}
            colorScheme="green"
          />
          <MonthAttendanceCalendar
            label="Evening Session"
            icon="🌇"
            attendanceMap={myMaps.evening}
            year={selectedYear}
            month={selectedMonth}
            colorScheme="purple"
          />
          {isCoach && (
            <MonthAttendanceCalendar
              label="Thursday Training"
              icon="🎓"
              attendanceMap={myMaps.training}
              year={selectedYear}
              month={selectedMonth}
              isTrainingOnly={true}
              colorScheme="blue"
            />
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: COACHES ATTENDANCE (Club Owner Only)             */}
      {/* ════════════════════════════════════════════════════════════ */}
      {isAdmin && coachUsers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              👨‍🏫 Coaches' Attendance Calendars ({coachUsers.length})
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '14px' }}>
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
                  year={selectedYear}
                  month={selectedMonth}
                  showTraining={true}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: CUSTOMERS ATTENDANCE (Coaches & Club Owner)      */}
      {/* ════════════════════════════════════════════════════════════ */}
      {isCoach && assignedCustomers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              👥 {isAdmin ? "All Customers'" : "My Customers'"} Attendance Calendars ({assignedCustomers.length})
            </h3>
          </div>

          {/* Monthly Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', display: 'block' }}>
                🌅 MONTHLY AVG MORNING ATTENDANCE
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#15803d' }}>
                {customerMorningAvg}%
              </span>
            </div>

            <div style={{
              background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '14px',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>
                🌇 MONTHLY AVG EVENING ATTENDANCE
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#6b21a8' }}>
                {customerEveningAvg}%
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '14px' }}>
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
                  year={selectedYear}
                  month={selectedMonth}
                  showTraining={false}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for customers with no data */}
      {!isCoach && assignedCustomers.length === 0 && (
        <div className="dashboard-card" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Your monthly attendance calendar is tracked above. Keep joining morning and evening sessions to maintain your streak! 💪
          </p>
        </div>
      )}

    </div>
  );
}
