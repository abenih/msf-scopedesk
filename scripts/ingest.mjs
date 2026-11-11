// Ingests the real module catalogue from rapid7/metasploit-framework.
// Source of truth: db/modules_metadata_base.json on the upstream master branch
// (the same file msfconsole itself uses for module search/autocomplete).
import { writeFile, mkdir } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/rapid7/metasploit-framework/master/db/modules_metadata_base.json';
const RANK_NAMES = { 0: 'manual', 100: 'low', 200: 'average', 300: 'normal', 400: 'good', 500: 'great', 600: 'excellent' };

console.log('Fetching', SRC);
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Upstream fetch failed: ${res.status}`);
const raw = await res.json();

const modules = Object.values(raw).map((m, i) => {
  const refs = m.references || [];
  const cves = refs.filter(r => r.startsWith('CVE-')).map(r => r.slice(4));
  return {
    id: i,
    fullname: m.fullname,
    name: (m.name || '').trim(),
    type: m.type,
    rank: m.rank,
    rankName: RANK_NAMES[m.rank] ?? String(m.rank),
    disclosureDate: m.disclosure_date || null,
    year: m.disclosure_date ? Number(m.disclosure_date.slice(0, 4)) : null,
    authors: m.author || [],
    description: (m.description || '').replace(/\s+/g, ' ').trim(),
    cves,
    references: refs,
    platform: m.platform || '',
    arch: m.arch || '',
    rport: m.rport || null,
    services: m.autofilter_services || [],
    check: !!m.check,
    postAuth: !!m.post_auth,
    defaultCredential: !!m.default_credential,
    stability: m.notes?.Stability || [],
    sideEffects: m.notes?.SideEffects || [],
    reliability: m.notes?.Reliability || [],
    modTime: m.mod_time || null,
    sourcePath: m.path || '',
    sourceUrl: `https://github.com/rapid7/metasploit-framework/blob/master${(m.path || '').replace(/^\/modules/, '/modules')}`,
  };
});

modules.sort((a, b) => a.fullname.localeCompare(b.fullname));
modules.forEach((m, i) => (m.id = i));

await mkdir(new URL('../data', import.meta.url), { recursive: true });
await writeFile(new URL('../data/modules.json', import.meta.url), JSON.stringify(modules));
const byType = {};
for (const m of modules) byType[m.type] = (byType[m.type] || 0) + 1;
console.log(`Wrote ${modules.length} modules`, byType);
console.log(`With CVE refs: ${modules.filter(m => m.cves.length).length}, with check(): ${modules.filter(m => m.check).length}`);
