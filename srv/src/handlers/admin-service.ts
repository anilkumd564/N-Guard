/**
 * N-Guard — AdminService Handler
 *
 * Handles knowledge document management and tenant administration.
 * Architecture rule 8: VectorStore access is via the agent factory, not directly.
 *
 * Phase 5: embedChunks action — indexes knowledge chunks into the vector store.
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';
import { getAgentEngine } from '../lib/agent-factory.js';

const { SELECT } = cds.ql;

function update(entity: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cds.ql.UPDATE as unknown as (e: string) => ReturnType<typeof cds.ql.UPDATE.entity>)(entity);
}

export default class AdminServiceHandler extends cds.ApplicationService {
  async init() {

    // ── embedDocument ────────────────────────────────────────────────────────
    this.on('embedDocument', async (req: cds.Request) => {
      const { documentId } = req.data as { documentId: string };

      if (!documentId) return req.error(400, 'documentId is required');

      const doc = await SELECT.one
        .from('nguard.KnowledgeDocuments')
        .where({ ID: documentId })
        .columns('ID', 'title', 'content', 'tenant_ID', 'project_ID', 'edition', 'release',
                 'country', 'industry', 'processArea', 'scopeItem', 'authorityLevel', 'docType',
                 'knowledgeSource_ID');

      if (!doc) return req.error(404, `KnowledgeDocument ${documentId} not found`);
      if (!doc.content) return req.error(422, 'Document has no content to embed');

      try {
        const engine = await getAgentEngine();
        await engine.embedDocument({
          id      : doc.ID,
          content : doc.content,
          metadata: {
            tenantId          : doc.tenant_ID          ?? undefined,
            projectId         : doc.project_ID         ?? undefined,
            edition           : doc.edition            ?? undefined,
            release           : doc.release            ?? undefined,
            country           : doc.country            ?? undefined,
            industry          : doc.industry           ?? undefined,
            processArea       : doc.processArea        ?? undefined,
            scopeItem         : doc.scopeItem          ?? undefined,
            authorityLevel    : doc.authorityLevel     ?? undefined,
            docType           : doc.docType            ?? undefined,
            knowledgeSourceId : doc.knowledgeSource_ID ?? undefined,
            documentId        : doc.ID,
            title             : doc.title,
          },
        });

        await createAuditLog(req, {
          entityType : 'KnowledgeDocument',
          entityId   : documentId,
          action     : 'EMBED',
          details    : JSON.stringify({ title: doc.title }),
        });

        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return req.error(500, `Embedding failed: ${message}`);
      }
    });

    // ── embedChunks (Phase 5) ─────────────────────────────────────────────────
    /**
     * Indexes all KnowledgeChunks for a document into the vector store.
     * This connects Phase 4 ingestion to Phase 5 semantic retrieval.
     * Each chunk is embedded individually and indexed with full metadata.
     */
    this.on('embedChunks', async (req: cds.Request) => {
      const { documentId } = req.data as { documentId: string };

      if (!documentId) return req.error(400, 'documentId is required');

      const doc = await SELECT.one
        .from('nguard.KnowledgeDocuments')
        .where({ ID: documentId })
        .columns('ID', 'title', 'content', 'tenant_ID', 'project_ID', 'edition', 'release',
                 'country', 'industry', 'processArea', 'scopeItem', 'authorityLevel', 'docType',
                 'knowledgeSource_ID', 'source', 'ingestionStatus');

      if (!doc)  return req.error(404, `KnowledgeDocument ${documentId} not found`);

      // Only embed chunks for successfully ingested documents
      if (doc.ingestionStatus !== 'COMPLETED') {
        return req.error(409, `Document ingestion status is ${doc.ingestionStatus}; must be COMPLETED to embed chunks.`);
      }

      const chunks = await SELECT.from('nguard.KnowledgeChunks')
        .where({ document_ID: documentId })
        .columns('ID', 'sequence', 'text', 'tokenCount')
        .orderBy('sequence asc');

      if (!chunks?.length) return 0;

      const engine = await getAgentEngine();
      let indexed  = 0;

      for (const chunk of chunks) {
        try {
          await engine.embedDocument({
            id      : chunk.ID,
            content : chunk.text,
            metadata: {
              tenantId          : doc.tenant_ID          ?? undefined,
              projectId         : doc.project_ID         ?? undefined,
              edition           : doc.edition            ?? undefined,
              release           : doc.release            ?? undefined,
              country           : doc.country            ?? undefined,
              industry          : doc.industry           ?? undefined,
              processArea       : doc.processArea        ?? undefined,
              scopeItem         : doc.scopeItem          ?? undefined,
              authorityLevel    : doc.authorityLevel     ?? undefined,
              docType           : doc.docType            ?? undefined,
              source            : doc.source             ?? undefined,
              knowledgeSourceId : doc.knowledgeSource_ID ?? undefined,
              documentId        : doc.ID,
              chunkSequence     : chunk.sequence,
              title             : doc.title,
            },
          });
          indexed++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const log = cds.log('embed-chunks');
          log.warn(`Failed to embed chunk ${chunk.ID}: ${msg}`);
        }
      }

      if (indexed > 0) {
        await update('nguard.KnowledgeDocuments')
          .set({ embedding: JSON.stringify({ indexed, chunks: indexed }) })
          .where({ ID: documentId });

        await createAuditLog(req, {
          entityType : 'KnowledgeDocument',
          entityId   : documentId,
          action     : 'EMBED_CHUNKS',
          details    : JSON.stringify({ indexed, total: chunks.length }),
        });
      }

      return indexed;
    });

    await super.init();
  }
}
