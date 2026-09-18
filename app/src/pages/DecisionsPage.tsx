/**
 * N-Guard — DecisionsPage (Phase 10)
 *
 * Design Decision / Exception Register.
 * Lists all human governance decisions for the active project.
 * Supports filtering by status, action, and record type.
 *
 * Architecture rule 5: AI is never shown as the final approver.
 *                       Every decision shows the human actor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import { listDesignDecisions } from '../api/client.js';
import type {
  DesignDecision,
  ReviewStatus,
  ReviewAction,
} from '../types/api.js';
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_ACTION_LABELS,
} from '../types/api.js';

// ── Visual Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const color = REVIEW_STATUS_COLORS[status];
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {REVIEW_STATUS_LABELS[status]}
    </span>
  );
}

function RecordTypeBadge({ type }: { type: 'DECISION' | 'EXCEPTION' | 'ESCALATION' }) {
  const colors = { DECISION:'#60a5fa', EXCEPTION:'#a78bfa', ESCALATION:'#fb923c' };
  const color = colors[type];
  return (
    <span style={{ display:'inline-block', padding:'1px 6px', borderRadius:8, fontSize:10, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {type}
    </span>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DecisionDetail({ decision, onClose }: { decision: DesignDecision; onClose: () => void }) {
  const statusColor = REVIEW_STATUS_COLORS[decision.newStatus];
  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'50%', maxWidth:640, background:'#0f172a', borderLeft:'1px solid #1e293b', overflowY:'auto', zIndex:100, padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ color:'#f1f5f9', margin:'0 0 4px', fontSize:18 }}>Decision Detail</h2>
          <p style={{ color:'#64748b', margin:0, fontSize:12 }}>{new Date(decision.decidedAt).toLocaleString()}</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'1px solid #334155', color:'#94a3b8', padding:'6px 12px', borderRadius:6, cursor:'pointer', fontSize:13 }}>✕</button>
      </div>

      {/* Status + Type */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <StatusBadge status={decision.newStatus} />
        <RecordTypeBadge type={decision.recordType} />
        <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:'#33415544', color:'#94a3b8', border:'1px solid #475569' }}>
          {REVIEW_ACTION_LABELS[decision.reviewAction]}
        </span>
      </div>

      {/* Prior → New status */}
      <div style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#64748b', fontSize:12 }}>Prior:</span>
          <span style={{ color:'#94a3b8', fontSize:12, fontWeight:600 }}>{REVIEW_STATUS_LABELS[decision.priorStatus]}</span>
          <span style={{ color:'#475569' }}>→</span>
          <span style={{ color: statusColor, fontSize:12, fontWeight:700 }}>{REVIEW_STATUS_LABELS[decision.newStatus]}</span>
        </div>
      </div>

      {/* Actor — rule 5: AI is never the actor */}
      <div style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:16 }}>
        <div style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Decision Actor</div>
        <div style={{ color:'#e2e8f0', fontSize:14, fontWeight:600 }}>{decision.actor}</div>
        <div style={{ color:'#475569', fontSize:11, marginTop:4 }}>
          ✓ Human decision — AI was not the final approver (architecture rule 5)
        </div>
      </div>

      {/* Rationale */}
      {decision.rationale && (
        <div style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:16, borderLeft:'3px solid #a78bfa' }}>
          <div style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Rationale</div>
          <p style={{ color:'#e2e8f0', margin:0, lineHeight:1.6, fontSize:13 }}>{decision.rationale}</p>
        </div>
      )}

      {/* Modified verdict */}
      {decision.modifiedVerdict && (
        <div style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:16 }}>
          <div style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Modified Verdict</div>
          <div style={{ color:'#84cc16', fontSize:13, fontWeight:600 }}>{decision.modifiedVerdict}</div>
        </div>
      )}

      {/* Disposition notes */}
      {decision.dispositionNotes && (
        <div style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:16 }}>
          <div style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Notes</div>
          <p style={{ color:'#94a3b8', margin:0, lineHeight:1.6, fontSize:13 }}>{decision.dispositionNotes}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DecisionsPage() {
  const { selectedProject } = useProjectContext();
  const [decisions, setDecisions] = useState<DesignDecision[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<DesignDecision | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType,   setFilterType]   = useState<string>('');

  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const all = await listDesignDecisions(selectedProject.ID);
      setDecisions(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { void load(); }, [load]);

  const filtered = decisions.filter(d => {
    if (filterStatus && d.newStatus !== filterStatus) return false;
    if (filterType   && d.recordType !== filterType)  return false;
    return true;
  });

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to view the Design Decision Register.
      </div>
    );
  }

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>📋 Design Decisions</h1>
          <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
            {selectedProject.name} — Human Review and Exception Register (rule 5: AI never final approver)
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}
        >
          {loading ? '⏳' : '↺ Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding:'8px 12px', background:'#1e293b', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:12 }}
        >
          <option value=''>All Statuses</option>
          {(['ACCEPTED','MODIFIED','EXCEPTION_APPROVED','REJECTED','RETURNED','SME_ESCALATED','PENDING_REVIEW'] as ReviewStatus[]).map(s => (
            <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ padding:'8px 12px', background:'#1e293b', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:12 }}
        >
          <option value=''>All Types</option>
          <option value='DECISION'>Decisions</option>
          <option value='EXCEPTION'>Exceptions</option>
          <option value='ESCALATION'>Escalations</option>
        </select>
        <span style={{ color:'#475569', fontSize:12, alignSelf:'center' }}>
          {filtered.length} of {decisions.length} records
        </span>
      </div>

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Decision Table */}
      {filtered.length === 0 && !loading ? (
        <div style={{ textAlign:'center', padding:'80px 0', color:'#475569' }}>
          <p style={{ fontSize:48, margin:'0 0 16px' }}>📋</p>
          <p style={{ fontSize:18, margin:'0 0 8px', color:'#64748b' }}>No decisions yet</p>
          <p style={{ fontSize:13 }}>Submit an assessment for review from the Assessments page.</p>
        </div>
      ) : (
        <div style={{ background:'#1e293b', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #334155' }}>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Type</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Action</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Status</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Actor</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Date</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr
                  key={d.ID}
                  onClick={() => setSelected(d)}
                  style={{ cursor:'pointer', borderBottom:'1px solid #0f172a' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding:'12px 16px' }}><RecordTypeBadge type={d.recordType} /></td>
                  <td style={{ padding:'12px 16px', color:'#94a3b8', fontSize:12 }}>{REVIEW_ACTION_LABELS[d.reviewAction as ReviewAction]}</td>
                  <td style={{ padding:'12px 16px' }}><StatusBadge status={d.newStatus} /></td>
                  <td style={{ padding:'12px 16px', color:'#e2e8f0', fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.actor}</td>
                  <td style={{ padding:'12px 16px', color:'#64748b', fontSize:11 }}>{new Date(d.decidedAt).toLocaleDateString()}</td>
                  <td style={{ padding:'12px 16px', color:'#475569', fontSize:12, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {d.rationale ? d.rationale.slice(0, 60) + (d.rationale.length > 60 ? '…' : '') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selected && <DecisionDetail decision={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
