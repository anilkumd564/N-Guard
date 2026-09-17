# N-Guard VS Code Development Prompts

Use these prompts one phase at a time in a VS Code coding agent. For a new coding session, paste the **Master Context Prompt** first, then the prompt for the phase you want to execute. Commit or checkpoint the repository after every successfully validated phase.

---

## Master Context Prompt

```text
You are the senior product architect, SAP solution architect, AI architect, and lead TypeScript engineer for a product named:

N-Guard — Fit-to-Standard Compliance Agent
Tagline: AI-powered governance that challenges unnecessary customization before it enters the SAP solution.

N-Guard is a generic web-based SAP design-governance application with an embedded AI agent. It evaluates business requirements, user stories, change requests, and design decisions against applicable SAP standard capabilities, SAP best-practice guidance, Clean Core principles, and project-specific governance.

N-Guard MUST support and compare:
- SAP S/4HANA On-Premise
- SAP S/4HANA Cloud Private Edition
- SAP S/4HANA Cloud Public Edition

It must be deployment-model aware but deployment-model independent. It must also be release-aware and able to carry country/localization, industry, and scope metadata when applicable.

Target technology direction:
- VS Code for development
- React + TypeScript frontend
- SAP CAP + Node.js + TypeScript backend
- Modular TypeScript Agent Engine independent of CAP request handlers
- SQLite for the earliest local-development stages; PostgreSQL/pgvector may be introduced for richer local retrieval development
- SAP HANA Cloud + HANA Vector Engine for the BTP production target
- AIProvider abstraction, with SAP AI Core / Generative AI Hub as the preferred BTP production provider
- KnowledgeProvider, VectorStore, FileStorage, AuthProvider, and IntegrationProvider abstractions
- Docker/Docker Compose for local or shared-VM deployment when useful
- SAP BTP Cloud Foundry as the production target
- MTA packaging for BTP deployment
- XSUAA / enterprise identity integration for BTP security
- Destination Service for external connections
- SAP Cloud Connector + Connectivity Service for on-premise SAP access when needed

Permanent architecture rules:
1. Do not hard-code a single S/4HANA edition into domain logic.
2. Never infer that functionality available in one edition/release is automatically available in another.
3. Filter knowledge by tenant/project and applicable edition/release metadata before semantic/vector retrieval.
4. Every recommendation must support evidence references and a confidence classification.
5. Human reviewers remain the final design authority; AI recommendations must never auto-approve architecture exceptions.
6. Keep the Agent Engine independent of CAP transport/request handlers.
7. Do not call an LLM vendor directly from business/domain code. Route all model calls through AIProvider.
8. Do not depend on local filesystem persistence in production design. Local development adapters are allowed behind interfaces.
9. Design application services to be stateless and horizontally scalable.
10. Include tenant_id and project_id in data ownership and retrieval boundaries from the beginning.
11. Never put secrets, API keys, credentials, passwords, or customer data into source control.
12. Prefer typed contracts, explicit schemas, deterministic validation, and structured AI outputs.
13. Avoid premature microservices. Start as a modular monolith with clear boundaries.
14. Avoid Kubernetes for the initial product; Cloud Foundry is the target managed runtime.
15. Do not invent SAP APIs, service names, library APIs, or package capabilities. Inspect installed package versions and use compatible documented patterns.

Fit classification model:
F1 Standard Fit
F2 Configuration Fit
F3 Standard + Minor Extension
F4 Clean Core Extension
F5 Standardization Opportunity
F6 Potential Customization Risk
F7 Legitimate Business Differentiator
F8 Insufficient Evidence

Deployment compatibility model:
DP-OP = S/4HANA On-Premise
DP-PCE = S/4HANA Cloud Private Edition
DP-PUB = S/4HANA Cloud Public Edition
DP-ALL = Applicable across editions
DP-NA = Not applicable
DP-VERIFY = Requires edition/release verification

Evidence confidence model:
Verified
Likely
Needs SME Review
Insufficient Evidence

Working method for every phase:
- Inspect the existing repository before making changes.
- Preserve working code and prior architectural decisions.
- Implement only the requested phase; do not implement future phases unless a tiny interface/stub is essential.
- If a dependency is unavailable, create an explicit adapter/stub and document the gap rather than faking production behavior.
- Add or update automated tests for the phase.
- Run lint, tests, type-check, and build before declaring the phase complete.
- Update relevant architecture/developer documentation.
- At completion, report: files created/modified, commands run, test/build results, assumptions, unresolved issues, and the recommended next phase.
- Stop after completing the requested phase.
```

