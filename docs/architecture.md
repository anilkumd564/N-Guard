# N-Guard — Architecture Document

> **Architectural Source of Truth:** `docs/N-Guard_Project_Master_Context.md`
> **Version:** 0.1.0 (Phase 0 — Foundation)
> **Status:** Living document — updated after each validated phase.

---

## 1. Product Identity

**Name:** N-Guard — Fit-to-Standard Compliance Agent

**Tagline:** AI-powered governance that challenges unnecessary customization before it enters the SAP solution.

**Purpose:** N-Guard is a generic web-based SAP design-governance application with an embedded AI agent. It evaluates business requirements, user stories, change requests, and design decisions against applicable SAP standard capabilities, SAP best-practice guidance, Clean Core principles, and project-specific governance before unnecessary customization enters the solution.

---

## 2. Supported SAP S/4HANA Deployment Models

N-Guard must support, compare, and reason independently across three SAP S/4HANA deployment models. **Core logic must never assume that functionality available in one model exists in another.**

| Deployment Model | Code | Description |
|---|---|---|
| SAP S/4HANA On-Premise | `ON_PREMISE` | Customer-hosted; full ABAP extensibility; longer release cycles |
| SAP S/4HANA Cloud, Private Edition | `CLOUD_PRIVATE` | SAP-managed (RISE); constrained extensibility; quarterly updates |
| SAP S/4HANA Cloud, Public Edition | `CLOUD_PUBLIC` | SAP-operated SaaS; Clean Core enforced; quarterly releases |

N-Guard must also be **release-aware** and capable of carrying country/localization, industry, and scope metadata when applicable.

---

## 3. Fit Classification Model (F1–F8)

Every N-Guard assessment produces a fit classification. These codes are the authoritative vocabulary for all assessment output across the application.

| Code | Name | Meaning |
|---|---|---|
| F1 | Standard Fit | Requirement is met by SAP standard functionality without modification |
| F2 | Configuration Fit | Met through standard SAP configuration / Customizing |
| F3 | Standard + Minor Extension | Met by standard process plus a low-risk in-app extension |
| F4 | Clean Core Extension | Met via Clean Core–compliant extensibility (Key User / developer extension) |
| F5 | Standardization Opportunity | Requirement can be simplified to fit standard if business process is adapted |
| F6 | Potential Customization Risk | Proposed design deviates from standard; governance review required |
| F7 | Legitimate Business Differentiator | Justified customization; exception process and documentation required |
| F8 | Insufficient Evidence | Retrieval returned insufficient evidence; human SME review mandatory |

---

## 4. Deployment Compatibility Model (DP Codes)

Each assessment result carries a deployment compatibility code indicating which edition the finding applies to.

| Code | Meaning |
|---|---|
| DP-OP | Applies to SAP S/4HANA On-Premise |
| DP-PCE | Applies to SAP S/4HANA Cloud Private Edition |
| DP-PUB | Applies to SAP S/4HANA Cloud Public Edition |
| DP-ALL | Applies across all three editions |
| DP-NA | Not applicable to the target edition/release |
| DP-VERIFY | Requires edition/release verification before applying |

---

## 5. Evidence Confidence Model

All AI recommendations must carry an explicit confidence classification. N-Guard must never present a recommendation as confident when evidence is insufficient.

| Confidence | Description |
|---|---|
| Verified | Evidence is from authoritative SAP sources with direct applicability |
| Likely | Evidence is strong but may require release/localization verification |
| Needs SME Review | Evidence is indirect or ambiguous; a subject matter expert must verify |
| Insufficient Evidence | Retrieval found no applicable evidence; classification must be F8 |

---

## 6. Core Assessment Flow

```
Business Requirement
  │
  ▼
Business Process Classification
  │
  ▼
Deployment / Edition Context (DP-OP / DP-PCE / DP-PUB)
  │
  ▼
Release / Scope Context
  │
  ▼
SAP Knowledge Retrieval
  (filter: tenant → project → edition → release → country/industry/scope)
  (then: semantic / vector search)
  │
  ▼
Standard Capability Match
  │
  ▼
Gap Analysis
  │
  ▼
Configuration Assessment
  │
  ▼
Clean Core / Extensibility Assessment
  │
  ▼
Recommendation (F1–F8 + DP code + evidence + confidence)
  │
  ▼
Evidence Validation
  │
  ▼
Confidence Classification
  │
  ▼
Human Review → Decision / Exception / Backlog Update
```

