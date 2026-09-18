/**
 * N-Guard — Dashboard Handler (Phase 11)
 *
 * Aggregates project governance metrics from the database.
 * Every metric derives from actual stored records — no fabricated KPIs.
 * CSV export functions provide full audit trail traceability.
 */

import cds from '@sap/cds';

const { SELECT } = cds.ql;

// ─── Dashboard Statistics ────────────────────────────────────────────────────

export async function handleGetDashboardStats(projectId: string) {
  if (!projectId) throw new Error('projectId is required');

  // Parallel queries for performance
  const [drs, assessments, decisions, cleanCoreAnalyses, comparisons] = await Promise.all([
    SELECT.from('nguard.DesignRequests').where({ project_ID: projectId })
      .columns('ID', 'status'),
    SELECT.from('nguard.ComplianceAssessments').where({ project_ID: projectId })
      .columns('ID', 'status', 'verdict', 'fitClassification', 'evidenceConfidence', 'humanReviewRequired'),
    SELECT.from('nguard.DesignDecisions').where({ project_ID: projectId })
      .columns('ID', 'reviewAction', 'newStatus', 'recordType'),
    SELECT.from('nguard.CleanCoreAnalyses').where({ project_ID: projectId })
      .columns('ID', 'cleanCoreTier'),
    SELECT.from('nguard.CrossEditionComparisons').where({ project_ID: projectId })
      .columns('ID'),
  ]);

  // ── Requirements metrics
  const totalRequirements = (drs as unknown[]).length;
  const assessed          = (drs as Array<{ status: string }>).filter(d => d.status === 'ASSESSED' || d.status === 'APPROVED' || d.status === 'REJECTED').length;
  const pendingAssessment = (drs as Array<{ status: string }>).filter(d => d.status === 'DRAFT' || d.status === 'SUBMITTED').length;
  const approved          = (drs as Array<{ status: string }>).filter(d => d.status === 'APPROVED').length;
  const rejected          = (drs as Array<{ status: string }>).filter(d => d.status === 'REJECTED').length;

  // ── Assessment distribution (F1-F8)
  const fitDistribution: Record<string, number> = { F1:0, F2:0, F3:0, F4:0, F5:0, F6:0, F7:0, F8:0 };
  const confidenceDistribution: Record<string, number> = { VERIFIED:0, LIKELY:0, NEEDS_SME_REVIEW:0, INSUFFICIENT_EVIDENCE:0 };
  let customizationRisk = 0;

  for (const a of assessments as Array<{ fitClassification?: string; evidenceConfidence?: string; humanReviewRequired?: boolean }>) {
    if (a.fitClassification && a.fitClassification in fitDistribution) {
      fitDistribution[a.fitClassification]++;
    }
    if (a.evidenceConfidence && a.evidenceConfidence in confidenceDistribution) {
      confidenceDistribution[a.evidenceConfidence]++;
    }
    if (a.fitClassification === 'F6' || a.fitClassification === 'F7') {
      customizationRisk++;
    }
  }

  // ── Review queue (assessments awaiting human review)
  const reviewQueue = (decisions as Array<{ newStatus: string }>)
    .filter(d => d.newStatus === 'PENDING_REVIEW').length;

  // ── Exceptions approved
  const exceptionsApproved = (decisions as Array<{ reviewAction: string }>)
    .filter(d => d.reviewAction === 'APPROVE_EXCEPTION').length;

  // ── Decisions by action
  const decisionsByAction: Record<string, number> = {};
  for (const d of decisions as Array<{ reviewAction: string }>) {
    decisionsByAction[d.reviewAction] = (decisionsByAction[d.reviewAction] ?? 0) + 1;
  }

  // ── Clean Core tier distribution
  const cleanCoreTierDist: Record<string, number> = { TIER_1:0, TIER_2:0, TIER_3:0, TIER_4:0 };
  for (const cc of cleanCoreAnalyses as Array<{ cleanCoreTier?: string }>) {
    if (cc.cleanCoreTier && cc.cleanCoreTier in cleanCoreTierDist) {
      cleanCoreTierDist[cc.cleanCoreTier]++;
    }
  }

  void comparisons; // cross-edition comparison count available via comparisons.length

  return {
    totalRequirements,
    assessed,
    pendingAssessment,
    approved,
    rejected,
    reviewQueue,
    exceptionsApproved,
    customizationRisk,
    fitDistribution       : JSON.stringify(fitDistribution),
    confidenceDistribution: JSON.stringify(confidenceDistribution),
    cleanCoreTierDist     : JSON.stringify(cleanCoreTierDist),
    decisionsByAction     : JSON.stringify(decisionsByAction),
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function escCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function buildCsvRow(values: unknown[]): string {
  return values.map(escCsv).join(',');
}

/**
 * Export all assessments for a project as CSV.
 * Every row traces to a ComplianceAssessment record.
 */
export async function handleExportAssessmentsCSV(projectId: string): Promise<string> {
  if (!projectId) throw new Error('projectId is required');

  const assessments = await SELECT.from('nguard.ComplianceAssessments')
    .where({ project_ID: projectId })
    .orderBy('createdAt asc')
    .columns('ID', 'designRequest_ID', 'status', 'verdict', 'fitClassification',
             'deploymentCompatibility', 'evidenceConfidence', 'confidence',
             'businessIntentSummary', 'processClassification', 'gapDescription',
             'recommendedNextAction', 'humanReviewRequired', 'processedAt', 'createdAt');

  const header = buildCsvRow([
    'ID', 'DesignRequest_ID', 'Status', 'Verdict', 'FitClassification',
    'DeploymentCompatibility', 'EvidenceConfidence', 'Confidence',
    'BusinessIntentSummary', 'ProcessClassification', 'GapDescription',
    'RecommendedNextAction', 'HumanReviewRequired', 'ProcessedAt', 'CreatedAt',
  ]);

  const rows = (assessments as Record<string, unknown>[]).map(a =>
    buildCsvRow([
      a['ID'], a['designRequest_ID'], a['status'], a['verdict'], a['fitClassification'],
      a['deploymentCompatibility'], a['evidenceConfidence'], a['confidence'],
      a['businessIntentSummary'], a['processClassification'], a['gapDescription'],
      a['recommendedNextAction'], a['humanReviewRequired'], a['processedAt'], a['createdAt'],
    ])
  );

  return [header, ...rows].join('\n');
}

/**
 * Export the design decision audit trail as CSV.
 * Shows who made which governance decision and when (rule 4 traceability).
 * AI is never shown as actor (rule 5).
 */
export async function handleExportDecisionsCSV(projectId: string): Promise<string> {
  if (!projectId) throw new Error('projectId is required');

  const decisions = await SELECT.from('nguard.DesignDecisions')
    .where({ project_ID: projectId })
    .orderBy('decidedAt asc')
    .columns('ID', 'designRequest_ID', 'assessment_ID', 'recordType', 'reviewAction',
             'newStatus', 'priorStatus', 'actor', 'decidedAt', 'rationale',
             'modifiedVerdict', 'isAIFinalApprover', 'createdAt');

  const header = buildCsvRow([
    'ID', 'DesignRequest_ID', 'Assessment_ID', 'RecordType', 'ReviewAction',
    'NewStatus', 'PriorStatus', 'Actor', 'DecidedAt', 'Rationale',
    'ModifiedVerdict', 'IsAIFinalApprover', 'CreatedAt',
  ]);

  const rows = (decisions as Record<string, unknown>[]).map(d =>
    buildCsvRow([
      d['ID'], d['designRequest_ID'], d['assessment_ID'], d['recordType'], d['reviewAction'],
      d['newStatus'], d['priorStatus'], d['actor'], d['decidedAt'], d['rationale'],
      d['modifiedVerdict'], d['isAIFinalApprover'], d['createdAt'],
    ])
  );

  return [header, ...rows].join('\n');
}
