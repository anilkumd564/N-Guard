/**
 * N-Guard — AdminService Handler
 *
 * Handles knowledge document management and tenant administration.
 * Architecture rule 8: VectorStore access is via the agent factory, not directly.
 */

import cds from '@sap/cds';
import { createAuditLog } from '../lib/audit.js';
import { getAgentEngine } from '../lib/agent-factory.js';

const { SELECT } = cds.ql;

export default class AdminServiceHandler extends cds.ApplicationService {
  async init() {

    // ── embedDocument ────────────────────────────────────────────────────────
    this.on('embedDocument', async (req) => {
      const { documentId } = req.data as { documentId: string };

      if (!documentId) return req.error(400, 'documentId is required');

      const doc = await SELECT.one
        .from('nguard.KnowledgeDocuments')
        .where({ ID: documentId })
        .columns('ID', 'title', 'content', 'tenant_ID', 'project_ID', 'edition', 'release');

      if (!doc) return req.error(404, `KnowledgeDocument ${documentId} not found`);
      if (!doc.content) return req.error(422, 'Document has no content to embed');

      try {
        const engine = getAgentEngine();
        await engine.embedDocument({
          id      : doc.ID,
          content : doc.content,
          metadata: {
            tenantId  : doc.tenant_ID  ?? undefined,
            projectId : doc.project_ID ?? undefined,
            edition   : doc.edition    ?? undefined,
            release   : doc.release    ?? undefined,
            title     : doc.title,
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

    await super.init();
  }
}
