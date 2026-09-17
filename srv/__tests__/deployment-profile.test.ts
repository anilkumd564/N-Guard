/**
 * N-Guard — Phase 2 Domain Model and Deployment Profile Tests
 *
 * Tests cover:
 *  1. S4Edition values — all three editions are valid, nothing else is.
 *  2. TransformationType values — GREENFIELD/BROWNFIELD/SELECTIVE/OTHER.
 *  3. CleanCorePolicy values — STRICT/STANDARD/FLEXIBLE/NOT_SET.
 *  4. validateProject — required fields, valid/invalid editions, release format.
 *  5. validateDeploymentProfile — required fields, invalid models, release ranges.
 *  6. Edition isolation — no cross-edition inference (architecture rule 2).
 *  7. Hybrid landscape — project can carry multiple deployment models.
 *  8. parseProcessAreas — valid JSON array, empty, invalid.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateProject,
  validateDeploymentProfile,
  parseProcessAreas,
  VALID_S4_EDITIONS,
  VALID_TRANSFORMATION_TYPES,
  VALID_CLEAN_CORE_POLICIES,
  S4_EDITION_LABELS,
  CLEAN_CORE_POLICY_LABELS,
  type S4Edition,
  type TransformationType,
  type CleanCorePolicy,
} from '../../srv/src/types/domain.js';

// ─── Edition constants ────────────────────────────────────────────────────────

describe('S4Edition constants', () => {
  it('defines exactly three deployment models', () => {
    expect(VALID_S4_EDITIONS).toHaveLength(3);
  });

  it('includes ON_PREMISE', () => {
    expect(VALID_S4_EDITIONS).toContain('ON_PREMISE');
  });

  it('includes CLOUD_PRIVATE', () => {
    expect(VALID_S4_EDITIONS).toContain('CLOUD_PRIVATE');
  });

  it('includes CLOUD_PUBLIC', () => {
    expect(VALID_S4_EDITIONS).toContain('CLOUD_PUBLIC');
  });

  it('does not include a generic "CLOUD" or "SAP_S4HANA" catch-all', () => {
    expect(VALID_S4_EDITIONS).not.toContain('CLOUD');
    expect(VALID_S4_EDITIONS).not.toContain('SAP_S4HANA');
    expect(VALID_S4_EDITIONS).not.toContain('DEFAULT');
  });

  it('has distinct labels for all three editions (no label reuse)', () => {
    const labels = VALID_S4_EDITIONS.map(e => S4_EDITION_LABELS[e as S4Edition]);
    const unique  = new Set(labels);
    expect(unique.size).toBe(3);
  });
});

// ─── TransformationType ───────────────────────────────────────────────────────

describe('TransformationType constants', () => {
  it('defines four transformation types', () => {
    expect(VALID_TRANSFORMATION_TYPES).toHaveLength(4);
  });

  const types: TransformationType[] = ['GREENFIELD', 'BROWNFIELD', 'SELECTIVE', 'OTHER'];
  types.forEach(t => {
    it(`includes ${t}`, () => {
      expect(VALID_TRANSFORMATION_TYPES).toContain(t);
    });
  });
});

// ─── CleanCorePolicy ──────────────────────────────────────────────────────────

describe('CleanCorePolicy constants', () => {
  it('defines four clean core policies', () => {
    expect(VALID_CLEAN_CORE_POLICIES).toHaveLength(4);
  });

  const policies: CleanCorePolicy[] = ['STRICT', 'STANDARD', 'FLEXIBLE', 'NOT_SET'];
  policies.forEach(p => {
    it(`includes ${p}`, () => {
      expect(VALID_CLEAN_CORE_POLICIES).toContain(p);
    });
  });

  it('has distinct labels for all four policies', () => {
    const labels = VALID_CLEAN_CORE_POLICIES.map(p => CLEAN_CORE_POLICY_LABELS[p as CleanCorePolicy]);
    const unique  = new Set(labels);
    expect(unique.size).toBe(4);
  });
});

// ─── validateProject ─────────────────────────────────────────────────────────

describe('validateProject', () => {
  it('passes with valid name and ON_PREMISE edition', () => {
    const result = validateProject({ name: 'Test Project', edition: 'ON_PREMISE' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with valid name and CLOUD_PRIVATE edition', () => {
    const result = validateProject({ name: 'Cloud Private Project', edition: 'CLOUD_PRIVATE' });
    expect(result.valid).toBe(true);
  });

  it('passes with valid name and CLOUD_PUBLIC edition', () => {
    const result = validateProject({ name: 'Cloud Public Project', edition: 'CLOUD_PUBLIC' });
    expect(result.valid).toBe(true);
  });

  it('fails when name is missing', () => {
    const result = validateProject({ edition: 'ON_PREMISE' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('fails when name is empty string', () => {
    const result = validateProject({ name: '   ', edition: 'CLOUD_PUBLIC' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('fails when edition is missing — never infer a default (rule 2)', () => {
    const result = validateProject({ name: 'No Edition Project' });
    expect(result.valid).toBe(false);
    const editionError = result.errors.find(e => e.field === 'edition');
    expect(editionError).toBeDefined();
    expect(editionError?.message).toContain('required');
  });

  it('fails with an unrecognised edition string', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateProject({ name: 'Bad Edition', edition: 'WRONG_EDITION' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'edition')).toBe(true);
  });

  it('fails with a generic "CLOUD" edition that does not map to a specific deployment model', () => {
    // Rule 2: must not accept ambiguous edition identifiers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateProject({ name: 'Ambiguous Cloud', edition: 'CLOUD' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'edition')).toBe(true);
  });

  it('passes with a valid 4-digit release year', () => {
    const result = validateProject({ name: 'Proj', edition: 'CLOUD_PUBLIC', release: '2024' });
    expect(result.valid).toBe(true);
  });

  it('passes with a release including FPS suffix', () => {
    const result = validateProject({ name: 'Proj', edition: 'CLOUD_PUBLIC', release: '2024FPS01' });
    expect(result.valid).toBe(true);
  });

  it('fails with a non-numeric release string', () => {
    const result = validateProject({ name: 'Proj', edition: 'CLOUD_PUBLIC', release: 'v10.5' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'release')).toBe(true);
  });

  it('passes with valid transformationType GREENFIELD', () => {
    const result = validateProject({
      name: 'GF Proj', edition: 'CLOUD_PUBLIC', transformationType: 'GREENFIELD',
    });
    expect(result.valid).toBe(true);
  });

  it('fails with invalid transformationType', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateProject({ name: 'Proj', edition: 'ON_PREMISE', transformationType: 'INVALID' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'transformationType')).toBe(true);
  });

  it('passes with STRICT cleanCorePolicy', () => {
    const result = validateProject({
      name: 'Strict Proj', edition: 'CLOUD_PUBLIC', cleanCorePolicy: 'STRICT',
    });
    expect(result.valid).toBe(true);
  });

  it('fails with invalid cleanCorePolicy', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateProject({ name: 'Proj', edition: 'ON_PREMISE', cleanCorePolicy: 'NONE' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'cleanCorePolicy')).toBe(true);
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const result = validateProject({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2); // name + edition
  });

  it('ignores undefined optional fields (no spurious errors)', () => {
    const result = validateProject({ name: 'Project', edition: 'ON_PREMISE' });
    expect(result.valid).toBe(true);
  });
});

// ─── validateDeploymentProfile ────────────────────────────────────────────────

describe('validateDeploymentProfile', () => {
  it('passes with a valid profile for ON_PREMISE', () => {
    const result = validateDeploymentProfile({
      profileName    : 'On-Premise Profile',
      deploymentModel: 'ON_PREMISE',
    });
    expect(result.valid).toBe(true);
  });

  it('passes with a valid profile for CLOUD_PRIVATE', () => {
    const result = validateDeploymentProfile({
      profileName    : 'Private Cloud Profile',
      deploymentModel: 'CLOUD_PRIVATE',
    });
    expect(result.valid).toBe(true);
  });

  it('passes with a valid profile for CLOUD_PUBLIC', () => {
    const result = validateDeploymentProfile({
      profileName    : 'Public Cloud Profile',
      deploymentModel: 'CLOUD_PUBLIC',
    });
    expect(result.valid).toBe(true);
  });

  it('fails when profileName is missing', () => {
    const result = validateDeploymentProfile({ deploymentModel: 'CLOUD_PUBLIC' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'profileName')).toBe(true);
  });

  it('fails when deploymentModel is missing (rule 2 enforcement)', () => {
    const result = validateDeploymentProfile({ profileName: 'Profile Without Model' });
    expect(result.valid).toBe(false);
    const modelError = result.errors.find(e => e.field === 'deploymentModel');
    expect(modelError).toBeDefined();
    expect(modelError?.message).toContain('required');
  });

  it('fails with an unrecognised deploymentModel', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateDeploymentProfile({ profileName: 'Profile', deploymentModel: 'HYBRID' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'deploymentModel')).toBe(true);
  });

  it('fails with invalid release format', () => {
    const result = validateDeploymentProfile({
      profileName    : 'Profile',
      deploymentModel: 'CLOUD_PUBLIC',
      release        : '24.1',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'release')).toBe(true);
  });

  it('fails when releaseFrom is later than releaseTo', () => {
    const result = validateDeploymentProfile({
      profileName    : 'Profile',
      deploymentModel: 'ON_PREMISE',
      releaseFrom    : '2025',
      releaseTo      : '2023',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'releaseFrom')).toBe(true);
  });

  it('passes when releaseFrom equals releaseTo (single release)', () => {
    const result = validateDeploymentProfile({
      profileName    : 'Profile',
      deploymentModel: 'ON_PREMISE',
      releaseFrom    : '2024',
      releaseTo      : '2024',
    });
    expect(result.valid).toBe(true);
  });

  it('edition isolation — ON_PREMISE profile is not reusable for CLOUD_PUBLIC (distinct objects)', () => {
    // Verify that creating separate profiles preserves edition independence.
    const opProfile = validateDeploymentProfile({
      profileName    : 'On-Prem Profile',
      deploymentModel: 'ON_PREMISE',
    });
    const pubProfile = validateDeploymentProfile({
      profileName    : 'Public Cloud Profile',
      deploymentModel: 'CLOUD_PUBLIC',
    });
    expect(opProfile.valid).toBe(true);
    expect(pubProfile.valid).toBe(true);
    // The profiles are independently valid — neither "inherits" the other's model
  });

  it('supports hybrid landscape — multiple profiles for the same project are independently valid', () => {
    // A project can have both an on-premise and a cloud profile.
    const profiles = [
      { profileName: 'Core ERP On-Premise',    deploymentModel: 'ON_PREMISE'    as const },
      { profileName: 'Extension Cloud Public', deploymentModel: 'CLOUD_PUBLIC'  as const },
      { profileName: 'Analytics Private Cloud',deploymentModel: 'CLOUD_PRIVATE' as const },
    ];
    profiles.forEach(profile => {
      const result = validateDeploymentProfile(profile);
      expect(result.valid).toBe(true);
    });
  });
});

// ─── parseProcessAreas ────────────────────────────────────────────────────────

describe('parseProcessAreas', () => {
  it('returns empty array for null', () => {
    expect(parseProcessAreas(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseProcessAreas(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseProcessAreas('')).toEqual([]);
  });

  it('parses a valid JSON array of process areas', () => {
    const input = JSON.stringify(['Order-to-Cash', 'Procure-to-Pay', 'Finance']);
    expect(parseProcessAreas(input)).toEqual(['Order-to-Cash', 'Procure-to-Pay', 'Finance']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseProcessAreas('not-json')).toThrow();
  });

  it('throws when JSON is not an array', () => {
    expect(() => parseProcessAreas('{"key":"value"}')).toThrow();
  });

  it('converts non-string array values to strings', () => {
    const input = JSON.stringify([1, 2, 3]);
    expect(parseProcessAreas(input)).toEqual(['1', '2', '3']);
  });
});
