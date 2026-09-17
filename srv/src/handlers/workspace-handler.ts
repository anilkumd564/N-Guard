/**
 * N-Guard — Requirements Workspace Handler (Phase 3)
 *
 * Handles:
 *  - before('CREATE'/'UPDATE', 'DesignRequests') — server-side validation
 *  - importRequirements action — CSV import with row-level error reporting
 *  - exportRequirements action — CSV export filtered by project/type
 *
 * Architecture rules:
 *  - Rule 10: All queries and inserts are scoped by project_ID + tenant_ID.
 *  - Rule 12: Structured typed validation; no silent skipping of invalid rows.
 *
 * NOTE: This module is registered by NGuardServiceHandler.init().
 *       It does not extend ApplicationService itself — it receives the
 *       'this' context of the parent handler via the register() call.
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';
import {
  validateRequirement,
  parseCsvString,
  validateCsvRow,
  csvRowToRequirement,
  requirementsToCsv,
  type CsvImportError,
  type RequirementRecord,
} from '../types/domain.js';

const { SELECT, INSERT } = cds.ql;

// ─── Validation hooks ──────────────────────────────────────────────────────────

export function registerWorkspaceValidation(svc: cds.ApplicationService): void {

  svc.before('CREATE', 'DesignRequests', (req: cds.Request) => {
    const data = req.data as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateRequirement(data as any);
    if (!result.valid) {
      const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      return req.error(400, `Requirement validation failed — ${messages}`);
    }
  });

  svc.before('UPDATE', 'DesignRequests', (req: cds.Request) => {
    const data = req.data as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {};
    if (data['title']             !== undefined) updatePayload['title']             = data['title'];
    if (data['description']       !== undefined) updatePayload['description']       = data['description'];
    if (data['workItemType']      !== undefined) updatePayload['workItemType']      = data['workItemType'];
    if (data['priority']          !== undefined) updatePayload['priority']          = data['priority'];
    if (data['businessObjective'] !== undefined) updatePayload['businessObjective'] = data['businessObjective'];
    if (data['externalReference'] !== undefined) updatePayload['externalReference'] = data['externalReference'];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateRequirement(updatePayload as any);
    if (!result.valid) {
      const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      return req.error(400, `Requirement validation failed — ${messages}`);
    }
  });
}

// ─── importRequirements ────────────────────────────────────────────────────────

export async function handleImportRequirements(
  req       : cds.Request,
  projectId : string,
  csv       : string,
): Promise<{ imported: number; errorCount: number; errors: string }> {

  if (!projectId) {
    req.error(400, 'projectId is required');
    return { imported: 0, errorCount: 1, errors: JSON.stringify([{ row: 0, field: 'projectId', message: 'projectId is required.' }]) };
  }

  if (!csv || csv.trim().length === 0) {
    req.error(400, 'csv content is required');
    return { imported: 0, errorCount: 1, errors: JSON.stringify([{ row: 0, field: 'csv', message: 'csv content is required.' }]) };
  }

  // Resolve tenant from project
  const project = await SELECT.one
    .from('nguard.Projects')
    .where({ ID: projectId })
    .columns('ID', 'tenant_ID', 'edition');

  if (!project) {
    req.error(404, `Project ${projectId} not found`);
    return { imported: 0, errorCount: 1, errors: JSON.stringify([{ row: 0, field: 'projectId', message: `Project ${projectId} not found.` }]) };
  }

  // Parse CSV
  const { headers, rows } = parseCsvString(csv);

  if (headers.length === 0) {
    return { imported: 0, errorCount: 1, errors: JSON.stringify([{ row: 0, field: 'csv', message: 'CSV is empty or has no headers.' }]) };
  }

  // Check required headers are present (case-insensitive)
  const lowerHeaders = new Set(headers.map(h => h.toLowerCase()));
  const missingHeaders: string[] = [];
  for (const required of ['workitemtype', 'title', 'description']) {
    if (!lowerHeaders.has(required)) {
      missingHeaders.push(required);
    }
  }
  if (missingHeaders.length > 0) {
    const err: CsvImportError = { row: 0, field: 'headers', message: `Missing required CSV columns: ${missingHeaders.join(', ')}` };
    return { imported: 0, errorCount: 1, errors: JSON.stringify([err]) };
  }

  const allErrors: CsvImportError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based, row 1 = header
    const row = rows[i];

    // Skip blank rows (all values empty)
    if (Object.values(row).every(v => !v)) continue;

    const rowErrors = validateCsvRow(row, rowNum);
    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors);
      continue; // Skip invalid row — do not insert
    }

    // Convert to insert payload
    const payload = csvRowToRequirement(row);

    await INSERT.into('nguard.DesignRequests').entries({
      project_ID        : projectId,
      tenant_ID         : project.tenant_ID,
      workItemType      : payload.workItemType,
      title             : payload.title,
      description       : payload.description,
      businessObjective : payload.businessObjective ?? null,
      businessProcess   : payload.businessProcess   ?? null,
      module            : payload.module            ?? null,
      priority          : payload.priority,
      source            : payload.source            ?? null,
      requestedBy       : payload.requestedBy       ?? null,
      owner             : payload.owner             ?? null,
      tags              : payload.tags              ?? null,
      externalReference : payload.externalReference ?? null,
      status            : 'DRAFT',
    });
    imported++;
  }

  // Audit if any rows were imported
  if (imported > 0) {
    await createAuditLog(req, {
      entityType : 'DesignRequests',
      entityId   : projectId,
      action     : 'CSV_IMPORT',
      details    : JSON.stringify({ imported, errorCount: allErrors.length }),
    });
  }

  return {
    imported,
    errorCount : allErrors.length,
    errors     : JSON.stringify(allErrors),
  };
}

// ─── exportRequirements ────────────────────────────────────────────────────────

export async function handleExportRequirements(
  req          : cds.Request,
  projectId    : string,
  workItemType?: string,
): Promise<string> {

  if (!projectId) {
    req.error(400, 'projectId is required');
    return '';
  }

  // Verify project exists
  const project = await SELECT.one
    .from('nguard.Projects')
    .where({ ID: projectId })
    .columns('ID');

  if (!project) {
    req.error(404, `Project ${projectId} not found`);
    return '';
  }

  // Query requirements
  const query = SELECT
    .from('nguard.DesignRequests')
    .where({ project_ID: projectId })
    .columns(
      'ID', 'workItemType', 'title', 'description', 'businessObjective',
      'businessProcess', 'module', 'priority', 'source', 'requestedBy',
      'owner', 'tags', 'externalReference', 'status', 'project_ID', 'tenant_ID',
    );

  let items: RequirementRecord[] = await query;

  // Filter by workItemType if provided
  if (workItemType && workItemType.trim()) {
    items = items.filter(i => i.workItemType === workItemType.trim());
  }

  if (items.length === 0) {
    return requirementsToCsv([]); // Return header-only CSV
  }

  return requirementsToCsv(items);
}
