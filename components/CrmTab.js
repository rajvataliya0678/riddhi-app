'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CrmEnquiryModal from './CrmEnquiryModal';

const STATUS_OPTIONS = ['All', 'New', 'Contacted', 'Interested', 'Converted', 'Not Interested'];

function getStatusBadgeClass(status) {
  const map = {
    'New': 'status-new',
    'Contacted': 'status-contacted',
    'Interested': 'status-interested',
    'Converted': 'status-converted',
    'Not Interested': 'status-not-interested',
  };
  return map[status] || 'status-new';
}

export default function CrmTab({ coachUid }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFollowUp, setFilterFollowUp] = useState(''); // 'overdue', 'today', 'upcoming', ''

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);

  useEffect(() => {
    fetchEnquiries();
  }, [coachUid]);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'crm_enquiries'), where('coachId', '==', coachUid))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by createdAt descending (newest first)
      list.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setEnquiries(list);
    } catch (error) {
      console.error('Error fetching CRM enquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEnquiry = async (data, existingId) => {
    try {
      if (existingId) {
        // Update existing enquiry
        const docRef = doc(db, 'crm_enquiries', existingId);
        const updateData = {
          name: data.name,
          phone: data.phone,
          source: data.source,
          status: data.status,
          followUpDate: data.followUpDate,
          notes: data.notes,
          updatedAt: serverTimestamp(),
        };

        // If status changed, append to statusHistory
        if (data.statusChanged) {
          const existingEnquiry = enquiries.find(e => e.id === existingId);
          const currentHistory = existingEnquiry?.statusHistory || [];
          updateData.statusHistory = [
            ...currentHistory,
            {
              status: data.status,
              note: `Changed from "${data.oldStatus}" to "${data.status}"`,
              changedAt: new Date().toISOString(),
            },
          ];
        }

        await updateDoc(docRef, updateData);
      } else {
        // Add new enquiry
        await addDoc(collection(db, 'crm_enquiries'), {
          coachId: coachUid,
          name: data.name,
          phone: data.phone,
          source: data.source,
          status: data.status,
          followUpDate: data.followUpDate,
          notes: data.notes,
          statusHistory: [
            {
              status: data.status,
              note: 'Enquiry created',
              changedAt: new Date().toISOString(),
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await fetchEnquiries();
      setShowModal(false);
      setEditingEnquiry(null);
    } catch (error) {
      console.error('Error saving enquiry:', error);
      throw error; // Let the modal handle the error display
    }
  };

  const openAddModal = () => {
    setEditingEnquiry(null);
    setShowModal(true);
  };

  const openEditModal = (enquiry) => {
    setEditingEnquiry(enquiry);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEnquiry(null);
  };

  // Apply filters
  const getFilteredEnquiries = () => {
    let filtered = [...enquiries];

    // Filter by status
    if (filterStatus !== 'All') {
      filtered = filtered.filter(e => e.status === filterStatus);
    }

    // Filter by follow-up date
    if (filterFollowUp) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      if (filterFollowUp === 'overdue') {
        filtered = filtered.filter(e => e.followUpDate && e.followUpDate < todayStr);
      } else if (filterFollowUp === 'today') {
        filtered = filtered.filter(e => e.followUpDate === todayStr);
      } else if (filterFollowUp === 'upcoming') {
        filtered = filtered.filter(e => e.followUpDate && e.followUpDate > todayStr);
      }
    }

    return filtered;
  };

  const filteredEnquiries = getFilteredEnquiries();

  // Stats summary
  const stats = {
    total: enquiries.length,
    new: enquiries.filter(e => e.status === 'New').length,
    interested: enquiries.filter(e => e.status === 'Interested').length,
    converted: enquiries.filter(e => e.status === 'Converted').length,
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading CRM data...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>CRM — Enquiries</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage and track your leads and prospects
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="dashboard-card" style={{ padding: '16px', textAlign: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.total}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Total</span>
        </div>
        <div className="dashboard-card" style={{ padding: '16px', textAlign: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0ea5e9' }}>{stats.new}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>New</span>
        </div>
        <div className="dashboard-card" style={{ padding: '16px', textAlign: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#a855f7' }}>{stats.interested}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Interested</span>
        </div>
        <div className="dashboard-card" style={{ padding: '16px', textAlign: 'center', gap: '4px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>{stats.converted}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Converted</span>
        </div>
      </div>

      {/* Toolbar: Filters + Add Button */}
      <div className="crm-toolbar">
        <select
          className="crm-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          id="crm-filter-status"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
          ))}
        </select>

        <select
          className="crm-filter-select"
          value={filterFollowUp}
          onChange={(e) => setFilterFollowUp(e.target.value)}
          id="crm-filter-followup"
        >
          <option value="">All Follow-ups</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
        </select>

        <button
          onClick={openAddModal}
          className="btn btn-primary crm-add-btn"
          id="crm-add-enquiry-btn"
        >
          + Add Enquiry
        </button>
      </div>

      {/* Enquiries Table */}
      {filteredEnquiries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📋</span>
          <h4>{enquiries.length === 0 ? 'No enquiries yet' : 'No results match your filters'}</h4>
          <p>{enquiries.length === 0 ? 'Click "Add Enquiry" to create your first lead.' : 'Try changing your filter criteria.'}</p>
        </div>
      ) : (
        <div className="crm-table-container">
          <table className="crm-table" id="crm-enquiries-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Follow-up</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnquiries.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  onClick={() => openEditModal(enquiry)}
                  id={`crm-row-${enquiry.id}`}
                >
                  <td style={{ fontWeight: '600' }}>{enquiry.name}</td>
                  <td>{enquiry.phone}</td>
                  <td>{enquiry.source}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(enquiry.status)}`}>
                      {enquiry.status}
                    </span>
                  </td>
                  <td>
                    {enquiry.followUpDate
                      ? new Date(enquiry.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                      : '—'
                    }
                  </td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {enquiry.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CRM Modal */}
      {showModal && (
        <CrmEnquiryModal
          enquiry={editingEnquiry}
          onSave={handleSaveEnquiry}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
