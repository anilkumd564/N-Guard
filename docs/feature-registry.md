# N-Guard Feature Registry

Complete catalog of all capabilities implemented across Phases 1–15.

---

## Core Services

| Capability | Phase | File(s) |
|---|---|---|
| CAP Node.js monorepo scaffolding | 1 | `package.json`, `server.ts` |
| AppService ping / info endpoints | 1 | `srv/app-service.cds`, `srv/src/handlers/app-service.ts` |
| Health / readiness probes | 14 | `srv/app-service.cds`, `srv/src/handlers/app-service.ts` |
| CDS domain schema | 1–12 | `db/schema.cds` |
| SQLite local deployment | 1 | `.cdsrc.json` |
| Docker Compose development environment | 1 | `docker-compose.yml` |

---

## Project and Deployment Management

| Capability | Phase | File(s) |
|---|---|---|
| Multi-tenant project model | 2 | `db/schema.cds` (Tenants, Projects) |
| SAP Deployment Profiles (S4HANA On-Premise, Cloud Private, Cloud Public) | 2 | `db/schema.cds` (SAPDeploymentProfiles) |
| `createProject` action with auto-tenant resolution | 2 | `srv/src/handlers/nguard-service.ts` |
| Project validation (edition, clean core policy, transformation type) | 2 | `srv/src/types/domain.ts` |
| Deployment profile validation | 2 | `srv/src/types/domain.ts` |
| ProjectsPage (list, create, edit) | 2 | `app/src/pages/ProjectsPage.tsx` |
| Project context (React global state) | 2 | `app/src/context/ProjectContext.tsx` |

---

## Requirements Workspace

| Capability | Phase | File(s) |
|---|---|---|
| DesignRequests with workItemType, priority, tags, owner | 3 | `db/schema.cds` |
| CSV requirements import | 3 | `srv/src/handlers/workspace-handler.ts` |
| CSV requirements export | 3 | `srv/src/handlers/workspace-handler.ts` |
| Duplicate detection on import | 3 | `srv/src/handlers/workspace-handler.ts` |
| RelatedWorkItems (RELATES_TO, BLOCKS, DEPENDS_ON, etc.) | 3 | `db/schema.cds` |
| RequirementsPage, RequirementDetailPage | 3 | `app/src/pages/` |

---

## Knowledge Base and Document Ingestion

| Capability | Phase | File(s) |
|---|---|---|
| KnowledgeSources (typed origins with authority level) | 4 | `db/schema.cds` |
| KnowledgeDocuments with edition/release/processArea metadata | 4 | `db/schema.cds` |
| KnowledgeChunks (denormalized for efficient retrieval) | 4 | `db/schema.cds` |
| IngestionJobs (status tracking) | 4 | `db/schema.cds` |
| Text extraction (plain text, CSV, JSON, PDF stub, DOCX stub) | 4 | `agent/src/ingestion/DocumentTextExtractor.ts` |
| Text chunking with configurable size and overlap | 4 | `agent/src/ingestion/TextChunker.ts` |
| IngestionService (end-to-end document pipeline) | 4 | `agent/src/ingestion/IngestionService.ts` |
| Local file storage provider | 4 | `agent/src/storage/LocalFileStorageProvider.ts` |
| KnowledgePage (upload, list, chunk preview) | 4 | `app/src/pages/KnowledgePage.tsx` |

---

## Vector Knowledge Retrieval

| Capability | Phase | File(s) |
|---|---|---|
| VectorStore abstraction (replaceable — MockVectorStore in dev) | 1/5 | `agent/src/vector/VectorStore.ts` |
| Tenant/edition/release/processArea metadata filtering | 5 | `agent/src/retrieval/KnowledgeSearchService.ts` |
| Cross-edition parallel evidence search | 5 | `agent/src/retrieval/KnowledgeSearchService.ts` |
| Evidence isolation (wrong-tenant data never returned) | 5 | `agent/src/retrieval/KnowledgeSearchService.ts` |

---

## AI Agent Orchestration

