# Changelog — N-Guard

All notable changes are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions correspond to implementation phases.

---

## [0.15.0] — Phase 15: End-to-End Validation and Release Candidate

### Added
- End-to-end governance workflow test suite (10 workflow steps, 34 tests)
- `WorkflowFixture` — in-memory workflow harness covering create→import→assess→review→export→dashboard
- `docs/feature-registry.md` — complete capability registry (phases 1–15)
- `CHANGELOG.md` (this file)
- Updated `README.md` with final project state

### Changed
- Phase label updated to Phase 15

---

## [0.14.0] — Phase 14: BTP Deployment Preparation

### Added
- `mta.yaml` — MTA 3.3 deployment descriptor (2 modules: srv, app; 4 resources: xsuaa, hana, destination, aicore)
- `xs-security.json` — XSUAA descriptor with 6 scopes, 6 role-templates, 6 role-collections
- `.env.production.example` — production environment variable reference (all placeholders, no real credentials)
- `health()` and `ready()` endpoints on AppService (liveness + readiness probes)
- `docs/deployment-runbook.md` — 9-section deployment guide (setup, build, deploy, validation, HANA migration, rollback, monitoring)

### Changed
- `srv/app-service.cds` — added `health()` and `ready()` function declarations
- Health/ready handler tests added to app-service.test.ts

---

## [0.13.0] — Phase 13: Security, Tenant Isolation, and Production Controls

### Added
- `agent/src/security/types.ts` — `NGuardRole` (6 roles), `NGuardPermission` (16 permissions), `ROLE_PERMISSIONS` matrix, `hasPermission()`, `hasRole()`, `validateUpload()`, `sanitizeFilename()`, `redactSecrets()`
- `agent/src/__tests__/security.test.ts` — 38 security tests (RBAC, file validation, path traversal, secret redaction, cross-tenant isolation)
- `docs/threat-model.md` — 9 threat scenarios with mitigations and residual risk table

### Changed
- `agent/src/index.ts` — exported all Phase 13 security functions and types

---

## [0.12.0] — Phase 12: Integrations and Asynchronous Jobs

### Added
- `agent/src/jobs/types.ts` — `JobType` (5), `JobStatus` (6), `AsyncJob`, `IntegrationHealth`, `IntegrationHealthStatus`
- `agent/src/jobs/AsyncJobQueue.ts` — replaceable job queue (submit/cancel/retry, exponential back-off, onStateChange callback); `checkIntegrationHealth()` for 6 integration targets
- `agent/src/__tests__/async-job-queue.test.ts` — 22 tests
- `AsyncJobs` entity in `db/schema.cds`
- `submitJob`, `cancelJob`, `retryJob`, `getIntegrationHealth` CAP actions
- `app/src/pages/AdminPage.tsx` — job queue + integration health UI

### Changed
- `srv/nguard-service.cds` — added AsyncJobs projection + 4 new actions
- `app/src/api/client.ts` — 5 new client functions

---

## [0.11.0] — Phase 11: Dashboards, Audit, and Reporting

### Added
- `srv/src/handlers/dashboard-handler.ts` — `getDashboardStats`, `exportAssessmentsCSV`, `exportDecisionsCSV`
- `app/src/pages/DashboardPage.tsx` — real-data governance dashboard (8 metric cards, 4 inline bar charts, coverage bar)
- `app/src/pages/ReportsPage.tsx` — CSV export with data integrity notice

### Changed
- `srv/nguard-service.cds` — 3 new actions (getDashboardStats, exportAssessmentsCSV, exportDecisionsCSV)
- `app/src/types/api.ts` — added `DashboardStats`

---

## [0.10.0] — Phase 10: Evidence, Confidence, and Human Review

### Added
- `agent/src/review/types.ts` — `ReviewStatus` (10 states), `ReviewAction` (7 actions), `ACTION_NEXT_STATUS` state machine, `RATIONALE_REQUIRED` map, `isAIFinalApprover: false` literal
- `agent/src/__tests__/review-workflow.test.ts` — 28 tests
- `DesignDecisions` entity in `db/schema.cds` (isAIFinalApprover always false)
- `submitForReview`, `recordReviewDecision` CAP actions (actor='AI' → 403, rationale enforcement)
- `app/src/pages/DecisionsPage.tsx` — Design Decision / Exception Register

---

## [0.9.0] — Phase 9: Clean Core and Extensibility Governance

### Added
- `agent/src/cleancore/types.ts` — `CleanCoreTier`, `CleanCoreRisk`, `ExtensibilityTechnique`, `TECHNIQUE_TIER`
- `agent/src/cleancore/catalog.ts` — versioned rule catalog v1.0 (6 techniques, 2 editions)
- `agent/src/cleancore/CleanCoreAnalyzer.ts` — deterministic analysis engine (no LLM required)
- `agent/src/__tests__/cleancore.test.ts` — 20 tests
- `CleanCoreAnalyses` entity + `runCleanCoreAnalysis` action
- `app/src/pages/CleanCorePage.tsx`

