/**
 * N-Guard — Security Types (Phase 13)
 *
 * RBAC roles, permissions, and the authority matrix for N-Guard.
 * Authorization is enforced server-side — never rely on hidden UI controls.
 *
 * Architecture rules:
 *  - Rule 5:  AI never makes final governance decisions (role enforcement).
 *  - Rule 10: All security decisions respect tenant_id and project_id.
 *  - Rule 11: No credentials stored in code.
 */

// ─── N-Guard Roles ────────────────────────────────────────────────────────────

/**
 * N-Guard RBAC roles — from least to most privileged.
 * A user may hold multiple roles.
 */
export type NGuardRole =
  | 'USER'              // Read-only access to requirements and assessments
  | 'FUNCTIONAL_LEAD'   // Create/edit requirements; submit for assessment
  | 'SOLUTION_ARCHITECT'// Run assessments, comparisons, Clean Core analyses
  | 'DESIGN_AUTHORITY'  // Approve/reject assessments; record review decisions
  | 'PROJECT_ADMIN'     // Manage project settings, deployment profiles, knowledge
  | 'PLATFORM_ADMIN';   // Tenant-level administration, all projects

export const ROLE_LABELS: Record<NGuardRole, string> = {
  USER               : 'User / Consultant (read-only)',
  FUNCTIONAL_LEAD    : 'Functional Lead',
  SOLUTION_ARCHITECT : 'Solution Architect',
  DESIGN_AUTHORITY   : 'Design Authority',
  PROJECT_ADMIN      : 'Project Administrator',
  PLATFORM_ADMIN     : 'Platform Administrator',
};

/** Scope strings used in bearer tokens for each role. */
export const ROLE_SCOPES: Record<NGuardRole, string> = {
  USER               : 'nguard.user',
  FUNCTIONAL_LEAD    : 'nguard.functional_lead',
  SOLUTION_ARCHITECT : 'nguard.solution_architect',
  DESIGN_AUTHORITY   : 'nguard.design_authority',
  PROJECT_ADMIN      : 'nguard.project_admin',
  PLATFORM_ADMIN     : 'nguard.platform_admin',
};

/** Reverse map: scope string → role */
export const SCOPE_TO_ROLE: Record<string, NGuardRole> = Object.fromEntries(
  Object.entries(ROLE_SCOPES).map(([role, scope]) => [scope, role as NGuardRole]),
);

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Fine-grained permissions that can be checked server-side.
 * Each role grants a set of permissions (see ROLE_PERMISSIONS below).
 */
export type NGuardPermission =
  // Requirements
  | 'requirements:read'
  | 'requirements:write'
  | 'requirements:submit'
  // Assessments
  | 'assessments:read'
  | 'assessments:run'
  | 'assessments:review'   // submitForReview, recordReviewDecision
  | 'assessments:approve'  // approveAssessment
  // Knowledge
  | 'knowledge:read'
  | 'knowledge:write'      // createKnowledgeSource, ingestDocument
  // Comparisons and analysis
  | 'comparison:run'
  | 'cleancore:run'
  // Project management
  | 'projects:read'
  | 'projects:write'
  // Administration
  | 'admin:jobs'
  | 'admin:integrations'
  | 'admin:platform';