| Capability | Phase | File(s) |
|---|---|---|
| AgentEngine (Mock AI, structured output) | 1 | `agent/src/engine/AgentEngine.ts` |
| AgentOrchestrator (structured validation, retry, evidence tracing) | 6 | `agent/src/orchestration/AgentOrchestrator.ts` |
| AgentRuns persistence (every run audited) | 6 | `db/schema.cds` |
| EvidenceReferences (chunkId traceable to source document) | 6 | `db/schema.cds` |
| Schema validation on LLM output (F8/NEEDS_REVIEW safe default) | 6/7 | `agent/src/assessment/FitAssessmentEngine.ts` |

---

## Fit-to-Standard Assessment (F1-F8)

| Capability | Phase | File(s) |
|---|---|---|
| F1-F8 classification framework | 7 | `agent/src/assessment/types.ts` |
| FitAssessmentEngine (structured F1-F8 output with evidence) | 7 | `agent/src/assessment/FitAssessmentEngine.ts` |
| DeploymentCompatibility codes (DP-OP, DP-PCE, DP-PUB, DP-ALL) | 7 | `agent/src/assessment/types.ts` |
| EvidenceConfidence (VERIFIED, LIKELY, NEEDS_SME_REVIEW, INSUFFICIENT) | 7 | `agent/src/assessment/types.ts` |
| `submitForAssessment` CAP action | 7 | `srv/src/handlers/nguard-service.ts` |
| Recommendations (per-assessment, sequenced) | 7 | `db/schema.cds` |
| AssessmentPage, AssessmentsPage | 7 | `app/src/pages/` |

---

## Cross-Edition Comparison

| Capability | Phase | File(s) |
|---|---|---|
| Parallel assessment across all three S/4HANA editions | 8 | `agent/src/comparison/CrossEditionComparisonEngine.ts` |
| Evidence partitioned per edition (rule 2) | 8 | `agent/src/comparison/CrossEditionComparisonEngine.ts` |
| CrossEditionComparisons + EditionComparisonResults persistence | 8 | `db/schema.cds` |
| `runCrossEditionComparison` CAP action | 8 | `srv/src/handlers/nguard-service.ts` |
| CompareEditionsPage | 8 | `app/src/pages/CompareEditionsPage.tsx` |

---

## Clean Core Governance

| Capability | Phase | File(s) |
|---|---|---|
| Clean Core tier classification (TIER_1–4) | 9 | `agent/src/cleancore/types.ts` |
| 6 extensibility techniques with tier mapping | 9 | `agent/src/cleancore/catalog.ts` |
| Versioned rule catalog v1.0 | 9 | `agent/src/cleancore/catalog.ts` |
| CleanCoreAnalyzer (deterministic — no LLM required) | 9 | `agent/src/cleancore/CleanCoreAnalyzer.ts` |
| CleanCoreAnalyses persistence | 9 | `db/schema.cds` |
| `runCleanCoreAnalysis` CAP action | 9 | `srv/src/handlers/nguard-service.ts` |
| CleanCorePage | 9 | `app/src/pages/CleanCorePage.tsx` |

---

## Human Review Workflow

| Capability | Phase | File(s) |
|---|---|---|
| ReviewStatus (10 states) and ReviewAction (7 actions) state machine | 10 | `agent/src/review/types.ts` |
| `isAIFinalApprover: false` TypeScript literal (rule 5) | 10 | `agent/src/review/types.ts`, `db/schema.cds` |
| Rationale enforcement for APPROVE_EXCEPTION and REJECT_CUSTOMIZATION | 10 | `srv/src/handlers/nguard-service.ts` |
| Actor='AI' → HTTP 403 rejection | 10 | `srv/src/handlers/nguard-service.ts` |
| DesignDecisions entity (insert-only audit trail) | 10 | `db/schema.cds` |
| `submitForReview`, `recordReviewDecision` CAP actions | 10 | `srv/src/handlers/nguard-service.ts` |
| Design Decision / Exception Register page | 10 | `app/src/pages/DecisionsPage.tsx` |

---

## Dashboards and Reporting

