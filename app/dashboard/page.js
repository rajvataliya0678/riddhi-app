'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MyCustomersTab from '@/components/MyCustomersTab';
import CrmTab from '@/components/CrmTab';
import AdminTab from '@/components/AdminTab';
import WeightChart from '@/components/WeightChart';
import StreakBadges from '@/components/StreakBadges';
import WeeklyInsight from '@/components/WeeklyInsight';
import ProfileModal from '@/components/ProfileModal';
import FollowUpTab from '@/components/FollowUpTab';
import CoachTodayTasks from '@/components/CoachTodayTasks';
import TodaysMeetings from '@/components/TodaysMeetings';
import CrmAnalyticsTab from '@/components/CrmAnalyticsTab';
import MyCoachesTab from '@/components/MyCoachesTab';
import AttendanceTab from '@/components/AttendanceTab';
import SessionLeadAttendees from '@/components/SessionLeadAttendees';
import UpdatePrompt from '@/components/UpdatePrompt';
import {
  LayoutDashboard, CalendarCheck, Users, ClipboardList, BarChart3,
  GraduationCap, Settings2, Scale, Flame, Target, TrendingUp,
  Heart, Calendar, LogOut, Bell, Menu, X, Pencil, Stethoscope,
  Crown, Award, Plus, ChevronRight, Activity
} from 'lucide-react';

// ── Sidebar nav items ────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',     Icon: LayoutDashboard, label: 'My Dashboard',    roles: ['customer', 'coach', 'admin'] },
  { id: 'attendance',    Icon: CalendarCheck,   label: 'Attendance',      roles: ['customer', 'coach', 'admin'] },
  { id: 'customers',     Icon: Users,           label: 'My Customers',    roles: ['coach', 'admin'] },
  { id: 'crm',          Icon: ClipboardList,   label: 'CRM',             roles: ['coach', 'admin'] },
  { id: 'crm_analytics', Icon: BarChart3,       label: 'CRM Analytics',   roles: ['coach', 'admin'] },
  { id: 'my_coaches',   Icon: GraduationCap,   label: 'My Coaches',      roles: ['coach', 'admin'] },
  { id: 'admin',        Icon: Settings2,       label: 'Club Owner Panel', roles: ['admin'] },
];

// ── Mifflin-St Jeor BMR ──────────────────────────────────
function computeBMR(weight, diagnosis) {
  if (!weight || !diagnosis) return 0;
  const { height, age, gender } = diagnosis;
  if (gender === 'male') return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  if (gender === 'female') return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  return Math.round(10 * weight + 6.25 * height - 5 * age - 78);
}

