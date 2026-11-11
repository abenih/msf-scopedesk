# ScopeDesk — the pitch

## One line
Metasploit has 7,265 modules and a terminal from 2003. ScopeDesk is the web atlas and engagement planner on top of it: find the right check in seconds, build an authorised, check-first test plan, and hand the client a clean report — without ever running an exploit from a browser.

## The problem (checked, not guessed)
- rapid7/metasploit-framework is the world's standard open-source pentest framework: 39,517 GitHub stars, 15,034 forks, updated daily — and its interface is still `msfconsole`, a Ruby terminal.
- The framework's own metadata file (`db/modules_metadata_base.json`, 11.4 MB) catalogues **7,265 modules**: 2,723 exploits, 1,371 auxiliary/scanners, 436 post modules, the rest payloads/encoders/evasion. **3,138 modules map to CVEs; only 1,763 have a safe `check()`** — and in the console there is no easy way to answer the questions a client engagement actually starts with:
  - "Are we affected by CVE-2024-…?" → which modules cover it, on what platform, how reliable are they?
  - "What can you check *without* trying to exploit us?" → the check-capable subset.
  - "Show me the plan before you touch anything." → today that plan is a hand-typed document.

## The product
1. **Module Atlas** — the full upstream catalogue, live-ingested from GitHub, searchable by keyword, CVE, service (http/smb/ssh/…), platform, rank and disclosure year, with a detail view linking straight to the module source.
2. **Engagement Planner** — the operator confirms written authorisation and lists in-scope hosts, picks modules, and ScopeDesk exports:
   - a Metasploit resource script (`.rc`) to run in *their own* msfconsole — auxiliary modules run, **exploits are emitted as `check` only, never `run`**;
   - a Markdown engagement plan/report the client can read and sign off.
3. **Safety as the feature** — no module is ever executed by ScopeDesk itself. Authorisation is a hard gate in the API (the plan endpoint refuses without it), scope is explicit, and non-check exploits are report-only. That is exactly the posture a paying client, an auditor, or an employer like INSA wants to see.

## Who pays, and for what
- **Freelance / boutique pentesters (the SatiraLabs seat):** saves the first half-day of every engagement — scoping, module selection, plan document. Sold as part of a paid security assessment, not as a separate line item at first.
- **Small security teams:** a shared, always-current module reference beats a stale internal wiki; roadmap adds team workspaces and saved engagements.
- **Training labs:** students learn the catalogue and safe-check discipline before they ever get a shell.

Pricing sketch (to validate): free self-hosted single-operator tier; paid tier bundled into assessments; later, a hosted team tier at a per-seat monthly price once saved engagements and user accounts land.

## Why this wins
- Built on the real upstream data — re-running the ingest refreshes the whole catalogue from Rapid7's master branch, so it never goes stale the way blog posts and cheat-sheets do.
- Zero dependencies, one Node file for the server: it runs anywhere Node 20+ runs, including a $5 VPS.
- The check-first, authorisation-gated design is a differentiator, not a limitation — it's what makes the tool sellable to cautious clients.

## Status — v0.1 built today
Working: ingest (7,265 modules verified), stats/search/detail APIs, atlas UI, planner with .rc + report export, automated tests. See README for how to run it and HOSTING.md for production options.

## Roadmap
- v0.2: optional Docker sidecar running real `msfconsole`/`msfrpcd` so an operator can execute the exported plan inside their own isolated lab VM from ScopeDesk, with full session logging.
- v0.3: saved engagements, accounts, PDF reports, CVE-feed watchlist ("alert me when a module for CVE-X lands upstream").
- v1.0: team tier, client portal where the client approves scope before any check runs.