---

## Phase 0 — Foundation and Engineering Guardrails

```text
Using the N-Guard Master Context, establish the project foundation only.

If the repository is empty, initialize it. If a repository already exists, do not create another repository and do not remove existing content unless clearly obsolete and safe to replace.

Create a clean repository structure suitable for React + TypeScript + SAP CAP/Node.js + TypeScript, with clear locations for app, srv, db, shared code, tests, and docs. Establish root-level npm scripts and workspace/package conventions that can grow into the full application.

Create architecture documentation that records:
- N-Guard product purpose and tagline
- supported S/4HANA deployment models
- BTP Cloud Foundry as the production target
- stateless application rule
- provider abstractions for AI, knowledge, vector search, files, auth, and integrations
- tenant/project isolation
- evidence-first AI design
- human-in-the-loop governance
- local-development versus BTP-production architecture

Add baseline engineering configuration for TypeScript, linting, formatting, environment-variable examples, Git ignore rules, and test framework selection. Do not add real credentials.

Do not build business functionality, AI functionality, SAP connectivity, RAG, or BTP service bindings yet.

Acceptance criteria:
- repository installs cleanly
- root development scripts are coherent
- TypeScript/lint/test baseline executes
- architecture documentation clearly captures the permanent design rules
- no secrets or machine-specific absolute paths exist

Stop when the foundation is stable and report the exact next command a developer should run.
```

---

## Phase 1 — Application Shell and Local Developer Experience

```text
Using the existing N-Guard repository and Master Context, build the local application shell.

Create a React + TypeScript web application with a professional enterprise layout and responsive navigation. Include placeholder routes for Dashboard, Projects, Requirements, Assessments, Compare Editions, Clean Core, Decisions, Knowledge, Reports, and Administration. Do not implement the business features behind those routes yet.

Create the SAP CAP Node.js backend using the TypeScript pattern compatible with the installed CAP version. Add a health/readiness endpoint and a minimal service that proves frontend-to-backend connectivity.

Use SQLite only as a simple local-development database at this phase if CAP requires persistence. Do not couple business logic to SQLite.

Provide a one-command or clearly documented two-command local developer experience so a developer can launch frontend and backend from VS Code.

Add error handling, loading states, a global configuration module, and environment handling. Keep all URLs/ports configurable.

Acceptance criteria:
- frontend starts and renders the N-Guard shell
- backend starts and exposes health/readiness
- frontend can call backend successfully
- type-check, lint, tests, and production builds pass
- no business feature from later phases is prematurely implemented
```

---

## Phase 2 — Core Domain Model and Deployment Profiles

```text
Implement N-Guard's core project and SAP deployment-profile domain.

Create persistent entities and typed domain models for Tenant, Project, User/Actor reference, and SAPDeploymentProfile. At minimum, the deployment profile must capture:
- target SAP product
- deployment model: ON_PREMISE, PRIVATE_CLOUD, PUBLIC_CLOUD
- release/version
- country/localization where applicable
- industry where applicable
- transformation type: Greenfield, Brownfield, Selective, Other
- Clean Core policy
- applicable functional scope/process areas
- optional source-system context

Design the model so hybrid landscapes and future SAP products can be added without schema redesign.

Create backend CRUD services and frontend screens for project creation, project selection, project editing, and deployment-profile maintenance.

Introduce application context so every future object can be associated with tenant_id and project_id. Enforce validation at the backend, not only in the browser.

Add tests for each deployment model and for invalid/unsupported combinations.

Acceptance criteria:
- a user can create/select a project and maintain its deployment profile
- all records are tenant/project scoped
- the core model contains no assumptions that Public, Private, or On-Premise is the default
- domain validation tests pass
```

