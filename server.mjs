// ScopeDesk server — zero-dependency Node HTTP server.
// Serves the module atlas UI + JSON API + engagement-plan generator.
// It never executes Metasploit modules. It plans authorised engagements and
// exports a resource (.rc) script the operator runs in their own msfconsole,
// on systems they own or are authorised to test.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 4177;
const modules = JSON.parse(await readFile(join(ROOT, 'data/modules.json'), 'utf8'));
const byId = new Map(modules.map(m => [m.id, m]));

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

function stats() {
  const byType = {}, byRank = {}, byYear = {};
  let cveCount = 0, checkCount = 0;
  for (const m of modules) {
    byType[m.type] = (byType[m.type] || 0) + 1;
    byRank[m.rankName] = (byRank[m.rankName] || 0) + 1;
    if (m.year) byYear[m.year] = (byYear[m.year] || 0) + 1;
    cveCount += m.cves.length; if (m.check) checkCount++;
  }
  const newest = [...modules].filter(m => m.disclosureDate).sort((a, b) => b.disclosureDate.localeCompare(a.disclosureDate)).slice(0, 10)
    .map(m => ({ id: m.id, fullname: m.fullname, name: m.name, disclosureDate: m.disclosureDate, cves: m.cves }));
  return { total: modules.length, byType, byRank, byYear, distinctCves: new Set(modules.flatMap(m => m.cves)).size, cveRefs: cveCount, withCheck: checkCount, newest };
}

function search(params) {
  const q = (params.get('q') || '').toLowerCase();
  const type = params.get('type'), platform = (params.get('platform') || '').toLowerCase();
  const service = (params.get('service') || '').toLowerCase();
  const minRank = params.get('minRank') ? Number(params.get('minRank')) : null;
  const checkOnly = params.get('check') === '1';
  const year = params.get('year') ? Number(params.get('year')) : null;
  const sort = params.get('sort') || 'rank';
  let out = modules.filter(m => {
    if (type && m.type !== type) return false;
    if (checkOnly && !m.check) return false;
    if (minRank !== null && m.rank < minRank) return false;
    if (year && m.year !== year) return false;
    if (platform && !m.platform.toLowerCase().includes(platform)) return false;
    if (service && !m.services.some(s => s.toLowerCase().includes(service))) return false;
    if (q) {
      const hay = `${m.fullname} ${m.name} ${m.description} ${m.cves.map(c => 'cve-' + c).join(' ')} ${m.authors.join(' ')}`.toLowerCase();
      if (!q.split(/\s+/).every(tok => hay.includes(tok))) return false;
    }
    return true;
  });
  const sorters = {
    rank: (a, b) => b.rank - a.rank || a.fullname.localeCompare(b.fullname),
    newest: (a, b) => (b.disclosureDate || '').localeCompare(a.disclosureDate || ''),
    name: (a, b) => a.fullname.localeCompare(b.fullname),
    updated: (a, b) => (b.modTime || '').localeCompare(a.modTime || ''),
  };
  out.sort(sorters[sort] || sorters.rank);
  const total = out.length;
  const limit = Math.min(Number(params.get('limit') || 50), 200);
  const page = Math.max(Number(params.get('page') || 1), 1);
  out = out.slice((page - 1) * limit, page * limit)
    .map(({ description, ...rest }) => ({ ...rest, description: description.slice(0, 240) }));
  return { total, page, limit, results: out };
}

const HOST_RE = /^[a-zA-Z0-9._\-/:]+$/;
function buildPlan(body) {
  const errors = [];
  if (body.authorized !== true) errors.push('Authorisation must be confirmed: only plan engagements on systems you own or have written permission to test.');
  const hosts = (body.hosts || []).map(h => String(h).trim()).filter(Boolean);
  if (!hosts.length) errors.push('At least one in-scope host is required.');
  for (const h of hosts) if (!HOST_RE.test(h) || h.length > 253) errors.push(`Invalid host entry: ${h}`);
  const chosen = (body.moduleIds || []).map(id => byId.get(Number(id))).filter(Boolean);
  if (!chosen.length) errors.push('Select at least one module for the plan.');
  if (errors.length) return { errors };

  // Only auxiliary modules and check-capable exploits go into the runnable
  // script, and exploits are emitted as `check` only — never `run`.
  const runnable = chosen.filter(m => m.type === 'auxiliary' || (m.type === 'exploit' && m.check));
  const reviewOnly = chosen.filter(m => !runnable.includes(m));

  const rc = [
    `# ScopeDesk engagement resource script`,
    `# Client: ${body.client || 'Unnamed engagement'}  Generated: ${new Date().toISOString()}`,
    `# Scope (authorised hosts only): ${hosts.join(', ')}`,
    `# Run in YOUR msfconsole on YOUR authorised lab:  msfconsole -r scopedesk.rc`,
    `setg RHOSTS ${hosts.join(' ')}`,
    `spool scopedesk-${Date.now()}.log`,
    ...runnable.flatMap(m => [
      ``, `# ${m.fullname} — ${m.name}${m.cves.length ? ' [' + m.cves.map(c => 'CVE-' + c).join(', ') + ']' : ''}`,
      `use ${m.fullname}`,
      ...(m.type === 'exploit' ? [`check`] : [`run`]),
      `back`,
    ]),
    ``, `spool off`, `exit`,
  ].join('\n');

  const report = [
    `# Engagement Plan — ${body.client || 'Unnamed engagement'}`,
    ``, `Generated by ScopeDesk on ${new Date().toISOString().slice(0, 10)} from rapid7/metasploit-framework module metadata.`,
    ``, `## Authorisation`, `Operator confirmed written authorisation for the in-scope hosts below.`,
    ``, `## In-scope hosts`, ...hosts.map(h => `- ${h}`),
    ``, `## Selected checks (${chosen.length})`,
    ...chosen.map(m => `- **${m.fullname}** (${m.type}, rank ${m.rankName}${m.check ? ', has check()' : ''})${m.cves.length ? ' — ' + m.cves.map(c => 'CVE-' + c).join(', ') : ''}\n  ${m.name}`),
    ``, `## Execution rule`, `Auxiliary modules run as-is against in-scope hosts. Exploit modules are included as \`check\` only; any exploitation step requires a separate, explicit go-ahead recorded in the engagement notes.`,
    ``, `## Notes`, body.notes || '—',
  ].join('\n');

  return { rc, report, runnableCount: runnable.length, reviewOnly: reviewOnly.map(m => m.fullname) };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/stats') return json(res, 200, stats());
    if (url.pathname === '/api/modules') return json(res, 200, search(url.searchParams));
    const detail = url.pathname.match(/^\/api\/modules\/(\d+)$/);
    if (detail) { const m = byId.get(Number(detail[1])); return m ? json(res, 200, m) : json(res, 404, { error: 'module not found' }); }
    if (url.pathname === '/api/plan' && req.method === 'POST') {
      let data = ''; for await (const chunk of req) data += chunk;
      const plan = buildPlan(JSON.parse(data || '{}'));
      return plan.errors ? json(res, 400, { errors: plan.errors }) : json(res, 200, plan);
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = normalize(join(ROOT, 'public', rel));
    if (!path.startsWith(join(ROOT, 'public'))) { res.writeHead(403); return res.end('forbidden'); }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) { json(res, e.code === 'ENOENT' ? 404 : 500, { error: e.code === 'ENOENT' ? 'not found' : e.message }); }
});

server.listen(PORT, () => console.log(`ScopeDesk running at http://localhost:${PORT} — ${modules.length} Metasploit modules loaded`));
