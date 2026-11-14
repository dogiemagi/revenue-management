'use strict';
// End-to-end API test: node test.js   (uses a throwaway database)
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
process.env.DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ff-')), 't.db');
process.env.SECRET = 'test-secret';
const {server} = require('./server');

const jar = {};
async function call(who, method, url, body) {
  const r = await fetch(base + url, {method, headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(jar[who] ? {cookie: jar[who]} : {})}, body: body ? JSON.stringify(body) : undefined});
  const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch {}
  return {status: r.status, json, text, headers: r.headers};
}
let base, passed = 0;
const ok = (name, fn) => fn().then(() => { passed++; console.log('  ✓', name); }, e => { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; });

server.listen(0, '127.0.0.1', async () => {
  base = 'http://127.0.0.1:' + server.address().port;
  await ok('unauthenticated API is rejected', async () => assert.equal((await call('a', 'GET', '/api/state')).status, 401));
  await ok('register validates password length', async () => assert.equal((await call('a', 'POST', '/api/register', {name: 'A', email: 'a@x.com', password: 'short'})).status, 400));
  await ok('register + session cookie', async () => { const r = await call('a', 'POST', '/api/register', {name: 'Asha', email: 'asha@x.com', password: 'password123'}); assert.equal(r.status, 200); assert.equal(r.json.user.name, 'Asha'); assert.equal((await call('a', 'GET', '/api/state')).status, 200); });
  await ok('duplicate email rejected', async () => assert.equal((await call('b', 'POST', '/api/register', {name: 'X', email: 'ASHA@x.com', password: 'password123'})).status, 400));
  await ok('wrong password rejected', async () => assert.equal((await call('x', 'POST', '/api/login', {email: 'asha@x.com', password: 'nope-nope'})).status, 401));
  await ok('tampered cookie rejected', async () => { jar.t = jar.a.replace(/\.[0-9a-f]+$/, '.00'); assert.equal((await call('t', 'GET', '/api/state')).status, 401); });
  await ok('salary engine matches reference (monthly net 70875)', async () => {
    const r = await call('a', 'PUT', '/api/profile', {pay_frequency: 'monthly', base_salary: 75000, allowances: 12000, bonus_expected: 5000, tax_rate: 15, pension_rate: 6, insurance_deduction: 2500, other_deductions: 1000, standard_hours_per_week: 40, overtime_hours: 0, overtime_rate_multiplier: 1.5, cash: 5000});
    assert.equal(r.json.calc.monthly.net, 70875); assert.equal(r.json.calc.yearly.net, 850500); assert.equal(r.json.calc.weekly.gross, 21230.77);
  });
  await ok('profile rejects bad input', async () => assert.equal((await call('a', 'PUT', '/api/profile', {pay_frequency: 'daily', base_salary: 1})).status, 400));
  await ok('/api/calc works without saving', async () => assert.equal((await call('a', 'POST', '/api/calc', {pay_frequency: 'weekly', base_salary: 1000, tax_rate: 10})).json.yearly.gross, 52000));
  await ok('transactions CRUD + validation', async () => {
    assert.equal((await call('a', 'POST', '/api/transactions', {date: '2026-01-05', desc: 'x', cat: 'Nope', amount: 5, kind: 'expense'})).status, 400);
    assert.equal((await call('a', 'POST', '/api/transactions', {date: '2026-01-05', desc: 'x', cat: 'Rent', amount: -5, kind: 'expense'})).status, 400);
    const r = await call('a', 'POST', '/api/transactions', {date: '2026-01-05', desc: 'Rent', cat: 'Rent', amount: 18000, kind: 'expense'}); assert.equal(r.status, 200);
    assert.equal((await call('a', 'GET', '/api/state')).json.tx.length, 1);
    await call('a', 'DELETE', '/api/transactions/' + r.json.id); assert.equal((await call('a', 'GET', '/api/state')).json.tx.length, 0);
  });
  await ok('bulk transactions: inserts all, rejects whole batch on a bad row', async () => {
    const before = (await call('a', 'GET', '/api/state')).json.tx.length;
    const good = [1, 2, 3].map(i => ({date: '2026-01-1' + i, desc: 'Item ' + i, cat: 'Groceries', amount: 100 * i}));
    const r = await call('a', 'POST', '/api/transactions/bulk', {items: good}); assert.equal(r.status, 200); assert.equal(r.json.items.length, 3);
    const badBatch = await call('a', 'POST', '/api/transactions/bulk', {items: [...good, {date: '2026-01-15', desc: 'Oops', cat: 'Groceries', amount: -1}]});
    assert.equal(badBatch.status, 400); assert(badBatch.json.error.startsWith('Row 4'));
    assert.equal((await call('a', 'GET', '/api/state')).json.tx.length, before + 3);
    assert.equal((await call('a', 'POST', '/api/transactions/bulk', {items: []})).status, 400);
    for (const t of r.json.items) await call('a', 'DELETE', '/api/transactions/' + t.id);
  });
  await ok('bulk holdings: inserts all, atomic on bad row', async () => {
    const r = await call('a', 'POST', '/api/holdings/bulk', {items: [{name: 'A', type: 'Gold', invested: 100}, {name: 'B', type: 'ETF', invested: 200, current: 250, sip: 10}]});
    assert.equal(r.status, 200); assert.equal(r.json.items[0].current, 100); assert.equal(r.json.items[1].current, 250);
    const n = (await call('a', 'GET', '/api/state')).json.holdings.length;
    const b = await call('a', 'POST', '/api/holdings/bulk', {items: [{name: 'C', type: 'Gold', invested: 1}, {name: 'D', type: 'Nope', invested: 1}]});
    assert.equal(b.status, 400); assert(b.json.error.startsWith('Row 2')); assert.equal((await call('a', 'GET', '/api/state')).json.holdings.length, n);
    for (const h of r.json.items) await call('a', 'DELETE', '/api/holdings/' + h.id);
  });
  await ok('holdings + goals CRUD', async () => {
    const h = await call('a', 'POST', '/api/holdings', {name: 'Fund', type: 'ETF', invested: 1000}); assert.equal(h.json.current, 1000);
    assert.equal((await call('a', 'PATCH', '/api/holdings/' + h.json.id, {current: 1500})).status, 200);
    const g = await call('a', 'POST', '/api/goals', {name: 'Trip', target: 5000, date: '2027-01-01'}); assert.equal(g.status, 200);
    const s = (await call('a', 'GET', '/api/state')).json; assert.equal(s.holdings[0].current, 1500); assert.equal(s.goals.length, 1);
  });
  await ok('users cannot touch each other\'s data', async () => {
    await call('b', 'POST', '/api/register', {name: 'Bob', email: 'bob@x.com', password: 'password123'});
    const mine = (await call('a', 'GET', '/api/state')).json.holdings[0].id;
    assert.equal((await call('b', 'PATCH', '/api/holdings/' + mine, {current: 1})).status, 404);
    await call('b', 'DELETE', '/api/holdings/' + mine);
    assert.equal((await call('a', 'GET', '/api/state')).json.holdings.length, 1);
    assert.equal((await call('b', 'GET', '/api/state')).json.holdings.length, 0);
  });
  await ok('pay slips: generate, manual, print, csv (with injection guard), delete', async () => {
    const g = await call('a', 'POST', '/api/payslips', {fromProfile: true, title: '=HYPERLINK("x")', pay_date: '2026-02-28'}); assert.equal(g.json.net, 70875);
    const m = await call('a', 'POST', '/api/payslips', {title: 'Gig <b>', pay_date: '2026-03-10', category: 'freelance', gross: 1000, tax: 100}); assert.equal(m.json.net, 900);
    const p = await call('a', 'GET', '/print/' + m.json.id); assert.equal(p.status, 200); assert(p.text.includes('Gig &lt;b&gt;')); assert(!p.text.includes('Gig <b>'));
    assert.equal((await call('b', 'GET', '/print/' + m.json.id)).status, 404);
    const csv = await call('a', 'GET', '/api/payslips/export.csv'); assert(csv.headers.get('content-type').startsWith('text/csv')); assert(csv.text.includes("\"'=HYPERLINK(\"\"x\"\")\"") || csv.text.includes("'=HYPERLINK"));
    await call('a', 'DELETE', '/api/payslips/' + g.json.id); assert.equal((await call('a', 'GET', '/api/state')).json.payslips.length, 1);
  });
  await ok('family: create, join, aggregate, leave, admin handover', async () => {
    const c = await call('a', 'POST', '/api/family/create', {name: 'Test Fam'}); assert.match(c.json.family.invite_code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal((await call('b', 'POST', '/api/family/join', {code: 'ZZZZ-ZZZZ'})).status, 400);
    const j = await call('b', 'POST', '/api/family/join', {code: c.json.family.invite_code.toLowerCase()}); assert.equal(j.json.family.members.length, 2);
    assert.equal(j.json.family.is_admin, false); assert.equal(j.json.family.monthly_net, 70875);
    await call('a', 'POST', '/api/family/leave'); const after = (await call('b', 'GET', '/api/state')).json.family; assert.equal(after.is_admin, true);
    await call('b', 'POST', '/api/family/leave'); assert.equal((await call('b', 'GET', '/api/state')).json.family, null);
  });
  await ok('settings persist & validate', async () => {
    assert.equal((await call('a', 'PUT', '/api/settings', {currency: 'XXX'})).status, 400);
    await call('a', 'PUT', '/api/settings', {currency: 'USD', alloc: {needs: 40, wants: 20}, growth: {years: 10, step: 5, infl: 4, target: 1e6, ret: null}});
    const s = (await call('a', 'GET', '/api/state')).json; assert.equal(s.currency, 'USD'); assert.equal(s.alloc.needs, 40); assert.equal(s.growth.years, 10);
  });
  await ok('demo account seeds data, family, and can be reset', async () => {
    const d = await call('d', 'POST', '/api/demo'); assert.equal(d.json.tx.length, 60); assert.equal(d.json.payslips.length, 6); assert.equal(d.json.family.members.length, 3);
    const r = await call('d', 'POST', '/api/demo/reset'); assert.equal(r.json.tx.length, 60);
    assert.equal((await call('a', 'POST', '/api/demo/reset')).status, 403);
    assert.equal((await call('x', 'POST', '/api/login', {email: 'demo@finflow.local', password: 'x'})).status, 401);
  });
  await ok('static files served; traversal blocked; bad JSON handled', async () => {
    assert.equal((await call('a', 'GET', '/')).status, 200); assert.equal((await call('a', 'GET', '/app.js')).status, 200);
    assert.equal((await call('a', 'GET', '/..%2Fserver.js')).status, 404); assert.equal((await call('a', 'GET', '/%2e%2e/data/secret.key')).status, 404);
    const r = await fetch(base + '/api/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{bad'}); assert.equal(r.status, 400);
  });
  console.log(`\n${passed} passed`); server.close(); process.exit(process.exitCode || 0);
});
