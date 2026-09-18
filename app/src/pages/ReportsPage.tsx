/**
 * N-Guard — ReportsPage (Phase 11)
 *
 * CSV export for auditable governance reports.
 * All exports trace to underlying stored records — no fabricated data.
 */

import React, { useState } from 'react';
import { useProjectContext } from '../context/ProjectContext.js';
import { exportAssessmentsCSV, exportDecisionsCSV } from '../api/client.js';

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportCard({
  icon, title, description, buttonLabel, onClick, loading,
}: {
  icon        : string;
  title       : string;
  description : string;
  buttonLabel : string;
  onClick     : () => void;
  loading     : boolean;
}) {
  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:24 }}>
      <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
      <h3 style={{ color:'#f1f5f9', margin:'0 0 8px', fontSize:16 }}>{title}</h3>
      <p style={{ color:'#64748b', margin:'0 0 20px', fontSize:13, lineHeight:1.6 }}>{description}</p>
      <button
        onClick={onClick}
        disabled={loading}
        style={{
          padding:'9px 18px',
          background: loading ? '#334155' : '#3b82f6',
          color: loading ? '#64748b' : '#fff',
          border:'none', borderRadius:8, cursor: loading ? 'default' : 'pointer',
          fontSize:13, fontWeight:600,
        }}
      >
        {loading ? '⏳ Generating...' : `⬇ ${buttonLabel}`}
      </button>
    </div>
  );
}

export default function ReportsPage() {
  const { selectedProject } = useProjectContext();
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [loadingDecisions,   setLoadingDecisions]   = useState(false);
  const [error,              setError]              = useState<string | null>(null);
  const [lastExport,         setLastExport]         = useState<string | null>(null);

  const handleExportAssessments = async () => {
    if (!selectedProject) return;
    setLoadingAssessments(true);
    setError(null);
    try {
      const csv = await exportAssessmentsCSV(selectedProject.ID);
      const filename = `${selectedProject.name.replace(/\s+/g, '_')}_assessments_${new Date().toISOString().slice(0,10)}.csv`;
      downloadCsv(csv, filename);
      setLastExport(`Assessments exported: ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingAssessments(false);
    }
  };

  const handleExportDecisions = async () => {
    if (!selectedProject) return;
    setLoadingDecisions(true);
    setError(null);
    try {
      const csv = await exportDecisionsCSV(selectedProject.ID);
      const filename = `${selectedProject.name.replace(/\s+/g, '_')}_decisions_audit_${new Date().toISOString().slice(0,10)}.csv`;
      downloadCsv(csv, filename);
      setLastExport(`Audit trail exported: ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDecisions(false);
    }
  };

  if (!selectedProject) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#64748b', fontSize:16 }}>
        Select a project to generate reports.
      </div>
    );
  }

  return (
    <div style={{ padding:32, background:'#0f172a', minHeight:'100vh' }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#f1f5f9', margin:'0 0 6px', fontSize:28 }}>📄 Reports</h1>
        <p style={{ color:'#64748b', margin:0, fontSize:13 }}>
          {selectedProject.name} — Export governance data for offline analysis and compliance
        </p>
      </div>

      {error && (
        <div style={{ background:'#7f1d1d22', border:'1px solid #7f1d1d', borderRadius:8, padding:16, marginBottom:24, color:'#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {lastExport && (
        <div style={{ background:'#14532d22', border:'1px solid #14532d', borderRadius:8, padding:16, marginBottom:24, color:'#86efac' }}>
          ✅ {lastExport}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
        <ReportCard
          icon="⚖️"
          title="Assessments Export"
          description="Export all Fit-to-Standard assessments for this project as CSV. Each row includes F1-F8 classification, verdict, confidence, business intent, gap description, and recommended next action. Every row traces to a stored ComplianceAssessment record."
          buttonLabel="Export Assessments CSV"
          onClick={() => void handleExportAssessments()}
          loading={loadingAssessments}
        />
        <ReportCard
          icon="📋"
          title="Governance Audit Trail"
          description="Export the complete Design Decision and Exception Register as CSV. Shows who made each governance decision, when, what action was taken, and the full rationale. AI is never shown as the final approver (architecture rule 5). Every row traces to a stored DesignDecision record."
          buttonLabel="Export Decisions Audit CSV"
          onClick={() => void handleExportDecisions()}
          loading={loadingDecisions}
        />
      </div>

      <div style={{ marginTop:32, background:'#1e293b', borderRadius:12, padding:20 }}>
        <h3 style={{ color:'#94a3b8', fontSize:11, textTransform:'uppercase', letterSpacing:1, margin:'0 0 12px' }}>Report Data Integrity</h3>
        <ul style={{ color:'#64748b', margin:0, paddingLeft:20, fontSize:13, lineHeight:2 }}>
          <li>All exported values derive directly from the N-Guard database — no calculated or estimated values.</li>
          <li>Each row includes a unique ID that traces to the source record.</li>
          <li>Audit trail records are immutable — original AI outputs are preserved alongside human decisions.</li>
          <li>The AI is never shown as the final approver in any export (architecture rule 5).</li>
        </ul>
      </div>
    </div>
  );
}