**Rule:** The AI agent recommends. Human architects decide. The agent must never auto-approve or auto-reject.

---

## 7. Knowledge Metadata Requirements

Every knowledge document and chunk must be capable of carrying the following metadata. This supports edition/release-aware retrieval and evidence traceability.

| Field | Required | Description |
|---|---|---|
| `tenantId` | ✓ | Owning tenant (null = global/system knowledge) |
| `projectId` | | Owning project (null = tenant-wide) |
| `source` | ✓ | Source name (e.g. "SAP Help Portal") |
| `sourceUrl` | | Direct URL or citation reference |
| `sourceType` | | e.g. `SAP_HELP`, `BEST_PRACTICE`, `RELEASE_NOTE`, `PARTNER`, `INTERNAL` |
| `sapProduct` | ✓ | e.g. `S4HANA`, `ECC`, `BTP` |
| `edition` | | `ON_PREMISE`, `CLOUD_PRIVATE`, `CLOUD_PUBLIC`, or null (all editions) |
| `validFromRelease` | | Earliest applicable SAP release |
| `validToRelease` | | Latest applicable SAP release (null = indefinite) |
| `country` | | ISO 3166-1 alpha-2 or null (global) |
| `industry` | | e.g. `Manufacturing`, `Retail`, or null (cross-industry) |
| `processArea` | | e.g. `Order-to-Cash`, `Procure-to-Pay` |
| `processId` | | SAP process identifier |
| `scopeItem` | | SAP Scope Item ID, e.g. `BH1`, `J45` |
| `capability` | | Specific SAP capability described |
| `extensionType` | | e.g. `KEY_USER`, `DEVELOPER`, `SIDE_BY_SIDE`, `CLASSIC` |
| `releasedApiOrObject` | | Released API/BAPI/CDS view name where applicable |
| `cleanCoreClassification` | | Clean Core compliance category |
| `documentVersion` | | Document/content version |
| `documentDate` | | Date of document publication |
| `retrievalDate` | ✓ | ISO 8601 ingestion/retrieval date |
| `authorityLevel` | ✓ | `SAP_OFFICIAL`, `PARTNER`, `INTERNAL` |

---

## 8. Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          N-Guard                                  │
│                                                                   │
│  ┌───────────────────┐    ┌───────────────────────────────────┐   │
│  │   React SPA       │    │       SAP CAP Backend             │   │
│  │   (Vite / TSX)    │◄──►│   NGuardService  AdminService     │   │
│  │   port 5173       │    │   (TypeScript handlers)           │   │
│  └───────────────────┘    └─────────────┬─────────────────────┘   │
│                                          │ agent-factory (port)    │
│                           ┌─────────────▼────────────────────┐    │
│                           │    N-Guard Agent Engine           │    │
│                           │  Orchestration + Assessment       │    │
│                           └──────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                Provider / Adapter Layer                      │  │
│  │  AIProvider  KnowledgeProvider  VectorStore                  │  │
│  │  FileStorageProvider  AuthProvider  IntegrationProvider      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Dev:   Mock adapters + SQLite + in-memory vector                 │
│  Prod:  SAP AI Core + HANA Cloud Vector + XSUAA                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 9. Local Development Architecture

```
Developer Workstation
│
├── npm run dev          → cds-ts watch  (CAP backend, port 4004)
├── npm run dev:app      → vite dev      (React SPA, port 5173, proxy → 4004)
│
├── SQLite               → db/nguard.db  (local dev only — never in production)
├── MockAIProvider       → in-process; no external LLM calls
├── MockVectorStore      → in-memory cosine similarity
└── MockKnowledgeProvider→ returns seeded local data stubs
```

All local adapters are named `Mock*` or `Local*`. This naming is a deliberate guardrail so no local adapter can be silently promoted to production use.

---

## 10. Production Architecture — SAP BTP Cloud Foundry

```
SAP BTP Cloud Foundry Space
│
├── n-guard-srv  (CAP Node.js app — stateless, horizontally scalable)
│   └── Bound BTP services:
│       ├── SAP HANA Cloud           (persistence + vector engine)
│       ├── SAP AI Core / GenAI Hub  (LLM completions + embeddings)
│       ├── XSUAA                    (authentication + RBAC)
│       ├── Destination Service      (outbound connectivity)
│       └── Connectivity Service + Cloud Connector (on-prem S/4HANA)
│
├── n-guard-app  (React SPA — static hosting via App Router or SAP HTML5 Repo)
│
└── Deployment via MTA (mta.yaml) — Phase 14
```

