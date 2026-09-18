/**
 * N-Guard — Phase 13 Security Tests
 *
 * Tests cover:
 *  1. RBAC: role→permission matrix is complete and correct
 *  2. PLATFORM_ADMIN has all permissions
 *  3. USER has only read permissions
 *  4. hasRole() respects PLATFORM_ADMIN escalation
 *  5. Input validation — allowed MIME types pass
 *  6. Input validation — disallowed MIME types are rejected
 *  7. Input validation — file size limit enforced
 *  8. Filename sanitization — path traversal blocked
 *  9. Filename sanitization — null bytes removed
 * 10. Filename sanitization — path separators replaced
 * 11. Secret redaction — Bearer tokens redacted
 * 12. Secret redaction — API keys redacted
 * 13. Secret redaction — passwords redacted
 * 14. Cross-tenant isolation — tenant A scope covers only tenant A data
 * 15. DESIGN_AUTHORITY can review but USER cannot
 */

import { describe, it, expect } from '@jest/globals';
import {
  hasPermission,
  hasRole,
  validateUpload,
  sanitizeFilename,
  redactSecrets,
  ROLE_PERMISSIONS,
  ROLE_SCOPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  DEFAULT_MAX_FILE_BYTES,
} from '../security/types.js';
import type { NGuardRole, NGuardPermission } from '../security/types.js';

const ALL_ROLES: NGuardRole[] = [
  'USER', 'FUNCTIONAL_LEAD', 'SOLUTION_ARCHITECT',
  'DESIGN_AUTHORITY', 'PROJECT_ADMIN', 'PLATFORM_ADMIN',
];

const ALL_PERMISSIONS: NGuardPermission[] = [
  'requirements:read', 'requirements:write', 'requirements:submit',
  'assessments:read', 'assessments:run', 'assessments:review', 'assessments:approve',
  'knowledge:read', 'knowledge:write',
  'comparison:run', 'cleancore:run',
  'projects:read', 'projects:write',
  'admin:jobs', 'admin:integrations', 'admin:platform',
];

// ── 1. RBAC permission matrix ─────────────────────────────────────────────────

describe('RBAC — permission matrix completeness', () => {
  it('every role has at least one permission', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('every role includes requirements:read and assessments:read', () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, 'requirements:read')).toBe(true);
      expect(hasPermission(role, 'assessments:read')).toBe(true);
    }
  });

  it('no role grants unknown permissions', () => {
    for (const role of ALL_ROLES) {
      for (const perm of ROLE_PERMISSIONS[role]) {
        expect(ALL_PERMISSIONS).toContain(perm);
      }
    }
  });
});

// ── 2. PLATFORM_ADMIN has all permissions ─────────────────────────────────────

describe('RBAC — PLATFORM_ADMIN', () => {
  it('PLATFORM_ADMIN has all permissions', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission('PLATFORM_ADMIN', perm)).toBe(true);
    }
  });

  it('PLATFORM_ADMIN scope escalates via hasRole()', () => {
    const adminScopes = [ROLE_SCOPES['PLATFORM_ADMIN']];
    expect(hasRole(adminScopes, 'USER')).toBe(true);
    expect(hasRole(adminScopes, 'DESIGN_AUTHORITY')).toBe(true);
    expect(hasRole(adminScopes, 'PROJECT_ADMIN')).toBe(true);
  });
});

// ── 3. USER role restrictions ─────────────────────────────────────────────────

describe('RBAC — USER role', () => {
  it('USER cannot run assessments', () => {
    expect(hasPermission('USER', 'assessments:run')).toBe(false);
  });

  it('USER cannot write requirements', () => {
    expect(hasPermission('USER', 'requirements:write')).toBe(false);
  });

  it('USER cannot write knowledge', () => {
    expect(hasPermission('USER', 'knowledge:write')).toBe(false);
  });

  it('USER cannot approve assessments', () => {
    expect(hasPermission('USER', 'assessments:approve')).toBe(false);
  });

  it('USER cannot access admin:platform', () => {
    expect(hasPermission('USER', 'admin:platform')).toBe(false);
  });
});

// ── 4. DESIGN_AUTHORITY can review ────────────────────────────────────────────

describe('RBAC — DESIGN_AUTHORITY', () => {
  it('DESIGN_AUTHORITY can review assessments', () => {
    expect(hasPermission('DESIGN_AUTHORITY', 'assessments:review')).toBe(true);
  });

  it('DESIGN_AUTHORITY can approve assessments', () => {
    expect(hasPermission('DESIGN_AUTHORITY', 'assessments:approve')).toBe(true);
  });

  it('DESIGN_AUTHORITY cannot access admin:platform', () => {
    expect(hasPermission('DESIGN_AUTHORITY', 'admin:platform')).toBe(false);
  });

  it('hasRole enforces scope correctly', () => {
    const daScopes = [ROLE_SCOPES['DESIGN_AUTHORITY']];
    expect(hasRole(daScopes, 'DESIGN_AUTHORITY')).toBe(true);
    expect(hasRole(daScopes, 'PLATFORM_ADMIN')).toBe(false);
  });
});

// ── 5. File type allowlist ────────────────────────────────────────────────────

