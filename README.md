# ScopeDesk

A searchable atlas of every module in [rapid7/metasploit-framework](https://github.com/rapid7/metasploit-framework) plus an authorised engagement planner that exports check-first Metasploit resource scripts and Markdown engagement reports.

ScopeDesk **plans and documents — it never executes modules.** Run exported `.rc` scripts only in your own `msfconsole`, only against systems you own or have written authorisation to test.

## Quick start

```bash
node scripts/ingest.mjs   # download + normalise the upstream catalogue (7,265 modules)
node server.mjs           # http://localhost:4177
npm test                  # API test suite
```

No dependencies. Node 20+ only. Refresh the catalogue any time by re-running the ingest — it pulls `db/modules_metadata_base.json` from the upstream master branch, the same metadata `msfconsole` itself uses.

## What it does

- **Stats dashboard** — modules by type/rank/year, distinct CVEs covered, newest disclosures.
- **Search** — keyword / CVE / author / description, filtered by type, service, platform, minimum rank, disclosure year, and "has safe `check()`".
- **Module detail** — rank, disclosure date, port, platform, stability/side-effect notes, references, link to source on GitHub.
- **Engagement planner** — confirm authorisation, list in-scope hosts, add modules; exports:
  - `scopedesk.rc` — `msfconsole -r scopedesk.rc`. Auxiliary modules run; exploits are emitted as `check` only.
  - `engagement-report.md` — client-readable plan with scope, selected checks and the execution rule.

## API

| Endpoint | Description |
|---|---|
| `GET /api/stats` | Catalogue totals, breakdowns, newest modules |
| `GET /api/modules?q=&type=&service=&platform=&minRank=&year=&check=1&sort=rank\|newest\|updated\|name&page=&limit=` | Search |
| `GET /api/modules/:id` | Full module detail |
| `POST /api/plan` | `{client, hosts[], authorized:true, moduleIds[], notes}` → `{rc, report}`. Returns 400 without authorisation confirmation. |

## Layout

- `scripts/ingest.mjs` — upstream ingest → `data/modules.json`
- `server.mjs` — zero-dependency HTTP server + API + plan builder
- `public/` — atlas UI (vanilla JS)
- `test/` — `node --test` API suite
- `PITCH.md` — product pitch · `HOSTING.md` — production hosting options

Upstream data © Rapid7 and contributors, under the Metasploit Framework license. ScopeDesk code MIT.
