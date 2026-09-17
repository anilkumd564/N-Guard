/**
 * N-Guard — Phase 2 + Phase 3 Domain Types (Service Layer)
 *
 * Typed models for the Core Domain and Deployment Profile entities.
 * These are the TypeScript interfaces that mirror the CDS schema for
 * use in service handlers, validation, and tests.
 *
 * Architecture rules:
 *  - Rule 2: S4Edition is always a discriminant; never optional in profiles.
 *  - Rule 10: Every entity carries tenant_ID and project_ID for isolation.
 *  - Rule 12: Explicit typed contracts; no any/unknown in domain logic.
 */

// ─── Edition and Release ──────────────────────────────────────────────────────

export type S4Edition = 'ON_PREMISE' | 'CLOUD_PRIVATE' | 'CLOUD_PUBLIC';

export const VALID_S4_EDITIONS: readonly S4Edition[] = [
  'ON_PREMISE',
  'CLOUD_PRIVATE',
  'CLOUD_PUBLIC',
] as const;

/** Human-readable labels for display. Never used for logic — use the enum value. */
export const S4_EDITION_LABELS: Record<S4Edition, string> = {
  ON_PREMISE    : 'SAP S/4HANA On-Premise',
  CLOUD_PRIVATE : 'SAP S/4HANA Cloud, Private Edition',
  CLOUD_PUBLIC  : 'SAP S/4HANA Cloud, Public Edition',
};

// ─── Phase 2 Enums ────────────────────────────────────────────────────────────

export type SAPProduct = 'S4HANA';
export const VALID_SAP_PRODUCTS: readonly SAPProduct[] = ['S4HANA'] as const;

export type TransformationType = 'GREENFIELD' | 'BROWNFIELD' | 'SELECTIVE' | 'OTHER';
export const VALID_TRANSFORMATION_TYPES: readonly TransformationType[] = [
  'GREENFIELD',
  'BROWNFIELD',
  'SELECTIVE',
  'OTHER',
] as const;

export type CleanCorePolicy = 'STRICT' | 'STANDARD' | 'FLEXIBLE' | 'NOT_SET';
export const VALID_CLEAN_CORE_POLICIES: readonly CleanCorePolicy[] = [
  'STRICT',
  'STANDARD',
  'FLEXIBLE',
  'NOT_SET',
] as const;

export const CLEAN_CORE_POLICY_LABELS: Record<CleanCorePolicy, string> = {
  STRICT   : 'Strict — Extensions only via BTP side-by-side',
  STANDARD : 'Standard — SAP-approved extensibility patterns',
  FLEXIBLE : 'Flexible — Project-defined governance',
  NOT_SET  : 'Not Set — Policy requires architecture decision',
};

// ─── Project Domain Model ─────────────────────────────────────────────────────

export interface ProjectRecord {
  ID                : string;
  tenant_ID         : string;
  name              : string;
  description?      : string;
  edition           : S4Edition;
  release?          : string;
  status            : string;
  transformationType? : TransformationType;
  cleanCorePolicy   : CleanCorePolicy;
  createdAt?        : string;
  modifiedAt?       : string;
}

// ─── Deployment Profile Domain Model ─────────────────────────────────────────

export interface DeploymentProfileRecord {
  ID                      : string;
  project_ID              : string;
  tenant_ID               : string;
  profileName             : string;
  sapProduct              : SAPProduct;
  deploymentModel         : S4Edition;
  release?                : string;
  releaseFrom?            : string;
  releaseTo?              : string;
  country?                : string;
  industry?               : string;
  transformationType?     : TransformationType;
  cleanCorePolicy         : CleanCorePolicy;
  processAreas?           : string;   // JSON: string[]
  sourceSystemDescription? : string;
  isPrimary               : boolean;
  isActive                : boolean;
  createdAt?              : string;
  modifiedAt?             : string;
}

// ─── User Actor Domain Model ──────────────────────────────────────────────────

export interface UserActorRecord {
  ID          : string;
  tenant_ID?  : string;
  externalId  : string;
  displayName? : string;
  email?      : string;
  roles?      : string;   // JSON: string[]
  isActive    : boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationError {
  field   : string;
  message : string;
}

export interface ValidationResult {
  valid  : boolean;
  errors : ValidationError[];
}

/**
 * Validate a project create/update payload.
 * Enforces architecture rule 2: edition must be explicitly set and valid.
 * Never applies a default edition.
 */
export function validateProject(data: Partial<ProjectRecord>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Project name is required.' });
  } else if (data.name.trim().length > 200) {
    errors.push({ field: 'name', message: 'Project name must not exceed 200 characters.' });
  }