**Rule:** Core application code must NEVER import `@sap/connectivity`, `@sap/xssec`, or any BTP SDK directly. All BTP integrations live exclusively in adapter implementations.

---

## 11. Provider / Adapter Strategy

Every external dependency is accessed through a typed interface. Adapters are swapped via environment configuration, never by changing business logic.

| Interface | Local Dev Adapter | Production Adapter |
|---|---|---|
| `AIProvider` | `MockAIProvider` | `AICoreAIProvider` (Phase 6) |
| `VectorStore` | `MockVectorStore` | `HanaVectorStore` (Phase 5) |
| `KnowledgeProvider` | `MockKnowledgeProvider` | `HanaKnowledgeProvider` (Phase 5) |
| `FileStorageProvider` | `LocalFileStorageProvider` | `BTPObjectStoreProvider` (Phase 12) |
| `AuthProvider` | `MockAuthProvider` | `XsuaaAuthProvider` (Phase 13) |
| `IntegrationProvider` | `MockIntegrationProvider` | `BTPDestinationProvider` (Phase 12) |

**How to add a new provider:**
1. Define the interface in `agent/src/providers/`.
2. Create the local dev mock adapter.
3. Register in `srv/src/lib/agent-factory.ts` with an env-var selector.
4. Add tests for the new adapter.
5. No changes to CAP handlers or the Agent Engine are required.

---

## 12. Tenant and Project Isolation

Every entity in the data model carries `tenant_id` and `project_id`. These are enforced at:

- **Data layer:** Non-nullable columns on all entities
- **Service layer:** All CAP queries must include tenant/project filters
- **Retrieval layer:** Knowledge retrieval filters tenant → project → edition → release BEFORE semantic search
- **Agent layer:** `AssessmentInput` requires both `tenantId` and `projectId`
- **Test layer:** Negative tests verify cross-tenant data cannot be retrieved

**Principle:** A request with no tenant context must be rejected, not served with unfiltered data.

---

## 13. Evidence-First AI Design

N-Guard does not generate opinions. It generates evidence-backed recommendations.

Rules:
- Every assessment output must reference at least one knowledge source
- Evidence sources must include title, excerpt, authority level, and edition/release applicability
- Confidence must be explicitly set — never inferred to be "Verified" by default
- When evidence is insufficient, the classification MUST be F8 / confidence MUST be "Insufficient Evidence"
- The AI must never claim SAP standard support without retrieving supporting evidence

---

## 14. Human-in-the-Loop Governance

N-Guard enforces a strict human review model:

```
ASSESSED → [HUMAN REVIEW] → APPROVED | REJECTED | EXCEPTION | BACK_TO_OWNER
```

Rules:
- The AI agent produces recommendations; it never produces final decisions
- Every state transition is audited with actor, timestamp, rationale, and prior state
- Architecture exceptions require a named human approver and a documented rationale
- AI must never be recorded as an approver, signatory, or decision authority

---

## 15. Stateless Application Design

Application services must be designed for stateless horizontal scaling:

- No session state stored in server memory
- No file system state required at runtime (local filesystem is a dev adapter only)
- Database is the single source of truth for all workflow state
- Background jobs carry enough state in their persistent record to resume after restart
- All configuration comes from environment variables or bound BTP services

---

## 16. Permanent Architecture Rules (from Master Context)

| # | Rule |
|---|------|
| 1 | Do not hard-code a single S/4HANA edition into domain logic |
| 2 | Never infer functionality from one edition/release is available in another |
| 3 | Filter knowledge by tenant/project + edition/release BEFORE semantic retrieval |
| 4 | Every recommendation must support evidence references and a confidence classification |
| 5 | Human reviewers are the final design authority; AI must never auto-approve exceptions |
| 6 | Keep the Agent Engine independent of CAP transport/request handlers |
| 7 | Do not call an LLM vendor directly from business/domain code — route through AIProvider |
| 8 | Do not depend on local filesystem persistence in production — local adapters only |
| 9 | Design application services to be stateless and horizontally scalable |
| 10 | Include `tenant_id` and `project_id` in data ownership and retrieval boundaries from the start |
| 11 | Never put secrets, API keys, credentials, or customer data into source control |
| 12 | Prefer typed contracts, explicit schemas, deterministic validation, structured AI outputs |
| 13 | Avoid premature microservices — start as a modular monolith with clear boundaries |
| 14 | Avoid Kubernetes for initial product — Cloud Foundry is the target managed runtime |
| 15 | Do not invent SAP APIs, service names, or package capabilities |

