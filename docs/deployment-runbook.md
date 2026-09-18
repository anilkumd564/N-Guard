# N-Guard Deployment Runbook (Phase 14)

This runbook covers the steps to deploy N-Guard to SAP Business Technology Platform (BTP) Cloud Foundry.

**Prerequisites:**
- SAP BTP sub-account with Cloud Foundry environment enabled
- CF CLI (`cf`) installed and logged in to the target space
- MTA Build Tool (`mbt`) installed (`npm install -g mbt`)
- SAP HANA Cloud instance available in the sub-account
- SAP AI Core instance (with Generative AI Hub) available
- Node.js 20+ and npm 10+ installed locally

---

## 1. Pre-Deployment Checklist

| Item | Check |
|---|---|
| All environment variables documented in `.env.production.example` are known | ☐ |
| `xs-security.json` has been reviewed — no placeholder scopes remain | ☐ |
| `mta.yaml` version number updated to match release | ☐ |
| AI Core deployment ID obtained from BTP Cockpit → AI Core → Deployments | ☐ |
| HANA Cloud instance in the same BTP sub-account and CF space | ☐ |
| `npm run test` passes locally (402+ tests, 0 failures) | ☐ |
| `npm run lint` returns 0 errors | ☐ |
| `npm run build` completes without errors | ☐ |
| `.env` is in `.gitignore` — never committed | ☐ |

---

## 2. One-Time Service Setup

### 2a. Create XSUAA instance

```bash
cf create-service xsuaa application n-guard-xsuaa -c xs-security.json
```

### 2b. Create SAP HANA Cloud HDI Container

```bash
cf create-service hana hdi-shared n-guard-hana
```

### 2c. Create Destination Service

```bash
cf create-service destination lite n-guard-destination
```

### 2d. Create AI Core service instance

```bash
cf create-service aicore extended n-guard-aicore
```

> If AI Core is not available as a CF service in your sub-account, bind it via BTP service marketplace.

### 2e. Assign role collections to users

In BTP Cockpit → Security → Users, assign the appropriate N-Guard role collection:
- **N-Guard User** — read-only stakeholders
- **N-Guard Solution Architect** — assessment and analysis team
- **N-Guard Design Authority** — governance approvers
- **N-Guard Platform Admin** — system administrators

---

## 3. Build the MTA Archive

```bash
# From the project root
mbt build -t ./mta_archives
```

This produces `mta_archives/n-guard_0.1.0.mtar`.

---

## 4. Deploy to BTP Cloud Foundry

```bash
cf deploy mta_archives/n-guard_0.1.0.mtar \
  --retries 2 \
  --abort-on-error
```

The deployer:
1. Creates or updates bound service instances
2. Runs HDI container deployment (HANA schema migration)
3. Pushes the Node.js app module
4. Uploads the React SPA as an HTML5 app

---

## 5. Post-Deployment Validation

### 5a. Health check

```bash
curl -s https://<app-route>/api/v1/app/health
# Expected: { "status": "ok", "uptime": <seconds>, ... }
```

### 5b. Readiness check

```bash
curl -s https://<app-route>/api/v1/app/ready
# Expected: { "ready": true, "checks": "{\"server\":\"ok\"}" }
```

### 5c. Ping

```bash
curl -s https://<app-route>/api/v1/app/ping
# Expected: { "pong": true, "timestamp": "..." }
```

### 5d. Verify XSUAA integration

1. Open the N-Guard URL in a browser
2. You should be redirected to the BTP login page
3. After login, the app loads without authentication errors

### 5e. Verify AI Core connectivity

Submit a test requirement for assessment and verify:
- The assessment job starts (status = ASSESSING)
- The assessment completes with a valid F1-F8 classification
- Evidence references are populated

---

## 6. HANA Cloud Schema Migration Notes

N-Guard uses CAP's HDI (HANA Deployment Infrastructure) for schema management.

- Schema is deployed automatically during `cf deploy` via the HDI container module
- All entities use `cuid` UUIDs — no auto-increment conflicts
- SQLite-specific types (`LargeString`) map to HANA `NCLOB`
- The `embedding` field (LargeString/JSON in SQLite) will become `REAL_VECTOR` in HANA Cloud when Phase 5 vector indexing is enabled via SAP AI Core Embedding API
- No manual SQL migration scripts are required for Phase 14

### HANA Vector Index (Phase 5 upgrade)

To enable vector similarity search in production:
1. Update `KnowledgeChunks.embedding` column type to `REAL_VECTOR` (HANA DDL via HDI artifact)
2. Configure the embedding model in AI Core (text-embedding-ada-002 or equivalent)
3. Run the `embedChunks` admin action for all existing documents

---

## 7. Rollback Procedure

### Option A: Roll back to previous MTA version

```bash
cf deploy mta_archives/n-guard_<previous-version>.mtar
```

### Option B: Stop the application

```bash
cf stop n-guard-srv
```

### Option C: Blue-green deployment (recommended for production)

```bash
cf deploy mta_archives/n-guard_<new-version>.mtar \
  --strategy blue-green \
  --no-confirm
```

---

## 8. Monitoring and Operations

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/app/health` | Liveness probe — BTP app router integration |
| `GET /api/v1/app/ready` | Readiness probe — CF health management |
| `GET /api/v1/app/ping` | Simple connectivity test |

### Viewing logs

```bash
cf logs n-guard-srv --recent
cf logs n-guard-srv            # Live tail
```

### Application events

```bash
cf events n-guard-srv
```

---

## 9. Security Checklist (pre-release)

- [ ] `xs-security.json` reviewed by security team
- [ ] Role collections assigned — no user has PLATFORM_ADMIN by default
- [ ] Environment variables set via `cf set-env` — never in source code
- [ ] `VCAP_SERVICES` binding verified for all 4 services (xsuaa, hana, destination, aicore)
- [ ] Threat model reviewed (`docs/threat-model.md`)
- [ ] HANA row-level security configured (deferred to Phase 14+)
- [ ] Penetration test scheduled (Phase 15)

---

*Document version: 1.0 — Phase 14 — N-Guard*
