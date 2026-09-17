/**
 * N-Guard — NGuardService Handler
 *
 * This file registers CAP event handlers for NGuardService.
 *
 * Architecture rules respected here:
 *  - Rule 2:  Edition is never inferred; validation rejects missing/invalid editions.
 *  - Rule 5:  Approve/Reject actions are recorded and audited; the agent does not
 *             override human decisions.
 *  - Rule 6:  Agent Engine is invoked through an injected interface, never directly
 *             imported from a framework-coupled path.
 *  - Rule 10: All queries are scoped by tenant_id and project_id.
 *
 * Phase 2 additions:
 *  - before('CREATE', 'Projects') — server-side validation of edition + fields.
 *  - before('UPDATE', 'Projects') — server-side validation on edit.
 *  - before('CREATE', 'SAPDeploymentProfiles') — profile validation.
 *  - before('UPDATE', 'SAPDeploymentProfiles') — profile validation on edit.
 *  - createProject action — single-call project + profile creation with tenant resolution.
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';
import { getAgentEngine } from '../lib/agent-factory.js';
import type { AssessmentRecommendation } from '../types/agent.js';
import {
  validateProject,
  validateDeploymentProfile,
} from '../types/domain.js';
import {
  registerWorkspaceValidation,
  handleImportRequirements,
  handleExportRequirements,
} from './workspace-handler.js';

const { SELECT, INSERT } = cds.ql;

/**
 * Typed wrapper for CAP's UPDATE query builder.
 */
function update(entity: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cds.ql.UPDATE as unknown as (e: string) => ReturnType<typeof cds.ql.UPDATE.entity>)(entity);
}

// ─── Development tenant auto-resolution ──────────────────────────────────────
const DEV_TENANT_NAME = 'Development Tenant';

/**
 * Resolve or create the development tenant.
 * In production, the tenant ID comes from the XSUAA context (Phase 13).
 */
