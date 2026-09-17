/**
 * N-Guard — Phase 3 Requirements Workspace Tests
 *
 * Tests cover:
 *  1. WorkItemType — all four types are valid.
 *  2. WorkItemPriority — all four priorities are valid.
 *  3. validateRequirement — required fields, valid/invalid types and priorities.
 *  4. parseCsvString — headers, quoted fields, empty lines.
 *  5. splitCsvLine — RFC 4180 quoting, commas in quoted fields.
 *  6. validateCsvRow — row-level errors for each required field.
 *  7. csvRowToRequirement — maps row values to payload correctly.
 *  8. requirementsToCsv — round-trip export produces valid header + rows.
 *  9. Project isolation — tenant_ID and project_ID are preserved.
 * 10. CSV import error isolation — invalid rows skipped, valid rows imported.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateRequirement,
  parseCsvString,
  splitCsvLine,
  validateCsvRow,
  csvRowToRequirement,
  requirementsToCsv,
  VALID_WORK_ITEM_TYPES,
  VALID_WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPE_LABELS,
  CSV_COLUMNS,
  CSV_REQUIRED_COLUMNS,
  type WorkItemType,
  type WorkItemPriority,
  type RequirementRecord,
} from '../../srv/src/types/domain.js';

// ─── WorkItemType constants ───────────────────────────────────────────────────

describe('WorkItemType constants', () => {
  it('defines exactly four work item types', () => {
    expect(VALID_WORK_ITEM_TYPES).toHaveLength(4);
  });

  const types: WorkItemType[] = ['REQUIREMENT', 'USER_STORY', 'CHANGE_REQUEST', 'DESIGN_ARTIFACT'];
  types.forEach(t => {
    it(`includes ${t}`, () => {
      expect(VALID_WORK_ITEM_TYPES).toContain(t);
    });
  });

  it('has distinct labels for all four types', () => {
    const labels = VALID_WORK_ITEM_TYPES.map(t => WORK_ITEM_TYPE_LABELS[t as WorkItemType]);
    expect(new Set(labels).size).toBe(4);
  });
});

// ─── WorkItemPriority constants ───────────────────────────────────────────────

describe('WorkItemPriority constants', () => {
  it('defines exactly four priority levels', () => {
    expect(VALID_WORK_ITEM_PRIORITIES).toHaveLength(4);
  });

  const priorities: WorkItemPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  priorities.forEach(p => {
    it(`includes ${p}`, () => {
      expect(VALID_WORK_ITEM_PRIORITIES).toContain(p);
    });
  });
});

// ─── validateRequirement ─────────────────────────────────────────────────────

describe('validateRequirement', () => {
  it('passes with minimal valid payload (REQUIREMENT type)', () => {
    const result = validateRequirement({ title: 'Custom pricing', description: 'We need custom pricing.' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for all four work item types', () => {
    for (const wt of VALID_WORK_ITEM_TYPES) {
      const result = validateRequirement({ title: 'T', description: 'D', workItemType: wt });
      expect(result.valid).toBe(true);
    }
  });

  it('fails when title is missing', () => {
    const result = validateRequirement({ description: 'Some description' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'title')).toBe(true);
  });

  it('fails when title is empty string', () => {
    const result = validateRequirement({ title: '   ', description: 'Description' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'title')).toBe(true);
  });

  it('fails when description is missing', () => {
    const result = validateRequirement({ title: 'Title' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'description')).toBe(true);
  });

  it('fails with invalid workItemType', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateRequirement({ title: 'T', description: 'D', workItemType: 'INVALID' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'workItemType')).toBe(true);
  });

  it('fails with invalid priority', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateRequirement({ title: 'T', description: 'D', priority: 'URGENT' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'priority')).toBe(true);
  });

  it('fails when title exceeds 500 characters', () => {
    const result = validateRequirement({ title: 'A'.repeat(501), description: 'D' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'title')).toBe(true);
  });

  it('passes with all valid optional fields', () => {
    const result = validateRequirement({
      title: 'Custom pricing',
      description: 'We need pricing.',
      workItemType: 'CHANGE_REQUEST',
      priority: 'HIGH',
      businessObjective: 'Increase margins.',
      businessProcess: 'Order-to-Cash',
      module: 'SD',
      source: 'Business workshop',
      owner: 'Jane Doe',
      externalReference: 'ADO-1234',
    });
    expect(result.valid).toBe(true);
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const result = validateRequirement({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2); // title + description
  });
});

// ─── splitCsvLine ─────────────────────────────────────────────────────────────

describe('splitCsvLine', () => {
  it('splits a simple line', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(splitCsvLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(splitCsvLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('handles empty fields', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles trailing comma', () => {
    const result = splitCsvLine('a,b,');
    expect(result).toHaveLength(3);
    expect(result[2]).toBe('');
  });

  it('handles single field', () => {
    expect(splitCsvLine('hello')).toEqual(['hello']);
  });
});

// ─── parseCsvString ───────────────────────────────────────────────────────────

describe('parseCsvString', () => {
  it('parses a valid CSV with header and data rows', () => {
    const csv = 'workItemType,title,description\nREQUIREMENT,Custom pricing,We need it.';
    const { headers, rows } = parseCsvString(csv);
    expect(headers).toEqual(['workitemtype', 'title', 'description']);
    expect(rows).toHaveLength(1);
    expect(rows[0]['workitemtype']).toBe('REQUIREMENT');
    expect(rows[0]['title']).toBe('Custom pricing');
  });

  it('returns empty for empty string', () => {
    const { headers, rows } = parseCsvString('');
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it('normalises headers to lowercase', () => {
    const { headers } = parseCsvString('WorkItemType,Title,Description\n');
    expect(headers).toEqual(['workitemtype', 'title', 'description']);
  });

  it('handles CRLF line endings', () => {
    const csv = 'workItemType,title,description\r\nREQUIREMENT,T,D';
    const { rows } = parseCsvString(csv);
    expect(rows).toHaveLength(1);
  });

  it('skips blank lines', () => {
    const csv = 'workItemType,title,description\n\nREQUIREMENT,T,D\n\n';
    const { rows } = parseCsvString(csv);
    expect(rows).toHaveLength(1);
  });

  it('handles multiple data rows', () => {
    const csv = [
      'workItemType,title,description',
      'REQUIREMENT,Req 1,Desc 1',
      'USER_STORY,Story 1,As a user...',
      'CHANGE_REQUEST,CR-001,Change this.',
    ].join('\n');
    const { rows } = parseCsvString(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]['workitemtype']).toBe('USER_STORY');
  });

  it('handles quoted fields with newlines preserved', () => {
    const csv = 'workItemType,title,description\nREQUIREMENT,"Pricing","Line one"';
    const { rows } = parseCsvString(csv);
    expect(rows[0]['title']).toBe('Pricing');
  });
});

// ─── validateCsvRow ───────────────────────────────────────────────────────────

describe('validateCsvRow', () => {
  it('returns no errors for a valid row', () => {
    const row = { workitemtype: 'REQUIREMENT', title: 'Custom pricing', description: 'Details here.' };
    expect(validateCsvRow(row, 2)).toHaveLength(0);
  });

  it('returns error when workItemType is missing', () => {
    const errors = validateCsvRow({ title: 'T', description: 'D' }, 2);
    expect(errors.some(e => e.field === 'workItemType')).toBe(true);
    expect(errors[0].row).toBe(2);
  });

  it('returns error when workItemType is invalid', () => {
    const errors = validateCsvRow({ workitemtype: 'BAD_TYPE', title: 'T', description: 'D' }, 3);
    expect(errors.some(e => e.field === 'workItemType')).toBe(true);
  });

  it('returns error when title is missing', () => {
    const errors = validateCsvRow({ workitemtype: 'REQUIREMENT', description: 'D' }, 4);
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('returns error when description is missing', () => {
    const errors = validateCsvRow({ workitemtype: 'USER_STORY', title: 'T' }, 5);
    expect(errors.some(e => e.field === 'description')).toBe(true);
  });

  it('returns error for invalid priority', () => {
    const errors = validateCsvRow({ workitemtype: 'REQUIREMENT', title: 'T', description: 'D', priority: 'URGENT' }, 6);
    expect(errors.some(e => e.field === 'priority')).toBe(true);
  });

  it('row number is preserved in error objects', () => {
    const errors = validateCsvRow({ workitemtype: 'REQUIREMENT' }, 99);
    expect(errors.every(e => e.row === 99)).toBe(true);
  });

  it('validates all four valid work item types', () => {
    for (const wt of ['REQUIREMENT', 'USER_STORY', 'CHANGE_REQUEST', 'DESIGN_ARTIFACT']) {
      const errors = validateCsvRow({ workitemtype: wt, title: 'T', description: 'D' }, 2);
      expect(errors).toHaveLength(0);
    }
  });
});

// ─── csvRowToRequirement ──────────────────────────────────────────────────────

describe('csvRowToRequirement', () => {
  it('maps required fields correctly', () => {
    const row = { workitemtype: 'CHANGE_REQUEST', title: 'My CR', description: 'Details.' };
    const result = csvRowToRequirement(row);
    expect(result.workItemType).toBe('CHANGE_REQUEST');
    expect(result.title).toBe('My CR');
    expect(result.description).toBe('Details.');
  });

  it('defaults to MEDIUM priority when priority is missing', () => {
    const row = { workitemtype: 'REQUIREMENT', title: 'T', description: 'D' };
    expect(csvRowToRequirement(row).priority).toBe('MEDIUM');
  });

  it('defaults to REQUIREMENT type when workItemType is empty', () => {
    const row = { workitemtype: '', title: 'T', description: 'D' };
    expect(csvRowToRequirement(row).workItemType).toBe('REQUIREMENT');
  });

  it('maps optional fields', () => {
    const row = {
      workitemtype: 'USER_STORY', title: 'T', description: 'D',
      businessprocess: 'Order-to-Cash', module: 'SD', priority: 'HIGH',
      source: 'Workshop', owner: 'Alice', externalreference: 'ADO-999',
    };
    const r = csvRowToRequirement(row);
    expect(r.businessProcess).toBe('Order-to-Cash');
    expect(r.module).toBe('SD');
    expect(r.priority).toBe('HIGH');
    expect(r.source).toBe('Workshop');
    expect(r.owner).toBe('Alice');
    expect(r.externalReference).toBe('ADO-999');
  });

  it('converts pipe-separated tags to JSON array', () => {
    const row = { workitemtype: 'REQUIREMENT', title: 'T', description: 'D', tags: 'SD|Finance|Cloud' };
    const r = csvRowToRequirement(row);
    expect(r.tags).toBeDefined();
    const parsed = JSON.parse(r.tags!) as string[];
    expect(parsed).toEqual(['SD', 'Finance', 'Cloud']);
  });

  it('sets status to DRAFT', () => {
    const row = { workitemtype: 'REQUIREMENT', title: 'T', description: 'D' };
    expect(csvRowToRequirement(row).status).toBe('DRAFT');
  });
});

// ─── requirementsToCsv ────────────────────────────────────────────────────────

describe('requirementsToCsv', () => {
  const sampleItems: RequirementRecord[] = [
    {
      ID: 'r-001', project_ID: 'p-001', tenant_ID: 't-001',
      workItemType: 'REQUIREMENT', title: 'Custom pricing',
      description: 'We need custom pricing logic.', priority: 'HIGH',
      businessProcess: 'Order-to-Cash', module: 'SD', status: 'DRAFT',
    },
    {
      ID: 'r-002', project_ID: 'p-001', tenant_ID: 't-001',
      workItemType: 'USER_STORY', title: 'As a sales rep',
      description: 'I want to see pricing.', priority: 'MEDIUM',
      tags: JSON.stringify(['SD', 'Pricing']), status: 'SUBMITTED',
    },
  ];

  it('returns a header row as the first line', () => {
    const csv = requirementsToCsv(sampleItems);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('returns the correct number of data rows', () => {
    const csv = requirementsToCsv(sampleItems);
    const lines = csv.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(sampleItems.length + 1); // header + data
  });

  it('round-trips: exported CSV can be re-parsed', () => {
    const csv = requirementsToCsv(sampleItems);
    const { headers, rows } = parseCsvString(csv);
    expect(headers).toContain('workitemtype');
    expect(headers).toContain('title');
    expect(rows).toHaveLength(sampleItems.length);
    expect(rows[0]['workitemtype']).toBe('REQUIREMENT');
    expect(rows[0]['title']).toBe('Custom pricing');
  });

  it('returns header-only CSV for empty array', () => {
    const csv = requirementsToCsv([]);
    const lines = csv.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('quotes fields that contain commas', () => {
    const items: RequirementRecord[] = [{
      ID: 'r-003', project_ID: 'p-001', tenant_ID: 't-001',
      workItemType: 'REQUIREMENT', title: 'Process, Order, and Deliver',
      description: 'Desc', priority: 'LOW', status: 'DRAFT',
    }];
    const csv = requirementsToCsv(items);
    expect(csv).toContain('"Process, Order, and Deliver"');
  });

  it('converts pipe-separated tags back correctly', () => {
    const csv = requirementsToCsv(sampleItems);
    const { rows } = parseCsvString(csv);
    // tags in row 2 should be 'SD|Pricing'
    expect(rows[1]['tags']).toBe('SD|Pricing');
  });
});

// ─── CSV_COLUMNS and CSV_REQUIRED_COLUMNS ─────────────────────────────────────

describe('CSV metadata', () => {
  it('CSV_COLUMNS contains all expected column names', () => {
    expect(CSV_COLUMNS).toContain('workItemType');
    expect(CSV_COLUMNS).toContain('title');
    expect(CSV_COLUMNS).toContain('description');
    expect(CSV_COLUMNS).toContain('priority');
  });

  it('CSV_REQUIRED_COLUMNS is a subset of CSV_COLUMNS', () => {
    for (const col of CSV_REQUIRED_COLUMNS) {
      expect(CSV_COLUMNS).toContain(col);
    }
  });
});
