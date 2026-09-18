/**
 * N-Guard — CompareEditionsPage (Phase 8)
 *
 * Side-by-side comparison of SAP S/4HANA On-Premise, Cloud Private Edition,
 * and Cloud Public Edition for a selected design request.
 *
 * Architecture rules:
 *  - Rule 2: Each edition column shows only edition-specific evidence.
 *  - Rule 5: The summary describes differences; it never recommends an edition.
 *  - Rule 12: F8/INSUFFICIENT_EVIDENCE is shown explicitly, never hidden.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import {
  listDesignRequests,
  runCrossEditionComparison,
  listCrossEditionComparisons,
  listEditionComparisonResults,
} from '../api/client.js';
import type {
  DesignRequest,
  CrossEditionComparison,
  EditionComparisonResult,
  CrossEditionSummary,
  FitClassification,
  EvidenceConfidence,
  S4Edition,
} from '../types/api.js';
import {
  FIT_CLASSIFICATION_LABELS,
  FIT_CLASSIFICATION_COLORS,
  CONFIDENCE_LABELS,
  S4_EDITION_LABELS,
} from '../types/api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const EDITIONS: S4Edition[] = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'];

const FC_ICON: Record<FitClassification, string> = {
  F1:'✅', F2:'🔧', F3:'🔩', F4:'🧩', F5:'↩️', F6:'⚠️', F7:'🏢', F8:'❓',
};

// ── Visual Helpers ────────────────────────────────────────────────────────────

function FitBadge({ fc }: { fc?: FitClassification }) {
  if (!fc) return <span style={{ color:'#475569', fontSize:12 }}>—</span>;
  const color = FIT_CLASSIFICATION_COLORS[fc];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:700, background:color+'22', color, border:`1.5px solid ${color}55` }}>
      {FC_ICON[fc]} {fc}
    </span>
  );
}

const CONF_COLOR: Record<EvidenceConfidence, string> = {
  VERIFIED:'#22c55e', LIKELY:'#84cc16', NEEDS_SME_REVIEW:'#facc15', INSUFFICIENT_EVIDENCE:'#94a3b8',
};

function ConfBar({ c, conf }: { c?: EvidenceConfidence; conf?: number }) {
  if (c === undefined && conf === undefined) return null;
  const color = c ? CONF_COLOR[c] : '#3b82f6';
  const pct   = Math.round((conf ?? 0) * 100);
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:4, background:'#334155', borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2 }} />
        </div>
        <span style={{ color:'#94a3b8', fontSize:11, fontWeight:600, minWidth:28 }}>{pct}%</span>
      </div>
      {c && <span style={{ fontSize:10, color, marginTop:2, display:'block' }}>{CONFIDENCE_LABELS[c]}</span>}
    </div>
  );
}

// ── Edition Column ─────────────────────────────────────────────────────────────

function EditionColumn({ edition, result }: { edition: S4Edition; result?: EditionComparisonResult }) {
  const colColor = edition === 'ON_PREMISE' ? '#f97316' : edition === 'CLOUD_PRIVATE' ? '#a78bfa' : '#38bdf8';

  return (
    <div style={{ flex:1, minWidth:0, borderTop:`3px solid ${colColor}`, paddingTop:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:colColor, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
        {S4_EDITION_LABELS[edition]}
      </div>

      {!result ? (
        <div style={{ color:'#475569', fontSize:12 }}>Not yet assessed</div>
      ) : (
        <>
          <div style={{ marginBottom:8 }}>
            <FitBadge fc={result.fitClassification} />
          </div>
          {result.deploymentCompatibility && (
            <div style={{ marginBottom:4 }}>
              <span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, background:'#334155', color:'#94a3b8', border:'1px solid #475569' }}>
                {result.deploymentCompatibility}
              </span>
            </div>
          )}
          <ConfBar c={result.evidenceConfidence} conf={result.confidence} />
          {result.humanReviewRequired && (
            <div style={{ marginTop:6, fontSize:10, color:'#fca5a5' }}>👁 Human Review Required</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Comparison Row ─────────────────────────────────────────────────────────────

function ComparisonRowGroup({
  label, results,
}: {
  label  : string;
  results: EditionComparisonResult[];
}) {
  const byEdition = new Map(results.map(r => [r.edition, r]));
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>{label}</div>
      <div style={{ display:'flex', gap:20 }}>
        {EDITIONS.map(ed => (
          <EditionColumn key={ed} edition={ed} result={byEdition.get(ed)} />
        ))}
      </div>
    </div>
  );
}

// ── Detail Row ────────────────────────────────────────────────────────────────

function DetailRow({ label, values }: { label: string; values: Array<string|undefined> }) {
  const hasAny = values.some(v => v && v.trim());
  if (!hasAny) return null;
  return (
    <tr style={{ borderBottom:'1px solid #1e293b' }}>
      <td style={{ padding:'10px 16px', color:'#64748b', fontSize:12, fontWeight:600, width:160, verticalAlign:'top', whiteSpace:'nowrap' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ padding:'10px 16px', color: v ? '#e2e8f0' : '#475569', fontSize:12, lineHeight:1.5, verticalAlign:'top' }}>
          {v || '—'}
        </td>
      ))}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CompareEditionsPage() {
  const { selectedProject } = useProjectContext();
  const [designRequests,  setDesignRequests]  = useState<DesignRequest[]>([]);
  const [selectedDR,      setSelectedDR]      = useState<string>('');
  const [running,         setRunning]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [comparison,      setComparison]      = useState<CrossEditionComparison | null>(null);
  const [editionResults,  setEditionResults]  = useState<EditionComparisonResult[]>([]);
  const [pastComparisons, setPastComparisons] = useState<CrossEditionComparison[]>([]);
  const [summary,         setSummary]         = useState<CrossEditionSummary | null>(null);

  const loadDRs = useCallback(async () => {
    if (!selectedProject) return;
    const drs = await listDesignRequests(selectedProject.ID);
    setDesignRequests(drs);
  }, [selectedProject]);

  const loadPast = useCallback(async () => {
    if (!selectedProject) return;
    const all = await listCrossEditionComparisons();
    setPastComparisons(all.filter(c => c.project_ID === selectedProject.ID).slice(0, 5));
  }, [selectedProject]);

  useEffect(() => {
    void loadDRs();
    void loadPast();
  }, [loadDRs, loadPast]);

  const loadComparison = useCallback(async (cmp: CrossEditionComparison) => {
    setComparison(cmp);
    if (cmp.summary) {
      try { setSummary(JSON.parse(cmp.summary) as CrossEditionSummary); } catch { setSummary(null); }
    }
    if (cmp.ID) {
      const ers = await listEditionComparisonResults(cmp.ID);
      setEditionResults(ers);
    }
  }, []);

  const handleRun = async () => {
    if (!selectedDR) return;
    setRunning(true);
    setError(null);
    setComparison(null);
    setEditionResults([]);
    setSummary(null);
    try {
      const cmp = await runCrossEditionComparison(selectedDR);
      await loadComparison(cmp);
      await loadPast();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to run cross-edition comparisons.
      </div>
    );
  }

  const byEdition = new Map(editionResults.map(r => [r.edition, r]));

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>⚖️ Compare Editions</h1>
        <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
          {selectedProject.name} — Independent assessment for On-Premise, Cloud Private, and Cloud Public editions
        </p>
      </div>

      {/* Run Panel */}
      <div style={{ background:'#1e293b', borderRadius:12, padding:20, marginBottom:24 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:220 }}>
            <label style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>
              Design Request
            </label>
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
          <button
            onClick={() => void handleRun()}
            disabled={!selectedDR || running}
            style={{ padding:'9px 20px', background: selectedDR && !running ? '#3b82f6' : '#334155', color: selectedDR && !running ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor: selectedDR && !running ? 'pointer' : 'default', fontSize:13, fontWeight:600 }}
          >
            {running ? '⏳ Running...' : '▶ Run Comparison'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Comparison Result */}
      {comparison && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:24, marginBottom:24 }}>
          <h2 style={{ color:'#f1f5f9', margin:'0 0 4px', fontSize:18 }}>Comparison Result</h2>
          <p style={{ color:'#64748b', margin:'0 0 24px', fontSize:12 }}>
            Evidence is partitioned by edition — results are independent (architecture rule 2)
          </p>

          {/* Side-by-side classification summary */}
          <div style={{ display:'flex', gap:20, marginBottom:28 }}>
            {EDITIONS.map(ed => {
              const r = byEdition.get(ed);
              const colColor = ed === 'ON_PREMISE' ? '#f97316' : ed === 'CLOUD_PRIVATE' ? '#a78bfa' : '#38bdf8';
              return (
                <div key={ed} style={{ flex:1, background:'#0f172a', borderRadius:10, padding:16, borderTop:`3px solid ${colColor}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:colColor, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                    {S4_EDITION_LABELS[ed]}
                  </div>
                  {!r ? (
                    <div style={{ color:'#475569', fontSize:12 }}>No result</div>
                  ) : (
                    <>
                      <div style={{ marginBottom:6 }}><FitBadge fc={r.fitClassification} /></div>
                      {r.fitClassification && <div style={{ color:'#94a3b8', fontSize:11, marginBottom:6 }}>{FIT_CLASSIFICATION_LABELS[r.fitClassification]}</div>}
                      {r.deploymentCompatibility && <div style={{ marginBottom:6 }}><span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, background:'#334155', color:'#94a3b8' }}>{r.deploymentCompatibility}</span></div>}
                      <ConfBar c={r.evidenceConfidence} conf={r.confidence} />
                      {r.humanReviewRequired && <div style={{ marginTop:8, fontSize:10, color:'#fca5a5' }}>👁 Human Review Required</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail comparison table */}
          {editionResults.length > 0 && (
            <div style={{ background:'#0f172a', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #1e293b' }}>
                    <th style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1, width:160 }}></th>
                    {EDITIONS.map(ed => {
                      const colColor = ed === 'ON_PREMISE' ? '#f97316' : ed === 'CLOUD_PRIVATE' ? '#a78bfa' : '#38bdf8';
                      return (
                        <th key={ed} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:colColor, textTransform:'uppercase', letterSpacing:1 }}>
                          {S4_EDITION_LABELS[ed]}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <DetailRow
                    label="Standard Capability"
                    values={EDITIONS.map(ed => byEdition.get(ed)?.standardCapability)}
                  />
                  <DetailRow
                    label="Gap Description"
                    values={EDITIONS.map(ed => byEdition.get(ed)?.gapDescription)}
                  />
                  <DetailRow
                    label="Configuration"
                    values={EDITIONS.map(ed => byEdition.get(ed)?.configurationApproach)}
                  />
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div style={{ background:'#0f172a', borderRadius:10, padding:18 }}>
              <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 12px' }}>Comparison Summary</h3>

              {summary.editionsWithInsufficient.length > 0 && (
                <div style={{ background:'#78350f22', border:'1px solid #78350f55', borderRadius:8, padding:12, marginBottom:12 }}>
                  <span style={{ color:'#fbbf24', fontSize:12 }}>
                    ⚠️ Insufficient evidence for: {summary.editionsWithInsufficient.map(e => S4_EDITION_LABELS[e]).join(', ')}
                  </span>
                </div>
              )}

              {summary.commonCapabilities.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ color:'#22c55e', fontSize:11, fontWeight:600, marginBottom:4 }}>Common Across Editions</div>
                  <ul style={{ color:'#86efac', margin:0, paddingLeft:18 }}>
                    {summary.commonCapabilities.map((c, i) => <li key={i} style={{ fontSize:12, marginBottom:2 }}>{c}</li>)}
                  </ul>
                </div>
              )}

              {summary.editionSpecificNotes.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ color:'#64748b', fontSize:11, fontWeight:600, marginBottom:4 }}>Edition Differences</div>
                  <ul style={{ color:'#94a3b8', margin:0, paddingLeft:18 }}>
                    {summary.editionSpecificNotes.map((n, i) => <li key={i} style={{ fontSize:12, marginBottom:2 }}>{n}</li>)}
                  </ul>
                </div>
              )}

              <div style={{ background:'#1e293b', borderRadius:8, padding:12, borderLeft:'3px solid #3b82f6' }}>
                <div style={{ color:'#64748b', fontSize:11, fontWeight:600, marginBottom:4 }}>Recommended Next Action</div>
                <div style={{ color:'#e2e8f0', fontSize:13 }}>{summary.recommendedNextAction}</div>
              </div>

              {summary.overallHumanReviewNeeded && (
                <div style={{ marginTop:12, padding:'8px 12px', background:'#7f1d1d22', borderRadius:8, color:'#fca5a5', fontSize:12 }}>
                  👁 One or more editions require human architect review before proceeding.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past Comparisons */}
      {pastComparisons.length > 0 && !comparison && (
        <div style={{ background:'#1e293b', borderRadius:12, padding:20 }}>
          <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 12px' }}>Recent Comparisons</h3>
          {pastComparisons.map(c => (
            <div
              key={c.ID}
              onClick={() => void loadComparison(c)}
              style={{ padding:'10px 14px', background:'#0f172a', borderRadius:8, marginBottom:6, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
            >
              <span style={{ color:'#e2e8f0', fontSize:13 }}>{c.businessIntent ?? c.designRequest_ID.slice(0,20) + '…'}</span>
              <span style={{ color:'#64748b', fontSize:11 }}>{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unused component suppression */}
      {false && <ComparisonRowGroup label='' results={[]} />}
    </div>
  );
}
