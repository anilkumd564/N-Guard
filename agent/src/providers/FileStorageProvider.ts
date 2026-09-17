/**
 * N-Guard — FileStorageProvider Abstraction
 *
 * Provides an abstraction over file/blob storage for N-Guard artifacts:
 *  - uploaded specification documents (PDF, DOCX, XLSX)
 *  - exported assessment reports
 *  - knowledge document source files
 *
 * Architecture rules:
 *  - Rule 9:  Production services must not depend on local filesystem state.
 *             The LocalFileStorageProvider is a clearly identified development
 *             adapter only.
 *  - Rule 10: All stored files must be scoped to tenant_id and project_id.
 *  - Rule 11: No credentials must be hard-coded; storage configuration comes
 *             from environment variables.
 *
 * Concrete implementations (future phases):
 *  - LocalFileStorageProvider  (Phase 0 dev — writes to ./local-storage/)
 *  - BTPObjectStoreProvider    (Phase N — SAP BTP Object Store service)
 *  - AzureBlobStorageProvider  (Phase N — Azure Blob Storage alternative)
 */

// ─── File Reference ───────────────────────────────────────────────────────────

export interface StoredFileRef {
  /** Unique file identifier within the store. */
  id          : string;
  /** Original filename. */
  filename    : string;
  /** MIME type, e.g. 'application/pdf'. */
  mimeType    : string;
  /** File size in bytes. */
  sizeBytes   : number;
  /** Tenant scope — mandatory. */
  tenantId    : string;
  /** Project scope — undefined for tenant-level files. */
  projectId?  : string;
  /** ISO 8601 upload timestamp. */
  uploadedAt  : string;
  /** Provider-specific URL or path (opaque to consumers). */
  storageUri  : string;
}

// ─── Upload Options ───────────────────────────────────────────────────────────

export interface FileUploadOptions {
  filename    : string;
  mimeType    : string;
  content     : Buffer | Uint8Array;
  tenantId    : string;
  projectId?  : string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * FileStorageProvider is the single gateway for all file I/O.
 * Inject this interface; never read/write the filesystem directly in production.
 */
export interface FileStorageProvider {
  /** Human-readable provider name, e.g. 'local', 'btp-object-store'. */
  readonly providerName : string;

  /**
   * Upload a file and return a StoredFileRef.
   * The returned `storageUri` is opaque — use it only to call `download` or `delete`.
   */
  upload(options: FileUploadOptions): Promise<StoredFileRef>;

  /**
   * Download a file by its storage URI.
   * Returns the raw file content as a Buffer.
   */
  download(storageUri: string): Promise<Buffer>;

  /**
   * Delete a file by its storage URI.
   */
  delete(storageUri: string): Promise<void>;

  /**
   * List files for a tenant (and optionally a project).
   */
  list(tenantId: string, projectId?: string): Promise<StoredFileRef[]>;
}
