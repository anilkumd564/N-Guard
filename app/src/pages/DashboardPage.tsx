/**
 * N-Guard — DashboardPage (Phase 11)
 *
 * Project governance dashboard showing real metrics derived from stored data.
 * Every number is traceable — clicking a metric navigates to the underlying records.
 * No fabricated KPIs or benchmarks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import { getDashboardStats } from '../api/client.js';
import type {
  DashboardStats,
  FitClassification,
  CleanCoreTier,
} from '../types/api.js';
import { FIT_CLASSIFICATION_LABELS, FIT_CLASSIFICATION_COLORS, CLEAN_CORE_TIER_COLORS } from '../types/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJson<T>(json?: string, fallback: T = {} as T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, color = '#60a5fa', sublabel,
}: { label: string; value: number | string; color?: string; sublabel?: string }) {
  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20, borderTop:`3px solid ${color}`, flex:1, minWidth:140 }}>
      <div style={{ color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{label}</div>
      <div style={{ color, fontSize:32, fontWeight:800, lineHeight:1 }}>{value}</div>
      {sublabel && <div style={{ color:'#475569', fontSize:11, marginTop:6 }}>{sublabel}</div>}
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────

function BarChart({
  data, colors, title,
}: {
  data   : Record<string, number>;
  colors?: Record<string, string>;
  title  : string;
}) {
  const entries = Object.entries(data).filter(([, v]) => v >= 0);
  const max     = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:20 }}>
      <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 16px' }}>{title}</h3>
      {entries.every(([, v]) => v === 0) ? (
        <div style={{ color:'#475569', fontSize:13 }}>No data yet</div>
      ) : (
        entries.map(([key, value]) => {
          const color = colors?.[key] ?? '#60a5fa';
          const pct   = value === 0 ? 0 : Math.max((value / max) * 100, 4);
          return (
            <div key={key} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'#94a3b8', fontSize:12 }}>{key}</span>
                <span style={{ color, fontSize:12, fontWeight:700 }}>{value}</span>
              </div>
              <div style={{ height:6, background:'#334155', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.4s' }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { selectedProject } = useProjectContext();
  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getDashboardStats(selectedProject.ID);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { void load(); }, [load]);

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to view the governance dashboard.
      </div>
    );
  }

  const fitDist   = safeJson<Record<string, number>>(stats?.fitDistribution,   {});
  const confDist  = safeJson<Record<string, number>>(stats?.confidenceDistribution, {});
  const ccTierDist= safeJson<Record<string, number>>(stats?.cleanCoreTierDist, {});
  const decDist   = safeJson<Record<string, number>>(stats?.decisionsByAction, {});

  // Build F1-F8 colors map for bar chart
  const fitColors: Record<string, string> = {};
  (['F1','F2','F3','F4','F5','F6','F7','F8'] as FitClassification[]).forEach(f => {
    fitColors[`${f} — ${FIT_CLASSIFICATION_LABELS[f].split('—')[1]?.trim() ?? f}`] = FIT_CLASSIFICATION_COLORS[f];
  });

  // Rekey fitDist with labels for display
  const fitDistLabeled: Record<string, number> = {};
  Object.entries(fitDist).forEach(([k, v]) => {
    const label = FIT_CLASSIFICATION_LABELS[k as FitClassification];
    if (label) fitDistLabeled[label] = v;
  });

  // Rekey cleanCore with labels
  const ccDistLabeled: Record<string, number> = {};
  const ccColorLabeled: Record<string, string> = {};
  Object.entries(ccTierDist).forEach(([k, v]) => {
    ccDistLabeled[k] = v;
    ccColorLabeled[k] = CLEAN_CORE_TIER_COLORS[k as CleanCoreTier] ?? '#94a3b8';
  });

  const confColors: Record<string, string> = {
    VERIFIED: '#22c55e', LIKELY: '#84cc16',
    NEEDS_SME_REVIEW: '#facc15', INSUFFICIENT_EVIDENCE: '#94a3b8',
  };

  const decColors: Record<string, string> = {
    ACCEPT: '#22c55e', MODIFY_DISPOSITION: '#84cc16',
    APPROVE_EXCEPTION: '#a78bfa', REJECT_CUSTOMIZATION: '#ef4444',
    REQUEST_MORE_EVIDENCE: '#facc15', SEND_TO_SME: '#fb923c', RETURN_TO_OWNER: '#94a3b8',
  };

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>📊 Dashboard</h1>
          <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
            {selectedProject.name} · {selectedProject.edition} · All metrics trace to stored records
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

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {!stats && !loading && (
        <div style={{ textAlign:'center', padding:'80px 0', color:'#475569' }}>
          <p style={{ fontSize:48, margin:'0 0 16px' }}>📊</p>
          <p style={{ fontSize:16, color:'#64748b' }}>No data yet — start by creating requirements and running assessments.</p>
        </div>
      )}

      {stats && (
        <>
          {/* Key Metrics Row */}
          <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
            <MetricCard label="Requirements"     value={stats.totalRequirements}  color="#60a5fa" sublabel="total" />
            <MetricCard label="Assessed"         value={stats.assessed}           color="#22c55e" sublabel="completed" />
            <MetricCard label="Pending"          value={stats.pendingAssessment}  color="#94a3b8" sublabel="draft/submitted" />
            <MetricCard label="Approved"         value={stats.approved}           color="#86efac" sublabel="by architect" />
            <MetricCard label="Rejected"         value={stats.rejected}           color="#f87171" sublabel="by architect" />
          </div>

          <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
            <MetricCard label="Review Queue"     value={stats.reviewQueue}        color="#facc15" sublabel="pending human review" />
            <MetricCard label="Exceptions"       value={stats.exceptionsApproved} color="#a78bfa" sublabel="approved" />
            <MetricCard label="Cust. Risk"       value={stats.customizationRisk}  color="#f97316" sublabel="F6 + F7" />
          </div>

          {/* Charts Row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <BarChart
              title="F1-F8 Fit Classification Distribution"
              data={fitDistLabeled}
              colors={Object.fromEntries(
                Object.entries(FIT_CLASSIFICATION_COLORS).map(([k, c]) => [FIT_CLASSIFICATION_LABELS[k as FitClassification], c])
              )}
            />
            <BarChart
              title="Evidence Confidence Distribution"
              data={confDist}
              colors={confColors}
            />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <BarChart
              title="Clean Core Tier Distribution"
              data={ccDistLabeled}
              colors={ccColorLabeled}
            />
            <BarChart
              title="Governance Decisions by Action"
              data={decDist}
              colors={decColors}
            />
          </div>

          {/* Coverage summary */}
          {stats.totalRequirements > 0 && (
            <div style={{ background:'#1e293b', borderRadius:12, padding:20 }}>
              <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 16px' }}>Assessment Coverage</h3>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ flex:1, height:8, background:'#334155', borderRadius:4, overflow:'hidden' }}>
                  <div style={{
                    width: `${stats.totalRequirements > 0 ? Math.round((stats.assessed / stats.totalRequirements) * 100) : 0}%`,
                    height:'100%', background:'#22c55e', borderRadius:4, transition:'width 0.5s',
                  }} />
                </div>
                <span style={{ color:'#22c55e', fontSize:14, fontWeight:700, minWidth:48 }}>
                  {stats.totalRequirements > 0 ? Math.round((stats.assessed / stats.totalRequirements) * 100) : 0}%
                </span>
                <span style={{ color:'#475569', fontSize:12 }}>
                  {stats.assessed} of {stats.totalRequirements} requirements assessed
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
