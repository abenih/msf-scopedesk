// ScopeDesk — GitHub Pages (static) edition.
// All search + planning runs in the browser against data/modules.json,
// which is ingested from rapid7/metasploit-framework. Nothing is executed,
// nothing leaves the browser.
const $ = s => document.querySelector(s);
let MODULES = [], page = 1, plan = JSON.parse(localStorage.getItem('scopedesk-plan') || '[]'), lastPlan = null;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function stats() {
  const byType = {}; let check = 0; const cves = new Set();
  for (const m of MODULES) { byType[m.type] = (byType[m.type] || 0) + 1; if (m.check) check++; m.cves.forEach(c => cves.add(c)); }
  $('#stats').innerHTML = [
    [MODULES.length.toLocaleString(), 'modules indexed'], [cves.size.toLocaleString(), 'distinct CVEs'],
    [check.toLocaleString(), 'with safe check()'], [(byType.exploit || 0).toLocaleString(), 'exploits'],
    [(byType.auxiliary || 0).toLocaleString(), 'auxiliary / scanners'],
  ].map(([n, l]) => `<div class="stat"><b>${n}</b>${l}</div>`).join('');
}

function search() {
  const q = $('#q').value.toLowerCase(), type = $('#type').value, service = $('#service').value.toLowerCase();
  const minRank = $('#minRank').value ? Number($('#minRank').value) : null, checkOnly = $('#checkOnly').checked, sort = $('#sort').value;
  let out = MODULES.filter(m => {
    if (type && m.type !== type) return false;
    if (checkOnly && !m.check) return false;
    if (minRank !== null && m.rank < minRank) return false;
    if (service && !m.services.some(s => s.toLowerCase().includes(service))) return false;
    if (q) { const hay = `${m.fullname} ${m.name} ${m.description} ${m.cves.map(c => 'cve-' + c).join(' ')} ${m.authors.join(' ')}`.toLowerCase(); if (!q.split(/\s+/).every(t => hay.includes(t))) return false; }
    return true;
  });
  const sorters = { rank: (a, b) => b.rank - a.rank || a.fullname.localeCompare(b.fullname), newest: (a, b) => (b.disclosureDate || '').localeCompare(a.disclosureDate || ''), name: (a, b) => a.fullname.localeCompare(b.fullname), updated: (a, b) => (b.modTime || '').localeCompare(a.modTime || '') };
  out.sort(sorters[sort] || sorters.rank);
  const total = out.length, limit = 25;
  $('#resultCount').textContent = `${total.toLocaleString()} modules match`;
  $('#pageInfo').textContent = `Page ${page} of ${Math.max(1, Math.ceil(total / limit))}`;
  out = out.slice((page - 1) * limit, page * limit);
  $('#results').innerHTML = out.map(m => `<div class="card">
    <h3><code data-detail="${m.id}">${esc(m.fullname)}</code></h3><div>${esc(m.name)}</div>
    <div class="meta"><span>${m.type}</span><span>rank ${m.rankName}</span>${m.disclosureDate ? `<span>disclosed ${m.disclosureDate}</span>` : ''}${m.rport ? `<span>port ${m.rport}</span>` : ''}${m.platform ? `<span>${esc(m.platform)}</span>` : ''}</div>
    <div>${m.cves.slice(0, 4).map(c => `<span class="pill cve">CVE-${c}</span>`).join('')}${m.check ? '<span class="pill check">check()</span>' : ''}${m.services.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>
    <p class="desc">${esc(m.description.slice(0, 240))}…</p>
    <div class="rowbtns"><button data-detail="${m.id}">Details</button><button data-add="${m.id}" data-name="${esc(m.fullname)}">+ Plan</button></div>
  </div>`).join('') || '<p class="muted">No matches — try a broader search.</p>';
}

function renderPlan() {
  $('#planCount').textContent = plan.length;
  $('#planList').innerHTML = plan.length ? plan.map((m, i) => `<div><span>${esc(m.fullname)}</span><button data-rm="${i}">✕</button></div>`).join('') : '<em class="muted">No modules yet.</em>';
  localStorage.setItem('scopedesk-plan', JSON.stringify(plan));
}

function detail(id) {
  const m = MODULES.find(x => x.id === Number(id)); if (!m) return;
  $('#drawerBody').innerHTML = `<h2>${esc(m.name)}</h2><p><code>${esc(m.fullname)}</code></p>
    <p class="meta">${m.type} · rank ${m.rankName} (${m.rank})${m.disclosureDate ? ' · disclosed ' + m.disclosureDate : ''}${m.rport ? ' · port ' + m.rport : ''}</p>
    <p>${esc(m.description)}</p>
    ${m.cves.length ? `<p>${m.cves.map(c => `<span class="pill cve">CVE-${c}</span>`).join(' ')}</p>` : ''}
    <p class="meta">Authors: ${esc(m.authors.join(', ') || '—')}<br>Platform: ${esc(m.platform || '—')} · Arch: ${esc(m.arch || '—')} · check(): ${m.check ? 'yes' : 'no'}<br>Stability: ${esc(m.stability.join(', ') || '—')} · Side effects: ${esc(m.sideEffects.join(', ') || '—')}</p>
    <p>References: ${m.references.map(r => r.startsWith('URL-') ? `<a href="${esc(r.slice(4))}" target="_blank" rel="noopener">link</a>` : esc(r)).join(' · ')}</p>
    <p><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">Module source on GitHub ↗</a></p>
    <button data-add="${m.id}" data-name="${esc(m.fullname)}">+ Add to engagement plan</button>`;
  $('#drawer').hidden = false;
}

