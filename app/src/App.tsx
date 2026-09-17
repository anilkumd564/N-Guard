/**
 * N-Guard — Application Shell (Phase 1)
 *
 * Enterprise sidebar layout with navigation for all functional areas.
 * Page content is placeholder only — business features are implemented
 * in later phases.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.js';
import config from './config/index.js';
import { ProjectProvider, useProjectContext } from './context/ProjectContext.js';

// ─── Page imports ─────────────────────────────────────────────────────────────
import DashboardPage      from './pages/DashboardPage.js';
import ProjectsPage       from './pages/ProjectsPage.js';
import RequirementsPage          from './pages/RequirementsPage.js';
import RequirementDetailPage     from './pages/RequirementDetailPage.js';
import AssessmentsPage    from './pages/AssessmentsPage.js';
import CompareEditionsPage from './pages/CompareEditionsPage.js';
import CleanCorePage      from './pages/CleanCorePage.js';
import DecisionsPage      from './pages/DecisionsPage.js';
import KnowledgePage      from './pages/KnowledgePage.js';
import ReportsPage        from './pages/ReportsPage.js';
import AdminPage          from './pages/AdminPage.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type BackendStatus = 'unknown' | 'online' | 'offline';

// ─── Navigation definition ────────────────────────────────────────────────────

interface NavItem {
  to      : string;
  label   : string;
  icon    : string;
  end?    : boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/',         label: 'Dashboard',       icon: '◉',  end: true },
  { to: '/projects', label: 'Projects',        icon: '📁' },
  { to: '/requirements', label: 'Requirements', icon: '📋' },
  { to: '/assessments',  label: 'Assessments',  icon: '⚖️' },
  { to: '/compare',      label: 'Compare Editions', icon: '⇌' },
  { to: '/clean-core',   label: 'Clean Core',   icon: '✦' },
  { to: '/decisions',    label: 'Decisions',    icon: '📌' },
  { to: '/knowledge',    label: 'Knowledge',    icon: '📚' },
  { to: '/reports',      label: 'Reports',      icon: '📊' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Administration', icon: '⚙️' },
];

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('unknown');
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const location = useLocation();
  const { selectedProject } = useProjectContext();

  // Close sidebar on small screens when navigating
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);

  // Ping backend on mount to verify connectivity
  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(config.pingUrl, { method: 'GET' });
      setBackendStatus(res.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => { checkBackend(); }, [checkBackend]);

  return (
    <div className={`shell ${sidebarOpen ? 'shell--sidebar-open' : 'shell--sidebar-closed'}`}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar__left">
          <button
            className="topbar__menu-btn"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="topbar__brand">
            <span className="topbar__logo">⚖️</span>
            <span className="topbar__name">{config.appName}</span>
            <span className="topbar__tagline">Fit-to-Standard Compliance Agent</span>
          </div>
        </div>
        <div className="topbar__right">
          {selectedProject && (
            <span style={{ fontSize:'0.75rem', color:'#94a3b8', background:'#1e293b', borderRadius:5, padding:'0.2rem 0.6rem', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
              title={selectedProject.name}>
              📁 {selectedProject.name}
            </span>
          )}
          <StatusIndicator status={backendStatus} onRetry={checkBackend} />
          <span className="topbar__version">v{config.appVersion}</span>
        </div>
      </header>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar__section">
          {PRIMARY_NAV.map(item => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        <div className="sidebar__divider" />
        <div className="sidebar__section">
          {ADMIN_NAV.map(item => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        <div className="sidebar__footer">
          <span>N-Guard v{config.appVersion}</span>
        </div>
      </nav>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="main-content">
        <ErrorBoundary>
          <Routes>
            <Route path="/"              element={<DashboardPage />} />
            <Route path="/projects"      element={<ProjectsPage />} />
            <Route path="/requirements"     element={<RequirementsPage />} />
            <Route path="/requirements/:id" element={<RequirementDetailWrapper />} />
            <Route path="/assessments"   element={<AssessmentsPage />} />
            <Route path="/assessments/:id" element={<AssessmentsPage />} />
            <Route path="/compare"       element={<CompareEditionsPage />} />
            <Route path="/clean-core"    element={<CleanCorePage />} />
            <Route path="/decisions"     element={<DecisionsPage />} />
            <Route path="/knowledge"     element={<KnowledgePage />} />
            <Route path="/reports"       element={<ReportsPage />} />
            <Route path="/admin"         element={<AdminPage />} />
            <Route path="*"              element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>

    </div>
  );
}

// ─── Sidebar link ─────────────────────────────────────────────────────────────

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        ['sidebar__link', isActive ? 'sidebar__link--active' : ''].filter(Boolean).join(' ')
      }
    >
      <span className="sidebar__link-icon" aria-hidden="true">{item.icon}</span>
      <span className="sidebar__link-label">{item.label}</span>
    </NavLink>
  );
}

// ─── Status indicator ─────────────────────────────────────────────────────────

function StatusIndicator({
  status,
  onRetry,
}: {
  status  : BackendStatus;
  onRetry : () => void;
}) {
  const label = { unknown: 'Connecting…', online: 'Connected', offline: 'Backend offline' };
  const dot   = { unknown: '#94a3b8',     online: '#22c55e',   offline: '#ef4444' };

  return (
    <button
      className="status-indicator"
      onClick={onRetry}
      title={`Backend status: ${status}. Click to retry.`}
      style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
    >
      <span
        style={{
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: dot[status],
          display: 'inline-block',
          ...(status === 'unknown' ? { animation: 'pulse 1.5s infinite' } : {}),
        }}
      />
      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label[status]}</span>
    </button>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  );
}

// ─── Requirement detail wrapper ───────────────────────────────────────────────

function RequirementDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return id ? <RequirementDetailPage id={id} /> : <NotFound />;
}

// ─── 404 ──────────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>404</h1>
      <p style={{ marginTop: '0.5rem' }}>Page not found.</p>
    </div>
  );
}
