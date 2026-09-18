/**
 * N-Guard Frontend — API Client
 *
 * Thin wrapper around fetch() for calling the CAP OData/REST endpoints.
 * All requests go to /api/v1 (proxied to CAP on port 4004 in development).
 *
 * Phase 2 additions:
 *  - createProject action (single-call with deployment profile)
 *  - listProjects / getProject / updateProject / deleteProject
 *  - listDeploymentProfiles / createDeploymentProfile / updateDeploymentProfile
 *  - listTenants
 */

import type {
  Project,
  SAPDeploymentProfile,
  Tenant,
  DesignRequest,
  ComplianceAssessment,
  CreateProjectPayload,
  CsvImportResult,
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  IngestionJob,
  ODataListResponse,
} from '../types/api.js';

const BASE = '/api/v1';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept'      : 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function listTenants(): Promise<Tenant[]> {
  const data = await request<ODataListResponse<Tenant>>('/Tenants');
  return data.value;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const data = await request<ODataListResponse<Project>>(
    '/Projects?$orderby=createdAt desc',
  );
  return data.value;
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(
    `/Projects(${id})?$expand=deploymentProfiles`,
  );
}

/**
 * Create a project with its initial deployment profile.
 * Uses the createProject unbound action which handles tenant auto-resolution.
 */
export async function createProject(
  payload: CreateProjectPayload,
): Promise<Project> {
  const result = await request<{ value: Project }>(
    '/createProject',
    {
      method : 'POST',
      body   : JSON.stringify(payload),
    },
  );
  return result.value;
}

