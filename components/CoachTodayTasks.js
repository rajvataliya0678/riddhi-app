'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FollowUpFormModal from './FollowUpFormModal';
import CrmEnquiryModal from './CrmEnquiryModal';
import CustomerDetailsModal from './CustomerDetailsModal';

// Helper: Build the customer object FollowUpFormModal expects
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

// Day label mapping for 10-day program
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

export default function CoachTodayTasks({ coachUid, coachName, userRole = 'coach' }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all'); // 'all' | 'overdue' | 'today'

  // Modals state
  const [selectedCustomer, setSelectedCustomer]             = useState(null);
  const [selectedFollowups, setSelectedFollowups]           = useState([]);
  const [selectedCrmLead, setSelectedCrmLead]               = useState(null);
  const [selectedDetailsCustomer, setSelectedDetailsCustomer] = useState(null);

  const [allCustomersMap, setAllCustomersMap] = useState({});
  const [allFollowupsMap, setAllFollowupsMap] = useState({});

  const isAdmin = userRole === 'admin';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  useEffect(() => {
    fetchTasks();
  }, [coachUid, userRole]);

  const fetchTasks = async () => {
    if (!coachUid) return;
    try {
      setLoading(true);

      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsersList = usersSnap.docs.map(d => ({ id: d.id, uid: d.data().uid || d.id, ...d.data() }));

      // Assigned customers for coach, or all customers for admin
      const assignedCustomers = isAdmin
        ? allUsersList.filter(u => u.role === 'customer' || !u.role)
        : allUsersList.filter(u => (u.coachId === coachUid || u.coachUid === coachUid) && (u.role === 'customer' || !u.role));

      // Coach users (for admin tasks)
      const coachUsers = allUsersList.filter(u => u.role === 'coach');

      const customersMap = {};
      for (const u of assignedCustomers) {
        const diagSnap = await getDocs(query(collection(db, 'diagnosis'), where('uid', '==', u.uid)));
        u.diagnosis = diagSnap.empty ? null : diagSnap.docs[0].data();
        customersMap[u.uid] = u;
      }

      // 2. Fetch Followups
      const fuSnap = await getDocs(
        isAdmin
          ? collection(db, 'customer_followups')
          : query(collection(db, 'customer_followups'), where('coachId', '==', coachUid))
      );
      const followupsMap = {};
      fuSnap.docs.forEach(fd => {
        const d = { id: fd.id, ...fd.data() };
        const key = d.customerUid || d.customerProfileId;
        if (!followupsMap[key]) followupsMap[key] = [];
        followupsMap[key].push(d);
      });

      // 3. Fetch CRM Enquiries
      const crmSnap = await getDocs(
        isAdmin
          ? collection(db, 'crm_enquiries')
          : query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid))
      );
      const crmLeads = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 4. Fetch Meeting Attendance (last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(collection(db, 'meeting_attendance'), where('date', '>=', threeDaysAgoStr))
      );
      const attendanceList = attSnap.docs.map(d => d.data());

      // 5. Fetch Weight History (last 3 days)
      const weightSnap = await getDocs(
        query(collection(db, 'weight_history'), where('date', '>=', threeDaysAgoStr))
      );
      const weightHistoryList = weightSnap.docs.map(d => d.data());

      setAllCustomersMap(customersMap);
      setAllFollowupsMap(followupsMap);

      // ── COMPUTE ALL TASKS ACCORDING TO RULES ─────────────────────
      const generatedTasks = [];

      // ─────────────────────────────────────────────────────────────
      // RULE 1: CRM Follow-up Date Tasks
      // ─────────────────────────────────────────────────────────────
      for (const lead of crmLeads) {
        if (lead.status === 'Converted / Active Customer') continue;
        if (!lead.followUpDate) continue;

        const fuDateStr = lead.followUpDate.split('T')[0];
        if (fuDateStr <= todayStr) {
          const isOverdue = fuDateStr < todayStr;
          generatedTasks.push({
            id: `crm-${lead.id}`,
            type: 'crm_followup',
            uid: lead.id,
            name: lead.name,
            phone: lead.phone || '',
            goal: lead.status || 'Lead',
            title: `📋 CRM Lead Follow-up: ${lead.name}`,
            description: `Follow-up date reached (${fuDateStr}) · Stage: ${lead.status || 'New Lead'}`,
            urgency: isOverdue ? 'overdue' : 'today',
            actionType: 'open_crm_modal',
            leadObj: lead,
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // RULE 2: Customer Missed Live Meeting Yesterday Tasks
      // ─────────────────────────────────────────────────────────────
      for (const cust of assignedCustomers) {
        const attendedYesterday = attendanceList.some(
          a => a.uid === cust.uid && a.date === yesterdayStr
        );
        if (!attendedYesterday) {
          generatedTasks.push({
            id: `missed-meeting-${cust.uid}`,
            type: 'customer_missed_meeting',
            uid: cust.uid,
            name: cust.name || cust.fullName || 'Customer',
            phone: cust.phone || '',
            goal: cust.diagnosis?.fitnessGoal || '',
            title: `🌅 Missed Live Meeting Yesterday: ${cust.name || cust.fullName || 'Customer'}`,
            description: `Customer did not join morning or evening session yesterday (${yesterdayStr})`,
            urgency: 'today',
            actionType: 'open_customer_details',
            customerObj: cust,
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // RULE 3: Customer Missed Weight Entry Yesterday Tasks
      // ─────────────────────────────────────────────────────────────
      for (const cust of assignedCustomers) {
        const weightLogged = weightHistoryList.some(
          w => w.uid === cust.uid && (w.date === yesterdayStr || w.date === todayStr)
        );
        if (!weightLogged) {
          generatedTasks.push({
            id: `missed-weight-${cust.uid}`,
            type: 'customer_missed_weight',
            uid: cust.uid,
            name: cust.name || cust.fullName || 'Customer',
            phone: cust.phone || '',
            goal: cust.diagnosis?.fitnessGoal || '',
            title: `⚖️ Missed Weight Entry: ${cust.name || cust.fullName || 'Customer'}`,
            description: `No weight recorded for yesterday/today. Remind customer to log weight.`,
            urgency: 'today',
            actionType: 'open_customer_details',
            customerObj: cust,
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // RULE 4: Coach Missed Scheduled Meeting (For Club Owner / Admin)
      // ─────────────────────────────────────────────────────────────
      if (isAdmin) {
        for (const coach of coachUsers) {
          const coachAttended = attendanceList.some(
            a => a.uid === coach.uid && (a.date === yesterdayStr || a.date === todayStr)
          );
          if (!coachAttended) {
            generatedTasks.push({
              id: `coach-missed-meeting-${coach.uid}`,
              type: 'coach_missed_meeting',
              uid: coach.uid,
              name: coach.name,
              phone: coach.phone || '',
              goal: '👨‍🏫 Coach',
              title: `🎓 Coach Missed Training: Coach ${coach.name}`,
              description: `Coach did not attend live session / scheduled training yesterday (${yesterdayStr})`,
              urgency: 'overdue',
              actionType: 'call_phone',
            });
          }
        }

        // ─────────────────────────────────────────────────────────────
        // RULE 5: Coach Missed Weight Entry Today (For Club Owner / Admin)
        // ─────────────────────────────────────────────────────────────
        for (const coach of coachUsers) {
          const coachLoggedWeight = weightHistoryList.some(
            w => w.uid === coach.uid && (w.date === todayStr || w.date === yesterdayStr)
          );
          if (!coachLoggedWeight) {
            generatedTasks.push({
              id: `coach-missed-weight-${coach.uid}`,
              type: 'coach_missed_weight',
              uid: coach.uid,
              name: coach.name,
              phone: coach.phone || '',
              goal: '👨‍🏫 Coach',
              title: `⚖️ Coach Weight Entry Missing: Coach ${coach.name}`,
              description: `Coach has not recorded daily weight today (${todayStr})`,
              urgency: 'today',
              actionType: 'call_phone',
            });
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // RULE 6: 10-Day Program Follow-up Tasks
      // ─────────────────────────────────────────────────────────────
      for (const customer of assignedCustomers) {
        const fus = followupsMap[customer.uid] || [];
        const daysCompleted = fus.length > 0 ? Math.max(...fus.map(f => f.day)) : 0;
        if (daysCompleted >= 10) continue;

        const nextDay = daysCompleted + 1;
        let joinDate = customer.createdAt?.toDate ? customer.createdAt.toDate() : null;
        let urgency = 'today';
        let daysDiff = 0;

        if (joinDate) {
          daysDiff = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
          if (daysDiff > daysCompleted) urgency = 'overdue';
        }

        const todayDone = fus.some(f => f.followUpDate === todayStr && f.day === nextDay);
        if (!todayDone) {
          generatedTasks.push({
            id: `fu-${customer.uid}-${nextDay}`,
            type: '10day_followup',
            uid: customer.uid,
            name: customer.name || customer.fullName || 'Customer',
            phone: customer.phone || '',
            goal: customer.diagnosis?.fitnessGoal || '',
            nextDay,
            daysCompleted,
            title: `Day ${nextDay}: ${DAY_TASK_LABELS[nextDay] || 'Follow-up'}`,
            description: `10-Day Follow-up Program`,
            urgency,
            daysDiff,
            actionType: 'open_followup_modal',
            customerObj: customer,
          });
        }
      }

      // Sort: overdue first -> today
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 };
      generatedTasks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      setTasks(generatedTasks);
    } catch (err) {
      console.error('CoachTodayTasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Task click handler
  const handleTaskAction = (task) => {
    if (task.actionType === 'open_followup_modal') {
      const customer = task.customerObj || allCustomersMap[task.uid];
      const fus = allFollowupsMap[task.uid] || [];
      if (!customer) return;
      setSelectedCustomer(buildFollowUpCustomer(customer, fus));
      setSelectedFollowups(fus);
    } else if (task.actionType === 'open_crm_modal') {
      setSelectedCrmLead(task.leadObj);
    } else if (task.actionType === 'open_customer_details') {
      const customer = task.customerObj || allCustomersMap[task.uid];
      if (customer) {
        setSelectedDetailsCustomer({
          id: customer.uid,
          uid: customer.uid,
          fullName: customer.name || customer.fullName || 'Customer',
          phone: customer.phone || '',
          startingWeight: customer.diagnosis?.initialWeight || 0,
          targetWeight: customer.diagnosis?.goalWeight || 0,
          primaryGoal: customer.diagnosis?.fitnessGoal || '',
        });
      }
    } else if (task.actionType === 'call_phone' && task.phone) {
      window.location.href = `tel:${task.phone}`;
    }
  };

  const handleCrmSave = async (updatedData) => {
    if (selectedCrmLead?.id) {
      const docRef = doc(db, 'crm_enquiries', selectedCrmLead.id);
      await updateDoc(docRef, { ...updatedData, updatedAt: serverTimestamp() });
    }
    setSelectedCrmLead(null);
    fetchTasks();
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setSelectedFollowups([]);
    setSelectedCrmLead(null);
    setSelectedDetailsCustomer(null);
    fetchTasks();
  };

  const urgencyConfig = {
    overdue: { icon: '🔴', label: 'Overdue',  bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
    today:   { icon: '🟡', label: 'Due Today', bg: '#fffbeb', color: '#d97706', border: '#fcd34d' },
    upcoming:{ icon: '🔵', label: 'Upcoming',  bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  };

  const overdueCount = tasks.filter(t => t.urgency === 'overdue').length;
  const todayCount   = tasks.filter(t => t.urgency === 'today').length;

  const filteredTasks = filter === 'overdue'
    ? tasks.filter(t => t.urgency === 'overdue')
    : filter === 'today'
      ? tasks.filter(t => t.urgency === 'today')
      : tasks;

  return (
    <>
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Card Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>📌</span>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', margin: 0 }}>Today's Action & Follow-Up Tasks</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                background: filter === 'all' ? 'var(--primary)' : '#f3f4f6',
                color: filter === 'all' ? 'white' : 'var(--text-muted)',
              }}
            >
              All ({tasks.length})
            </button>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('overdue')}
                style={{
                  padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                  background: filter === 'overdue' ? '#dc2626' : '#fef2f2',
                  color: filter === 'overdue' ? 'white' : '#dc2626',
                }}
              >
                🔴 {overdueCount} Overdue
              </button>
            )}
            {todayCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('today')}
                style={{
                  padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                  background: filter === 'today' ? '#d97706' : '#fffbeb',
                  color: filter === 'today' ? 'white' : '#d97706',
                }}
              >
                🟡 {todayCount} Today
              </button>
            )}
          </div>
        </div>

        {/* Task List Container */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
              <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>All caught up!</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No pending tasks for this filter.</p>
            </div>
          ) : (
            filteredTasks.map((task, idx) => {
              const cfg = urgencyConfig[task.urgency];
              return (
                <div
                  key={task.id}
                  id={`task-item-${task.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px',
                    borderBottom: idx < filteredTasks.length - 1 ? '1px solid var(--bg-secondary)' : 'none',
                    background: task.urgency === 'overdue' ? '#fff5f5' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: task.type?.includes('coach')
                      ? 'linear-gradient(135deg, #10b981, #2563eb)'
                      : task.type === 'crm_followup'
                        ? 'linear-gradient(135deg, #d97706, #2563eb)'
                        : 'linear-gradient(135deg, var(--primary), #2563eb)',
                    color: 'white', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.85rem', fontWeight: '800',
                  }}>
                    {task.name?.charAt(0)?.toUpperCase()}
                  </div>

                  {/* Task Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        {task.title}
                      </span>
                      {task.phone && (
                        <a
                          href={`tel:${task.phone}`}
                          style={{
                            color: '#16a34a', fontSize: '0.68rem', fontWeight: '800', textDecoration: 'none',
                            background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: '4px'
                          }}
                          title={`Call ${task.phone}`}
                        >
                          📞 Call
                        </a>
                      )}
                      <span style={{
                        padding: '1px 6px', borderRadius: '99px', fontSize: '0.62rem', fontWeight: '800',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {task.description}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: 'auto', padding: '4px 10px', fontSize: '0.72rem', fontWeight: '800', flexShrink: 0 }}
                    onClick={() => handleTaskAction(task)}
                    id={`task-btn-${task.id}`}
                  >
                    {task.type === '10day_followup' ? (task.daysCompleted === 0 ? '▶ Start' : `✏️ Fill Day ${task.nextDay}`)
                      : task.type === 'crm_followup' ? '📋 View CRM Lead'
                      : task.type === 'customer_missed_meeting' || task.type === 'customer_missed_weight' ? '📞 Follow Up'
                      : '📞 Call Coach'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
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

      {selectedCrmLead && (
        <CrmEnquiryModal
          enquiry={selectedCrmLead}
          onSave={handleCrmSave}
          onClose={closeModal}
          autoCallLogFocus={true}
        />
      )}

      {selectedDetailsCustomer && (
        <CustomerDetailsModal
          customer={selectedDetailsCustomer}
          onClose={closeModal}
          autoCallLogFocus={true}
        />
      )}
    </>
  );
}
