'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import NewCustomerModal from './NewCustomerModal';
import FollowUpFormModal from './FollowUpFormModal';
import CustomerFollowUpCard from './CustomerFollowUpCard';

const FILTER_OPTIONS = ['All', 'Active', 'Completed', 'Needs Attention'];
const STATUS_OPTIONS = [
  'All Statuses', 'New Customer', 'Active Customer', 'Needs Attention',
  'Good Progress', 'Potential Sharer', 'Potential Coach', 'Coach Discussion Done',
  'Not Interested', 'Inactive',
];

export default function FollowUpTab({ coachUid, coachName }) {
  const [customers, setCustomers] = useState([]);
  const [followupsMap, setFollowupsMap] = useState({}); // { customerId: [followup docs] }
  const [loading, setLoading] = useState(true);

  const [filterProgress, setFilterProgress] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchData();
  }, [coachUid]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Parallel fetch for profiles and followups
      const [profilesSnap, followupsSnap] = await Promise.all([
        getDocs(query(collection(db, 'customer_profiles'), where('coachId', '==', coachUid))),
        getDocs(query(collection(db, 'customer_followups'), where('coachId', '==', coachUid)))
      ]);

      const profileList = profilesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.role !== 'coach' && c.role !== 'admin');

      const allFollowups = followupsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Group followups by customerProfileId
      const grouped = {};
      for (const fu of allFollowups) {
        if (!grouped[fu.customerProfileId]) grouped[fu.customerProfileId] = [];
        grouped[fu.customerProfileId].push(fu);
      }

      setCustomers(profileList);
      setFollowupsMap(grouped);
    } catch (error) {
      console.error('Error fetching follow-up data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (customer) => setSelectedCustomer(customer);
  const closeForm = () => setSelectedCustomer(null);

  // ── Stats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => (c.daysCompleted || 0) > 0 && (c.daysCompleted || 0) < 10).length;
    const completed = customers.filter(c => (c.daysCompleted || 0) >= 10).length;
    const notStarted = customers.filter(c => (c.daysCompleted || 0) === 0).length;

    // Needs attention: any customer whose expected next day is overdue by >1 day
    const needsAttention = customers.filter(c => {
      if (!c.joiningDate || c.daysCompleted >= 10) return false;
      const joinDate = new Date(c.joiningDate);
      const today = new Date();
      const daysSinceJoin = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
      return daysSinceJoin > (c.daysCompleted || 0) + 1;
    }).length;

    return { total, active, completed, notStarted, needsAttention };
  }, [customers]);

  // ── Filter & Search ─────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    let list = [...customers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.fullName?.toLowerCase().includes(q) ||
        c.customerId?.toLowerCase().includes(q) ||
        c.mobile?.includes(q)
      );
    }

    if (filterStatus !== 'All Statuses') {
      list = list.filter(c => c.status === filterStatus);
    }

    if (filterProgress === 'Active') {
      list = list.filter(c => (c.daysCompleted || 0) > 0 && (c.daysCompleted || 0) < 10);
    } else if (filterProgress === 'Completed') {
      list = list.filter(c => (c.daysCompleted || 0) >= 10);
    } else if (filterProgress === 'Needs Attention') {
      list = list.filter(c => {
        if (!c.joiningDate || c.daysCompleted >= 10) return false;
        const joinDate = new Date(c.joiningDate);
        const today = new Date();
        const daysSinceJoin = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
        return daysSinceJoin > (c.daysCompleted || 0) + 1;
      });
    }

    // Sort: needs attention first, then by joining date desc
    list.sort((a, b) => {
      const aDays = a.daysCompleted || 0;
      const bDays = b.daysCompleted || 0;
      if (aDays === bDays) return new Date(b.joiningDate) - new Date(a.joiningDate);
      if (aDays >= 10) return 1;
      if (bDays >= 10) return -1;
      return bDays - aDays;
    });

    return list;
  }, [customers, searchQuery, filterStatus, filterProgress]);

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🌱</div>
        <p>Loading follow-up customers...</p>
      </div>
    );
  }

  return (
    <div>

      {/* ── Coach Rule Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fdf4ff, #eff6ff)',
        border: '1px solid #e9d5ff',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        marginBottom: '24px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>💜</span>
        <p style={{ fontSize: '0.82rem', lineHeight: '1.6', color: '#581c87', fontWeight: '500' }}>
          <strong>Coach Rule:</strong> "Do not rush the customer toward references or coaching. First build result, trust and relationship. Ask questions, listen carefully and record real answers. Coaching opportunity should arise naturally from the customer's progress, personality and interest."
        </p>
      </div>

      {/* ── Header + New Customer Button ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📋 10-Day New Customer Follow-Up</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {stats.total} customer{stats.total !== 1 ? 's' : ''} · Track each new customer's 10-day journey
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNewCustomerModal(true)}
          id="followup-new-customer-btn"
          style={{ width: 'auto' }}
        >
          ➕ New Customer
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total',          value: stats.total,          color: 'var(--text-main)',  icon: '👥' },
          { label: 'Active',         value: stats.active,         color: '#2563eb',           icon: '🟡' },
          { label: 'Completed',      value: stats.completed,      color: '#16a34a',           icon: '✅' },
          { label: 'Not Started',    value: stats.notStarted,     color: 'var(--text-muted)', icon: '🔵' },
          { label: 'Needs Attention',value: stats.needsAttention, color: '#dc2626',           icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className="dashboard-card" style={{ padding: '14px 16px', textAlign: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.04em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters & Search ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: '240px', padding: '8px 12px' }}
          placeholder="🔍 Search name, ID, phone..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          id="followup-search"
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {FILTER_OPTIONS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterProgress(f)}
              id={`followup-filter-${f.toLowerCase().replace(/\s/g, '-')}`}
              style={{
                padding: '7px 14px', borderRadius: '99px', border: '1px solid',
                fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                borderColor: filterProgress === f ? 'var(--primary)' : 'var(--border-color)',
                background: filterProgress === f ? 'var(--primary)' : 'var(--card-bg)',
                color: filterProgress === f ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          className="crm-filter-select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          id="followup-filter-status"
        >
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Customer Grid ── */}
      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">{customers.length === 0 ? '👤' : '🔍'}</span>
          <h4>{customers.length === 0 ? 'No customers yet' : 'No customers match your filters'}</h4>
          <p>
            {customers.length === 0
              ? 'Click "➕ New Customer" to start your first 10-day follow-up.'
              : 'Try changing your search or filter criteria.'}
          </p>
          {customers.length === 0 && (
            <button className="btn btn-primary" style={{ width: 'auto', marginTop: '12px' }} onClick={() => setShowNewCustomerModal(true)}>
              ➕ Add First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="followup-customer-grid">
          {filteredCustomers.map(customer => (
            <CustomerFollowUpCard
              key={customer.id}
              customer={customer}
              followups={followupsMap[customer.id] || []}
              onClick={() => openForm(customer)}
            />
          ))}
        </div>
      )}

      {/* ── New Customer Modal ── */}
      {showNewCustomerModal && (
        <NewCustomerModal
          coachUid={coachUid}
          coachName={coachName}
          onClose={() => setShowNewCustomerModal(false)}
          onSaved={fetchData}
        />
      )}

      {/* ── Follow-Up Form Modal ── */}
      {selectedCustomer && (
        <FollowUpFormModal
          customer={selectedCustomer}
          followups={followupsMap[selectedCustomer.id] || []}
          coachUid={coachUid}
          coachName={coachName}
          onClose={closeForm}
          onSaved={() => {
            fetchData();
            // Update selected customer from new data after save
          }}
        />
      )}
    </div>
  );
}