---

## Phase 3 — Requirements and Change Request Workspace

```text
Implement the N-Guard Requirements and Change Request workspace.

Create entities, services, typed models, and UI for:
- Business Requirement
- User Story
- Change Request
- Design Artifact reference

Each item should support project ownership, status, process area, business objective, description, priority, source, owner, tags, related items, and deployment-profile context.

Support create, edit, view, filter, search, and bulk selection. Add a structured detail page that will later display N-Guard assessments but do not implement AI assessment yet.

Add safe CSV import/export for requirements and change requests. Validate imported records and show row-level errors rather than silently skipping invalid rows.

Do not implement AI calls or fit-to-standard logic in this phase.

Acceptance criteria:
- requirements and CRs can be created manually and via validated CSV import
- project isolation is enforced
- list/detail/filter/search UX works
- data model is ready to attach multiple future assessments to one requirement
```

---

## Phase 4 — Knowledge Provider and Document Ingestion Framework

```text
Build N-Guard's knowledge-ingestion framework without implementing semantic retrieval yet.

Create interfaces/abstractions for:
- KnowledgeProvider
- FileStorageProvider
- DocumentTextExtractor
- KnowledgeRepository

Create persistent entities for KnowledgeSource, KnowledgeDocument, KnowledgeChunk, and ingestion status/job metadata.

Every knowledge document/chunk must be capable of carrying metadata for:
- tenant and project scope
- source/provider
- source reference or URL
- authority level
- SAP product
- SAP edition/deployment model
- valid-from and valid-to release where known
- country/localization
- industry
- process area/process ID
- scope item
- capability
- extension type
- document version/date
- retrieval/ingestion date

Implement local-development adapters for file upload/storage behind FileStorageProvider. Make it explicit in code and docs that local filesystem storage is a development adapter and is not the production persistence design.

Support safe extraction from common project documents where practical (for example PDF, DOCX, PPTX, XLSX, TXT/MD) using maintained libraries. Do not use OCR unless a future phase explicitly requires it.

Create admin UI to add a knowledge source, upload documents, inspect extracted metadata/text, and view ingestion errors.

Acceptance criteria:
- files can be ingested and normalized into documents/chunks
- metadata is retained with every chunk
- storage/extraction/provider logic is modular
- no vector search or LLM call occurs yet
```

---

## Phase 5 — Edition/Release-Aware Retrieval and RAG Foundation

```text
Implement N-Guard's retrieval foundation with strict metadata filtering before semantic retrieval.

Create a VectorStore abstraction with methods for indexing, deleting, searching, and health checks. The domain and agent layers must depend only on the abstraction.

For local development, introduce a practical vector-search implementation. PostgreSQL + pgvector may be used through Docker if it integrates cleanly with the current repository; otherwise implement a clearly marked development adapter. Preserve the future SAP HANA Cloud Vector Engine adapter boundary.

Implement KnowledgeSearchService so searches always apply security and applicability filters BEFORE returning semantic matches. At minimum filter by:
- tenant_id
- project scope / global approved scope
- SAP product
- target deployment model/edition
- applicable release range when known
- country/industry/scope when provided

Add retrieval modes for:
- single-edition assessment
- cross-edition comparison, where each edition is searched independently

Implement tests proving that a Public Cloud query cannot accidentally retrieve On-Premise-only content as applicable evidence, and that cross-tenant data cannot leak through retrieval.

Return ranked chunks with metadata and source references. Do not generate recommendations yet.

Acceptance criteria:
- vector indexing/search works locally
- metadata restrictions are enforced before/with vector retrieval
- wrong-edition and cross-tenant leakage tests pass
- retrieval returns traceable evidence candidates
```