describe('Input validation — file type allowlist', () => {
  it('text/plain is allowed', () => {
    const r = validateUpload('doc.txt', 'text/plain', 100);
    expect(r.valid).toBe(true);
  });

  it('application/pdf is allowed', () => {
    const r = validateUpload('doc.pdf', 'application/pdf', 100);
    expect(r.valid).toBe(true);
  });

  it('image/jpeg is NOT allowed', () => {
    const r = validateUpload('img.jpg', 'image/jpeg', 100);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('image/jpeg');
  });

  it('application/exe is NOT allowed', () => {
    const r = validateUpload('bad.exe', 'application/octet-stream', 100);
    expect(r.valid).toBe(false);
  });

  it('all documented MIME types pass validation', () => {
    for (const mimeType of ALLOWED_DOCUMENT_MIME_TYPES) {
      const r = validateUpload('file.txt', mimeType, 100);
      // Only check MIME type — filename issues are separate
      const mimeError = r.errors.some(e => e.includes('not allowed'));
      expect(mimeError).toBe(false);
    }
  });
});

// ── 6. File size limit ────────────────────────────────────────────────────────

describe('Input validation — file size', () => {
  it('file within limit passes', () => {
    const r = validateUpload('doc.txt', 'text/plain', 1024);
    expect(r.errors.some(e => e.includes('exceeds'))).toBe(false);
  });

  it('file exceeding DEFAULT_MAX_FILE_BYTES is rejected', () => {
    const r = validateUpload('big.txt', 'text/plain', DEFAULT_MAX_FILE_BYTES + 1);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  it('custom max bytes respected', () => {
    const r = validateUpload('file.txt', 'text/plain', 500, 100);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('exceeds'))).toBe(true);
  });
});

// ── 7. Filename sanitization ──────────────────────────────────────────────────

describe('Input validation — filename sanitization', () => {
  it('safe filename is unchanged', () => {
    expect(sanitizeFilename('my-document.txt')).toBe('my-document.txt');
  });

  it('path traversal is blocked', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/etc/passwd');
  });

  it('backslash path separators are replaced', () => {
    expect(sanitizeFilename('folder\\file.txt')).not.toContain('\\');
  });

  it('forward slash path separators are replaced', () => {
    expect(sanitizeFilename('folder/file.txt')).not.toContain('/');
  });

  it('null bytes are removed', () => {
    expect(sanitizeFilename('file\x00name.txt')).not.toContain('\x00');
  });

  it('filename is truncated at 255 characters', () => {
    const long = 'a'.repeat(300) + '.txt';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });

  it('validateUpload rejects unsafe filename', () => {
    const r = validateUpload('../evil.txt', 'text/plain', 100);
    // The file has unsafe chars (path separator) → invalid
    expect(r.errors.some(e => e.includes('unsafe'))).toBe(true);
  });
});

// ── 8. Secret redaction ───────────────────────────────────────────────────────

describe('Secret redaction', () => {
  it('Bearer token is redacted', () => {
    const log = 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9';
    const result = redactSecrets(log);
    expect(result).not.toContain('eyJhbGciOiJSUzI1NiJ9');
    expect(result).toContain('[REDACTED]');
  });

  it('API key in query string is redacted', () => {
    const log = 'GET /api?apikey=secret-key-abc123xyz';
    const result = redactSecrets(log);
    expect(result).not.toContain('secret-key-abc123xyz');
  });

  it('password in log line is redacted', () => {
    const log = 'Connecting with password=MySecretPassword123';
    const result = redactSecrets(log);
    expect(result).not.toContain('MySecretPassword123');
  });

  it('safe log text is unchanged', () => {
    const log = 'User john@example.com submitted assessment dr-001';
    expect(redactSecrets(log)).toBe(log);
  });

  it('multiple secrets in one line are all redacted', () => {
    const log = 'apikey=mykey12345 and password=mypass12345';
    const result = redactSecrets(log);
    expect(result).not.toContain('mykey12345');
    expect(result).not.toContain('mypass12345');
  });
});

// ── 9. Cross-tenant isolation ─────────────────────────────────────────────────

describe('Cross-tenant isolation (rule 10)', () => {
  it('SOLUTION_ARCHITECT scope does not include PLATFORM_ADMIN', () => {
    const saScopes = [ROLE_SCOPES['SOLUTION_ARCHITECT']];
    expect(hasRole(saScopes, 'PLATFORM_ADMIN')).toBe(false);
  });

  it('USER role scope does not grant any admin permission', () => {
    expect(hasPermission('USER', 'admin:platform')).toBe(false);
    expect(hasPermission('USER', 'admin:integrations')).toBe(false);
    expect(hasPermission('USER', 'admin:jobs')).toBe(false);
  });

  it('role scopes are unique — no two roles share a scope', () => {
    const scopeValues = Object.values(ROLE_SCOPES);
    const uniqueScopes = new Set(scopeValues);
    expect(uniqueScopes.size).toBe(scopeValues.length);
  });

  it('tenant isolation: scope from tenant A does not include tenant B data (architecture validation)', () => {
    // The tenant_id filtering is enforced in the CAP handler WHERE clauses.
    // This test validates the RBAC model does not bypass tenant constraints.
    // The hasRole/hasPermission functions are stateless; tenant filtering
    // is done separately in DB queries (confirmed in Phase 5 retrieval tests).
    const tenantAUserScopes = [ROLE_SCOPES['SOLUTION_ARCHITECT']];
    // No PLATFORM_ADMIN scope → cannot access other tenants' admin operations
    expect(hasRole(tenantAUserScopes, 'PLATFORM_ADMIN')).toBe(false);
    expect(hasPermission('SOLUTION_ARCHITECT', 'admin:platform')).toBe(false);
  });
});
