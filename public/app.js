const $ = s => document.querySelector(s);
let page = 1, plan = JSON.parse(localStorage.getItem('scopedesk-plan') || '[]'), lastPlan = null;

async function loadStats() {
  const s = await (await fetch('/api/stats')).json();
  $('#stats').innerHTML = [
    [s.total.toLocaleString(), 'modules indexed'], [s.distinctCves.toLocaleString(), 'distinct CVEs'],
    [s.withCheck.toLocaleString(), 'with safe check()'], [s.byType.exploit.toLocaleString(), 'exploits'],
    [s.byType.auxiliary.toLocaleString(), 'auxiliary / scanners'],
  ].map(([n, l]) => `<div class="stat"><b>${n}</b>${l}</div>`).join('');
}

async function search() {
  const p = new URLSearchParams({ q: $('#q').value, type: $('#type').value, service: $('#service').value,
    minRank: $('#minRank').value, check: $('#checkOnly').checked ? '1' : '', sort: $('#sort').value, page, limit: 25 });
  const d = await (await fetch('/api/modules?' + p)).json();
  $('#resultCount').textContent = `${d.total.toLocaleString()} modules match`;
  $('#pageInfo').textContent = `Page ${d.page} of ${Math.max(1, Math.ceil(d.total / d.limit))}`;
  $('#results').innerHTML = d.results.map(m => `<div class="card">
    <h3><code data-detail="${m.id}">${m.fullname}</code></h3>
    <div>${m.name}</div>
    <div class="meta"><span>${m.type}</span><span>rank ${m.rankName}</span>${m.disclosureDate ? `<span>disclosed ${m.disclosureDate}</span>` : ''}${m.rport ? `<span>port ${m.rport}</span>` : ''}${m.platform ? `<span>${m.platform}</span>` : ''}</div>
    <div>${m.cves.slice(0, 4).map(c => `<span class="pill cve">CVE-${c}</span>`).join('')}${m.check ? '<span class="pill check">check()</span>' : ''}${m.services.map(s => `<span class="pill">${s}</span>`).join('')}</div>
    <p class="desc">${m.description}…</p>
    <div class="rowbtns"><button data-detail="${m.id}">Details</button><button data-add="${m.id}" data-name="${m.fullname}">+ Plan</button></div>
  </div>`).join('') || '<p class="muted">No matches — try a broader search.</p>';
}

function renderPlan() {
  $('#planCount').textContent = plan.length;
  $('#planList').innerHTML = plan.length ? plan.map((m, i) => `<div><span>${m.fullname}</span><button data-rm="${i}">✕</button></div>`).join('') : '<em class="muted">No modules yet.</em>';
  localStorage.setItem('scopedesk-plan', JSON.stringify(plan));
}

async function detail(id) {
  const m = await (await fetch('/api/modules/' + id)).json();
  $('#drawerBody').innerHTML = `<h2>${m.name}</h2><p><code>${m.fullname}</code></p>
    <p class="meta">${m.type} · rank ${m.rankName} (${m.rank})${m.disclosureDate ? ' · disclosed ' + m.disclosureDate : ''}${m.rport ? ' · port ' + m.rport : ''}</p>
    <p>${m.description}</p>
    ${m.cves.length ? `<p>${m.cves.map(c => `<span class="pill cve">CVE-${c}</span>`).join(' ')}</p>` : ''}
    <p class="meta">Authors: ${m.authors.join(', ') || '—'}<br>Platform: ${m.platform || '—'} · Arch: ${m.arch || '—'} · check(): ${m.check ? 'yes' : 'no'}<br>Stability: ${m.stability.join(', ') || '—'} · Side effects: ${m.sideEffects.join(', ') || '—'}</p>
    <p>References: ${m.references.map(r => r.startsWith('URL-') ? `<a href="${r.slice(4)}" target="_blank" rel="noopener">link</a>` : r).join(' · ')}</p>
    <p><a href="${m.sourceUrl}" target="_blank" rel="noopener">Module source on GitHub ↗</a></p>
    <button data-add="${m.id}" data-name="${m.fullname}">+ Add to engagement plan</button>`;
  $('#drawer').hidden = false;
}

document.addEventListener('click', async e => {
  const add = e.target.closest('[data-add]'), det = e.target.closest('[data-detail]'), rm = e.target.closest('[data-rm]'), dl = e.target.closest('[data-dl]');
  if (add) { if (!plan.some(p => p.id == add.dataset.add)) plan.push({ id: Number(add.dataset.add), fullname: add.dataset.name }); renderPlan(); }
  if (det) detail(det.dataset.detail);
  if (rm) { plan.splice(Number(rm.dataset.rm), 1); renderPlan(); }
  if (dl && lastPlan) {
    const isRc = dl.dataset.dl === 'rc';
    const blob = new Blob([isRc ? lastPlan.rc : lastPlan.report], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: isRc ? 'scopedesk.rc' : 'engagement-report.md' });
    a.click(); URL.revokeObjectURL(a.href);
  }
});
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); page = 1; search(); });
$('#prev').onclick = () => { if (page > 1) { page--; search(); } };
$('#next').onclick = () => { page++; search(); };
$('#closeDrawer').onclick = () => $('#drawer').hidden = true;
$('#buildPlan').onclick = async () => {
  const hosts = $('#hosts').value.split(/[\n,]+/).map(h => h.trim()).filter(Boolean);
  const r = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client: $('#client').value, hosts, authorized: $('#authorized').checked, notes: $('#notes').value, moduleIds: plan.map(p => p.id) }) });
  const d = await r.json();
  if (!r.ok) { $('#planError').textContent = (d.errors || []).join(' '); $('#planOut').hidden = true; return; }
  $('#planError').textContent = ''; lastPlan = d;
  $('#rcOut').textContent = d.rc; $('#reportOut').textContent = d.report; $('#planOut').hidden = false;
  if (d.reviewOnly.length) $('#planError').textContent = `Note: ${d.reviewOnly.length} selected module(s) are report-only (no check / not auxiliary) and were left out of the .rc: ${d.reviewOnly.join(', ')}`;
};

loadStats(); search(); renderPlan();
