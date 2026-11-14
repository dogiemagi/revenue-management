(() => {
'use strict';
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ec4899','#06b6d4','#ef4444','#8b5cf6','#14b8a6'];
const CATS = {Rent:'needs',Groceries:'needs',Utilities:'needs',Transport:'needs',Health:'needs',Dining:'wants',Shopping:'wants',Entertainment:'wants',Travel:'wants',Other:'wants'};
const RET = {'Mutual Fund':12,'Stocks':13,'ETF':11,'Fixed Deposit':7,'Gold':8,'Crypto':15,'Real Estate':9,'PPF/EPF':7.1};
const TYPES = Object.keys(RET);
const FREQS = [['monthly','Monthly'],['biweekly','Bi-weekly'],['weekly','Weekly'],['yearly','Yearly'],['hourly','Hourly']];
const SLIP_CATS = [['primary_job','Primary job'],['freelance','Freelance'],['side_hustle','Side hustle'],['bonus','Bonus']];
const PF = [['base_salary','Base salary'],['allowances','Allowances'],['bonus_expected','Expected bonus'],['tax_rate','Tax %'],['pension_rate','Pension / PF %'],['insurance_deduction','Insurance'],['other_deductions','Other deductions'],['overtime_hours','Overtime hours'],['standard_hours_per_week','Std hours / week'],['overtime_rate_multiplier','Overtime multiplier']];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = d => d.toISOString().slice(0, 10);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const same = (a, b) => String(a) === String(b);

// ---------- icons (inline SVG, Lucide-style) ----------
const ICONS = {
  'dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  'arrows': '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  'pie': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'logout': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  'rotate': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  'printer': '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  'zap': '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  'sparkles': '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>',
  'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  'bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'layers': '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'edit': '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const TIPC = {alert: 'var(--warn)', 'check-circle': 'var(--ok)'};
const editBtn = (kind, id) => `<button type="button" class="btn sm" data-act="edit" data-kind="${kind}" data-id="${id}" title="Edit" aria-label="Edit">${ic('edit')}</button>`;
const hydrateIcons = () => document.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic); });