  if (!data.edition) {
    errors.push({
      field   : 'edition',
      message : 'SAP S/4HANA edition is required. Specify ON_PREMISE, CLOUD_PRIVATE, or CLOUD_PUBLIC.',
    });
  } else if (!VALID_S4_EDITIONS.includes(data.edition)) {
    errors.push({
      field   : 'edition',
      message : `Invalid edition "${data.edition}". Must be one of: ${VALID_S4_EDITIONS.join(', ')}.`,
    });
  }

  if (data.release !== undefined && data.release !== null && data.release !== '') {
    if (!/^\d{4}(FPS\d{2})?$/.test(data.release.trim())) {
      errors.push({
        field   : 'release',
        message : 'Release must be a 4-digit year (e.g. "2024") or a year with FPS suffix (e.g. "2024FPS01").',
      });
    }
  }

  if (data.transformationType !== undefined && data.transformationType !== null) {
    if (!VALID_TRANSFORMATION_TYPES.includes(data.transformationType)) {
      errors.push({
        field   : 'transformationType',
        message : `Invalid transformation type "${data.transformationType}". Must be one of: ${VALID_TRANSFORMATION_TYPES.join(', ')}.`,
      });
    }
  }

  if (data.cleanCorePolicy !== undefined && data.cleanCorePolicy !== null) {
    if (!VALID_CLEAN_CORE_POLICIES.includes(data.cleanCorePolicy)) {
      errors.push({
        field   : 'cleanCorePolicy',
        message : `Invalid Clean Core policy "${data.cleanCorePolicy}". Must be one of: ${VALID_CLEAN_CORE_POLICIES.join(', ')}.`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a deployment profile create/update payload.
 * Enforces architecture rule 2: deploymentModel must be explicitly set.
 */
export function validateDeploymentProfile(
  data: Partial<DeploymentProfileRecord>,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.profileName || data.profileName.trim().length === 0) {
    errors.push({ field: 'profileName', message: 'Profile name is required.' });
  } else if (data.profileName.trim().length > 200) {
    errors.push({ field: 'profileName', message: 'Profile name must not exceed 200 characters.' });
  }

  if (!data.deploymentModel) {
    errors.push({
      field   : 'deploymentModel',
      message : 'Deployment model is required. Specify ON_PREMISE, CLOUD_PRIVATE, or CLOUD_PUBLIC.',
    });
  } else if (!VALID_S4_EDITIONS.includes(data.deploymentModel)) {
    errors.push({
      field   : 'deploymentModel',
      message : `Invalid deployment model "${data.deploymentModel}". Must be one of: ${VALID_S4_EDITIONS.join(', ')}.`,
    });
  }

  if (data.sapProduct !== undefined && data.sapProduct !== null) {
    if (!VALID_SAP_PRODUCTS.includes(data.sapProduct)) {
      errors.push({
        field   : 'sapProduct',
        message : `Invalid SAP product "${data.sapProduct}". Must be one of: ${VALID_SAP_PRODUCTS.join(', ')}.`,
      });
    }
  }

  if (data.release !== undefined && data.release !== null && data.release !== '') {
    if (!/^\d{4}(FPS\d{2})?$/.test(data.release.trim())) {
      errors.push({
        field   : 'release',
        message : 'Release must be a 4-digit year (e.g. "2024") or a year with FPS suffix (e.g. "2024FPS01").',
      });
    }
  }

  if (data.transformationType !== undefined && data.transformationType !== null) {
    if (!VALID_TRANSFORMATION_TYPES.includes(data.transformationType)) {
      errors.push({
        field   : 'transformationType',
        message : `Invalid transformation type "${data.transformationType}". Must be one of: ${VALID_TRANSFORMATION_TYPES.join(', ')}.`,
      });
    }
  }

  if (data.cleanCorePolicy !== undefined && data.cleanCorePolicy !== null) {
    if (!VALID_CLEAN_CORE_POLICIES.includes(data.cleanCorePolicy)) {
      errors.push({
        field   : 'cleanCorePolicy',
        message : `Invalid Clean Core policy "${data.cleanCorePolicy}". Must be one of: ${VALID_CLEAN_CORE_POLICIES.join(', ')}.`,
      });
    }
  }

  // Validate release range consistency
  if (data.releaseFrom && data.releaseTo) {
    if (data.releaseFrom > data.releaseTo) {
      errors.push({
        field   : 'releaseFrom',
        message : 'Release range start must not be later than the range end.',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse and validate process areas JSON string.
 * Returns the string array if valid, or throws a descriptive error.
 */
export function parseProcessAreas(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('processAreas must be a JSON array of strings');
    }
    return parsed.map((v) => String(v));
  } catch {
    throw new Error(`processAreas is not valid JSON: ${raw}`);
  }
}

// ─── Phase 3: Requirements Workspace ─────────────────────────────────────────

export type WorkItemType =
  | 'REQUIREMENT'
  | 'USER_STORY'
  | 'CHANGE_REQUEST'
  | 'DESIGN_ARTIFACT';

export const VALID_WORK_ITEM_TYPES: readonly WorkItemType[] = [
  'REQUIREMENT',
  'USER_STORY',
  'CHANGE_REQUEST',
  'DESIGN_ARTIFACT',
] as const;

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  REQUIREMENT    : 'Business Requirement',
  USER_STORY     : 'User Story',
  CHANGE_REQUEST : 'Change Request',
  DESIGN_ARTIFACT: 'Design Artifact',
};

export type WorkItemPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export const VALID_WORK_ITEM_PRIORITIES: readonly WorkItemPriority[] = [
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
] as const;

export type RelationType =
  | 'RELATES_TO'
  | 'BLOCKS'
  | 'DEPENDS_ON'
  | 'DUPLICATES'
  | 'CHILD_OF'
  | 'PARENT_OF';

export const VALID_RELATION_TYPES: readonly RelationType[] = [
  'RELATES_TO', 'BLOCKS', 'DEPENDS_ON', 'DUPLICATES', 'CHILD_OF', 'PARENT_OF',
] as const;

// ─── Requirement Record ───────────────────────────────────────────────────────

export interface RequirementRecord {
  ID                : string;
  project_ID        : string;
  tenant_ID         : string;
  workItemType      : WorkItemType;
  title             : string;
  description       : string;
  businessObjective?: string;
  businessProcess?  : string;
  module?           : string;
  priority          : WorkItemPriority;
  source?           : string;
  requestedBy?      : string;
  owner?            : string;
  tags?             : string;   // JSON: string[]
  externalReference?: string;
  deploymentProfile_ID?: string;
  status            : string;
  createdAt?        : string;
  modifiedAt?       : string;
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

export interface CsvImportError {
  row     : number;
  field   : string;
  message : string;
}

export interface CsvImportResult {
  imported   : number;
  errorCount : number;
  errors     : CsvImportError[];
}

/** CSV column headers that map to DesignRequests fields. */
export const CSV_COLUMNS = [
  'workItemType',
  'title',
  'description',
  'businessObjective',
  'businessProcess',
  'module',
  'priority',
  'source',
  'owner',
  'tags',
  'externalReference',
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const CSV_REQUIRED_COLUMNS: readonly CsvColumn[] = [
  'workItemType',
  'title',
  'description',
] as const;

// ─── Requirement Validation ───────────────────────────────────────────────────

/**
 * Validate a requirement create/update payload.
 * Returns all validation errors rather than stopping at the first.
 */
export function validateRequirement(
  data: Partial<RequirementRecord>,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required.' });
  } else if (data.title.trim().length > 500) {
    errors.push({ field: 'title', message: 'Title must not exceed 500 characters.' });
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required.' });
  }

  if (data.workItemType !== undefined && data.workItemType !== null) {
    if (!VALID_WORK_ITEM_TYPES.includes(data.workItemType)) {
      errors.push({
        field   : 'workItemType',
        message : `Invalid work item type "${data.workItemType}". Must be one of: ${VALID_WORK_ITEM_TYPES.join(', ')}.`,
      });
    }
  }

  if (data.priority !== undefined && data.priority !== null) {
    if (!VALID_WORK_ITEM_PRIORITIES.includes(data.priority)) {
      errors.push({
        field   : 'priority',
        message : `Invalid priority "${data.priority}". Must be one of: ${VALID_WORK_ITEM_PRIORITIES.join(', ')}.`,
      });
    }
  }

  if (data.businessObjective !== undefined && data.businessObjective !== null
      && data.businessObjective.trim().length > 1000) {
    errors.push({ field: 'businessObjective', message: 'Business objective must not exceed 1000 characters.' });
  }

  if (data.externalReference !== undefined && data.externalReference !== null
      && data.externalReference.trim().length > 300) {
    errors.push({ field: 'externalReference', message: 'External reference must not exceed 300 characters.' });
  }

  return { valid: errors.length === 0, errors };
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of row objects.
 * Handles:
 *  - Header row normalisation (case-insensitive, trims whitespace)
 *  - Quoted fields (double-quote RFC 4180)
 *  - Empty lines (skipped)
 *
 * Does NOT throw on parse errors — invalid rows are captured as CsvImportErrors.
 */
export function parseCsvString(csv: string): {
  headers : string[];
  rows    : Record<string, string>[];
} {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(nonEmpty[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = splitCsvLine(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Split a single CSV line into fields, handling RFC 4180 quoted fields.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  fields.push(current);
  return fields;
}

/**
 * Validate and convert a parsed CSV row into a RequirementRecord-shaped object.
 * Returns an array of validation errors for the row; empty array = row is valid.
 */
export function validateCsvRow(
  row    : Record<string, string>,
  rowNum : number,
): CsvImportError[] {
  const errors: CsvImportError[] = [];

  // Required fields
  if (!row['workitemtype'] && !row['workItemType'] && !row['workitemType']) {
    errors.push({ row: rowNum, field: 'workItemType', message: 'workItemType is required.' });
  } else {
    const wt = (row['workitemtype'] || row['workItemType'] || row['workitemType'] || '').toUpperCase();
    if (!VALID_WORK_ITEM_TYPES.includes(wt as WorkItemType)) {
      errors.push({
        row: rowNum, field: 'workItemType',
        message : `Invalid workItemType "${wt}". Must be one of: ${VALID_WORK_ITEM_TYPES.join(', ')}.`,
      });
    }
  }

  const title = row['title'] ?? '';
  if (!title.trim()) {
    errors.push({ row: rowNum, field: 'title', message: 'title is required.' });
  } else if (title.trim().length > 500) {
    errors.push({ row: rowNum, field: 'title', message: 'title must not exceed 500 characters.' });
  }

  const desc = row['description'] ?? '';
  if (!desc.trim()) {
    errors.push({ row: rowNum, field: 'description', message: 'description is required.' });
  }

  // Optional but validated fields
  const priority = (row['priority'] ?? '').toUpperCase();
  if (priority && !VALID_WORK_ITEM_PRIORITIES.includes(priority as WorkItemPriority)) {
    errors.push({
      row: rowNum, field: 'priority',
      message: `Invalid priority "${priority}". Must be one of: ${VALID_WORK_ITEM_PRIORITIES.join(', ')}.`,
    });
  }

  const extRef = row['externalreference'] ?? row['externalReference'] ?? '';
  if (extRef.length > 300) {
    errors.push({ row: rowNum, field: 'externalReference', message: 'externalReference must not exceed 300 characters.' });
  }

  return errors;
}

/**
 * Convert a validated CSV row to a RequirementRecord insert payload.
 * Caller must set project_ID and tenant_ID before inserting.
 */
export function csvRowToRequirement(row: Record<string, string>): Omit<RequirementRecord, 'ID' | 'project_ID' | 'tenant_ID'> {
  const get = (key: string) => (row[key.toLowerCase()] ?? row[key] ?? '').trim();
  const wt = get('workItemType').toUpperCase() as WorkItemType;
  const priority = get('priority').toUpperCase() as WorkItemPriority;
  const tagsRaw = get('tags');

  return {
    workItemType      : VALID_WORK_ITEM_TYPES.includes(wt) ? wt : 'REQUIREMENT',
    title             : get('title'),
    description       : get('description'),
    businessObjective : get('businessObjective') || undefined,
    businessProcess   : get('businessProcess') || undefined,
    module            : get('module') || undefined,
    priority          : VALID_WORK_ITEM_PRIORITIES.includes(priority) ? priority : 'MEDIUM',
    source            : get('source') || undefined,
    requestedBy       : get('requestedBy') || undefined,
    owner             : get('owner') || undefined,
    tags              : tagsRaw ? JSON.stringify(tagsRaw.split('|').map(t => t.trim()).filter(Boolean)) : undefined,
    externalReference : get('externalReference') || undefined,
    status            : 'DRAFT',
  };
}

/**
 * Build a CSV string from an array of RequirementRecord objects.
 */
export function requirementsToCsv(items: RequirementRecord[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = items.map(item => {
    const tagsStr = item.tags
      ? (JSON.parse(item.tags) as string[]).join('|')
      : '';
    return CSV_COLUMNS.map(col => {
      const val: string = col === 'tags'
        ? tagsStr
        : String((item as unknown as Record<string, unknown>)[col] ?? '');
      // Quote if contains comma, newline, or double-quote
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  return [header, ...rows].join('\n');
}