---

## [0.8.0] — Phase 8: Cross-Edition S/4HANA Comparison

### Added
- `agent/src/comparison/types.ts` — `CrossEditionComparisonResult`, `EditionComparisonResult`
- `agent/src/comparison/CrossEditionComparisonEngine.ts` — parallel 3-edition assessment
- `agent/src/__tests__/cross-edition-comparison.test.ts` — 24 tests
- `CrossEditionComparisons`, `EditionComparisonResults` entities
- `runCrossEditionComparison` action
- `app/src/pages/CompareEditionsPage.tsx`

---

## [0.7.0] — Phase 7: Fit-to-Standard Assessment Engine

### Added
- `agent/src/assessment/types.ts` — `FitClassification` (F1-F8), `DeploymentCompatibilityCode`, `EvidenceConfidence`
- `agent/src/assessment/FitAssessmentEngine.ts` — structured F1-F8 assessment with schema validation
- `agent/src/assessment/MockFitAIProvider.ts`
- `agent/src/__tests__/fit-assessment.test.ts` — 32 tests
- Phase 7 fields on `ComplianceAssessments` entity
- `app/src/pages/AssessmentPage.tsx`

---

## [0.6.0] — Phase 6: Agent Orchestration Core

### Added
- `agent/src/orchestration/AgentOrchestrator.ts` — structured output validation, retry logic, evidence traceability
- `agent/src/orchestration/types.ts` — `AgentRun`, `EvidenceReference`, `StructuredAgentResult`
- `agent/src/__tests__/agent-orchestrator.test.ts` — 26 tests
- `AgentRuns`, `EvidenceReferences` entities
- `app/src/pages/AssessmentsPage.tsx`

---

## [0.5.0] — Phase 5: Vector Knowledge Retrieval

### Added
- `agent/src/retrieval/KnowledgeSearchService.ts` — tenant/edition/release-filtered semantic search
- `agent/src/__tests__/knowledge-search.test.ts` — 22 tests
- Vector retrieval integrated into assessment pipeline

---

## [0.4.0] — Phase 4: Knowledge Base and Document Ingestion

### Added
- `agent/src/ingestion/` — `DocumentTextExtractor`, `TextChunker`, `IngestionService`
- `agent/src/storage/LocalFileStorageProvider.ts`
- `agent/src/__tests__/knowledge-ingestion.test.ts` — 22 tests
- `KnowledgeSources`, `KnowledgeDocuments`, `KnowledgeChunks`, `IngestionJobs` entities
- `createKnowledgeSource`, `ingestDocument`, `deleteKnowledgeSource`, `deleteKnowledgeDocument` actions
- `app/src/pages/KnowledgePage.tsx`

---

## [0.3.0] — Phase 3: Requirements Workspace

### Added
- `srv/src/handlers/workspace-handler.ts` — CSV import/export, duplicate detection, validation
- `srv/__tests__/requirements-workspace.test.ts` — 80+ tests
- `DesignRequests` enhanced with `workItemType`, `priority`, `tags`, `owner`, `externalReference`
- `RelatedWorkItems` entity
- `importRequirements`, `exportRequirements` actions
- `app/src/pages/RequirementsPage.tsx`, `RequirementDetailPage.tsx`, `DesignRequestsPage.tsx`

---

## [0.2.0] — Phase 2: Project and Deployment Profile Management

### Added
- `SAPDeploymentProfiles`, `UserActors` entities
- `createProject` action (single-call with profile auto-creation)
- `SAPProduct`, `TransformationType`, `CleanCorePolicy` types
- `srv/__tests__/deployment-profile.test.ts` — 20 tests
- `app/src/pages/ProjectsPage.tsx`, `ProjectForm.tsx`, `ProjectContext.tsx`

---

## [0.1.0] — Phase 1: Foundational Architecture and Connectivity

### Added
- CAP Node.js monorepo scaffolding (`srv`, `agent`, `app` workspaces)
- `AppService` with `ping` and `info` endpoints
- `db/schema.cds` — core domain model (Tenants, Projects, DesignRequests, ComplianceAssessments)
- `agent/src/engine/AgentEngine.ts`, `MockAIProvider`, `MockVectorStore`
- `agent/src/__tests__/agent-engine.test.ts`
- React 18 + TypeScript frontend scaffold
- Docker Compose configuration
- `docs/architecture.md`

---

*N-Guard — SAP Fit-to-Standard Compliance Agent*
