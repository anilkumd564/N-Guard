/**
 * N-Guard — Local Filesystem Storage Provider (Development Adapter)
 *
 * ⚠️  DEVELOPMENT ADAPTER ONLY ⚠️
 *
 * This implementation stores files on the local filesystem under
 * `./local-storage/`.  It is an explicit development adapter behind the
 * FileStorageProvider interface.
 *
 * Architecture rule 9: Production services MUST NOT depend on local filesystem
 * state.  For BTP production deployment, replace this with:
 *  - BTPObjectStoreProvider   (SAP BTP Object Store service binding)
 *  - AzureBlobStorageProvider (Azure Blob Storage — if applicable)
 *
 * The local-storage directory is added to .gitignore to prevent accidental
 * commit of development data.
 *
 * Configuration:
 *  STORAGE_BASE_PATH  — base directory (default: ./local-storage)
 */

import fs   from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  FileStorageProvider,
  FileUploadOptions,
  StoredFileRef,
} from '../providers/FileStorageProvider.js';

const DEFAULT_BASE = path.join(process.cwd(), 'local-storage');

export class LocalFileStorageProvider implements FileStorageProvider {
  readonly providerName = 'local';

  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.env['STORAGE_BASE_PATH'] ?? DEFAULT_BASE;
  }

  async upload(options: FileUploadOptions): Promise<StoredFileRef> {
    const id  = randomUUID();
    const dir = this.dirFor(options.tenantId, options.projectId);
    fs.mkdirSync(dir, { recursive: true });

    const safeName   = sanitiseFilename(options.filename);
    const storageUri = path.join(dir, `${id}_${safeName}`);
    fs.writeFileSync(storageUri, Buffer.from(options.content));

    const stats = fs.statSync(storageUri);
    return {
      id,
      filename   : options.filename,
      mimeType   : options.mimeType,
      sizeBytes  : stats.size,
      tenantId   : options.tenantId,
      projectId  : options.projectId,
      uploadedAt : new Date().toISOString(),
      storageUri,
    };
  }

  async download(storageUri: string): Promise<Buffer> {
    if (!fs.existsSync(storageUri)) {
      throw new Error(`File not found at storage URI: ${storageUri}`);
    }
    return fs.readFileSync(storageUri);
  }

  async delete(storageUri: string): Promise<void> {
    if (fs.existsSync(storageUri)) {
      fs.unlinkSync(storageUri);
    }
  }

  async list(tenantId: string, projectId?: string): Promise<StoredFileRef[]> {
    const dir = this.dirFor(tenantId, projectId);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    return files
      .filter(f => fs.statSync(path.join(dir, f)).isFile())
      .map(f => {
        const full  = path.join(dir, f);
        const stats = fs.statSync(full);
        // Filename format: {uuid}_{originalName}
        const underscoreIdx = f.indexOf('_');
        const id       = underscoreIdx > -1 ? f.slice(0, underscoreIdx)  : f;
        const filename = underscoreIdx > -1 ? f.slice(underscoreIdx + 1) : f;
        return {
          id,
          filename,
          mimeType   : 'application/octet-stream',   // MIME not persisted in local adapter
          sizeBytes  : stats.size,
          tenantId,
          projectId,
          uploadedAt : stats.birthtime.toISOString(),
          storageUri : full,
        } satisfies StoredFileRef;
      });
  }

  private dirFor(tenantId: string, projectId?: string): string {
    const parts = [this.basePath, sanitisePathSegment(tenantId)];
    if (projectId) parts.push(sanitisePathSegment(projectId));
    return path.join(...parts);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove characters that are unsafe in filenames across platforms. */
function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 200);
}

/** Sanitise a path segment (tenant ID, project ID). */
function sanitisePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 100);
}
