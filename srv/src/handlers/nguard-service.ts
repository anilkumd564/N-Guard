/**
 * N-Guard — NGuardService Handler
 *
 * Phase 7: FitAssessmentEngine produces F1-F8 structured assessments.
 * Phase 6: AgentOrchestrator used as legacy fallback.
 * Phases 2-5: Project/profile CRUD, knowledge ingestion, requirements workspace.
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';
import { getAgentEngine, getAgentOrchestrator, getFitAssessmentEngine } from '../lib/agent-factory.js';
import type { AssessmentRecommendation } from '../types/agent.js';
import { validateProject, validateDeploymentProfile } from '../types/domain.js';
import { registerWorkspaceValidation, handleImportRequirements, handleExportRequirements } from './workspace-handler.js';
import { handleCreateKnowledgeSource, handleIngestDocument, handleDeleteKnowledgeSource, handleDeleteKnowledgeDocument } from './ingestion-handler.js';

const { SELECT, INSERT } = cds.ql;

function update(entity: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cds.ql.UPDATE as unknown as (e: string) => ReturnType<typeof cds.ql.UPDATE.entity>)(entity);
}

const DEV_TENANT_NAME = 'Development Tenant';
async function resolveDevTenant(): Promise<string> {
  let tenant = await SELECT.one.from('nguard.Tenants').where({ name: DEV_TENANT_NAME }).columns('ID');
  if (!tenant) {
    await INSERT.into('nguard.Tenants').entries({ name: DEV_TENANT_NAME, description: 'Auto-created dev tenant.', isActive: true });
    tenant = await SELECT.one.from('nguard.Tenants').where({ name: DEV_TENANT_NAME }).columns('ID');
  }
  if (!tenant?.ID) throw new Error('Failed to resolve development tenant');
  return tenant.ID as string;
}

export default class NGuardServiceHandler extends cds.ApplicationService {
  async init() {

    // ── Project validation ────────────────────────────────────────────────────
    this.before('CREATE', 'Projects', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateProject(data as any);
      if (!result.valid) return req.error(400, `Project validation failed — ${result.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);
    });

    this.before('UPDATE', 'Projects', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      const p: Record<string, unknown> = {};
      ['name','edition','release','transformationType','cleanCorePolicy'].forEach(k => { if (data[k] !== undefined) p[k] = data[k]; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateProject(p as any);
      if (!result.valid) return req.error(400, `Project validation failed — ${result.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);
    });

    this.before('CREATE', 'SAPDeploymentProfiles', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateDeploymentProfile(data as any);
      if (!result.valid) return req.error(400, `Deployment profile validation failed — ${result.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);
    });

    this.before('UPDATE', 'SAPDeploymentProfiles', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateDeploymentProfile(data as any);
      if (!result.valid) return req.error(400, `Deployment profile validation failed — ${result.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);
    });

    // ── createProject ─────────────────────────────────────────────────────────
    this.on('createProject', async (req: cds.Request) => {
      const d = req.data as {
        name: string; description?: string; edition: string; release?: string;
        transformationType?: string; cleanCorePolicy?: string; profileName?: string;
        deploymentModel?: string; profileRelease?: string; country?: string;
        industry?: string; processAreas?: string; sourceSystemDescription?: string;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pv = validateProject(d as any);
      if (!pv.valid) return req.error(400, `Project validation failed — ${pv.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);

      const profileName  = d.profileName?.trim() || d.name.trim();
      const deployModel  = d.deploymentModel || d.edition;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dv = validateDeploymentProfile({ profileName, deploymentModel: deployModel, release: d.profileRelease, transformationType: d.transformationType, cleanCorePolicy: d.cleanCorePolicy } as any);
      if (!dv.valid) return req.error(400, `Deployment profile validation failed — ${dv.errors.map(e => `${e.field}: ${e.message}`).join('; ')}`);

      let tenantId: string;
      try { tenantId = await resolveDevTenant(); }
      catch (e) { return req.error(500, `Tenant resolution failed: ${e instanceof Error ? e.message : String(e)}`); }

      await INSERT.into('nguard.Projects').entries({
        tenant_ID: tenantId, name: d.name.trim(), description: d.description ?? null,
        edition: d.edition, release: d.release ?? null, status: 'ACTIVE',
        transformationType: d.transformationType ?? null, cleanCorePolicy: d.cleanCorePolicy ?? 'NOT_SET',
      });

      const project = await SELECT.one.from('nguard.Projects')
        .where({ tenant_ID: tenantId, name: d.name.trim() })
        .columns('ID','tenant_ID','name','description','edition','release','status','transformationType','cleanCorePolicy','createdAt','modifiedAt');
      if (!project?.ID) return req.error(500, 'Failed to retrieve created project');

      await INSERT.into('nguard.SAPDeploymentProfiles').entries({
        project_ID: project.ID, tenant_ID: tenantId, profileName, sapProduct: 'S4HANA',
        deploymentModel: deployModel, release: d.profileRelease ?? d.release ?? null,
        country: d.country ?? null, industry: d.industry ?? null,
        transformationType: d.transformationType ?? null, cleanCorePolicy: d.cleanCorePolicy ?? 'NOT_SET',
        processAreas: d.processAreas ?? null, sourceSystemDescription: d.sourceSystemDescription ?? null,
        isPrimary: true, isActive: true,
      });

      await createAuditLog(req, { entityType: 'Project', entityId: project.ID as string, action: 'CREATE', details: JSON.stringify({ name: d.name, edition: d.edition }) });
      return project;
    });

    // ── submitForAssessment ───────────────────────────────────────────────────
    this.on('submitForAssessment', async (req: cds.Request) => {
      const { designRequestId } = req.data as { designRequestId: string };
      if (!designRequestId) return req.error(400, 'designRequestId is required');

      const dr = await SELECT.one.from('nguard.DesignRequests').where({ ID: designRequestId })
        .columns('ID','title','description','businessProcess','module','status','tenant_ID','project_ID');
      if (!dr) return req.error(404, `DesignRequest ${designRequestId} not found`);
      if (dr.status === 'ASSESSING') return req.error(409, 'Already under assessment');
      if (dr.status === 'ASSESSED')  return req.error(409, 'Already assessed — create a new revision');

      const project = await SELECT.one.from('nguard.Projects').where({ ID: dr.project_ID })
        .columns('ID','edition','release','tenant_ID');
      if (!project) return req.error(404, `Project ${dr.project_ID} not found`);

      const [assessment] = await INSERT.into('nguard.ComplianceAssessments').entries({
        designRequest_ID: designRequestId, project_ID: dr.project_ID,
        tenant_ID: dr.tenant_ID, status: 'PENDING', agentVersion: '0.1.0',
      });

      await update('nguard.DesignRequests').set({ status: 'ASSESSING' }).where({ ID: designRequestId });
      await createAuditLog(req, { entityType: 'DesignRequest', entityId: designRequestId, action: 'SUBMIT', details: JSON.stringify({ assessmentId: assessment?.ID }) });

      setImmediate(async () => {
        const fitEngine = getFitAssessmentEngine();
        const engine    = getAgentEngine();
        const assessInput = {
          designRequestId, projectId: dr.project_ID, tenantId: dr.tenant_ID,
          title: dr.title, description: dr.description, businessProcess: dr.businessProcess,
          module: dr.module, edition: project.edition, release: project.release,
        };
        const assessContext = {
          tenantId: dr.tenant_ID, projectId: dr.project_ID,
          deploymentModel: project.edition, release: project.release,
        };

        try {
          // Phase 7: FitAssessmentEngine → F1-F8 structured result
          const { result: fitResult, run: fitRun } = await fitEngine.assess(assessInput, assessContext);

          await INSERT.into('nguard.AgentRuns').entries({
            designRequest_ID: designRequestId, project_ID: dr.project_ID,
            tenant_ID: dr.tenant_ID, assessment_ID: assessment?.ID,
            status: fitRun.status, modelProvider: fitRun.modelProvider, modelName: fitRun.modelName,
            promptTokens: fitRun.promptTokens, completionTokens: fitRun.completionTokens,
            latencyMs: fitRun.latencyMs, retryCount: fitRun.retryCount,
            error: fitRun.error ?? null, evidenceCount: fitRun.evidenceCount,
            schemaVersion: fitRun.schemaVersion, validationPassed: fitRun.validationPassed,
            startedAt: fitRun.startedAt, completedAt: fitRun.completedAt ?? null,
          });

          const FC_TO_VERDICT: Record<string, string> = {
            F1:'FIT_TO_STANDARD', F2:'FIT_TO_STANDARD', F3:'ACCEPTABLE_GAP',
            F4:'ACCEPTABLE_GAP', F5:'ACCEPTABLE_GAP', F6:'CUSTOMIZATION_RISK',
            F7:'ACCEPTABLE_GAP', F8:'NEEDS_REVIEW',
          };
          const verdict    = FC_TO_VERDICT[fitResult.fitClassification] ?? 'NEEDS_REVIEW';
          const recs       = (fitResult.recommendations ?? []) as Array<{type:string;description:string;effort:string;priority:string;rationale:string}>;
          const confidence = fitResult.confidence;

          await update('nguard.ComplianceAssessments').set({
            status: fitRun.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            verdict, rationale: `[${fitResult.fitClassification}] ${fitResult.businessIntentSummary}`,
            evidenceSources: JSON.stringify(fitResult.evidenceReferences ?? []),
            confidence, processedAt: new Date().toISOString(),
            fitClassification: fitResult.fitClassification,
            deploymentCompatibility: fitResult.deploymentCompatibility,
            evidenceConfidence: fitResult.evidenceConfidence,
            businessIntentSummary: fitResult.businessIntentSummary,
            processClassification: fitResult.processClassification,
            targetDeploymentContext: fitResult.targetDeploymentContext,
            standardCapability: fitResult.standardCapability ?? null,
            gapDescription: fitResult.gapDescription ?? null,
            configurationOpportunity: fitResult.configurationOpportunity ?? null,
            customizationRiskStatement: fitResult.customizationRiskStatement ?? null,
            recommendedNextAction: fitResult.recommendedNextAction,
            assumptions: JSON.stringify(fitResult.assumptions ?? []),
            unknowns: JSON.stringify(fitResult.unknowns ?? []),
            humanReviewRequired: fitResult.humanReviewRequired,
            agentSchemaVersion: fitResult.schemaVersion,
          }).where({ ID: assessment?.ID });

          if (recs.length) {
            await INSERT.into('nguard.Recommendations').entries(
              recs.map((r, i) => ({
                assessment_ID: assessment?.ID, sequence: i + 1,
                type: r.type, description: r.description,
                effort: r.effort, priority: r.priority, rationale: r.rationale,
              }))
            );
          }

          await update('nguard.DesignRequests')
            .set({ status: fitRun.status === 'COMPLETED' ? 'ASSESSED' : 'SUBMITTED' })
            .where({ ID: designRequestId });

          await createAuditLog(req, {
            entityType: 'ComplianceAssessment', entityId: assessment?.ID, action: 'ASSESS',
            details: JSON.stringify({ fitClassification: fitResult.fitClassification, confidence, agentStatus: fitRun.status }),
          });

        } catch (err: unknown) {
          // Fallback: legacy AgentEngine
          const msg = err instanceof Error ? err.message : String(err);
          cds.log('assess').warn(`FitAssessmentEngine failed, falling back to AgentEngine: ${msg}`);
          try {
            const result = await engine.assess({
              designRequestId, projectId: dr.project_ID, tenantId: dr.tenant_ID,
              title: dr.title, description: dr.description, businessProcess: dr.businessProcess,
              module: dr.module, edition: project.edition, release: project.release,
            });
            await update('nguard.ComplianceAssessments').set({
              status: 'COMPLETED', verdict: result.verdict, rationale: result.rationale,
              evidenceSources: JSON.stringify(result.evidenceSources),
              confidence: result.confidence, processedAt: new Date().toISOString(),
              fitClassification: 'F8', agentSchemaVersion: '1.0',
            }).where({ ID: assessment?.ID });
            await update('nguard.DesignRequests').set({ status: 'ASSESSED' }).where({ ID: designRequestId });
          } catch (err2: unknown) {
            const msg2 = err2 instanceof Error ? err2.message : String(err2);
            await update('nguard.ComplianceAssessments').set({ status: 'FAILED', rationale: `Agent error: ${msg2}`, fitClassification: 'F8' }).where({ ID: assessment?.ID });
            await update('nguard.DesignRequests').set({ status: 'SUBMITTED' }).where({ ID: designRequestId });
          }
        }
      });

      return assessment;
    });

    // ── approveAssessment ─────────────────────────────────────────────────────
    this.on('approveAssessment', async (req: cds.Request) => {
      const { assessmentId, notes } = req.data as { assessmentId: string; notes?: string };
      const assessment = await SELECT.one.from('nguard.ComplianceAssessments').where({ ID: assessmentId });
      if (!assessment) return req.error(404, `Assessment ${assessmentId} not found`);
      if (assessment.status !== 'COMPLETED') return req.error(409, `Cannot approve assessment in status ${assessment.status}`);
      await update('nguard.DesignRequests').set({ status: 'APPROVED' }).where({ ID: assessment.designRequest_ID });
      await createAuditLog(req, { entityType: 'ComplianceAssessment', entityId: assessmentId, action: 'APPROVE', details: JSON.stringify({ notes }) });
      return true;
    });

    // ── rejectAssessment ──────────────────────────────────────────────────────
    this.on('rejectAssessment', async (req: cds.Request) => {
      const { assessmentId, reason } = req.data as { assessmentId: string; reason?: string };
      const assessment = await SELECT.one.from('nguard.ComplianceAssessments').where({ ID: assessmentId });
      if (!assessment) return req.error(404, `Assessment ${assessmentId} not found`);
      await update('nguard.DesignRequests').set({ status: 'REJECTED' }).where({ ID: assessment.designRequest_ID });
      await createAuditLog(req, { entityType: 'ComplianceAssessment', entityId: assessmentId, action: 'REJECT', details: JSON.stringify({ reason }) });
      return true;
    });

    // ── Phase 4: Knowledge Ingestion actions ──────────────────────────────────
    this.on('createKnowledgeSource', async (req: cds.Request) => {
      const d = req.data as { name?: string; description?: string; sourceType?: string; authorityLevel?: string; baseUrl?: string; projectId?: string };
      return handleCreateKnowledgeSource(req, d);
    });

    this.on('ingestDocument', async (req: cds.Request) => {
      const d = req.data as { knowledgeSourceId?: string; fileName?: string; mimeType?: string; contentBase64?: string; title?: string; edition?: string; release?: string; country?: string; industry?: string; processArea?: string; scopeItem?: string; authorityLevel?: string; docType?: string; language?: string };
      return handleIngestDocument(req, d);
    });

    this.on('deleteKnowledgeSource', async (req: cds.Request) => {
      const { knowledgeSourceId } = req.data as { knowledgeSourceId: string };
      return handleDeleteKnowledgeSource(req, knowledgeSourceId);
    });

    this.on('deleteKnowledgeDocument', async (req: cds.Request) => {
      const { documentId } = req.data as { documentId: string };
      return handleDeleteKnowledgeDocument(req, documentId);
    });

    // ── Phase 3: Requirements Workspace ───────────────────────────────────────
    registerWorkspaceValidation(this);

    this.on('importRequirements', async (req: cds.Request) => {
      const { projectId, csv } = req.data as { projectId: string; csv: string };
      return handleImportRequirements(req, projectId, csv);
    });

    this.on('exportRequirements', async (req: cds.Request) => {
      const { projectId, workItemType } = req.data as { projectId: string; workItemType?: string };
      return handleExportRequirements(req, projectId, workItemType);
    });

    await super.init();
  }
}

// Suppress unused import warning — engine is used in fallback
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssessmentRecommendationUsed = AssessmentRecommendation;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _orchestratorRef = getAgentOrchestrator;
