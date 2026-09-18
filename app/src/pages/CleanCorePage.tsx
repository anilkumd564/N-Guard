/**
 * N-Guard — CleanCorePage (Phase 9)
 *
 * Clean Core and Extensibility Governance dashboard.
 * Lets users run a Clean Core analysis against a design request
 * and view the versioned rules-based result.
 *
 * Architecture rules:
 *  - Rule 2: Technique applicability is edition-specific (shown in matrix).
 *  - Rule 5: Analyzer recommends; results always show alternatives.
 *  - Rule 12: Rules are versioned — catalog version is shown in results.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import { listDesignRequests, runCleanCoreAnalysis, listCleanCoreAnalyses } from '../api/client.js';
import type {
  DesignRequest,
  CleanCoreAnalysis,
  CleanCoreTier,
  CleanCoreRisk,
  ExtensibilityTechnique,
} from '../types/api.js';
import {
  CLEAN_CORE_TIER_LABELS,
  CLEAN_CORE_TIER_COLORS,
  CLEAN_CORE_RISK_COLORS,
  EXTENSIBILITY_TECHNIQUE_LABELS,
} from '../types/api.js';

// ── Visual Helpers ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier?: CleanCoreTier }) {
  if (!tier) return null;
  const color = CLEAN_CORE_TIER_COLORS[tier];
  const short: Record<CleanCoreTier, string> = { TIER_1: 'T1', TIER_2: 'T2', TIER_3: 'T3', TIER_4: 'T4' };
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:color+'22', color, border:`1.5px solid ${color}55` }}>
      {short[tier]} {tier}
    </span>
  );
}

function RiskBadge({ risk }: { risk?: CleanCoreRisk }) {
  if (!risk) return null;
  const color = CLEAN_CORE_RISK_COLORS[risk];
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:color+'22', color, border:`1px solid ${color}44` }}>
      {risk}
    </span>
  );
}

function TechniqueBadge({ t }: { t?: ExtensibilityTechnique }) {
  if (!t) return null;
  const colors: Record<ExtensibilityTechnique, string> = {
    STANDARD_ADOPTION: '#22c55e', CONFIGURATION: '#84cc16',
    KEY_USER_EXTENSIBILITY: '#facc15', DEVELOPER_EXTENSIBILITY: '#fb923c',
    BTP_SIDE_BY_SIDE: '#60a5fa', CLASSIC_CUSTOM: '#ef4444',
  };
  const color = colors[t];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700, background:color+'22', color, border:`1.5px solid ${color}55` }}>
      {EXTENSIBILITY_TECHNIQUE_LABELS[t]}
    </span>
  );
}

function safeJson(json?: string): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

interface TechApplicability {
  technique   : ExtensibilityTechnique;
  applicable  : boolean;
  tier        : CleanCoreTier;
  riskLevel   : CleanCoreRisk;
  notes?      : string;
}

// ── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({ analysis, onClose }: { analysis: CleanCoreAnalysis; onClose: () => void }) {
  const concerns    = safeJson(analysis.concerns);
  const riskFactors = safeJson(analysis.riskFactors);
  const unknowns    = safeJson(analysis.unknowns);

  let applicability: TechApplicability[] = [];
  try {
    if (analysis.techniqueApplicability) {
      applicability = JSON.parse(analysis.techniqueApplicability) as TechApplicability[];
    }
  } catch { /* ignore */ }

  const card = (children: React.ReactNode, mb = 16) => (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:mb }}>{children}</div>
  );
  const sec = (title: string) => (
    <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 12px' }}>{title}</h3>
  );

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'58%', maxWidth:700, background:'#0f172a', borderLeft:'1px solid #1e293b', overflowY:'auto', zIndex:100, padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ color:'#f1f5f9', margin:'0 0 4px', fontSize:20 }}>Clean Core Analysis</h2>
          <p style={{ color:'#64748b', margin:0, fontSize:12 }}>Catalog v{analysis.catalogVersion ?? '1.0'} · Schema v{analysis.schemaVersion ?? '1.0'}</p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'1px solid #334155', color:'#94a3b8', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:13 }}>✕</button>
      </div>

      {/* Primary result */}
      {card(<>
        {sec('Recommended Technique')}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <TechniqueBadge t={analysis.preferredTechnique} />
          <TierBadge tier={analysis.cleanCoreTier} />
          <RiskBadge risk={analysis.riskLevel} />
        </div>
        {analysis.cleanCoreTier && (
          <p style={{ color:'#94a3b8', fontSize:12, margin:'8px 0 0' }}>{CLEAN_CORE_TIER_LABELS[analysis.cleanCoreTier]}</p>
        )}
        <div style={{ display:'flex', gap:12, marginTop:10 }}>
          {analysis.requiredArchitectureReview && (
            <span style={{ padding:'2px 8px', borderRadius:8, fontSize:11, background:'#78350f33', color:'#fbbf24' }}>🏛 Architecture Review Required</span>
          )}
          {analysis.requiresException && (
            <span style={{ padding:'2px 8px', borderRadius:8, fontSize:11, background:'#7f1d1d33', color:'#fca5a5' }}>⚠️ Formal Exception Required</span>
          )}
        </div>
      </>)}

      {/* Safer alternative */}
      {analysis.saferAlternative && card(<>
        {sec('Safer Alternative')}
        <TechniqueBadge t={analysis.saferAlternative} />
        <p style={{ color:'#64748b', fontSize:12, margin:'8px 0 0' }}>Consider this lower-risk technique before proceeding with the proposed approach.</p>
      </>)}

      {/* Concerns */}
      {concerns.length > 0 && card(<>
        {sec(`Concerns (${concerns.length})`)}
        <ul style={{ color:'#fef08a', margin:0, paddingLeft:20 }}>
          {concerns.map((c, i) => <li key={i} style={{ marginBottom:6, fontSize:13, lineHeight:1.5 }}>{c}</li>)}
        </ul>
      </>)}

      {/* Risk Factors */}
      {riskFactors.length > 0 && card(<>
        {sec(`Risk Factors (${riskFactors.length})`)}
        <ul style={{ color:'#fca5a5', margin:0, paddingLeft:20 }}>
          {riskFactors.map((r, i) => <li key={i} style={{ marginBottom:6, fontSize:13, lineHeight:1.5 }}>{r}</li>)}
        </ul>
      </>)}

      {/* Unknowns */}
      {unknowns.length > 0 && card(<>
        {sec('Unknowns / Verification Required')}
        <ul style={{ color:'#94a3b8', margin:0, paddingLeft:20 }}>
          {unknowns.map((u, i) => <li key={i} style={{ marginBottom:6, fontSize:13, lineHeight:1.5 }}>{u}</li>)}
        </ul>
      </>)}

      {/* Technique Applicability Matrix */}
      {applicability.length > 0 && card(<>
        {sec(`Technique Applicability — ${analysis.edition}`)}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {applicability.map(ta => {
            const tc = EXTENSIBILITY_TECHNIQUE_LABELS[ta.technique] ?? ta.technique;
            const tierColor = CLEAN_CORE_TIER_COLORS[ta.tier] ?? '#94a3b8';
            return (
              <div key={ta.technique} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#0f172a', borderRadius:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background: ta.applicable ? '#22c55e' : '#ef4444', flexShrink:0 }} />
                <span style={{ color: ta.applicable ? '#e2e8f0' : '#475569', fontSize:12, flex:1 }}>{tc}</span>
                <span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, background:tierColor+'22', color:tierColor }}>{ta.tier}</span>
                <RiskBadge risk={ta.riskLevel} />
              </div>
            );
          })}
        </div>
        <p style={{ color:'#475569', fontSize:11, margin:'12px 0 0' }}>
          🟢 Applicable · 🔴 Not applicable for this edition
        </p>
      </>)}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CleanCorePage() {
  const { selectedProject } = useProjectContext();
  const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);
  const [selectedDR,     setSelectedDR]     = useState<string>('');
  const [approach,       setApproach]       = useState<string>('');
  const [running,        setRunning]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [result,         setResult]         = useState<CleanCoreAnalysis | null>(null);
  const [history,        setHistory]        = useState<CleanCoreAnalysis[]>([]);

  const loadDRs = useCallback(async () => {
    if (!selectedProject) return;
    const drs = await listDesignRequests(selectedProject.ID);
    setDesignRequests(drs);
  }, [selectedProject]);

  const loadHistory = useCallback(async () => {
    if (!selectedProject) return;
    const all = await listCleanCoreAnalyses();
    setHistory(all.filter(a => a.project_ID === selectedProject.ID).slice(0, 8));
  }, [selectedProject]);

  useEffect(() => {
    void loadDRs();
    void loadHistory();
  }, [loadDRs, loadHistory]);

  const handleRun = async () => {
    if (!selectedDR) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runCleanCoreAnalysis(selectedDR, approach || 'Not specified');
      setResult(res);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to run Clean Core analysis.
      </div>
    );
  }

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>🧹 Clean Core</h1>
        <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
          {selectedProject.name} · {selectedProject.cleanCorePolicy} policy · Versioned rule catalog v1.0
        </p>
      </div>

      {/* Run Panel */}
      <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:24 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>Design Request</label>
            <select
              value={selectedDR}
              onChange={e => setSelectedDR(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:13 }}
            >
              <option value=''>— Select a requirement —</option>
              {designRequests.map(dr => (
                <option key={dr.ID} value={dr.ID}>{dr.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
            Proposed Implementation Approach
          </label>
          <textarea
            value={approach}
            onChange={e => setApproach(e.target.value)}
            placeholder='Describe the proposed technical approach (e.g. BAdI implementation, Z-report, BTP extension, key-user custom field)…'
            rows={3}
            style={{ width:'100%', padding:'8px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:13, resize:'vertical', boxSizing:'border-box' }}
          />
        </div>
        <button
          onClick={() => void handleRun()}
          disabled={!selectedDR || running}
          style={{ padding:'9px 20px', background: selectedDR && !running ? '#22c55e' : '#334155', color: selectedDR && !running ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor: selectedDR && !running ? 'pointer' : 'default', fontSize:13, fontWeight:600 }}
        >
          {running ? '⏳ Analyzing...' : '▶ Run Clean Core Analysis'}
        </button>
      </div>

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {/* History */}
      {history.length > 0 && !result && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:20 }}>
          <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 16px' }}>Recent Analyses</h3>
          {history.map(h => {
            const tierColor = h.cleanCoreTier ? CLEAN_CORE_TIER_COLORS[h.cleanCoreTier] : '#94a3b8';
            const riskColor = h.riskLevel ? CLEAN_CORE_RISK_COLORS[h.riskLevel] : '#94a3b8';
            return (
              <div
                key={h.ID}
                onClick={() => setResult(h)}
                style={{ padding:'12px 14px', background:'#0f172a', borderRadius:8, marginBottom:8, cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
              >
                <div style={{ flex:1 }}>
                  <div style={{ color:'#e2e8f0', fontSize:13, marginBottom:4 }}>
                    {h.preferredTechnique ? EXTENSIBILITY_TECHNIQUE_LABELS[h.preferredTechnique] : '—'}
                  </div>
                  <div style={{ color:'#64748b', fontSize:11 }}>
                    {h.edition} · {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {h.cleanCoreTier && <span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, background:tierColor+'22', color:tierColor }}>{h.cleanCoreTier}</span>}
                  {h.riskLevel && <span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, background:riskColor+'22', color:riskColor }}>{h.riskLevel}</span>}
                  {h.requiredArchitectureReview && <span style={{ fontSize:10, color:'#fbbf24' }}>🏛</span>}
                  {h.requiresException && <span style={{ fontSize:10, color:'#fca5a5' }}>⚠️</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Result panel */}
      {result && (
        <ResultPanel analysis={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}
