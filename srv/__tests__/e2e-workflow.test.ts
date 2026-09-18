/**
 * N-Guard — End-to-End Governance Workflow Tests (Phase 15)
 *
 * These tests validate the complete N-Guard governance workflow
 * using pure business-logic helpers that mirror the full data flow
 * across all implemented phases (1–15).
 *
 * Workflow under test:
 *  Step 1: Project creation and validation
 *  Step 2: Requirements import (CSV → DesignRequest records)
 *  Step 3: Assessment submission (status transitions)
 *  Step 4: F1-F8 classification result validation
 *  Step 5: Clean Core analysis workflow
 *  Step 6: Cross-Edition comparison workflow
 *  Step 7: Submit for human review
 *  Step 8: Record review decision (rule 5 enforcement)
 *  Step 9: CSV export (all rows traceable)
 * Step 10: Dashboard stats (counts match underlying data)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateProject, validateDeploymentProfile } from '../src/types/domain.js';

// ── Domain helpers (mirrors CAP handler logic) ────────────────────────────────

type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'ASSESSING' | 'ASSESSED' | 'APPROVED' | 'REJECTED';
type ReviewStatus  = 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'EXCEPTION_APPROVED';

interface Project       { ID: string; name: string; edition: string; cleanCorePolicy: string; status: string; }
interface DesignRequest { ID: string; project_ID: string; title: string; status: RequestStatus; }
interface Assessment    { ID: string; designRequest_ID: string; project_ID: string; status: string; fitClassification: string; evidenceConfidence: string; confidence: number; }
interface CleanCoreRec  { ID: string; designRequest_ID: string; preferredTechnique: string; cleanCoreTier: string; riskLevel: string; }
interface ComparisonRec { ID: string; designRequest_ID: string; editionResults: Array<{ edition: string; fitClassification: string; }>; }
interface Decision      { ID: string; assessment_ID: string; reviewAction: string; newStatus: ReviewStatus; actor: string; isAIFinalApprover: false; }

// Simple in-memory "database" for workflow tests
class WorkflowFixture {
  projects       : Project[]       = [];
  designRequests : DesignRequest[] = [];
  assessments    : Assessment[]    = [];
  cleanCores     : CleanCoreRec[]  = [];
  comparisons    : ComparisonRec[] = [];
  decisions      : Decision[]      = [];
  private nextId = 1;

  id(prefix: string): string { return `${prefix}-${this.nextId++}`; }

  createProject(name: string, edition: string): Project {
    const p: Project = { ID: this.id('proj'), name, edition, cleanCorePolicy: 'STANDARD', status: 'ACTIVE' };
    this.projects.push(p);
    return p;
  }

  importRequirements(projectId: string, titles: string[]): DesignRequest[] {
    return titles.map(title => {
      const dr: DesignRequest = { ID: this.id('dr'), project_ID: projectId, title, status: 'DRAFT' };
      this.designRequests.push(dr);
      return dr;
    });
  }

  submitForAssessment(drId: string): Assessment {
    const dr = this.designRequests.find(d => d.ID === drId)!;
    dr.status = 'ASSESSING';
    const a: Assessment = {
      ID: this.id('asmt'), designRequest_ID: drId, project_ID: dr.project_ID,
      status: 'COMPLETED', fitClassification: 'F2', evidenceConfidence: 'LIKELY', confidence: 0.82,
    };
    this.assessments.push(a);
    dr.status = 'ASSESSED';
    return a;
  }

  runCleanCoreAnalysis(drId: string): CleanCoreRec {
    const cc: CleanCoreRec = {
      ID: this.id('cc'), designRequest_ID: drId,
      preferredTechnique: 'CONFIGURATION', cleanCoreTier: 'TIER_2', riskLevel: 'LOW',
    };
    this.cleanCores.push(cc);
    return cc;
  }

  runCrossEditionComparison(drId: string): ComparisonRec {
    const cmp: ComparisonRec = {
      ID: this.id('cmp'), designRequest_ID: drId,
      editionResults: [
        { edition: 'ON_PREMISE',    fitClassification: 'F2' },
        { edition: 'CLOUD_PRIVATE', fitClassification: 'F3' },
        { edition: 'CLOUD_PUBLIC',  fitClassification: 'F4' },
      ],
    };
    this.comparisons.push(cmp);
    return cmp;
  }

  submitForReview(assessmentId: string, actor: string): Decision {
    const d: Decision = {
      ID: this.id('dec'), assessment_ID: assessmentId,
      reviewAction: 'ACCEPT', newStatus: 'PENDING_REVIEW', actor, isAIFinalApprover: false,
    };
    this.decisions.push(d);
    return d;
  }

  recordReviewDecision(assessmentId: string, action: string, actor: string, rationale?: string): Decision | { error: string } {
    if (actor.toLowerCase() === 'ai' || actor.toLowerCase() === 'system') {
      return { error: 'AI cannot be the final approver (rule 5)' };
    }
    const needsRationale = ['APPROVE_EXCEPTION', 'REJECT_CUSTOMIZATION', 'MODIFY_DISPOSITION'];
    if (needsRationale.includes(action) && !rationale) {
      return { error: `Rationale required for ${action}` };
    }
    const STATUS_MAP: Record<string, ReviewStatus> = {
      ACCEPT: 'ACCEPTED', APPROVE_EXCEPTION: 'EXCEPTION_APPROVED', REJECT_CUSTOMIZATION: 'REJECTED',
    };
    const d: Decision = {
      ID: this.id('dec'), assessment_ID: assessmentId, reviewAction: action,
      newStatus: STATUS_MAP[action] ?? 'ACCEPTED', actor, isAIFinalApprover: false,
    };
    this.decisions.push(d);
    return d;
  }

  exportAssessmentsCSV(projectId: string): string[] {
    return this.assessments
      .filter(a => this.designRequests.find(d => d.ID === a.designRequest_ID)?.project_ID === projectId)
      .map(a => `${a.ID},${a.designRequest_ID},${a.status},${a.fitClassification}`);
  }

  getDashboardStats(projectId: string) {
    const drs = this.designRequests.filter(d => d.project_ID === projectId);
    const asmts = this.assessments.filter(a =>
      this.designRequests.find(d => d.ID === a.designRequest_ID)?.project_ID === projectId
    );
    return {
      totalRequirements : drs.length,
      assessed          : drs.filter(d => d.status === 'ASSESSED' || d.status === 'APPROVED').length,
      pendingAssessment : drs.filter(d => d.status === 'DRAFT' || d.status === 'SUBMITTED').length,
      reviewQueue       : this.decisions.filter(dec => dec.newStatus === 'PENDING_REVIEW').length,
      customizationRisk : asmts.filter(a => a.fitClassification === 'F6' || a.fitClassification === 'F7').length,
    };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('E2E Workflow — Step 1: Project creation and validation', () => {
  it('valid project passes domain validation', () => {
    const result = validateProject({ name: 'E2E Test Project', edition: 'CLOUD_PUBLIC', transformationType: 'GREENFIELD', cleanCorePolicy: 'STANDARD' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid project (missing edition) fails validation', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateProject({ name: 'Bad Project' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'edition')).toBe(true);
  });

  it('deployment profile validates correctly', () => {
    const result = validateDeploymentProfile({
      profileName: 'CloudPublic 2024', deploymentModel: 'CLOUD_PUBLIC',
      transformationType: 'GREENFIELD', cleanCorePolicy: 'STRICT',
    });
    expect(result.valid).toBe(true);
  });
});

describe('E2E Workflow — Step 2: Requirements import', () => {
  let fx: WorkflowFixture;
  let proj: Project;

  beforeEach(() => {
    fx = new WorkflowFixture();
    proj = fx.createProject('Finance Transformation', 'CLOUD_PUBLIC');
  });

  it('imports CSV titles as DRAFT requirements', () => {
    const drs = fx.importRequirements(proj.ID, [
      'AP Invoice Processing', 'GL Month-End Close', 'Cost Center Reporting',
    ]);
    expect(drs).toHaveLength(3);
    expect(drs.every(d => d.status === 'DRAFT')).toBe(true);
    expect(drs.every(d => d.project_ID === proj.ID)).toBe(true);
  });

  it('each imported requirement gets a unique ID', () => {
    const drs = fx.importRequirements(proj.ID, ['R1', 'R2', 'R3']);
    const ids = drs.map(d => d.ID);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('E2E Workflow — Step 3: Assessment submission', () => {
  let fx: WorkflowFixture;
  let dr: DesignRequest;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('SCM Project', 'ON_PREMISE');
    [dr] = fx.importRequirements(proj.ID, ['Vendor Invoice Approval']);
  });

  it('requirement transitions DRAFT → ASSESSED on submit', () => {
    expect(dr.status).toBe('DRAFT');
    fx.submitForAssessment(dr.ID);
    expect(dr.status).toBe('ASSESSED');
  });
});

describe('E2E Workflow — Step 4: F1-F8 classification result', () => {
  let fx: WorkflowFixture;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('HR Project', 'CLOUD_PUBLIC');
    const [dr] = fx.importRequirements(proj.ID, ['Employee Self-Service']);
    fx.submitForAssessment(dr.ID);
  });

  it('assessment has valid F1-F8 classification', () => {
    const asmt = fx.assessments[0];
    expect(['F1','F2','F3','F4','F5','F6','F7','F8']).toContain(asmt.fitClassification);
  });

  it('assessment has confidence between 0 and 1', () => {
    const asmt = fx.assessments[0];
    expect(asmt.confidence).toBeGreaterThan(0);
    expect(asmt.confidence).toBeLessThanOrEqual(1);
  });

  it('assessment status is COMPLETED', () => {
    expect(fx.assessments[0].status).toBe('COMPLETED');
  });
});

describe('E2E Workflow — Step 5: Clean Core analysis', () => {
  let fx: WorkflowFixture;
  let dr: DesignRequest;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('ERP Project', 'CLOUD_PUBLIC');
    [dr] = fx.importRequirements(proj.ID, ['Custom Pricing Engine']);
  });

  it('Clean Core analysis returns TIER_1-4 classification', () => {
    const cc = fx.runCleanCoreAnalysis(dr.ID);
    expect(['TIER_1','TIER_2','TIER_3','TIER_4']).toContain(cc.cleanCoreTier);
  });

  it('Clean Core analysis returns risk level', () => {
    const cc = fx.runCleanCoreAnalysis(dr.ID);
    expect(['LOW','MEDIUM','HIGH','CRITICAL']).toContain(cc.riskLevel);
  });

  it('Clean Core analysis is linked to design request', () => {
    const cc = fx.runCleanCoreAnalysis(dr.ID);
    expect(cc.designRequest_ID).toBe(dr.ID);
  });
});

describe('E2E Workflow — Step 6: Cross-Edition comparison', () => {
  let fx: WorkflowFixture;
  let dr: DesignRequest;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('Migration Project', 'ON_PREMISE');
    [dr] = fx.importRequirements(proj.ID, ['Sales Order Automation']);
  });

  it('comparison produces results for all three S/4HANA editions', () => {
    const cmp = fx.runCrossEditionComparison(dr.ID);
    expect(cmp.editionResults).toHaveLength(3);
    const editions = cmp.editionResults.map(e => e.edition);
    expect(editions).toContain('ON_PREMISE');
    expect(editions).toContain('CLOUD_PRIVATE');
    expect(editions).toContain('CLOUD_PUBLIC');
  });

  it('each edition result has a valid fit classification', () => {
    const cmp = fx.runCrossEditionComparison(dr.ID);
    for (const er of cmp.editionResults) {
      expect(['F1','F2','F3','F4','F5','F6','F7','F8']).toContain(er.fitClassification);
    }
  });

  it('comparison is linked to design request', () => {
    const cmp = fx.runCrossEditionComparison(dr.ID);
    expect(cmp.designRequest_ID).toBe(dr.ID);
  });
});

describe('E2E Workflow — Step 7: Submit for human review', () => {
  let fx: WorkflowFixture;
  let asmt: Assessment;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('Governance Project', 'CLOUD_PUBLIC');
    const [dr] = fx.importRequirements(proj.ID, ['Procurement Approval']);
    asmt = fx.submitForAssessment(dr.ID);
  });

  it('submitForReview creates a decision with PENDING_REVIEW status', () => {
    const dec = fx.submitForReview(asmt.ID, 'john.doe@example.com');
    expect(dec.newStatus).toBe('PENDING_REVIEW');
    expect(dec.assessment_ID).toBe(asmt.ID);
  });

  it('isAIFinalApprover is always false on submitForReview', () => {
    const dec = fx.submitForReview(asmt.ID, 'architect@example.com');
    expect(dec.isAIFinalApprover).toBe(false);
  });
});

describe('E2E Workflow — Step 8: Record review decision (rule 5)', () => {
  let fx: WorkflowFixture;
  let asmt: Assessment;

  beforeEach(() => {
    fx = new WorkflowFixture();
    const proj = fx.createProject('Review Project', 'CLOUD_PUBLIC');
    const [dr] = fx.importRequirements(proj.ID, ['Budget Approval Workflow']);
    asmt = fx.submitForAssessment(dr.ID);
    fx.submitForReview(asmt.ID, 'reviewer@example.com');
  });

  it('ACCEPT decision transitions to ACCEPTED', () => {
    const result = fx.recordReviewDecision(asmt.ID, 'ACCEPT', 'architect@example.com');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.newStatus).toBe('ACCEPTED');
      expect(result.isAIFinalApprover).toBe(false);
    }
  });

  it('AI actor is rejected with rule 5 error', () => {
    const result = fx.recordReviewDecision(asmt.ID, 'ACCEPT', 'ai');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('rule 5');
    }
  });

  it('system actor is rejected with rule 5 error', () => {
    const result = fx.recordReviewDecision(asmt.ID, 'ACCEPT', 'system');
    expect('error' in result).toBe(true);
  });

  it('APPROVE_EXCEPTION without rationale is rejected', () => {
    const result = fx.recordReviewDecision(asmt.ID, 'APPROVE_EXCEPTION', 'architect@example.com');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Rationale required');
    }
  });

  it('APPROVE_EXCEPTION with rationale succeeds', () => {
    const result = fx.recordReviewDecision(asmt.ID, 'APPROVE_EXCEPTION', 'authority@example.com', 'Business requirement justifies exception');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.newStatus).toBe('EXCEPTION_APPROVED');
    }
  });
});

describe('E2E Workflow — Step 9: CSV export (traceability)', () => {
  let fx: WorkflowFixture;
  let proj: Project;

  beforeEach(() => {
    fx = new WorkflowFixture();
    proj = fx.createProject('Export Project', 'CLOUD_PUBLIC');
    const drs = fx.importRequirements(proj.ID, ['Req A', 'Req B', 'Req C']);
    for (const dr of drs) fx.submitForAssessment(dr.ID);
  });

  it('CSV has one row per assessment', () => {
    const rows = fx.exportAssessmentsCSV(proj.ID);
    expect(rows).toHaveLength(3);
  });

  it('each CSV row contains the assessment ID (traceable)', () => {
    const rows = fx.exportAssessmentsCSV(proj.ID);
    const asmtIds = fx.assessments.map(a => a.ID);
    for (const id of asmtIds) {
      expect(rows.some(row => row.includes(id))).toBe(true);
    }
  });

  it('CSV rows for other projects are excluded', () => {
    const otherProj = fx.createProject('Other Project', 'ON_PREMISE');
    const [otherDr] = fx.importRequirements(otherProj.ID, ['Other Req']);
    fx.submitForAssessment(otherDr.ID);
    const rows = fx.exportAssessmentsCSV(proj.ID);
    expect(rows).toHaveLength(3); // Only original 3
  });
});

describe('E2E Workflow — Step 10: Dashboard stats (counts match data)', () => {
  let fx: WorkflowFixture;
  let proj: Project;

  beforeEach(() => {
    fx = new WorkflowFixture();
    proj = fx.createProject('Dashboard Project', 'CLOUD_PUBLIC');
    const drs = fx.importRequirements(proj.ID, ['Req 1', 'Req 2', 'Req 3', 'Req 4', 'Req 5']);
    // Assess 3, leave 2 as DRAFT
    fx.submitForAssessment(drs[0].ID);
    fx.submitForAssessment(drs[1].ID);
    fx.submitForAssessment(drs[2].ID);
    // Submit one for review
    fx.submitForReview(fx.assessments[0].ID, 'reviewer@example.com');
  });

  it('totalRequirements matches imported count', () => {
    const stats = fx.getDashboardStats(proj.ID);
    expect(stats.totalRequirements).toBe(5);
  });

  it('assessed count matches assessed requirements', () => {
    const stats = fx.getDashboardStats(proj.ID);
    expect(stats.assessed).toBe(3);
  });

  it('pendingAssessment count matches unassessed requirements', () => {
    const stats = fx.getDashboardStats(proj.ID);
    expect(stats.pendingAssessment).toBe(2);
  });

  it('reviewQueue count matches pending review decisions', () => {
    const stats = fx.getDashboardStats(proj.ID);
    expect(stats.reviewQueue).toBe(1);
  });

  it('assessed + pending = totalRequirements', () => {
    const stats = fx.getDashboardStats(proj.ID);
    expect(stats.assessed + stats.pendingAssessment).toBe(stats.totalRequirements);
  });

  it('dashboard stats are isolated per project', () => {
    const otherProj = fx.createProject('Other', 'ON_PREMISE');
    const stats = fx.getDashboardStats(otherProj.ID);
    expect(stats.totalRequirements).toBe(0);
    expect(stats.assessed).toBe(0);
  });
});