| Capability | Phase | File(s) |
|---|---|---|
| `getDashboardStats` (F1-F8 dist, confidence dist, Clean Core tiers, review queue) | 11 | `srv/src/handlers/dashboard-handler.ts` |
| Governance dashboard with inline bar charts | 11 | `app/src/pages/DashboardPage.tsx` |
| Assessment coverage progress bar | 11 | `app/src/pages/DashboardPage.tsx` |
| `exportAssessmentsCSV` (every row traces to ComplianceAssessment ID) | 11 | `srv/src/handlers/dashboard-handler.ts` |
| `exportDecisionsCSV` (full audit trail — actor, timestamp, prior/new state) | 11 | `srv/src/handlers/dashboard-handler.ts` |
| ReportsPage with data integrity notice | 11 | `app/src/pages/ReportsPage.tsx` |

---

## Integrations and Async Jobs

| Capability | Phase | File(s) |
|---|---|---|
| AsyncJobQueue (replaceable — local → BTP Job Scheduling) | 12 | `agent/src/jobs/AsyncJobQueue.ts` |
| 5 job types (DOCUMENT_INGESTION, BULK_IMPORT, BATCH_ASSESSMENT, KNOWLEDGE_REINDEX, INTEGRATION_SYNC) | 12 | `agent/src/jobs/types.ts` |
| Job cancel, retry, exponential back-off | 12 | `agent/src/jobs/AsyncJobQueue.ts` |
| Integration health check for 6 targets (returns NOT_CONFIGURED for uncredentialed) | 12 | `agent/src/jobs/AsyncJobQueue.ts` |
| AsyncJobs DB persistence | 12 | `db/schema.cds` |
| AdminPage (job queue + integration health UI) | 12 | `app/src/pages/AdminPage.tsx` |

---

## Security

| Capability | Phase | File(s) |
|---|---|---|
| RBAC model: 6 roles, 16 permissions, server-side enforcement | 13 | `agent/src/security/types.ts` |
| `hasPermission()` and `hasRole()` functions | 13 | `agent/src/security/types.ts` |
| File type allowlist (7 MIME types) | 13 | `agent/src/security/types.ts` |
| File size limit (10 MB default, configurable) | 13 | `agent/src/security/types.ts` |
| Filename sanitization (path traversal, null bytes) | 13 | `agent/src/security/types.ts` |
| Secret redaction for logs (Bearer, API keys, passwords, PATs) | 13 | `agent/src/security/types.ts` |
| Threat model documentation (9 threats, mitigations) | 13 | `docs/threat-model.md` |

---

## BTP Deployment

| Capability | Phase | File(s) |
|---|---|---|
| XSUAA security descriptor (6 scopes, 6 role-templates, 6 role-collections) | 14 | `xs-security.json` |
| MTA deployment descriptor (srv + app modules, 4 resources) | 14 | `mta.yaml` |
| Production environment variable reference | 14 | `.env.production.example` |
| Deployment runbook (9 sections) | 14 | `docs/deployment-runbook.md` |

---

## Test Coverage

| Suite | Tests | Phase |
|---|---|---|
| `srv/__tests__/app-service.test.ts` | 9 | 1/14/15 |
| `srv/__tests__/deployment-profile.test.ts` | 20 | 2 |
| `srv/__tests__/requirements-workspace.test.ts` | 88 | 3 |
| `srv/__tests__/e2e-workflow.test.ts` | 31 | 15 |
| `agent/__tests__/agent-engine.test.ts` | 8 | 1 |
| `agent/__tests__/knowledge-ingestion.test.ts` | 22 | 4 |
| `agent/__tests__/knowledge-search.test.ts` | 22 | 5 |
| `agent/__tests__/agent-orchestrator.test.ts` | 26 | 6 |
| `agent/__tests__/fit-assessment.test.ts` | 32 | 7 |
| `agent/__tests__/cross-edition-comparison.test.ts` | 24 | 8 |
| `agent/__tests__/cleancore.test.ts` | 20 | 9 |
| `agent/__tests__/review-workflow.test.ts` | 28 | 10 |
| `agent/__tests__/async-job-queue.test.ts` | 22 | 12 |
| `agent/__tests__/security.test.ts` | 38 | 13 |
| **Total** | **437** | |

---

*Document version: 1.0 — Phase 15 — N-Guard*
