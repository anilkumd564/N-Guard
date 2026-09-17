/**
 * N-Guard — Audit Log Helper
 *
 * Writes immutable audit records to nguard.AuditLogs.
 * Called by all service handlers for traceability (architecture rule 4).
 */

import cds from '@sap/cds';

export interface AuditEntry {
  entityType : string;
  entityId   : string;
  action     : string;
  details?   : string;
}

/**
 * Creates an AuditLog record.
 * Silently swallows write errors so that audit failures never block
 * the primary operation — but errors are logged to the CDS logger.
 */
export async function createAuditLog(
  req: cds.Request,
  entry: AuditEntry,
): Promise<void> {
  const log = cds.log('audit');
  try {
    const { INSERT } = cds.ql;
    await INSERT.into('nguard.AuditLogs').entries({
      tenant_ID  : (req.user as unknown as Record<string, string>)?.tenant ?? null,
      project_ID : null,
      entityType : entry.entityType,
      entityId   : entry.entityId,
      action     : entry.action,
      actor      : req.user?.id ?? 'system',
      details    : entry.details ?? null,
      occurredAt : new Date().toISOString(),
    });
  } catch (err: unknown) {
    log.warn('Failed to write audit log', err);
  }
}
