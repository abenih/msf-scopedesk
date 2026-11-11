import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';

let proc; const BASE = 'http://localhost:4199';
before(async () => {
  proc = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: 4199 }, cwd: new URL('..', import.meta.url).pathname });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/stats')).ok) return; } catch {} await new Promise(r => setTimeout(r, 200)); }
  throw new Error('server did not start');
});
after(() => proc.kill());

test('stats reflect the real upstream catalogue', async () => {
  const s = await (await fetch(BASE + '/api/stats')).json();
  assert.ok(s.total > 7000, `expected >7000 modules, got ${s.total}`);
  assert.ok(s.distinctCves > 2000);
  assert.ok(s.withCheck > 1500);
});

test('search finds EternalBlue by name and by CVE', async () => {
  const byName = await (await fetch(BASE + '/api/modules?q=eternalblue')).json();
  assert.ok(byName.results.some(m => m.fullname.includes('eternalblue')));
  const byCve = await (await fetch(BASE + '/api/modules?q=CVE-2017-0144')).json();
  assert.ok(byCve.total >= 1);
});

test('check-only filter returns only check-capable modules', async () => {
  const d = await (await fetch(BASE + '/api/modules?check=1&limit=20')).json();
  assert.ok(d.results.every(m => m.check));
});

test('plan refuses without authorisation confirmation', async () => {
  const r = await fetch(BASE + '/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorized: false, hosts: ['192.168.56.10'], moduleIds: [0] }) });
  assert.equal(r.status, 400);
});

test('plan exports exploits as check, never run', async () => {
  const s = await (await fetch(BASE + '/api/modules?q=ms17_010_eternalblue&check=1')).json();
  const mod = s.results.find(m => m.fullname.includes('ms17_010_eternalblue'));
  assert.ok(mod, 'eternalblue module must be findable');
  const id = mod.id;
  const r = await fetch(BASE + '/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorized: true, client: 'Lab', hosts: ['192.168.56.10'], moduleIds: [id] }) });
  const plan = await r.json();
  assert.equal(r.status, 200);
  assert.match(plan.rc, /use exploit\/windows\/smb\/ms17_010_eternalblue/);
  assert.ok(plan.rc.includes('\ncheck\n'), 'exploit must be emitted as check');
  assert.ok(!/\nrun\n/.test(plan.rc.replace(/auxiliary[\s\S]*?(?=\n# |\nspool)/g, '')), 'exploit must not be emitted as run');
});
