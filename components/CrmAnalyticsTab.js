'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, Lightbulb, AlertTriangle, Flame, Target, Pin, Loader2 } from 'lucide-react';

export default function CrmAnalyticsTab({ coachUid, clubId = 'main' }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchData();
  }, [coachUid, clubId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid))
      );
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => (e.clubId || 'main') === clubId);
      setEnquiries(list);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ marginBottom: '8px' }}><Loader2 size={32} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} /></div>
        <p>Loading CRM Analytics...</p>
      </div>
    );
  }

  // Stage Volume Counts
  const total = enquiries.length;
  const countNew       = enquiries.filter(e => e.status === 'New Lead' || e.status === 'New').length;
  const countSess1     = enquiries.filter(e => e.status === '1 Session').length;
  const countSess2     = enquiries.filter(e => e.status === '2 Session').length;
  const countClosing   = enquiries.filter(e => e.status === 'Closing' || e.status === 'Converted' || e.isConverted || e.convertedCustomerUid).length;
  const countWaiting   = enquiries.filter(e => e.status === 'Waiting List' || e.status === 'Interested').length;
  const countRejected  = enquiries.filter(e => e.status === 'Rejected' || e.status === 'Not Interested').length;

  // Performance Ratios
  const closingRate  = total > 0 ? Math.round((countClosing / total) * 100) : 0;
  const sess1Rate    = total > 0 ? Math.round(((countSess1 + countSess2 + countClosing) / total) * 100) : 0;
  const sess2Rate    = (countSess1 + countSess2 + countClosing) > 0
    ? Math.round(((countSess2 + countClosing) / (countSess1 + countSess2 + countClosing)) * 100)
    : 0;
  const rejectionRate = total > 0 ? Math.round((countRejected / total) * 100) : 0;

  // Call Activity Classification: Invitations (New Lead calls) vs Follow-ups (Other stage calls)
  let totalCalls = 0;
  let invitationCalls = 0;
  let followUpCalls = 0;

  enquiries.forEach(e => {
    const logs = e.callLogs || [];
    logs.forEach(l => {
      totalCalls++;
      const isInv = l.callType === 'Invitation' || (!l.callType && (e.status === 'New Lead' || e.status === 'New'));
      if (isInv) invitationCalls++;
      else followUpCalls++;
    });
  });

  // Weak Point & Recommendation Generation
  const insights = [];

  if (total === 0) {
    insights.push({
      type: 'info',
      Icon: Lightbulb,
      iconColor: '#3b82f6',
      title: 'No CRM Data Yet',
      desc: 'Add or bulk import leads in your CRM tab to start analyzing your sales funnel performance.',
    });
  } else {
    if (rejectionRate > 30) {
      insights.push({
        type: 'warning',
        Icon: AlertTriangle,
        iconColor: '#f59e0b',
        title: `High Rejection Rate (${rejectionRate}%)`,
        desc: 'More than 30% of leads are ending up in Rejected. Focus on improving your initial discovery script and building value before pitching prices.',
      });
    }

    if (countSess1 > countSess2 + countClosing) {
      insights.push({
        type: 'warning',
        Icon: Pin,
        iconColor: '#8b5cf6',
        title: 'Session 1 to Session 2 Bottleneck',
        desc: `You have ${countSess1} leads stuck in 1 Session. Always lock in the 2nd Session Zoom appointment before finishing Session 1!`,
      });
    }

    if (closingRate >= 35) {
      insights.push({
        type: 'success',
        Icon: Flame,
        iconColor: '#f97316',
        title: `High Closing Ratio (${closingRate}%)`,
        desc: 'Great job! Over 35% of your total pipeline is converting into active paying customers.',
      });
    } else if (total > 3 && closingRate < 20) {
      insights.push({
        type: 'danger',
        Icon: Target,
        iconColor: '#ef4444',
        title: `Closing Conversion Below Target (${closingRate}%)`,
        desc: 'Less than 20% of your leads are closing. Practice handling common objections (e.g. price, time commitment) during Session 2.',
      });
    }
  }

  const STAGES = [
    { label: 'New Lead',      count: countNew,     color: '#0ea5e9', bg: '#e0f2fe' },
    { label: '1 Session',     count: countSess1,   color: '#8b5cf6', bg: '#f3e8ff' },
    { label: '2 Session',     count: countSess2,   color: '#ec4899', bg: '#fce7f3' },
    { label: 'Closing',       count: countClosing, color: '#10b981', bg: '#d1fae5' },
    { label: 'Waiting List',  count: countWaiting, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Rejected',      count: countRejected,color: '#ef4444', bg: '#fee2e2' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={22} color="var(--accent)" /> CRM Analytics & Performance Ratios
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Analyze lead conversion rates, identify bottlenecks, and improve your closing ratios
        </p>
      </div>

      {/* Ratios Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Overall Closing Ratio
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#10b981', marginTop: '6px' }}>
            {closingRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {countClosing} of {total} leads closed
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Session 1 Progress Rate
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#8b5cf6', marginTop: '6px' }}>
            {sess1Rate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {countSess1 + countSess2 + countClosing} attended 1st session
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #ec4899' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Session 2 Conversion
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ec4899', marginTop: '6px' }}>
            {sess2Rate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {countSess2 + countClosing} reached 2nd session
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Drop-off / Rejection Rate
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ef4444', marginTop: '6px' }}>
            {rejectionRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {countRejected} rejected leads
          </div>
        </div>
      </div>

      {/* Call Activity Breakdown: Invitation vs Follow-up */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            📞 Call Activity Breakdown: Invitations vs Follow-ups
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
            Total Calls: {totalCalls}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
          Calls to <strong>New Leads</strong> count as <strong>📩 Invitations</strong>. Calls to 1/2 Session, Closing & Customers count as <strong>📞 Follow-ups</strong>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>
              📩 INVITATION CALLS
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#15803d', marginTop: '4px' }}>
              {invitationCalls}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700' }}>
              Calls to New Leads
            </span>
          </div>

          <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#7e22ce', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 2.18l3-.02a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.86-1.14a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              FOLLOW-UP CALLS
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#6b21a8', marginTop: '4px' }}>
              {followUpCalls}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#7e22ce', fontWeight: '700' }}>
              Calls to 1/2 Session, Closing & Customers
            </span>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
              INVITATION % RATIO
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1d4ed8', marginTop: '4px' }}>
              {totalCalls > 0 ? Math.round((invitationCalls / totalCalls) * 100) : 0}%
            </div>
            <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700' }}>
              New lead outreach effort
            </span>
          </div>
        </div>
      </div>

      {/* Visual Funnel Breakdown */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          Pipeline Stage Volume Funnel
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {STAGES.map(st => {
            const pct = total > 0 ? Math.round((st.count / total) * 100) : 0;
            return (
              <div
                key={st.label}
                style={{
                  background: st.bg,
                  border: `1px solid ${st.color}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: st.color }}>
                  {st.count}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                  {st.label}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: st.color, marginTop: '4px' }}>
                  {pct}% of pipeline
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coach Weak Point & Action Recommendations */}
      <div className="dashboard-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
          Coach Performance &amp; Weak Point Analysis
        </h3>
        {insights.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Your pipeline is well balanced! Keep moving leads smoothly through 1 Session and 2 Session to Closing.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {insights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: item.type === 'warning' ? '#fffbeb' : item.type === 'danger' ? '#fef2f2' : item.type === 'success' ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${item.type === 'warning' ? '#fcd34d' : item.type === 'danger' ? '#fca5a5' : item.type === 'success' ? '#bbf7d0' : '#bfdbfe'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: item.type === 'warning' ? '#fef3c7' : item.type === 'danger' ? '#fee2e2' : item.type === 'success' ? '#dcfce7' : '#dbeafe' }}>
                  {item.Icon && <item.Icon size={18} color={item.iconColor || '#6b7280'} />}
                </span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: '1.4' }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
