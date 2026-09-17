# N-Guard — Fit-to-Standard Compliance Agent

> AI-powered governance that challenges unnecessary customization before it enters the SAP solution.

---

## Overview

N-Guard is a web-based SAP design-governance application with an embedded AI agent. It assesses proposed customizations and requirements against SAP S/4HANA standard functionality, producing evidence-backed compliance verdicts for human architect review.

### Supported Deployment Models

| Edition | Value |
|---|---|
| SAP S/4HANA On-Premise | `ON_PREMISE` |
| SAP S/4HANA Cloud, Private Edition | `CLOUD_PRIVATE` |
| SAP S/4HANA Cloud, Public Edition | `CLOUD_PUBLIC` |

N-Guard is **deployment-model aware but deployment-model independent** — it never assumes that functionality available in one edition exists in another.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        N-Guard                              │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │  React SPA   │    │       SAP CAP Backend            │   │
│  │  (Vite)      │◄──►│  NGuardService  AdminService     │   │
│  │  port 5173   │    │  (TypeScript handlers)           │   │
│  └──────────────┘    └────────────┬─────────────────────┘   │
│                                   │ agent-factory            │
│                      ┌────────────▼─────────────────────┐   │
│                      │    N-Guard Agent Engine           │   │
│                      │  ┌───────────┐ ┌──────────────┐  │   │
│                      │  │AIProvider │ │ VectorStore  │  │   │
│                      │  │(abstracted│ │ (abstracted) │  │   │
│                      │  │ rule 7)   │ │   rule 8)    │  │   │
│                      │  └───────────┘ └──────────────┘  │   │
│                      └──────────────────────────────────┘   │
│                                                             │
│  Dev:  SQLite + MockAIProvider + MockVectorStore            │
│  Prod: SAP HANA Cloud + SAP AI Core + XSUAA                 │
└─────────────────────────────────────────────────────────────┘
```

### Package Structure

```
c:\N-Guard\
├── db/                     # CDS domain model (schema.cds)
├── srv/                    # SAP CAP service layer
│   └── src/
│       ├── handlers/       # CAP event handlers (NGuardService, AdminService)
│       ├── lib/            # audit.ts, agent-factory.ts
│       └── types/          # Port interfaces (agent.ts)
├── agent/                  # @n-guard/agent — Agent Engine package
│   └── src/
│       ├── engine/         # NGuardAgentEngine
│       ├── providers/      # AIProvider interface + MockAIProvider
│       ├── vector/         # VectorStore interface + MockVectorStore
│       ├── types/          # Shared domain types
│       └── __tests__/      # Agent Engine tests
├── app/                    # @n-guard/app — React + TypeScript frontend
│   └── src/
│       ├── api/            # API client (fetch wrapper)
│       ├── components/     # Shared UI components
│       ├── pages/          # ProjectsPage, DesignRequestsPage, AssessmentPage
│       └── types/          # API type mirrors
├── .cdsrc.json             # CAP configuration
├── docker-compose.yml      # Local development stack
└── mta.yaml                # SAP BTP MTA deployment (future)
```

---

## Permanent Architecture Rules

| # | Rule |
|---|------|
| 1 | Never hard-code one S/4HANA edition into the core domain |
| 2 | Never assume functionality in one edition exists in another |
| 3 | Knowledge retrieval must filter by tenant/project/edition/release before semantic retrieval |
| 4 | Every N-Guard recommendation must be evidence-backed |
| 5 | Human architects remain the final decision authority |
| 6 | Keep the Agent Engine independent of CAP HTTP handlers |
| 7 | All LLM access must go through `AIProvider` |
| 8 | All vector access must go through `VectorStore` |
| 9 | Production services must not depend on local filesystem state |
| 10 | All data must respect `tenant_id` and `project_id` boundaries |
| 11 | Never commit credentials or secrets |
| 12 | Prefer typed contracts and structured AI output |
| 13 | Begin as a modular monolith; do not prematurely create microservices |
| 14 | Design for stateless horizontal scaling |
| 15 | Do not invent SAP APIs, package APIs, or service capabilities |

---

## Getting Started (Local Development)

### Prerequisites

- Node.js ≥ 22
- npm ≥ 10
- `@sap/cds-dk` (installed globally by setup)

### Quick Start

```bash
# 1. Install all dependencies
npm install

# 2. Deploy the SQLite schema
npm run deploy:sqlite

# 3. Start the CAP backend (port 4004)
npm run dev

# 4. In a second terminal, start the React frontend (port 5173)
npm run dev --workspace=app
```

The CAP Explorer UI is available at http://localhost:4004 in development mode.
The React app is available at http://localhost:5173.

### Docker Compose

```bash
docker compose up
```

---

## Running Tests

```bash
# All tests
npm test

# Agent Engine tests only
npm run test:agent

# With coverage
npm run test:agent -- --coverage
```

---

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `mock` | `mock` \| `aicore` |
| `VECTOR_STORE` | `mock` | `mock` \| `hana` |
| `NODE_ENV` | `development` | `development` \| `production` |

---

## Verdicts

| Verdict | Meaning |
|---|---|
| `FIT_TO_STANDARD` | No customization needed — use SAP standard |
| `ACCEPTABLE_GAP` | Minor gap; low-risk extension acceptable |
| `CUSTOMIZATION_RISK` | Significant divergence — architect must challenge |
| `REJECT` | Incompatible with the target edition/release |
| `NEEDS_REVIEW` | Insufficient evidence — human review required |

---

## Production Deployment (SAP BTP)

Production deployment targets SAP BTP Cloud Foundry using MTA (Multi-Target Application).

Key BTP services required:
- **SAP HANA Cloud** — persistence + vector engine
- **SAP AI Core / Generative AI Hub** — LLM and embeddings
- **XSUAA** — authentication
- **Destination Service** — outbound connectivity

> MTA descriptor (`mta.yaml`) will be added in a future phase.

---

## Development Phases

- **Phase 1** ✅ Foundation & Project Scaffold
- **Phase 2** — Knowledge Base seeding + RAG pipeline (SQLite → HANA Vector)
- **Phase 3** — SAP AI Core / Generative AI Hub provider implementation
- **Phase 4** — XSUAA integration + multi-tenant isolation
- **Phase 5** — MTA deployment descriptor + BTP Cloud Foundry deployment
- **Phase 6** — Analytics dashboard + reporting

---

## License

Proprietary — NTT DATA
