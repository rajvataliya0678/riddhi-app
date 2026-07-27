'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FollowUpFormModal from './FollowUpFormModal';

// Build the customer object FollowUpFormModal expects
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

// Day label → what to say in the task
const DAY_TASK_LABELS = {
  1:  'Customer Story & WHY',
  2:  'Daily Routine Diagnosis',
  3:  'Food & Craving Diagnosis',
  4:  'Motivation & Mindset',
  5:  'Personal Connection',
  6:  'Result & Recognition',
  7:  'Reference Discovery',
  8:  'Coach Personality Discovery',
  9:  'Future Vision & Coach Interest',
  10: 'Journey Review & Next Step',
};

export default function CoachTodayTasks({ coachUid, coachName }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);

  // For opening follow-up form
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFollowups, setSelectedFollowups] = useState([]);
  const [allCustomersMap, setAllCustomersMap]   = useState({});
  const [allFollowupsMap, setAllFollowupsMap]   = useState({});

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => { fetchTasks(); }, [coachUid]);

  const fetchTasks = async () => {
    if (!coachUid) return;
    try {
      setLoading(true);

      // 1. All customers assigned to this coach
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('coachId', '==', coachUid))
      );

      const customersMap = {};
      for (const d of usersSnap.docs) {
        const u = d.data();
        // Diagnosis for goal label
        const diagSnap = await getDocs(query(collection(db, 'diagnosis'), where('uid', '==', u.uid)));
        u.diagnosis = diagSnap.empty ? null : diagSnap.docs[0].data();
        customersMap[u.uid] = u;
      }

      // 2. All follow-ups for this coach
      const fuSnap = await getDocs(
        query(collection(db, 'customer_followups'), where('coachId', '==', coachUid))
      );
      const followupsMap = {};
      for (const fd of fuSnap.docs) {
        const d = { id: fd.id, ...fd.data() };
        const key = d.customerUid || d.customerProfileId;
        if (!followupsMap[key]) followupsMap[key] = [];
        followupsMap[key].push(d);
      }

      setAllCustomersMap(customersMap);
      setAllFollowupsMap(followupsMap);

      // 3. Compute tasks
      const generatedTasks = [];

      for (const customer of Object.values(customersMap)) {
        const fus = followupsMap[customer.uid] || [];
        const daysCompleted = fus.length > 0 ? Math.max(...fus.map(f => f.day)) : 0;

        if (daysCompleted >= 10) continue; // fully done, no task

        const nextDay = daysCompleted + 1;

        // Determine urgency based on joining date
        let joinDate = null;
        if (customer.createdAt?.toDate) {
          joinDate = customer.createdAt.toDate();
        }

        let urgency = 'upcoming'; // default
        let daysDiff = 0;

        if (joinDate) {
          // Days since joining (0 = joined today)
          daysDiff = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
          const expectedDay = Math.min(daysDiff + 1, 10);

          if (nextDay <= expectedDay && nextDay > daysCompleted) {
            if (daysDiff === daysCompleted) {
              urgency = 'today'; // Expected exactly today
            } else if (daysDiff > daysCompleted) {
              urgency = 'overdue'; // Missed days
            }
          } else {
            urgency = 'upcoming';
          }
        } else {
          // No joining date — treat as due today if day 1 not done
          if (nextDay === 1) urgency = 'today';
        }

        // Check if today's follow-up was already done
        const todayDone = fus.some(f => f.followUpDate === todayStr && f.day === nextDay);
        if (todayDone) continue;

        generatedTasks.push({
          uid: customer.uid,
          customerName: customer.name,
          goal: customer.diagnosis?.fitnessGoal || '',
          nextDay,
          daysCompleted,
          dayLabel: DAY_TASK_LABELS[nextDay] || `Day ${nextDay}`,
          urgency,
          daysDiff,
        });
      }

      // Sort: overdue first → today → upcoming
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 };
      generatedTasks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      setTasks(generatedTasks);
    } catch (err) {
      console.error('CoachTodayTasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openTask = (task) => {
    const customer = allCustomersMap[task.uid];
    const fus = allFollowupsMap[task.uid] || [];
    if (!customer) return;
    setSelectedCustomer(buildFollowUpCustomer(customer, fus));
    setSelectedFollowups(fus);
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setSelectedFollowups([]);
    fetchTasks(); // refresh after save
  };

  const urgencyConfig = {
    overdue: { icon: '🔴', label: 'Overdue',  bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
    today:   { icon: '🟡', label: 'Due Today', bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
    upcoming:{ icon: '🔵', label: 'Upcoming',  bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  };

  const overdueCount = tasks.filter(t => t.urgency === 'overdue').length;
  const todayCount   = tasks.filter(t => t.urgency === 'today').length;

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>📌</span>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0 }}>Today's Follow-Up Tasks</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {overdueCount > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: '99px', background: '#fef2f2', color: '#dc2626', fontSize: '0.72rem', fontWeight: '800' }}>
                🔴 {overdueCount} Overdue
              </span>
            )}
            {todayCount > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: '99px', background: '#fffbeb', color: '#d97706', fontSize: '0.72rem', fontWeight: '800' }}>
                🟡 {todayCount} Due Today
              </span>
            )}
          </div>
        </div>

        {/* Task List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>All caught up!</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No pending follow-up tasks for today.</p>
            </div>
          ) : (
            tasks.map((task, idx) => {
              const cfg = urgencyConfig[task.urgency];
              return (
                <div
                  key={task.uid}
                  id={`coach-task-${task.uid}-day${task.nextDay}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px',
                    borderBottom: idx < tasks.length - 1 ? '1px solid var(--bg-secondary)' : 'none',
                    background: task.urgency === 'overdue' ? '#fff5f5' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                    color: 'white', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.9rem', fontWeight: '800',
                  }}>
                    {task.customerName?.charAt(0)?.toUpperCase()}
                  </div>

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        {task.customerName}
                      </span>
                      {/* Urgency badge */}
                      <span style={{
                        padding: '2px 8px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: '800',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        padding: '1px 7px', borderRadius: '4px', fontWeight: '700', fontSize: '0.7rem',
                      }}>
                        Day {task.nextDay}
                      </span>
                      <span>{task.dayLabel}</span>
                      {task.goal && <span style={{ color: 'var(--text-muted)' }}>· {task.goal}</span>}
                    </div>
                    {task.urgency === 'overdue' && task.daysDiff > task.daysCompleted && (
                      <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '2px', fontWeight: '600' }}>
                        ⚠️ {task.daysDiff - task.daysCompleted} day{task.daysDiff - task.daysCompleted > 1 ? 's' : ''} behind schedule
                      </div>
                    )}
                  </div>

                  {/* Progress mini */}
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '48px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)' }}>
                      {task.daysCompleted}/10
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>done</div>
                  </div>

                  {/* Open button */}
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0 }}
                    onClick={() => openTask(task)}
                    id={`task-open-${task.uid}`}
                  >
                    {task.daysCompleted === 0 ? '▶ Start' : '✏️ Fill Day ' + task.nextDay}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Follow-Up Form Modal */}
      {selectedCustomer && (
        <FollowUpFormModal
          customer={selectedCustomer}
          followups={selectedFollowups}
          coachUid={coachUid}
          coachName={coachName}
          onClose={closeModal}
          onSaved={fetchTasks}
        />
      )}
    </>
  );
}
