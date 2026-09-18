/**
 * N-Guard — AdminPage (Phase 12)
 *
 * Administration dashboard showing:
 *  - Async Job Queue: list, cancel, retry, submit jobs
 *  - Integration Health: status of all configured integration targets
 *    (returns NOT_CONFIGURED when credentials are absent — never fabricated)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import {
  listAsyncJobs,
  cancelJob,
  retryJob,
  getIntegrationHealth,
} from '../api/client.js';
import type {
  AsyncJob,
  IntegrationHealth,
  JobStatus,
  IntegrationHealthStatus,
} from '../types/api.js';
import {
  JOB_STATUS_COLORS,
  JOB_TYPE_LABELS,
  INTEGRATION_STATUS_COLORS,
} from '../types/api.js';

// ── Visual Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const color = JOB_STATUS_COLORS[status];
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {status}
    </span>
  );
}

function HealthDot({ status }: { status: IntegrationHealthStatus }) {
  const color = INTEGRATION_STATUS_COLORS[status];
  return <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:color, marginRight:6, flexShrink:0 }} />;
}

// ── Integration Health Panel ──────────────────────────────────────────────────

function IntegrationHealthPanel() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const health = await getIntegrationHealth();
      setIntegrations(health);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:0 }}>Integration Health</h3>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ background:'none', border:'1px solid #334155', color:'#64748b', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}
        >
          {loading ? '⏳' : '↺'}
        </button>
      </div>
      <p style={{ color:'#475569', fontSize:11, margin:'0 0 12px' }}>
        NOT_CONFIGURED means no environment credentials are set. No fabricated status shown.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {integrations.map(i => {
          const color = INTEGRATION_STATUS_COLORS[i.status];
          return (
            <div key={i.target} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#0f172a', borderRadius:8 }}>
              <HealthDot status={i.status} />
              <div style={{ flex:1 }}>
                <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:600 }}>{i.label}</div>
                <div style={{ color:'#64748b', fontSize:11, marginTop:2 }}>{i.message}</div>
              </div>
              <span style={{ padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
                {i.status.replace(/_/g,' ')}
              </span>
            </div>
          );
        })}
        {integrations.length === 0 && !loading && (
          <div style={{ color:'#475569', fontSize:13 }}>Loading integration status...</div>
        )}
      </div>
    </div>
  );
}

// ── Job Queue Panel ───────────────────────────────────────────────────────────

function JobQueuePanel({ projectId }: { projectId: string }) {
  const [jobs,    setJobs]    = useState<AsyncJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await listAsyncJobs(projectId);
      setJobs(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // Poll running/queued jobs every 5s
  useEffect(() => {
    const hasPending = jobs.some(j => j.status === 'QUEUED' || j.status === 'RUNNING' || j.status === 'RETRYING');
    if (!hasPending) return undefined;
    const id = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(id);
  }, [jobs, load]);

  const handleCancel = async (jobId: string) => {
    await cancelJob(jobId);
    void load();
  };

  const handleRetry = async (jobId: string) => {
    await retryJob(jobId);
    void load();
  };

  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:0 }}>Async Job Queue</h3>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ background:'none', border:'1px solid #334155', color:'#64748b', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}
        >
          {loading ? '⏳' : '↺ Refresh'}
        </button>
      </div>

      {error && <div style={{ color:'#fca5a5', fontSize:12, marginBottom:12 }}>⚠️ {error}</div>}

      {jobs.length === 0 && !loading ? (
        <div style={{ color:'#475569', fontSize:13 }}>No jobs yet. Long-running operations will appear here.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #334155' }}>
              {['Type', 'Status', 'Progress', 'Submitted By', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const prog = job.progress ?? 0;
              return (
                <tr key={job.ID} style={{ borderBottom:'1px solid #0f172a' }}>
                  <td style={{ padding:'10px 12px', color:'#e2e8f0', fontSize:12 }}>
                    {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding:'10px 12px', minWidth:100 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ flex:1, height:4, background:'#334155', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${prog}%`, height:'100%', background:'#3b82f6', borderRadius:2 }} />
                      </div>
                      <span style={{ color:'#94a3b8', fontSize:10, minWidth:24 }}>{prog}%</span>
                    </div>
                    {job.errorMessage && (
                      <div style={{ color:'#f87171', fontSize:10, marginTop:2 }}>{job.errorMessage.slice(0,50)}</div>
                    )}
                  </td>
                  <td style={{ padding:'10px 12px', color:'#64748b', fontSize:11 }}>{job.submittedBy ?? '—'}</td>
                  <td style={{ padding:'10px 12px', color:'#64748b', fontSize:11 }}>
                    {job.createdAt ? new Date(job.createdAt).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {job.status === 'QUEUED' && (
                        <button
                          onClick={() => void handleCancel(job.ID!)}
                          style={{ padding:'3px 8px', background:'#7f1d1d33', border:'1px solid #7f1d1d55', color:'#fca5a5', borderRadius:5, cursor:'pointer', fontSize:11 }}
                        >Cancel</button>
                      )}
                      {job.status === 'FAILED' && (
                        <button
                          onClick={() => void handleRetry(job.ID!)}
                          style={{ padding:'3px 8px', background:'#1e3a5f33', border:'1px solid #1e3a5f55', color:'#60a5fa', borderRadius:5, cursor:'pointer', fontSize:11 }}
                        >↺ Retry</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { selectedProject } = useProjectContext();

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to view the administration panel.
      </div>
    );
  }

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>⚙️ Administration</h1>
        <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
          {selectedProject.name} — Job Queue and Integration Health
        </p>
      </div>

      <IntegrationHealthPanel />
      <JobQueuePanel projectId={selectedProject.ID} />
    </div>
  );
}