---

## Phase 6 — N-Guard Agent Orchestration Core

```text
Create the modular N-Guard Agent Engine without implementing the full Fit-to-Standard policy yet.

Create typed interfaces and services for:
- AIProvider
- AgentContext
- AgentTool
- AgentRun
- StructuredAgentResult
- EvidenceReference

No business/domain service may call an LLM vendor SDK directly. All model generation and embedding requests must go through AIProvider.

Provide a deterministic MockAIProvider for automated tests and offline development. Add a production-provider adapter boundary for SAP AI Core / Generative AI Hub, but do not place credentials in code.

Create an orchestration pipeline that can:
1. load requirement/project/deployment context
2. classify the business process at a basic level
3. request edition-aware knowledge retrieval
4. call the AI provider with structured inputs
5. validate the structured response against a schema
6. persist the agent run, model/provider metadata, evidence references, timings, and errors

Implement retries/timeouts carefully and never convert a failed/invalid model response into a confident recommendation.

Acceptance criteria:
- agent orchestration runs end-to-end with MockAIProvider
- all model responses are schema validated
- agent runs are auditable
- no direct model call exists outside AIProvider implementations
```

---

## Phase 7 — Fit-to-Standard Assessment Engine

```text
Implement N-Guard's first complete Fit-to-Standard assessment capability.

For a selected requirement, user story, or change request, produce a structured assessment containing at minimum:
- business intent summary
- process area/process classification
- target deployment context
- identified standard capability, if evidence supports one
- fit classification: F1-F8
- deployment compatibility: DP-OP/DP-PCE/DP-PUB/DP-ALL/DP-NA/DP-VERIFY
- gap description
- configuration opportunity
- customization risk statement
- recommended next action
- evidence references
- confidence classification
- explicit assumptions/unknowns
- human review required flag

Do not claim SAP standard support when evidence is insufficient. F8/DP-VERIFY must be valid outcomes.

Create assessment persistence and a UI experience that lets a user run an assessment, watch progress, inspect the structured result, and open each evidence reference.

The AI must recommend; it must not auto-approve, auto-reject, or silently modify the requirement.

Add scenario-based automated tests using MockAIProvider for each F1-F8 classification path.

Acceptance criteria:
- a requirement can be assessed end-to-end
- assessment is structured and auditable
- evidence and confidence are visible
- insufficient evidence produces a safe non-confident outcome
```

---

## Phase 8 — Cross-Edition S/4HANA Comparison

```text
Implement N-Guard's cross-edition comparison capability for SAP S/4HANA On-Premise, S/4HANA Cloud Private Edition, and S/4HANA Cloud Public Edition.

For a selected business requirement/process, run independent retrieval and assessment contexts for each of the three editions. Do not reuse evidence from one edition as proof for another unless that evidence is explicitly applicable across editions.

Create a normalized comparison result that shows, for each edition:
- standard capability availability/status based on evidence
- configuration approach
- relevant process/scope identifiers when known
- extensibility options supported by evidence
- major constraints/differences
- Clean Core implications
- evidence references
- confidence/verification state

Add an overall comparison summary that describes differences without choosing an edition for the user unless a future requirement explicitly defines a business decision framework.

Create a side-by-side UI and allow users to compare all three or any selected pair.

Add regression tests proving that unknown availability remains Unknown/Needs Verification instead of being inferred.

Acceptance criteria:
- one requirement produces three independently evidenced edition assessments
- UI clearly differentiates edition-specific facts from common process intent
- evidence is partitioned by edition
```

---

## Phase 9 — Clean Core and Extensibility Governance