// ---------- API ----------
let S = null;
async function api(method, url, body) {
  const r = await fetch(url, {method, credentials: 'same-origin', headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S) { S = null; route(); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
let toastT;
function toast(msg, err) { const t = $('#toast'); t.innerHTML = ic(err ? 'alert' : 'check') + esc(msg); t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
const fail = e => toast(e.message || 'Something went wrong', true);
let st;
function saveSettings() {
  clearTimeout(st);
  st = setTimeout(() => {
    if (!S) return;
    const g = {...S.growth, years: Math.max(1, Math.round(S.growth.years || 1))};
    api('PUT', '/api/settings', {currency: S.currency, theme: S.theme, cash: S.cash, alloc: S.alloc, growth: g}).catch(fail);
  }, 400);
}

// ---------- helpers ----------
const fmt = (n, compact) => {
  const loc = S.currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(loc, {style: 'currency', currency: S.currency, maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard'}).format(n || 0);
};
const pct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const ym = d => d.slice(0, 7);
const curYM = ym(iso(new Date()));
const net = () => S.calc.monthly.net;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const monthTotal = (m, kind) => sum(S.tx.filter(t => t.kind === kind && ym(t.date) === m), t => t.amount);
const slipIncome = m => sum(S.payslips.filter(p => ym(p.pay_date) === m), p => p.net);
const monthIncome = m => slipIncome(m) + monthTotal(m, 'income');   // only what the user has logged: pay slips + extra income
const cashBalance = () => S.cash + sum(S.payslips, p => p.net) + sum(S.tx.filter(t => t.kind === 'income'), t => t.amount) - sum(S.tx.filter(t => t.kind === 'expense'), t => t.amount);
const hasData = ms => ms.some(m => monthIncome(m.ym) || monthTotal(m.ym, 'expense'));
const emptyBox = (icon, title, text, href, label) => `<div class="emptyx"><span class="pi">${ic(icon)}</span><b>${title}</b><span>${text}</span>${href ? `<a class="btn sm primary" href="${href}">${label}</a>` : ''}</div>`;
const portfolio = () => ({inv: sum(S.holdings, h => h.invested), cur: sum(S.holdings, h => h.current), sip: sum(S.holdings, h => h.sip)});
const blended = () => { const p = portfolio(); return p.cur ? sum(S.holdings, h => h.current * RET[h.type]) / p.cur : 10; };
const lastMonths = n => Array.from({length: n}, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return {ym: iso(d).slice(0, 7), label: d.toLocaleString('en', {month: 'short'})}; });
function project(start, monthly, ret, years, step, infl) {
  const r = ret / 100 / 12; let v = start, inv = start, m = monthly; const out = [{y: 0, v, inv, real: v}];
  for (let y = 1; y <= years; y++) { for (let i = 0; i < 12; i++) { v = v * (1 + r) + m; inv += m; } m *= 1 + step / 100; out.push({y, v, inv, real: v / Math.pow(1 + infl / 100, y)}); }
  return out;
}
const sortTx = () => S.tx.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const sortSlips = () => S.payslips.sort((a, b) => b.pay_date.localeCompare(a.pay_date) || b.id - a.id);

// ---------- charts (pure SVG) ----------
function donut(items, centerLabel) {
  items = items.filter(i => i.value > 0);
  const tot = sum(items, i => i.value) || 1; const R = 70, C = 2 * Math.PI * R; let off = 0;
  const arcs = items.map(i => { const len = i.value / tot * C; const s = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${i.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(i.label)}: ${fmt(i.value)} (${(i.value / tot * 100).toFixed(1)}%)</title></circle>`; off += len; return s; }).join('');
  const lg = items.map(i => `<span style="--c:${i.color}">${esc(i.label)} <b>${(i.value / tot * 100).toFixed(0)}%</b></span>`).join('');
  return `<div class="donutwrap"><svg viewBox="0 0 200 200"><circle r="${R}" cx="100" cy="100" fill="none" stroke="var(--panel2)" stroke-width="26"/>${arcs}<text x="100" y="97" text-anchor="middle" fill="var(--mut)" font-size="11">${centerLabel[0]}</text><text x="100" y="116" text-anchor="middle" fill="var(--text)" font-size="15" font-weight="700">${centerLabel[1]}</text></svg><div class="legend">${lg}</div></div>`;
}
function axes(w, h, p, max, labels, x) {
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, y = p.t + (h - p.t - p.b) * (1 - i / 4); g += `<line x1="${p.l}" x2="${w - p.r}" y1="${y}" y2="${y}" class="grid"/><text x="${p.l - 8}" y="${y + 4}" class="ax" text-anchor="end">${fmt(v, true)}</text>`; }
  const k = Math.ceil(labels.length / 8);
  labels.forEach((l, i) => { if (i % k === 0) g += `<text x="${x(i)}" y="${h - 8}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
  return g;
}
function lineChart(labels, series, w = 720, h = 300) {
  const p = {l: 62, r: 14, t: 12, b: 28}; const max = Math.max(1, ...series.flatMap(s => s.pts)) * 1.05;
  const x = i => p.l + (w - p.l - p.r) * i / ((labels.length - 1) || 1), y = v => p.t + (h - p.t - p.b) * (1 - v / max);
  let svg = axes(w, h, p, max, labels, x);
  series.forEach((s, si) => {
    const d = s.pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    if (si === 0) svg += `<path d="${d}L${x(s.pts.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z" fill="${s.color}" opacity=".12"/>`;
    svg += `<path d="${d}" class="ln" pathLength="1" stroke="${s.color}" ${s.dash ? 'style="stroke-dasharray:6 5;animation:none;stroke-dashoffset:0"' : ''}/>`;
    s.pts.forEach((v, i) => { svg += `<circle cx="${x(i)}" cy="${y(v)}" r="7" fill="transparent"><title>${esc(s.name)} · ${esc(labels[i])}: ${fmt(v)}</title></circle>`; });
  });
  const lg = series.map(s => `<span style="--c:${s.color}">${esc(s.name)}</span>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${svg}</svg><div class="legend">${lg}</div>`;
}
function barChart(labels, series, w = 720, h = 260) {
  const p = {l: 62, r: 14, t: 12, b: 28}; const max = Math.max(1, ...series.flatMap(s => s.pts)) * 1.1;
  const gw = (w - p.l - p.r) / labels.length, bw = gw * 0.7 / series.length;
  const x = i => p.l + gw * (i + .5), y = v => p.t + (h - p.t - p.b) * (1 - v / max);
  let svg = axes(w, h, p, max, labels, x);
  series.forEach((s, si) => s.pts.forEach((v, i) => { const bx = p.l + gw * i + gw * 0.15 + bw * si; svg += `<rect x="${bx}" y="${y(v)}" width="${bw - 3}" height="${Math.max(0, y(0) - y(v))}" rx="4" fill="${s.color}"><title>${esc(s.name)} · ${esc(labels[i])}: ${fmt(v)}</title></rect>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" class="chart">${svg}</svg><div class="legend">${series.map(s => `<span style="--c:${s.color}">${esc(s.name)}</span>`).join('')}</div>`;
}
const bar = (v, max, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.min(100, max ? v / max * 100 : 0)}%"></i></div>`;

// ---------- pages ----------
const pages = {};
pages.auth = () => `
  <div class="authwrap">
  <section class="hero-copy">
    <span class="eyebrow">${ic('trending-up')} FinFlow</span>
    <h1>Know where your money goes.<br><span class="grad">Plan where it grows.</span></h1>
    <p class="lead">Track your salary, spending and investments in one place, then see how your wealth can grow year by year.</p>
    <ul class="points">
      <li><span class="pi">${ic('pie')}</span><div><b>Clear visuals</b><span>Every rupee shown in charts you can read at a glance.</span></div></li>
      <li><span class="pi">${ic('shield')}</span><div><b>Private by default</b><span>Your records are visible only to you. Family sharing exposes salary totals, nothing else.</span></div></li>
      <li><span class="pi">${ic('trending-up')}</span><div><b>Growth you can plan</b><span>Project your wealth with three scenarios, adjusted for inflation.</span></div></li>
    </ul>
  </section>
  <div class="card auth">
    <button type="button" class="btn sm ghost auththeme" data-act="auththeme" aria-label="Toggle light / dark theme" title="Toggle light / dark theme">${ic('sun')}</button>
    <div class="brand"><span class="logo">${ic('trending-up')}</span> FinFlow</div>
    <div class="tabs"><button class="btn on" data-tab="login">Sign in</button><button class="btn" data-tab="register">Create account</button></div>
    <form data-form="login" class="stack"><label class="lbl">Email<input name="email" type="email" required autocomplete="email"></label>
      <label class="lbl">Password<span class="pw"><input name="password" type="password" required autocomplete="current-password"><button type="button" class="eye" data-act="eye" aria-label="Show password" title="Show / hide password">${ic('eye')}</button></span></label>
      <div class="err" id="autherr"></div><button class="btn primary">Sign in</button></form>
    <form data-form="register" class="stack" hidden><label class="lbl">Name<input name="name" required maxlength="80" autocomplete="name"></label>
      <label class="lbl">Email<input name="email" type="email" required autocomplete="email"></label>
      <label class="lbl">Password (min 8 characters)<span class="pw"><input name="password" type="password" minlength="8" required autocomplete="new-password"><button type="button" class="eye" data-act="eye" aria-label="Show password" title="Show / hide password">${ic('eye')}</button></span></label>
      <div class="err" id="autherr2"></div><button class="btn primary">Create account</button></form>
    <div class="row" style="margin:14px 0 8px"><hr style="flex:1;border-color:var(--line)"><span class="mut">or</span><hr style="flex:1;border-color:var(--line)"></div>
    <button class="btn" style="width:100%" data-act="demo">${ic('sparkles')} Explore with demo account</button>
  </div>
  </div>`;

pages.dashboard = () => {
  const p = portfolio(), gain = p.cur - p.inv, gp = p.inv ? gain / p.inv * 100 : 0;
  const cash = cashBalance(), nw = p.cur + cash, inc = monthIncome(curYM), exp = monthTotal(curYM, 'expense');
  const sip = p.sip, saved = inc - exp, rate = inc ? saved / inc * 100 : 0;
  const ms = lastMonths(6);
  const byType = {}; S.holdings.forEach(h => byType[h.type] = (byType[h.type] || 0) + h.current);
  const proj = project(p.cur, sip, S.growth.ret ?? blended(), 10, S.growth.step, S.growth.infl);
  const needs = sum(S.tx.filter(t => t.kind === 'expense' && ym(t.date) === curYM && CATS[t.cat] === 'needs'), t => t.amount);
  const wants = exp - needs, N = net();
  const tips = [];
  if (!N) tips.push(['info', 'Add your salary details on the <a href="#/salary"><b>Salary</b></a> page to unlock your full dashboard.']);
  else if (!inc) tips.push(['info', 'Log your latest <a href="#/payslips"><b>pay slip</b></a> so income and savings reflect what you actually earned.']);
  else if (rate < 20) tips.push(['alert', `Savings rate is ${rate.toFixed(0)}% — aim for 20%+. Trim "wants" or raise your SIP.`]);
  else tips.push(['check-circle', `Great! You save ${rate.toFixed(0)}% of income this month.`]);
  if (N && wants > N * S.alloc.wants / 100) tips.push(['bag', `Wants spending (${fmt(wants)}) is above your ${S.alloc.wants}% target.`]);
  if (exp && cash < exp * 6) tips.push(['shield', `Emergency cash covers ${(Math.max(cash, 0) / exp).toFixed(1)} months; target 6.`]);
  const maxType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  if (maxType && maxType[1] / p.cur > .5) tips.push(['layers', `${Math.round(maxType[1] / p.cur * 100)}% of your portfolio is in ${esc(maxType[0])} — consider diversifying.`]);
  if (!S.family) tips.push(['users', 'Manage household income together in the <a href="#/family"><b>Family</b></a> workspace.']);
  const recent = S.tx.slice(0, 5);
  const banner = !N ? `<div class="card setup"><span class="pi">${ic('wallet')}</span><div><b>Add your salary to personalise FinFlow</b><div class="mut">Your take-home, budget plan and projections are all built from it.</div></div><a class="btn primary" href="#/salary">Set up salary</a></div>` : '';
  return `
  ${banner}
  <div class="grid g4">
    <a class="card kpi hero" href="#/invest" title="Cash = starting balance + income logged - spending logged"><div class="l">Net worth</div><div class="v">${fmt(nw)}</div><div class="s">Portfolio ${fmt(p.cur, 1)} + cash ${fmt(cash, 1)}</div></a>
    <a class="card kpi" href="#/salary"><div class="l">Monthly take-home</div><div class="v">${fmt(N)}</div><div class="s mut">Retains ${S.calc.rates.retention}% of gross</div></a>
    <a class="card kpi" href="#/invest"><div class="l">Total returns</div><div class="v ${gain >= 0 ? 'up' : 'down'}">${fmt(gain)}</div><div class="s ${gain >= 0 ? 'up' : 'down'}">${pct(gp)} on ${fmt(p.inv, 1)}</div></a>
    <a class="card kpi" href="#/spending"><div class="l">Savings rate (this month)</div><div class="v ${inc ? (rate >= 20 ? 'up' : 'down') : ''}">${inc ? rate.toFixed(0) + '%' : '—'}</div><div class="s mut">${inc ? `Spent ${fmt(exp)} of ${fmt(inc)}` : 'Log a pay slip to see this'}</div></a>
  </div>
  <div class="grid g21" style="margin-top:16px">
    <div class="card"><h3>Income vs spending <a href="#/spending">Details →</a></h3>${hasData(ms) ? barChart(ms.map(m => m.label), [{name: 'Income', color: '#22c55e', pts: ms.map(m => monthIncome(m.ym))}, {name: 'Spending', color: '#ef4444', pts: ms.map(m => monthTotal(m.ym, 'expense'))}]) : emptyBox('receipt', 'No data yet', 'Log a pay slip or an expense and your monthly income and spending will appear here.', '#/payslips', 'Add a pay slip')}</div>
    <div class="card"><h3>Portfolio mix <a href="#/invest">Manage →</a></h3>${S.holdings.length ? donut(Object.entries(byType).map(([k, v], i) => ({label: k, value: v, color: COLORS[i % 8]})), ['Portfolio', fmt(p.cur, 1)]) : '<div class="empty">No investments yet</div>'}</div>
  </div>
  <div class="grid g21" style="margin-top:16px">
    <div class="card"><h3>10-year growth outlook <a href="#/growth">Open planner →</a></h3>${(p.cur || sip) ? lineChart(proj.map(x => 'Y' + x.y), [{name: 'Projected value', color: '#6366f1', pts: proj.map(x => x.v)}, {name: 'Money invested', color: '#f59e0b', pts: proj.map(x => x.inv), dash: 1}]) : emptyBox('trending-up', 'Nothing to project yet', 'Add an investment or a monthly SIP and your 10-year outlook will appear here.', '#/invest?add=1', 'Add an investment')}</div>
    <div class="stack">
      <div class="card"><h3>Smart insights</h3>${tips.map(t => `<div class="tip"><span style="color:${TIPC[t[0]] || 'var(--pri)'}">${ic(t[0])}</span><span>${t[1]}</span></div>`).join('')}</div>
      <div class="card"><h3>Goals <a href="#/growth">Edit →</a></h3>${S.goals.map(g => `<div style="margin-bottom:10px"><div class="row"><span>${esc(g.name)}</span><span class="mut">${Math.min(100, pct1(g.saved, g.target))}% · ${fmt(g.saved, 1)}</span></div>${bar(g.saved, g.target)}</div>`).join('') || '<div class="empty">No goals</div>'}</div>
    </div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Recent transactions <a href="#/spending">All →</a></h3>${txTable(recent, false)}</div>`;
};

function txTable(list, del) {
  if (!list.length) return '<div class="empty">No transactions</div>';
  return `<div class="tbl"><table><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th>${del ? '<th></th>' : ''}</tr>${list.map(t => `<tr><td>${t.date}</td><td>${esc(t.desc)}</td><td><span class="pill">${esc(t.cat)}</span></td><td style="text-align:right" class="${t.kind === 'income' ? 'up' : ''}">${t.kind === 'income' ? '+' : '−'}${fmt(t.amount)}</td>${del ? `<td>${editBtn('tx', t.id)} <button class="btn sm danger" data-act="deltx" data-id="${t.id}">${ic('x')}</button></td>` : ''}</tr>`).join('')}</table></div>`;
}

function calcOut(c) {
  const m = c.monthly;
  const rows = [['Yearly', c.yearly], ['Monthly', c.monthly], ['Bi-weekly', c.biweekly], ['Weekly', c.weekly], ['Daily', c.daily]];
  return `
    <div class="tip" style="margin-bottom:12px"><span>${ic('info')}</span><span>${fmt(m.gross)} gross per month → <b>${fmt(m.net)}</b> take-home${m.total_deductions ? ` after ${fmt(m.total_deductions)} of deductions (tax ${fmt(m.tax)}, pension ${fmt(m.pension)}, insurance ${fmt(m.insurance)}, other ${fmt(m.other)})` : ', because no deductions are entered'}.</span></div>
    <div class="grid g2" style="margin-bottom:12px">
      <div class="card kpi" style="padding:12px"><div class="l">Monthly net</div><div class="v up">${fmt(m.net)}</div></div>
      <div class="card kpi" style="padding:12px"><div class="l">Yearly net</div><div class="v">${fmt(c.yearly.net, 1)}</div></div>
    </div>
    ${donut([{label: 'Take-home', value: m.net, color: '#22c55e'}, {label: 'Tax', value: m.tax, color: '#ef4444'}, {label: 'Pension/PF', value: m.pension, color: '#6366f1'}, {label: 'Insurance', value: m.insurance, color: '#f59e0b'}, {label: 'Other', value: m.other, color: '#06b6d4'}], ['Monthly gross', fmt(m.gross, 1)])}
    <div class="tbl" style="margin-top:12px"><table><tr><th>Period</th><th>Gross</th><th>Deductions</th><th>Net</th></tr>${rows.map(([n, r]) => `<tr><td>${n}</td><td>${fmt(r.gross)}</td><td>${fmt(r.total_deductions)}</td><td class="up">${fmt(r.net)}</td></tr>`).join('')}</table></div>
    <div class="legend"><span style="--c:#22c55e">Retention ${c.rates.retention}%</span><span style="--c:#ef4444">Effective tax ${c.rates.effective_tax}%</span><span style="--c:#6366f1">Hourly ${fmt(c.hourly.rate)} → net ${fmt(c.hourly.net)}</span></div>`;
}

pages.salary = () => {
  const pr = S.profile, N = net(), a = S.alloc, inv = 100 - a.needs - a.wants;
  const exp = monthTotal(curYM, 'expense');
  const needs = sum(S.tx.filter(t => t.kind === 'expense' && ym(t.date) === curYM && CATS[t.cat] === 'needs'), t => t.amount);
  const wants = exp - needs, sip = portfolio().sip;
  const row = (name, planned, actual) => `<div style="margin-bottom:14px"><div class="row"><b>${name}</b><span class="mut">${fmt(actual)} / ${fmt(planned)}</span></div>${bar(actual, planned, actual > planned ? 'bad' : 'ok')}</div>`;
  return `
  <div class="grid g2">
    <form class="card" id="pform" data-form="profile"><h3>Salary profile <span class="pill">amounts are per pay period</span></h3>
      <div class="form">
        <label class="lbl">Pay frequency<select name="pay_frequency">${FREQS.map(([v, l]) => `<option value="${v}" ${v === pr.pay_frequency ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${PF.map(([k, l]) => `<label class="lbl">${l}<input name="${k}" type="number" min="0" step="any" placeholder="${k === 'standard_hours_per_week' ? '40' : k === 'overtime_rate_multiplier' ? '1.5' : '0'}" value="${pr[k]}"></label>`).join('')}
        <label class="lbl">Starting cash balance<input name="cash" type="number" min="0" step="any" placeholder="0" value="${S.cash}"></label>
      </div>
      <div class="mut" style="margin-top:12px;font-size:13px;line-height:1.5">Tax % and Pension % are <b>subtracted</b> from your salary to get take-home. Leave them at 0 if the amount you entered is already after deductions. Starting cash is what you have in the bank today; income and spending you log are added to it automatically.</div>
      <button class="btn primary" style="margin-top:14px">Save &amp; view dashboard →</button>
    </form>
    <div class="card"><h3>Live breakdown</h3><div id="calcout">${calcOut(S.calc)}</div></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Allocate your salary</h3>
      <div class="stack">
        <label class="lbl"><span>Needs (rent, bills, food): <b id="an">${a.needs}%</b></span><input type="range" min="0" max="100" value="${a.needs}" data-alloc="needs"></label>
        <label class="lbl"><span>Wants (fun, shopping): <b id="aw">${a.wants}%</b></span><input type="range" min="0" max="100" value="${a.wants}" data-alloc="wants"></label>
        <div class="tip"><span>${ic('trending-up')}</span><span>Invest &amp; save: <b id="ai">${inv}%</b> (${fmt(N * Math.max(inv, 0) / 100)} / month)</span></div>
        ${donut([{label: 'Needs', value: a.needs, color: '#6366f1'}, {label: 'Wants', value: a.wants, color: '#f59e0b'}, {label: 'Invest', value: Math.max(inv, 0), color: '#22c55e'}], ['Take-home', fmt(N, 1)])}
      </div>
    </div>
    <div class="card"><h3>This month: plan vs actual <a href="#/spending?add=1">+ Add expense →</a></h3>
      ${row('Needs', N * a.needs / 100, needs)}${row('Wants', N * a.wants / 100, wants)}
      <div style="margin-bottom:6px"><div class="row"><b>Invest (monthly SIPs)</b><span class="mut">${fmt(sip)} / ${fmt(N * Math.max(inv, 0) / 100)}</span></div>${bar(sip, N * inv / 100, 'ok')}</div>
      ${inv < 0 ? `<div class="tip"><span style="color:var(--warn)">${ic('alert')}</span><span>Needs + wants exceed 100%.</span></div>` : ''}
    </div>
  </div>`;
};

pages.payslips = () => {
  const list = S.payslips, ytd = list.filter(p => p.pay_date.startsWith(String(new Date().getFullYear())));
  const asc = [...list].reverse().slice(-12);
  const catName = c => (SLIP_CATS.find(x => x[0] === c) || [c, c])[1];
  return `
  <div class="grid g3">
    <div class="card kpi"><div class="l">Pay slips logged</div><div class="v">${list.length}</div></div>
    <div class="card kpi"><div class="l">Net received this year</div><div class="v up">${fmt(sum(ytd, p => p.net))}</div></div>
    <div class="card kpi"><div class="l">Average net / slip</div><div class="v">${fmt(list.length ? sum(list, p => p.net) / list.length : 0)}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Earnings history</h3>${asc.length > 1 ? lineChart(asc.map(p => p.pay_date.slice(2, 7)), [{name: 'Net pay', color: '#22c55e', pts: asc.map(p => p.net)}, {name: 'Gross pay', color: '#6366f1', pts: asc.map(p => p.gross), dash: 1}]) : '<div class="empty">Add at least two pay slips to see your trend</div>'}</div>
  <form class="card" id="slipform" data-form="payslip" style="margin-top:16px"><h3>Log a pay slip</h3>
    <div class="form">
      <label class="lbl">Title<input name="title" required value="Monthly salary" maxlength="120"></label>
      <label class="lbl">Pay date<input name="pay_date" type="date" value="${iso(new Date())}" required></label>
      <label class="lbl">Category<select name="category">${SLIP_CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="lbl">Gross<input name="gross" type="number" min="0" step="any" required></label>
      <label class="lbl">Tax<input name="tax" type="number" min="0" step="any" value="0"></label>
      <label class="lbl">Pension / PF<input name="pension" type="number" min="0" step="any" value="0"></label>
      <label class="lbl">Insurance<input name="insurance" type="number" min="0" step="any" value="0"></label>
      <label class="lbl">Other deductions<input name="other" type="number" min="0" step="any" value="0"></label>
      <label class="lbl">Notes<input name="notes" maxlength="500"></label>
    </div>
    <div class="row" style="justify-content:flex-start;margin-top:14px"><button class="btn primary">Add pay slip</button><button type="button" class="btn" data-act="slipgen">${ic('zap')} Generate from my salary profile</button></div>
  </form>
  <div class="card" style="margin-top:16px"><h3>Pay slips <a class="btn sm" href="/api/payslips/export.csv" download>${ic('download')} Export CSV</a></h3>
    ${list.length ? `<div class="tbl"><table><tr><th>Date</th><th>Title</th><th>Category</th><th>Gross</th><th>Deductions</th><th>Net</th><th></th></tr>${list.map(p => `<tr><td>${p.pay_date}</td><td>${esc(p.title)}</td><td><span class="pill">${esc(catName(p.category))}</span></td><td>${fmt(p.gross)}</td><td>${fmt(p.tax + p.pension + p.insurance + p.other)}</td><td class="up">${fmt(p.net)}</td><td style="white-space:nowrap"><a class="btn sm" href="/print/${p.id}" target="_blank" rel="noopener">${ic('printer')} Print</a> ${editBtn('slip', p.id)} <button class="btn sm danger" data-act="delslip" data-id="${p.id}">${ic('x')}</button></td></tr>`).join('')}</table></div>` : '<div class="empty">No pay slips yet</div>'}
  </div>`;
};

const bulkRow = (kind = 'expense', date = iso(new Date())) => `<div class="brow">
  <select name="k" aria-label="Type"><option value="expense" ${kind === 'expense' ? 'selected' : ''}>Expense</option><option value="income" ${kind === 'income' ? 'selected' : ''}>Extra income</option></select>
  <input name="t" type="date" value="${date}" aria-label="Date">
  <input name="d" placeholder="e.g. Groceries" maxlength="120" aria-label="Description">
  <select name="c" aria-label="Category">${Object.keys(CATS).map(c => `<option>${c}</option>`).join('')}</select>
  <input name="a" type="number" min="0.01" step="any" placeholder="0.00" aria-label="Amount">
  <button type="button" class="btn sm danger" data-act="delrow" aria-label="Remove row" title="Remove row">${ic('x')}</button></div>`;
function parseBulk(f) {
  const kind = 'expense', dflt = iso(new Date()), items = [];
  f.querySelectorAll('#brows .brow').forEach(r => { const q = n => r.querySelector(`[name=${n}]`).value, d = q('d').trim(), a = q('a'); if (d || a) items.push({kind: q('k'), date: q('t'), desc: d, cat: q('c'), amount: a}); });
  f.paste.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
    let p = line.split(/\t|,/).map(s => s.trim());
    let date = dflt; if (/^\d{4}-\d{2}-\d{2}$/.test(p[0])) date = p.shift();
    const amount = p.pop(), cat = p.length > 1 ? p.pop() : 'Other', desc = p.join(', ');
    items.push({kind, date, desc, cat: Object.keys(CATS).find(c => c.toLowerCase() === cat.toLowerCase()) || 'Other', amount: String(amount).replace(/[^0-9.]/g, '')});
  });
  return items;
}
let spendFilter = 'All';
pages.spending = () => {
  const ms = lastMonths(6), cm = monthTotal(curYM, 'expense'), cats = {};
  S.tx.filter(t => t.kind === 'expense' && ym(t.date) === curYM).forEach(t => cats[t.cat] = (cats[t.cat] || 0) + t.amount);
  const list = S.tx.filter(t => spendFilter === 'All' || t.cat === spendFilter).slice(0, 60);
  return `
  <div class="grid g21">
    <div class="card"><h3>Monthly spending trend</h3>${hasData(ms) ? barChart(ms.map(m => m.label), [{name: 'Spending', color: '#ec4899', pts: ms.map(m => monthTotal(m.ym, 'expense'))}, {name: 'Income', color: '#22c55e', pts: ms.map(m => monthIncome(m.ym))}]) : emptyBox('arrows', 'No spending logged yet', 'Add your first expense below and your monthly trend will appear here.')}</div>
    <div class="card"><h3>This month by category</h3>${Object.keys(cats).length ? donut(Object.entries(cats).map(([k, v], i) => ({label: k, value: v, color: COLORS[i % 8]})), ['Spent', fmt(cm, 1)]) : '<div class="empty">No spending yet</div>'}</div>
  </div>
  <form class="card" id="addtx" data-form="tx" style="margin-top:16px"><h3>Add transaction</h3>
    <div class="form">
      <label class="lbl">Type<select name="kind"><option value="expense">Expense</option><option value="income">Extra income</option></select></label>
      <label class="lbl">Date<input name="date" type="date" value="${iso(new Date())}" required></label>
      <label class="lbl">Description<input name="desc" placeholder="e.g. Groceries" required maxlength="120"></label>
      <label class="lbl">Category<select name="cat">${Object.keys(CATS).map(c => `<option>${c}</option>`).join('')}</select></label>
      <label class="lbl">Amount<input name="amount" type="number" min="0.01" step="any" required></label>
      <button class="btn primary">Add</button>
    </div></form>
  <form class="card" id="bulk" data-form="bulk" style="margin-top:16px"><h3>Bulk add <span class="pill">add many at once</span></h3>
    <div class="brow bhead"><span>Type</span><span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span></span></div>
    <div id="brows" class="stack" style="gap:10px">${[1, 2, 3, 4, 5].map(() => bulkRow()).join('')}</div>
    <div class="row" style="justify-content:flex-start;margin-top:12px"><button type="button" class="btn sm" data-act="addrow">+ Add row</button></div>
    <label class="lbl" style="margin-top:14px">…or paste lines — <span>[date,] description, category, amount (comma or tab separated, e.g. from a spreadsheet)</span>
      <textarea name="paste" rows="4" placeholder="Milk and eggs, Groceries, 240&#10;2026-11-03, Metro card, Transport, 500" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;width:100%"></textarea></label>
    <div class="row" style="justify-content:flex-start;margin-top:14px"><button class="btn primary">Add all</button><span class="mut" id="bulkinfo" style="font-size:13px"></span></div>
  </form>
  <div class="card" style="margin-top:16px"><h3>Transactions
    <select id="fcat" style="width:auto"><option>All</option>${Object.keys(CATS).map(c => `<option ${c === spendFilter ? 'selected' : ''}>${c}</option>`).join('')}</select></h3>${txTable(list, true)}</div>`;
};

pages.invest = () => {
  const p = portfolio(), gain = p.cur - p.inv, byType = {};
  S.holdings.forEach(h => byType[h.type] = (byType[h.type] || 0) + h.current);
  return `
  <div class="grid g3">
    <div class="card kpi"><div class="l">Invested</div><div class="v">${fmt(p.inv)}</div></div>
    <div class="card kpi"><div class="l">Current value</div><div class="v">${fmt(p.cur)}</div></div>
    <div class="card kpi"><div class="l">Gain / loss</div><div class="v ${gain >= 0 ? 'up' : 'down'}">${fmt(gain)}</div><div class="s ${gain >= 0 ? 'up' : 'down'}">${pct(p.inv ? gain / p.inv * 100 : 0)} · SIP ${fmt(p.sip)}/mo</div></div>
  </div>
  <div class="grid g21" style="margin-top:16px">
    <div class="card"><h3>Holdings <a href="#/growth">See growth projection →</a></h3>
      ${S.holdings.length ? `<div class="tbl"><table><tr><th>Name</th><th>Type</th><th>Invested</th><th>Current value</th><th>Return</th><th>SIP/mo</th><th></th></tr>${S.holdings.map(h => { const g = h.invested ? (h.current - h.invested) / h.invested * 100 : 0; return `<tr><td>${esc(h.name)}</td><td><span class="pill">${esc(h.type)}</span></td><td>${fmt(h.invested)}</td><td><input type="number" min="0" value="${h.current}" data-edit="${h.id}" title="Update current value"></td><td class="${g >= 0 ? 'up' : 'down'}">${pct(g)}</td><td>${fmt(h.sip)}</td><td>${editBtn('holding', h.id)} <button class="btn sm danger" data-act="delh" data-id="${h.id}">${ic('x')}</button></td></tr>`; }).join('')}</table></div>` : '<div class="empty">Add your first investment below</div>'}
    </div>
    <div class="card"><h3>Allocation</h3>${S.holdings.length ? donut(Object.entries(byType).map(([k, v], i) => ({label: k, value: v, color: COLORS[i % 8]})), ['Total', fmt(p.cur, 1)]) : '<div class="empty">—</div>'}</div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Holdings value vs invested</h3>${S.holdings.length ? barChart(S.holdings.map(h => h.name.slice(0, 10)), [{name: 'Invested', color: '#f59e0b', pts: S.holdings.map(h => h.invested)}, {name: 'Current', color: '#22c55e', pts: S.holdings.map(h => h.current)}]) : '<div class="empty">—</div>'}</div>
  <form class="card" id="bulkh" data-form="bulkh" style="margin-top:16px"><h3>Bulk add investments <span class="pill">paste many at once</span></h3>
    <label class="lbl"><span>One per line: name, type, invested[, current value[, monthly SIP]] — comma or tab separated. Types: ${TYPES.join(', ')}</span>
      <textarea name="paste" rows="4" required placeholder="Axis Bluechip, Mutual Fund, 50000, 56000, 2000&#10;Sovereign Gold Bond, Gold, 30000" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;width:100%"></textarea></label>
    <button class="btn primary" style="margin-top:12px">Add all</button>
  </form>
  <form class="card" id="addh" data-form="holding" style="margin-top:16px"><h3>Add investment</h3>
    <div class="form">
      <label class="lbl">Name<input name="name" required maxlength="120" placeholder="e.g. Axis Bluechip"></label>
      <label class="lbl">Type<select name="type">${TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label class="lbl">Amount invested<input name="invested" type="number" min="0" step="any" required></label>
      <label class="lbl">Current value<input name="current" type="number" min="0" step="any" placeholder="same as invested"></label>
      <label class="lbl">Monthly SIP<input name="sip" type="number" min="0" step="any" value="0"></label>
      <button class="btn primary">Add &amp; project growth →</button>
    </div></form>`;
};

pages.growth = () => {
  const g = S.growth, p = portfolio(), N = net();
  const monthly = g.monthly ?? p.sip, start = g.start ?? p.cur, ret = g.ret ?? +blended().toFixed(1);
  const f = (k, label, v, extra = '') => `<label class="lbl">${label}<input type="number" step="any" data-g="${k}" value="${v}" ${extra}></label>`;
  return `
  <div class="card"><h3>Plan your wealth <span class="pill">Blended return of your portfolio ≈ ${blended().toFixed(1)}%</span></h3>
    <div class="form">${f('start', 'Starting corpus', start)}${f('monthly', 'Monthly investment', monthly)}${f('ret', 'Expected return % / yr', ret)}${f('years', 'Years', g.years, 'min="1" max="50"')}${f('step', 'Yearly SIP step-up %', g.step)}${f('infl', 'Inflation %', g.infl)}${f('target', 'Target amount', g.target)}</div>
    <div class="mut" style="margin-top:8px;font-size:13px">Tip: your take-home is ${fmt(N)}; investing ${fmt(N * Math.max(0, 100 - S.alloc.needs - S.alloc.wants) / 100)}/month matches your salary allocation.</div>
  </div>
  <div id="gout" class="stack" style="margin-top:16px"></div>
  <form class="card" data-form="goal" style="margin-top:16px"><h3>Goals</h3>
    <div class="stack" id="goals">${S.goals.map(goalRow).join('') || '<div class="empty">No goals yet</div>'}</div>
    <div class="form" style="margin-top:14px">
      <label class="lbl">Goal<input name="name" required maxlength="120" placeholder="e.g. Europe trip"></label>
      <label class="lbl">Target<input name="target" type="number" min="1" step="any" required></label>
      <label class="lbl">Saved so far<input name="saved" type="number" min="0" step="any" value="0"></label>
      <label class="lbl">Target date<input name="date" type="date" required></label>
      <button class="btn primary">Add goal</button>
    </div></form>`;
};
let flashGoal = null;
const pct1 = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
function goalRow(x) {
  const left = Math.max(0, x.target - x.saved), pctDone = Math.min(100, pct1(x.saved, x.target));
  const days = Math.ceil((new Date(x.date + 'T23:59:59') - new Date()) / 864e5), months = Math.max(1, Math.ceil(days / 30.4));
  const status = left <= 0 ? '<span class="pill good">Reached</span>' : days < 0 ? '<span class="pill late">Past due</span>' : '';
  const hint = left <= 0 ? 'Goal reached — well done.' : days < 0 ? `${fmt(left)} still to go.` : `${fmt(left)} to go · save about <b>${fmt(left / months)}</b> a month to finish by ${x.date}.`;
  return `<div class="goal${same(flashGoal, x.id) ? ' flash' : ''}"><div class="row"><b>${esc(x.name)} ${status}</b>
    <span class="gactions"><button type="button" class="btn sm primary" data-act="addmoney" data-id="${x.id}">${ic('plus')} Add money</button>${editBtn('goal', x.id)} <button type="button" class="btn sm danger" data-act="delg" data-id="${x.id}" title="Delete" aria-label="Delete">${ic('x')}</button></span></div>
    <div class="gmeta">${fmt(x.saved)} of ${fmt(x.target)} (${pctDone}%) · due ${x.date}<br>${hint}</div>${bar(x.saved, x.target, left <= 0 ? 'ok' : '')}</div>`;
}function growthOut() {
  const g = S.growth, p = portfolio();
  const monthly = g.monthly ?? p.sip, start = g.start ?? p.cur, ret = g.ret ?? +blended().toFixed(1);
  const years = Math.max(1, Math.min(50, g.years || 1));
  const base = project(start, monthly, ret, years, g.step, g.infl), lo = project(start, monthly, Math.max(0, ret - 3), years, g.step, g.infl), hi = project(start, monthly, ret + 3, years, g.step, g.infl);
  const end = base[years], hit = base.find(x => x.v >= g.target);
  const labels = base.map(x => 'Y' + x.y);
  $('#gout').innerHTML = `
    <div class="grid g4">
      <div class="card kpi"><div class="l">Value in ${years} yrs</div><div class="v">${fmt(end.v, 1)}</div></div>
      <div class="card kpi"><div class="l">You invest</div><div class="v">${fmt(end.inv, 1)}</div></div>
      <div class="card kpi"><div class="l">Growth earned</div><div class="v up">${fmt(end.v - end.inv, 1)}</div><div class="s mut">${(end.v / (end.inv || 1)).toFixed(1)}× your money</div></div>
      <div class="card kpi"><div class="l">Inflation-adjusted</div><div class="v">${fmt(end.real, 1)}</div><div class="s mut">Today's purchasing power</div></div>
    </div>
    <div class="tip"><span>${ic('target')}</span><span>${hit ? `You reach <b>${fmt(g.target, 1)}</b> in about <b>${hit.y} years</b>.` : `At this pace you won't reach ${fmt(g.target, 1)} in ${years} years — increase monthly investment, step-up or years.`}</span></div>
    <div class="card"><h3>Wealth projection (3 scenarios)</h3>${lineChart(labels, [{name: `Expected ${ret}%`, color: '#6366f1', pts: base.map(x => x.v)}, {name: `Optimistic ${(ret + 3).toFixed(1)}%`, color: '#22c55e', pts: hi.map(x => x.v), dash: 1}, {name: `Conservative ${Math.max(0, ret - 3).toFixed(1)}%`, color: '#ef4444', pts: lo.map(x => x.v), dash: 1}, {name: 'Money invested', color: '#f59e0b', pts: base.map(x => x.inv), dash: 1}])}</div>`;
}

pages.family = () => {
  const f = S.family;
  if (!f) return `
    <div class="grid g2">
      <form class="card" data-form="famcreate"><h3>Create a family workspace</h3><p class="mut">Pool household income and see each earner's contribution. You'll get an invite code to share.</p>
        <label class="lbl">Family name<input name="name" required maxlength="60" placeholder="e.g. The Sharma Household"></label><button class="btn primary" style="margin-top:12px">Create workspace</button></form>
      <form class="card" data-form="famjoin"><h3>Join with an invite code</h3><p class="mut">Ask the family admin for their 8-character code.</p>
        <label class="lbl">Invite code<input name="code" required maxlength="9" placeholder="ABCD-2345" style="text-transform:uppercase"></label><button class="btn primary" style="margin-top:12px">Join family</button></form>
    </div>
    <div class="tip" style="margin-top:16px"><span>${ic('lock')}</span><span>Only salary figures (gross &amp; net monthly) are shared with the household. Your spending, investments and goals stay private.</span></div>`;
  return `
  <div class="card"><div class="row"><div><h3 style="margin:0">${esc(f.name)}</h3><div class="mut" style="margin-top:4px">Share this code to invite members</div></div>
    <div class="row"><span class="code" id="code">${esc(f.invite_code)}</span><button class="btn sm" data-act="copycode">Copy</button></div></div></div>
  <div class="grid g3" style="margin-top:16px">
    <div class="card kpi"><div class="l">Household gross / month</div><div class="v">${fmt(f.monthly_gross)}</div></div>
    <div class="card kpi"><div class="l">Household net / month</div><div class="v up">${fmt(f.monthly_net)}</div></div>
    <div class="card kpi"><div class="l">Household net / year</div><div class="v">${fmt(f.annual_net, 1)}</div></div>
  </div>
  <div class="grid g21" style="margin-top:16px">
    <div class="card"><h3>Members</h3><div class="tbl"><table><tr><th>Member</th><th>Gross / mo</th><th>Net / mo</th><th>Share</th></tr>${f.members.map((m, i) => `<tr><td>${esc(m.name)} ${m.admin ? '<span class="pill">admin</span>' : ''} ${m.you ? '<span class="pill">you</span>' : ''}</td><td>${fmt(m.gross)}</td><td class="up">${fmt(m.net)}</td><td style="min-width:110px">${m.share}%${bar(m.share, 100)}</td></tr>`).join('')}</table></div></div>
    <div class="card"><h3>Contribution share</h3>${donut(f.members.map((m, i) => ({label: m.name, value: m.net, color: COLORS[i % 8]})), ['Household net', fmt(f.monthly_net, 1)])}</div>
  </div>
  <div style="margin-top:16px"><button class="btn danger" data-act="leavefam">Leave family</button></div>`;
};

// ---------- router ----------
const titles = {dashboard: 'Dashboard', salary: 'Salary & Budget', payslips: 'Pay Slips', spending: 'Spending', invest: 'Investments', growth: 'Growth Planner', family: 'Family'};
function route() {
  document.body.classList.toggle('authed', !!S);
  if (!S) {
    document.title = 'Sign in · FinFlow';
    if (!document.documentElement.dataset.set) document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';   // first visit follows the system theme
    $('#view').innerHTML = pages.auth(); return;
  }
  const [path, qs] = (location.hash.slice(2) || '').split('?');
  if (!titles[path]) { location.replace('#/dashboard'); return; }   // unknown routes redirect home
  $('#title').textContent = titles[path];
  document.title = titles[path] + ' · FinFlow';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === path));
  $('#who').textContent = S.user.name;
  $('#reset').hidden = !(S.user.demo && S.user.email === 'demo@finflow.local');
  $('#cur').value = S.currency; $('#cur')._cs?.sync();
  document.documentElement.dataset.theme = S.theme; themeIcon();
  $('#view').innerHTML = pages[path]();
  $('.side').classList.remove('open');
  if (path === 'growth') growthOut();
  if (qs && qs.includes('add=1')) { const t = path === 'spending' ? $('#addtx') : path === 'invest' ? $('#addh') : null; if (t) { t.scrollIntoView({behavior: 'smooth'}); const i = t.querySelector('input[name=desc],input[name=name]'); if (i) setTimeout(() => i.focus(), 400); } }
  else scrollTo(0, 0);
  if (!S.onboarded && !tour) startTour();
}
const go = h => { if (location.hash === h) route(); else location.hash = h; };
addEventListener('hashchange', route);
const adopt = state => { S = state; sortTx(); sortSlips(); go('#/dashboard'); };

// ---------- edit dialog ----------
const EDIT = {
  tx: {title: 'Edit transaction', url: '/api/transactions/', list: () => S.tx, sort: sortTx, fields: [
    ['kind', 'Type', 'select', [['expense', 'Expense'], ['income', 'Extra income']]], ['date', 'Date', 'date'], ['desc', 'Description', 'text'],
    ['cat', 'Category', 'select', Object.keys(CATS).map(c => [c, c])], ['amount', 'Amount', 'number']]},
  holding: {title: 'Edit investment', url: '/api/holdings/', list: () => S.holdings, fields: [
    ['name', 'Name', 'text'], ['type', 'Type', 'select', TYPES.map(t => [t, t])], ['invested', 'Amount invested', 'number'], ['current', 'Current value', 'number'], ['sip', 'Monthly SIP', 'number']]},
  goal: {title: 'Edit goal', url: '/api/goals/', list: () => S.goals, sort: () => S.goals.sort((a, b) => a.date.localeCompare(b.date)), fields: [
    ['name', 'Goal', 'text'], ['target', 'Target', 'number'], ['saved', 'Saved so far', 'number'], ['date', 'Target date', 'date']]},
  slip: {title: 'Edit pay slip', url: '/api/payslips/', list: () => S.payslips, sort: sortSlips, fields: [
    ['title', 'Title', 'text'], ['pay_date', 'Pay date', 'date'], ['category', 'Category', 'select', SLIP_CATS], ['gross', 'Gross', 'number'], ['allowances', 'Allowances (part of gross)', 'number'],
    ['tax', 'Tax', 'number'], ['pension', 'Pension / PF', 'number'], ['insurance', 'Insurance', 'number'], ['other', 'Other deductions', 'number'], ['notes', 'Notes', 'text']]}
};
let editing = null;
const closeEdit = () => { const m = $('#modal'); if (m) m.remove(); editing = null; };
function openEdit(kind, id) {
  const spec = EDIT[kind], rec = spec.list().find(r => same(r.id, id)); if (!rec) return;
  closeEdit(); editing = {kind, id};
  const field = ([n, l, t, o]) => t === 'select'
    ? `<label class="lbl">${l}<select name="${n}">${o.map(([v, x]) => `<option value="${esc(v)}" ${v === rec[n] ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`
    : `<label class="lbl">${l}<input name="${n}" type="${t}" ${t === 'number' ? 'min="0" step="any"' : ''} value="${esc(rec[n] ?? '')}" ${n === 'notes' ? '' : 'required'}></label>`;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="modal"><form class="card mbox" data-form="edit"><h3>${spec.title}<button type="button" class="btn sm ghost" data-act="closemodal" aria-label="Close">${ic('x')}</button></h3>
    <div class="form">${spec.fields.map(field).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:18px"><button type="button" class="btn" data-act="closemodal">Cancel</button><button class="btn primary">Save changes</button></div></form></div>`);
  setTimeout(() => { const i = $('#modal input'); if (i) i.focus(); }, 60);
}

function openContribute(id) {
  const g = S.goals.find(x => same(x.id, id)); if (!g) return;
  closeEdit(); editing = {kind: 'contribute', id};
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="modal"><form class="card mbox" data-form="contribute" style="width:min(420px,100%)"><h3>Add money to ${esc(g.name)}<button type="button" class="btn sm ghost" data-act="closemodal" aria-label="Close">${ic('x')}</button></h3>
    <p class="mut" style="margin:0 0 14px">Saved so far ${fmt(g.saved)} of ${fmt(g.target)}. Enter what you are setting aside now; it is added to the saved amount.</p>
    <label class="lbl">Amount to add<input name="amount" type="number" min="0.01" step="any" required placeholder="e.g. 5000"></label>
    <div class="row" style="justify-content:flex-end;margin-top:18px"><button type="button" class="btn" data-act="closemodal">Cancel</button><button class="btn primary">Add to goal</button></div></form></div>`);
  setTimeout(() => { const i = $('#modal input'); if (i) i.focus(); }, 60);
}

// ---------- first-login tour (ends by asking for the salary) ----------
const TOUR = [
  {t: 'Welcome to FinFlow', d: 'A 30-second tour, then we will set up your salary so every chart and total reflects your own money.'},
  {r: 'dashboard', t: 'Dashboard', d: 'Net worth, savings rate and trends. Everything here is built only from what you record.'},
  {r: 'salary', t: 'Salary & Budget', d: 'Enter your pay and deductions once. See take-home per week, month and year, and split it into needs, wants and investing.'},
  {r: 'payslips', t: 'Pay Slips', d: 'Log each pay slip you receive. Your income charts and cash balance are built from these. Print or export any time.'},
  {r: 'spending', t: 'Spending', d: 'Add expenses one at a time or in bulk. You can edit or delete any entry later.'},
  {r: 'invest', t: 'Investments', d: 'Track holdings, returns and monthly SIPs. Edit values whenever they change.'},
  {r: 'growth', t: 'Growth Planner', d: 'Project your wealth under three scenarios and set savings goals.'},
  {r: 'family', t: 'Family', d: 'Create a household with an invite code to see combined income. Only salary totals are shared.'},
  {final: true}
];
let tour = null, tourWasCollapsed = false;
function startTour() {
  if (tour || !S) return;
  tour = {i: 0};
  const app = $('#app'); tourWasCollapsed = app.classList.contains('collapsed'); app.classList.remove('collapsed');
  if (location.hash !== '#/dashboard') location.hash = '#/dashboard';
  document.body.insertAdjacentHTML('beforeend', '<div id="tour"><div class="tour-block"></div><div class="tour-dim"></div><div class="tour-hole"></div><div class="tour-pop card" role="dialog" aria-modal="true"></div></div>');
  renderTour();
}
async function endTour() {
  try { await api('PUT', '/api/settings', {onboarded: true}); } catch {}
  S.onboarded = true;
  const t = $('#tour'); if (t) t.remove();
  tour = null; if (tourWasCollapsed) $('#app').classList.add('collapsed');
}
function renderTour() {
  if (!tour) return;
  const s = TOUR[tour.i], pop = $('#tour .tour-pop'), hole = $('#tour .tour-hole'), dim = $('#tour .tour-dim');
  const dots = TOUR.map((_, i) => `<i class="${i === tour.i ? 'on' : ''}"></i>`).join('');
  if (s.final) {
    const pr = S.profile;
    pop.innerHTML = `<div class="tour-step">Last step</div><h3>Set up your salary</h3>
      <p>Tell us what you earn so your dashboard shows your own numbers. You can change this any time on the Salary page.</p>
      <form data-form="tourfinish" class="stack"><div class="form" style="grid-template-columns:1fr 1fr">
        <label class="lbl">Pay frequency<select name="pay_frequency">${FREQS.map(([v, l]) => `<option value="${v}" ${v === pr.pay_frequency ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="lbl">Salary (before tax)<input name="base_salary" type="number" min="0" step="any" required placeholder="e.g. 50000" value="${pr.base_salary || ''}"></label>
        <label class="lbl">Tax % (0 if already deducted)<input name="tax_rate" type="number" min="0" max="70" step="any" placeholder="0" value="${pr.tax_rate || ''}"></label>
        <label class="lbl">Savings in bank today<input name="cash" type="number" min="0" step="any" placeholder="0" value="${S.cash || ''}"></label></div>
        <div class="tour-dots">${dots}</div>
        <div class="row"><button type="button" class="btn ghost sm" data-act="tourskip">Skip for now</button><button class="btn primary">Finish &amp; open dashboard</button></div></form>`;
  } else {
    pop.innerHTML = `<div class="tour-step">${tour.i + 1} of ${TOUR.length}</div><h3>${s.t}</h3><p>${s.d}</p><div class="tour-dots">${dots}</div>
      <div class="row"><button type="button" class="btn ghost sm" data-act="tourskip">Skip tour</button><span class="row" style="gap:8px">${tour.i ? '<button type="button" class="btn sm" data-act="tourback">Back</button>' : ''}<button type="button" class="btn primary sm" data-act="tournext">${tour.i ? 'Next' : 'Start tour'}</button></span></div>`;
  }
  const target = s.r && innerWidth > 760 ? $(`#nav a[data-r="${s.r}"]`) : null;
  if (target) {
    const r = target.getBoundingClientRect();
    hole.style.cssText = `display:block;left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`; dim.style.display = 'none';
    pop.style.cssText = `left:${Math.min(r.right + 22, innerWidth - pop.offsetWidth - 12)}px;top:${Math.max(12, Math.min(r.top - 8, innerHeight - pop.offsetHeight - 12))}px;transform:none`;
  } else { hole.style.display = 'none'; dim.style.display = 'block'; pop.style.cssText = ''; }
}
addEventListener('resize', () => { if (tour) renderTour(); });

// ---------- events ----------
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
  try {
    switch (f.dataset.form) {
      case 'login': adopt(await api('POST', '/api/login', d)); break;
      case 'register': { const th = document.documentElement.dataset.theme, st = await api('POST', '/api/register', d); st.theme = th; adopt(st); saveSettings(); break; }
      case 'profile': { const r = await api('PUT', '/api/profile', d); S.profile = r.profile; S.calc = r.calc; S.cash = r.cash; toast('Salary saved'); go('#/dashboard'); break; }
      case 'tx': { const r = await api('POST', '/api/transactions', d); S.tx.push(r); sortTx(); toast('Transaction added'); route(); break; }
      case 'bulk': { const items = parseBulk(f); if (!items.length) throw new Error('Add at least one row'); const r = await api('POST', '/api/transactions/bulk', {items}); S.tx.push(...r.items); sortTx(); toast(`${r.items.length} transactions added`); route(); break; }
      case 'bulkh': {
        const items = d.paste.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
          const [name, type, invested, current, sip] = line.split(/\t|,/).map(s => s.trim());
          return {name, type: TYPES.find(t => t.toLowerCase() === (type || '').toLowerCase()) || type, invested: invested || '', current: current || undefined, sip: sip || 0};
        });
        const r = await api('POST', '/api/holdings/bulk', {items}); S.holdings.push(...r.items); toast(`${r.items.length} investments added`); go('#/growth'); break;
      }
      case 'holding': { const r = await api('POST', '/api/holdings', d); S.holdings.push(r); toast('Investment added'); go('#/growth'); break; }
      case 'goal': { const r = await api('POST', '/api/goals', d); S.goals.push(r); S.goals.sort((a, b) => a.date.localeCompare(b.date)); toast('Goal added'); route(); break; }
      case 'payslip': { const r = await api('POST', '/api/payslips', d); S.payslips.push(r); sortSlips(); toast('Pay slip added'); route(); break; }
      case 'edit': { const spec = EDIT[editing.kind], r = await api('PUT', spec.url + editing.id, d), arr = spec.list(), i = arr.findIndex(x => same(x.id, editing.id)); if (i >= 0) arr[i] = r; if (spec.sort) spec.sort(); closeEdit(); toast('Changes saved'); route(); break; }
      case 'contribute': { const g = S.goals.find(x => same(x.id, editing.id)), r = await api('PUT', '/api/goals/' + g.id, {name: g.name, target: g.target, saved: g.saved + num(d.amount), date: g.date}); S.goals[S.goals.indexOf(g)] = r; closeEdit(); flashGoal = r.id; toast(`Added ${fmt(num(d.amount))} to ${r.name}. Now ${fmt(r.saved)} of ${fmt(r.target)}`); route(); flashGoal = null; break; }
      case 'tourfinish': { const r = await api('PUT', '/api/profile', {...S.profile, pay_frequency: d.pay_frequency, base_salary: d.base_salary, tax_rate: d.tax_rate || 0, cash: d.cash || 0}); S.profile = r.profile; S.calc = r.calc; S.cash = r.cash; await endTour(); toast('You are all set'); go('#/dashboard'); break; }
      case 'famcreate': S.family = (await api('POST', '/api/family/create', d)).family; toast('Family created'); route(); break;
      case 'famjoin': S.family = (await api('POST', '/api/family/join', d)).family; toast('Joined family'); route(); break;
    }
  } catch (err) {
    const el = $(f.dataset.form === 'register' ? '#autherr2' : '#autherr');
    if (el && !S) el.textContent = err.message; else fail(err);
    if (btn) btn.disabled = false;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal') && !openCS) closeEdit(); });
document.addEventListener('click', async e => {
  if (e.target.id === 'modal') { closeEdit(); return; }
  const t = e.target.closest('[data-tab]');
  if (t) { document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === t)); $('form[data-form=login]').hidden = t.dataset.tab !== 'login'; $('form[data-form=register]').hidden = t.dataset.tab !== 'register'; return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id;
  try {
    switch (b.dataset.act) {
      case 'eye': { const i = b.parentElement.querySelector('input'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = ic(show ? 'eye-off' : 'eye'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); return; }
      case 'auththeme': { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light'; r.dataset.set = '1'; return; }
      case 'addrow': { const last = $('#brows .brow:last-child'); $('#brows').insertAdjacentHTML('beforeend', bulkRow(last ? last.querySelector('[name=k]').value : 'expense', last ? last.querySelector('[name=t]').value : undefined)); return; }
      case 'delrow': b.closest('.brow').remove(); return;
      case 'demo': adopt(await api('POST', '/api/demo')); return;
      case 'edit': openEdit(b.dataset.kind, id); return;
      case 'addmoney': openContribute(id); return;
      case 'closemodal': closeEdit(); return;
      case 'tournext': if (tour && tour.i < TOUR.length - 1) { tour.i++; renderTour(); } return;
      case 'tourback': if (tour && tour.i > 0) { tour.i--; renderTour(); } return;
      case 'tourskip': await endTour(); toast('You can retake the tour from the sidebar'); route(); return;
      case 'deltx': if (!confirm('Delete this transaction? This cannot be undone.')) return; await api('DELETE', '/api/transactions/' + id); S.tx = S.tx.filter(x => !same(x.id, id)); break;
      case 'delh': if (!confirm('Delete this investment? This cannot be undone.')) return; await api('DELETE', '/api/holdings/' + id); S.holdings = S.holdings.filter(x => !same(x.id, id)); break;
      case 'delg': if (!confirm('Delete this goal? This cannot be undone.')) return; await api('DELETE', '/api/goals/' + id); S.goals = S.goals.filter(x => !same(x.id, id)); break;
      case 'delslip': if (!confirm('Delete this pay slip? This cannot be undone.')) return; await api('DELETE', '/api/payslips/' + id); S.payslips = S.payslips.filter(x => !same(x.id, id)); break;
      case 'slipgen': { const f = $('#slipform'); const r = await api('POST', '/api/payslips', {fromProfile: true, title: f.title.value, pay_date: f.pay_date.value, category: f.category.value}); S.payslips.push(r); sortSlips(); toast('Pay slip generated'); break; }
      case 'leavefam': if (!confirm('Leave this family workspace?')) return; S.family = (await api('POST', '/api/family/leave')).family; break;
      case 'copycode': try { await navigator.clipboard.writeText(S.family.invite_code); toast('Code copied'); } catch { toast('Select the code and copy it manually', true); } return;
    }
    route();
  } catch (err) { fail(err); }
});
let ct;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.alloc) {
    S.alloc[t.dataset.alloc] = num(t.value);
    $('#an').textContent = S.alloc.needs + '%'; $('#aw').textContent = S.alloc.wants + '%'; $('#ai').textContent = (100 - S.alloc.needs - S.alloc.wants) + '%';
  }
  if (t.dataset.g) { S.growth[t.dataset.g] = num(t.value); saveSettings(); growthOut(); }
  if (t.form && t.form.id === 'pform') {   // live salary calculation on the server
    clearTimeout(ct);
    ct = setTimeout(async () => {
      try { const out = await api('POST', '/api/calc', Object.fromEntries(new FormData(t.form))); const el = $('#calcout'); if (el) el.innerHTML = calcOut(out); } catch (err) { fail(err); }
    }, 250);
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.alloc) { saveSettings(); route(); }
  if (t.dataset.edit) { try { await api('PATCH', '/api/holdings/' + t.dataset.edit, {current: num(t.value)}); const h = S.holdings.find(h => same(h.id, t.dataset.edit)); if (h) h.current = num(t.value); toast('Value updated'); route(); } catch (err) { fail(err); } }
  if (t.id === 'fcat') { spendFilter = t.value; route(); }
});
$('#cur').onchange = e => { S.currency = e.target.value; saveSettings(); route(); };
const themeIcon = () => { $('#themeic').innerHTML = ic(S && S.theme === 'light' ? 'moon' : 'sun'); };
$('#theme').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = S.theme; themeIcon(); saveSettings(); };
$('#reset').onclick = async () => { if (confirm('Reset the demo account back to its sample data?')) { try { adopt(await api('POST', '/api/demo/reset')); toast('Demo data restored'); } catch (err) { fail(err); } } };
$('#tourbtn').onclick = startTour;
$('#logout').onclick = async () => { try { await api('POST', '/api/logout'); } catch {} S = null; location.hash = ''; route(); };
// sidebar hide / show: collapses to an icon rail on desktop, slides in on mobile
const appEl = $('#app');
try { if (localStorage.getItem('ff.collapsed') === '1') appEl.classList.add('collapsed'); } catch {}
const toggleSide = () => {
  if (innerWidth <= 760) { $('.side').classList.toggle('open'); return; }
  const c = appEl.classList.toggle('collapsed');
  try { localStorage.setItem('ff.collapsed', c ? '1' : '0'); } catch {}
};
$('#menu').onclick = toggleSide; $('#collapse').onclick = toggleSide;
hydrateIcons();

{ const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear(); }

// ---------- custom dropdowns (enhance every <select>; native select stays in sync underneath) ----------
let openCS = null;
function closeCS() {
  if (!openCS) return;
  const l = openCS._list; l.classList.remove('show'); openCS.appendChild(l);   // park the list back in its wrapper
  openCS.classList.remove('open'); openCS.querySelector('.cs-btn').setAttribute('aria-expanded', 'false'); openCS = null;
}
function enhanceSelect(sel) {
  if (sel.dataset.cs) return; sel.dataset.cs = '1';
  const wrap = document.createElement('div'); wrap.className = 'cs';
  if (sel.style.width === 'auto') { wrap.style.display = 'inline-block'; wrap.style.minWidth = '130px'; }
  sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
  sel.classList.add('cs-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cs-btn';
  btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
  const list = document.createElement('div'); list.className = 'cs-list'; list.setAttribute('role', 'listbox');
  wrap.append(btn, list);
  let active = -1;
  const render = () => {
    btn.innerHTML = `<span class="cs-val">${esc(sel.selectedOptions[0]?.text || '')}</span>${ic('chevron-down')}`;
    list.innerHTML = [...sel.options].map((o, i) => `<div class="cs-opt${i === sel.selectedIndex ? ' sel' : ''}${i === active ? ' act' : ''}" role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}"><span>${esc(o.text)}</span>${i === sel.selectedIndex ? ic('check') : ''}</div>`).join('');
  };
  const place = () => {
    const r = btn.getBoundingClientRect(), h = Math.min(260, list.scrollHeight + 14), up = r.bottom + h + 8 > innerHeight && r.top > h;
    list.style.left = r.left + 'px'; list.style.width = Math.max(r.width, 150) + 'px'; list.style.top = (up ? r.top - h - 4 : r.bottom + 4) + 'px';
  };
  const reveal = () => {   // scroll only the list (scrollIntoView would also scroll the page and close it)
    const el = list.querySelector('.act, .sel'); if (!el) return;
    const t = el.offsetTop, b = t + el.offsetHeight;
    if (t < list.scrollTop) list.scrollTop = t - 6; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight + 6;
  };
  const open = () => {   // list is portaled to <body> so animated/transformed ancestors can't offset or clip it
    closeCS(); active = sel.selectedIndex; render(); wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); openCS = wrap;
    document.body.appendChild(list); list.classList.add('show'); place(); reveal();
  };
  const choose = i => {
    if (i < 0 || i >= sel.options.length) return;
    const changed = sel.selectedIndex !== i; sel.selectedIndex = i; closeCS(); render();
    if (changed) { sel.dispatchEvent(new Event('input', {bubbles: true})); sel.dispatchEvent(new Event('change', {bubbles: true})); }
    btn.focus();
  };
  btn.onclick = () => wrap.classList.contains('open') ? closeCS() : open();
  list.onmousedown = e => e.preventDefault();
  list.onclick = e => { const o = e.target.closest('.cs-opt'); if (o) choose(+o.dataset.i); };
  btn.onkeydown = e => {
    const isOpen = wrap.classList.contains('open'), n = sel.options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) return open(); active = Math.max(0, Math.min(n - 1, active + (e.key === 'ArrowDown' ? 1 : -1))); render(); reveal(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? choose(active) : open(); }
    else if (e.key === 'Escape' && isOpen) { e.preventDefault(); closeCS(); }
    else if (e.key === 'Tab') closeCS();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase(), opts = [...sel.options], from = isOpen ? active : sel.selectedIndex;
      let j = opts.findIndex((o, i) => i > from && o.text.toLowerCase().startsWith(k)); if (j < 0) j = opts.findIndex(o => o.text.toLowerCase().startsWith(k));
      if (j >= 0) { if (isOpen) { active = j; render(); reveal(); } else choose(j); }
    }
  };
  wrap._list = list; sel._cs = {sync: render}; render();
}
const enhanceAll = () => document.querySelectorAll('select:not([data-cs])').forEach(enhanceSelect);
document.addEventListener('mousedown', e => { if (openCS && !openCS.contains(e.target) && !(e.target.closest && e.target.closest('.cs-list'))) closeCS(); });
let lastW = innerWidth;
addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; closeCS(); } });
addEventListener('scroll', e => { if (openCS && !(e.target.closest && e.target.closest('.cs-list'))) closeCS(); }, true);
new MutationObserver(enhanceAll).observe(document.body, {childList: true, subtree: true});
enhanceAll();

// ---------- cursor effects: trailing ring, click ripple, card spotlight (off on touch / reduced motion) ----------
(() => {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ring = document.createElement('div'); ring.className = 'cur-ring'; document.body.appendChild(ring);
  const HOT = 'a, button, select, [data-act], .cs-btn, .cs-opt, label.lbl, .card.kpi, nav a';
  let mx = 0, my = 0, rx = 0, ry = 0, shown = false;
  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; rx = mx; ry = my; ring.style.opacity = 1; }
    const el = e.target.closest ? e.target : null;
    ring.classList.toggle('hot', !!(el && el.closest(HOT)));
    ring.classList.toggle('text', !!(el && el.closest('input:not([type=range]), textarea')));
    const card = el && el.closest('.card');
    if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
  }, {passive: true});
  document.documentElement.addEventListener('mouseleave', () => { ring.style.opacity = 0; shown = false; });
  addEventListener('mousedown', () => ring.classList.add('down'));
  addEventListener('mouseup', () => ring.classList.remove('down'));
  addEventListener('click', e => {
    const d = document.createElement('div'); d.className = 'cur-ripple'; d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 600);
  });
  (function loop() {
    rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
})();
api('GET', '/api/state').then(s => { S = s; sortTx(); sortSlips(); route(); }).catch(() => { S = null; route(); });
})();
