'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const {calculate} = require('./calc');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(DATA, {recursive: true});

// ---------- secrets & db ----------
const secretFile = path.join(DATA, 'secret.key');
if (!process.env.SECRET && !fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), {mode: 0o600});
const SECRET = process.env.SECRET || fs.readFileSync(secretFile, 'utf8').trim();

const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA, 'finflow.db'));
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS families(id INTEGER PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
  family_id INTEGER REFERENCES families(id) ON DELETE SET NULL, is_family_admin INTEGER DEFAULT 0, is_demo INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS holdings(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, type TEXT NOT NULL, invested REAL NOT NULL, current REAL NOT NULL, sip REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, description TEXT NOT NULL, cat TEXT NOT NULL, amount REAL NOT NULL, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, target REAL NOT NULL, saved REAL NOT NULL DEFAULT 0, date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payslips(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, pay_date TEXT NOT NULL, category TEXT NOT NULL,
  gross REAL NOT NULL, allowances REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, pension REAL NOT NULL DEFAULT 0, insurance REAL NOT NULL DEFAULT 0, other REAL NOT NULL DEFAULT 0, net REAL NOT NULL, notes TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS ix_tx ON transactions(user_id,date); CREATE INDEX IF NOT EXISTS ix_ps ON payslips(user_id,pay_date);
`);
const q = {};  // statement cache
const sql = s => (q[s] ||= db.prepare(s));
const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

// ---------- helpers ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = m => new HttpError(400, m);
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'], TYPES = ['Mutual Fund', 'Stocks', 'ETF', 'Fixed Deposit', 'Gold', 'Crypto', 'Real Estate', 'PPF/EPF'];
const CATS = ['Rent', 'Groceries', 'Utilities', 'Transport', 'Health', 'Dining', 'Shopping', 'Entertainment', 'Travel', 'Other'];
const FREQS = ['weekly', 'biweekly', 'monthly', 'yearly', 'hourly'], SLIP_CATS = ['primary_job', 'freelance', 'side_hustle', 'bonus'];
const num = (v, name, {min = 0, max = 1e12, nullable = false} = {}) => {
  if ((v === null || v === '' || v === undefined) && nullable) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`Invalid ${name}`);
  return n;
};
const str = (v, name, max = 120) => { const s = String(v ?? '').trim(); if (!s || s.length > max) throw bad(`Invalid ${name}`); return s; };
const date = (v, name = 'date') => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(Date.parse(v))) throw bad(`Invalid ${name}`); return v; };
const oneOf = (v, list, name) => { if (!list.includes(v)) throw bad(`Invalid ${name}`); return v; };
const iso = d => d.toISOString().slice(0, 10);

const hashPw = pw => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
const checkPw = (pw, stored) => { const [s, h] = stored.split(':'); const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = uid => { const p = `${uid}.${Date.now() + 30 * 864e5}`; return p + '.' + sign(p); };
function readToken(req) {
  const m = /(?:^|;\s*)ff=([^;]+)/.exec(req.headers.cookie || ''); if (!m) return null;
  const [uid, exp, sig] = m[1].split('.'); if (!sig || sign(`${uid}.${exp}`) !== sig || +exp < Date.now()) return null;
  return +uid;
}
const setCookie = (res, token, maxAge = 30 * 86400) => res.setHeader('Set-Cookie', `ff=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);

// ---------- domain ----------
const defaultSettings = () => ({
  currency: 'INR', theme: 'dark', cash: 0, alloc: {needs: 50, wants: 30},
  growth: {years: 20, step: 8, infl: 5, target: 10000000, ret: null, start: null, monthly: null},
  profile: {pay_frequency: 'monthly', base_salary: 0, allowances: 0, bonus_expected: 0, tax_rate: 15, pension_rate: 6, insurance_deduction: 0, other_deductions: 0, standard_hours_per_week: 40, overtime_hours: 0, overtime_rate_multiplier: 1.5}
});
const getSettings = uid => { const r = sql('SELECT json FROM settings WHERE user_id=?').get(uid); const d = defaultSettings(); if (!r) return d; const s = JSON.parse(r.json); return {...d, ...s, alloc: {...d.alloc, ...s.alloc}, growth: {...d.growth, ...s.growth}, profile: {...d.profile, ...s.profile}}; };
const putSettings = (uid, s) => sql('INSERT INTO settings(user_id,json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json').run(uid, JSON.stringify(s));

const rows = {
  holdings: uid => sql('SELECT id,name,type,invested,current,sip FROM holdings WHERE user_id=? ORDER BY id').all(uid),
  tx: uid => sql('SELECT id,date,description,cat,amount,kind FROM transactions WHERE user_id=? ORDER BY date DESC,id DESC').all(uid).map(t => ({id: t.id, date: t.date, desc: t.description, cat: t.cat, amount: t.amount, kind: t.kind})),
  goals: uid => sql('SELECT id,name,target,saved,date FROM goals WHERE user_id=? ORDER BY date').all(uid),
  payslips: uid => sql('SELECT * FROM payslips WHERE user_id=? ORDER BY pay_date DESC,id DESC').all(uid)
};
function familyView(user) {
  if (!user.family_id) return null;
  const f = sql('SELECT id,name,invite_code FROM families WHERE id=?').get(user.family_id);
  const members = sql('SELECT id,name,is_family_admin FROM users WHERE family_id=? ORDER BY is_family_admin DESC,id').all(user.family_id).map(m => {
    const c = calculate(getSettings(m.id).profile).monthly;   // only salary figures are shared with the household
    return {id: m.id, name: m.name, admin: !!m.is_family_admin, you: m.id === user.id, gross: c.gross, net: c.net};
  });
  const totalNet = members.reduce((a, m) => a + m.net, 0), totalGross = members.reduce((a, m) => a + m.gross, 0);
  members.forEach(m => m.share = totalNet ? Math.round(m.net / totalNet * 1000) / 10 : 0);
  return {id: f.id, name: f.name, invite_code: f.invite_code, is_admin: !!user.is_family_admin, members, monthly_gross: Math.round(totalGross * 100) / 100, monthly_net: Math.round(totalNet * 100) / 100, annual_net: Math.round(totalNet * 1200) / 100};
}
function fullState(user) {
  const s = getSettings(user.id);
  return {user: {id: user.id, name: user.name, email: user.email, demo: !!user.is_demo}, ...s, calc: calculate(s.profile),
    holdings: rows.holdings(user.id), tx: rows.tx(user.id), goals: rows.goals(user.id), payslips: rows.payslips(user.id), family: familyView(user)};
}
const getUser = id => sql('SELECT * FROM users WHERE id=?').get(id);
const inviteCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[crypto.randomInt(c.length)]; return s.slice(0, 4) + '-' + s.slice(4); };

// ---------- demo seed ----------
function slipFrom(profile, d, title, category = 'primary_job') {
  const c = calculate(profile)[{weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly', yearly: 'yearly', hourly: 'monthly'}[profile.pay_frequency]];
  return {title, pay_date: d, category, gross: c.gross, allowances: c.allowances, tax: c.tax, pension: c.pension, insurance: c.insurance, other: c.other, net: c.net};
}
const insSlip = (uid, s) => sql('INSERT INTO payslips(user_id,title,pay_date,category,gross,allowances,tax,pension,insurance,other,net,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(uid, s.title, s.pay_date, s.category, s.gross, s.allowances, s.tax, s.pension, s.insurance, s.other, s.net, s.notes || '');
function seedUser(uid) {
  let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; const now = new Date();
  for (const t of ['holdings', 'transactions', 'goals', 'payslips']) sql(`DELETE FROM ${t} WHERE user_id=?`).run(uid);
  const profile = {pay_frequency: 'monthly', base_salary: 75000, allowances: 12000, bonus_expected: 5000, tax_rate: 15, pension_rate: 6, insurance_deduction: 2500, other_deductions: 1000, standard_hours_per_week: 40, overtime_hours: 0, overtime_rate_multiplier: 1.5};
  putSettings(uid, {...defaultSettings(), cash: 120000, profile});
  const H = [['Nifty 50 Index Fund', 'Mutual Fund', 300000, 365000, 10000], ['Blue-chip Stocks', 'Stocks', 150000, 186000, 3000], ['Gold ETF', 'Gold', 80000, 92000, 2000], ['Fixed Deposit', 'Fixed Deposit', 200000, 214000, 0], ['PPF', 'PPF/EPF', 120000, 134000, 5000]];
  H.forEach(h => sql('INSERT INTO holdings(user_id,name,type,invested,current,sip) VALUES(?,?,?,?,?,?)').run(uid, ...h));
  const base = {Rent: 18000, Groceries: 7000, Utilities: 3200, Transport: 2500, Health: 1200, Dining: 3500, Shopping: 4500, Entertainment: 2000, Travel: 2500, Other: 1000};
  for (let m = 0; m < 6; m++) {
    const y = now.getFullYear(), mo = now.getMonth() - m;
    Object.entries(base).forEach(([cat, b], i) => {
      const day = m === 0 ? Math.min(now.getDate(), 1 + i * 2) : 1 + i * 2;
      sql('INSERT INTO transactions(user_id,date,description,cat,amount,kind) VALUES(?,?,?,?,?,?)').run(uid, iso(new Date(Date.UTC(y, mo, day, 12))), cat + ' spend', cat, Math.round(b * (0.8 + rnd() * 0.5) / 50) * 50, 'expense');
    });
    insSlip(uid, slipFrom(profile, iso(new Date(Date.UTC(y, mo, 28, 12))), 'Monthly salary'));
  }
  sql('INSERT INTO goals(user_id,name,target,saved,date) VALUES(?,?,?,?,?)').run(uid, 'Emergency fund', 500000, 120000, iso(new Date(Date.UTC(now.getFullYear() + 1, 5, 1))));
  sql('INSERT INTO goals(user_id,name,target,saved,date) VALUES(?,?,?,?,?)').run(uid, 'Dream home down-payment', 2500000, 400000, iso(new Date(Date.UTC(now.getFullYear() + 6, 0, 1))));
}
function ensureDemo() {
  let u = sql('SELECT * FROM users WHERE email=?').get('demo@finflow.local');
  if (u) return u;
  tx(() => {
    const mk = (name, email, profile, admin) => { const id = +sql('INSERT INTO users(name,email,pass_hash,is_demo) VALUES(?,?,?,1)').run(name, email, hashPw(crypto.randomBytes(24).toString('hex'))).lastInsertRowid; if (profile) putSettings(id, {...defaultSettings(), profile: {...defaultSettings().profile, ...profile}}); return id; };
    const id = mk('Morgan (Demo)', 'demo@finflow.local'); seedUser(id);
    const p2 = mk('Alex Morgan', 'alex@finflow.local', {base_salary: 62000, allowances: 8000, bonus_expected: 3000, insurance_deduction: 2000, other_deductions: 800});
    const p3 = mk('Sam Morgan', 'sam@finflow.local', {base_salary: 30000, allowances: 4000, tax_rate: 10, insurance_deduction: 1000});
    const fid = +sql('INSERT INTO families(name,invite_code) VALUES(?,?)').run('Morgan Household', 'DEMO-2026').lastInsertRowid;
    sql('UPDATE users SET family_id=?,is_family_admin=1 WHERE id=?').run(fid, id);
    sql('UPDATE users SET family_id=? WHERE id IN (?,?)').run(fid, p2, p3);
  });
  return sql('SELECT * FROM users WHERE email=?').get('demo@finflow.local');
}

// ---------- rate limit ----------
const hits = new Map();
function limited(ip, key, max, windowMs) {
  const k = key + ip, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(k, a); return a.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler, {auth = true} = {}) => routes.push({method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, auth});

route('POST', '/api/register', (c) => {
  if (limited(c.ip, 'reg', 10, 3600e3)) throw new HttpError(429, 'Too many attempts, try later');
  const name = str(c.body.name, 'name', 80), email = str(c.body.email, 'email', 120).toLowerCase(), pw = String(c.body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Invalid email');
  if (email.endsWith('@finflow.local')) throw bad('Invalid email');
  if (pw.length < 8 || pw.length > 200) throw bad('Password must be at least 8 characters');
  if (sql('SELECT 1 FROM users WHERE email=?').get(email)) throw bad('Email already registered');
  const id = +sql('INSERT INTO users(name,email,pass_hash) VALUES(?,?,?)').run(name, email, hashPw(pw)).lastInsertRowid;
  setCookie(c.res, makeToken(id)); return fullState(getUser(id));
}, {auth: false});
route('POST', '/api/login', (c) => {
  if (limited(c.ip, 'login', 10, 15 * 60e3)) throw new HttpError(429, 'Too many attempts, try again in a few minutes');
  const u = sql('SELECT * FROM users WHERE email=?').get(String(c.body.email || '').trim().toLowerCase());
  if (!u || u.is_demo || !checkPw(String(c.body.password || ''), u.pass_hash)) throw new HttpError(401, 'Invalid email or password');
  setCookie(c.res, makeToken(u.id)); return fullState(u);
}, {auth: false});
route('POST', '/api/demo', (c) => { const u = ensureDemo(); setCookie(c.res, makeToken(u.id)); return fullState(u); }, {auth: false});
route('POST', '/api/logout', (c) => { setCookie(c.res, '', 0); return {ok: true}; }, {auth: false});
route('GET', '/api/state', c => fullState(c.user));

route('POST', '/api/demo/reset', c => { if (!c.user.is_demo || c.user.email !== 'demo@finflow.local') throw new HttpError(403, 'Only the demo account can be reset'); tx(() => seedUser(c.user.id)); return fullState(getUser(c.user.id)); });

route('PUT', '/api/settings', c => {
  const b = c.body, s = getSettings(c.user.id);
  if (b.currency !== undefined) s.currency = oneOf(b.currency, CURRENCIES, 'currency');
  if (b.theme !== undefined) s.theme = oneOf(b.theme, ['dark', 'light'], 'theme');
  if (b.cash !== undefined) s.cash = num(b.cash, 'cash');
  if (b.alloc) s.alloc = {needs: num(b.alloc.needs, 'needs', {max: 100}), wants: num(b.alloc.wants, 'wants', {max: 100})};
  if (b.growth) {
    const g = b.growth;
    s.growth = {years: Math.round(num(g.years, 'years', {min: 1, max: 60})), step: num(g.step, 'step-up', {max: 100}), infl: num(g.infl, 'inflation', {max: 50}), target: num(g.target, 'target'),
      ret: num(g.ret, 'return', {max: 100, nullable: true}), start: num(g.start, 'start', {nullable: true}), monthly: num(g.monthly, 'monthly', {nullable: true})};
  }
  putSettings(c.user.id, s); return {ok: true};
});
const PROFILE_FIELDS = {base_salary: {}, allowances: {}, bonus_expected: {}, tax_rate: {max: 70}, pension_rate: {max: 50}, insurance_deduction: {}, other_deductions: {}, standard_hours_per_week: {min: 1, max: 100}, overtime_hours: {}, overtime_rate_multiplier: {min: 1, max: 5}};
function cleanProfile(b) {
  const p = {pay_frequency: oneOf(b.pay_frequency, FREQS, 'pay frequency')};
  const dflt = {standard_hours_per_week: 40, overtime_rate_multiplier: 1.5};
  for (const [k, o] of Object.entries(PROFILE_FIELDS)) p[k] = num(b[k] === '' || b[k] == null ? (dflt[k] ?? 0) : b[k], k.replace(/_/g, ' '), o);
  return p;
}
route('PUT', '/api/profile', c => { const p = cleanProfile(c.body), s = getSettings(c.user.id); s.profile = p; if (c.body.cash !== undefined) s.cash = num(c.body.cash, 'cash'); putSettings(c.user.id, s); return {profile: p, cash: s.cash, calc: calculate(p)}; });
route('POST', '/api/calc', c => calculate(cleanProfile(c.body)));

// holdings
const cleanHolding = b => ({name: str(b.name, 'name'), type: oneOf(b.type, TYPES, 'type'), invested: num(b.invested, 'invested'), current: num(b.current ?? b.invested, 'current value'), sip: num(b.sip ?? 0, 'SIP')});
route('POST', '/api/holdings', c => { const h = cleanHolding(c.body); const id = +sql('INSERT INTO holdings(user_id,name,type,invested,current,sip) VALUES(?,?,?,?,?,?)').run(c.user.id, h.name, h.type, h.invested, h.current, h.sip).lastInsertRowid; return {id, ...h}; });
route('POST', '/api/holdings/bulk', c => {
  const items = c.body.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) throw bad('Provide 1–100 investments');
  const clean = items.map((b, i) => { try { return cleanHolding(b); } catch (e) { throw bad(`Row ${i + 1}: ${e.message}`); } });
  return tx(() => ({items: clean.map(h => ({id: +sql('INSERT INTO holdings(user_id,name,type,invested,current,sip) VALUES(?,?,?,?,?,?)').run(c.user.id, h.name, h.type, h.invested, h.current, h.sip).lastInsertRowid, ...h}))}));
});
route('PATCH', '/api/holdings/:id', c => { const r = sql('UPDATE holdings SET current=? WHERE id=? AND user_id=?').run(num(c.body.current, 'current value'), +c.params.id, c.user.id); if (!r.changes) throw new HttpError(404, 'Not found'); return {ok: true}; });
route('DELETE', '/api/holdings/:id', c => { sql('DELETE FROM holdings WHERE id=? AND user_id=?').run(+c.params.id, c.user.id); return {ok: true}; });
// transactions
route('POST', '/api/transactions', c => {
  const t = {date: date(c.body.date), desc: str(c.body.desc, 'description'), cat: oneOf(c.body.cat, CATS, 'category'), amount: num(c.body.amount, 'amount', {min: 0.01}), kind: oneOf(c.body.kind, ['expense', 'income'], 'type')};
  const id = +sql('INSERT INTO transactions(user_id,date,description,cat,amount,kind) VALUES(?,?,?,?,?,?)').run(c.user.id, t.date, t.desc, t.cat, t.amount, t.kind).lastInsertRowid; return {id, ...t};
});
route('POST', '/api/transactions/bulk', c => {
  const items = c.body.items;
  if (!Array.isArray(items) || !items.length || items.length > 200) throw bad('Provide 1–200 transactions');
  const clean = items.map((b, i) => {
    try { return {date: date(b.date), desc: str(b.desc, 'description'), cat: oneOf(b.cat, CATS, 'category'), amount: num(b.amount, 'amount', {min: 0.01}), kind: oneOf(b.kind || 'expense', ['expense', 'income'], 'type')}; }
    catch (e) { throw bad(`Row ${i + 1}: ${e.message}`); }
  });
  return tx(() => ({items: clean.map(t => ({id: +sql('INSERT INTO transactions(user_id,date,description,cat,amount,kind) VALUES(?,?,?,?,?,?)').run(c.user.id, t.date, t.desc, t.cat, t.amount, t.kind).lastInsertRowid, ...t}))}));
});
route('DELETE', '/api/transactions/:id', c => { sql('DELETE FROM transactions WHERE id=? AND user_id=?').run(+c.params.id, c.user.id); return {ok: true}; });
// goals
route('POST', '/api/goals', c => {
  const g = {name: str(c.body.name, 'name'), target: num(c.body.target, 'target', {min: 1}), saved: num(c.body.saved ?? 0, 'saved'), date: date(c.body.date)};
  const id = +sql('INSERT INTO goals(user_id,name,target,saved,date) VALUES(?,?,?,?,?)').run(c.user.id, g.name, g.target, g.saved, g.date).lastInsertRowid; return {id, ...g};
});
route('DELETE', '/api/goals/:id', c => { sql('DELETE FROM goals WHERE id=? AND user_id=?').run(+c.params.id, c.user.id); return {ok: true}; });
// payslips
route('POST', '/api/payslips', c => {
  const b = c.body; let s;
  if (b.fromProfile) s = slipFrom(getSettings(c.user.id).profile, date(b.pay_date, 'pay date'), str(b.title || 'Salary', 'title'), oneOf(b.category || 'primary_job', SLIP_CATS, 'category'));
  else {
    s = {title: str(b.title, 'title'), pay_date: date(b.pay_date, 'pay date'), category: oneOf(b.category, SLIP_CATS, 'category'), gross: num(b.gross, 'gross'), allowances: num(b.allowances ?? 0, 'allowances'),
      tax: num(b.tax ?? 0, 'tax'), pension: num(b.pension ?? 0, 'pension'), insurance: num(b.insurance ?? 0, 'insurance'), other: num(b.other ?? 0, 'other deductions')};
    s.net = Math.max(0, Math.round((s.gross - s.tax - s.pension - s.insurance - s.other) * 100) / 100);
  }
  s.notes = String(b.notes || '').slice(0, 500);
  const id = +insSlip(c.user.id, s).lastInsertRowid; return {id, ...s};
});
route('DELETE', '/api/payslips/:id', c => { sql('DELETE FROM payslips WHERE id=? AND user_id=?').run(+c.params.id, c.user.id); return {ok: true}; });
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
route('GET', '/api/payslips/export.csv', c => {
  const head = ['Date', 'Title', 'Category', 'Gross', 'Allowances', 'Tax', 'Pension', 'Insurance', 'Other deductions', 'Net', 'Notes'];
  const body = rows.payslips(c.user.id).map(p => [p.pay_date, p.title, p.category, p.gross, p.allowances, p.tax, p.pension, p.insurance, p.other, p.net, p.notes].map(csvCell).join(','));
  return {raw: [head.join(','), ...body].join('\r\n'), type: 'text/csv; charset=utf-8', headers: {'Content-Disposition': 'attachment; filename="payslips.csv"'}};
});
const htmlEsc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
route('GET', '/print/:id', c => {
  const p = sql('SELECT * FROM payslips WHERE id=? AND user_id=?').get(+c.params.id, c.user.id); if (!p) throw new HttpError(404, 'Not found');
  const cur = {INR: '₹', USD: '$', EUR: '€', GBP: '£'}[getSettings(c.user.id).currency];
  const m = n => cur + Number(n).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const ded = p.tax + p.pension + p.insurance + p.other, tr = (a, b, cls = '') => `<tr class="${cls}"><td>${a}</td><td class="r">${b}</td></tr>`;
  return {type: 'text/html; charset=utf-8', headers: {'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'"}, raw: `<!doctype html><meta charset=utf-8><title>Pay slip – ${htmlEsc(p.title)}</title>
<style>body{font:15px system-ui,sans-serif;max-width:640px;margin:30px auto;padding:0 20px;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px;border-bottom:1px solid #ddd}.r{text-align:right}.t td{font-weight:700;border-top:2px solid #111}.m{color:#666}button{padding:8px 16px;margin-top:10px}@media print{button{display:none}}</style>
<h1>Pay Slip</h1><div class=m>${htmlEsc(c.user.name)} · ${htmlEsc(p.title)} · ${htmlEsc(p.pay_date)} · ${htmlEsc(p.category.replace('_', ' '))}</div>
<table><tr><td colspan=2><b>Earnings</b></td></tr>${tr('Gross pay', m(p.gross))}${tr('&nbsp;&nbsp;of which allowances', m(p.allowances))}
<tr><td colspan=2><b>Deductions</b></td></tr>${tr('Income tax', m(p.tax))}${tr('Pension / PF', m(p.pension))}${tr('Insurance', m(p.insurance))}${tr('Other', m(p.other))}${tr('Total deductions', m(ded))}${tr('Net pay', m(p.net), 't')}</table>
${p.notes ? `<p class=m>${htmlEsc(p.notes)}</p>` : ''}<button onclick="print()">Print / Save as PDF</button>`};
});
// family
route('POST', '/api/family/create', c => {
  if (c.user.family_id) throw bad('You are already in a family');
  const name = str(c.body.name, 'family name', 60);
  tx(() => { let fid; for (let i = 0; ; i++) { try { fid = +sql('INSERT INTO families(name,invite_code) VALUES(?,?)').run(name, inviteCode()).lastInsertRowid; break; } catch (e) { if (i > 5) throw e; } } sql('UPDATE users SET family_id=?,is_family_admin=1 WHERE id=?').run(fid, c.user.id); });
  return {family: familyView(getUser(c.user.id))};
});
route('POST', '/api/family/join', c => {
  if (limited(c.ip, 'join', 15, 3600e3)) throw new HttpError(429, 'Too many attempts');
  if (c.user.family_id) throw bad('You are already in a family');
  const f = sql('SELECT id FROM families WHERE invite_code=?').get(String(c.body.code || '').trim().toUpperCase());
  if (!f) throw bad('Invite code not found');
  sql('UPDATE users SET family_id=?,is_family_admin=0 WHERE id=?').run(f.id, c.user.id); return {family: familyView(getUser(c.user.id))};
});
route('POST', '/api/family/leave', c => {
  const u = c.user; if (!u.family_id) throw bad('Not in a family');
  tx(() => {
    sql('UPDATE users SET family_id=NULL,is_family_admin=0 WHERE id=?').run(u.id);
    const rest = sql('SELECT id FROM users WHERE family_id=? ORDER BY id').all(u.family_id);
    if (!rest.length) sql('DELETE FROM families WHERE id=?').run(u.family_id);
    else if (u.is_family_admin) sql('UPDATE users SET is_family_admin=1 WHERE id=?').run(rest[0].id);
  });
  return {family: null};
});

// ---------- server ----------
const MIME = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'};
const SEC = {'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"};
const readBody = req => new Promise((res, rej) => {
  let n = 0; const chunks = [];
  req.on('data', d => { n += d.length; if (n > 100e3) { rej(new HttpError(413, 'Payload too large')); req.destroy(); } else chunks.push(d); });
  req.on('end', () => { if (!n) return res({}); try { const j = JSON.parse(Buffer.concat(chunks).toString()); res(j && typeof j === 'object' ? j : {}); } catch { rej(bad('Invalid JSON')); } });
  req.on('error', rej);
});
function send(res, status, body, type = 'application/json', extra = {}) {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', ...SEC, ...extra});
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname); if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain');
  const buf = fs.readFileSync(file); res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SEC}); res.end(buf);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'), p = url.pathname;
    if (!p.startsWith('/api/') && !p.startsWith('/print/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
      return serveStatic(req, res, p);
    }
    const r = routes.map(rt => rt.method === req.method && {rt, m: rt.re.exec(p)}).find(x => x && x.m);
    if (!r) throw new HttpError(404, 'Not found');
    const ctx = {req, res, ip: req.socket.remoteAddress || '', params: r.m.groups || {}, body: {}};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.headers['content-length'] > 0 && !/application\/json/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'JSON required');
      ctx.body = await readBody(req);
    }
    if (r.rt.auth) { const uid = readToken(req); const u = uid && getUser(uid); if (!u) throw new HttpError(401, 'Please sign in'); ctx.user = u; }
    const out = r.rt.handler(ctx);
    if (out && out.raw !== undefined) send(res, 200, out.raw, out.type, out.headers); else send(res, 200, out ?? {ok: true});
  } catch (e) {
    const status = e.status || 500; if (status === 500) console.error(e);
    send(res, status, {error: status === 500 ? 'Server error' : e.message});
  }
});
if (require.main === module) server.listen(PORT, HOST, () => console.log(`FinFlow running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
module.exports = {server, db};