```text
Implement N-Guard's Clean Core and extensibility-governance module.

Create a versioned, configurable rules/catalog model for implementation approaches such as:
- standard process adoption
- configuration
- key-user/in-app extensibility where applicable
- developer/on-stack extensibility where applicable
- side-by-side extension on SAP BTP
- classic/custom techniques requiring governance or exception

Do not hard-code the assumption that every technique is available in every S/4HANA edition/release. Rules must carry applicability metadata and evidence references.

For an assessment, evaluate the proposed implementation/design against applicable rules and return:
- preferred implementation pattern based on evidence
- Clean Core concerns
- customization risk factors
- required architecture review/exception flag
- safer alternative when supported by evidence
- unknowns requiring SME verification

Create a Clean Core assessment UI integrated into requirement and assessment detail pages.

Acceptance criteria:
- Clean Core analysis is edition-aware
- rules are versioned/configurable rather than buried in prompt text
- high-risk or unsupported designs route to human review instead of being automatically rejected
```

---

## Phase 10 — Evidence, Confidence, Human Review, and Exception Workflow

```text
Build the governance layer around N-Guard recommendations.

Enhance evidence records so a reviewer can see source/provider, title/reference, edition/release applicability, authority level, document version/date, and the exact supporting chunk/reference used by the assessment.

Implement the confidence states:
- Verified
- Likely
- Needs SME Review
- Insufficient Evidence

Implement human review actions such as:
- Accept Recommendation
- Modify Disposition
- Request More Evidence
- Send to SME Review
- Approve Exception
- Reject Proposed Customization
- Return to Requirement Owner

Every decision must record actor, timestamp, prior state, new state, rationale, and linked evidence. AI must never be recorded as the final approver.

Create a Design Decision / Exception Register that can be searched and filtered and that later can become project memory for similar assessments.

Acceptance criteria:
- every assessment can enter a controlled human-review workflow
- every state transition is audited
- exceptions require a human rationale
- historical decisions are queryable without overwriting the original AI output
```

---

## Phase 11 — Dashboards, Audit, and Reporting

```text
Implement N-Guard's project-level governance dashboards and reporting.

Build dashboards that derive values only from stored project data, including examples such as:
- requirements analyzed versus pending
- Fit classification distribution F1-F8
- customization-risk distribution
- Clean Core review queue
- architecture/SME review queue
- approved exceptions
- process-area heatmap
- cross-edition comparison activity
- evidence-confidence distribution

Add filters by project, process area, deployment model, release, status, owner, and date range.

Create drill-through navigation from dashboard numbers to the underlying requirements/assessments.

Add export to CSV for tabular reports and create an internal reporting service abstraction for future PDF/PowerPoint outputs. Do not fabricate KPIs or benchmark values.

Acceptance criteria:
- every dashboard number is traceable to underlying records
- filters and drill-through work
- audit report can show who made which governance decision and when
```

---

## Phase 12 — Integrations and Asynchronous Jobs

```text
Introduce the integration and background-processing framework.

Create an IntegrationProvider abstraction with provider-specific adapters for future systems such as SharePoint, Azure DevOps, Jira, SAP Cloud ALM, S/4HANA APIs, Signavio, and Joule/Joule Studio. Do not implement fake connectors. Only implement a connector when valid configuration is available; otherwise create typed adapter contracts and connection-health placeholders.

Create a durable asynchronous job model for:
- document ingestion
- bulk requirement imports
- batch assessments
- knowledge re-indexing
- future synchronization jobs

Do not keep long-running work inside a browser HTTP request. Add job progress, status, retry/error handling, and UI notifications/polling.

Keep the queue implementation replaceable so the local/VM implementation can later be swapped for a BTP-compatible managed pattern without rewriting business logic.

Acceptance criteria:
- long-running operations execute through jobs
- job states are persisted and recoverable
- integrations are behind typed adapters
- no credentials are hard-coded
```

---

## Phase 13 — Security, Tenant Isolation, and Production Controls