function buildPlan() {
  const errors = [];
  if (!$('#authorized').checked) errors.push('Authorisation must be confirmed: only plan engagements on systems you own or have written permission to test.');
  const hosts = $('#hosts').value.split(/[\n,]+/).map(h => h.trim()).filter(Boolean);
  if (!hosts.length) errors.push('At least one in-scope host is required.');
  for (const h of hosts) if (!/^[a-zA-Z0-9._\-/:]+$/.test(h) || h.length > 253) errors.push(`Invalid host entry: ${h}`);
  const chosen = plan.map(p => MODULES.find(m => m.id === p.id)).filter(Boolean);
  if (!chosen.length) errors.push('Select at least one module for the plan.');
  if (errors.length) { $('#planError').textContent = errors.join(' '); $('#planOut').hidden = true; return; }
  const runnable = chosen.filter(m => m.type === 'auxiliary' || (m.type === 'exploit' && m.check));
  const reviewOnly = chosen.filter(m => !runnable.includes(m));
  const client = $('#client').value || 'Unnamed engagement';
  const rc = [`# ScopeDesk engagement resource script`, `# Client: ${client}  Generated: ${new Date().toISOString()}`,
    `# Scope (authorised hosts only): ${hosts.join(', ')}`, `# Run in YOUR msfconsole on YOUR authorised lab:  msfconsole -r scopedesk.rc`,
    `setg RHOSTS ${hosts.join(' ')}`, `spool scopedesk-${Date.now()}.log`,
    ...runnable.flatMap(m => ['', `# ${m.fullname} — ${m.name}${m.cves.length ? ' [' + m.cves.map(c => 'CVE-' + c).join(', ') + ']' : ''}`, `use ${m.fullname}`, ...(m.type === 'exploit' ? ['check'] : ['run']), 'back']),
    '', 'spool off', 'exit'].join('\n');
  const report = [`# Engagement Plan — ${client}`, '', `Generated by ScopeDesk on ${new Date().toISOString().slice(0, 10)} from rapid7/metasploit-framework module metadata.`, '',
    '## Authorisation', 'Operator confirmed written authorisation for the in-scope hosts below.', '', '## In-scope hosts', ...hosts.map(h => `- ${h}`), '',
    `## Selected checks (${chosen.length})`, ...chosen.map(m => `- **${m.fullname}** (${m.type}, rank ${m.rankName}${m.check ? ', has check()' : ''})${m.cves.length ? ' — ' + m.cves.map(c => 'CVE-' + c).join(', ') : ''}\n  ${m.name}`), '',
    '## Execution rule', 'Auxiliary modules run as-is against in-scope hosts. Exploit modules are included as `check` only; any exploitation step requires a separate, explicit go-ahead recorded in the engagement notes.', '',
    '## Notes', $('#notes').value || '—'].join('\n');
  lastPlan = { rc, report };
  $('#planError').textContent = reviewOnly.length ? `Note: ${reviewOnly.length} module(s) are report-only and were left out of the .rc: ${reviewOnly.map(m => m.fullname).join(', ')}` : '';
  $('#rcOut').textContent = rc; $('#reportOut').textContent = report; $('#planOut').hidden = false;
}

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]'), det = e.target.closest('[data-detail]'), rm = e.target.closest('[data-rm]'), dl = e.target.closest('[data-dl]');
  if (add) { if (!plan.some(p => p.id == add.dataset.add)) plan.push({ id: Number(add.dataset.add), fullname: add.dataset.name }); renderPlan(); }
  if (det) detail(det.dataset.detail);
  if (rm) { plan.splice(Number(rm.dataset.rm), 1); renderPlan(); }
  if (dl && lastPlan) { const isRc = dl.dataset.dl === 'rc'; const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([isRc ? lastPlan.rc : lastPlan.report], { type: 'text/plain' })), download: isRc ? 'scopedesk.rc' : 'engagement-report.md' }); a.click(); URL.revokeObjectURL(a.href); }
});
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); page = 1; search(); });
$('#prev').onclick = () => { if (page > 1) { page--; search(); } };
$('#next').onclick = () => { page++; search(); };
$('#closeDrawer').onclick = () => $('#drawer').hidden = true;
$('#buildPlan').onclick = buildPlan;

$('#resultCount').textContent = 'Loading the full Metasploit catalogue (7.9 MB)…';
fetch('data/modules.json').then(r => r.json()).then(d => { MODULES = d; stats(); search(); renderPlan(); })
  .catch(() => { $('#resultCount').textContent = 'Failed to load module data — check your connection and reload.'; });