/** Which permissions each role grants. */
export const ROLE_PERMISSIONS: Record<NGuardRole, NGuardPermission[]> = {
  USER: [
    'requirements:read', 'assessments:read', 'knowledge:read', 'projects:read',
  ],
  FUNCTIONAL_LEAD: [
    'requirements:read', 'requirements:write', 'requirements:submit',
    'assessments:read', 'knowledge:read', 'projects:read',
  ],
  SOLUTION_ARCHITECT: [
    'requirements:read', 'requirements:write', 'requirements:submit',
    'assessments:read', 'assessments:run',
    'knowledge:read', 'knowledge:write',
    'comparison:run', 'cleancore:run',
    'projects:read',
  ],
  DESIGN_AUTHORITY: [
    'requirements:read', 'requirements:write', 'requirements:submit',
    'assessments:read', 'assessments:run', 'assessments:review', 'assessments:approve',
    'knowledge:read', 'knowledge:write',
    'comparison:run', 'cleancore:run',
    'projects:read',
  ],
  PROJECT_ADMIN: [
    'requirements:read', 'requirements:write', 'requirements:submit',
    'assessments:read', 'assessments:run', 'assessments:review', 'assessments:approve',
    'knowledge:read', 'knowledge:write',
    'comparison:run', 'cleancore:run',
    'projects:read', 'projects:write',
    'admin:jobs',
  ],
  PLATFORM_ADMIN: [
    'requirements:read', 'requirements:write', 'requirements:submit',
    'assessments:read', 'assessments:run', 'assessments:review', 'assessments:approve',
    'knowledge:read', 'knowledge:write',
    'comparison:run', 'cleancore:run',
    'projects:read', 'projects:write',
    'admin:jobs', 'admin:integrations', 'admin:platform',
  ],
};

/**
 * Check whether a role has a specific permission.
 * Server-side only — never trust client-side checks.
 */
export function hasPermission(
  role       : NGuardRole,
  permission : NGuardPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check whether a list of scopes (from the bearer token) includes the required role.
 */
export function hasRole(scopes: string[], requiredRole: NGuardRole): boolean {
  const requiredScope = ROLE_SCOPES[requiredRole];
  return scopes.includes(requiredScope) || scopes.includes(ROLE_SCOPES['PLATFORM_ADMIN']);
}

// ─── Input Validation ─────────────────────────────────────────────────────────

/**
 * Allowed MIME types for document ingestion.
 * Only these types pass the allowlist check.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/json',
]);

/** Maximum file size for ingestion (10 MB). Override via MAX_INGEST_FILE_BYTES env. */
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Maximum AI request prompt size in characters. Override via MAX_PROMPT_CHARS env. */
export const DEFAULT_MAX_PROMPT_CHARS = 32_000;

// ─── Secret Redaction ─────────────────────────────────────────────────────────

/**
 * Patterns to redact from log output.
 * Prevents accidental secret exposure in logs (rule 11).
 */
export const REDACTION_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,     // Bearer tokens
  /apikey[=:]["']?[A-Za-z0-9\-._]{8,}/gi,  // API keys
  /client.?secret[=:]["']?[A-Za-z0-9\-._]{8,}/gi, // Client secrets
  /password[=:]["']?[^\s"']{8,}/gi,        // Passwords
  /pat[=:]["']?[A-Za-z0-9\-._]{20,}/gi,   // Personal access tokens
];

/**
 * Redact sensitive values from a string before logging.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Sanitize a filename — allow only safe characters.
 * Prevents path traversal and null byte injection.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '')          // remove parent directory refs
    .replace(/[/\\]/g, '_')        // replace path separators
    .replace(/\x00/g, '')          // remove null bytes
    .replace(/[^\w\-.() ]/g, '_')  // allow only safe chars
    .slice(0, 255);                // enforce max length
}

/**
 * Validate file type and size for ingestion.
 * Returns a validation result — never throws.
 */
export function validateUpload(
  filename    : string,
  mimeType    : string,
  sizeBytes   : number,
  maxBytes    : number = DEFAULT_MAX_FILE_BYTES,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    errors.push(`File type "${mimeType}" is not allowed. Allowed types: ${[...ALLOWED_DOCUMENT_MIME_TYPES].join(', ')}`);
  }

  if (sizeBytes > maxBytes) {
    errors.push(`File size ${(sizeBytes / 1024 / 1024).toFixed(2)} MB exceeds the maximum allowed ${(maxBytes / 1024 / 1024).toFixed(2)} MB.`);
  }

  const safe = sanitizeFilename(filename);
  if (safe !== filename) {
    errors.push(`Filename contains unsafe characters. Use only letters, numbers, hyphens, dots, and underscores.`);
  }

  return { valid: errors.length === 0, errors };
}