export default function DashboardPage() {
  const { loading: authLoading } = useAuthGuard();
  const { user, userData, logout } = useAuth();

  const [diagnosis, setDiagnosis] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = userData?.role || 'customer';
  const isCoach = role === 'coach' || role === 'admin';
  const isAdmin = role === 'admin';

  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(role));

  // ── Data fetching ────────────────────────────────────────
  const fetchData = async () => {
    if (!user) return;
    try {
      setLoadingData(true);

      const [diagSnap, weightSnap] = await Promise.all([
        getDocs(query(collection(db, 'diagnosis'), where('uid', '==', user.uid))),
        getDocs(query(collection(db, 'weight_history'), where('uid', '==', user.uid)))
      ]);

      if (!diagSnap.empty) setDiagnosis(diagSnap.docs[0].data());

      const history = weightSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      setWeightHistory(history);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoadingData(false);
    }
  }, [user?.uid]);

  // ── Derived values ────────────────────────────────────────
  const latestWeight = weightHistory.length > 0 ? weightHistory[0].weight : (diagnosis?.initialWeight || 0);
  const bmr = computeBMR(latestWeight, diagnosis);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Weight update ─────────────────────────────────────────
  const handleUpdateWeight = async (e) => {
    e.preventDefault();
    setModalError('');
    const val = parseFloat(newWeight);

    if (isNaN(val) || val <= 0) {
      setModalError('Please enter a valid weight (e.g. 70.5)');
      return;
    }

    try {
      setModalSubmitting(true);
      const todayStr = new Date().toISOString().split('T')[0];

      const existingSnap = await getDocs(
        query(
          collection(db, 'weight_history'),
          where('uid', '==', user.uid)
        )
      );

      const existingDoc = existingSnap.docs.find(d => d.data().date === todayStr);

      if (existingDoc) {
        await updateDoc(doc(db, 'weight_history', existingDoc.id), {
          weight: val,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'weight_history'), {
          uid: user.uid,
          weight: val,
          date: todayStr,
          createdAt: serverTimestamp(),
        });
      }

      await fetchData();
      setShowWeightModal(false);
      setNewWeight('');
    } catch (err) {
      console.error('Error logging weight:', err);
      setModalError('Failed to save weight. Please try again.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const requiresDiagnosis = role === 'customer' && userData?.registrationCompleted === false;

  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div style={{ textAlign: 'center' }}>
          <div className="brand-logo">Vriddhi</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading wellness dashboard...</p>
        </div>
      </div>
    );
  }

  const pageTitles = { dashboard: 'My Dashboard', attendance: 'Attendance Calendar', customers: 'My Customers', followup: '10-Day Follow-Up', crm: 'CRM — Pipeline', crm_analytics: 'CRM Analytics & Ratios', my_coaches: 'My Coaches', admin: 'Club Owner Panel' };
  const pageSubtitles = {
    dashboard: `Today is ${dateStr}`,
    attendance: 'Live Zoom session attendance & Thursday coach training log',
    customers: 'Customers assigned to you',
    followup: 'Track each new customer through their 10-day journey',
    crm: 'Manage your leads across pipeline stages',
    crm_analytics: 'Analyze conversion rates, ratios and performance insights',
    my_coaches: 'Manage team coaches & view individual performance',
    admin: 'Manage all users, roles and assignments as Club Owner',
  };

  return (
    <div className="app-shell">

      {/* ── IN-APP UPDATE PROMPT ── */}
      <UpdatePrompt />

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="mobile-hamburger"
            onClick={() => setDrawerOpen(true)}
            title="Open Menu"
            id="mobile-hamburger-btn"
          >
            <Menu size={18} />
          </button>
          <div className="mobile-top-bar-logo">Vriddhi</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'dashboard' && (
            <button
              onClick={() => { setNewWeight(latestWeight.toString()); setShowWeightModal(true); }}
              className="btn btn-primary btn-sm"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.75rem', gap: '4px' }}
            >
              <Plus size={13} /> Log Weight
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProfile(true)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%',
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.7)', transition: 'all 0.2s ease'
            }}
            title="Settings & Profile"
            id="top-bar-settings-btn"
          >
            <Settings2 size={16} />
          </button>

          <div
            className="profile-avatar-btn"
            style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}
            onClick={() => setShowProfile(true)}
            title="Edit Profile & Language Settings"
          >
            {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
          </div>
        </div>
      </div>

      {/* ── DESKTOP LEFT SIDEBAR ────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">Vriddhi</div>
          <div className="sidebar-logo-sub">Wellness Platform</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {visibleNav.map(item => {
            const IconComp = item.Icon;
            return (
              <button
                key={item.id}
                className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                id={`nav-${item.id}`}
              >
                <span className="sidebar-link-icon"><IconComp size={16} /></span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {role !== 'customer' && (
            <div style={{ marginBottom: '10px' }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '4px 12px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: isAdmin ? 'rgba(139,92,246,0.2)' : 'rgba(5,150,105,0.2)',
                color: isAdmin ? '#c4b5fd' : '#6ee7b7',
                border: isAdmin ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(5,150,105,0.3)',
              }}>
                {isAdmin ? <Crown size={11} /> : <Award size={11} />}
                {isAdmin ? 'Club Owner' : 'Coach'}
              </span>
            </div>
          )}

          <div
            className="sidebar-user-row"
            onClick={() => setShowProfile(true)}
            title="Edit Profile"
            id="sidebar-user-row"
          >
            <div className="sidebar-avatar">
              {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userData?.name}</div>
              <div className="sidebar-user-email">{userData?.email}</div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="btn btn-outline btn-sm"
            style={{
              width: '100%', justifyContent: 'flex-start', gap: '8px',
              color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)',
              background: 'transparent'
            }}
            id="sidebar-logout-btn"
          >
            <LogOut size={15} /> Log Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE SIDEBAR DRAWER ── */}
      {drawerOpen && (
        <>
          <div className="sidebar-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="sidebar-drawer">
            <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="sidebar-logo-text">Vriddhi</div>
                <div className="sidebar-logo-sub">Wellness Platform</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <nav className="sidebar-nav">
              <div className="sidebar-section-label">Navigation</div>
              {visibleNav.map(item => {
                const IconComp = item.Icon;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }}
                  >
                    <span className="sidebar-link-icon"><IconComp size={16} /></span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              <div
                className="sidebar-user-row"
                onClick={() => { setShowProfile(true); setDrawerOpen(false); }}
              >
                <div className="sidebar-avatar">
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{userData?.name}</div>
                  <div className="sidebar-user-email">{userData?.email}</div>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="btn btn-outline btn-sm"
                style={{
                  width: '100%', justifyContent: 'flex-start', gap: '8px',
                  color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)',
                  background: 'transparent'
                }}
              >
                <LogOut size={15} /> Log Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE BOTTOM TAB NAVIGATION BAR ── */}
      <nav className="mobile-bottom-nav">
        {visibleNav.filter(n => ['dashboard', 'attendance', 'customers', 'crm'].includes(n.id)).map(item => {
          const IconComp = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-tab-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              id={`mobile-tab-${item.id}`}
            >
              <IconComp size={20} />
              <span className="mobile-tab-label">{item.label.replace('My ', '')}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={() => setDrawerOpen(true)}
          id="mobile-tab-more"
        >
          <Menu size={20} />
          <span className="mobile-tab-label">Menu</span>
        </button>
      </nav>

      {/* ── MAIN PANEL ──────────────────────── */}
      <div className="main-panel">

        <div className="main-panel-header">
          <div className="page-title-block">
            <h1>{pageTitles[activeTab]}</h1>
            <p>{pageSubtitles[activeTab]}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="notif-btn" id="notif-bell-btn" title="Notifications">
              <Bell size={18} />
              <span className="notif-badge">2</span>
            </button>

            {activeTab === 'dashboard' && (
              <button
                onClick={() => { setNewWeight(latestWeight.toString()); setShowWeightModal(true); }}
                className="btn btn-primary"
                style={{ width: 'auto', gap: '6px' }}
                id="update-weight-btn"
              >
                <Plus size={16} /> Log Weight
              </button>
            )}
          </div>
        </div>

        <div className="main-panel-body">

          {/* ── MY DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div
                className="resp-grid-tasks"
                style={{
                  display: 'grid',
                  gridTemplateColumns: isCoach ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr',
                  gap: '20px',
                  alignItems: 'stretch',
                }}
              >
                {isCoach && (
                  <CoachTodayTasks coachUid={user.uid} coachName={userData?.name || ''} userRole={userData?.role || 'coach'} />
                )}
                <TodaysMeetings user={user} userData={userData} />
                {isCoach && (
                  <SessionLeadAttendees coachUid={user.uid} userRole={userData?.role || 'coach'} />
                )}
              </div>

              {/* Stats Row */}
              <div className="resp-grid-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Weight */}
                <div className="dashboard-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '14px', padding: '18px 20px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                  }}>
                    <Scale size={22} color="#2563eb" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Current Weight</p>
                    <p style={{ fontSize: '1.7rem', fontWeight: '900', fontFamily: 'var(--font-heading)', color: 'var(--text-main)', lineHeight: 1 }}>{latestWeight} <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>kg</span></p>
                  </div>
                </div>

                {/* BMR */}
                <div className="dashboard-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '14px', padding: '18px 20px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.25)'
                  }}>
                    <Flame size={22} color="#d97706" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>BMR</p>
                    <p style={{ fontSize: '1.7rem', fontWeight: '900', fontFamily: 'var(--font-heading)', color: 'var(--primary)', lineHeight: 1 }}>{bmr} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}>cal/day</span></p>
                  </div>
                </div>

                {/* Goal */}
                <div className="dashboard-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '14px', padding: '18px 20px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.2)'
                  }}>
                    <Target size={22} color="#059669" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Goal</p>
                    <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', lineHeight: 1.3 }}>{diagnosis?.fitnessGoal || '—'}</p>
                    {diagnosis?.goalWeight && <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Target: {diagnosis.goalWeight} kg</p>}
                  </div>
                </div>
              </div>

              <div className="resp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="dashboard-card" style={{ minWidth: 0 }}>
                  <h3 className="card-title">
                    <Flame size={17} color="#f97316" style={{ flexShrink: 0 }} />
                    Streak & Achievements
                  </h3>
                  <StreakBadges
                    weightHistory={weightHistory}
                    startWeight={diagnosis?.initialWeight}
                    goalWeight={diagnosis?.goalWeight}
                    currentWeight={latestWeight}
                  />
                </div>

                <div className="dashboard-card" style={{ minWidth: 0 }}>
                  <h3 className="card-title">
                    <Activity size={17} color="#6366f1" style={{ flexShrink: 0 }} />
                    Progress & Insights
                  </h3>
                  <WeeklyInsight
                    weightHistory={weightHistory}
                    fitnessGoal={diagnosis?.fitnessGoal}
                    startWeight={diagnosis?.initialWeight}
                    goalWeight={diagnosis?.goalWeight}
                    currentWeight={latestWeight}
                  />
                </div>

                <div className="dashboard-card" style={{ minWidth: 0 }}>
                  <h3 className="card-title">
                    <TrendingUp size={17} color="#059669" style={{ flexShrink: 0 }} />
                    Weight Trend
                  </h3>
                  <WeightChart weightHistory={weightHistory} />
                </div>
              </div>

              <div className="dashboard-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="dashboard-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 className="card-title"><Heart size={17} color="#ef4444" style={{ flexShrink: 0 }} /> My Health Profile</h3>
                      <button onClick={() => setShowProfile(true)} className="btn btn-outline btn-sm" style={{ width: 'auto', gap: '5px' }} id="edit-profile-btn">
                        <Pencil size={13} /> Edit
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[
                        { label: 'Height', value: `${diagnosis?.height} cm` },
                        { label: 'Age / Gender', value: `${diagnosis?.age} yrs / ${diagnosis?.gender}` },
                        { label: 'Fitness Goal', value: diagnosis?.fitnessGoal, accent: true },
                        { label: 'Goal Weight', value: diagnosis?.goalWeight ? `${diagnosis.goalWeight} kg` : 'Not set' },
                        { label: 'Breakfast', value: diagnosis?.preferredTimes?.breakfast },
                        { label: 'Lunch', value: diagnosis?.preferredTimes?.lunch },
                        { label: 'Dinner', value: diagnosis?.preferredTimes?.dinner },
                      ].map(row => (
                        <div key={row.label} className="profile-info-row">
                          <span className="profile-info-label">{row.label}</span>
                          <span className="profile-info-value" style={row.accent ? { color: 'var(--primary)' } : {}}>{row.value || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {diagnosis?.medicalHistory && diagnosis.medicalHistory !== 'None' && (
                    <div className="dashboard-card">
                      <h3 className="card-title"><Stethoscope size={17} color="#8b5cf6" style={{ flexShrink: 0 }} /> Medical Notes</h3>
                      <p style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>{diagnosis.medicalHistory}</p>
                    </div>
                  )}
                </div>

                {/* Weight log history */}
                <div className="dashboard-card">
                  <h3 className="card-title"><Calendar size={17} color="#059669" style={{ flexShrink: 0 }} /> Weight Log History</h3>
                  {weightHistory.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon"><Scale size={40} color="#94a3b8" /></span>
                      <h4>No logs yet</h4>
                      <p>Click "Log Weight" to record your first entry.</p>
                    </div>
                  ) : (
                    <div className="history-table-container">
                      <table className="history-table" id="weight-history-table">
                        <thead>
                          <tr><th>Date</th><th>Weight</th><th>Change</th></tr>
                        </thead>
                        <tbody>
                          {weightHistory.map((item, idx) => {
                            let diff = null, color = 'var(--text-muted)', txt = '—';
                            if (idx < weightHistory.length - 1) {
                              diff = item.weight - weightHistory[idx + 1].weight;
                              txt = diff > 0 ? `+${diff.toFixed(1)} kg` : diff < 0 ? `${diff.toFixed(1)} kg` : '0.0 kg';
                              color = diff > 0 ? 'var(--accent-danger)' : diff < 0 ? 'var(--accent-success)' : 'var(--text-muted)';
                            }
                            return (
                              <tr key={item.id}>
                                <td>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                                <td style={{ fontWeight: '600' }}>{item.weight.toFixed(1)} kg</td>
                                <td style={{ color, fontWeight: '600' }}>{txt}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MY CUSTOMERS TAB ── */}
          {activeTab === 'customers' && isCoach && <MyCustomersTab coachUid={user.uid} />}

          {/* ── 10-DAY FOLLOW-UP TAB ── */}
          {activeTab === 'followup' && isCoach && <FollowUpTab coachUid={user.uid} coachName={userData?.name || ''} />}

          {/* ── CRM TAB ── */}
          {activeTab === 'crm' && isCoach && <CrmTab coachUid={user.uid} />}

          {/* ── CRM ANALYTICS TAB ── */}
          {activeTab === 'crm_analytics' && isCoach && <CrmAnalyticsTab coachUid={user.uid} />}

          {/* ── MY COACHES TAB ── */}
          {activeTab === 'my_coaches' && isCoach && <MyCoachesTab coachUid={user.uid} />}

          {/* ── ATTENDANCE TAB ── */}
          {activeTab === 'attendance' && <AttendanceTab user={user} userData={userData} />}

          {/* ── ADMIN TAB ── */}
          {activeTab === 'admin' && isAdmin && <AdminTab currentAdminUid={user.uid} />}
        </div>
      </div>

      {/* ── WEIGHT LOG MODAL ── */}
      {showWeightModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Log Today's Weight</h3>
              <button onClick={() => { setShowWeightModal(false); setModalError(''); }} className="modal-close"><X size={14} /></button>
            </div>
            {modalError && <div className="alert alert-danger">{modalError}</div>}
            <form onSubmit={handleUpdateWeight}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="weight-input">Weight (kg)</label>
                <input
                  type="number" step="0.1" id="weight-input"
                  className="form-input" placeholder="e.g. 70.5"
                  value={newWeight} onChange={e => setNewWeight(e.target.value)}
                  required autoFocus disabled={modalSubmitting}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowWeightModal(false); setModalError(''); }} disabled={modalSubmitting} style={{ width: '40%' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={modalSubmitting} style={{ width: '60%', gap: '6px' }} id="modal-submit-weight">
                  {modalSubmitting ? 'Saving...' : <><Plus size={15} /> Save Weight</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfile && (
        <ProfileModal
          user={user}
          userData={userData}
          diagnosis={diagnosis}
          onClose={() => setShowProfile(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