---

## 17. Repository Structure

```
C:\N-Guard\
├── package.json              # Root CAP project + npm workspaces
├── .cdsrc.json               # CAP config (SQLite dev / HANA prod)
├── tsconfig.base.json        # Shared TypeScript base config
├── eslint.config.mjs         # ESLint 9 flat config
├── prettier.config.mjs       # Prettier config
├── .gitignore
├── .env.example              # Environment variable documentation (no secrets)
├── docker-compose.yml        # Local development stack
├── README.md
│
├── db/                       # CDS domain model
│   └── schema.cds
│
├── srv/                      # SAP CAP service layer
│   ├── nguard-service.cds    # OData/REST service definitions
│   ├── tsconfig.json
│   └── src/
│       ├── handlers/         # CAP event handlers
│       ├── lib/              # Utilities (audit, agent-factory)
│       └── types/            # Port interfaces (srv-side contracts)
│
├── agent/                    # @n-guard/agent — Agent Engine package
│   └── src/
│       ├── engine/           # Agent orchestration
│       ├── providers/        # Provider interfaces + mock adapters
│       ├── vector/           # VectorStore interface + mock
│       ├── types/            # Shared domain types
│       └── __tests__/        # Agent tests
│
├── app/                      # @n-guard/app — React + TypeScript SPA
│   └── src/
│       ├── api/              # API client (fetch wrapper)
│       ├── components/       # Shared UI components
│       ├── pages/            # Route page components
│       └── types/            # Frontend API types
│
└── docs/                     # Architecture and phase documentation
    ├── architecture.md        ← This document
    ├── N-Guard_Project_Master_Context.md
    └── N-Guard_VSCode_Development_Prompts.md
```

---

## 18. Development Phase Roadmap

| Phase | Title | Status |
|---|---|---|
| 0 | Foundation and Engineering Guardrails | ✅ Complete |
| 1 | Application Shell and Local Developer Experience | Pending |
| 2 | Core Domain Model and Deployment Profiles | Pending |
| 3 | Requirements and Change Request Workspace | Pending |
| 4 | Knowledge Provider and Document Ingestion Framework | Pending |
| 5 | Edition/Release-Aware Retrieval and RAG Foundation | Pending |
| 6 | N-Guard Agent Orchestration Core | Pending |
| 7 | Fit-to-Standard Assessment Engine | Pending |
| 8 | Cross-Edition S/4HANA Comparison | Pending |
| 9 | Clean Core and Extensibility Governance | Pending |
| 10 | Evidence, Confidence, Human Review, and Exception Workflow | Pending |
| 11 | Dashboards, Audit, and Reporting | Pending |
| 12 | Integrations and Asynchronous Jobs | Pending |
| 13 | Security, Tenant Isolation, and Production Controls | Pending |
| 14 | SAP BTP / Cloud Foundry Readiness and Deployment | Pending |
| 15 | Test Hardening, Release Readiness, and Operations | Pending |

---

## 19. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | SAP CAP + Node.js | Native BTP support; OData + REST; CDS model |
| Backend language | TypeScript | Type safety; structured AI output contracts |
| Frontend | React + Vite | Modern, fast; no Fiori dependency for MVP |
| Local persistence | SQLite (dev adapter) | Zero-setup; replaced by HANA Cloud in production |
| Production persistence | SAP HANA Cloud | Native BTP; Vector Engine built-in |
| AI provider | SAP AI Core / GenAI Hub | BTP-native; no direct OpenAI dependency |
| Authentication | XSUAA (BTP) / mock (dev) | Standard BTP auth; isolated via adapter |
| Test framework (agent) | Jest + ts-jest | ESM support; fast; isolated from CAP |
| Test framework (app) | Vitest | Vite-native; fast |
| Linting | ESLint 9 flat config | Latest format; no legacy config |
| Formatting | Prettier | Consistent code style across workspaces |
