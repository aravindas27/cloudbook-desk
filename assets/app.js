/* Cloudbook Desk — practice management for a small accounting & compliance firm.
   Plain JavaScript, no build step. All data is kept in the browser (localStorage)
   and can be exported/imported as a JSON backup from Settings & data. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const KEY = 'cloudbook-desk.v1';
  const THEME_KEY = 'cloudbook-desk.theme';
  const JOB_STATUS = ['Not started', 'In progress', 'Waiting on client', 'Review', 'Filed / Done'];
  const DONE = 'Filed / Done';
  const BILLING = ['Not billed', 'Billed', 'No charge'];
  const RECUR = [['none', 'One-time'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['annual', 'Yearly']];
  const CLIENT_TYPES = ['Company', 'LLP', 'Partnership firm', 'Proprietorship', 'Individual', 'Society / Trust', 'Other'];
  const PAY_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash'];
  const CATEGORIES = ['GST', 'TDS', 'Income tax', 'Accounts', 'ROC / MCA', 'Payroll', 'Advisory', 'Other'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const DEFAULT_SERVICES = [
    ['GST return filing (GSTR-1 & 3B)', 'GST', 'monthly', 1000, 2.5],
    ['GST annual return (GSTR-9)', 'GST', 'annual', 6000, 8],
    ['GST registration', 'GST', 'none', 3000, 4],
    ['TDS return', 'TDS', 'quarterly', 4000, 4],
    ['Income tax return – individual', 'Income tax', 'annual', 1500, 2],
    ['Income tax return – firm / LLP', 'Income tax', 'annual', 2500, 4],
    ['Income tax return – company', 'Income tax', 'annual', 5000, 8],
    ['Financial statements – company', 'Accounts', 'annual', 25000, 30],
    ['Financial statements – LLP / firm', 'Accounts', 'annual', 8000, 12],
    ['Bookkeeping', 'Accounts', 'monthly', 3000, 6],
    ['Project report / CMA data', 'Accounts', 'none', 6000, 10],
    ['LLP Form 8 (statement of accounts)', 'ROC / MCA', 'annual', 1800, 3],
    ['LLP Form 11 (annual return)', 'ROC / MCA', 'annual', 1800, 3],
    ['ROC annual filing (AOC-4 & MGT-7)', 'ROC / MCA', 'annual', 8000, 8],
    ['Company / LLP incorporation', 'ROC / MCA', 'none', 15000, 15],
    ['DIN allotment / DIR-3 KYC', 'ROC / MCA', 'none', 1500, 2],
    ['Payroll processing', 'Payroll', 'monthly', 2000, 4],
    ['Consultation / advisory', 'Advisory', 'none', 2000, 2],
  ];

  // ---------- Small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? num(f(x)) : num(x)), 0);
  const round2 = (v) => Math.round(v * 100) / 100;
  const inr = (v) => (v == null || !isFinite(v)) ? '—' : (v < 0 ? '−' : '') + '₹' + Math.round(Math.abs(v)).toLocaleString('en-IN');
  const inrC = (v) => {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L';
    return inr(v);
  };
  const pct = (v) => (v == null || !isFinite(v)) ? '—' : Math.round(v * 100) + '%';
  const hrs = (v) => (Math.round(num(v) * 10) / 10).toLocaleString('en-IN');
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const parseD = (s) => (s ? new Date(s + 'T00:00:00') : null);
  const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const fmtD = (s) => (s ? parseD(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const fmtDs = (s) => (s ? parseD(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
  const daysFrom = (s) => (s ? Math.round((parseD(s) - parseD(todayISO())) / 864e5) : null);
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => {
    const d = parseD(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  };
  const monthKey = (s) => (s ? s.slice(0, 7) : '');
  const monthLabel = (k) => { const [y, m] = k.split('-'); return MONTHS[+m - 1] + ' ' + y.slice(2); };
  const startOfWeek = (s) => { const d = parseD(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };

  // ---------- Store ----------
  let S;
  const blank = () => ({
    version: 1,
    settings: { firmName: 'Cloudbook Associates LLP', gstin: '', pan: '', address: '', phone: '', email: '', gstRate: 18, fyStartMonth: 4, invoiceDueDays: 15, defaultCostRate: 350, capacityHours: 160, invoicePrefix: 'INV-', jobPrefix: 'J-' },
    team: [{ id: 'm_owner', name: 'Aravind A S', role: 'Designated Partner', costRate: 500, billRate: 1200, capacity: 160, active: true }],
    services: DEFAULT_SERVICES.map(([name, category, recurring, fee, hours]) => ({ id: uid('s'), name, category, recurring, fee, hours })),
    clients: [], jobs: [], time: [], invoices: [],
    seq: { job: 0, invoice: 0 },
    started: false,
  });
  let storageOk = true;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { S = migrate(JSON.parse(raw)); return; }
    } catch (e) { storageOk = false; }
    S = blank();
  }
  function migrate(d) {
    const b = blank();
    d.settings = Object.assign({}, b.settings, d.settings || {});
    ['team', 'services', 'clients', 'jobs', 'time', 'invoices'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    d.seq = Object.assign({ job: 0, invoice: 0 }, d.seq || {});
    d.invoices.forEach((i) => { if (!Array.isArray(i.payments)) i.payments = []; if (!Array.isArray(i.jobIds)) i.jobIds = []; });
    return d;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
      const f = $('#nav-foot'); if (f) f.textContent = storageOk ? 'Saved in this browser · ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not saved: browser storage is blocked';
    }, 150);
  }
  function commit() { save(); render(); }

  // ---------- Lookups & calculations ----------
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const client = (id) => byId(S.clients, id) || { name: '(deleted client)' };
  const member = (id) => byId(S.team, id);
  const job = (id) => byId(S.jobs, id);
  const isDone = (j) => j.status === DONE;
  const isOverdue = (j) => !isDone(j) && j.due && j.due < todayISO();
  const readyToBill = (j) => isDone(j) && j.billing === 'Not billed' && num(j.fee) > 0;
  const rateOf = (e) => (e.costRate != null ? num(e.costRate) : num(member(e.memberId)?.costRate ?? S.settings.defaultCostRate));

  function jobStats(j) {
    const es = S.time.filter((t) => t.jobId === j.id);
    const hours = sum(es, (e) => e.hours);
    const costActual = sum(es, (e) => num(e.hours) * rateOf(e));
    const billValue = sum(es, (e) => num(e.hours) * num(member(e.memberId)?.billRate));
    const estimated = hours === 0;
    const useHours = estimated ? num(j.budgetHours) : hours;
    const cost = estimated ? useHours * num(S.settings.defaultCostRate) : costActual;
    const fee = num(j.fee);
    return {
      hours, useHours, cost, estimated, billValue, fee,
      margin: fee - cost,
      marginPct: fee ? (fee - cost) / fee : null,
      perHour: useHours ? fee / useHours : null,
      budgetUse: num(j.budgetHours) ? hours / num(j.budgetHours) : null,
      over: num(j.budgetHours) > 0 && hours > num(j.budgetHours),
      realisation: billValue ? fee / billValue : null,
    };
  }
  function invStats(inv) {
    const received = sum(inv.payments, (p) => num(p.amount) + num(p.tds));
    const cash = sum(inv.payments, (p) => p.amount);
    const tds = sum(inv.payments, (p) => p.tds);
    const balance = round2(num(inv.total) - received);
    const daysOver = inv.dueDate ? -daysFrom(inv.dueDate) : 0;
    const age = inv.date ? -daysFrom(inv.date) : 0;
    const status = balance <= 0.5 ? 'Paid' : received > 0 ? (daysOver > 0 ? 'Overdue' : 'Part paid') : daysOver > 0 ? 'Overdue' : 'Unpaid';
    return { received, cash, tds, balance: Math.max(0, balance), daysOver, age, status };
  }
  function fyOf(s) {
    const d = parseD(s || todayISO()), m = S.settings.fyStartMonth || 4;
    const y = d.getMonth() + 1 >= m ? d.getFullYear() : d.getFullYear() - 1;
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = addDays(addMonths(start, 12), -1);
    return { start, end, label: m === 1 ? String(y) : `${y}-${String((y + 1) % 100).padStart(2, '0')}` };
  }
  const inRange = (s, r) => s && s >= r.start && s <= r.end;
  function periodRange(key) {
    const fy = fyOf();
    if (key === 'fy') return fy;
    if (key === 'lastfy') return fyOf(addDays(fy.start, -1));
    return { start: '1900-01-01', end: '2999-12-31', label: 'All time' };
  }
  const memberOptions = (incl) => S.team.filter((m) => m.active !== false || m.id === incl).map((m) => [m.id, m.name]);
  const clientOptions = () => S.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name]);
  const nextJobCode = () => { S.seq.job = (S.seq.job || 0) + 1; return (S.settings.jobPrefix || 'J-') + String(S.seq.job).padStart(4, '0'); };
  const nextInvoiceNo = () => {
    const pre = S.settings.invoicePrefix || 'INV-';
    const nums = S.invoices.map((i) => parseInt(String(i.number).replace(/\D/g, ''), 10)).filter((n) => isFinite(n));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return pre + String(n).padStart(6, '0');
  };

  // ---------- Chips ----------
  function statusChip(s) {
    const c = s === DONE ? 'ok' : s === 'In progress' ? 'info' : s === 'Waiting on client' ? 'warn' : s === 'Review' ? 'acc' : '';
    return `<span class="chip ${c}">${esc(s)}</span>`;
  }
  function dueChip(j) {
    if (!j.due) return '<span class="t-muted">—</span>';
    if (isDone(j)) return `<span class="t-muted">${fmtDs(j.due)}</span>`;
    const d = daysFrom(j.due);
    if (d < 0) return `<span class="chip bad plain">${fmtDs(j.due)} · ${-d}d late</span>`;
    if (d <= 3) return `<span class="chip warn plain">${fmtDs(j.due)} · ${d === 0 ? 'today' : d + 'd'}</span>`;
    return `<span>${fmtDs(j.due)}</span>`;
  }
  function billChip(j) {
    if (j.billing === 'Billed') return '<span class="chip acc">Billed</span>';
    if (j.billing === 'No charge') return '<span class="chip">No charge</span>';
    return readyToBill(j) ? '<span class="chip warn">Ready to bill</span>' : '<span class="chip">Not billed</span>';
  }
  function invChip(st) {
    const c = st.status === 'Paid' ? 'ok' : st.status === 'Overdue' ? 'bad' : st.status === 'Part paid' ? 'info' : 'warn';
    const extra = st.status === 'Overdue' ? ` · ${st.daysOver}d` : '';
    return `<span class="chip ${c}">${st.status}${extra}</span>`;
  }
  const marginCell = (st) => `<span class="${st.marginPct == null ? 't-muted' : st.marginPct < 0 ? 't-bad' : st.marginPct < 0.3 ? 't-warn' : ''}">${pct(st.marginPct)}</span>${st.estimated && st.fee ? '<small>estimated</small>' : ''}`;

  // ---------- UI state ----------
  const UI = {
    jobs: { q: '', status: 'open', client: '', owner: '', billing: '', sort: 'due', dir: 1 },
    inv: { q: '', status: 'unpaid', client: '', sort: 'date', dir: -1 },
    clients: { q: '', type: '', sort: 'name', dir: 1 },
    ts: { week: startOfWeek(todayISO()) },
    att: 'overdue',
    reports: { tab: 'clients', period: 'fy', month: monthKey(todayISO()) },
  };

  // ---------- Rendering ----------
  const view = () => $('#view');
  function setHead(title, sub, actions) {
    $('#page-title').textContent = title;
    $('#page-sub').textContent = sub || '';
    $('#page-actions').innerHTML = actions || '';
    document.title = title + ' · Cloudbook Desk';
  }
  function render() {
    const ae = document.activeElement;
    const focusId = ae && ae.id && view().contains(ae) ? ae.id : null;
    const caret = focusId && 'selectionStart' in ae ? ae.selectionStart : null;
    const [r, id] = (location.hash.slice(1) || 'dashboard').split('/');
    const page = PAGES[r] || PAGES.dashboard;
    $$('.nav a[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r || (r === 'job' && a.dataset.route === 'jobs') || (r === 'client' && a.dataset.route === 'clients') || (r === 'invoice' && a.dataset.route === 'invoices')));
    $('#brand-name').innerHTML = `${esc(shortFirm())}<small>Practice desk</small>`;
    const od = S.jobs.filter(isOverdue).length;
    const b = $('#nav-overdue'); b.hidden = !od; b.textContent = od;
    let html = '';
    try { html = page(id); } catch (e) { console.error(e); html = `<div class="card card-b"><b>Something went wrong showing this page.</b><p class="t-muted">${esc(e.message)}</p></div>`; }
    view().innerHTML = banner() + html;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) { /* not a text field */ } } }
  }
  const shortFirm = () => (S.settings.firmName || 'Cloudbook Desk').replace(/\s+(LLP|Pvt\.? Ltd\.?|Private Limited)$/i, '');
  function banner() {
    if (!storageOk) return '<div class="banner">This browser is blocking storage, so changes will be lost when you close the page. Export a backup from Settings &amp; data.</div>';
    const last = S.settings.lastBackup;
    const stale = S.started && (!last || daysFrom(last) < -7) && S.jobs.length > 0;
    return stale ? `<div class="banner">Your data lives only in this browser. ${last ? 'Last backup ' + fmtD(last) + '.' : 'No backup taken yet.'} <button class="btn sm" data-act="backup">Back up now</button></div>` : '';
  }
  const empty = (title, text, action) => `<div class="empty"><b>${esc(title)}</b>${esc(text)}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
  const th = (key, label, tbl, cls = '') => {
    const st = UI[tbl];
    const sort = st.sort === key ? (st.dir === 1 ? 'ascending' : 'descending') : 'none';
    return `<th class="sortable ${cls}" data-act="sort" data-tbl="${tbl}" data-key="${key}" aria-sort="${sort}" tabindex="0">${label}</th>`;
  };
  function sortRows(rows, tbl, getters) {
    const { sort, dir } = UI[tbl];
    const g = getters[sort] || ((r) => r[sort]);
    return rows.slice().sort((a, b) => {
      const va = g(a), vb = g(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
    });
  }

  // ---------- Charts (SVG) ----------
  function barChart(data, series, opts = {}) {
    const W = 560, H = opts.h || 200, L = 52, B = 24, T = 10, R = 8;
    const max = Math.max(1, ...data.map((d) => Math.max(...series.map((s) => num(d[s.key])))));
    const nice = niceMax(max);
    const bw = (W - L - R) / data.length;
    const inner = Math.min(22, (bw - 10) / series.length);
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = nice * i / 4, yy = y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${esc(inrC(v).replace('₹', ''))}</text>`;
    }
    data.forEach((d, i) => {
      const x0 = L + i * bw + (bw - inner * series.length) / 2;
      series.forEach((s, k) => {
        const v = num(d[s.key]), yy = y(v);
        g += `<rect x="${x0 + k * inner}" y="${yy}" width="${inner - 2}" height="${Math.max(0, H - B - yy)}" rx="2" fill="${s.color}"><title>${esc(d.label)} · ${esc(s.label)}: ${esc(inr(v))}</title></rect>`;
      });
      g += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">${g}</svg>`;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function hbars(rows, opts = {}) {
    const max = Math.max(1, ...rows.map((r) => num(r.value)));
    return `<div style="display:flex;flex-direction:column;gap:10px">${rows.map((r) => `
      <div><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${esc(r.label)}</span><span class="num">${esc(opts.fmt ? opts.fmt(r.value) : inr(r.value))}${r.note ? ` <span class="t-muted">· ${esc(r.note)}</span>` : ''}</span></div>
      <div class="meter" style="margin-top:4px"><i style="width:${(num(r.value) / max) * 100}%;background:${r.color || 'var(--chart-1)'}"></i></div></div>`).join('')}</div>`;
  }

  // ---------- Pages ----------
  const PAGES = {};

  PAGES.dashboard = () => {
    const fy = fyOf();
    setHead('Dashboard', `${S.settings.firmName} · FY ${fy.label}`, `<button class="btn" data-act="logTime">Log time</button> <button class="btn primary" data-act="newJob">New job</button>`);
    if (!S.started && !S.jobs.length && !S.clients.length) return welcome();
    const t = todayISO(), mk = monthKey(t);
    const ready = S.jobs.filter(readyToBill);
    const readyAmt = sum(ready, (j) => j.fee);
    const invs = S.invoices.map((i) => ({ i, st: invStats(i) }));
    const open = invs.filter((x) => x.st.balance > 0);
    const ar = sum(open, (x) => x.st.balance);
    const arOver = sum(open.filter((x) => x.st.daysOver > 0), (x) => x.st.balance);
    const payments = S.invoices.flatMap((i) => i.payments.map((p) => ({ ...p, inv: i })));
    const collMonth = sum(payments.filter((p) => monthKey(p.date) === mk), (p) => num(p.amount) + num(p.tds));
    const billedMonth = sum(S.invoices.filter((i) => monthKey(i.date) === mk), (i) => i.fee);
    const fyInv = S.invoices.filter((i) => inRange(i.date, fy));
    const billedFY = sum(fyInv, (i) => i.fee);
    const fyTotal = sum(fyInv, (i) => i.total);
    const fyRecv = sum(fyInv, (i) => invStats(i).received);
    const doneFY = S.jobs.filter((j) => isDone(j) && inRange(j.doneOn || j.due, fy) && num(j.fee) > 0);
    const dStats = doneFY.map(jobStats);
    const feeD = sum(dStats, (s) => s.fee), costD = sum(dStats, (s) => s.cost), hD = sum(dStats, (s) => s.useHours);
    const overdue = S.jobs.filter(isOverdue);
    const week = S.jobs.filter((j) => !isDone(j) && j.due && daysFrom(j.due) >= 0 && daysFrom(j.due) <= 7);
    const overBudget = S.jobs.filter((j) => !isDone(j) && jobStats(j).over);
    const late = open.filter((x) => x.st.daysOver > 30).sort((a, b) => b.st.daysOver - a.st.daysOver);

    const kpis = `<section class="kpis">
      <a class="kpi alert" href="#jobs" data-act="jobsReady"><span class="l">Finished, not invoiced</span><span class="v">${inrC(readyAmt)}</span><span class="s">${ready.length} job${ready.length === 1 ? '' : 's'} ready to bill</span></a>
      <a class="kpi ${arOver > 0 ? 'bad' : ''}" href="#invoices"><span class="l">Receivables</span><span class="v">${inrC(ar)}</span><span class="s">${inr(arOver)} past due</span></a>
      <a class="kpi good" href="#invoices"><span class="l">Collected this month</span><span class="v">${inrC(collMonth)}</span><span class="s">${inr(billedMonth)} billed this month</span></a>
      <a class="kpi" href="#reports"><span class="l">Fees billed, FY ${fy.label}</span><span class="v">${inrC(billedFY)}</span><span class="s">${pct(fyTotal ? fyRecv / fyTotal : null)} of FY billing collected</span></a>
      <a class="kpi" href="#reports"><span class="l">Margin on finished work</span><span class="v">${pct(feeD ? (feeD - costD) / feeD : null)}</span><span class="s">${inr(hD ? feeD / hD : null)} earned per hour</span></a>
      <a class="kpi ${overdue.length ? 'bad' : ''}" href="#deadlines"><span class="l">Overdue jobs</span><span class="v">${overdue.length}</span><span class="s">${week.length} due in the next 7 days</span></a>
    </section>`;

    const tabs = [
      ['overdue', 'Overdue', overdue.length],
      ['ready', 'Ready to bill', ready.length],
      ['late', 'Unpaid 30+ days', late.length],
      ['budget', 'Over budget', overBudget.length],
    ];
    let list = '';
    if (UI.att === 'overdue') list = overdue.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8).map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)} · ${esc(member(j.ownerId)?.name || 'Unassigned')}</small></div>${dueChip(j)}</li>`).join('');
    if (UI.att === 'ready') list = ready.sort((a, b) => num(b.fee) - num(a.fee)).slice(0, 8).map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)}${j.doneOn ? ' · done ' + fmtDs(j.doneOn) : ''}</small></div><span class="amt">${inr(j.fee)}</span><button class="btn sm" data-act="newInvoice" data-client="${j.clientId}">Invoice</button></li>`).join('');
    if (UI.att === 'late') list = late.slice(0, 8).map((x) => `<li><div class="what"><a href="#invoice/${x.i.id}"><b>${esc(x.i.number)}</b></a><small>${esc(client(x.i.clientId).name)} · due ${fmtDs(x.i.dueDate)}</small></div><span class="amt">${inr(x.st.balance)}</span><span class="chip bad plain">${x.st.daysOver}d</span></li>`).join('');
    if (UI.att === 'budget') list = overBudget.slice(0, 8).map((j) => { const s = jobStats(j); return `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)}</small></div><span class="amt t-bad">${hrs(s.hours)} / ${hrs(j.budgetHours)} h</span></li>`; }).join('');
    const att = `<div class="card"><div class="card-h"><h2>Needs your attention</h2></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="${UI.att === k ? 'on' : ''}" data-act="att" data-k="${k}" role="tab" aria-selected="${UI.att === k}">${l}<span class="n">${n}</span></button>`).join('')}</div>
      ${list ? `<ul class="att">${list}</ul>` : empty('Nothing here', 'You are on top of this one.')}</div>`;

    const months = [];
    for (let k = 5; k >= 0; k--) months.push(monthKey(addMonths(t.slice(0, 8) + '01', -k)));
    const mdata = months.map((m) => ({ label: monthLabel(m), billed: sum(S.invoices.filter((i) => monthKey(i.date) === m), (i) => i.total), collected: sum(payments.filter((p) => monthKey(p.date) === m), (p) => num(p.amount) + num(p.tds)) }));
    const chart = `<div class="card"><div class="card-h"><h2>Billed and collected</h2><span class="hint">Last 6 months, incl. GST</span></div>
      <div class="card-b">${barChart(mdata, [{ key: 'billed', label: 'Billed', color: 'var(--chart-2)' }, { key: 'collected', label: 'Collected', color: 'var(--chart-1)' }], { label: 'Billed and collected by month' })}</div>
      <div class="legend" style="padding-bottom:14px"><span><i style="background:var(--chart-2)"></i>Billed</span><span><i style="background:var(--chart-1)"></i>Collected</span></div></div>`;

    const buckets = [['Not yet due', (d) => d <= 0], ['1–30 days', (d) => d > 0 && d <= 30], ['31–60 days', (d) => d > 30 && d <= 60], ['61–90 days', (d) => d > 60 && d <= 90], ['Over 90 days', (d) => d > 90]];
    const aging = buckets.map(([label, f], i) => ({ label, value: sum(open.filter((x) => f(x.st.daysOver)), (x) => x.st.balance), color: i >= 3 ? 'var(--bad)' : i === 2 ? 'var(--warn)' : 'var(--chart-1)' }));
    const agingCard = `<div class="card"><div class="card-h"><h2>Receivables ageing</h2><span class="hint">Days past due date</span></div><div class="card-b">${ar ? hbars(aging) : empty('No money owed', 'All invoices are paid.')}</div></div>`;

    const cap = (m) => num(m.capacity || S.settings.capacityHours);
    const team = S.team.filter((m) => m.active !== false).map((m) => {
      const h = sum(S.time.filter((e) => e.memberId === m.id && monthKey(e.date) === mk), (e) => e.hours);
      const openJobs = S.jobs.filter((j) => j.ownerId === m.id && !isDone(j)).length;
      return { m, h, openJobs, u: cap(m) ? h / cap(m) : 0 };
    });
    const teamCard = `<div class="card"><div class="card-h"><h2>Team this month</h2><span class="hint">Hours logged against capacity</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">${team.length ? team.map((x) => `
      <div><div style="display:flex;justify-content:space-between;font-size:12.5px"><span><b style="font-weight:500">${esc(x.m.name)}</b> <span class="t-muted">· ${x.openJobs} open jobs</span></span><span class="num">${hrs(x.h)} / ${hrs(cap(x.m))} h · ${pct(x.u)}</span></div>
      <div class="meter ${x.u > 1 ? 'over' : ''}" style="margin-top:4px"><i style="width:${Math.min(100, x.u * 100)}%"></i></div></div>`).join('') : empty('No team members', 'Add people under Team & services.')}</div></div>`;

    const soon = S.jobs.filter((j) => !isDone(j) && j.due && daysFrom(j.due) >= 0 && daysFrom(j.due) <= 14).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);
    const soonCard = `<div class="card"><div class="card-h"><h2>Due in the next 14 days</h2><span class="right"><a class="btn sm" href="#deadlines">All deadlines</a></span></div>
      ${soon.length ? `<ul class="att">${soon.map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)}</small></div>${statusChip(j.status)}${dueChip(j)}</li>`).join('')}</ul>` : empty('Clear for two weeks', 'No open jobs fall due in the next 14 days.')}</div>`;

    return `${kpis}<div class="grid g2">${att}${chart}</div><div class="grid g3">${agingCard}${teamCard}${soonCard}</div>`;
  };

  function welcome() {
    return `<div class="card"><div class="card-b" style="padding:28px">
      <h2 style="margin:0 0 6px;font-size:20px">Welcome to your practice desk</h2>
      <p class="t-muted" style="max-width:62ch;margin:0 0 18px">Track every client job from start to cash: who is doing it, when it is due, the hours spent, what it cost, what you billed and what is still unpaid. Start with sample data to look around, or begin with your own clients.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" data-act="start">Start with my own data</button>
        <button class="btn" data-act="demo">Explore with sample data</button>
        <button class="btn" data-act="goImport">Import a backup file</button>
      </div>
      <ol class="t-muted" style="margin:22px 0 0;padding-left:18px;line-height:1.9">
        <li>Check your firm details and team cost rates under <a href="#settings">Settings</a> and <a href="#team">Team &amp; services</a>.</li>
        <li>Add your <a href="#clients">clients</a>.</li>
        <li>Open a <b>job</b> for each piece of work, with its fee, due date and budget hours.</li>
        <li><b>Log time</b> as you work. Job cost and margin update by themselves.</li>
        <li>When a job is done, <b>raise the invoice</b> and record payments as they come in.</li>
      </ol></div></div>`;
  }

  PAGES.jobs = () => {
    const f = UI.jobs;
    setHead('Jobs', 'Every piece of client work, with its costing', `<button class="btn" data-act="rollForward">Roll forward recurring</button> <button class="btn primary" data-act="newJob">New job</button>`);
    let rows = S.jobs.map((j) => ({ j, st: jobStats(j) }));
    const q = f.q.trim().toLowerCase();
    rows = rows.filter(({ j }) => {
      if (f.status === 'open' && isDone(j)) return false;
      if (f.status === 'overdue' && !isOverdue(j)) return false;
      if (f.status === 'ready' && !readyToBill(j)) return false;
      if (JOB_STATUS.includes(f.status) && j.status !== f.status) return false;
      if (f.client && j.clientId !== f.client) return false;
      if (f.owner && j.ownerId !== f.owner) return false;
      if (f.billing && j.billing !== f.billing) return false;
      if (q && !(j.title + ' ' + j.code + ' ' + client(j.clientId).name + ' ' + (j.service || '') + ' ' + (j.period || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    rows = sortRows(rows, 'jobs', {
      title: (r) => r.j.title, client: (r) => client(r.j.clientId).name, owner: (r) => member(r.j.ownerId)?.name, due: (r) => r.j.due || null,
      status: (r) => JOB_STATUS.indexOf(r.j.status), fee: (r) => num(r.j.fee), hours: (r) => r.st.hours, margin: (r) => r.st.marginPct, billing: (r) => r.j.billing,
    });
    const filters = `<div class="filters">
      <input class="input search" id="f-jobs-q" type="search" placeholder="Search job, client, period…" value="${esc(f.q)}" data-filter="jobs.q" aria-label="Search jobs">
      <select class="input" id="f-jobs-status" data-filter="jobs.status" aria-label="Status">
        ${[['open', 'All open'], ['overdue', 'Overdue'], ['ready', 'Ready to bill'], ...JOB_STATUS.map((s) => [s, s]), ['', 'All jobs']].map(([v, l]) => `<option value="${esc(v)}" ${f.status === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
      <select class="input" id="f-jobs-client" data-filter="jobs.client" aria-label="Client"><option value="">All clients</option>${clientOptions().map(([v, l]) => `<option value="${v}" ${f.client === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select class="input" id="f-jobs-owner" data-filter="jobs.owner" aria-label="Owner"><option value="">Everyone</option>${memberOptions().map(([v, l]) => `<option value="${v}" ${f.owner === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select class="input" id="f-jobs-billing" data-filter="jobs.billing" aria-label="Billing"><option value="">Any billing</option>${BILLING.map((b) => `<option ${f.billing === b ? 'selected' : ''}>${b}</option>`).join('')}</select>
    </div>`;
    const body = rows.map(({ j, st }) => `<tr class="click" data-href="#job/${j.id}">
      <td><b style="font-weight:500">${esc(j.title)}</b><small>${esc(j.code)}${j.period ? ' · ' + esc(j.period) : ''}</small></td>
      <td>${esc(client(j.clientId).name)}</td>
      <td>${esc(member(j.ownerId)?.name || '—')}</td>
      <td>${dueChip(j)}</td>
      <td>${statusChip(j.status)}</td>
      <td class="n">${inr(num(j.fee))}</td>
      <td class="n ${st.over ? 't-bad' : ''}">${hrs(st.hours)}${num(j.budgetHours) ? ` <span class="t-muted">/ ${hrs(j.budgetHours)}</span>` : ''}</td>
      <td class="n">${marginCell(st)}</td>
      <td>${billChip(j)}</td></tr>`).join('');
    const tot = { fee: sum(rows, (r) => r.j.fee), h: sum(rows, (r) => r.st.hours), cost: sum(rows, (r) => r.st.cost) };
    return `<div class="card"><div class="card-b">${filters}</div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('title', 'Job', 'jobs')}${th('client', 'Client', 'jobs')}${th('owner', 'Owner', 'jobs')}${th('due', 'Due', 'jobs')}${th('status', 'Status', 'jobs')}${th('fee', 'Fee', 'jobs', 'n')}${th('hours', 'Hours', 'jobs', 'n')}${th('margin', 'Margin', 'jobs', 'n')}${th('billing', 'Billing', 'jobs')}</tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="5">${rows.length} jobs</td><td class="n">${inr(tot.fee)}</td><td class="n">${hrs(tot.h)}</td><td class="n">${pct(tot.fee ? (tot.fee - tot.cost) / tot.fee : null)}</td><td></td></tr></tfoot></table></div>`
        : empty(S.jobs.length ? 'No jobs match these filters' : 'No jobs yet', S.jobs.length ? 'Change the filters above to see more.' : 'Open a job for each piece of client work.', S.jobs.length ? '' : '<button class="btn primary" data-act="newJob">New job</button>')}</div>`;
  };

  PAGES.job = (id) => {
    const j = job(id);
    if (!j) { setHead('Job not found'); return empty('This job no longer exists', 'It may have been deleted.', '<a class="btn" href="#jobs">Back to jobs</a>'); }
    const st = jobStats(j), c = client(j.clientId), inv = j.invoiceId ? byId(S.invoices, j.invoiceId) : null;
    setHead(j.title, `${j.code} · ${c.name}`, `<button class="btn" data-act="logTime" data-job="${j.id}">Log time</button> <button class="btn" data-act="editJob" data-id="${j.id}">Edit</button>${readyToBill(j) ? ` <button class="btn primary" data-act="newInvoice" data-client="${j.clientId}" data-job="${j.id}">Raise invoice</button>` : ''}`);
    const entries = S.time.filter((t) => t.jobId === j.id).sort((a, b) => b.date.localeCompare(a.date));
    const used = st.budgetUse;
    return `<a class="back" href="#jobs">← All jobs</a>
      <div class="card"><div class="card-b">
        <div class="detail-head"><div class="ttl"><h2>${esc(j.title)}</h2>
          <div class="meta"><a href="#client/${c.id}">${esc(c.name)}</a>${j.service ? `<span>· ${esc(j.service)}</span>` : ''}${j.period ? `<span>· ${esc(j.period)}</span>` : ''}${j.priority === 'High' ? '<span class="chip bad plain">High priority</span>' : ''}</div></div>
          <label class="field" style="min-width:200px"><span style="font-size:12px;color:var(--muted)">Status</span>
            <select class="input" id="job-status" data-change="jobStatus" data-id="${j.id}">${JOB_STATUS.map((s) => `<option ${s === j.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        </div>
        <div class="facts" style="margin-top:18px">
          <div><span>Owner</span><b>${esc(member(j.ownerId)?.name || 'Unassigned')}</b></div>
          <div><span>Start</span><b>${fmtD(j.start)}</b></div>
          <div><span>Due</span><b>${dueChip(j)}</b></div>
          <div><span>Fee (excl. GST)</span><b>${inr(num(j.fee))}</b></div>
          <div><span>Govt fees to recover</span><b>${inr(num(j.govtFees))}</b></div>
          <div><span>Repeats</span><b>${esc((RECUR.find((r) => r[0] === j.recurring) || RECUR[0])[1])}</b></div>
          <div><span>Billing</span><b>${billChip(j)}${inv ? ` <a href="#invoice/${inv.id}">${esc(inv.number)}</a>` : ''}</b></div>
          ${isDone(j) ? `<div><span>Completed on</span><b>${fmtD(j.doneOn)}</b></div>` : ''}
        </div>
        ${j.notes ? `<p style="margin:16px 0 0;white-space:pre-wrap">${esc(j.notes)}</p>` : ''}
      </div></div>
      <div class="card"><div class="card-h"><h2>Job costing</h2><span class="hint">${st.estimated ? 'No time logged yet, so cost uses the budget hours at the default cost rate.' : 'Cost from hours logged × each person’s cost rate.'}</span></div>
        <div class="card-b">
          <div class="costing">
            <div class="box"><span>Hours ${num(j.budgetHours) ? 'used / budget' : 'logged'}</span><b class="${st.over ? 't-bad' : ''}">${hrs(st.hours)}${num(j.budgetHours) ? ` / ${hrs(j.budgetHours)}` : ''}</b>${used != null ? `<div class="meter ${st.over ? 'over' : ''}" style="margin-top:6px"><i style="width:${Math.min(100, used * 100)}%"></i></div>` : ''}</div>
            <div class="box"><span>Cost of time${st.estimated ? ' (est.)' : ''}</span><b>${inr(st.cost)}</b></div>
            <div class="box"><span>Margin</span><b class="${st.margin < 0 ? 't-bad' : ''}">${inr(st.margin)}</b></div>
            <div class="box"><span>Margin %</span><b class="${st.marginPct != null && st.marginPct < 0.3 ? 't-warn' : ''}">${pct(st.marginPct)}</b></div>
            <div class="box"><span>Earned per hour</span><b>${inr(st.perHour)}</b></div>
            <div class="box"><span>Realisation</span><b>${pct(st.realisation)}</b><span>fee ÷ hours at bill rates</span></div>
          </div>
        </div></div>
      <div class="card"><div class="card-h"><h2>Time logged</h2><span class="hint">${entries.length} entries</span><span class="right"><button class="btn sm" data-act="logTime" data-job="${j.id}">Log time</button></span></div>
        ${entries.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Who</th><th>Work done</th><th class="n">Hours</th><th class="n">Cost</th><th></th></tr></thead><tbody>
        ${entries.map((e) => `<tr><td>${fmtD(e.date)}</td><td>${esc(member(e.memberId)?.name || '—')}</td><td>${esc(e.note || '')}</td><td class="n">${hrs(e.hours)}</td><td class="n">${inr(num(e.hours) * rateOf(e))}</td><td class="n"><button class="btn sm ghost" data-act="editTime" data-id="${e.id}">Edit</button></td></tr>`).join('')}
        </tbody></table></div>` : empty('No time logged', 'Log time as you work to see the real cost of this job.')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${j.recurring && j.recurring !== 'none' ? `<button class="btn" data-act="nextPeriod" data-id="${j.id}">Create next period’s job</button>` : ''}
        <button class="btn danger" data-act="deleteJob" data-id="${j.id}">Delete job</button>
      </div>`;
  };

  PAGES.deadlines = () => {
    setHead('Deadlines', 'Open jobs by due date, and the statutory calendar', `<button class="btn primary" data-act="newJob">New job</button>`);
    const open = S.jobs.filter((j) => !isDone(j)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const groups = [
      ['Overdue', (d) => d != null && d < 0],
      ['Due this week', (d) => d != null && d >= 0 && d <= 7],
      ['Next week', (d) => d != null && d > 7 && d <= 14],
      ['Later', (d) => d != null && d > 14],
      ['No due date', (d) => d == null],
    ];
    const sec = groups.map(([label, f]) => {
      const js = open.filter((j) => f(daysFrom(j.due)));
      if (!js.length) return '';
      return `<div class="card"><div class="card-h"><h2 class="${label === 'Overdue' ? 't-bad' : ''}">${label}</h2><span class="hint">${js.length} job${js.length === 1 ? '' : 's'}</span></div>
        <div class="tbl-wrap"><table class="tbl"><tbody>${js.map((j) => `<tr class="click" data-href="#job/${j.id}"><td style="width:150px">${dueChip(j)}</td><td><b style="font-weight:500">${esc(j.title)}</b><small>${esc(client(j.clientId).name)}${j.period ? ' · ' + esc(j.period) : ''}</small></td><td>${esc(member(j.ownerId)?.name || '—')}</td><td>${statusChip(j.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
    const cal = statutoryCalendar(todayISO(), 60);
    return `<div class="grid g2" style="align-items:start"><div style="display:flex;flex-direction:column;gap:18px">${sec || `<div class="card">${empty('No open jobs', 'Every job is done.')}</div>`}</div>
      <div class="card"><div class="card-h"><h2>Statutory due dates</h2><span class="hint">Next 60 days · standard dates, check the portal for extensions</span></div>
      <div class="tbl-wrap"><table class="tbl"><tbody>${cal.map((x) => `<tr><td style="width:110px" class="${daysFrom(x.date) <= 3 ? 't-warn' : ''}">${fmtDs(x.date)}<small>${daysFrom(x.date) === 0 ? 'today' : 'in ' + daysFrom(x.date) + ' days'}</small></td><td><b style="font-weight:500">${esc(x.what)}</b><small>${esc(x.detail)}</small></td><td><span class="chip plain">${esc(x.cat)}</span></td></tr>`).join('')}</tbody></table></div></div></div>`;
  };

  function statutoryCalendar(from, days) {
    const out = [];
    const end = addDays(from, days);
    const start = parseD(from);
    for (let k = -1; k <= Math.ceil(days / 28) + 1; k++) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const D = (day) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const prev = MONTHS[(m + 10) % 12];
      out.push({ date: D(7), what: 'TDS / TCS payment', detail: `Tax deducted in ${prev}`, cat: 'TDS' });
      out.push({ date: D(11), what: 'GSTR-1 (monthly filers)', detail: `Outward supplies for ${prev}`, cat: 'GST' });
      out.push({ date: D(13), what: 'GSTR-1 IFF (QRMP filers)', detail: m % 3 !== 1 ? `Invoices for ${prev}` : 'Not due in a quarter-end month', cat: 'GST' });
      out.push({ date: D(15), what: 'PF and ESI payment', detail: `Contributions for ${prev}`, cat: 'Payroll' });
      out.push({ date: D(20), what: 'GSTR-3B (monthly filers)', detail: `Return and tax for ${prev}`, cat: 'GST' });
      if ([1, 4, 7, 10].includes(m)) out.push({ date: D(22), what: 'GSTR-3B (QRMP, Kerala & south)', detail: 'Quarterly return for the quarter just ended', cat: 'GST' });
      if (m === 7) out.push({ date: D(31), what: 'TDS return Q1 · ITR (non-audit)', detail: 'Form 24Q/26Q for Apr–Jun; ITR for individuals and non-audit cases', cat: 'TDS / Income tax' });
      if (m === 10) out.push({ date: D(31), what: 'TDS return Q2 · ITR (audit cases)', detail: 'Form 24Q/26Q for Jul–Sep; ITR for tax-audit cases', cat: 'TDS / Income tax' });
      if (m === 1) out.push({ date: D(31), what: 'TDS return Q3', detail: 'Form 24Q/26Q for Oct–Dec', cat: 'TDS' });
      if (m === 5) out.push({ date: D(31), what: 'TDS return Q4', detail: 'Form 24Q/26Q for Jan–Mar', cat: 'TDS' }, { date: D(30), what: 'LLP Form 11', detail: 'Annual return of LLPs', cat: 'ROC / MCA' });
      if (m === 6) out.push({ date: D(15), what: 'Advance tax (15%) · Form 16', detail: 'First instalment; Form 16 to employees', cat: 'Income tax' });
      if (m === 9) out.push({ date: D(15), what: 'Advance tax (45%)', detail: 'Second instalment', cat: 'Income tax' }, { date: D(30), what: 'Tax audit report · DIR-3 KYC', detail: 'Form 3CA/3CB-3CD; director KYC', cat: 'Income tax / ROC' });
      if (m === 12) out.push({ date: D(15), what: 'Advance tax (75%)', detail: 'Third instalment', cat: 'Income tax' }, { date: D(31), what: 'GSTR-9 / 9C', detail: 'GST annual return for last FY', cat: 'GST' });
      if (m === 3) out.push({ date: D(15), what: 'Advance tax (100%)', detail: 'Final instalment', cat: 'Income tax' });
      if (m === 10) out.push({ date: D(30), what: 'LLP Form 8 · AOC-4', detail: 'LLP statement of accounts; company financials (30 days from AGM)', cat: 'ROC / MCA' });
      if (m === 11) out.push({ date: D(29), what: 'MGT-7 / MGT-7A', detail: 'Company annual return (60 days from AGM)', cat: 'ROC / MCA' });
    }
    return out.filter((x) => x.date >= from && x.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  }

  PAGES.timesheet = () => {
    const w = UI.ts.week, wEnd = addDays(w, 6);
    setHead('Timesheet', `Week of ${fmtD(w)}`, `<button class="btn primary" data-act="logTime">Log time</button>`);
    const es = S.time.filter((e) => e.date >= w && e.date <= wEnd).sort((a, b) => a.date.localeCompare(b.date) || String(a.memberId).localeCompare(String(b.memberId)));
    const days = [...Array(7)].map((_, i) => addDays(w, i));
    const openJobs = S.jobs.filter((j) => !isDone(j) || (j.doneOn && daysFrom(j.doneOn) > -30)).sort((a, b) => client(a.clientId).name.localeCompare(client(b.clientId).name));
    const quick = `<div class="card"><div class="card-h"><h2>Quick entry</h2><span class="hint">Add an entry without leaving the week</span></div><div class="card-b">
      <div class="filters">
        <input class="input" type="date" id="q-date" value="${todayISO() >= w && todayISO() <= wEnd ? todayISO() : w}" aria-label="Date" style="min-width:150px">
        <select class="input" id="q-member" aria-label="Who">${memberOptions().map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
        <select class="input" id="q-job" aria-label="Job" style="flex:1 1 260px"><option value="">Choose a job…</option>${openJobs.map((j) => `<option value="${j.id}">${esc(client(j.clientId).name)} — ${esc(j.title)}</option>`).join('')}</select>
        <input class="input" type="number" id="q-hours" min="0.25" step="0.25" placeholder="Hours" aria-label="Hours" style="width:96px;min-width:96px">
        <input class="input" id="q-note" placeholder="What was done" aria-label="What was done" style="flex:1 1 200px">
        <button class="btn primary" data-act="quickTime">Add</button>
      </div></div></div>`;
    const memberTotals = S.team.map((m) => ({ m, h: sum(es.filter((e) => e.memberId === m.id), (e) => e.hours) })).filter((x) => x.h > 0 || x.m.active !== false);
    const weekCap = (m) => num(m.capacity || S.settings.capacityHours) * 12 / 52;
    const grid = `<div class="card"><div class="card-h"><h2>Hours by day</h2><span class="right"><button class="btn sm" data-act="week" data-d="-7">← Previous</button><button class="btn sm" data-act="week" data-d="0">This week</button><button class="btn sm" data-act="week" data-d="7">Next →</button></span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th>${days.map((d) => `<th class="n">${parseD(d).toLocaleDateString('en-IN', { weekday: 'short' })} ${parseD(d).getDate()}</th>`).join('')}<th class="n">Total</th><th class="n">Of capacity</th></tr></thead>
      <tbody>${memberTotals.map(({ m, h }) => `<tr><td>${esc(m.name)}</td>${days.map((d) => { const v = sum(es.filter((e) => e.memberId === m.id && e.date === d), (e) => e.hours); return `<td class="n ${v ? '' : 't-muted'}">${v ? hrs(v) : '·'}</td>`; }).join('')}<td class="n"><b>${hrs(h)}</b></td><td class="n">${pct(weekCap(m) ? h / weekCap(m) : null)}</td></tr>`).join('')}</tbody></table></div></div>`;
    const list = `<div class="card"><div class="card-h"><h2>Entries this week</h2><span class="hint">${es.length} entries · ${hrs(sum(es, (e) => e.hours))} hours · ${inr(sum(es, (e) => num(e.hours) * rateOf(e)))} cost</span></div>
      ${es.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Who</th><th>Job</th><th>Work done</th><th class="n">Hours</th><th class="n">Cost</th><th></th></tr></thead><tbody>
      ${es.map((e) => { const j = job(e.jobId); return `<tr><td>${fmtDs(e.date)}</td><td>${esc(member(e.memberId)?.name || '—')}</td><td>${j ? `<a href="#job/${j.id}">${esc(j.title)}</a><small>${esc(client(j.clientId).name)}</small>` : '<span class="t-muted">(deleted job)</span>'}</td><td>${esc(e.note || '')}</td><td class="n">${hrs(e.hours)}</td><td class="n">${inr(num(e.hours) * rateOf(e))}</td><td class="n"><button class="btn sm ghost" data-act="editTime" data-id="${e.id}">Edit</button></td></tr>`; }).join('')}
      </tbody></table></div>` : empty('No time logged this week', 'Use quick entry above, or the Log time button.')}</div>`;
    return quick + grid + list;
  };

  PAGES.invoices = () => {
    const f = UI.inv;
    setHead('Invoices & payments', 'What you have billed and what is still owed', `<button class="btn primary" data-act="newInvoice">New invoice</button>`);
    let rows = S.invoices.map((i) => ({ i, st: invStats(i) }));
    const all = rows;
    const q = f.q.trim().toLowerCase();
    rows = rows.filter(({ i, st }) => {
      if (f.status === 'unpaid' && st.balance <= 0) return false;
      if (f.status === 'overdue' && st.status !== 'Overdue') return false;
      if (f.status === 'paid' && st.status !== 'Paid') return false;
      if (f.client && i.clientId !== f.client) return false;
      if (q && !(i.number + ' ' + client(i.clientId).name + ' ' + (i.notes || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    rows = sortRows(rows, 'inv', { number: (r) => r.i.number, client: (r) => client(r.i.clientId).name, date: (r) => r.i.date, due: (r) => r.i.dueDate, total: (r) => num(r.i.total), balance: (r) => r.st.balance, status: (r) => r.st.daysOver });
    const owed = sum(all, (r) => r.st.balance), over = sum(all.filter((r) => r.st.status === 'Overdue'), (r) => r.st.balance);
    const mk = monthKey(todayISO());
    const coll = sum(S.invoices.flatMap((i) => i.payments).filter((p) => monthKey(p.date) === mk), (p) => num(p.amount) + num(p.tds));
    const tdsFY = sum(S.invoices.flatMap((i) => i.payments).filter((p) => inRange(p.date, fyOf())), (p) => p.tds);
    return `<section class="kpis">
        <div class="kpi"><span class="l">Owed to you</span><span class="v">${inrC(owed)}</span><span class="s">${all.filter((r) => r.st.balance > 0).length} unpaid invoices</span></div>
        <div class="kpi ${over ? 'bad' : ''}"><span class="l">Past due</span><span class="v">${inrC(over)}</span><span class="s">${all.filter((r) => r.st.status === 'Overdue').length} invoices</span></div>
        <div class="kpi good"><span class="l">Collected this month</span><span class="v">${inrC(coll)}</span><span class="s">including TDS deducted by clients</span></div>
        <div class="kpi"><span class="l">TDS deducted by clients, FY</span><span class="v">${inrC(tdsFY)}</span><span class="s">claim it in the firm’s ITR</span></div>
      </section>
      <div class="card"><div class="card-b"><div class="filters">
        <input class="input search" id="f-inv-q" type="search" placeholder="Search invoice number or client…" value="${esc(f.q)}" data-filter="inv.q" aria-label="Search invoices">
        <select class="input" id="f-inv-status" data-filter="inv.status" aria-label="Status">${[['unpaid', 'Unpaid'], ['overdue', 'Past due'], ['paid', 'Paid'], ['', 'All invoices']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input" id="f-inv-client" data-filter="inv.client" aria-label="Client"><option value="">All clients</option>${clientOptions().map(([v, l]) => `<option value="${v}" ${f.client === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('number', 'Invoice', 'inv')}${th('client', 'Client', 'inv')}${th('date', 'Date', 'inv')}${th('due', 'Due', 'inv')}${th('total', 'Total', 'inv', 'n')}<th class="n">Received</th>${th('balance', 'Balance', 'inv', 'n')}${th('status', 'Status', 'inv')}<th></th></tr></thead><tbody>
      ${rows.map(({ i, st }) => `<tr class="click" data-href="#invoice/${i.id}"><td><b style="font-weight:500">${esc(i.number)}</b>${i.jobIds.length ? `<small>${i.jobIds.length} job${i.jobIds.length === 1 ? '' : 's'}</small>` : ''}</td><td>${esc(client(i.clientId).name)}</td><td>${fmtDs(i.date)}</td><td>${fmtDs(i.dueDate)}</td><td class="n">${inr(i.total)}</td><td class="n">${inr(st.received)}</td><td class="n"><b style="font-weight:500">${inr(st.balance)}</b></td><td>${invChip(st)}</td><td class="n">${st.balance > 0 ? `<button class="btn sm" data-act="payment" data-id="${i.id}">Record payment</button>` : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">${rows.length} invoices</td><td class="n">${inr(sum(rows, (r) => r.i.total))}</td><td class="n">${inr(sum(rows, (r) => r.st.received))}</td><td class="n">${inr(sum(rows, (r) => r.st.balance))}</td><td colspan="2"></td></tr></tfoot></table></div>`
        : empty(S.invoices.length ? 'No invoices match' : 'No invoices yet', S.invoices.length ? 'Change the filters to see more.' : 'Raise an invoice when a job is done, or record invoices you already sent from Zoho.', S.invoices.length ? '' : '<button class="btn primary" data-act="newInvoice">New invoice</button>')}</div>`;
  };

  PAGES.invoice = (id) => {
    const i = byId(S.invoices, id);
    if (!i) { setHead('Invoice not found'); return empty('This invoice no longer exists', '', '<a class="btn" href="#invoices">Back to invoices</a>'); }
    const st = invStats(i), c = client(i.clientId);
    setHead(i.number, c.name, `${st.balance > 0 ? `<button class="btn primary" data-act="payment" data-id="${i.id}">Record payment</button> ` : ''}<button class="btn" data-act="editInvoice" data-id="${i.id}">Edit</button>`);
    const jobs = i.jobIds.map(job).filter(Boolean);
    return `<a class="back" href="#invoices">← All invoices</a>
      <div class="card"><div class="card-b"><div class="detail-head"><div class="ttl"><h2>${esc(i.number)}</h2><div class="meta"><a href="#client/${c.id}">${esc(c.name)}</a>${invChip(st)}</div></div></div>
      <div class="facts" style="margin-top:16px">
        <div><span>Invoice date</span><b>${fmtD(i.date)}</b></div><div><span>Due date</span><b>${fmtD(i.dueDate)}</b></div>
        <div><span>Professional fee</span><b>${inr(i.fee)}</b></div><div><span>GST</span><b>${inr(i.gst)}</b></div>
        <div><span>Reimbursements</span><b>${inr(i.reimb)}</b></div><div><span>Total</span><b>${inr(i.total)}</b></div>
        <div><span>Received (incl. TDS)</span><b>${inr(st.received)}</b></div><div><span>Balance</span><b class="${st.balance > 0 ? 't-bad' : 't-ok'}">${inr(st.balance)}</b></div>
      </div>${i.notes ? `<p style="margin:14px 0 0;white-space:pre-wrap">${esc(i.notes)}</p>` : ''}</div></div>
      <div class="grid g2">
        <div class="card"><div class="card-h"><h2>Jobs on this invoice</h2></div>${jobs.length ? `<ul class="att">${jobs.map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(j.period || '')}</small></div><span class="amt">${inr(j.fee)}</span></li>`).join('')}</ul>` : empty('No jobs linked', 'This invoice was recorded on its own.')}</div>
        <div class="card"><div class="card-h"><h2>Payments</h2>${st.balance > 0 ? '<span class="right"><button class="btn sm" data-act="payment" data-id="' + i.id + '">Record payment</button></span>' : ''}</div>
        ${i.payments.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Mode</th><th class="n">Amount</th><th class="n">TDS</th><th></th></tr></thead><tbody>${i.payments.map((p) => `<tr><td>${fmtD(p.date)}<small>${esc(p.ref || '')}</small></td><td>${esc(p.mode || '')}</td><td class="n">${inr(p.amount)}</td><td class="n">${inr(num(p.tds))}</td><td class="n"><button class="btn sm ghost danger" data-act="delPayment" data-inv="${i.id}" data-id="${p.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : empty('No payments yet', 'Record a payment when the client pays.')}</div>
      </div>
      <div><button class="btn danger" data-act="deleteInvoice" data-id="${i.id}">Delete invoice</button></div>`;
  };

  PAGES.clients = () => {
    const f = UI.clients, fy = fyOf();
    setHead('Clients', `${S.clients.length} clients`, `<button class="btn primary" data-act="newClient">New client</button>`);
    const q = f.q.trim().toLowerCase();
    let rows = S.clients.map((c) => {
      const js = S.jobs.filter((j) => j.clientId === c.id);
      const invs = S.invoices.filter((i) => i.clientId === c.id);
      return { c, open: js.filter((j) => !isDone(j)).length, feeFY: sum(js.filter((j) => inRange(j.doneOn || j.due || j.start, fy)), (j) => j.fee), owed: sum(invs, (i) => invStats(i).balance), ready: sum(js.filter(readyToBill), (j) => j.fee) };
    }).filter(({ c }) => (!f.type || c.type === f.type) && (!q || (c.name + ' ' + (c.contact || '') + ' ' + (c.gstin || '') + ' ' + (c.pan || '') + ' ' + (c.city || '')).toLowerCase().includes(q)));
    rows = sortRows(rows, 'clients', { name: (r) => r.c.name, open: (r) => r.open, fee: (r) => r.feeFY, owed: (r) => r.owed, ready: (r) => r.ready });
    return `<div class="card"><div class="card-b"><div class="filters">
      <input class="input search" id="f-cl-q" type="search" placeholder="Search name, contact, GSTIN, PAN…" value="${esc(f.q)}" data-filter="clients.q" aria-label="Search clients">
      <select class="input" id="f-cl-type" data-filter="clients.type" aria-label="Type"><option value="">All types</option>${CLIENT_TYPES.map((t) => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('name', 'Client', 'clients')}<th>Contact</th><th>GSTIN / PAN</th>${th('open', 'Open jobs', 'clients', 'n')}${th('fee', `Fees FY ${fy.label}`, 'clients', 'n')}${th('ready', 'Ready to bill', 'clients', 'n')}${th('owed', 'Owed', 'clients', 'n')}</tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-href="#client/${r.c.id}"><td><b style="font-weight:500">${esc(r.c.name)}</b><small>${esc(r.c.type || '')}${r.c.city ? ' · ' + esc(r.c.city) : ''}</small></td><td>${esc(r.c.contact || '')}<small>${esc(r.c.phone || r.c.email || '')}</small></td><td class="mono">${esc(r.c.gstin || r.c.pan || '—')}</td><td class="n">${r.open || '·'}</td><td class="n">${r.feeFY ? inr(r.feeFY) : '·'}</td><td class="n ${r.ready ? 't-warn' : ''}">${r.ready ? inr(r.ready) : '·'}</td><td class="n ${r.owed ? 't-bad' : ''}">${r.owed ? inr(r.owed) : '·'}</td></tr>`).join('')}
      </tbody></table></div>` : empty(S.clients.length ? 'No clients match' : 'No clients yet', S.clients.length ? 'Try another search.' : 'Add the people and businesses you work for.', S.clients.length ? '' : '<button class="btn primary" data-act="newClient">New client</button>')}</div>`;
  };

  PAGES.client = (id) => {
    const c = byId(S.clients, id);
    if (!c) { setHead('Client not found'); return empty('This client no longer exists', '', '<a class="btn" href="#clients">Back to clients</a>'); }
    setHead(c.name, c.type || 'Client', `<button class="btn" data-act="editClient" data-id="${c.id}">Edit</button> <button class="btn" data-act="newInvoice" data-client="${c.id}">New invoice</button> <button class="btn primary" data-act="newJob" data-client="${c.id}">New job</button>`);
    const js = S.jobs.filter((j) => j.clientId === c.id).sort((a, b) => (b.due || '').localeCompare(a.due || ''));
    const invs = S.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const stats = js.map(jobStats);
    const fee = sum(stats, (s) => s.fee), cost = sum(stats, (s) => s.cost), h = sum(stats, (s) => s.useHours);
    const owed = sum(invs, (i) => invStats(i).balance);
    return `<a class="back" href="#clients">← All clients</a>
      <div class="card"><div class="card-b"><div class="facts">
        <div><span>Contact person</span><b>${esc(c.contact || '—')}</b></div><div><span>Phone</span><b>${esc(c.phone || '—')}</b></div><div><span>Email</span><b>${esc(c.email || '—')}</b></div>
        <div><span>GSTIN</span><b class="mono">${esc(c.gstin || '—')}</b></div><div><span>PAN</span><b class="mono">${esc(c.pan || '—')}</b></div><div><span>City</span><b>${esc(c.city || '—')}</b></div>
      </div>${c.notes ? `<p style="margin:14px 0 0;white-space:pre-wrap">${esc(c.notes)}</p>` : ''}</div></div>
      <section class="kpis"><div class="kpi"><span class="l">Fees, all jobs</span><span class="v">${inrC(fee)}</span><span class="s">${js.length} jobs</span></div>
        <div class="kpi"><span class="l">Margin</span><span class="v">${pct(fee ? (fee - cost) / fee : null)}</span><span class="s">${inr(h ? fee / h : null)} per hour</span></div>
        <div class="kpi ${owed ? 'bad' : ''}"><span class="l">Owed now</span><span class="v">${inrC(owed)}</span><span class="s">${invs.filter((i) => invStats(i).balance > 0).length} unpaid invoices</span></div>
        <div class="kpi alert"><span class="l">Ready to bill</span><span class="v">${inrC(sum(js.filter(readyToBill), (j) => j.fee))}</span><span class="s">${js.filter(readyToBill).length} jobs</span></div></section>
      <div class="grid g2">
        <div class="card"><div class="card-h"><h2>Jobs</h2></div>${js.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${js.map((j) => { const s = jobStats(j); return `<tr class="click" data-href="#job/${j.id}"><td><b style="font-weight:500">${esc(j.title)}</b><small>${esc(j.period || '')}</small></td><td>${statusChip(j.status)}</td><td class="n">${inr(num(j.fee))}</td><td class="n">${marginCell(s)}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No jobs', 'Open the first job for this client.')}</div>
        <div class="card"><div class="card-h"><h2>Invoices</h2></div>${invs.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${invs.map((i) => { const s = invStats(i); return `<tr class="click" data-href="#invoice/${i.id}"><td><b style="font-weight:500">${esc(i.number)}</b><small>${fmtD(i.date)}</small></td><td class="n">${inr(i.total)}</td><td>${invChip(s)}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No invoices', 'Nothing billed yet.')}</div>
      </div>
      <div><button class="btn danger" data-act="deleteClient" data-id="${c.id}">Delete client</button></div>`;
  };

  PAGES.reports = () => {
    const R = UI.reports, range = periodRange(R.period);
    setHead('Reports', range.label === 'All time' ? 'All time' : `FY ${range.label}`, `<button class="btn" data-act="exportReport">Export CSV</button>`);
    const tabs = [['clients', 'Client profitability'], ['services', 'Service profitability'], ['team', 'Team utilisation'], ['monthly', 'Monthly summary']];
    const period = R.tab === 'team' ? `<input class="input" type="month" id="r-month" value="${R.month}" data-filter="reports.month" aria-label="Month" style="width:auto">` : `<select class="input" id="r-period" data-filter="reports.period" aria-label="Period" style="width:auto">${[['fy', 'This FY'], ['lastfy', 'Last FY'], ['all', 'All time']].map(([v, l]) => `<option value="${v}" ${R.period === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const table = reportTable();
    return `<div class="card"><div class="tabs">${tabs.map(([k, l]) => `<button class="${R.tab === k ? 'on' : ''}" data-act="rtab" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="card-b"><div class="filters">${period}<span class="t-muted" style="font-size:12.5px">${esc(table.note)}</span></div></div>
      ${table.rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${table.cols.map((c) => `<th class="${c.n ? 'n' : ''}">${c.label}</th>`).join('')}</tr></thead><tbody>
      ${table.rows.map((r) => `<tr>${table.cols.map((c) => `<td class="${c.n ? 'n' : ''} ${c.cls ? c.cls(r) : ''}">${c.html ? c.html(r) : esc(c.fmt ? c.fmt(r[c.key]) : r[c.key])}</td>`).join('')}</tr>`).join('')}
      </tbody>${table.total ? `<tfoot><tr>${table.cols.map((c) => `<td class="${c.n ? 'n' : ''}">${table.total[c.key] != null ? esc(c.fmt ? c.fmt(table.total[c.key]) : table.total[c.key]) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>` : empty('Nothing to report yet', 'Add jobs, time and invoices to see this report.')}</div>`;
  };

  function reportTable() {
    const R = UI.reports, range = periodRange(R.period);
    const jobsIn = S.jobs.filter((j) => inRange(j.doneOn || j.due || j.start, range));
    const mPct = (r) => (r.fee ? (r.fee - r.cost) / r.fee : null);
    const mCls = (r) => { const m = mPct(r); return m == null ? '' : m < 0 ? 't-bad' : m < 0.3 ? 't-warn' : ''; };
    if (R.tab === 'clients' || R.tab === 'services') {
      const key = R.tab === 'clients' ? (j) => client(j.clientId).name : (j) => j.service || 'Other';
      const g = {};
      jobsIn.forEach((j) => { const s = jobStats(j); const k = key(j); const o = g[k] || (g[k] = { name: k, jobs: 0, fee: 0, hours: 0, cost: 0, owed: 0 }); o.jobs++; o.fee += s.fee; o.hours += s.useHours; o.cost += s.cost; });
      if (R.tab === 'clients') S.invoices.forEach((i) => { const k = client(i.clientId).name; if (g[k]) g[k].owed += invStats(i).balance; });
      const rows = Object.values(g).map((o) => ({ ...o, margin: o.fee - o.cost, mpct: mPct(o), ph: o.hours ? o.fee / o.hours : null, avg: o.jobs ? o.fee / o.jobs : null })).sort((a, b) => b.fee - a.fee);
      const T = { name: 'Total', jobs: sum(rows, (r) => r.jobs), fee: sum(rows, (r) => r.fee), hours: sum(rows, (r) => r.hours), cost: sum(rows, (r) => r.cost), owed: sum(rows, (r) => r.owed) };
      T.margin = T.fee - T.cost; T.mpct = mPct(T); T.ph = T.hours ? T.fee / T.hours : null; T.avg = T.jobs ? T.fee / T.jobs : null;
      const cols = [{ key: 'name', label: R.tab === 'clients' ? 'Client' : 'Service' }, { key: 'jobs', label: 'Jobs', n: 1 }, { key: 'fee', label: 'Fees', n: 1, fmt: inr }, { key: 'hours', label: 'Hours', n: 1, fmt: hrs }, { key: 'cost', label: 'Cost', n: 1, fmt: inr }, { key: 'margin', label: 'Margin', n: 1, fmt: inr }, { key: 'mpct', label: 'Margin %', n: 1, fmt: pct, cls: mCls }, { key: 'ph', label: 'Per hour', n: 1, fmt: inr }];
      cols.push(R.tab === 'clients' ? { key: 'owed', label: 'Owed now', n: 1, fmt: inr } : { key: 'avg', label: 'Average fee', n: 1, fmt: inr });
      return { cols, rows, total: T, note: 'Jobs by completion date (or due date). Cost is estimated from budget hours where no time is logged.' };
    }
    if (R.tab === 'team') {
      const mk = R.month;
      const rows = S.team.map((m) => {
        const es = S.time.filter((e) => e.memberId === m.id && monthKey(e.date) === mk);
        const h = sum(es, (e) => e.hours), cap = num(m.capacity || S.settings.capacityHours);
        return { name: m.name, role: m.role || '', hours: h, cap, util: cap ? h / cap : null, cost: sum(es, (e) => num(e.hours) * rateOf(e)), value: h * num(m.billRate), jobs: new Set(es.map((e) => e.jobId)).size };
      });
      const T = { name: 'Total', hours: sum(rows, (r) => r.hours), cap: sum(rows, (r) => r.cap), cost: sum(rows, (r) => r.cost), value: sum(rows, (r) => r.value) };
      T.util = T.cap ? T.hours / T.cap : null;
      return { cols: [{ key: 'name', label: 'Person' }, { key: 'role', label: 'Role' }, { key: 'hours', label: 'Hours logged', n: 1, fmt: hrs }, { key: 'cap', label: 'Capacity', n: 1, fmt: hrs }, { key: 'util', label: 'Utilisation', n: 1, fmt: pct, cls: (r) => (r.util > 1 ? 't-bad' : r.util < 0.5 ? 't-warn' : '') }, { key: 'cost', label: 'Cost', n: 1, fmt: inr }, { key: 'value', label: 'Value at bill rate', n: 1, fmt: inr }, { key: 'jobs', label: 'Jobs worked', n: 1 }], rows, total: T, note: `Hours logged in ${monthLabel(mk)} against monthly capacity.` };
    }
    const fy = range.label === 'All time' ? fyOf() : range;
    const months = [...Array(12)].map((_, k) => monthKey(addMonths(fy.start, k)));
    const pays = S.invoices.flatMap((i) => i.payments);
    const rows = months.map((m) => ({
      month: monthLabel(m),
      fee: sum(S.invoices.filter((i) => monthKey(i.date) === m), (i) => i.fee),
      gst: sum(S.invoices.filter((i) => monthKey(i.date) === m), (i) => i.gst),
      coll: sum(pays.filter((p) => monthKey(p.date) === m), (p) => num(p.amount) + num(p.tds)),
      hours: sum(S.time.filter((e) => monthKey(e.date) === m), (e) => e.hours),
      done: S.jobs.filter((j) => isDone(j) && monthKey(j.doneOn) === m).length,
    }));
    const T = { month: 'Total', fee: sum(rows, (r) => r.fee), gst: sum(rows, (r) => r.gst), coll: sum(rows, (r) => r.coll), hours: sum(rows, (r) => r.hours), done: sum(rows, (r) => r.done) };
    return { cols: [{ key: 'month', label: 'Month' }, { key: 'fee', label: 'Fees billed', n: 1, fmt: inr }, { key: 'gst', label: 'GST billed', n: 1, fmt: inr }, { key: 'coll', label: 'Collected', n: 1, fmt: inr }, { key: 'hours', label: 'Hours logged', n: 1, fmt: hrs }, { key: 'done', label: 'Jobs completed', n: 1 }], rows, total: T, note: `FY ${fy.label}, month by month.` };
  }

  PAGES.team = () => {
    setHead('Team & services', 'Who does the work, what their time costs, and your standard fees', `<button class="btn" data-act="newService">New service</button> <button class="btn primary" data-act="newMember">New team member</button>`);
    return `<div class="card"><div class="card-h"><h2>Team</h2><span class="hint">Cost rate drives job costing. Bill rate is what an hour is worth to a client.</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th class="n">Cost / hour</th><th class="n">Bill rate / hour</th><th class="n">Hours / month</th><th>Status</th><th></th></tr></thead><tbody>
      ${S.team.map((m) => `<tr><td><b style="font-weight:500">${esc(m.name)}</b></td><td>${esc(m.role || '')}</td><td class="n">${inr(num(m.costRate))}</td><td class="n">${inr(num(m.billRate))}</td><td class="n">${hrs(m.capacity || S.settings.capacityHours)}</td><td>${m.active === false ? '<span class="chip">Inactive</span>' : '<span class="chip ok">Active</span>'}</td><td class="n"><button class="btn sm" data-act="editMember" data-id="${m.id}">Edit</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-b t-muted" style="font-size:12.5px">How to set a cost rate: (monthly salary + share of rent, software and overheads) ÷ productive hours a month. For a partner, use what you would pay someone to do your work.</div></div>
      <div class="card"><div class="card-h"><h2>Services and standard fees</h2><span class="hint">Picked when you open a job; fee and hours fill in automatically.</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Service</th><th>Category</th><th>Repeats</th><th class="n">Standard fee</th><th class="n">Budget hours</th><th class="n">Fee per hour</th><th></th></tr></thead><tbody>
      ${S.services.slice().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.category)}</td><td>${esc((RECUR.find((r) => r[0] === s.recurring) || RECUR[0])[1])}</td><td class="n">${inr(num(s.fee))}</td><td class="n">${hrs(s.hours)}</td><td class="n ${num(s.hours) && num(s.fee) / num(s.hours) < num(S.settings.defaultCostRate) / 0.7 ? 't-warn' : ''}">${num(s.hours) ? inr(num(s.fee) / num(s.hours)) : '—'}</td><td class="n"><button class="btn sm" data-act="editService" data-id="${s.id}">Edit</button></td></tr>`).join('')}
      </tbody></table></div><div class="card-b t-muted" style="font-size:12.5px">Amber fee per hour means the standard fee earns less than a 30% margin at the default cost rate of ${inr(num(S.settings.defaultCostRate))} an hour.</div></div>`;
  };

  PAGES.settings = () => {
    setHead('Settings & data', 'Firm details, defaults, backup and restore');
    const s = S.settings;
    const theme = (() => { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; } })();
    const f = (name, label, type = 'text', extra = '') => `<div class="field"><label for="set-${name}">${label}</label><input class="input" id="set-${name}" name="${name}" type="${type}" value="${esc(s[name] ?? '')}" ${extra}></div>`;
    return `<div class="grid g2" style="align-items:start">
      <form class="card" id="settings-form" data-submit="settings"><div class="card-h"><h2>Firm details and defaults</h2></div>
        <div class="modal-b">
          ${f('firmName', 'Firm name')}${f('gstin', 'GSTIN')}${f('pan', 'PAN')}${f('phone', 'Phone')}${f('email', 'Email', 'email')}
          <div class="field full"><label for="set-address">Address</label><textarea class="input" id="set-address" name="address">${esc(s.address || '')}</textarea></div>
          ${f('gstRate', 'GST rate on fees (%)', 'number', 'min="0" step="0.01"')}${f('invoiceDueDays', 'Invoice due in (days)', 'number', 'min="0"')}
          ${f('defaultCostRate', 'Default cost rate per hour (₹)', 'number', 'min="0"')}${f('capacityHours', 'Default hours per person per month', 'number', 'min="1"')}
          ${f('invoicePrefix', 'Invoice number prefix')}${f('jobPrefix', 'Job code prefix')}
          <div class="field"><label for="set-fyStartMonth">Financial year starts in</label><select class="input" id="set-fyStartMonth" name="fyStartMonth">${MONTHS.map((m, i) => `<option value="${i + 1}" ${num(s.fyStartMonth) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div class="field"><label for="set-theme">Appearance</label><select class="input" id="set-theme" data-change="theme">${[['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div><div class="modal-f"><button class="btn primary" type="submit">Save settings</button></div></form>
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="card"><div class="card-h"><h2>Backup</h2><span class="hint">${s.lastBackup ? 'Last backup ' + fmtD(s.lastBackup) : 'No backup taken yet'}</span></div><div class="card-b">
          <p class="t-muted" style="margin:0 0 12px">Everything is stored in this browser on this device. Download a backup at least once a week, and use it to move your data to another computer.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="backup">Download backup</button><button class="btn" data-act="copyBackup">Copy backup as text</button></div></div></div>
        <div class="card"><div class="card-h"><h2>Restore or import</h2></div><div class="card-b">
          <p class="t-muted" style="margin:0 0 12px">Choose a backup file (.json) made by this app. Importing replaces everything currently in this browser.</p>
          <input type="file" id="import-file" accept=".json,application/json" data-change="importFile">
          <details style="margin-top:12px"><summary class="t-muted">Or paste backup text</summary><textarea class="input" id="import-text" style="margin-top:8px;min-height:120px" placeholder='{"version":1, …}'></textarea><button class="btn" style="margin-top:8px" data-act="importText">Import pasted text</button></details></div></div>
        <div class="card"><div class="card-h"><h2>Start again</h2></div><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-act="demo">Load sample data</button><button class="btn danger" data-act="wipe">Delete all data</button></div></div>
      </div></div>`;
  };

  // ---------- Modal & forms ----------
  function closeModal() { $('#modal-root').innerHTML = ''; document.removeEventListener('keydown', escClose); }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function modal(title, body, foot, opts = {}) {
    $('#modal-root').innerHTML = `<div class="modal-bg" data-act="bgClose"><div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h3>${esc(title)}</h3><button class="btn ghost x" data-act="close" aria-label="Close">✕</button></div>${body}${foot ? `<div class="modal-f">${foot}</div>` : ''}</div></div>`;
    document.addEventListener('keydown', escClose);
    const first = $('#modal-root input:not([type=hidden]):not([type=checkbox]), #modal-root select, #modal-root textarea');
    if (first) setTimeout(() => first.focus(), 30);
  }
  let formHandler = null;
  function form({ title, fields, values = {}, onSave, onDelete, submit = 'Save', wide, intro }) {
    const fv = (f) => values[f.name] ?? f.default ?? '';
    const input = (f) => {
      const id = 'fld-' + f.name, v = fv(f), req = f.required ? 'required' : '';
      if (f.type === 'select') {
        const opts = typeof f.options === 'function' ? f.options() : f.options;
        return `<select class="input" id="${id}" name="${f.name}" ${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${opts.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
      }
      if (f.type === 'textarea') return `<textarea class="input" id="${id}" name="${f.name}">${esc(v)}</textarea>`;
      if (f.type === 'checkbox') return `<label style="display:flex;gap:8px;align-items:center;color:var(--ink);font-weight:400"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.text || '')}</label>`;
      return `<input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
    };
    const body = `<form id="modal-form" novalidate><div class="modal-b">${intro ? `<div class="field full t-muted" style="font-size:13px">${intro}</div>` : ''}${fields.map((f) => `<div class="field ${f.full ? 'full' : ''}" data-field="${f.name}"><label for="fld-${f.name}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>${input(f)}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`).join('')}</div></form>`;
    const foot = `${onDelete ? '<button class="btn danger left" data-act="formDelete">Delete</button>' : ''}<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="formSave">${esc(submit)}</button>`;
    formHandler = { fields, onSave, onDelete };
    modal(title, body, foot, { wide });
  }
  function readForm() {
    const out = {}; let ok = true;
    formHandler.fields.forEach((f) => {
      const el = $('#fld-' + f.name); if (!el) return;
      let v = f.type === 'checkbox' ? el.checked : el.value.trim();
      if (f.type === 'number') v = v === '' ? null : num(v);
      const wrap = el.closest('.field');
      const bad = f.required && (v === '' || v == null);
      wrap.classList.toggle('err', bad);
      if (bad) ok = false;
      out[f.name] = v;
    });
    if (!ok) { toast('Fill in the fields marked with *'); return null; }
    return out;
  }

  function jobForm(j, preset = {}) {
    const isNew = !j;
    const v = j ? { ...j } : { status: 'Not started', billing: 'Not billed', ownerId: S.team[0]?.id, start: todayISO(), recurring: 'none', priority: 'Normal', ...preset };
    if (!S.clients.length) { toast('Add a client first'); location.hash = '#clients'; setTimeout(() => clientForm(), 50); return; }
    form({
      title: isNew ? 'New job' : 'Edit job', wide: true,
      intro: isNew ? 'Pick a service to fill in the standard fee, budget hours and repeat pattern. You can change them.' : '',
      values: v,
      fields: [
        { name: 'clientId', label: 'Client', type: 'select', options: clientOptions, required: true, placeholder: 'Choose a client' },
        { name: 'service', label: 'Service', type: 'select', options: () => [...S.services.map((s) => s.name), 'Other'], placeholder: 'Choose a service' },
        { name: 'title', label: 'Job title', required: true, full: true, placeholder: 'e.g. GST returns – October 2026' },
        { name: 'period', label: 'Period covered', placeholder: 'e.g. Oct 2026, Q2 FY 2026-27, FY 2025-26' },
        { name: 'ownerId', label: 'Owner', type: 'select', options: () => memberOptions(v.ownerId) },
        { name: 'start', label: 'Start date', type: 'date' },
        { name: 'due', label: 'Due date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: JOB_STATUS },
        { name: 'priority', label: 'Priority', type: 'select', options: ['Normal', 'High'] },
        { name: 'fee', label: 'Fee, excl. GST (₹)', type: 'number', min: 0, step: '1' },
        { name: 'budgetHours', label: 'Budget hours', type: 'number', min: 0, step: '0.25' },
        { name: 'govtFees', label: 'Govt fees / challans to recover (₹)', type: 'number', min: 0, help: 'Late fees, MCA fees, DSC cost — billed at cost, no GST' },
        { name: 'recurring', label: 'Repeats', type: 'select', options: RECUR },
        { name: 'billing', label: 'Billing', type: 'select', options: BILLING },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      onSave: (d) => {
        if (d.status === DONE && (!j || j.status !== DONE)) d.doneOn = d.doneOn || todayISO();
        if (d.status !== DONE) d.doneOn = null;
        if (isNew) { const nj = { id: uid('j'), code: nextJobCode(), created: todayISO(), invoiceId: null, ...d }; S.jobs.push(nj); S.started = true; location.hash = '#job/' + nj.id; }
        else Object.assign(j, d);
        toast(isNew ? 'Job created' : 'Job saved');
        return true;
      },
      onDelete: j ? () => deleteJob(j.id) : null,
    });
    // Service picker fills defaults
    const sel = $('#fld-service');
    if (sel) sel.addEventListener('change', () => {
      const s = S.services.find((x) => x.name === sel.value); if (!s) return;
      const setIf = (n, val) => { const el = $('#fld-' + n); if (el && (!el.value || isNew)) el.value = val; };
      setIf('fee', s.fee); setIf('budgetHours', s.hours); setIf('recurring', s.recurring);
      const t = $('#fld-title'); const cl = $('#fld-clientId');
      if (t && !t.value) t.value = s.name + ($('#fld-period')?.value ? ' – ' + $('#fld-period').value : '');
      if (cl && !cl.value) cl.focus();
    });
  }

  function timeForm(e, preset = {}) {
    const isNew = !e;
    const jobs = S.jobs.filter((j) => !isDone(j) || (e && j.id === e.jobId) || j.id === preset.jobId || (j.doneOn && daysFrom(j.doneOn) > -60));
    if (!jobs.length) { toast('Open a job first'); return; }
    form({
      title: isNew ? 'Log time' : 'Edit time entry',
      values: e ? { ...e } : { date: todayISO(), memberId: S.team.find((m) => m.active !== false)?.id, ...preset },
      fields: [
        { name: 'jobId', label: 'Job', type: 'select', required: true, full: true, placeholder: 'Choose a job', options: () => jobs.sort((a, b) => client(a.clientId).name.localeCompare(client(b.clientId).name)).map((j) => [j.id, client(j.clientId).name + ' — ' + j.title]) },
        { name: 'memberId', label: 'Who', type: 'select', required: true, options: () => memberOptions(e?.memberId) },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'hours', label: 'Hours', type: 'number', required: true, min: 0.25, step: '0.25' },
        { name: 'note', label: 'Work done', placeholder: 'e.g. Reconciled GSTR-2B, filed 3B' },
      ],
      onSave: (d) => {
        if (num(d.hours) <= 0) { toast('Enter the hours spent'); return false; }
        d.costRate = num(member(d.memberId)?.costRate ?? S.settings.defaultCostRate);
        if (isNew) { S.time.push({ id: uid('t'), ...d }); S.started = true; } else Object.assign(e, d);
        const j = job(d.jobId); if (j && j.status === 'Not started') j.status = 'In progress';
        toast(isNew ? `${hrs(d.hours)} h logged` : 'Entry saved');
        return true;
      },
      onDelete: e ? () => { S.time = S.time.filter((x) => x.id !== e.id); toast('Entry deleted'); } : null,
    });
  }

  function clientForm(c) {
    const isNew = !c;
    form({
      title: isNew ? 'New client' : 'Edit client', wide: true, values: c ? { ...c } : { type: 'Company' },
      fields: [
        { name: 'name', label: 'Client name', required: true, full: true },
        { name: 'type', label: 'Type', type: 'select', options: CLIENT_TYPES },
        { name: 'contact', label: 'Contact person' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'gstin', label: 'GSTIN', placeholder: '15 characters' },
        { name: 'pan', label: 'PAN', placeholder: '10 characters' },
        { name: 'city', label: 'City' },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      onSave: (d) => {
        d.gstin = (d.gstin || '').toUpperCase(); d.pan = (d.pan || '').toUpperCase();
        if (d.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(d.gstin)) { toast('GSTIN should be 15 characters, starting with the 2-digit state code'); return false; }
        if (d.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(d.pan)) { toast('PAN should look like ABCDE1234F'); return false; }
        if (isNew) { const nc = { id: uid('c'), ...d }; S.clients.push(nc); S.started = true; if ((location.hash || '').startsWith('#clients')) location.hash = '#client/' + nc.id; }
        else Object.assign(c, d);
        toast(isNew ? 'Client added' : 'Client saved');
        return true;
      },
      onDelete: c ? () => deleteClient(c.id) : null,
    });
  }

  function memberForm(m) {
    form({
      title: m ? 'Edit team member' : 'New team member', values: m ? { ...m } : { active: true, capacity: S.settings.capacityHours, costRate: S.settings.defaultCostRate },
      fields: [
        { name: 'name', label: 'Name', required: true }, { name: 'role', label: 'Role', placeholder: 'e.g. Senior accountant' },
        { name: 'costRate', label: 'Cost per hour (₹)', type: 'number', required: true, min: 0, help: 'Salary + overheads ÷ productive hours' },
        { name: 'billRate', label: 'Bill rate per hour (₹)', type: 'number', min: 0 },
        { name: 'capacity', label: 'Productive hours per month', type: 'number', min: 1 },
        { name: 'active', label: 'Status', type: 'checkbox', text: 'Active' },
      ],
      onSave: (d) => { if (m) Object.assign(m, d); else S.team.push({ id: uid('m'), ...d }); toast('Team saved'); return true; },
      onDelete: m && S.team.length > 1 ? () => {
        if (S.time.some((t) => t.memberId === m.id) || S.jobs.some((j) => j.ownerId === m.id)) { m.active = false; toast('Has time or jobs, so marked inactive instead'); }
        else { S.team = S.team.filter((x) => x.id !== m.id); toast('Removed'); }
      } : null,
    });
  }

  function serviceForm(s) {
    form({
      title: s ? 'Edit service' : 'New service', values: s ? { ...s } : { category: 'GST', recurring: 'none' },
      fields: [
        { name: 'name', label: 'Service name', required: true, full: true },
        { name: 'category', label: 'Category', type: 'select', options: CATEGORIES },
        { name: 'recurring', label: 'Repeats', type: 'select', options: RECUR },
        { name: 'fee', label: 'Standard fee (₹)', type: 'number', min: 0 },
        { name: 'hours', label: 'Budget hours', type: 'number', min: 0, step: '0.25' },
      ],
      onSave: (d) => { if (s) Object.assign(s, d); else S.services.push({ id: uid('s'), ...d }); toast('Service saved'); return true; },
      onDelete: s ? () => { S.services = S.services.filter((x) => x.id !== s.id); toast('Service removed'); } : null,
    });
  }

  // Invoice builder
  function invoiceForm(inv, preset = {}) {
    const isNew = !inv;
    if (!S.clients.length) { toast('Add a client first'); return; }
    const st = S.settings;
    const v = inv ? { ...inv } : { clientId: preset.clientId || '', number: nextInvoiceNo(), date: todayISO(), dueDate: addDays(todayISO(), num(st.invoiceDueDays)), jobIds: preset.jobId ? [preset.jobId] : [], gstRate: st.gstRate };
    const draw = () => {
      const cid = $('#inv-client')?.value ?? v.clientId;
      const picked = new Set($$('#inv-jobs input:checked').map((x) => x.value));
      const pool = S.jobs.filter((j) => j.clientId === cid && (j.billing === 'Not billed' || (inv && inv.jobIds.includes(j.id)))).sort((a, b) => (isDone(b) - isDone(a)) || (a.due || '').localeCompare(b.due || ''));
      if (!$('#inv-jobs').dataset.init) { v.jobIds.forEach((id) => picked.add(id)); $('#inv-jobs').dataset.init = 1; }
      $('#inv-jobs').innerHTML = pool.length ? pool.map((j) => `<label><input type="checkbox" value="${j.id}" ${picked.has(j.id) ? 'checked' : ''}><span>${esc(j.title)}<br><small class="t-muted">${esc(j.period || '')} · ${esc(j.status)}${num(j.govtFees) ? ' · govt fees ' + inr(j.govtFees) : ''}</small></span><b class="num">${inr(num(j.fee))}</b></label>`).join('') : '<div class="empty" style="padding:14px">No unbilled jobs for this client. You can still enter amounts below.</div>';
      recalc(true);
    };
    const recalc = (fromJobs) => {
      const sel = $$('#inv-jobs input:checked').map((x) => job(x.value)).filter(Boolean);
      if (fromJobs && sel.length) { $('#inv-fee').value = sum(sel, (j) => j.fee); $('#inv-reimb').value = sum(sel, (j) => j.govtFees); }
      const fee = num($('#inv-fee').value), rate = num($('#inv-rate').value), reimb = num($('#inv-reimb').value);
      const gst = Math.round(fee * rate) / 100;
      $('#inv-sum').innerHTML = `<div class="sumline"><span>Professional fee</span><span>${inr(fee)}</span></div><div class="sumline"><span>GST @ ${rate}%${rate ? ' (CGST + SGST)' : ''}</span><span>${inr(gst)}</span></div><div class="sumline"><span>Reimbursements (no GST)</span><span>${inr(reimb)}</span></div><div class="sumline total"><span>Invoice total</span><span>${inr(Math.round(fee + gst + reimb))}</span></div>`;
    };
    const body = `<div class="modal-b">
      <div class="field full"><label for="inv-client">Client <span class="req">*</span></label><select class="input" id="inv-client"><option value="">Choose a client</option>${clientOptions().map(([id, n]) => `<option value="${id}" ${id === v.clientId ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="field"><label for="inv-number">Invoice number <span class="req">*</span></label><input class="input" id="inv-number" value="${esc(v.number)}"><span class="help">Use the same number as in Zoho Books</span></div>
      <div class="field"><label for="inv-date">Invoice date</label><input class="input" id="inv-date" type="date" value="${esc(v.date)}"></div>
      <div class="field"><label for="inv-due">Due date</label><input class="input" id="inv-due" type="date" value="${esc(v.dueDate || '')}"></div>
      <div class="field"><label for="inv-rate">GST rate (%)</label><input class="input" id="inv-rate" type="number" min="0" step="0.01" value="${esc(inv ? (num(inv.fee) ? round2(num(inv.gst) / num(inv.fee) * 100) : st.gstRate) : st.gstRate)}"></div>
      <div class="field full"><label>Jobs to bill</label><div class="pick" id="inv-jobs"></div></div>
      <div class="field"><label for="inv-fee">Professional fee (₹)</label><input class="input" id="inv-fee" type="number" min="0" value="${esc(inv ? inv.fee : 0)}"></div>
      <div class="field"><label for="inv-reimb">Reimbursements (₹)</label><input class="input" id="inv-reimb" type="number" min="0" value="${esc(inv ? inv.reimb : 0)}"><span class="help">Govt fees and challans paid for the client</span></div>
      <div class="field full" id="inv-sum"></div>
      <div class="field full"><label for="inv-notes">Notes</label><textarea class="input" id="inv-notes">${esc(v.notes || '')}</textarea></div></div>`;
    modal(isNew ? 'New invoice' : 'Edit invoice', body, `<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="saveInvoice">${isNew ? 'Create invoice' : 'Save invoice'}</button>`, { wide: true });
    $('#inv-client').addEventListener('change', () => { $('#inv-jobs').dataset.init = 1; draw(); });
    $('#inv-jobs').addEventListener('change', () => recalc(true));
    ['#inv-fee', '#inv-rate', '#inv-reimb'].forEach((s) => $(s).addEventListener('input', () => recalc(false)));
    draw();
    if (inv) { $('#inv-fee').value = inv.fee; $('#inv-reimb').value = inv.reimb; recalc(false); }
    ACT.saveInvoice = () => {
      const clientId = $('#inv-client').value, number = $('#inv-number').value.trim();
      if (!clientId || !number) { toast('Choose a client and enter an invoice number'); return; }
      if (S.invoices.some((x) => x.number === number && x !== inv)) { toast('That invoice number is already used'); return; }
      const fee = num($('#inv-fee').value), rate = num($('#inv-rate').value), reimb = num($('#inv-reimb').value);
      const gst = Math.round(fee * rate) / 100;
      if (fee + reimb <= 0) { toast('Enter an amount to bill'); return; }
      const jobIds = $$('#inv-jobs input:checked').map((x) => x.value);
      const data = { clientId, number, date: $('#inv-date').value || todayISO(), dueDate: $('#inv-due').value || null, fee, gst, reimb, total: Math.round(fee + gst + reimb), jobIds, notes: $('#inv-notes').value.trim() };
      let target = inv;
      if (inv) {
        inv.jobIds.filter((id) => !jobIds.includes(id)).forEach((id) => { const j = job(id); if (j) { j.billing = 'Not billed'; j.invoiceId = null; } });
        Object.assign(inv, data);
      } else { target = { id: uid('i'), payments: [], ...data }; S.invoices.push(target); S.started = true; }
      jobIds.forEach((id) => { const j = job(id); if (j) { j.billing = 'Billed'; j.invoiceId = target.id; } });
      closeModal(); toast(inv ? 'Invoice saved' : `Invoice ${number} created`);
      location.hash = '#invoice/' + target.id; commit();
    };
  }

  function paymentForm(inv) {
    const st = invStats(inv);
    const expectTds = Math.round(num(inv.fee) * 0.1);
    form({
      title: `Record payment · ${inv.number}`,
      intro: `Balance due ${inr(st.balance)}. If the client deducted TDS (usually 10% of the fee under section 194J), enter it separately so the invoice closes and you can claim it.`,
      values: { date: todayISO(), amount: st.balance, tds: 0, mode: 'Bank transfer' },
      fields: [
        { name: 'date', label: 'Date received', type: 'date', required: true },
        { name: 'mode', label: 'Mode', type: 'select', options: PAY_MODES },
        { name: 'amount', label: 'Amount received (₹)', type: 'number', required: true, min: 0 },
        { name: 'tds', label: 'TDS deducted by client (₹)', type: 'number', min: 0, help: `10% of fee would be ${inr(expectTds)}` },
        { name: 'ref', label: 'Reference', full: true, placeholder: 'UTR / cheque number' },
      ],
      submit: 'Record payment',
      onSave: (d) => {
        if (num(d.amount) + num(d.tds) <= 0) { toast('Enter the amount received'); return false; }
        if (num(d.amount) + num(d.tds) > st.balance + 1) { toast(`That is more than the balance of ${inr(st.balance)}`); return false; }
        inv.payments.push({ id: uid('p'), ...d });
        toast('Payment recorded');
        return true;
      },
    });
  }

  function confirmBox(title, text, okLabel, onOk, typed) {
    modal(title, `<div class="modal-b"><div class="field full"><p style="margin:0">${text}</p>${typed ? `<input class="input" id="confirm-typed" placeholder="Type ${esc(typed)} to confirm" style="margin-top:12px">` : ''}</div></div>`,
      `<button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="confirmOk">${esc(okLabel)}</button>`);
    ACT.confirmOk = () => { if (typed && $('#confirm-typed').value.trim() !== typed) { toast(`Type ${typed} to confirm`); return; } closeModal(); onOk(); commit(); };
  }

  function deleteJob(id) {
    const j = job(id); if (!j) return;
    const te = S.time.filter((t) => t.jobId === id).length;
    confirmBox('Delete this job?', `“${esc(j.title)}” and its ${te} time entr${te === 1 ? 'y' : 'ies'} will be removed. Invoices stay.`, 'Delete job', () => {
      S.jobs = S.jobs.filter((x) => x.id !== id); S.time = S.time.filter((t) => t.jobId !== id);
      S.invoices.forEach((i) => { i.jobIds = i.jobIds.filter((x) => x !== id); });
      location.hash = '#jobs'; toast('Job deleted');
    });
  }
  function deleteClient(id) {
    const c = byId(S.clients, id); if (!c) return;
    const nj = S.jobs.filter((j) => j.clientId === id).length, ni = S.invoices.filter((i) => i.clientId === id).length;
    if (nj || ni) { closeModal(); toast(`${c.name} has ${nj} jobs and ${ni} invoices. Delete those first.`); return; }
    confirmBox('Delete this client?', `“${esc(c.name)}” will be removed.`, 'Delete client', () => { S.clients = S.clients.filter((x) => x.id !== id); location.hash = '#clients'; toast('Client deleted'); });
  }

  function nextPeriod(j) {
    const step = j.recurring === 'monthly' ? 1 : j.recurring === 'quarterly' ? 3 : j.recurring === 'annual' ? 12 : 0;
    if (!step) return null;
    const shiftPeriod = (p) => {
      if (!p) return p;
      let m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})$/i.exec(p.trim());
      if (m) { const idx = MONTHS.findIndex((x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase()); const d = new Date(+m[2], idx + step, 1); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
      m = /^Q([1-4]) FY (\d{4})-(\d{2})$/i.exec(p.trim());
      if (m && step === 3) { let q = +m[1] + 1, y = +m[2]; if (q > 4) { q = 1; y++; } return `Q${q} FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`; }
      m = /^FY (\d{4})-(\d{2})$/i.exec(p.trim());
      if (m && step === 12) { const y = +m[1] + 1; return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`; }
      return p + ' (next)';
    };
    const np = shiftPeriod(j.period);
    const title = j.period && j.title.includes(j.period) ? j.title.replace(j.period, np) : j.title + (np ? ' – ' + np : '');
    const nj = { ...j, id: uid('j'), code: nextJobCode(), period: np, title, status: 'Not started', billing: 'Not billed', invoiceId: null, doneOn: null, nextId: null, created: todayISO(), start: j.start ? addMonths(j.start, step) : null, due: j.due ? addMonths(j.due, step) : null };
    S.jobs.push(nj); j.nextId = nj.id;
    return nj;
  }

  // ---------- Backup / import / CSV ----------
  function download(name, text, type) {
    try {
      const blob = new Blob([text], { type });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return true;
    } catch (e) { return false; }
  }
  function showText(title, text) {
    modal(title, `<div class="modal-b"><div class="field full"><p class="t-muted" style="margin:0 0 8px">If the download did not start, copy this text and save it as a file.</p><textarea class="input mono" id="out-text" style="min-height:240px" readonly>${esc(text)}</textarea></div></div>`,
      `<button class="btn" data-act="close">Close</button><button class="btn primary" data-act="copyOut">Copy</button>`, { wide: true });
  }
  const backupText = () => JSON.stringify({ ...S, exportedAt: new Date().toISOString(), app: 'cloudbook-desk' }, null, 1);
  function doImport(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { toast('That file is not valid JSON'); return; }
    if (!d || typeof d !== 'object' || !Array.isArray(d.jobs) || !Array.isArray(d.clients)) { toast('This does not look like a Cloudbook Desk backup'); return; }
    confirmBox('Replace all data?', `The import has ${d.clients.length} clients, ${d.jobs.length} jobs, ${(d.invoices || []).length} invoices and ${(d.time || []).length} time entries. Everything currently in this browser will be replaced.`, 'Import and replace', () => {
      S = migrate(d); S.started = true; delete S.exportedAt; delete S.app; location.hash = '#dashboard'; toast('Data imported');
    });
  }
  function toCSV(cols, rows) {
    const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.map((c) => q(c.label)).join(','), ...rows.map((r) => cols.map((c) => { const v = r[c.key]; return q(typeof v === 'number' ? round2(v) : v); }).join(','))].join('\n');
  }

  // ---------- Actions ----------
  let toastTimer;
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const ACT = {
    close: closeModal,
    bgClose: (d, el, e) => { if (e.target === el) closeModal(); },
    formSave: () => { const d = readForm(); if (!d) return; if (formHandler.onSave(d) !== false) { closeModal(); commit(); } },
    formDelete: () => { const h = formHandler; closeModal(); h.onDelete(); commit(); },
    newJob: (d) => jobForm(null, d.client ? { clientId: d.client } : {}),
    editJob: (d) => jobForm(job(d.id)),
    deleteJob: (d) => deleteJob(d.id),
    nextPeriod: (d) => { const nj = nextPeriod(job(d.id)); if (nj) { toast('Next period job created'); location.hash = '#job/' + nj.id; commit(); } },
    rollForward: () => {
      const t = todayISO();
      const cands = S.jobs.filter((j) => j.recurring && j.recurring !== 'none' && !j.nextId && (!j.due || j.due <= addDays(t, 31)));
      if (!cands.length) { toast('No recurring jobs need rolling forward'); return; }
      confirmBox('Roll forward recurring jobs?', `Create the next period’s job for ${cands.length} recurring job${cands.length === 1 ? '' : 's'} due within the next month (GST returns, TDS returns, bookkeeping and so on).`, 'Create jobs', () => { cands.forEach(nextPeriod); toast(`${cands.length} jobs created`); });
      $('[data-act="confirmOk"]').className = 'btn primary';
    },
    logTime: (d) => timeForm(null, d.job ? { jobId: d.job } : {}),
    editTime: (d) => timeForm(byId(S.time, d.id)),
    quickTime: () => {
      const jobId = $('#q-job').value, hours = num($('#q-hours').value), memberId = $('#q-member').value, date = $('#q-date').value;
      if (!jobId || hours <= 0 || !date) { toast('Choose a job and enter the hours'); return; }
      S.time.push({ id: uid('t'), jobId, memberId, date, hours, note: $('#q-note').value.trim(), costRate: num(member(memberId)?.costRate ?? S.settings.defaultCostRate) });
      const j = job(jobId); if (j && j.status === 'Not started') j.status = 'In progress';
      S.started = true; toast(`${hrs(hours)} h logged`); commit();
      setTimeout(() => $('#q-hours')?.focus(), 0);
    },
    week: (d) => { UI.ts.week = num(d.d) === 0 ? startOfWeek(todayISO()) : addDays(UI.ts.week, num(d.d)); render(); },
    newClient: () => clientForm(),
    editClient: (d) => clientForm(byId(S.clients, d.id)),
    deleteClient: (d) => deleteClient(d.id),
    newMember: () => memberForm(), editMember: (d) => memberForm(member(d.id)),
    newService: () => serviceForm(), editService: (d) => serviceForm(byId(S.services, d.id)),
    newInvoice: (d) => invoiceForm(null, { clientId: d.client, jobId: d.job }),
    editInvoice: (d) => invoiceForm(byId(S.invoices, d.id)),
    payment: (d) => paymentForm(byId(S.invoices, d.id)),
    delPayment: (d) => { const i = byId(S.invoices, d.inv); i.payments = i.payments.filter((p) => p.id !== d.id); toast('Payment removed'); commit(); },
    deleteInvoice: (d) => {
      const i = byId(S.invoices, d.id);
      confirmBox('Delete this invoice?', `${esc(i.number)} and its ${i.payments.length} payment record(s) will be removed. Its jobs go back to “Not billed”.`, 'Delete invoice', () => {
        i.jobIds.forEach((id) => { const j = job(id); if (j) { j.billing = 'Not billed'; j.invoiceId = null; } });
        S.invoices = S.invoices.filter((x) => x.id !== i.id); location.hash = '#invoices'; toast('Invoice deleted');
      });
    },
    sort: (d) => { const st = UI[d.tbl]; if (st.sort === d.key) st.dir = -st.dir; else { st.sort = d.key; st.dir = 1; } render(); },
    att: (d) => { UI.att = d.k; render(); },
    jobsReady: (d, el, e) => { e.preventDefault(); UI.jobs.status = 'ready'; location.hash = '#jobs'; },
    rtab: (d) => { UI.reports.tab = d.k; render(); },
    exportReport: () => { const t = reportTable(); const csv = toCSV(t.cols, t.total ? [...t.rows, t.total] : t.rows); const name = `cloudbook-${UI.reports.tab}-${todayISO()}.csv`; download(name, csv, 'text/csv'); toast('CSV exported'); },
    backup: () => { const txt = backupText(); download(`cloudbook-desk-backup-${todayISO()}.json`, txt, 'application/json'); S.settings.lastBackup = todayISO(); save(); toast('Backup downloaded'); render(); },
    copyBackup: () => { const txt = backupText(); S.settings.lastBackup = todayISO(); save(); showText('Backup text', txt); },
    copyOut: () => { const ta = $('#out-text'); const done = () => toast('Copied'); if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('Press Ctrl+C to copy'); }); else { ta.select(); toast('Press Ctrl+C to copy'); } },
    importText: () => doImport($('#import-text').value),
    goImport: () => { location.hash = '#settings'; },
    start: () => { S.started = true; location.hash = '#settings'; commit(); toast('Check your firm details, then add clients'); },
    demo: () => {
      const go = () => { S = migrate(window.CB_DEMO ? window.CB_DEMO(blank, uid) : blank()); S.started = true; location.hash = '#dashboard'; commit(); toast('Sample data loaded'); };
      if (S.jobs.length || S.clients.length) { confirmBox('Replace your data with sample data?', 'Everything in this browser will be replaced with a sample firm. Download a backup first if you need it.', 'Load sample data', go); } else go();
    },
    wipe: () => confirmBox('Delete all data?', 'Every client, job, time entry and invoice in this browser will be deleted. This cannot be undone unless you have a backup.', 'Delete everything', () => { S = blank(); location.hash = '#dashboard'; toast('All data deleted'); }, 'DELETE'),
  };

  // ---------- Event wiring ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && ACT[a.dataset.act]) { if (a.tagName === 'BUTTON' || a.dataset.act !== 'bgClose') { if (a.tagName === 'BUTTON') e.preventDefault(); } ACT[a.dataset.act](a.dataset, a, e); return; }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a,button,input,select')) { location.hash = row.dataset.href; return; }
    if (e.target.closest('.nav a') && window.innerWidth <= 900) $('#app').classList.remove('nav-open');
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('th.sortable')) { e.preventDefault(); ACT.sort(e.target.dataset); }
    if (e.key === 'Enter' && e.target.id && e.target.id.startsWith('q-') && e.target.tagName === 'INPUT') { e.preventDefault(); ACT.quickTime(); }
    if (e.key === 'Enter' && e.target.closest('#modal-form') && e.target.tagName === 'INPUT') { e.preventDefault(); ACT.formSave(); }
  });
  const onFilter = (e) => {
    const el = e.target.closest('[data-filter]'); if (!el) return;
    const [tbl, key] = el.dataset.filter.split('.');
    UI[tbl][key] = el.value; render();
  };
  document.addEventListener('input', (e) => { if (e.target.matches('input[data-filter]')) onFilter(e); });
  document.addEventListener('change', (e) => {
    if (e.target.matches('select[data-filter], input[type=month][data-filter]')) return onFilter(e);
    const c = e.target.closest('[data-change]'); if (!c) return;
    if (c.dataset.change === 'jobStatus') { const j = job(c.dataset.id); j.status = c.value; j.doneOn = j.status === DONE ? (j.doneOn || todayISO()) : null; toast(j.status === DONE && j.billing === 'Not billed' && num(j.fee) ? 'Marked done — ready to bill' : 'Status updated'); commit(); }
    if (c.dataset.change === 'theme') { try { localStorage.setItem(THEME_KEY, c.value); } catch (err) { /* storage blocked */ } applyTheme(); }
    if (c.dataset.change === 'importFile') { const file = c.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => doImport(String(r.result)); r.readAsText(file); c.value = ''; }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.dataset.submit === 'settings') {
      e.preventDefault();
      const fd = new FormData(e.target);
      fd.forEach((v, k) => { S.settings[k] = ['gstRate', 'invoiceDueDays', 'defaultCostRate', 'capacityHours', 'fyStartMonth'].includes(k) ? num(v) : String(v).trim(); });
      S.started = true; toast('Settings saved'); commit();
    }
    if (e.target.id === 'modal-form') { e.preventDefault(); ACT.formSave(); }
  });
  $('#menu-btn').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
  function applyTheme() {
    let t = 'system'; try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { /* storage blocked */ }
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });

  load(); applyTheme(); render();
  window.CloudbookDesk = { get state() { return S; }, render };
})();
