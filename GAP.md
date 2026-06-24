# GAP.md — Reference video vs. this build

**Primary deliverable.** This maps each capability shown in Retool's AI app
builder reference video (https://www.youtube.com/watch?v=JYj1jOSu2i0) to
**Built / Partial / Not-built** in this thin slice, with a one-line note on what
closing each gap would take. This table is the spine of the recommendation: it
shows what a constrained-generation MVP buys you cheaply, and exactly where the
"iceberg" cost lives.

Legend: ✅ Built · 🟡 Partial · ⬜ Not built (— several are *deliberately* not
built; that contrast is the point, not a shortcoming).

| # | Capability in the video | Status | Note on what closing the gap would take |
|---|---|---|---|
| 1 | **Prompt → working internal tool** | ✅ Built | Implemented as constrained composition over a fixed registry, not codegen. |
| 2 | **Live, rendered UI from the prompt** | ✅ Built | Frontend renders the JSON tool spec (tables, cards, risk panel) immediately. |
| 3 | **Natural-language request understanding** | ✅ Built (🟡 depth) | OpenAI function-calling constrained to registry enums; deterministic fallback. Closing depth = larger registry + few-shot examples + eval set. |
| 4 | **Write-back actions (not read-only)** | ✅ Built | `freezeAccount` / `flagTransaction` / `addCustomerNote`, each mutating Postgres. |
| 5 | **Confirmation / human-in-the-loop on writes** | ✅ Built | Explicit confirm modal before any action; action re-authorized server-side. |
| 6 | **Role-based access control** | ✅ Built | `viewer` vs `admin`, enforced server-side at the tool/action layer, not by the LLM. |
| 7 | **Audit / observability of actions** | ✅ Built | Append-only audit log of every fetch/action/generation with resolved params + target; in-app view. |
| 8 | **Multiple data sources surfaced** | ✅ Built | Postgres + a mocked `/risk-score` microservice surfaced in one app. |
| 9 | **Merged Snowflake + Stripe at warehouse scale** | 🟡 Partial | We surface *two* sources, not a governed cross-warehouse join. Closing = real connectors (Stripe SDK, Snowflake driver), a join/semantic layer, pagination, and caching. |
| 10 | **Real multi-file code generation** | ⬜ Not built (deliberate) | We compose registry blocks instead. Closing = sandboxed codegen + build/preview pipeline + code review/guardrails — the most expensive piece. |
| 11 | **Free-form SQL from the model** | ⬜ Not built (deliberate guardrail) | Intentionally excluded to block injection/exfiltration. Closing safely = a SQL allow-list/parser, row-level security, and per-role query policies. |
| 12 | **Import existing React components** | ⬜ Not built | Closing = a component compiler/sandbox + a vetting/registry-ingestion flow so imports remain governed. |
| 13 | **Natural-language theming** | ⬜ Not built | Closing = a constrained theme token schema the model can set (colors/spacing), rendered via CSS variables. Low risk, ~½ day. |
| 14 | **Publish to production** | ⬜ Not built | Closing = environments (draft/prod), versioned specs, deploy + rollback, and access-controlled URLs. |
| 15 | **Connector catalog / OAuth to SaaS** | ⬜ Not built | Closing = an OAuth connector framework + secret vault + per-connector governed tools. |
| 16 | **Persisted / shareable generated apps** | 🟡 Partial | Specs are generated and audited but not saved as named, reusable apps. Closing = a `Tool` table + list/load/share UI (~½ day). |
| 17 | **Schema-aware suggestions / autocomplete** | 🟡 Partial | Registry descriptions guide the model; no live schema introspection surfaced to the user. Closing = expose table metadata to the composer + UI hints. |

## Reading of the gap

- The **cheap, high-value 80%** — prompt→tool, live render, governed write-back,
  RBAC, audit, multi-source surfacing — is achievable in a ~2h constrained build
  because the surface area is bounded by a registry.
- The **expensive 20%** — real code generation, free-form SQL, import-React,
  publish-to-prod, warehouse-scale merges — is exactly the iceberg Retool paid
  for, and is where governance gets genuinely hard (sandboxing, query policy,
  deploy/rollback, secret management).
- **Recommendation spine:** for most internal-tooling needs, *constrained
  generation over a governed registry* delivers the demoable value with a
  fraction of the risk and cost. Reserve true codegen for the cases that
  genuinely need it, and budget for the governance iceberg before promising it.
