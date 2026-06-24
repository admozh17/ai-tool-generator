# AI Tool Generator

A **deliberately thin slice** of Retool's new AI app builder
([reference video](https://www.youtube.com/watch?v=JYj1jOSu2i0)). You describe an
internal tool in plain English; the system composes a working, **governed** tool
over synthetic banking data (`customers`, `accounts`, `transactions`).

> **The core scoping decision: constrained generation, not codegen.** A prompt
> resolves to a composition of **pre-registered, governed building blocks** (a
> fixed catalog of ~4 components and ~3 actions) — **not** free-form generated
> code and **not** free-form SQL. Example: *"show me high-risk customers with a
> freeze button"* selects a `CustomerTable` bound to `listCustomers` + an
> `AccountCards` component carrying a `freezeAccount` action, and renders it.
>
> This is **not** a clone of Retool's builder. Retool's product does real
> multi-file code generation, import-React, NL theming and publish-to-prod. We
> built **one constrained generator** to interrogate the paradigm honestly. The
> contrast is the point — see [`GAP.md`](./GAP.md).

---

## Quick start

### Option A — Docker (recommended), runs in well under 5 minutes

```bash
docker compose up --build
```

This starts Postgres, applies migrations, seeds synthetic data + two users, and
serves the app at **http://localhost:3000**.

### Option B — Local Node

```bash
# 1. Start Postgres (any instance works; this matches the default .env)
docker run -d --name atg-postgres \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_tool_generator -p 5433:5432 postgres:16-alpine

# 2. Configure env + install
cp .env.example .env
npm install

# 3. Migrate + seed, then run
npm run db:setup
npm run dev
```

Open **http://localhost:3000**.

### Seeded users (in the README per the acceptance criteria)

| Role     | Email                | Password    | Can do                                   |
| -------- | -------------------- | ----------- | ---------------------------------------- |
| `admin`  | `admin@example.com`  | `admin123`  | Compose tools **with write actions**     |
| `viewer` | `viewer@example.com` | `viewer123` | Read-only data components; **no writes**  |

---

## The three pillars

### Pillar 1 — Connectivity
- **Primary source: Postgres** (via Prisma) backs `listCustomers`, `listAccounts`,
  `listTransactions`.
- **Second source: a mocked `/risk-score` microservice** (`src/app/api/risk-score`)
  with its own model-scored shape (`score`/`band`/`model`) and simulated latency,
  surfaced through the `RiskScorePanel` component. This demonstrates *"data from
  more than one place"* — **not** warehouse-scale joins (see `GAP.md`).

### Pillar 2 — Generation
- A chat input takes a natural-language request → returns a **composed tool spec**
  (JSON): which components, bound to which governed data tools, with which actions.
- The frontend **renders the composed tool live**: data components plus at least
  one **write-back action** (`freezeAccount`, `flagTransaction`, `addCustomerNote`)
  executed behind an explicit **confirmation step**.
- Generation layer: if `OPENAI_API_KEY` is set, the prompt is mapped via **OpenAI
  function-calling** whose schema enums are the registry itself (the model can
  *only* return registry members). If no key is set or the call fails, a
  **deterministic rule-based composer** produces the same spec shape. Either way
  the output is validated against the registry server-side. The active composer is
  shown in the UI (`LLM` vs `rule-based`).

### Pillar 3 — Governance (the deliberate stress test)
- **Two roles**, enforced **server-side at the tool/action layer** — the LLM never
  decides permissions. `src/app/api/tools/execute` and `src/app/api/actions/execute`
  authorize every fetch and every write against the caller's JWT role.
- A **viewer's generated tool is physically unable to write**: write actions are
  stripped from the spec at generation time *and* the action endpoint returns
  `403` for viewers regardless of prompt wording.
- **No raw SQL and no arbitrary code from the model** — it composes only from the
  fixed registry (`src/lib/registry.ts`). This is the guardrail against
  prompt-injection-driven exfiltration / destructive actions.
- **Append-only audit log**: every data fetch, write action, and generation writes
  one row — who, the resolved component/tool/action **+ parameters** (not just the
  prose prompt), the target record, outcome, and when. Surfaced in the in-app
  **Audit Log** view (`/audit`).

---

## What was / wasn't replicated (summary; full table in `GAP.md`)

| Capability (from the video)          | Status      |
| ------------------------------------ | ----------- |
| Prompt → working tool                | **Built**   |
| Live rendered UI from the prompt     | **Built**   |
| Write-back with confirmation         | **Built**   |
| Role-based governance + audit log    | **Built**   |
| Two data sources surfaced            | **Built**   |
| Real multi-file **code** generation  | Not built (deliberate) |
| Free-form SQL / arbitrary model code | Not built (deliberate guardrail) |
| Warehouse-scale Snowflake+Stripe merge | Partial (two-source surfacing only) |
| NL theming / import-React / publish  | Not built  |

## Rough time spent (timeboxed ~2h)
- Pillar 1 (connectivity + 2nd source): ~15 min
- Pillar 2 (generation + live render): ~45 min
- Pillar 3 (governance + audit): ~30 min
- Scaffolding, schema/seed, Docker, docs: ~30 min

## Tech
Next.js 16 (App Router) · TypeScript · Postgres + Prisma 7 (pg driver adapter) ·
Tailwind v4 · JWT (httpOnly cookie) auth · OpenAI function-calling (optional).

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the decisions note and
[`GAP.md`](./GAP.md) for the full reference-video gap inventory.
