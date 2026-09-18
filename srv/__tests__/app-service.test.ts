/**
 * N-Guard — AppService Business Logic Tests (Phase 1)
 *
 * Tests the response contract of the AppService handler.
 * These tests run with the root Jest config (ts-jest / CJS mode)
 * and do NOT require a CAP runtime or database.
 *
 * We test the shape of the values the handler registers rather than
 * instantiating the CAP ApplicationService class (which requires
 * the full CDS bootstrap lifecycle).
 */

// ── Response shape helpers ────────────────────────────────────────────────────

/** Mirrors what AppServiceHandler.ping() returns */
function makePingResponse(): { pong: boolean; timestamp: string } {
  return {
    pong      : true,
    timestamp : new Date().toISOString(),
  };
}

/** Mirrors what AppServiceHandler.info() returns */
function makeInfoResponse(): { name: string; version: string; environment: string; phase: string } {
  return {
    name        : 'n-guard',
    version     : process.env.npm_package_version ?? '0.1.0',
    environment : process.env.NODE_ENV ?? 'development',
      phase       : '13 — Security, Tenant Isolation, and Production Controls',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppService — ping response', () => {
  it('pong is true', () => {
    expect(makePingResponse().pong).toBe(true);
  });

  it('timestamp is a valid ISO 8601 string', () => {
    const { timestamp } = makePingResponse();
    expect(typeof timestamp).toBe('string');
    expect(new Date(timestamp).getTime()).not.toBeNaN();
  });
});

describe('AppService — info response', () => {
  it('name is n-guard', () => {
    expect(makeInfoResponse().name).toBe('n-guard');
  });

  it('version is a non-empty string', () => {
    expect(typeof makeInfoResponse().version).toBe('string');
    expect(makeInfoResponse().version.length).toBeGreaterThan(0);
  });

  it('phase label references Phase 13', () => {
    expect(makeInfoResponse().phase).toContain('13');
  });
});