export async function updateProject(
  id      : string,
  payload : Partial<Pick<Project, 'name' | 'description' | 'edition' | 'release' | 'transformationType' | 'cleanCorePolicy' | 'status'>>,
): Promise<void> {
  await request<void>(`/Projects(${id})`, {
    method : 'PATCH',
    body   : JSON.stringify(payload),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request<void>(`/Projects(${id})`, { method: 'DELETE' });
}

// ─── Deployment Profiles ──────────────────────────────────────────────────────

export async function listDeploymentProfiles(projectId: string): Promise<SAPDeploymentProfile[]> {
  const encoded = encodeURIComponent(`project_ID eq ${projectId}`);
  const data = await request<ODataListResponse<SAPDeploymentProfile>>(
    `/SAPDeploymentProfiles?$filter=${encoded}&$orderby=isPrimary desc,createdAt asc`,
  );
  return data.value;
}

export async function createDeploymentProfile(
  payload: Omit<SAPDeploymentProfile, 'ID' | 'createdAt' | 'modifiedAt'>,
): Promise<SAPDeploymentProfile> {
  return request<SAPDeploymentProfile>('/SAPDeploymentProfiles', {
    method : 'POST',
    body   : JSON.stringify(payload),
  });
}

export async function updateDeploymentProfile(
  id      : string,
  payload : Partial<SAPDeploymentProfile>,
): Promise<void> {
  await request<void>(`/SAPDeploymentProfiles(${id})`, {
    method : 'PATCH',
    body   : JSON.stringify(payload),
  });
}

export async function deleteDeploymentProfile(id: string): Promise<void> {
  await request<void>(`/SAPDeploymentProfiles(${id})`, { method: 'DELETE' });
}

// ─── Design Requests ──────────────────────────────────────────────────────────

export async function listDesignRequests(projectId?: string): Promise<DesignRequest[]> {
  const filter = projectId
    ? `?$filter=project_ID eq ${projectId}`
    : '';
  const data = await request<ODataListResponse<DesignRequest>>(`/DesignRequests${filter}`);
  return data.value;
}

export async function getDesignRequest(id: string): Promise<DesignRequest> {
  return request<DesignRequest>(`/DesignRequests(${id})`);
}

export async function getDesignRequestById(id: string): Promise<DesignRequest> {
  return request<DesignRequest>(`/DesignRequests(${id})`);
}

export async function createDesignRequest(
  payload: Omit<DesignRequest, 'ID' | 'createdAt' | 'modifiedAt' | 'status'>,
): Promise<DesignRequest> {
  return request<DesignRequest>('/DesignRequests', {
    method : 'POST',
    body   : JSON.stringify(payload),
  });
}

export async function updateDesignRequest(
  id      : string,
  payload : Partial<Omit<DesignRequest, 'ID' | 'createdAt' | 'modifiedAt' | 'project_ID' | 'tenant_ID'>>,
): Promise<void> {
  await request<void>(`/DesignRequests(${id})`, {
    method : 'PATCH',
    body   : JSON.stringify(payload),
  });
}

export async function deleteDesignRequest(id: string): Promise<void> {
  await request<void>(`/DesignRequests(${id})`, { method: 'DELETE' });
}

export async function importRequirements(
  projectId : string,
  csv       : string,
): Promise<CsvImportResult> {
  const result = await request<{ value: CsvImportResult }>(
    '/importRequirements',
    {
      method : 'POST',
      body   : JSON.stringify({ projectId, csv }),
    },
  );
  return result.value;
}

export async function exportRequirements(
  projectId    : string,
  workItemType?: string,
): Promise<string> {
  const result = await request<{ value: string }>(
    '/exportRequirements',
    {
      method : 'POST',
      body   : JSON.stringify({ projectId, workItemType: workItemType ?? null }),
    },
  );
  return result.value;
}

// ─── Knowledge Sources ────────────────────────────────────────────────────────

export async function listKnowledgeSources(projectId?: string): Promise<KnowledgeSource[]> {
  const filter = projectId ? `?$filter=project_ID eq ${projectId}` : '';
  const data = await request<ODataListResponse<KnowledgeSource>>(`/KnowledgeSources${filter}`);
  return data.value;
}

export async function createKnowledgeSource(payload: {
  name: string; description?: string; sourceType?: string;
  authorityLevel?: string; baseUrl?: string; projectId?: string;
}): Promise<KnowledgeSource> {
  const result = await request<{ value: KnowledgeSource }>('/createKnowledgeSource', {
    method: 'POST', body: JSON.stringify(payload),
  });
  return result.value;
}

export async function deleteKnowledgeSource(knowledgeSourceId: string): Promise<boolean> {
  const result = await request<{ value: boolean }>('/deleteKnowledgeSource', {
    method: 'POST', body: JSON.stringify({ knowledgeSourceId }),
  });
  return result.value;
}

// ─── Knowledge Documents ──────────────────────────────────────────────────────

export async function listKnowledgeDocuments(knowledgeSourceId?: string): Promise<KnowledgeDocument[]> {
  const filter = knowledgeSourceId
    ? `?$filter=knowledgeSource_ID eq ${knowledgeSourceId}&$orderby=createdAt desc`
    : '?$orderby=createdAt desc';
  const data = await request<ODataListResponse<KnowledgeDocument>>(`/KnowledgeDocuments${filter}`);
  return data.value;
}

export async function deleteKnowledgeDocument(documentId: string): Promise<boolean> {
  const result = await request<{ value: boolean }>('/deleteKnowledgeDocument', {
    method: 'POST', body: JSON.stringify({ documentId }),
  });
  return result.value;
}

export async function listKnowledgeChunks(documentId: string): Promise<KnowledgeChunk[]> {
  const encoded = encodeURIComponent(`document_ID eq ${documentId}`);
  const data = await request<ODataListResponse<KnowledgeChunk>>(
    `/KnowledgeChunks?$filter=${encoded}&$orderby=sequence asc`
  );
  return data.value;
}

export async function listIngestionJobs(knowledgeSourceId?: string): Promise<IngestionJob[]> {
  const filter = knowledgeSourceId
    ? `?$filter=knowledgeSource_ID eq ${knowledgeSourceId}&$orderby=createdAt desc`
    : '?$orderby=createdAt desc';
  const data = await request<ODataListResponse<IngestionJob>>(`/IngestionJobs${filter}`);
  return data.value;
}

/**
 * Ingest a document from a File object.
 * Reads the file as ArrayBuffer, encodes to Base64, and posts to the
 * ingestDocument action. Returns the created IngestionJob.
 */
export async function ingestDocument(payload: {
  knowledgeSourceId : string;
  file              : File;
  title             : string;
  edition?          : string;
  release?          : string;
  country?          : string;
  industry?         : string;
  processArea?      : string;
  scopeItem?        : string;
  authorityLevel?   : string;
  docType?          : string;
  language?         : string;
}): Promise<IngestionJob> {
  const arrayBuffer = await payload.file.arrayBuffer();
  const uint8       = new Uint8Array(arrayBuffer);
  const base64      = btoa(String.fromCharCode(...uint8));

  const result = await request<{ value: IngestionJob }>('/ingestDocument', {
    method: 'POST',
    body  : JSON.stringify({
      knowledgeSourceId : payload.knowledgeSourceId,
      fileName          : payload.file.name,
      mimeType          : payload.file.type || 'application/octet-stream',
      contentBase64     : base64,
      title             : payload.title,
      edition           : payload.edition,
      release           : payload.release,
      country           : payload.country,
      industry          : payload.industry,
      processArea       : payload.processArea,
      scopeItem         : payload.scopeItem,
      authorityLevel    : payload.authorityLevel,
      docType           : payload.docType,
      language          : payload.language ?? 'EN',
    }),
  });
  return result.value;
}

// ─── Assessment Actions ───────────────────────────────────────────────────────

export async function submitForAssessment(
  designRequestId: string,
): Promise<ComplianceAssessment> {
  const result = await request<{ value: ComplianceAssessment }>(
    '/submitForAssessment',
    {
      method : 'POST',
      body   : JSON.stringify({ designRequestId }),
    },
  );
  return result.value;
}

export async function approveAssessment(
  assessmentId: string,
  notes?: string,
): Promise<boolean> {
  const result = await request<{ value: boolean }>(
    '/approveAssessment',
    {
      method : 'POST',
      body   : JSON.stringify({ assessmentId, notes }),
    },
  );
  return result.value;
}

export async function rejectAssessment(
  assessmentId: string,
  reason?: string,
): Promise<boolean> {
  const result = await request<{ value: boolean }>(
    '/rejectAssessment',
    {
      method : 'POST',
      body   : JSON.stringify({ assessmentId, reason }),
    },
  );
  return result.value;
}

// ─── Assessments ──────────────────────────────────────────────────────────────

export async function getAssessment(id: string): Promise<ComplianceAssessment> {
  return request<ComplianceAssessment>(
    `/ComplianceAssessments(${id})?$expand=recommendations`,
  );
}

// ─── Cross-Edition Comparison ─────────────────────────────────────────────────

export async function runCrossEditionComparison(
  designRequestId: string,
): Promise<import('../types/api.js').CrossEditionComparison> {
  const result = await request<{ value: import('../types/api.js').CrossEditionComparison }>(
    '/runCrossEditionComparison',
    { method: 'POST', body: JSON.stringify({ designRequestId }) },
  );
  return result.value;
}

export async function listCrossEditionComparisons(
  designRequestId?: string,
): Promise<import('../types/api.js').CrossEditionComparison[]> {
  const filter = designRequestId
    ? `?$filter=designRequest_ID eq ${designRequestId}&$orderby=createdAt desc`
    : '?$orderby=createdAt desc';
  const data = await request<import('../types/api.js').ODataListResponse<import('../types/api.js').CrossEditionComparison>>(
    `/CrossEditionComparisons${filter}`,
  );
  return data.value;
}

export async function listEditionComparisonResults(
  comparisonId: string,
): Promise<import('../types/api.js').EditionComparisonResult[]> {
  const filter = encodeURIComponent(`comparison_ID eq ${comparisonId}`);
  const data = await request<import('../types/api.js').ODataListResponse<import('../types/api.js').EditionComparisonResult>>(
    `/EditionComparisonResults?$filter=${filter}`,
  );
  return data.value;
}

export async function listAssessments(
  designRequestId?: string,
): Promise<ComplianceAssessment[]> {
  const filter = designRequestId
    ? `?$filter=designRequest_ID eq ${designRequestId}`
    : '';
  const data = await request<ODataListResponse<ComplianceAssessment>>(
    `/ComplianceAssessments${filter}`,
  );
  return data.value;
}
