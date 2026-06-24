# Demo script — AI Tool Generator

A presenter/voiceover script for the end-to-end demo (≈5–6 min). It mirrors the
recorded walkthrough and the three pillars. Stage directions are in _italics_;
spoken narration is in plain text. Times are approximate.

**Setup before recording:** `docker compose up --build`, browser maximized at
`http://localhost:3000/login`. Seeded users: `admin@example.com / admin123`,
`viewer@example.com / viewer123`.

---

## 0. Framing (0:00–0:30)

> This is an **AI Tool Generator** — a thin, honest slice of the paradigm in
> Retool's new AI app builder. You describe an internal tool in plain English and
> it composes a **working, governed** tool over real data.
>
> The deliberate scoping decision: this is **constrained generation, not codegen**.
> A prompt resolves to a composition over a *fixed registry* of governed
> components and actions — never free-form code or SQL. That's what makes it
> governable, and it's the contrast with the video we want to highlight, not hide.

---

## 1. Pillar 1 — Connectivity (0:30–1:15)

_Log in as **admin**. Click **Connectors**._

> First, connectivity. Every data tool lives behind a **connector interface**.
> We have four sources here: a **Postgres** core banking DB and a **REST
> risk-scoring microservice** — both live — plus a **Redshift** and a **BigQuery**
> warehouse, which are realistic mocks behind the same interface.
>
> The point is the abstraction: adding a real warehouse is a connector config and
> a driver, not a rewrite. And notice every field is **classified** —
> `PUBLIC`, `PII`, `FINANCIAL`, or `SENSITIVE`. That classification is what
> governance keys off of, server-side.

_Point at SSN (SENSITIVE), Email (PII), Balance/Lifetime spend (FINANCIAL)._

---

## 2. Pillar 2 — Generation + multi-source join (1:15–2:15)

_Go to **Generator** (admin). Click the suggestion **"Build a unified customer 360
for high-risk customers"**._

> Now generation. I'll ask for a unified customer 360 for high-risk customers.
>
> The prompt resolves to a spec — a `Customer360Table` bound to a `getCustomer360`
> tool — and it renders live. Under the hood this **one tool fans out across all
> four connectors in parallel and joins them on `customerId`**: identity from
> Postgres, model score from the risk service, session counts from Redshift,
> lifetime spend from BigQuery. That's the "build one tool over many places"
> capability.
>
> And even as an admin, **SSN is masked** — that's a field we block for everyone.

_Point at the "source: postgres + risk-service + redshift + bigquery" line and the
masked SSN column._

---

## 3. Eject to code (2:15–3:00)

_Click the **Code** tab on the generated tool._

> Here's the new piece: **eject to code**. The admin is usually the technical
> person, so once the prototype looks right they can take it into a real codebase.
>
> The Code tab serializes the composition into a **self-contained React/TypeScript
> component** plus the underlying spec as JSON — both copyable.
>
> Two things matter. One: this is a **deterministic spec→code serializer**, not
> free-form codegen — same constrained-generation guarantee. Two: the generated
> code calls the **same governed endpoints** the app uses, so masking and
> permissions stay enforced server-side. The ejected code **can't bypass
> governance**.

_Click **Copy** to show the "Copied" feedback. Briefly switch to the `.spec.json`
tab._

---

## 4. Pillar 2 — Write-back with confirmation (3:00–3:45)

_Click the suggestion **"Show me high-risk customers with a freeze button"**.
Switch to the **Preview** tab. Scroll to **Accounts**._

> A real tool isn't read-only, so let's do a write-back. This composition adds a
> `freezeAccount` action to the account cards.
>
> I'll freeze an account — note the **explicit confirmation step**. It tells me
> this is a write-back that will be authorized server-side and recorded in the
> audit log.

_Click **Freeze account** on the first card → **Confirm Freeze account**._

> Done — the account flips from **active to frozen**, with a toast. That write hit
> Postgres, re-authorized against my admin role on the server.

---

## 5. Pillar 3 — Audit (3:45–4:15)

_Click **Audit Log**._

> Every generation, every data fetch, and every write is in an **append-only audit
> log**. Here's the `freezeAccount` action with the resolved name, the target
> account, and parameters — not just the prose prompt.
>
> And critically, each data fetch records **which classified fields were masked**.
> As admin, the customer fetches show `maskedFields: ["ssn"]`.

_Point at the `freezeAccount` row (target) and a `data_fetch` row's `maskedFields`._

---

## 6. Pillar 3 — Governance under a different role (4:15–5:15)

_Sign out. Log in as **viewer**. Go to **Generator**. Click **"Build a unified
customer 360 for high-risk customers"**._

> Now the stress test. Same app, same prompts, but as a **viewer**.
>
> Same customer 360 — but now **email, IP, and lifetime spend are also masked**, on
> top of SSN. The masking is decided **server-side by role**, before the data ever
> leaves the API. The model and the client never see raw values.

_Click the **Code** tab._

> The ejected code reflects that too — it's read-only.

_Click **"Show me high-risk customers with a freeze button"**._

> And here's the key governance moment: I asked a viewer for a **freeze button**.
> The server **strips the write action** — "Removed freezeAccount, requires admin
> role" — regardless of how I word the prompt. A viewer's tool is *physically
> unable* to write.

_Click the **Code** tab to show the read-only ejected code (no `runAction`)._

> The ejected code has no write helper either. Governance travels all the way out
> to the code an engineer would copy.

---

## 7. Close — what was vs. wasn't replicated (5:15–6:00)

> So, honestly: what's built versus what isn't.
>
> **Built:** prompt→working tool, live render, a multi-connector abstraction with
> server-side fan-out and join, field-level data governance, write-back with
> confirmation, role-based access enforced server-side, an audit log, and eject to
> code.
>
> **Deliberately not built:** real free-form multi-file codegen, free-form SQL from
> the model, import-React, natural-language theming, and publish-to-production.
> Those are the expensive part of the iceberg — and exactly where governance gets
> genuinely hard. The full breakdown is in `GAP.md`.
>
> The recommendation: for most internal-tooling needs, **constrained generation
> over a governed registry** delivers the demoable value at a fraction of the cost
> and risk. Reserve true codegen for the cases that actually need it — and budget
> for the governance iceberg before you promise it.

---

## Quick shot list (for editing / re-recording)

| # | Screen | Action | Key on-screen evidence |
|---|--------|--------|------------------------|
| 1 | Connectors | view | 4 connectors; PII/FINANCIAL/SENSITIVE tags |
| 2 | Generator (admin) | "customer 360" | source: postgres + risk-service + redshift + bigquery; SSN masked |
| 3 | Code tab | toggle + Copy | `.tsx` + `.spec.json`; "Copied" |
| 4 | Generator (admin) | "freeze button" → Preview → Freeze → Confirm | account active → frozen + toast |
| 5 | Audit Log | view | `freezeAccount` (target) + `maskedFields:["ssn"]` |
| 6 | Generator (viewer) | "customer 360" | email/IP/spend also masked |
| 7 | Generator (viewer) | "freeze button" + Code | "Removed freezeAccount"; read-only ejected code |
