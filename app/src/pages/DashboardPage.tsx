/**
 * N-Guard — Dashboard (Phase 1 Placeholder)
 *
 * Phase 11 will implement project-level governance dashboards.
 */

import React, { useCallback, useEffect, useState } from 'react';
import config from '../config/index.js';
import { useProjectContext } from '../context/ProjectContext.js';
import { S4_EDITION_LABELS } from '../types/api.js';

type PingResult = 'pending' | 'ok' | 'error';

export default function DashboardPage() {
  const { selectedProject } = useProjectContext();
  const [pingResult, setPingResult] = useState<PingResult>('pending');
  const [pingInfo, setPingInfo]     = useState<Record<string, string> | null>(null);

  const runPing = useCallback(async () => {
    setPingResult('pending');
    try {
      const res  = await fetch(config.pingUrl);
      const body = (await res.json()) as Record<string, string>;
      setPingInfo(body);
      setPingResult(res.ok ? 'ok' : 'error');
    } catch {
      setPingResult('error');
    }
  }, []);

  useEffect(() => { runPing(); }, [runPing]);

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>
        Dashboard
      </h1>

      {/* Backend connectivity card */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
        padding: '1.25rem', marginBottom: '1.5rem', maxWidth: '480px',
      }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#0f172a' }}>
          Backend Connectivity
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block',
            background: pingResult === 'ok' ? '#22c55e' : pingResult === 'error' ? '#ef4444' : '#94a3b8',
          }} />
          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
            {pingResult === 'pending' && 'Checking…'}
            {pingResult === 'ok'      && 'Backend is online'}
            {pingResult === 'error'   && 'Backend is offline or unreachable'}
          </span>
        </div>

        {pingInfo && pingResult === 'ok' && (
          <pre style={{
            background: '#f8fafc', padding: '0.75rem', borderRadius: '4px',
            fontSize: '0.75rem', color: '#475569', margin: 0, overflow: 'auto',
          }}>
            {JSON.stringify(pingInfo, null, 2)}
          </pre>
        )}

        <button
          onClick={runPing}
          style={{
            marginTop: '0.75rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem',
            background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '5px',
            cursor: 'pointer', color: '#374151',
          }}
        >
          Retry
        </button>
      </div>

      {/* Active project panel */}
      {selectedProject ? (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'1rem 1.25rem', maxWidth:540, marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:'0.5rem', color:'#15803d' }}>
            Active Project
          </h2>
          <p style={{ fontSize:'0.875rem', color:'#166534', margin:0, fontWeight:600 }}>{selectedProject.name}</p>
          <p style={{ fontSize:'0.8rem', color:'#166534', margin:'0.25rem 0 0' }}>
            {S4_EDITION_LABELS[selectedProject.edition]}
            {selectedProject.release ? ` · Release ${selectedProject.release}` : ''}
            {selectedProject.transformationType ? ` · ${selectedProject.transformationType}` : ''}
          </p>
          {selectedProject.description && (
            <p style={{ fontSize:'0.78rem', color:'#4d7c0f', margin:'0.4rem 0 0' }}>{selectedProject.description}</p>
          )}
        </div>
      ) : (
        <div style={{ background:'#fefce8', border:'1px solid #fde047', borderRadius:8, padding:'1rem 1.25rem', maxWidth:540, marginBottom:'1.5rem', fontSize:'0.875rem', color:'#713f12' }}>
          <strong>No active project</strong>
          <p style={{ marginTop:'0.3rem', lineHeight:1.6 }}>
            Navigate to <strong>Projects</strong> to create or select a project. All assessments and requirements are scoped to the active project.
          </p>
        </div>
      )}

      {/* Phase notice */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px',
        padding: '1rem 1.25rem', maxWidth: '600px', fontSize: '0.875rem', color: '#713f12',
      }}>
        <strong>Phase 2 — Core Domain Model and Deployment Profiles</strong>
        <p style={{ marginTop: '0.4rem', lineHeight: 1.6 }}>
          Projects and deployment profiles are now functional. Dashboard metrics will be added in Phase 11.
        </p>
      </div>
    </div>
  );
}