```text
Harden N-Guard security before BTP deployment.

Create an AuthProvider abstraction and local-development identity adapter. Define roles at minimum for:
- User/Consultant
- Functional Lead
- Solution Architect
- Design Authority
- Project Admin
- Platform Admin

Enforce authorization in backend services. Do not rely on hidden UI controls for security.

Perform a tenant/project isolation review across all repositories, knowledge retrieval, vector search, jobs, exports, assessments, evidence, and decisions. Add automated negative tests that attempt cross-tenant and cross-project access.

Add upload file-type/size validation, safe filename handling, malware-scan integration hook, rate/size guards for AI requests, secrets/config validation, secure headers, and redaction rules for logs.

Create a threat-model document covering prompt injection through knowledge documents, malicious uploads, retrieval poisoning, cross-tenant leakage, excessive LLM data exposure, authorization bypass, and audit tampering.

Acceptance criteria:
- RBAC is enforced server-side
- cross-tenant negative tests pass
- security-sensitive logs do not expose secrets
- threat model and mitigations are documented
```

---

## Phase 14 — SAP BTP / Cloud Foundry Readiness and Deployment

```text
Prepare the completed N-Guard application for SAP BTP Cloud Foundry without rewriting core business logic.

Create the BTP deployment architecture and implementation using the patterns compatible with the installed SAP tooling and current project structure. Introduce as appropriate:
- mta.yaml / MTA packaging
- approuter or equivalent BTP routing pattern
- xs-security.json and XSUAA integration
- SAP HANA Cloud persistence adapter
- HANA Cloud Vector Engine VectorStore adapter
- Destination Service integration
- Connectivity Service / Cloud Connector compatibility for future on-premise SAP access
- SAP AI Core / Generative AI Hub AIProvider implementation
- production-safe file/object storage adapter or binding strategy
- environment/service-binding configuration

Do not hard-code BTP subaccount, space, routes, service-instance names, destinations, or credentials.

Keep local-development adapters working. The same repository must support local development and BTP deployment through configuration/adapters.

Add build/deploy scripts and documentation for producing an MTAR and deploying it to a target Cloud Foundry space. Where actual BTP credentials/services are unavailable, validate everything that can be validated locally and clearly document the remaining deployment steps instead of inventing successful results.

Acceptance criteria:
- local application still runs
- production build succeeds
- MTA package can be built with available tooling
- BTP-specific code is isolated to adapters/configuration/deployment descriptors
- no core domain rewrite is required for BTP
```

---

## Phase 15 — Test Hardening, Release Readiness, and Operations

```text
Perform final product hardening for an N-Guard release candidate.

Create/complete:
- unit tests for domain services
- integration tests for CAP services and repositories
- retrieval isolation tests
- agent structured-output tests
- Fit classification regression tests
- cross-edition comparison tests
- authorization and tenant-isolation tests
- end-to-end tests for the primary user journeys
- performance tests for realistic requirement/document volumes
- health/readiness checks
- structured application logging and correlation IDs
- AI/model call telemetry without exposing sensitive prompt data
- operational runbook
- backup/restore assumptions and data-retention documentation
- dependency/license inventory
- security/release checklist
- deployment rollback procedure

Review the repository for hard-coded secrets, absolute paths, edition-specific assumptions, direct LLM calls outside AIProvider, direct vector calls outside VectorStore, local-filesystem production dependencies, and any place where tenant/project filters are missing.

Create a release-readiness report with PASS/FAIL status for each architectural principle and explicit remediation items for any failed check.

Do not claim production readiness if unresolved critical issues remain.
```

---

## Recommended Execution Order

Run Phase 0 first, validate it, and create a Git checkpoint. Then execute Phases 1 through 15 sequentially. Individual later phases can be worked independently by starting a fresh VS Code coding-agent session, pasting the Master Context Prompt, and then the desired phase prompt, provided the repository already contains the prerequisite domain/interfaces from earlier phases.
