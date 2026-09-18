# N-Guard — SAP Fit-to-Standard Compliance Agent

**Release Candidate 0.15.0 | Phases 1–15 Complete**

N-Guard is an AI-assisted governance platform for SAP S/4HANA transformation projects. It classifies business requirements against the F1-F8 Fit-to-Standard framework, enforces Clean Core extensibility governance, and provides a structured human review workflow ensuring AI is never the final approver.

---

## Architecture Rule Summary

| Rule | Description |
|---|---|
| Rule 2 | S/4HANA edition is a first-class field — never inferred |
| Rule 3 | Knowledge retrieval filters by edition/release BEFORE semantic search |
| Rule 4 | Every AI output and governance decision is permanently audited |
| Rule 5 | AI is NEVER the final approver — `isAIFinalApprover` is typed as `false` |
| Rule 10 | All data operations are scoped by `tenant_id` and `project_id` |
| Rule 11 | No credentials stored in code |

---

## Implemented Phases

| Phase | Name | Tests |
|---|---|---|
| 1 | Foundational Architecture and Connectivity | 8 |
| 2 | Project and Deployment Profile Management | 20 |
| 3 | Requirements Workspace (CSV import/export) | 88 |
| 4 | Knowledge Base and Document Ingestion | 22 |
| 5 | Vector Knowledge Retrieval | 22 |
| 6 | Agent Orchestration Core | 26 |
| 7 | Fit-to-Standard Assessment Engine (F1-F8) | 32 |
| 8 | Cross-Edition S/4HANA Comparison | 24 |
| 9 | Clean Core and Extensibility Governance | 20 |
| 10 | Evidence, Confidence, and Human Review | 28 |
| 11 | Dashboards, Audit, and Reporting | — |
| 12 | Integrations and Asynchronous Jobs | 22 |
| 13 | Security, Tenant Isolation, and Production Controls | 38 |
| 14 | BTP Deployment Preparation | 4 |
| 15 | End-to-End Validation and Release Candidate | 31 |
| **Total** | | **437** |

---

## Technology Stack

- **Backend:** SAP CAP (Node.js), TypeScript, SQLite (dev) / SAP HANA Cloud (production)
- **AI Layer:** SAP AI Core / Generative AI Hub (via `AIProvider` abstraction — mock in dev)
- **Frontend:** React 18, TypeScript, Vite
- **Test:** Jest (ts-jest for srv, ESM for agent)
- **Deployment:** SAP BTP Cloud Foundry, MTA, XSUAA

---

## Project Structure

```
N-Guard/
├── srv/                        # CAP backend (Node.js)
│   ├── app-service.cds         # AppService (ping, info, health, ready)
│   ├── nguard-service.cds      # NGuardService (all business actions)
│   ├── src/handlers/           # CAP action handlers
│   ├── src/lib/                # Shared utilities (audit, agent-factory)
│   ├── src/types/              # Domain types
│   └── __tests__/              # Backend tests
├── agent/                      # AI agent engine (ESM package)
│   ├── src/engine/             # AgentEngine
│   ├── src/assessment/         # FitAssessmentEngine (F1-F8)
│   ├── src/comparison/         # CrossEditionComparisonEngine
│   ├── src/cleancore/          # CleanCoreAnalyzer + versioned catalog
│   ├── src/review/             # Human review workflow types
│   ├── src/orchestration/      # AgentOrchestrator
│   ├── src/retrieval/          # KnowledgeSearchService
│   ├── src/ingestion/          # Document extraction and chunking
│   ├── src/jobs/               # AsyncJobQueue + integration health
│   ├── src/security/           # RBAC, input validation, secret redaction
│   ├── src/providers/          # Abstraction boundaries (AI, Auth, Vector, etc.)
│   └── src/__tests__/          # Agent tests (10 suites)
├── app/                        # React 18 frontend (Vite)
│   └── src/pages/              # 15+ page components
├── db/
│   └── schema.cds              # CDS domain model (20+ entities)
├── docs/
│   ├── architecture.md         # Architecture decisions and rules
│   ├── threat-model.md         # Security threat model (Phase 13)
│   ├── deployment-runbook.md   # BTP deployment guide (Phase 14)
│   └── feature-registry.md    # Complete capability registry (Phase 15)
├── mta.yaml                    # MTA deployment descriptor
├── xs-security.json            # XSUAA security (6 roles)
├── .env.example                # Development environment variables
└── .env.production.example     # Production environment variable reference
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+ and npm 10+
- `@sap/cds` CLI (`npm install -g @sap/cds`)

### Install and run

```bash
git clone https://github.com/anilkumd564/N-Guard.git
cd N-Guard

# Install all workspace dependencies
npm install

# Deploy SQLite schema
npm run deploy:sqlite

# Start CAP server (port 4004)
npm start

# In a separate terminal, start the React frontend
npm run dev --workspace=app
```

### Run tests

```bash
npm test                  # All 437 tests
npm run test:srv          # Backend tests (4 suites, 148 tests)
npm run test:agent        # Agent tests (10 suites, 289 tests)
```

### Build

```bash
npm run build             # Build all packages (srv + agent + app)
npm run lint              # ESLint (target: 0 errors)
npm run typecheck         # TypeScript type checking
```

---

## Core Workflow

1. **Create Project** — define edition (On-Premise / Cloud Private / Cloud Public), Clean Core policy, and transformation type
2. **Import Requirements** — upload CSV or create requirements manually  
3. **Submit for Assessment** — AI classifies each requirement as F1-F8 with evidence traceability
4. **Run Clean Core Analysis** — deterministic versioned rule catalog assigns TIER_1–4 and extensibility technique
5. **Run Cross-Edition Comparison** — parallel evidence-partitioned assessment across all three S/4HANA editions
6. **Submit for Human Review** — AI output enters the human governance workflow
7. **Record Review Decision** — DESIGN_AUTHORITY or higher approves/rejects/escalates (AI never the actor)
8. **Export and Report** — CSV audit trail, dashboard metrics, exception register

---

## Key Design Decisions

### AI is never the final approver

`DesignDecision.isAIFinalApprover` is typed as the literal `false` in TypeScript — it is physically impossible to set it to `true`. Any attempt to record `actor='AI'` returns HTTP 403.

### Evidence traceability

Every F1-F8 classification references the specific knowledge chunks (by `chunkId`) that grounded the assessment. Reviewers can trace from verdict → evidence excerpt → source document.

### Edition-first knowledge retrieval

Knowledge chunks are filtered by `edition` and `release` BEFORE semantic similarity ranking. A Cloud Public chunk cannot appear in an On-Premise assessment result.

### Replaceable implementations

All AI, vector, authentication, and job queue implementations are behind typed interfaces. Local dev uses mocks; production uses SAP AI Core, SAP HANA Vector Engine, XSUAA, and BTP Job Scheduling — without changing business logic.

---

## Documentation

| Document | Description |
|---|---|
| `docs/architecture.md` | Architecture decisions and 15 rules |
| `docs/threat-model.md` | 9 security threats with mitigations |
| `docs/deployment-runbook.md` | BTP deployment step-by-step guide |
| `docs/feature-registry.md` | Complete capability registry (phases 1–15) |
| `CHANGELOG.md` | Keep-a-changelog format, all 15 phases |

---

## License

Internal / confidential — N-Guard is a proprietary SAP transformation governance tool.