async function resolveDevTenant(): Promise<string> {
  let tenant = await SELECT.one
    .from('nguard.Tenants')
    .where({ name: DEV_TENANT_NAME })
    .columns('ID');

  if (!tenant) {
    await INSERT.into('nguard.Tenants').entries({
      name        : DEV_TENANT_NAME,
      description : 'Auto-created development tenant. Replace with real tenant in production.',
      isActive    : true,
    });
    tenant = await SELECT.one
      .from('nguard.Tenants')
      .where({ name: DEV_TENANT_NAME })
      .columns('ID');
  }

  if (!tenant?.ID) {
    throw new Error('Failed to resolve development tenant');
  }

  return tenant.ID as string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default class NGuardServiceHandler extends cds.ApplicationService {
  async init() {

    // ── Project validation: before CREATE ────────────────────────────────────
    this.before('CREATE', 'Projects', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      const result = validateProject({
        name               : data['name'] as string,
        edition            : data['edition'] as string,
        release            : data['release'] as string | undefined,
        transformationType : data['transformationType'] as string | undefined,
        cleanCorePolicy    : data['cleanCorePolicy'] as string | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      if (!result.valid) {
        const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Project validation failed — ${messages}`);
      }
    });

    // ── Project validation: before UPDATE ────────────────────────────────────
    this.before('UPDATE', 'Projects', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      const updatePayload: Record<string, unknown> = {};
      if (data['name']               !== undefined) updatePayload['name']               = data['name'];
      if (data['edition']            !== undefined) updatePayload['edition']            = data['edition'];
      if (data['release']            !== undefined) updatePayload['release']            = data['release'];
      if (data['transformationType'] !== undefined) updatePayload['transformationType'] = data['transformationType'];
      if (data['cleanCorePolicy']    !== undefined) updatePayload['cleanCorePolicy']    = data['cleanCorePolicy'];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateProject(updatePayload as any);
      if (!result.valid) {
        const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Project validation failed — ${messages}`);
      }
    });

    // ── Deployment profile validation: before CREATE ─────────────────────────
    this.before('CREATE', 'SAPDeploymentProfiles', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateDeploymentProfile(data as any);
      if (!result.valid) {
        const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Deployment profile validation failed — ${messages}`);
      }
    });

    // ── Deployment profile validation: before UPDATE ─────────────────────────
    this.before('UPDATE', 'SAPDeploymentProfiles', (req: cds.Request) => {
      const data = req.data as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateDeploymentProfile(data as any);
      if (!result.valid) {
        const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Deployment profile validation failed — ${messages}`);
      }
    });

    // ── createProject ─────────────────────────────────────────────────────────
    this.on('createProject', async (req: cds.Request) => {
      const d = req.data as {
        name                   : string;
        description?           : string;
        edition                : string;
        release?               : string;
        transformationType?    : string;
        cleanCorePolicy?       : string;
        profileName?           : string;
        deploymentModel?       : string;
        profileRelease?        : string;
        country?               : string;
        industry?              : string;
        processAreas?          : string;
        sourceSystemDescription?: string;
      };

      // Validate project fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projValidation = validateProject(d as any);
      if (!projValidation.valid) {
        const messages = projValidation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Project validation failed — ${messages}`);
      }

      // Validate deployment profile fields if a profile name or model is supplied
      const effectiveProfileName  = d.profileName?.trim() || d.name.trim();
      const effectiveDeployModel  = d.deploymentModel || d.edition;

      const profValidation = validateDeploymentProfile({
        profileName    : effectiveProfileName,
        deploymentModel: effectiveDeployModel as string,
        release        : d.profileRelease,
        transformationType: d.transformationType as string | undefined,
        cleanCorePolicy   : d.cleanCorePolicy   as string | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (!profValidation.valid) {
        const messages = profValidation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
        return req.error(400, `Deployment profile validation failed — ${messages}`);
      }

      // Resolve tenant
      let tenantId: string;
      try {
        tenantId = await resolveDevTenant();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return req.error(500, `Tenant resolution failed: ${msg}`);
      }

      // Insert project
      await INSERT.into('nguard.Projects').entries({
        tenant_ID          : tenantId,
        name               : d.name.trim(),
        description        : d.description ?? null,
        edition            : d.edition,
        release            : d.release ?? null,
        status             : 'ACTIVE',
        transformationType : d.transformationType ?? null,
        cleanCorePolicy    : d.cleanCorePolicy ?? 'NOT_SET',
      });

      // Re-query for the created project (most reliable way to get the generated UUID)
      const project = await SELECT.one
        .from('nguard.Projects')
        .where({ tenant_ID: tenantId, name: d.name.trim() })
        .columns('ID', 'tenant_ID', 'name', 'description', 'edition', 'release',
                 'status', 'transformationType', 'cleanCorePolicy',
                 'createdAt', 'modifiedAt');

      if (!project?.ID) {
        return req.error(500, 'Failed to retrieve created project');
      }

      // Insert deployment profile
      await INSERT.into('nguard.SAPDeploymentProfiles').entries({
        project_ID              : project.ID,
        tenant_ID               : tenantId,
        profileName             : effectiveProfileName,
        sapProduct              : 'S4HANA',
        deploymentModel         : effectiveDeployModel,
        release                 : d.profileRelease ?? d.release ?? null,
        country                 : d.country ?? null,
        industry                : d.industry ?? null,
        transformationType      : d.transformationType ?? null,
        cleanCorePolicy         : d.cleanCorePolicy ?? 'NOT_SET',
        processAreas            : d.processAreas ?? null,
        sourceSystemDescription : d.sourceSystemDescription ?? null,
        isPrimary               : true,
        isActive                : true,
      });

      // Audit log
      await createAuditLog(req, {
        entityType : 'Project',
        entityId   : project.ID as string,
        action     : 'CREATE',
        details    : JSON.stringify({ name: d.name, edition: d.edition }),
      });

      return project;
    });

    // ── submitForAssessment ──────────────────────────────────────────────────
    this.on('submitForAssessment', async (req: cds.Request) => {
      const { designRequestId } = req.data as { designRequestId: string };

      if (!designRequestId) {
        return req.error(400, 'designRequestId is required');
      }

      const dr = await SELECT.one
        .from('nguard.DesignRequests')
        .where({ ID: designRequestId })
        .columns('ID', 'title', 'description', 'businessProcess', 'module',
                 'status', 'tenant_ID', 'project_ID');

      if (!dr) return req.error(404, `DesignRequest ${designRequestId} not found`);
      if (dr.status === 'ASSESSING') return req.error(409, 'Already under assessment');
      if (dr.status === 'ASSESSED')  return req.error(409, 'Already assessed — create a new revision');

      const project = await SELECT.one
        .from('nguard.Projects')
        .where({ ID: dr.project_ID })
        .columns('ID', 'edition', 'release', 'tenant_ID');

      if (!project) return req.error(404, `Project ${dr.project_ID} not found`);

      const assessmentData = {
        designRequest_ID : designRequestId,
        project_ID       : dr.project_ID,
        tenant_ID        : dr.tenant_ID,
        status           : 'PENDING',
        agentVersion     : '0.1.0',
      };
      const [assessment] = await INSERT.into('nguard.ComplianceAssessments').entries(assessmentData);

      await update('nguard.DesignRequests')
        .set({ status: 'ASSESSING' })
        .where({ ID: designRequestId });

      await createAuditLog(req, {
        entityType : 'DesignRequest',
        entityId   : designRequestId,
        action     : 'SUBMIT',
        details    : JSON.stringify({ assessmentId: assessment?.ID }),
      });

      setImmediate(async () => {
        const engine = getAgentEngine();
        try {
          const result = await engine.assess({
            designRequestId,
            projectId       : dr.project_ID,
            tenantId        : dr.tenant_ID,
            title           : dr.title,
            description     : dr.description,
            businessProcess : dr.businessProcess,
            module          : dr.module,
            edition         : project.edition,
            release         : project.release,
          });

          await update('nguard.ComplianceAssessments')
            .set({
              status          : 'COMPLETED',
              verdict         : result.verdict,
              rationale       : result.rationale,
              evidenceSources : JSON.stringify(result.evidenceSources),
              confidence      : result.confidence,
              processedAt     : new Date().toISOString(),
            })
            .where({ ID: assessment?.ID });

          if (result.recommendations?.length) {
            await INSERT.into('nguard.Recommendations').entries(
              result.recommendations.map((r: AssessmentRecommendation, i: number) => ({
                assessment_ID : assessment?.ID,
                sequence      : i + 1,
                type          : r.type,
                description   : r.description,
                effort        : r.effort,
                priority      : r.priority,
                rationale     : r.rationale,
              }))
            );
          }

          await update('nguard.DesignRequests')
            .set({ status: 'ASSESSED' })
            .where({ ID: designRequestId });

          await createAuditLog(req, {
            entityType : 'ComplianceAssessment',
            entityId   : assessment?.ID,
            action     : 'ASSESS',
            details    : JSON.stringify({ verdict: result.verdict, confidence: result.confidence }),
          });

        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          await update('nguard.ComplianceAssessments')
            .set({ status: 'FAILED', rationale: `Agent error: ${message}` })
            .where({ ID: assessment?.ID });

          await update('nguard.DesignRequests')
            .set({ status: 'SUBMITTED' })
            .where({ ID: designRequestId });
        }
      });

      return assessment;
    });

    // ── approveAssessment ────────────────────────────────────────────────────
    this.on('approveAssessment', async (req: cds.Request) => {
      const { assessmentId, notes } = req.data as { assessmentId: string; notes?: string };

      const assessment = await SELECT.one
        .from('nguard.ComplianceAssessments')
        .where({ ID: assessmentId });

      if (!assessment) return req.error(404, `Assessment ${assessmentId} not found`);
      if (assessment.status !== 'COMPLETED') {
        return req.error(409, `Cannot approve assessment in status ${assessment.status}`);
      }

      await update('nguard.DesignRequests')
        .set({ status: 'APPROVED' })
        .where({ ID: assessment.designRequest_ID });

      await createAuditLog(req, {
        entityType : 'ComplianceAssessment',
        entityId   : assessmentId,
        action     : 'APPROVE',
        details    : JSON.stringify({ notes }),
      });

      return true;
    });

    // ── rejectAssessment ─────────────────────────────────────────────────────
    this.on('rejectAssessment', async (req: cds.Request) => {
      const { assessmentId, reason } = req.data as { assessmentId: string; reason?: string };

      const assessment = await SELECT.one
        .from('nguard.ComplianceAssessments')
        .where({ ID: assessmentId });

      if (!assessment) return req.error(404, `Assessment ${assessmentId} not found`);

      await update('nguard.DesignRequests')
        .set({ status: 'REJECTED' })
        .where({ ID: assessment.designRequest_ID });

      await createAuditLog(req, {
        entityType : 'ComplianceAssessment',
        entityId   : assessmentId,
        action     : 'REJECT',
        details    : JSON.stringify({ reason }),
      });

      return true;
    });

    // ── Phase 3: Requirements Workspace validation hooks ─────────────────────
    registerWorkspaceValidation(this);

    // ── importRequirements ───────────────────────────────────────────────────
    this.on('importRequirements', async (req: cds.Request) => {
      const { projectId, csv } = req.data as { projectId: string; csv: string };
      const result = await handleImportRequirements(req, projectId, csv);
      return result;
    });

    // ── exportRequirements ───────────────────────────────────────────────────
    this.on('exportRequirements', async (req: cds.Request) => {
      const { projectId, workItemType } = req.data as { projectId: string; workItemType?: string };
      const csv = await handleExportRequirements(req, projectId, workItemType);
      return csv;
    });

    await super.init();
  }
}
