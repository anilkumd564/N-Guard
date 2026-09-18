/**
 * N-Guard — AssessmentsPage (Phase 7)
 *
 * Lists F1-F8 Fit-to-Standard assessments for the active project.
 * Clicking a row opens the full structured detail panel:
 *  - Fit classification badge + deployment compatibility code
 *  - Evidence confidence + human review flag
 *  - Business intent, process classification, standard capability
 *  - Gap description, configuration opportunity, customization risk
 *  - Recommended next action
 *  - Full recommendations list
 *  - Assumptions and unknowns
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import {
  listAssessments,
  listDesignRequests,
} from '../api/client.js';
import type {
  ComplianceAssessment,
  DesignRequest,
  Recommendation,
  FitClassification,
  EvidenceConfidence,
} from '../types/api.js';
import {
  FIT_CLASSIFICATION_LABELS,
  FIT_CLASSIFICATION_COLORS,
  CONFIDENCE_LABELS,
} from '../types/api.js';

// ── Visual Helpers ────────────────────────────────────────────────────────────

const FC_ICON: Record<FitClassification, string> = {
  F1:'✅', F2:'🔧', F3:'🔩', F4:'🧩', F5:'↩️', F6:'⚠️', F7:'🏢', F8:'❓',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:'#94a3b8', PROCESSING:'#60a5fa', COMPLETED:'#22c55e', FAILED:'#ef4444',
};

const CONF_COLOR: Record<EvidenceConfidence, string> = {
  VERIFIED:'#22c55e', LIKELY:'#84cc16',
  NEEDS_SME_REVIEW:'#facc15', INSUFFICIENT_EVIDENCE:'#94a3b8',
};

function FitBadge({ fc }: { fc: FitClassification }) {
  const color = FIT_CLASSIFICATION_COLORS[fc];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:14, fontSize:12, fontWeight:700, background:color+'22', color, border:`1.5px solid ${color}55` }}>
      {FC_ICON[fc]} {FIT_CLASSIFICATION_LABELS[fc]}
    </span>
  );
}

function ConfBadge({ c }: { c: EvidenceConfidence }) {
  const color = CONF_COLOR[c];
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {CONFIDENCE_LABELS[c]}
    </span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const color = STATUS_COLOR[s] ?? '#94a3b8';
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {s}
    </span>
  );
}

function safeJson(json?: string): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ a, drTitle, onClose }: { a: ComplianceAssessment; drTitle?: string; onClose: () => void }) {
  const recs        = a.recommendations ?? [];
  const assumptions = safeJson(a.assumptions);
  const unknowns    = safeJson(a.unknowns);

  const card = (children: React.ReactNode, mb = 16) => (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:mb }}>{children}</div>
  );
  const sec = (title: string) => (
    <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 12px' }}>{title}</h3>
  );

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'60%', maxWidth:720, background:'#0f172a', borderLeft:'1px solid #1e293b', overflowY:'auto', zIndex:100, padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ color:'#f1f5f9', margin:'0 0 4px', fontSize:20 }}>Assessment Detail</h2>
          <p style={{ color:'#64748b', margin:0, fontSize:12 }}>{drTitle ?? a.designRequest_ID} · v{a.agentSchemaVersion ?? '1.0'}</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'1px solid #334155', color:'#94a3b8', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:13 }}>✕ Close</button>
      </div>

      {/* Status */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <StatusBadge s={a.status} />
        {a.fitClassification    && <FitBadge fc={a.fitClassification} />}
        {a.deploymentCompatibility && <span style={{ padding:'3px 10px', borderRadius:14, fontSize:12, fontWeight:600, background:'#33415544', color:'#94a3b8', border:'1px solid #475569' }}>{a.deploymentCompatibility}</span>}
        {a.evidenceConfidence  && <ConfBadge c={a.evidenceConfidence} />}
        {a.humanReviewRequired && <span style={{ padding:'3px 10px', borderRadius:14, fontSize:12, fontWeight:600, background:'#7f1d1d33', color:'#fca5a5', border:'1px solid #7f1d1d55' }}>👁 Human Review Required</span>}
      </div>

      {/* Confidence bar */}
      {a.confidence !== undefined && card(
        <>
          {sec('Evidence Confidence')}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, height:6, background:'#334155', borderRadius:3, overflow:'hidden' }}>
              <div style={{ width:`${a.confidence*100}%`, height:'100%', background:'#3b82f6', borderRadius:3 }} />
            </div>
            <span style={{ color:'#94a3b8', fontSize:13, fontWeight:700, minWidth:36 }}>{Math.round(a.confidence*100)}%</span>
          </div>
        </>
      )}

      {/* Business Intent */}
      {a.businessIntentSummary && card(
        <>
          {sec('Business Intent')}
          <p style={{ color:'#e2e8f0', margin:'0 0 8px', lineHeight:1.6 }}>{a.businessIntentSummary}</p>
          {a.processClassification   && <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:12 }}>Process: {a.processClassification}</p>}
          {a.targetDeploymentContext && <p style={{ color:'#64748b', margin:'4px 0 0', fontSize:12 }}>Context: {a.targetDeploymentContext}</p>}
        </>
      )}

      {/* Fit Analysis */}
      {(a.standardCapability||a.gapDescription||a.configurationOpportunity||a.customizationRiskStatement) && card(
        <>
          {sec('Standard vs. Gap Analysis')}
          {a.standardCapability && <div style={{ marginBottom:10 }}><span style={{ color:'#22c55e', fontSize:12, fontWeight:600 }}>✅ Standard Capability</span><p style={{ color:'#86efac', margin:'4px 0 0', lineHeight:1.6 }}>{a.standardCapability}</p></div>}
          {a.gapDescription && <div style={{ marginBottom:10 }}><span style={{ color:'#facc15', fontSize:12, fontWeight:600 }}>⚡ Gap Description</span><p style={{ color:'#fef08a', margin:'4px 0 0', lineHeight:1.6 }}>{a.gapDescription}</p></div>}
          {a.configurationOpportunity && <div style={{ marginBottom:10 }}><span style={{ color:'#60a5fa', fontSize:12, fontWeight:600 }}>🔧 Configuration Opportunity</span><p style={{ color:'#bfdbfe', margin:'4px 0 0', lineHeight:1.6 }}>{a.configurationOpportunity}</p></div>}
          {a.customizationRiskStatement && <div><span style={{ color:'#f87171', fontSize:12, fontWeight:600 }}>⚠️ Customization Risk</span><p style={{ color:'#fecaca', margin:'4px 0 0', lineHeight:1.6 }}>{a.customizationRiskStatement}</p></div>}
        </>
      )}

      {/* Recommended Next Action */}
      {a.recommendedNextAction && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:16, borderLeft:'3px solid #3b82f6' }}>
          {sec('Recommended Next Action')}
          <p style={{ color:'#e2e8f0', margin:0, lineHeight:1.6 }}>{a.recommendedNextAction}</p>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && card(
        <>
          {sec(`Recommendations (${recs.length})`)}
          {recs.map((r: Recommendation, i: number) => (
            <div key={i} style={{ background:'#0f172a', borderRadius:8, padding:14, marginBottom:8 }}>
              <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, background:'#334155', color:'#94a3b8' }}>{r.type}</span>
                <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, background:'#1e293b', color:r.effort==='HIGH'?'#f87171':r.effort==='MEDIUM'?'#facc15':'#86efac' }}>{r.effort}</span>
                <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, background:'#1e293b', color:r.priority==='CRITICAL'?'#f87171':'#94a3b8' }}>{r.priority}</span>
              </div>
              <p style={{ color:'#e2e8f0', margin:'0 0 4px', fontSize:14 }}>{r.description}</p>
              {r.rationale && <p style={{ color:'#64748b', margin:0, fontSize:12, fontStyle:'italic' }}>{r.rationale}</p>}
            </div>
          ))}
        </>
      )}

      {/* Assumptions / Unknowns */}
      {(assumptions.length>0||unknowns.length>0) && card(
        <>
          {assumptions.length>0 && <>
            {sec('Assumptions')}
            <ul style={{ color:'#cbd5e1', margin:'0 0 12px', paddingLeft:20 }}>
              {assumptions.map((x,i) => <li key={i} style={{ marginBottom:4, fontSize:13 }}>{x}</li>)}
            </ul>
          </>}
          {unknowns.length>0 && <>
            {sec('Unknowns')}
            <ul style={{ color:'#fbbf24', margin:0, paddingLeft:20 }}>
              {unknowns.map((x,i) => <li key={i} style={{ marginBottom:4, fontSize:13 }}>{x}</li>)}
            </ul>
          </>}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { selectedProject } = useProjectContext();
  const [assessments, setAssessments] = useState<ComplianceAssessment[]>([]);
  const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [selected, setSelected] = useState<ComplianceAssessment | null>(null);

  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const [aa, drs] = await Promise.all([
        listAssessments(),
        listDesignRequests(selectedProject.ID),
      ]);
      const projectAssessments = aa.filter(a => a.project_ID === selectedProject.ID);
      projectAssessments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssessments(projectAssessments);
      setDesignRequests(drs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { void load(); }, [load]);

  // Poll every 5 seconds if any assessment is PENDING/PROCESSING
  useEffect(() => {
    const hasPending = assessments.some(a => a.status === 'PENDING' || a.status === 'PROCESSING');
    if (hasPending) {
      const id = setInterval(() => { void load(); }, 5000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [assessments, load]);

  const drMap = new Map(designRequests.map(dr => [dr.ID, dr]));

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to view its assessments.
      </div>
    );
  }

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
        <div>
          <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>⚖️ Assessments</h1>
          <p style={{ color:'#64748b', margin:0, fontSize:13 }}>{selectedProject.name} · {selectedProject.edition}</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}
        >
          {loading ? '⏳ Loading…' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Assessment Table */}
      {assessments.length === 0 && !loading ? (
        <div style={{ textAlign:'center', padding:'80px 0', color:'#475569' }}>
          <p style={{ fontSize:48, margin:'0 0 16px' }}>⚖️</p>
          <p style={{ fontSize:18, margin:'0 0 8px', color:'#64748b' }}>No assessments yet</p>
          <p style={{ fontSize:13 }}>Submit a Design Request for assessment from the Requirements page.</p>
        </div>
      ) : (
        <div style={{ background:'#1e293b', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #334155' }}>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1 }}>Design Request</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1 }}>Classification</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1 }}>Status</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1 }}>Confidence</th>
                <th style={{ padding:'12px 16px', textAlign:'left', color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map(a => {
                const dr = drMap.get(a.designRequest_ID);
                const statusColor = STATUS_COLOR[a.status] ?? '#94a3b8';
                return (
                  <tr
                    key={a.ID}
                    onClick={() => setSelected(a)}
                    style={{ cursor:'pointer', borderBottom:'1px solid #0f172a', transition:'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding:'14px 16px', color:'#e2e8f0', fontSize:14, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {dr?.title ?? a.designRequest_ID.slice(0, 16) + '…'}
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      {a.fitClassification
                        ? <FitBadge fc={a.fitClassification} />
                        : <span style={{ color:'#475569', fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:statusColor+'22', color:statusColor, border:`1px solid ${statusColor}44` }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      {a.confidence !== undefined
                        ? <span style={{ color:'#94a3b8', fontSize:13, fontWeight:600 }}>{Math.round(a.confidence * 100)}%</span>
                        : <span style={{ color:'#475569', fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:'14px 16px', color:'#64748b', fontSize:12 }}>
                      {a.processedAt
                        ? new Date(a.processedAt).toLocaleDateString()
                        : new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <DetailPanel
          a={selected}
          drTitle={drMap.get(selected.designRequest_ID)?.title}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
