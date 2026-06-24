# Architecture & decisions note

One page on how the AI Tool Generator is put together and *why*. Feeds the
1-page architecture doc / Loom.

## Shape

```
Browser (Next.js client)
  │  natural-language prompt
  ▼
POST /api/generate ──► generateSpec(prompt, role)        [src/lib/llm.ts]
  │                       ├─ LLM (OpenAI function-calling, enums = registry)
  │                       └─ rule-based composer (fallback)
  │                     buildSpec() validates + role-filters → ToolSpec (JSON)
  ▼
Client renders ToolSpec  [src/components/ToolRenderer.tsx]
  │  per component:                         per action (admin only):
  ▼                                          ▼
POST /api/tools/execute                     POST /api/actions/execute
  authorize(role) ─ run read tool            authorize(role) ─ run write action
  applyMasking(role) ── mask classified      write audit row
  write audit row (+ maskedFields)           │  writes
  │  reads via connectors                     ▼
  ▼
Connector layer  [src/lib/connectors.ts + src/lib/tools.ts]
  ├─ Postgres (Prisma)            — listCustomers/Accounts/Transactions
  ├─ /api/risk-score              — getRiskScores      (REST microservice)
  ├─ /api/connectors/redshift     — getLoginActivity   (warehouse, mocked)
  └─ /api/connectors/bigquery     — getSpendAnalytics  (warehouse, mocked)
        ▲ getCustomer360 fans out across all four and joins on customerId
```

## Key decisions

1. **Constrained generation, not codegen.** The model's *only* output is a small
   JSON spec selecting from a fixed registry (`src/lib/registry.ts`: 7
   components, 3 actions, 7 read tools over 4 connectors). No code, no SQL. This makes the system
   governable and the build achievable in the time budget. The OpenAI tool
   schema uses the registry as `enum`s, so even a misbehaving model can't name a
   component/action that doesn't exist; `buildSpec()` then re-validates.

2. **Governance lives in the API, never in the model.** Identity/role come from a
   signed JWT in an httpOnly cookie (`src/lib/auth.ts`). Every read
   (`/api/tools/execute`) and every write (`/api/actions/execute`) independently
   authorizes against the registry's `minRole`. A viewer is blocked **twice**:
   write actions are stripped from the generated spec, *and* the action endpoint
   returns 403 — so a crafted prompt or hand-rolled request still can't write.

3. **Audit is append-only and parameter-level.** `writeAudit()` records the
   resolved tool/action name **and its parameters** (not just the prose prompt),
   the target record, actor, and outcome (`success`/`denied`/`error`). Denials
   are logged too, which is what makes the governance claim verifiable.

4. **Many sources behind one connector interface.** Each tool belongs to a
   connector (`src/lib/connectors.ts`); 4 are wired up: Postgres + a REST
   microservice (both live) and Redshift + BigQuery (realistic mocks at
   `/api/connectors/*` returning warehouse-shaped rows keyed by `customerId`).
   Swapping a mock for a real driver is isolated to one fetch + a config flag.
   The composite `getCustomer360` tool **fans out across all four connectors in
   parallel and joins on `customerId`** — "one tool over many places."

5. **Data governance travels with the data (field-level masking).** Every
   connector column carries a classification (`PUBLIC`/`PII`/`FINANCIAL`/
   `SENSITIVE`). `applyMasking(columns, rows, role)` (`src/lib/governance.ts`)
   runs in the API **after** the fetch and **before** the response serializes,
   so neither the LLM nor the client ever sees raw classified values. Policy:
   PII/FINANCIAL visible to admin, masked for viewer; `SENSITIVE` (SSN, an
   ingested DB column) masked for **every** role. The audit row records exactly
   which fields were masked.

6. **Fallback is honest.** If no `OPENAI_API_KEY` is configured (or the call
   fails), a deterministic keyword composer produces the same spec shape so the
   prompt→tool surface always demos end-to-end. The UI labels which composer ran.

## Stack notes
- **Next.js 16 / React 19 (App Router)** — route handlers for the API, client
  components for the interactive surface.
- **Prisma 7** with the **`@prisma/adapter-pg` driver adapter** (Prisma 7 moved
  the connection URL out of `schema.prisma` into `prisma.config.ts` + a runtime
  adapter; see `src/lib/prisma.ts`).
- **Tailwind v4** for UI speed.
- **bcryptjs + jsonwebtoken** for auth.

## Data model
`User(role)` · `Customer(riskLevel,status,note,**ssn**)` · `Account(status,balance)` ·
`Transaction(status,amount)` · `AuditLog(kind,name,params,target,outcome)`.
Warehouse data (Redshift/BigQuery mocks) is derived deterministically per
customer id at the connector endpoints rather than stored.

## If continued (next steps)
Persist named tools (`Tool` table) for reuse/sharing; add NL theming via a
constrained token schema; add an eval set for the composer; widen the registry.
