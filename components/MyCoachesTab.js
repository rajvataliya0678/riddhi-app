'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CustomerDetailsModal from './CustomerDetailsModal';

export default function MyCoachesTab({ coachUid }) {
  const [coaches, setCoaches]           = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [enquiries, setEnquiries]       = useState([]);
  const [followups, setFollowups]       = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [diagnosesMap, setDiagnosesMap] = useState({});
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading]           = useState(true);

  const [expandedCoachId, setExpandedCoachId]   = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [coachUid]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // 1. Fetch all users (coaches and customers)
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, uid: d.data().uid || d.id, ...d.data() }));

      const coachList = allUsers.filter(u => u.role === 'coach' || u.role === 'club_owner' || u.role === 'admin');
      const customerList = allUsers.filter(u => u.role === 'customer' || !u.role);

      // 2. Fetch diagnosis for all customers
      const diagSnap = await getDocs(collection(db, 'diagnosis'));
      const dMap = {};
      diagSnap.docs.forEach(d => {
        const data = d.data();
        if (data.uid) dMap[data.uid] = data;
      });

      // 3. Fetch weight history for all customers
      const weightSnap = await getDocs(collection(db, 'weight_history'));
      const wList = weightSnap.docs.map(d => d.data());

      // 4. Fetch all CRM enquiries
      const crmSnap = await getDocs(collection(db, 'crm_enquiries'));
      const crmList = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 5. Fetch all customer followups
      const fuSnap = await getDocs(collection(db, 'customer_followups'));
      const fuList = fuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 6. Fetch meeting attendance for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const attSnap = await getDocs(
        query(collection(db, 'meeting_attendance'), where('date', '>=', sevenDaysAgoStr))
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

      setCoaches(coachList);
      setCustomers(customerList);
      setDiagnosesMap(dMap);
      setWeightHistory(wList);
      setEnquiries(crmList);
      setFollowups(fuList);
      setAttendanceMap(attMap);
    } catch (err) {
      console.error('Error fetching coach performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>👨‍🏫</div>
        <p>Analyzing Coach Work Performance & Customer Results...</p>
      </div>
    );
  }

  const today = new Date();

  // ── Compute per-coach performance & customer result metrics ──────────
  const coachStats = coaches.map(coach => {
    const cUid = coach.uid || coach.id;

    // Assigned Customers under this coach
    const assignedCustomers = customers.filter(c => c.coachId === cUid || c.coachUid === cUid);

    // Compute Customer Weight Loss Results
    let totalKgLost = 0;
    let customersWithResult = 0;

    const customerDetails = assignedCustomers.map(cust => {
      const diag = diagnosesMap[cust.uid] || cust.diagnosis || {};
      const startW = parseFloat(diag.initialWeight || cust.startingWeight) || 0;
      const targetW = parseFloat(diag.goalWeight || cust.targetWeight) || 0;

      // Find latest weight
      let latestW = startW;
      const userWeights = weightHistory.filter(w => w.uid === cust.uid).sort((a, b) => new Date(b.date) - new Date(a.date));
      if (userWeights.length > 0) {
        latestW = parseFloat(userWeights[0].weight) || startW;
      }

      let kgLost = 0;
      if (startW > 0 && latestW > 0) {
        kgLost = Math.max(0, startW - latestW);
      }

      if (kgLost > 0.2) {
        customersWithResult++;
        totalKgLost += kgLost;
      }

      const joinDate = cust.createdAt?.toDate ? cust.createdAt.toDate() : null;
      const daysJoined = joinDate ? Math.max(0, Math.floor((today - joinDate) / (1000 * 60 * 60 * 24))) : 0;

      return {
        customer: cust,
        startW,
        latestW,
        targetW,
        kgLost,
        daysJoined,
        goal: diag.fitnessGoal || 'Weight Loss',
      };
    });

    const avgKgLost = assignedCustomers.length > 0 ? (totalKgLost / assignedCustomers.length).toFixed(1) : '0.0';
    const resultSuccessPct = assignedCustomers.length > 0 ? Math.round((customersWithResult / assignedCustomers.length) * 100) : 0;

    // CRM Leads & Work Tracking Metrics
    const coachEnquiries = enquiries.filter(e => e.coachId === cUid);
    let invitationCalls = 0;
    let followUpCalls = 0;

    coachEnquiries.forEach(e => {
      const logs = e.callLogs || [];
      logs.forEach(l => {
        const isInv = l.callType === 'Invitation' || (!l.callType && (e.status === 'New Lead' || e.status === 'New'));
        if (isInv) invitationCalls++;
        else followUpCalls++;
      });
    });

    // Also include customer call logs
    assignedCustomers.forEach(c => {
      const logs = c.callLogs || [];
      followUpCalls += logs.length;
    });

    const totalCalls = invitationCalls + followUpCalls;
    const closedLeads = coachEnquiries.filter(e => e.status === 'Closing' || e.status === 'Converted').length;
    const closingPct = coachEnquiries.length > 0 ? Math.round((closedLeads / coachEnquiries.length) * 100) : 0;

    const coachFollowups = followups.filter(f => f.coachId === cUid);

    return {
      coach,
      cUid,
      assignedCustomersCount: assignedCustomers.length,
      customerDetails,
      totalKgLost: totalKgLost.toFixed(1),
      avgKgLost,
      resultSuccessPct,
      totalLeadsCount: coachEnquiries.length,
      closedLeadsCount: closedLeads,
      closingPct,
      invitationCalls,
      followUpCalls,
      totalCalls,
      followupTasksDone: coachFollowups.length,
    };
  });

  // Sort coaches by Total Customer Weight Lost (Highest Results First)
  coachStats.sort((a, b) => parseFloat(b.totalKgLost) - parseFloat(a.totalKgLost));

  // Overall Club Summary Totals
  const clubTotalCoaches = coachStats.length;
  const clubTotalCustomers = customers.length;
  const clubTotalKgLost = coachStats.reduce((sum, c) => sum + parseFloat(c.totalKgLost), 0).toFixed(1);
  const clubTotalCalls = coachStats.reduce((sum, c) => sum + c.totalCalls, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👨‍🏫 My Coaches — Work & Customer Results Tracking
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Track coach work activity (invitations, follow-ups) and the actual weight loss results delivered to their assigned customers
          </p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            ACTIVE COACHES
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary)', marginTop: '4px' }}>
            {clubTotalCoaches}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Team Leaders & Health Coaches
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            🔥 TOTAL CUSTOMER WEIGHT LOST
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#16a34a', marginTop: '4px' }}>
            {clubTotalKgLost} kg
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700' }}>
            Cumulative result across club
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            👥 ASSIGNED CUSTOMERS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#2563eb', marginTop: '4px' }}>
            {clubTotalCustomers}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Active customer transformations
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #7e22ce' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            📞 TOTAL PHONE WORK CALLS
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#7e22ce', marginTop: '4px' }}>
            {clubTotalCalls}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Invitations & Follow-up calls
          </div>
        </div>
      </div>

      {/* ── COACH PERFORMANCE & CUSTOMER RESULTS GRID ────────────────── */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
          🏆 Individual Coach Performance & Customer Outcomes
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {coachStats.map(st => {
            const isExpanded = expandedCoachId === st.cUid;
            const c = st.coach;

            return (
              <div
                key={st.cUid}
                className="dashboard-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Coach Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #10b981, #2563eb)',
                      color: 'white', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}>
                      {c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {c.name}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {c.email || c.phone || 'Health Coach'}
                      </p>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.72rem', fontWeight: '800', padding: '3px 10px', borderRadius: '99px',
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe'
                  }}>
                    {st.assignedCustomersCount} Customers
                  </span>
                </div>

                {/* 🏆 CUSTOMER RESULT TRACKING INSIGHT CARD */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
                  border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16a34a' }}>
                      🏆 CUSTOMER RESULTS DELIVERED
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '900', color: '#15803d' }}>
                      {st.resultSuccessPct}% Success Rate
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block' }}>TOTAL KG LOST</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#16a34a' }}>🔥 {st.totalKgLost} kg</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block' }}>AVG / CUSTOMER</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#2563eb' }}>⚖️ {st.avgKgLost} kg</span>
                    </div>
                  </div>
                </div>

                {/* 💼 WORK & ACTIVITY TRACKING METRICS */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                    💼 WORK ACTIVITY & PIPELINE CONVERSION
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block' }}>INVITATIONS</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0284c7' }}>📩 {st.invitationCalls}</span>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block' }}>FOLLOW-UPS</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#7e22ce' }}>📞 {st.followUpCalls}</span>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', display: 'block' }}>CLOSING RATE</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#16a34a' }}>🎯 {st.closingPct}%</span>
                    </div>
                  </div>
                </div>



                {/* Expand Button for Customer List */}
                <button
                  type="button"
                  onClick={() => setExpandedCoachId(isExpanded ? null : st.cUid)}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    background: isExpanded ? 'var(--primary-light)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', color: 'var(--text-main)',
                    fontSize: '0.78rem', fontWeight: '800', textAlign: 'center'
                  }}
                  id={`toggle-coach-customers-${st.cUid}`}
                >
                  {isExpanded ? '▲ Hide Customer Breakdown' : `▼ View Customer Results List (${st.assignedCustomersCount})`}
                </button>

                {/* EXPANDED CUSTOMER RESULTS LIST */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      👥 Customer Result Details ({st.customerDetails.length}):
                    </span>

                    {st.customerDetails.length === 0 ? (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0' }}>
                        No customers assigned to this coach yet.
                      </p>
                    ) : (
                      st.customerDetails.map(({ customer, startW, latestW, targetW, kgLost, daysJoined, goal }) => (
                        <div
                          key={customer.uid}
                          onClick={() => setSelectedCustomer(customer)}
                          style={{
                            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                            borderRadius: '6px', padding: '8px 12px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                          title="Click to open customer detail modal & call log"
                        >
                          <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>
                              {customer.name}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Day {daysJoined + 1} ({goal})
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '900', color: kgLost > 0 ? '#16a34a' : 'var(--text-muted)', display: 'block' }}>
                              {kgLost > 0 ? `🔥 -${kgLost.toFixed(1)} kg lost` : '⚖️ 0 kg lost'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {latestW > 0 ? `${latestW}kg` : '—'} (Start: {startW > 0 ? `${startW}kg` : '—'})
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* ── COACH RANKING & WORK COMPARISON TABLE ────────────────── */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
          📊 Side-by-Side Coach Work & Results Leaderboard
        </h3>

        <div className="crm-table-container">
          <table className="crm-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Coach Name</th>
                <th style={{ width: '100px' }}>Customers</th>
                <th style={{ width: '130px' }}>Total kg Lost</th>
                <th style={{ width: '120px' }}>Avg Result / Cust</th>
                <th style={{ width: '100px' }}>Invitations</th>
                <th style={{ width: '100px' }}>Follow-ups</th>
                <th style={{ width: '110px' }}>Closing %</th>
              </tr>
            </thead>
            <tbody>
              {coachStats.map(st => (
                <tr key={st.cUid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #10b981, #2563eb)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.78rem', fontWeight: '800',
                      }}>
                        {st.coach.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>{st.coach.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: '800' }}>{st.assignedCustomersCount}</td>
                  <td>
                    <span style={{ fontSize: '0.88rem', fontWeight: '900', color: '#16a34a' }}>
                      🔥 {st.totalKgLost} kg
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', fontWeight: '700', color: '#2563eb' }}>
                    {st.avgKgLost} kg
                  </td>
                  <td style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0284c7' }}>
                    📩 {st.invitationCalls}
                  </td>
                  <td style={{ fontSize: '0.82rem', fontWeight: '700', color: '#7e22ce' }}>
                    📞 {st.followUpCalls}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#16a34a' }}>
                      🎯 {st.closingPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal when clicking any customer under a coach */}
      {selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onCustomerUpdate={fetchAllData}
        />
      )}

    </div>
  );
}
