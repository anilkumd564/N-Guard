# N-Guard Project Master Context

## Product Identity
**Name:** N-Guard — Fit-to-Standard Compliance Agent

**Tagline:** AI-powered governance that challenges unnecessary customization before it enters the SAP solution.

## Product Purpose
N-Guard is a generic web-based SAP design governance application with an embedded AI agent. It evaluates business requirements, user stories, change requests, and design decisions against applicable SAP standard capabilities, SAP best-practice guidance, Clean Core principles, and project-specific governance before unnecessary customization enters the solution.

N-Guard must support comparison across:
- SAP S/4HANA On-Premise
- SAP S/4HANA Cloud Private Edition
- SAP S/4HANA Cloud Public Edition

N-Guard must be deployment-model aware but deployment-model independent. It must also be release-aware, country/localization-aware where applicable, industry-aware, and scope-aware.

## Core Product Principles
1. Edition-neutral core business logic.
2. Deployment- and release-aware reasoning.
3. Metadata-filtered retrieval before semantic/vector search.
4. Evidence-backed recommendations.
5. Human-in-the-loop governance; AI never becomes the final architecture authority.
6. Clean Core analysis across all supported S/4HANA deployment models.
7. Cross-edition process comparison.
8. Provider abstractions for AI, knowledge, vector search, files, authentication, and integrations.
9. Stateless application services; no production dependency on local filesystem persistence.
10. Tenant and project isolation from the beginning.
11. External web application first; optional Joule/Joule Studio channel later.
12. BTP-native production target without making core business logic BTP-dependent.

## Target Technology Direction
- Development IDE: VS Code
- Frontend: React + TypeScript
- Backend: SAP CAP + Node.js + TypeScript
- Agent engine: modular TypeScript services independent of CAP handlers
- Local database: SQLite initially; PostgreSQL can be added for richer local development
- Production database: SAP HANA Cloud
- Production vector/RAG: SAP HANA Cloud Vector Engine
- AI: SAP AI Core / Generative AI Hub through an AIProvider abstraction
- Local/VM deployment: Docker / Docker Compose
- Production deployment: SAP BTP Cloud Foundry using MTA
- BTP security: XSUAA / enterprise identity integration
- External connections: SAP BTP Destination Service
- On-premise SAP connectivity: SAP Cloud Connector + Connectivity Service when needed
- Background processing: asynchronous job framework for document ingestion and bulk assessments

## Major Functional Areas
- Project and System Landscape Profiles
- Requirements and Change Request Management
- Fit-to-Standard Assessment
- Cross-Edition Process Comparison
- Clean Core / Extensibility Assessment
- Knowledge Ingestion and Retrieval
- Evidence and Confidence Management
- Human Review / Approval / Exception Workflow
- Design Decision Register
- Customization Risk and Heatmap Dashboards
- Audit Trail and Reporting
- External Integrations (future): SharePoint, Azure DevOps, Jira, SAP Cloud ALM, S/4HANA APIs, Signavio, Joule/Joule Studio

## Fit Classification Model
- F1 Standard Fit
- F2 Configuration Fit
- F3 Standard + Minor Extension
- F4 Clean Core Extension
- F5 Standardization Opportunity
- F6 Potential Customization Risk
- F7 Legitimate Business Differentiator
- F8 Insufficient Evidence

## Deployment Compatibility Model
- DP-OP: S/4HANA On-Premise
- DP-PCE: S/4HANA Cloud Private Edition
- DP-PUB: S/4HANA Cloud Public Edition
- DP-ALL: Applicable across editions
- DP-NA: Not applicable
- DP-VERIFY: Requires edition/release verification

## Evidence Confidence Model
- Verified
- Likely
- Needs SME Review
- Insufficient Evidence

## Core Assessment Flow
Business Requirement -> Business Process Classification -> Deployment/Edition Context -> Release/Scope Context -> SAP Knowledge Retrieval -> Standard Capability Match -> Gap Analysis -> Configuration Assessment -> Clean Core / Extensibility Assessment -> Recommendation -> Evidence Validation -> Confidence -> Human Review -> Decision / Exception / Backlog Update

## Knowledge Metadata Requirements
Knowledge records should support metadata including source, source URL/reference, source type, SAP product, SAP edition, valid release range, country, industry, process area, process ID, scope item, capability, configuration option, extension type, released API/object where applicable, Clean Core classification, document version/date, retrieval date, authority level, tenant scope, and project scope.

## Core Architecture Rule
The core N-Guard agent/domain logic must not directly depend on CAP request handlers, a specific LLM vendor, a specific vector database, a specific authentication provider, or local filesystem state. Integrations must be implemented behind well-defined interfaces/adapters.

## Delivery Approach
Build N-Guard in independently testable phases. Each phase should inspect and preserve existing work, implement only its intended scope, run lint/test/build, and report changed files and known gaps before the next phase begins.

## Suggested Phases
0. Foundation and Engineering Guardrails
1. Application Shell and Local Developer Experience
2. Core Domain Model and Deployment Profiles
3. Requirements and Change Request Workspace
4. Knowledge Provider and Ingestion Framework
5. Edition/Release-Aware Retrieval and RAG
6. N-Guard Agent Orchestration Core
7. Fit-to-Standard Assessment Engine
8. Cross-Edition Comparison
9. Clean Core and Extensibility Governance
10. Evidence, Confidence, and Human Review
11. Dashboards, Audit, and Reporting
12. Integrations and Asynchronous Jobs
13. Security, Tenant Isolation, and Production Controls
14. SAP BTP / Cloud Foundry Readiness and Deployment
15. Test Hardening, Release Readiness, and Operations

