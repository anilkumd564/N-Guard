/**
 * N-Guard — Knowledge Ingestion Handler (Phase 4)
 *
 * Handles:
 *  - createKnowledgeSource action
 *  - ingestDocument action (Base64 file + metadata → extract, chunk, persist)
 *  - deleteKnowledgeSource action
 *  - deleteKnowledgeDocument action
 *
 * Architecture rules:
 *  - Rule 6:  IngestionService is independent of CAP; this handler bridges them.
 *  - Rule 8:  FileStorageProvider is injected; no direct fs calls here.
 *  - Rule 9:  LocalFileStorageProvider is the dev adapter; flagged in docs.
 *  - Rule 10: All DB records carry tenant_ID and project_ID.
 *  - Rule 12: Structured typed results; errors surfaced, not swallowed.
 *
 * NOTE: This module is registered by NGuardServiceHandler.init().
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';

// Lazily resolve the IngestionService from the agent package at runtime
// (same pattern as agent-factory.ts) to avoid compile-time coupling.
function getIngestionService() {
  const {
    IngestionService,
    LocalFileStorageProvider,
    DocumentExtractorRegistry,
  } = require('@n-guard/agent') as { // eslint-disable-line @typescript-eslint/no-require-imports
    IngestionService         : new (deps: { storage: unknown; extractors?: unknown }) => {
      ingest(input: unknown): Promise<{
        status          : string;
        extractedText   : string;
        extractedLength : number;
        note?           : string;
        chunks          : Array<{ sequence: number; text: string; wordCount: number }>;
        storageUri?     : string;
        fileSizeBytes?  : number;
      }>;
    };
    LocalFileStorageProvider : new () => unknown;
    DocumentExtractorRegistry: new () => unknown;
  };

  return new IngestionService({
    storage    : new LocalFileStorageProvider(),
    extractors : new DocumentExtractorRegistry(),
  });
}

const { SELECT, INSERT, DELETE } = cds.ql;

function update(entity: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cds.ql.UPDATE as unknown as (e: string) => ReturnType<typeof cds.ql.UPDATE.entity>)(entity);
}

// ─── createKnowledgeSource ────────────────────────────────────────────────────

export async function handleCreateKnowledgeSource(
  req: cds.Request,
  d: {
    name?          : string;
    description?   : string;
    sourceType?    : string;
    authorityLevel?: string;
    baseUrl?       : string;
    projectId?     : string;
  },
): Promise<unknown> {
  if (!d.name?.trim()) {
    return req.error(400, 'Knowledge source name is required.');
  }

  // Resolve tenant
  const tenantId = await resolveDevTenant();

  const sourceData = {
    tenant_ID      : tenantId,
    project_ID     : d.projectId ?? null,
    name           : d.name.trim(),
    description    : d.description?.trim() ?? null,
    sourceType     : d.sourceType    ?? 'FILE_UPLOAD',
    authorityLevel : d.authorityLevel ?? 'INTERNAL',
    baseUrl        : d.baseUrl?.trim() ?? null,
    isActive       : true,
  };

  await INSERT.into('nguard.KnowledgeSources').entries(sourceData);

  const created = await SELECT.one
    .from('nguard.KnowledgeSources')
    .where({ tenant_ID: tenantId, name: d.name.trim() })
    .columns('ID', 'tenant_ID', 'project_ID', 'name', 'description',
             'sourceType', 'authorityLevel', 'baseUrl', 'isActive',
             'createdAt', 'modifiedAt');

  await createAuditLog(req, {
    entityType : 'KnowledgeSource',
    entityId   : created?.ID as string,
    action     : 'CREATE',
    details    : JSON.stringify({ name: d.name, sourceType: d.sourceType }),
  });

  return created;
}

// ─── ingestDocument ───────────────────────────────────────────────────────────

export async function handleIngestDocument(
  req: cds.Request,
  d: {
    knowledgeSourceId?: string;
    fileName?         : string;
    mimeType?         : string;
    contentBase64?    : string;
    title?            : string;
    edition?          : string;
    release?          : string;
    country?          : string;
    industry?         : string;
    processArea?      : string;
    scopeItem?        : string;
    authorityLevel?   : string;
    docType?          : string;
    language?         : string;
  },
): Promise<unknown> {
  if (!d.knowledgeSourceId) return req.error(400, 'knowledgeSourceId is required.');
  if (!d.fileName?.trim())  return req.error(400, 'fileName is required.');
  if (!d.mimeType?.trim())  return req.error(400, 'mimeType is required.');
  if (!d.contentBase64?.trim()) return req.error(400, 'contentBase64 is required.');
  if (!d.title?.trim())     return req.error(400, 'title is required.');

  // Load knowledge source to get tenant/project context
  const ks = await SELECT.one
    .from('nguard.KnowledgeSources')
    .where({ ID: d.knowledgeSourceId })
    .columns('ID', 'tenant_ID', 'project_ID', 'authorityLevel', 'isActive');

  if (!ks) return req.error(404, `KnowledgeSource ${d.knowledgeSourceId} not found.`);
  if (!ks.isActive) return req.error(409, 'KnowledgeSource is inactive.');

  // Decode Base64 content
  let contentBuffer: Buffer;
  try {
    contentBuffer = Buffer.from(d.contentBase64!, 'base64');
  } catch {
    return req.error(400, 'contentBase64 is not valid Base64.');
  }

  // Create IngestionJob + KnowledgeDocument records (PENDING status)
  const docData = {
    tenant_ID        : ks.tenant_ID,
    project_ID       : ks.project_ID ?? null,
    knowledgeSource_ID: d.knowledgeSourceId,
    title            : d.title!.trim(),
    content          : '',   // will be updated after extraction
    edition          : d.edition          ?? null,
    release          : d.release          ?? null,
    country          : d.country          ?? null,
    industry         : d.industry         ?? null,
    processArea      : d.processArea      ?? null,
    scopeItem        : d.scopeItem        ?? null,
    authorityLevel   : d.authorityLevel   ?? ks.authorityLevel ?? 'INTERNAL',
    docType          : d.docType          ?? 'OTHER',
    language         : d.language         ?? 'EN',
    source           : null,
    mimeType         : d.mimeType!.trim(),
    fileSizeBytes    : contentBuffer.length,
    ingestionStatus  : 'PROCESSING',
    isActive         : true,
    chunkCount       : 0,
  };

  await INSERT.into('nguard.KnowledgeDocuments').entries(docData);
  const doc = await SELECT.one
    .from('nguard.KnowledgeDocuments')
    .where({ tenant_ID: ks.tenant_ID, title: d.title!.trim(), ingestionStatus: 'PROCESSING' })
    .columns('ID');

  if (!doc?.ID) return req.error(500, 'Failed to create KnowledgeDocument record.');

  const jobData = {
    tenant_ID          : ks.tenant_ID,
    project_ID         : ks.project_ID ?? null,
    knowledgeSource_ID : d.knowledgeSourceId,
    document_ID        : doc.ID,
    status             : 'PROCESSING',
    sourceFileName     : d.fileName!.trim(),
    sourceMimeType     : d.mimeType!.trim(),
    startedAt          : new Date().toISOString(),
  };

  await INSERT.into('nguard.IngestionJobs').entries(jobData);
  const job = await SELECT.one
    .from('nguard.IngestionJobs')
    .where({ document_ID: doc.ID })
    .columns('ID', 'tenant_ID', 'project_ID', 'status', 'sourceFileName',
             'sourceMimeType', 'startedAt');

  // Run ingestion asynchronously
  setImmediate(async () => {
    const svc = getIngestionService();
    try {
      const result = await svc.ingest({
        content  : contentBuffer,
        fileName : d.fileName!,
        mimeType : d.mimeType!,
        metadata : {
          tenantId          : ks.tenant_ID as string,
          projectId         : ks.project_ID ?? undefined,
          knowledgeSourceId : d.knowledgeSourceId!,
          title             : d.title!.trim(),
          edition           : d.edition,
          release           : d.release,
          country           : d.country,
          industry          : d.industry,
          processArea       : d.processArea,
          scopeItem         : d.scopeItem,
          authorityLevel    : d.authorityLevel ?? ks.authorityLevel,
          docType           : d.docType,
          language          : d.language ?? 'EN',
        },
      });

      // Map ingestion status
      const dbStatus = result.status === 'completed'   ? 'COMPLETED'
                     : result.status === 'unsupported' ? 'SKIPPED'
                     : result.status === 'empty'       ? 'SKIPPED'
                     : 'FAILED';

      // Update document with extracted content
      await update('nguard.KnowledgeDocuments')
        .set({
          content         : result.extractedText || '(no text extracted)',
          ingestionStatus : dbStatus,
          ingestionError  : result.note ?? null,
          chunkCount      : result.chunks.length,
          fileSizeBytes   : result.fileSizeBytes ?? contentBuffer.length,
        })
        .where({ ID: doc.ID });

      // Insert chunks
      if (result.chunks.length > 0) {
        await INSERT.into('nguard.KnowledgeChunks').entries(
          result.chunks.map(c => ({
            document_ID    : doc.ID,
            tenant_ID      : ks.tenant_ID,
            project_ID     : ks.project_ID ?? null,
            sequence       : c.sequence,
            text           : c.text,
            tokenCount     : c.wordCount,
            edition        : d.edition    ?? null,
            release        : d.release    ?? null,
            country        : d.country    ?? null,
            industry       : d.industry   ?? null,
            processArea    : d.processArea ?? null,
            scopeItem      : d.scopeItem  ?? null,
            authorityLevel : d.authorityLevel ?? ks.authorityLevel ?? 'INTERNAL',
          }))
        );
      }

      // Update job
      await update('nguard.IngestionJobs')
        .set({
          status          : dbStatus,
          extractedLength : result.extractedLength,
          chunkCount      : result.chunks.length,
          error           : result.note ?? null,
          completedAt     : new Date().toISOString(),
        })
        .where({ ID: job?.ID });

      await createAuditLog(req, {
        entityType : 'KnowledgeDocument',
        entityId   : doc.ID as string,
        action     : 'INGEST',
        details    : JSON.stringify({
          status     : dbStatus,
          chunks     : result.chunks.length,
          characters : result.extractedLength,
        }),
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await update('nguard.KnowledgeDocuments')
        .set({ ingestionStatus: 'FAILED', ingestionError: msg.slice(0, 2000) })
        .where({ ID: doc.ID });
      await update('nguard.IngestionJobs')
        .set({ status: 'FAILED', error: msg.slice(0, 2000), completedAt: new Date().toISOString() })
        .where({ ID: job?.ID });
    }
  });

  return job;
}

// ─── deleteKnowledgeSource ────────────────────────────────────────────────────

export async function handleDeleteKnowledgeSource(
  req: cds.Request,
  knowledgeSourceId: string,
): Promise<boolean> {
  if (!knowledgeSourceId) { req.error(400, 'knowledgeSourceId is required.'); return false; }

  const ks = await SELECT.one
    .from('nguard.KnowledgeSources')
    .where({ ID: knowledgeSourceId })
    .columns('ID', 'name', 'tenant_ID');

  if (!ks) { req.error(404, `KnowledgeSource ${knowledgeSourceId} not found.`); return false; }

  // Delete chunks → documents → jobs → source (order matters for FK constraints)
  const docs = await SELECT.from('nguard.KnowledgeDocuments')
    .where({ knowledgeSource_ID: knowledgeSourceId })
    .columns('ID');

  for (const doc of (docs ?? [])) {
    await DELETE.from('nguard.KnowledgeChunks').where({ document_ID: doc.ID });
  }
  await DELETE.from('nguard.IngestionJobs').where({ knowledgeSource_ID: knowledgeSourceId });
  await DELETE.from('nguard.KnowledgeDocuments').where({ knowledgeSource_ID: knowledgeSourceId });
  await DELETE.from('nguard.KnowledgeSources').where({ ID: knowledgeSourceId });

  await createAuditLog(req, {
    entityType : 'KnowledgeSource',
    entityId   : knowledgeSourceId,
    action     : 'DELETE',
    details    : JSON.stringify({ name: ks.name }),
  });

  return true;
}

// ─── deleteKnowledgeDocument ──────────────────────────────────────────────────

export async function handleDeleteKnowledgeDocument(
  req: cds.Request,
  documentId: string,
): Promise<boolean> {
  if (!documentId) { req.error(400, 'documentId is required.'); return false; }

  const doc = await SELECT.one
    .from('nguard.KnowledgeDocuments')
    .where({ ID: documentId })
    .columns('ID', 'title');

  if (!doc) { req.error(404, `KnowledgeDocument ${documentId} not found.`); return false; }

  await DELETE.from('nguard.KnowledgeChunks').where({ document_ID: documentId });
  await DELETE.from('nguard.IngestionJobs').where({ document_ID: documentId });
  await DELETE.from('nguard.KnowledgeDocuments').where({ ID: documentId });

  await createAuditLog(req, {
    entityType : 'KnowledgeDocument',
    entityId   : documentId,
    action     : 'DELETE',
    details    : JSON.stringify({ title: doc.title }),
  });

  return true;
}

// ─── Dev tenant resolution (shared with nguard-service.ts) ───────────────────

const DEV_TENANT_NAME = 'Development Tenant';

async function resolveDevTenant(): Promise<string> {
  let tenant = await SELECT.one
    .from('nguard.Tenants')
    .where({ name: DEV_TENANT_NAME })
    .columns('ID');

  if (!tenant) {
    await INSERT.into('nguard.Tenants').entries({
      name        : DEV_TENANT_NAME,
      description : 'Auto-created development tenant.',
      isActive    : true,
    });
    tenant = await SELECT.one
      .from('nguard.Tenants')
      .where({ name: DEV_TENANT_NAME })
      .columns('ID');
  }

  if (!tenant?.ID) throw new Error('Failed to resolve development tenant');
  return tenant.ID as string;
}
