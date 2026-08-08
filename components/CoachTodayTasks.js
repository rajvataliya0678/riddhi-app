'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logCrmCall } from '@/lib/logCrmCall';
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

// Add Custom Personal Task Modal Component
function AddCustomTaskModal({ coachUid, onClose, onSaved }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [taskDate, setTaskDate]       = useState(todayStr);
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'coach_custom_tasks'), {
        coachUid: coachUid || '',
        title: title.trim(),
        description: description.trim(),
        taskDate: taskDate || todayStr,
        createdAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error adding custom task:', err);
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
              📌 Add Personal Task
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Schedule a task for today or an upcoming date
            </p>
          </div>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Task Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Call client for diet progress, prepare report..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Description / Notes (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Add extra notes or reminders..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Task Date (Default: Today)</label>
            <input
              type="date"
              className="form-input"
              value={taskDate}
              onChange={e => setTaskDate(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              * Auto-set to Today. If not marked Done today, it will automatically move to Overdue tomorrow.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
              {saving ? '⏳ Saving...' : '💾 Schedule Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CoachTodayTasks({ coachUid, coachName, userRole = 'coach' }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all'); // 'all' | 'overdue' | 'today'

  // Modals state
  const [selectedCustomer, setSelectedCustomer]             = useState(null);
  const [selectedFollowups, setSelectedFollowups]           = useState([]);
  const [selectedCrmLead, setSelectedCrmLead]               = useState(null);
  const [selectedDetailsCustomer, setSelectedDetailsCustomer] = useState(null);
  const [showAddTaskModal, setShowAddTaskModal]             = useState(false);

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

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      // Parallelize ALL Firestore queries simultaneously!
      const [
        usersSnap,
        diagSnap,
        fuSnap,
        crmSnap,
        attSnap,
        weightSnap,
        completedSnap,
        customTasksSnap
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'diagnosis')),
        getDocs(query(collection(db, 'customer_followups'), where('coachId', '==', coachUid))),
        getDocs(query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid))),
        getDocs(query(collection(db, 'meeting_attendance'), where('date', '>=', threeDaysAgoStr))),
        getDocs(query(collection(db, 'weight_history'), where('date', '>=', threeDaysAgoStr))),
        getDocs(query(collection(db, 'completed_tasks'), where('coachUid', '==', coachUid))),
        getDocs(query(collection(db, 'coach_custom_tasks'), where('coachUid', '==', coachUid)))
      ]);

      // Diagnosis map in memory
      const diagMap = {};
      diagSnap.docs.forEach(d => {
        const data = d.data();
        if (data.uid) diagMap[data.uid] = data;
      });

      const allUsersList = usersSnap.docs.map(d => {
        const uData = d.data();
        const uUid = uData.uid || d.id;
        return { id: d.id, uid: uUid, ...uData, diagnosis: diagMap[uUid] || null };
      });

      const assignedCustomers = allUsersList.filter(
        u => (u.coachId === coachUid || u.coachUid === coachUid) && (u.role === 'customer' || !u.role)
      );

      const coachUsers = allUsersList.filter(u => u.role === 'coach');

      const customersMap = {};
      assignedCustomers.forEach(u => { customersMap[u.uid] = u; });

      const followupsMap = {};
      fuSnap.docs.forEach(fd => {
        const d = { id: fd.id, ...fd.data() };
        const key = d.customerUid || d.customerProfileId;
        if (!followupsMap[key]) followupsMap[key] = [];
        followupsMap[key].push(d);
      });

      const crmLeads = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const attendanceList = attSnap.docs.map(d => d.data());
      const weightHistoryList = weightSnap.docs.map(d => d.data());
      const completedIds = new Set(
        completedSnap.docs
          .map(d => d.data())
          .filter(d => d.date === todayStr)
          .map(d => d.taskId)
      );

      setAllCustomersMap(customersMap);
      setAllFollowupsMap(followupsMap);

      // ── COMPUTE ALL TASKS ACCORDING TO RULES ─────────────────────
      const generatedTasks = [];

      // ─────────────────────────────────────────────────────────────
      // RULE 1: CRM Follow-up Date Tasks
      // ─────────────────────────────────────────────────────────────
      for (const lead of crmLeads) {
        if (lead.status === 'Converted / Active Customer' || lead.status === 'Converted' || lead.isConverted || lead.convertedCustomerUid) continue;
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
            description: `Follow-up date reached (${fuDateStr}) · Stage: ${lead.status || 'New Lead'}${lead.coachName ? ` · Staff: ${lead.coachName}` : ''}`,
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

        const custName = customer.name || customer.fullName || 'Customer';
        const todayDone = fus.some(f => f.followUpDate === todayStr && f.day === nextDay);
        if (!todayDone) {
          generatedTasks.push({
            id: `fu-${customer.uid}-${nextDay}`,
            type: '10day_followup',
            uid: customer.uid,
            name: custName,
            phone: customer.phone || '',
            goal: customer.diagnosis?.fitnessGoal || '',
            nextDay,
            daysCompleted,
            title: `Day ${nextDay}: ${DAY_TASK_LABELS[nextDay] || 'Follow-up'} — ${custName}`,
            description: `10-Day Follow-up Program for ${custName}`,
            urgency,
            daysDiff,
            actionType: 'open_followup_modal',
            customerObj: customer,
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // RULE 7: Custom Personal Tasks (Scheduled by Coach)
      // ─────────────────────────────────────────────────────────────
      for (const cd of customTasksSnap.docs) {
        const ct = { id: cd.id, ...cd.data() };
        if (!ct.taskDate) continue;
        if (ct.taskDate <= todayStr) {
          const isOverdue = ct.taskDate < todayStr;
          generatedTasks.push({
            id: `custom-${ct.id}`,
            type: 'custom_personal_task',
            uid: ct.id,
            name: 'Personal Task',
            title: `📌 ${ct.title}`,
            description: ct.description || `Scheduled for ${ct.taskDate}`,
            urgency: isOverdue ? 'overdue' : 'today',
            actionType: 'none',
          });
        }
      }

      // Sort: overdue first -> today
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 };
      generatedTasks.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      const pendingTasks = generatedTasks.filter(t => !completedIds.has(t.id));
      setTasks(pendingTasks);
    } catch (err) {
      console.error('CoachTodayTasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCrmDelete = async (leadId, leadName) => {
    if (!leadId) return;
    if (window.confirm(`શું તમે ખરેખર "${leadName || 'આ લીડ'}" ડીલીટ કરવા માંગો છો?`)) {
      try {
        await deleteDoc(doc(db, 'crm_enquiries', leadId));
        setSelectedCrmLead(null);
        fetchTasks();
      } catch (err) {
        console.error('Error deleting CRM lead:', err);
        alert('Failed to delete lead. Try again.');
      }
    }
  };

  const handleCrmSave = async (updatedData, leadId) => {
    const idToUpdate = leadId || selectedCrmLead?.id;
    if (idToUpdate) {
      const docRef = doc(db, 'crm_enquiries', idToUpdate);
      await updateDoc(docRef, { ...updatedData, updatedAt: serverTimestamp() });
    }
    setSelectedCrmLead(null);
    fetchTasks();
  };

  const handleMarkDone = async (task, e) => {
    if (e) e.stopPropagation();
    try {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      await addDoc(collection(db, 'completed_tasks'), {
        taskId: task.id,
        coachUid: coachUid || '',
        date: todayStr,
        taskTitle: task.title,
        completedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error marking task done:', err);
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
      // Auto-log if this is a CRM lead call
      if (task.leadId || task.leadObj?.id) {
        logCrmCall(db, task.leadId || task.leadObj?.id, task.leadObj || {});
      }
    }
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
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800', border: 'none', cursor: 'pointer',
                background: filter === 'all' ? '#059669' : '#f1f5f9',
                color: filter === 'all' ? '#fff' : '#64748b',
              }}
            >
              All ({tasks.length})
            </button>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('overdue')}
                style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800', border: '1px solid #fca5a5', cursor: 'pointer',
                  background: filter === 'overdue' ? '#dc2626' : '#fef2f2',
                  color: filter === 'overdue' ? '#fff' : '#dc2626',
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
                  padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800', border: '1px solid #fcd34d', cursor: 'pointer',
                  background: filter === 'today' ? '#d97706' : '#fffbeb',
                  color: filter === 'today' ? '#fff' : '#b45309',
                }}
              >
                🟡 {todayCount} Today
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddTaskModal(true)}
              style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '20px', gap: '4px' }}
              id="add-custom-task-btn"
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Task List Container */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ⏳ Loading today's action tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px', textAlign: 'center' }}>
              <span className="empty-state-icon" style={{ fontSize: '2rem' }}>🎉</span>
              <h4 style={{ fontSize: '0.9rem', margin: '4px 0' }}>All clear! No pending tasks</h4>
              <p style={{ fontSize: '0.78rem' }}>You are completely caught up for today.</p>
            </div>
          ) : (
            filteredTasks.map((task, idx) => {
              const u = urgencyConfig[task.urgency] || urgencyConfig.today;
              return (
                <div
                  key={task.id}
                  id={`task-item-${task.id}`}
                  onClick={() => handleTaskAction(task)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1px solid ${u.border}`,
                    background: u.bg,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Top Row: Avatar + Info + Urgency Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #d97706, #2563eb)',
                        color: '#fff', fontWeight: '800', fontSize: '0.9rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {task.name ? task.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, lineHeight: '1.35', wordBreak: 'break-word' }}>
                          {task.title}
                        </p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: '1.4', wordBreak: 'break-word' }}>
                          {task.description}
                        </p>
                      </div>
                    </div>

                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800',
                      background: u.bg, color: u.color, border: `1px solid ${u.border}`, whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                      {u.icon} {u.label}
                    </span>
                  </div>

                  {/* Bottom Row: Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', paddingTop: '6px', borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                    {task.phone && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${task.phone}`;
                          if (task.leadId || task.leadObj?.id) {
                            logCrmCall(db, task.leadId || task.leadObj?.id, task.leadObj || {});
                          }
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '700',
                          background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                          display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                        }}
                      >
                        📞 Call
                      </button>
                    )}

                    {task.actionType === 'open_crm_modal' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleTaskAction(task); }}
                        className="btn btn-sm"
                        style={{ padding: '5px 10px', fontSize: '0.75rem', background: '#10b981', color: '#fff', borderRadius: '8px' }}
                      >
                        📋 CRM Lead
                      </button>
                    )}

                    {task.actionType === 'open_followup_modal' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleTaskAction(task); }}
                        className="btn btn-sm"
                        style={{ padding: '5px 10px', fontSize: '0.75rem', background: '#6366f1', color: '#fff', borderRadius: '8px' }}
                      >
                        📝 Follow-up
                      </button>
                    )}

                    <button
                      type="button"
                      style={{
                        padding: '4px 8px', fontSize: '0.72rem', fontWeight: '800', borderRadius: '6px',
                        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'pointer'
                      }}
                      onClick={(e) => handleMarkDone(task, e)}
                      id={`task-done-btn-${task.id}`}
                      title="Mark this task as completed for today"
                    >
                      ✅ Done
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddTaskModal && (
        <AddCustomTaskModal
          coachUid={coachUid}
          onClose={() => setShowAddTaskModal(false)}
          onSaved={fetchTasks}
        />
      )}

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
          onDelete={handleCrmDelete}
          coaches={allUsersList.filter(u => u.role === 'coach' || u.role === 'admin')}
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
