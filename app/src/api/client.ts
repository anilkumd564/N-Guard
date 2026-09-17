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
