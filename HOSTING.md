# Hosting ScopeDesk — what you actually need

## The app itself (v0.1, what is built)
ScopeDesk is one zero-dependency Node process serving a 7.9 MB static JSON catalogue.

- **Minimum:** any host with Node 20+ and ~256 MB RAM — a $5/mo VPS (1 vCPU/1 GB) is more than enough. Or serverless/static: the UI + catalogue JSON can be served statically, with `/api/plan` as a single small function.
- **Run it:**
  ```bash
  git clone <this repo> && cd msf-scopedesk
  node scripts/ingest.mjs
  PORT=4177 node server.mjs        # put Caddy/nginx in front for HTTPS
  ```
- **Refresh data:** cron `node scripts/ingest.mjs` daily — upstream adds modules most days.
- **Before public exposure:** add auth (the planner is an operator tool — do not leave it open on the internet), HTTPS via Caddy (automatic Let's Encrypt), and a reverse proxy. No database, no secrets, no user data stored server-side in v0.1 (plans live in the browser's localStorage).

## If you also want to RUN Metasploit itself (the v0.2 sidecar)
That is a separate, heavier box — **never the public web server**:

- Official route: Rapid7's Docker image (`metasploitframework/metasploit-framework`) or Kali Linux.
- **Sizing:** 2 vCPU / 4 GB RAM minimum, 8 GB comfortable; ~10 GB disk. A local lab VM (e.g. on the Arch PC or a dedicated VPS you control) is the right home.
- **Exposure rule:** `msfrpcd` / the console must stay on localhost or a private network (Tailscale/WireGuard) — never port-forwarded to the internet.
- **Legal rule:** only run modules against systems you own or have written authorisation to test, with the scope recorded — ScopeDesk's planner exists to produce exactly that record.

## Cost summary
| Setup | Cost |
|---|---|
| ScopeDesk alone on a small VPS | ~$5/mo |
| ScopeDesk on an existing VPS (e.g. alongside other SatiraLabs sites) | $0 extra |
| Metasploit lab sidecar on a local VM | $0 (own hardware) |
| Domain | optional — a subdomain of an existing domain works |
