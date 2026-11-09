/* Cloudbook Desk — practice management for a small accounting & compliance firm.
   Plain JavaScript, no build step. All data is kept in the browser (localStorage)
   and can be exported/imported as a JSON backup from Settings & data. */
(() => {
  'use strict';
  // Refuse to run inside someone else's frame on the published site (GitHub Pages can't send frame headers).
  if (window.top !== window.self && /(github\.io|cloudbookassociates\.com)$/i.test(location.hostname)) { document.documentElement.textContent = 'Open Cloudbook Desk directly in its own browser tab.'; return; }

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
  const FILING_STATUS = ['Pending', 'In progress', 'Filed', 'Not applicable'];
  const EXP_CATS = ['Government / statutory fee', 'Late fee / interest (GST, TDS, ROC)', 'MCA / ROC filing fee', 'Tax paid for client (GST, TDS, advance tax)', 'DSC (digital signature)', 'Stamp paper / notary', 'Professional fee paid (auditor, valuer, advocate)', 'Travel and conveyance', 'Courier and postage', 'Printing and documents', 'Other'];
  const PAID_BY = ['Firm bank account', 'Partner personally', 'Cash', 'Firm card / UPI'];
  // Statutory filings. kind 'annual': due on md in the first calendar year of the compliance FY
  // (accounts year just ended). kind 'tdsq': quarterly TDS returns. late = estimated late fee.
  const FILINGS = [
    { code: 'AGM', name: 'Board meeting & AGM (minutes, notices)', short: 'AGM', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '09-30', fee: 2000 },
    { code: 'AOC4', name: 'AOC-4 · financial statements', short: 'AOC-4', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '10-29', fee: 4000, late: { perDay: 100 } },
    { code: 'MGT7', name: 'MGT-7 / 7A · annual return', short: 'MGT-7', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '11-28', fee: 3000, late: { perDay: 100 } },
    { code: 'ADT1', name: 'ADT-1 · auditor appointment', short: 'ADT-1', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '10-14', fee: 1500, late: { perDay: 100 } },
    { code: 'DIR3', name: 'DIR-3 KYC · directors / partners', short: 'DIR-3', cat: 'ROC / MCA', applies: ['Company', 'LLP'], kind: 'annual', md: '09-30', fee: 1000, late: { flat: 5000 } },
    { code: 'DPT3', name: 'DPT-3 · return of deposits', short: 'DPT-3', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '06-30', fee: 2000, late: { perDay: 100 } },
    { code: 'MSME1', name: 'MSME-1 · dues to MSMEs (Oct–Mar)', short: 'MSME-1', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '04-30', fee: 1000 },
    { code: 'INC20A', name: 'INC-20A · commencement of business', short: 'INC-20A', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '06-30', fee: 2500, late: { flat: 50000 } },
    { code: 'FLA', name: 'FLA return · RBI (foreign investment)', short: 'FLA', cat: 'ROC / MCA', applies: ['Company'], kind: 'annual', md: '07-15', fee: 3000 },
    { code: 'F11', name: 'LLP Form 11 · annual return', short: 'Form 11', cat: 'ROC / MCA', applies: ['LLP'], kind: 'annual', md: '05-30', fee: 1800, late: { perDay: 100 } },
    { code: 'F8', name: 'LLP Form 8 · statement of accounts', short: 'Form 8', cat: 'ROC / MCA', applies: ['LLP'], kind: 'annual', md: '10-30', fee: 1800, late: { perDay: 100 } },
    { code: 'ITRCO', name: 'ITR-6 · company income tax return', short: 'ITR-6', cat: 'Income tax', applies: ['Company'], kind: 'annual', md: '10-31', fee: 5000, late: { flat: 5000 } },
    { code: 'ITRLLP', name: 'ITR-5 · LLP / firm income tax return', short: 'ITR-5', cat: 'Income tax', applies: ['LLP', 'Partnership firm', 'Society / Trust'], kind: 'annual', md: '07-31', fee: 2500, late: { flat: 5000 } },
    { code: 'TAR', name: 'Tax audit / 3CEB report', short: '3CD/3CEB', cat: 'Income tax', applies: ['Company', 'LLP', 'Partnership firm', 'Proprietorship'], kind: 'annual', md: '09-30', fee: 10000 },
    { code: 'GSTR9', name: 'GSTR-9 · GST annual return', short: 'GSTR-9', cat: 'GST', applies: ['Any'], kind: 'annual', md: '12-31', fee: 6000, late: { perDay: 200 } },
    { code: 'TDS', name: 'TDS returns 24Q / 26Q (quarterly)', short: 'TDS', cat: 'TDS', applies: ['Any'], kind: 'tdsq', fee: 1500, late: { perDay: 200 } },
  ];
  const FIL = Object.fromEntries(FILINGS.map((f) => [f.code, f]));

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
    settings: { firmName: 'Cloudbook Associates LLP', gstin: '', pan: '', address: '', phone: '', email: '', gstRate: 18, fyStartMonth: 4, invoiceDueDays: 15, defaultCostRate: 350, capacityHours: 160, invoicePrefix: 'INV-', jobPrefix: 'J-', fyTarget: 1000000 },
    team: [{ id: 'm_owner', name: 'Aravind A S', role: 'Designated Partner', costRate: 500, billRate: 1200, capacity: 160, active: true }],
    services: DEFAULT_SERVICES.map(([name, category, recurring, fee, hours]) => ({ id: uid('s'), name, category, recurring, fee, hours })),
    clients: [], jobs: [], time: [], invoices: [], filings: [], expenses: [],
    seq: { job: 0, invoice: 0 },
    started: false,
  });
  let storageOk = true;
  let loadError = false;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try { S = migrate(JSON.parse(raw)); return; }
        catch (err) { try { localStorage.setItem(KEY + '.unreadable-' + Date.now(), raw); } catch (e2) { /* storage full */ } loadError = true; }
      }
    } catch (e) { storageOk = false; }
    S = blank();
  }
  // ---------- Data validation ----------
  // Every record is checked and coerced on load and import, so a damaged or tampered backup
  // can neither inject markup (ids are restricted to safe characters) nor crash the app.
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const okId = (v) => typeof v === 'string' && ID_RE.test(v);
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const COLLECTIONS = ['team', 'services', 'clients', 'jobs', 'time', 'invoices', 'filings', 'expenses'];
  const REFS = { jobs: ['clientId', 'ownerId', 'invoiceId', 'nextId', 'filingId'], time: ['jobId', 'memberId'], invoices: ['clientId'], filings: ['clientId', 'jobId'], expenses: ['clientId', 'jobId', 'invoiceId', 'filingId'] };
  const TEXT = ['name', 'title', 'period', 'service', 'notes', 'description', 'ref', 'number', 'code', 'category', 'paidBy', 'mode', 'role', 'contact', 'phone', 'email', 'gstin', 'pan', 'city', 'type', 'srn', 'key', 'note', 'priority', 'recurring'];
  const NUMS = ['fee', 'budgetHours', 'govtFees', 'govtFee', 'hours', 'costRate', 'billRate', 'capacity', 'amount', 'tds', 'gst', 'reimb', 'total'];
  const DATES = ['date', 'due', 'start', 'doneOn', 'dueDate', 'filedOn', 'created'];
  // Returns a list of problems that make a file unsafe to import (bad ids or references).
  function unsafeIds(d) {
    const bad = [];
    COLLECTIONS.forEach((k) => (Array.isArray(d[k]) ? d[k] : []).forEach((r, n) => {
      if (!isObj(r)) return;
      if (!okId(r.id)) bad.push(`${k}[${n}].id`);
      (REFS[k] || []).forEach((f) => { if (r[f] != null && r[f] !== '' && !okId(r[f])) bad.push(`${k}[${n}].${f}`); });
      if (k === 'invoices') { (Array.isArray(r.jobIds) ? r.jobIds : []).forEach((x) => { if (!okId(x)) bad.push(`${k}[${n}].jobIds`); }); (Array.isArray(r.payments) ? r.payments : []).forEach((p) => { if (isObj(p) && !okId(p.id)) bad.push(`${k}[${n}].payments`); }); }
    }));
    return bad;
  }
  function cleanRecord(r, k) {
    const o = Object.create(null);
    Object.keys(r).forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      const v = r[key];
      if (Array.isArray(v)) { o[key] = v; return; }
      if (v !== null && typeof v === 'object') return;
      if (TEXT.includes(key)) o[key] = v == null ? '' : String(v);
      else if (NUMS.includes(key)) o[key] = num(v);
      else if (DATES.includes(key)) o[key] = typeof v === 'string' && DATE_RE.test(v) ? v : null;
      else if ((REFS[k] || []).includes(key)) o[key] = okId(v) ? v : null;
      else o[key] = v;
    });
    return Object.assign({}, o);
  }
  function migrate(d) {
    const b = blank();
    if (!isObj(d)) d = {};
    const st = isObj(d.settings) ? d.settings : {};
    const settings = {};
    Object.keys(b.settings).forEach((k) => { const v = st[k]; settings[k] = typeof b.settings[k] === 'number' ? (v === '' || v == null || !isFinite(parseFloat(v)) ? b.settings[k] : num(v)) : (v == null ? b.settings[k] : String(v)); });
    if (typeof st.lastBackup === 'string' && DATE_RE.test(st.lastBackup)) settings.lastBackup = st.lastBackup;
    d.settings = settings;
    COLLECTIONS.forEach((k) => {
      const arr = Array.isArray(d[k]) ? d[k] : [];
      d[k] = arr.filter((r) => isObj(r) && okId(r.id)).map((r) => cleanRecord(r, k));
    });
    d.jobs.forEach((j) => { if (!JOB_STATUS.includes(j.status)) j.status = 'Not started'; if (!BILLING.includes(j.billing)) j.billing = 'Not billed'; if (!RECUR.some((x) => x[0] === j.recurring)) j.recurring = 'none'; });
    d.time = d.time.filter((t) => t.date && t.jobId);
    d.invoices.forEach((i) => { if (!i.date) i.date = todayISO(); });
    d.filings = d.filings.filter((f) => FIL[f.code]).map((f) => { if (!FILING_STATUS.includes(f.status)) f.status = 'Pending'; if (!f.due) f.due = todayISO(); return f; });
    d.expenses.forEach((e) => { if (!e.date) e.date = todayISO(); e.recover = e.recover !== false; });
    d.team.forEach((m) => { m.active = m.active !== false; });
    if (!d.team.length) d.team = b.team;
    // Older versions kept "govt fees to recover" as a number on jobs and filings. Turn those into expense records once.
    d.jobs.forEach((j) => {
      if (num(j.govtFees) > 0 && !j.govtMigrated) {
        if (!d.expenses.some((e) => e.id === 'x_' + j.id)) d.expenses.push({ id: 'x_' + j.id, date: j.doneOn || j.start || todayISO(), clientId: j.clientId, jobId: j.id, category: 'Government / statutory fee', description: 'Govt fees / challans for ' + j.title, amount: num(j.govtFees), recover: true, paidBy: 'Firm bank account', ref: '', invoiceId: j.billing === 'Billed' ? j.invoiceId || null : null, notes: 'Moved from the job’s govt fees field' });
        j.govtFees = 0; j.govtMigrated = true;
      }
    });
    d.filings.forEach((f) => {
      if (num(f.govtFee) > 0) {
        if (!d.expenses.some((e) => e.id === 'x_' + f.id)) d.expenses.push({ id: 'x_' + f.id, date: f.filedOn || f.due || todayISO(), clientId: f.clientId, jobId: f.jobId || null, filingId: f.id, category: 'Late fee / interest (GST, TDS, ROC)', description: 'Govt / late fee for ' + f.code + ' ' + f.period, amount: num(f.govtFee), recover: true, paidBy: 'Firm bank account', ref: f.srn || '', invoiceId: null, notes: '' });
        f.govtFee = 0;
      }
    });
    d.clients.forEach((c) => { c.filingCodes = (Array.isArray(c.filingCodes) ? c.filingCodes : []).filter((x) => typeof x === 'string' && FIL[x]); });
    const sq = isObj(d.seq) ? d.seq : {};
    d.seq = { job: num(sq.job), invoice: num(sq.invoice) };
    d.invoices.forEach((i) => {
      i.payments = (Array.isArray(i.payments) ? i.payments : []).filter((p) => isObj(p) && okId(p.id)).map((p) => cleanRecord(p, 'payments'));
      i.payments.forEach((p) => { if (!p.date) p.date = i.date; });
      i.jobIds = (Array.isArray(i.jobIds) ? i.jobIds : []).filter(okId);
    });
    d.started = !!d.started;
    return d;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
      cloudSchedule();
      footStatus();
      scheduleAutoBackup();
    }, 150);
  }
  function footStatus() {
    const f = $('#nav-foot'); if (!f) return;
    const t = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (CL) { f.textContent = cloudLabel(); f.dataset.sync = SY.state; return; }
    f.textContent = !storageOk ? 'Not saved: browser storage is blocked' : AB.state === 'on' ? `Saved · Excel backup ${AB.lastAt ? AB.lastAt : 'on'}` : 'Saved in this browser · ' + t;
  }

  // ---------- Online sync (Supabase) ----------
  // The whole firm's data is one versioned record online. Each change is saved in this browser first,
  // then sent online about a second later. A save only succeeds if nobody else saved in between;
  // otherwise the user chooses which version to keep, so nothing is overwritten silently.
  const CL = window.CloudbookCloud || null;
  const META = KEY + '.cloud';
  const SY = { ready: false, version: 0, dirty: false, busy: false, timer: null, retry: null, state: CL ? 'connecting' : 'off', lastAt: null, booted: false };
  const hhmm = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  function cloudLabel() {
    const xl = AB.state === 'on' ? ' · Excel backup on' : '';
    if (SY.state === 'saving' || (SY.state === 'saved' && SY.dirty)) return 'Saving online…';
    if (SY.state === 'saved') return `Saved online${SY.lastAt ? ' · ' + hhmm(SY.lastAt) : ''}${xl}`;
    if (SY.state === 'offline') return 'Offline · kept in this browser, will save online when connected';
    if (SY.state === 'auth') return 'Not saved online · sign in again';
    if (SY.state === 'conflict') return 'Waiting for your choice';
    return 'Connecting…';
  }
  function metaSave() { try { localStorage.setItem(META, JSON.stringify({ firm: CL.firm, user: CL.user?.id || null, version: SY.version, dirty: SY.dirty })); } catch (e) { /* storage blocked */ } }
  function metaLoad() { try { return JSON.parse(localStorage.getItem(META) || 'null') || {}; } catch (e) { return {}; } }
  function writeLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } metaSave(); }
  function cloudSchedule() {
    if (!CL || !SY.ready) return;
    SY.dirty = true; metaSave();
    clearTimeout(SY.timer); SY.timer = setTimeout(cloudPush, 1200);
  }
  async function cloudPush() {
    if (!CL || !SY.ready || SY.busy || !SY.dirty) return;
    clearTimeout(SY.retry);
    const prevState = SY.state;
    SY.busy = true; SY.dirty = false; SY.state = 'saving'; footStatus();
    const snap = JSON.parse(JSON.stringify(S));
    try {
      const r = await CL.push(snap, SY.version);
      if (r.conflict) { SY.busy = false; SY.dirty = true; metaSave(); cloudConflict(); return; }
      SY.version = r.version; SY.state = 'saved'; SY.lastAt = new Date();
    } catch (e) {
      SY.dirty = true;
      if (e.kind === 'auth') { SY.busy = false; SY.state = 'auth'; metaSave(); footStatus(); showLogin('Your session has ended. Sign in again to keep saving online. Your changes are kept in this browser.'); return; }
      SY.state = 'offline'; SY.retry = setTimeout(cloudPush, 20000);
    }
    SY.busy = false; metaSave(); footStatus();
    if (SY.dirty && SY.state === 'saved') { clearTimeout(SY.timer); SY.timer = setTimeout(cloudPush, 600); }
    if (SY.state !== prevState && (SY.state === 'offline' || prevState === 'offline')) render();
  }
  function lockedModal(title, body, foot) {
    $('#modal-root').innerHTML = `<div class="modal-bg"><div class="modal" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3></div><div class="modal-b"><div class="field full">${body}</div></div><div class="modal-f">${foot}</div></div></div>`;
    const b = $('#modal-root .modal-f .btn.primary'); if (b) setTimeout(() => b.focus(), 30);
  }
  async function cloudConflict(latest) {
    SY.state = 'conflict'; footStatus();
    if (!latest) {
      try { latest = await CL.pull(); } catch (e) { SY.state = 'offline'; footStatus(); SY.retry = setTimeout(cloudPush, 20000); return; }
    }
    const when = latest.updatedAt ? new Date(latest.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'recently';
    lockedModal('Changed on another device',
      `<p style="margin:0 0 10px">The online data was changed from another computer, phone or browser tab (last saved ${esc(when)}) while this page had changes that were not yet saved online.</p>
       <p style="margin:0 0 10px"><b>Keep this version</b> saves what you see on this page and replaces the online copy.</p>
       <p class="t-muted" style="margin:0"><b>Use the online version</b> loads the other device’s data. The changes on this page are set aside in this browser, not lost.</p>`,
      '<button class="btn" data-act="cloudUseLatest">Use the online version</button><button class="btn primary" data-act="cloudKeepMine">Keep this version</button>');
    ACT.cloudUseLatest = () => {
      try { localStorage.setItem(KEY + '.set-aside-' + Date.now(), JSON.stringify(S)); } catch (e) { /* storage full */ }
      S = migrate(latest.data); SY.version = latest.version; SY.dirty = false; SY.state = 'saved'; SY.lastAt = new Date();
      writeLocal(); closeModal(); render(); toast('Loaded the latest online version');
    };
    ACT.cloudKeepMine = () => { SY.version = latest.version; SY.dirty = true; SY.state = 'saving'; closeModal(); cloudPush(); };
  }
  function showLogin(msg, busy) {
    SY.ready = false;
    $('#app').hidden = true; closeModal();
    let el = document.getElementById('login');
    if (!el) { el = document.createElement('main'); el.id = 'login'; el.className = 'login'; document.body.appendChild(el); }
    el.hidden = false;
    el.innerHTML = `<form class="login-card" id="login-form" novalidate>
      <img class="brand-logo light" src="assets/logo.png" alt="Cloudbook Associates LLP" width="398" height="101"><img class="brand-logo dark" src="assets/logo-dark.png" alt="Cloudbook Associates LLP" width="398" height="101">
      <h1>${busy ? 'Opening your desk…' : 'Sign in to Cloudbook Desk'}</h1>
      <p class="t-muted login-msg">${esc(msg || 'Your firm’s data is stored securely online. Sign in with the login set up for you.')}</p>
      ${busy ? '' : `<div class="field"><label for="login-email">Email</label><input class="input" id="login-email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="login-pw">Password</label><input class="input" id="login-pw" name="password" type="password" autocomplete="current-password" required></div>
      <p class="login-err" role="alert"></p>
      <button class="btn primary" type="submit">Sign in</button>`}
    </form>`;
    const em = document.getElementById('login-email'); if (em) { if (CL.user?.email) em.value = CL.user.email; setTimeout(() => (em.value ? document.getElementById('login-pw') : em).focus(), 30); }
  }
  function hideLogin() { const el = document.getElementById('login'); if (el) { el.hidden = true; el.innerHTML = ''; } $('#app').hidden = false; }
  async function doLogin(f) {
    const btn = f.querySelector('button[type=submit]'), err = f.querySelector('.login-err');
    const email = f.email.value.trim(), pw = f.password.value;
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true; btn.textContent = 'Signing in…'; err.textContent = '';
    try { await CL.signIn(email, pw); f.password.value = ''; await cloudStart(); }
    catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = 'Sign in'; }
  }
  function cloudReady() {
    SY.ready = true; hideLogin(); metaSave(); render(); footStatus();
    if (!SY.booted) { SY.booted = true; initAutoBackup(); }
    if (SY.dirty) cloudPush();
  }
  async function cloudStart() {
    showLogin('Loading your data from the online database…', true);
    const meta = metaLoad();
    const localOk = meta.firm === CL.firm && S.started;
    let r;
    try { r = await CL.pull(); }
    catch (e) {
      if (e.kind === 'auth') return showLogin(e.message);
      if (localOk) { SY.version = Number(meta.version) || 0; SY.dirty = !!meta.dirty; SY.state = 'offline'; cloudReady(); SY.retry = setTimeout(cloudPush, 20000); toast('Offline: working from this browser’s copy'); return; }
      return showLogin(e.message + ' Then try again.');
    }
    if (r.notMember) { await CL.signOut(); return showLogin('This login is not linked to the firm yet. Ask the firm owner to add you, then sign in again.'); }
    const empty = !r.data || !Array.isArray(r.data.clients);
    if (empty) {
      SY.version = r.version;
      const n = S.clients.length + S.jobs.length + S.invoices.length;
      if (S.started && n) {
        hideLogin(); render();
        lockedModal('Move your data online?', `<p style="margin:0 0 10px">The online database is empty. This browser has <b>${S.clients.length} clients, ${S.jobs.length} jobs and ${S.invoices.length} invoices</b>.</p><p class="t-muted" style="margin:0">Upload them now so they are saved online and available when you sign in anywhere.</p>`,
          '<button class="btn" data-act="cloudStartEmpty">Start empty online</button><button class="btn primary" data-act="cloudUpload">Upload this data</button>');
        ACT.cloudUpload = () => { closeModal(); SY.dirty = true; cloudReady(); };
        ACT.cloudStartEmpty = () => { closeModal(); S = blank(); writeLocal(); cloudReady(); };
        return;
      }
      SY.dirty = false; SY.state = 'saved'; cloudReady(); return;
    }
    if (meta.firm === CL.firm && meta.dirty && S.started) {
      if (Number(meta.version) === r.version) { SY.version = r.version; SY.dirty = true; SY.state = 'saving'; cloudReady(); return; }
      SY.version = Number(meta.version) || 0; SY.dirty = true; hideLogin(); SY.ready = true; render(); cloudConflict(r); if (!SY.booted) { SY.booted = true; initAutoBackup(); } return;
    }
    S = migrate(r.data); SY.version = r.version; SY.dirty = false; SY.state = 'saved'; SY.lastAt = r.updatedAt ? new Date(r.updatedAt) : null;
    writeLocal(); cloudReady();
  }
  async function cloudRefresh(quiet) {
    if (!CL || !SY.ready || SY.busy || SY.dirty || $('#modal-root').innerHTML) return;
    try {
      const v = await CL.version();
      if (v == null || v <= SY.version) { if (!quiet) toast('Already up to date'); if (SY.state === 'offline') { SY.state = 'saved'; footStatus(); } return; }
      const r = await CL.pull();
      if (SY.dirty || SY.busy || r.notMember || r.version <= SY.version) return;
      S = migrate(r.data); SY.version = r.version; SY.state = 'saved'; SY.lastAt = r.updatedAt ? new Date(r.updatedAt) : new Date();
      writeLocal(); render(); toast('Updated with the latest changes from another device');
    } catch (e) { if (!quiet) toast(e.message); }
  }
  if (CL) {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cloudRefresh(true); });
    window.addEventListener('online', () => { if (SY.dirty) cloudPush(); else cloudRefresh(true); });
    window.addEventListener('beforeunload', (e) => { if (SY.ready && (SY.dirty || SY.busy)) { e.preventDefault(); e.returnValue = ''; } });
  }

  // ---------- Excel backup ----------
  // Workbook with one readable sheet per table, plus a "_backup" sheet holding the full data
  // so the same .xlsx file can be imported back.
  const AB = { state: 'off', dir: null, timer: null, lastAt: null, busy: false };
  function buildWorkbook() {
    if (!window.XLSX) throw new Error('Excel library did not load. Check the internet connection and reload.');
    const X = window.XLSX, wb = X.utils.book_new();
    const add = (name, rows, widths) => { const ws = X.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records' }]); if (widths) ws['!cols'] = widths.map((w) => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    const fy = fyOf();
    const invs = S.invoices.map((i) => ({ i, st: invStats(i) }));
    add('Summary', [
      { Item: 'Firm', Value: S.settings.firmName }, { Item: 'Backup taken', Value: new Date().toLocaleString('en-IN') },
      { Item: 'Financial year', Value: 'FY ' + fy.label },
      { Item: 'Fees billed this FY (excl. GST)', Value: round2(sum(S.invoices.filter((i) => inRange(i.date, fy)), (i) => i.fee)) },
      { Item: 'Receivables', Value: round2(sum(invs, (x) => x.st.balance)) },
      { Item: 'Finished work not invoiced', Value: round2(sum(S.jobs.filter(readyToBill), (j) => j.fee)) },
      { Item: 'Expenses to recover', Value: round2(sum(S.expenses.filter(expToRecover), (e) => e.amount)) },
      { Item: 'Overdue filings', Value: S.filings.filter(filingOverdue).length },
      { Item: 'Clients / jobs / invoices / expenses / filings', Value: [S.clients.length, S.jobs.length, S.invoices.length, S.expenses.length, S.filings.length].join(' / ') },
      { Item: 'To restore', Value: 'Cloudbook Desk → Settings & data → Restore or import → choose this .xlsx file' },
    ], [44, 60]);
    add('Clients', S.clients.map((c) => ({ Name: c.name, Type: c.type, Contact: c.contact, Phone: c.phone, Email: c.email, GSTIN: c.gstin, PAN: c.pan, City: c.city, 'Filings handled': (c.filingCodes || []).map((x) => FIL[x]?.short || x).join(', '), Notes: c.notes })), [36, 16, 22, 14, 26, 18, 12, 16, 40, 30]);
    add('Jobs', S.jobs.map((j) => { const st = jobStats(j); const inv = j.invoiceId ? byId(S.invoices, j.invoiceId) : null; return { Code: j.code, Client: client(j.clientId).name, Job: j.title, Service: j.service, Period: j.period, Owner: member(j.ownerId)?.name || '', Start: j.start, Due: j.due, Status: j.status, 'Completed on': j.doneOn || '', 'Fee (excl GST)': num(j.fee), 'Budget hours': num(j.budgetHours), 'Hours logged': round2(st.hours), Cost: Math.round(st.cost), Margin: Math.round(st.margin), 'Margin %': st.marginPct == null ? '' : round2(st.marginPct * 100), 'Cost estimated': st.estimated ? 'Yes' : 'No', Billing: j.billing, Invoice: inv ? inv.number : '', Repeats: j.recurring, Notes: j.notes }; }), [9, 32, 40, 30, 16, 16, 11, 11, 16, 12, 12, 10, 10, 10, 10, 9, 10, 11, 13, 10, 30]);
    add('Timesheet', S.time.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => { const j = job(e.jobId); return { Date: e.date, Person: member(e.memberId)?.name || '', Client: j ? client(j.clientId).name : '', Job: j ? j.title : '(deleted)', Hours: num(e.hours), 'Cost / hour': rateOf(e), Cost: Math.round(num(e.hours) * rateOf(e)), 'Work done': e.note }; }), [11, 18, 32, 40, 7, 10, 10, 40]);
    add('Invoices', invs.sort((a, b) => a.i.date.localeCompare(b.i.date)).map(({ i, st }) => ({ Number: i.number, Client: client(i.clientId).name, Date: i.date, Due: i.dueDate, 'Fee (excl GST)': num(i.fee), GST: num(i.gst), Reimbursements: num(i.reimb), Total: num(i.total), 'Received (bank)': round2(st.cash), 'TDS by client': round2(st.tds), Balance: st.balance, Status: st.status, Notes: i.notes })), [13, 32, 11, 11, 13, 10, 13, 11, 13, 11, 10, 10, 40]);
    add('Payments', S.invoices.flatMap((i) => i.payments.map((p) => ({ Invoice: i.number, Client: client(i.clientId).name, Date: p.date, Mode: p.mode, Amount: num(p.amount), TDS: num(p.tds), Reference: p.ref }))).sort((a, b) => String(a.Date).localeCompare(String(b.Date))), [13, 32, 11, 14, 11, 9, 24]);
    add('Expenses', S.expenses.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => { const j = e.jobId ? job(e.jobId) : null; const inv = e.invoiceId ? byId(S.invoices, e.invoiceId) : null; return { Date: e.date, Client: client(e.clientId).name, Job: j ? j.title : '', Type: e.category, Description: e.description, 'Challan / SRN': e.ref, 'Paid from': e.paidBy, Amount: num(e.amount), 'Recover from client': e.recover ? 'Yes' : 'No', Status: expStatus(e), Invoice: inv ? inv.number : '', Notes: e.notes }; }), [11, 32, 32, 30, 40, 18, 18, 10, 10, 11, 13, 30]);
    add('Filings', S.filings.slice().sort((a, b) => a.due.localeCompare(b.due)).map((f) => ({ Client: client(f.clientId).name, Filing: FIL[f.code]?.name || f.code, Period: f.period, Due: f.due, Status: filingOverdue(f) ? 'Overdue' : f.status, 'Filed on': f.filedOn || '', SRN: f.srn, Fee: num(f.fee), 'Late fee so far (est.)': lateFee(f), Notes: f.notes })), [32, 36, 18, 11, 12, 11, 14, 9, 12, 40]);
    add('Team', S.team.map((m) => ({ Name: m.name, Role: m.role, 'Cost / hour': num(m.costRate), 'Bill rate / hour': num(m.billRate), 'Hours / month': num(m.capacity), Active: m.active === false ? 'No' : 'Yes' })), [20, 20, 11, 13, 12, 7]);
    add('Services', S.services.map((x) => ({ Service: x.name, Category: x.category, Repeats: x.recurring, 'Standard fee': num(x.fee), 'Budget hours': num(x.hours) })), [40, 14, 10, 12, 12]);
    const json = JSON.stringify({ ...S, exportedAt: new Date().toISOString(), app: 'cloudbook-desk' });
    const chunks = []; for (let k = 0; k < json.length; k += 30000) chunks.push([json.slice(k, k + 30000)]);
    const raw = X.utils.aoa_to_sheet([['cloudbook-desk-backup v1 — do not edit this sheet'], ...chunks]);
    X.utils.book_append_sheet(wb, raw, '_backup');
    wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ name: n, Hidden: n === '_backup' ? 1 : 0 })) };
    return wb;
  }
  const xlsxBytes = () => window.XLSX.write(buildWorkbook(), { type: 'array', bookType: 'xlsx' });
  // Restore reads only the hidden "_backup" sheet with a small, strict ZIP/XML reader of our own,
  // so a spreadsheet parser never runs on an untrusted file.
  async function readExcelBackup(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u8.length > 30e6) throw new Error('That Excel file is too large to be a Cloudbook Desk backup.');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This is not a valid .xlsx file.');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const files = {};
    for (let n = 0; n < count && n < 2000; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('This .xlsx file is damaged.');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = { method, csize, off };
      p += 46 + nlen + xlen + clen;
    }
    const read = async (name) => {
      const f = files[name]; if (!f) return null;
      const lh = f.off, data = u8.subarray(lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true)).subarray(0, f.csize);
      if (f.method === 0) return new TextDecoder().decode(data);
      if (f.method !== 8 || typeof DecompressionStream !== 'function') throw new Error('This browser cannot read this Excel file. Use a JSON backup instead.');
      const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
      return out.text();
    };
    const unxml = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
    const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join('');
    const sstXml = await read('xl/sharedStrings.xml');
    const sst = sstXml ? [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : [];
    for (const name of Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      const xml = await read(name);
      const cells = [...xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((m) => {
        const t = (/\st="(\w+)"/.exec(' ' + m[1]) || [])[1], body = m[2] || '';
        if (t === 's') { const v = /<v>(\d+)<\/v>/.exec(body); return v ? sst[+v[1]] || '' : ''; }
        if (t === 'inlineStr') return texts(body);
        const v = /<v>([\s\S]*?)<\/v>/.exec(body); return v ? unxml(v[1]) : '';
      });
      if (cells.length && String(cells[0]).startsWith('cloudbook-desk-backup v1')) return cells.slice(1).join('');
    }
    throw new Error('This Excel file has no Cloudbook Desk backup sheet. Use an Excel backup made by this app.');
  }
  const xlsxName = (dated) => `Cloudbook-Desk-${dated ? todayISO() : 'latest'}.xlsx`;
  // Tiny IndexedDB store for the backup folder handle (handles can't go in localStorage).
  const idb = (mode, fn) => new Promise((res, rej) => {
    const req = indexedDB.open('cloudbook-desk', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => rej(req.error);
    req.onsuccess = () => { const tx = req.result.transaction('kv', mode); const r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); };
  });
  const canAutoBackup = () => typeof window.showDirectoryPicker === 'function' && window.self === window.top;
  async function initAutoBackup() {
    if (!canAutoBackup()) { AB.state = 'unsupported'; return; }
    try {
      const h = await idb('readonly', (st) => st.get('backupDir'));
      if (!h) { AB.state = 'off'; return; }
      AB.dir = h;
      const perm = await h.queryPermission({ mode: 'readwrite' });
      AB.state = perm === 'granted' ? 'on' : 'paused';
      try { AB.lastAt = localStorage.getItem('cloudbook-desk.autobackup.last'); } catch (e) { /* storage blocked */ }
    } catch (e) { AB.state = 'off'; }
    footStatus(); render();
  }
  async function writeAutoBackup() {
    if (AB.state !== 'on' || !AB.dir) return;
    if (AB.busy) { scheduleAutoBackup(); return; }
    if (!S.clients.length && !S.jobs.length && !S.invoices.length) return; // never overwrite a good backup with an empty one
    AB.busy = true;
    try {
      const bytes = xlsxBytes();
      for (const name of [xlsxName(false), xlsxName(true)]) {
        const fh = await AB.dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable(); await w.write(bytes); await w.close();
      }
      AB.lastAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      try { localStorage.setItem('cloudbook-desk.autobackup.last', AB.lastAt + ', ' + fmtDs(todayISO())); } catch (e) { /* storage blocked */ }
      if (S.settings.lastBackup !== todayISO()) { S.settings.lastBackup = todayISO(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }
    } catch (e) {
      console.error(e); AB.state = 'paused'; render();
    }
    AB.busy = false; footStatus();
  }
  // Before a replace or wipe, keep a one-off snapshot so the latest backup can't be lost.
  async function snapshotBackup(label) {
    if (AB.state !== 'on' || !AB.dir || (!S.clients.length && !S.jobs.length && !S.invoices.length)) return;
    try {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const fh = await AB.dir.getFileHandle(`Cloudbook-Desk-${label}-${stamp}.xlsx`, { create: true });
      const w = await fh.createWritable(); await w.write(xlsxBytes()); await w.close();
    } catch (e) { console.error(e); }
  }
  function scheduleAutoBackup() { if (AB.state !== 'on') return; clearTimeout(AB.timer); AB.timer = setTimeout(writeAutoBackup, 3000); }
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

  const expStatus = (e) => (!e.recover ? 'Absorbed' : e.invoiceId && byId(S.invoices, e.invoiceId) ? 'Billed' : 'To recover');
  const expToRecover = (e) => expStatus(e) === 'To recover';
  function expChip(e) {
    const st = expStatus(e);
    if (st === 'Billed') { const i = byId(S.invoices, e.invoiceId); return `<span class="chip acc">Billed · ${esc(i.number)}</span>`; }
    if (st === 'Absorbed') return '<span class="chip">Firm’s cost</span>';
    const age = -daysFrom(e.date);
    return `<span class="chip ${age > 30 ? 'bad' : 'warn'}">To recover${age > 0 ? ' · ' + age + 'd' : ''}</span>`;
  }
  function jobStats(j) {
    const es = S.time.filter((t) => t.jobId === j.id);
    const jx = S.expenses.filter((e) => e.jobId === j.id);
    const absorbed = sum(jx.filter((e) => !e.recover), (e) => e.amount);
    const recoverable = sum(jx.filter(expToRecover), (e) => e.amount);
    const hours = sum(es, (e) => e.hours);
    const costActual = sum(es, (e) => num(e.hours) * rateOf(e));
    const billValue = sum(es, (e) => num(e.hours) * num(member(e.memberId)?.billRate));
    const estimated = hours === 0;
    const useHours = estimated ? num(j.budgetHours) : hours;
    const timeCost = estimated ? useHours * num(S.settings.defaultCostRate) : costActual;
    const cost = timeCost + absorbed;
    const fee = num(j.fee);
    return {
      hours, useHours, cost, timeCost, absorbed, recoverable, estimated, billValue, fee,
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

  // ---------- Compliance ----------
  const yy = (y) => String(y % 100).padStart(2, '0');
  const fyStr = (y) => `FY ${y}-${yy(y + 1)}`;
  // Instances of a filing whose due date falls inside the compliance year starting in April of y1.
  function filingInstances(code, y1) {
    const f = FIL[code]; if (!f) return [];
    if (f.kind === 'tdsq') {
      return [
        { period: `Q4 ${fyStr(y1 - 1)}`, due: `${y1}-05-31` },
        { period: `Q1 ${fyStr(y1)}`, due: `${y1}-07-31` },
        { period: `Q2 ${fyStr(y1)}`, due: `${y1}-10-31` },
        { period: `Q3 ${fyStr(y1)}`, due: `${y1 + 1}-01-31` },
      ];
    }
    return [{ period: fyStr(y1 - 1), due: `${y1}-${f.md}` }];
  }
  const filingKey = (clientId, code, period) => `${clientId}|${code}|${period}`;
  const filingDone = (f) => f.status === 'Filed' || f.status === 'Not applicable';
  const filingOverdue = (f) => !filingDone(f) && f.due && f.due < todayISO();
  function lateFee(f) {
    const L = FIL[f.code]?.late; if (!L || !filingOverdue(f)) return 0;
    if (L.flat) return L.flat;
    return Math.max(0, -daysFrom(f.due)) * L.perDay;
  }
  function filingChip(f, short) {
    if (f.status === 'Filed') return `<span class="chip ok">${short ? 'Filed' : 'Filed' + (f.filedOn ? ' ' + fmtDs(f.filedOn) : '')}</span>`;
    if (f.status === 'Not applicable') return '<span class="chip">N/A</span>';
    const d = daysFrom(f.due);
    if (d < 0) return `<span class="chip bad">${short ? -d + 'd late' : 'Overdue · ' + -d + 'd'}</span>`;
    if (d <= 15) return `<span class="chip warn">${short ? 'Due ' + fmtDs(f.due) : 'Due in ' + d + 'd'}</span>`;
    return `<span class="chip ${f.status === 'In progress' ? 'info' : ''}">${short ? fmtDs(f.due) : esc(f.status) + ' · ' + fmtDs(f.due)}</span>`;
  }
  function generateFilings(y1, onlyClient) {
    let n = 0;
    S.clients.filter((c) => (!onlyClient || c.id === onlyClient) && c.filingCodes && c.filingCodes.length).forEach((c) => {
      c.filingCodes.forEach((code) => {
        filingInstances(code, y1).forEach((ins) => {
          const key = filingKey(c.id, code, ins.period);
          if (S.filings.some((f) => f.key === key)) return;
          S.filings.push({ id: uid('f'), key, clientId: c.id, code, period: ins.period, due: ins.due, status: 'Pending', fee: FIL[code].fee, govtFee: 0, srn: '', filedOn: null, jobId: null, notes: '' });
          n++;
        });
      });
    });
    return n;
  }
  // Create (or update) the billing job behind a filing so it flows into "Ready to bill".
  function jobForFiling(f) {
    let j = f.jobId ? job(f.jobId) : null;
    const def = FIL[f.code];
    if (!j) {
      j = { id: uid('j'), code: nextJobCode(), clientId: f.clientId, title: `${def.short} – ${f.period}`, service: def.name, period: f.period, ownerId: S.team[0]?.id, start: todayISO(), due: f.due, status: 'Not started', priority: filingOverdue(f) ? 'High' : 'Normal', fee: num(f.fee), budgetHours: def.kind === 'tdsq' ? 2 : 3, govtFees: num(f.govtFee), recurring: 'none', billing: 'Not billed', invoiceId: null, notes: 'Created from the compliance tracker', doneOn: null, created: todayISO(), filingId: f.id };
      S.jobs.push(j); f.jobId = j.id;
    }
    if (f.status === 'Filed' && !isDone(j)) { j.status = DONE; j.doneOn = f.filedOn || todayISO(); }
    if (f.status === 'In progress' && j.status === 'Not started') j.status = 'In progress';
    if (j.billing === 'Not billed') { j.fee = num(f.fee); }
    S.expenses.forEach((e) => { if (e.filingId === f.id && !e.jobId) e.jobId = j.id; });
    return j;
  }
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
    comp: { y1: null, view: 'grid', status: 'open', client: '', cat: '' },
    exp: { q: '', status: 'To recover', client: '', cat: '', sort: 'date', dir: -1 },
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
    $('#brand-name').textContent = /cloudbook/i.test(S.settings.firmName || '') || !S.settings.firmName ? 'Practice desk' : S.settings.firmName;
    try {
    const od = S.jobs.filter(isOverdue).length;
    const b = $('#nav-overdue'); b.hidden = !od; b.textContent = od;
    const xo = S.expenses.filter((e) => expToRecover(e) && daysFrom(e.date) < -30).length; const bx = $('#nav-exp'); if (bx) { bx.hidden = !xo; bx.textContent = xo; bx.title = 'Expenses unrecovered for over 30 days'; }
    const fo = S.filings.filter(filingOverdue).length; const bf = $('#nav-filings'); if (bf) { bf.hidden = !fo; bf.textContent = fo; }
    } catch (e) { console.error(e); }
    let html = '';
    try { html = page(id); } catch (e) { console.error(e); html = `<div class="card card-b"><b>Something went wrong showing this page.</b><p class="t-muted">${esc(e.message)}</p></div>`; }
    view().innerHTML = banner() + html;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) { /* not a text field */ } } }
  }
  const shortFirm = () => (S.settings.firmName || 'Cloudbook Desk').replace(/\s+(LLP|Pvt\.? Ltd\.?|Private Limited)$/i, '');
  function banner() {
    if (loadError) return '<div class="banner">Saved data in this browser could not be read, so the app started empty. A copy was kept. Restore your latest Excel or JSON backup from Settings &amp; data.</div>';
    if (!storageOk) return '<div class="banner">This browser is blocking storage, so changes will be lost when you close the page. Export a backup from Settings &amp; data.</div>';
    if (CL && SY.state === 'offline') return '<div class="banner">Not connected to the online database. Your changes are kept in this browser and will be saved online when the connection is back. <button class="btn sm" data-act="cloudSyncNow">Try again</button></div>';
    if (CL && SY.state === 'auth') return '<div class="banner">Not saving online: your session has ended. <button class="btn sm" data-act="cloudRelogin">Sign in again</button></div>';
    if (AB.state === 'paused') return '<div class="banner">Automatic Excel backup is paused until you allow it again (the browser asks once per visit). <button class="btn sm" data-act="resumeBackup">Resume Excel backup</button></div>';
    const last = S.settings.lastBackup;
    const stale = !CL && AB.state !== 'on' && S.started && (!last || daysFrom(last) < -7) && S.jobs.length > 0;
    return stale ? `<div class="banner">Your data lives only in this browser. ${last ? 'Last backup ' + fmtD(last) + '.' : 'No backup taken yet.'} <button class="btn sm" data-act="backupXlsx">Download Excel backup</button>${canAutoBackup() ? ' <button class="btn sm" data-act="chooseBackupDir">Turn on automatic backup</button>' : ''}</div>` : '';
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
    const filOver = S.filings.filter(filingOverdue).sort((a, b) => a.due.localeCompare(b.due));

    const kpis = `<section class="kpis">
      <a class="kpi alert" href="#jobs" data-act="jobsReady"><span class="l">Finished, not invoiced</span><span class="v">${inrC(readyAmt)}</span><span class="s">${ready.length} job${ready.length === 1 ? '' : 's'} ready to bill</span></a>
      <a class="kpi ${arOver > 0 ? 'bad' : ''}" href="#invoices"><span class="l">Receivables</span><span class="v">${inrC(ar)}</span><span class="s">${inr(arOver)} past due</span></a>
      <a class="kpi good" href="#invoices"><span class="l">Collected this month</span><span class="v">${inrC(collMonth)}</span><span class="s">${inr(billedMonth)} billed this month</span></a>
      <a class="kpi" href="#reports"><span class="l">Fees billed, FY ${fy.label}</span><span class="v">${inrC(billedFY)}</span><span class="s">${pct(fyTotal ? fyRecv / fyTotal : null)} of FY billing collected</span></a>
      <a class="kpi" href="#reports"><span class="l">Margin on finished work</span><span class="v">${pct(feeD ? (feeD - costD) / feeD : null)}</span><span class="s">${inr(hD ? feeD / hD : null)} earned per hour</span></a>
      <a class="kpi ${overdue.length + filOver.length ? 'bad' : ''}" href="#compliance"><span class="l">Overdue jobs · filings</span><span class="v">${overdue.length} · ${filOver.length}</span><span class="s">${week.length} jobs due in the next 7 days</span></a>
    </section>`;

    const tabs = [
      ['overdue', 'Overdue', overdue.length],
      ['ready', 'Ready to bill', ready.length],
      ['late', 'Unpaid 30+ days', late.length],
      ['filings', 'Filings overdue', filOver.length],
      ['exp', 'Expenses to recover', S.expenses.filter(expToRecover).length],
      ['budget', 'Over budget', overBudget.length],
    ];
    let list = '';
    if (UI.att === 'overdue') list = overdue.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8).map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)} · ${esc(member(j.ownerId)?.name || 'Unassigned')}</small></div>${dueChip(j)}</li>`).join('');
    if (UI.att === 'ready') list = ready.sort((a, b) => num(b.fee) - num(a.fee)).slice(0, 8).map((j) => `<li><div class="what"><a href="#job/${j.id}"><b>${esc(j.title)}</b></a><small>${esc(client(j.clientId).name)}${j.doneOn ? ' · done ' + fmtDs(j.doneOn) : ''}</small></div><span class="amt">${inr(j.fee)}</span><button class="btn sm" data-act="newInvoice" data-client="${j.clientId}">Invoice</button></li>`).join('');
    if (UI.att === 'late') list = late.slice(0, 8).map((x) => `<li><div class="what"><a href="#invoice/${x.i.id}"><b>${esc(x.i.number)}</b></a><small>${esc(client(x.i.clientId).name)} · due ${fmtDs(x.i.dueDate)}</small></div><span class="amt">${inr(x.st.balance)}</span><span class="chip bad plain">${x.st.daysOver}d</span></li>`).join('');
    if (UI.att === 'filings') list = filOver.slice(0, 8).map((f) => `<li><div class="what"><a href="#compliance" data-act="filing" data-id="${f.id}"><b>${esc(FIL[f.code]?.name || f.code)}</b></a><small>${esc(client(f.clientId).name)} · ${esc(f.period)}</small></div>${lateFee(f) ? `<span class="amt t-bad">≈ ${inr(lateFee(f))}</span>` : ''}${filingChip(f, true)}</li>`).join('');
    if (UI.att === 'exp') { const g = Object.create(null); S.expenses.filter(expToRecover).forEach((e) => { const o = g[e.clientId] || (g[e.clientId] = { n: 0, amt: 0, oldest: e.date }); o.n++; o.amt += num(e.amount); if (e.date < o.oldest) o.oldest = e.date; }); list = Object.entries(g).sort((a, b) => b[1].amt - a[1].amt).slice(0, 8).map(([cid, o]) => `<li><div class="what"><a href="#client/${cid}"><b>${esc(client(cid).name)}</b></a><small>${o.n} expense${o.n === 1 ? '' : 's'} · oldest ${fmtDs(o.oldest)}</small></div><span class="amt">${inr(o.amt)}</span><button class="btn sm" data-act="newInvoice" data-client="${cid}">Invoice</button></li>`).join(''); }
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
    return `<div class="card welcome"><div class="card-b" style="padding:32px">
      <div class="eyebrow">${esc(S.settings.firmName)}</div>
      <h2 style="margin:6px 0 8px;font-size:24px;letter-spacing:-.02em">Your practice, from first call to cash in the bank</h2>
      <p class="t-muted" style="max-width:60ch;margin:0 0 22px">Track every client job and statutory filing, the hours it took, what it cost, what you billed and what is still unpaid. Start with sample data to look around, or begin with your own clients.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" data-act="start">Start with my own data</button>
        ${CL ? '' : '<button class="btn" data-act="demo">Explore with sample data</button>'}
        <button class="btn" data-act="goImport">Restore a backup</button>
      </div></div>
      <div class="side"><b>Getting set up</b><ol style="margin:0;padding-left:18px;line-height:1.7">
        <li>Firm details and cost rates in <a href="#settings">Settings</a> and <a href="#team">Team &amp; services</a></li>
        <li>Add your <a href="#clients">clients</a> and the filings you handle for them</li>
        <li>Open a job for each piece of work, log time as you go</li>
        <li>Record expenses paid for clients</li>
        <li>Raise invoices when work is done, record payments and TDS</li>
        <li>Turn on automatic Excel backup</li></ol></div></div>`;
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
          <div><span>Expenses to recover</span><b class="${st.recoverable ? 't-warn' : ''}">${inr(st.recoverable)}</b></div>
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
            <div class="box"><span>Cost${st.estimated ? ' (time est.)' : ''}</span><b>${inr(st.cost)}</b>${st.absorbed ? `<span>time ${inr(st.timeCost)} + firm’s expenses ${inr(st.absorbed)}</span>` : ''}</div>
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
      ${expCard(S.expenses.filter((e) => e.jobId === j.id), { client: j.clientId, job: j.id })}
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
    const fils = S.filings.filter((f) => !filingDone(f) && f.due && daysFrom(f.due) <= 45).sort((a, b) => a.due.localeCompare(b.due));
    const filCard = fils.length ? `<div class="card"><div class="card-h"><h2>Client filings due or overdue</h2><span class="hint">From the compliance tracker · next 45 days and anything late</span><span class="right"><a class="btn sm" href="#compliance">Compliance</a></span></div>
      <div class="tbl-wrap"><table class="tbl"><tbody>${fils.map((f) => `<tr class="click" data-act="filing" data-id="${f.id}"><td style="width:150px">${filingChip(f)}</td><td><b style="font-weight:500">${esc(FIL[f.code]?.name || f.code)}</b><small>${esc(client(f.clientId).name)} · ${esc(f.period)}</small></td><td class="n">${inr(num(f.fee))}</td></tr>`).join('')}</tbody></table></div></div>` : '';
    return `<div class="grid g2" style="align-items:start"><div style="display:flex;flex-direction:column;gap:18px">${filCard}${sec || `<div class="card">${empty('No open jobs', 'Every job is done.')}</div>`}</div>
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
      ${expCard(S.expenses.filter((e) => e.clientId === c.id), { client: c.id })}
      <div class="card"><div class="card-h"><h2>Compliance</h2><span class="hint">${(c.filingCodes || []).length ? esc((c.filingCodes || []).map((x) => FIL[x]?.short || x).join(' · ')) : 'No filings set up'}</span><span class="right"><button class="btn sm" data-act="compProfile" data-id="${c.id}">Set up filings</button></span></div>
        ${(() => { const fs = S.filings.filter((f) => f.clientId === c.id).sort((a, b) => b.due.localeCompare(a.due)); return fs.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${fs.map((f) => `<tr class="click" data-act="filing" data-id="${f.id}"><td>${esc(FIL[f.code]?.name || f.code)}<small>${esc(f.period)}${f.srn ? ' · SRN ' + esc(f.srn) : ''}</small></td><td>${filingChip(f)}</td><td class="n">${inr(num(f.fee))}</td></tr>`).join('')}</tbody></table></div>` : empty('No filings yet', 'Set up the filings you handle for this client.'); })()}</div>
      <div><button class="btn danger" data-act="deleteClient" data-id="${c.id}">Delete client</button></div>`;
  };

  PAGES.reports = () => {
    const R = UI.reports, range = periodRange(R.period);
    setHead('Reports', range.label === 'All time' ? 'All time' : `FY ${range.label}`, `<button class="btn" data-act="exportReport">Export CSV</button>`);
    const tabs = [['clients', 'Client profitability'], ['services', 'Service profitability'], ['team', 'Team utilisation'], ['monthly', 'Monthly summary'], ['expenses', 'Client expenses']];
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
      const g = Object.create(null);
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
    if (R.tab === 'expenses') {
      const xs = S.expenses.filter((e) => inRange(e.date, range));
      const g = Object.create(null);
      xs.forEach((e) => { const k = client(e.clientId).name; const o = g[k] || (g[k] = { name: k, n: 0, spent: 0, billed: 0, open: 0, absorbed: 0 }); o.n++; o.spent += num(e.amount); const st = expStatus(e); if (st === 'Billed') o.billed += num(e.amount); else if (st === 'Absorbed') o.absorbed += num(e.amount); else o.open += num(e.amount); });
      const rows = Object.values(g).sort((a, b) => b.spent - a.spent);
      const T = { name: 'Total', n: sum(rows, (r) => r.n), spent: sum(rows, (r) => r.spent), billed: sum(rows, (r) => r.billed), open: sum(rows, (r) => r.open), absorbed: sum(rows, (r) => r.absorbed) };
      return { cols: [{ key: 'name', label: 'Client' }, { key: 'n', label: 'Expenses', n: 1 }, { key: 'spent', label: 'Spent for client', n: 1, fmt: inr }, { key: 'billed', label: 'Billed back', n: 1, fmt: inr }, { key: 'open', label: 'Still to recover', n: 1, fmt: inr, cls: (r) => (r.open ? 't-warn' : '') }, { key: 'absorbed', label: 'Firm’s own cost', n: 1, fmt: inr }], rows, total: T, note: 'Money you paid on behalf of clients, by expense date.' };
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

  PAGES.compliance = () => {
    const C = UI.comp;
    if (!C.y1) C.y1 = +fyOf().start.slice(0, 4);
    const y1 = C.y1, range = { start: `${y1}-04-01`, end: `${y1 + 1}-03-31` };
    setHead('Compliance', `Statutory filings due in ${fyStr(y1)} · ROC/MCA, income tax, TDS, GST`, `<button class="btn" data-act="genFilings">Generate filings for ${fyStr(y1)}</button> <button class="btn primary" data-act="compProfile">Set up a client</button>`);
    const all = S.filings.filter((f) => inRange(f.due, range));
    const profiled = S.clients.filter((c) => c.filingCodes && c.filingCodes.length);
    const pend = all.filter((f) => !filingDone(f)), over = all.filter(filingOverdue);
    const soon = pend.filter((f) => !filingOverdue(f) && daysFrom(f.due) <= 30);
    const feeAll = sum(all.filter((f) => f.status !== 'Not applicable'), (f) => f.fee);
    const feeOpen = sum(all.filter((f) => f.status !== 'Not applicable' && !(f.jobId && job(f.jobId)?.billing === 'Billed')), (f) => f.fee);
    const risk = sum(over, lateFee);
    const kpis = `<section class="kpis">
      <div class="kpi ${over.length ? 'bad' : ''}"><span class="l">Overdue filings</span><span class="v">${over.length}</span><span class="s">client late fees so far ≈ ${inr(risk)}</span></div>
      <div class="kpi alert"><span class="l">Due in 30 days</span><span class="v">${soon.length}</span><span class="s">${pend.length} pending in total</span></div>
      <div class="kpi good"><span class="l">Filed this year</span><span class="v">${all.filter((f) => f.status === 'Filed').length}</span><span class="s">of ${all.filter((f) => f.status !== 'Not applicable').length} filings</span></div>
      <div class="kpi"><span class="l">Compliance fees, ${fyStr(y1)}</span><span class="v">${inrC(feeAll)}</span><span class="s">${inr(feeOpen)} not yet invoiced</span></div>
    </section>`;
    const yearNav = `<span class="right"><button class="btn sm" data-act="compYear" data-d="-1">← ${fyStr(y1 - 1)}</button><button class="btn sm" data-act="compYear" data-d="1">${fyStr(y1 + 1)} →</button></span>`;
    if (!profiled.length && !all.length) {
      return kpis + `<div class="card">${empty('No clients set up for compliance yet', 'Choose a company or LLP and tick the filings you handle for it (AOC-4, MGT-7, DIR-3 KYC, Form 8, Form 11, ITR, TDS…). Then generate the year’s filings.', '<button class="btn primary" data-act="compProfile">Set up a client</button>')}</div>`;
    }
    const tabs = `<div class="tabs">${[['grid', 'Client grid'], ['list', 'By due date']].map(([k, l]) => `<button class="${C.view === k ? 'on' : ''}" data-act="compView" data-k="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (C.view === 'grid') {
      const codes = FILINGS.map((f) => f.code).filter((code) => all.some((f) => f.code === code) || profiled.some((c) => c.filingCodes.includes(code)));
      const clientsInGrid = S.clients.filter((c) => all.some((f) => f.clientId === c.id) || (c.filingCodes || []).length).sort((a, b) => a.name.localeCompare(b.name));
      body = `<div class="tbl-wrap"><table class="tbl comp-grid"><thead><tr><th>Client</th>${codes.map((code) => `<th title="${esc(FIL[code].name)}">${esc(FIL[code].short)}</th>`).join('')}<th class="n">Fees</th></tr></thead><tbody>
      ${clientsInGrid.map((c) => {
        const cf = all.filter((f) => f.clientId === c.id);
        return `<tr><td><a href="#client/${c.id}"><b style="font-weight:500">${esc(c.name)}</b></a><small>${esc(c.type || '')} · <a href="#" data-act="compProfile" data-id="${c.id}">filings</a></small></td>${codes.map((code) => {
          const fs = cf.filter((f) => f.code === code).sort((a, b) => a.due.localeCompare(b.due));
          if (!fs.length) return `<td class="t-muted">${(c.filingCodes || []).includes(code) ? '<span class="t-muted" title="Generate filings to add">·</span>' : ''}</td>`;
          return `<td><div class="cells">${fs.map((f) => `<button class="cellbtn" data-act="filing" data-id="${f.id}" title="${esc(FIL[code].name)} · ${esc(f.period)}">${FIL[code].kind === 'tdsq' ? `<small>${esc(f.period.split(' ')[0])}</small>` : ''}${filingChip(f, true)}</button>`).join('')}</div></td>`;
        }).join('')}<td class="n">${inr(sum(cf.filter((f) => f.status !== 'Not applicable'), (f) => f.fee))}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    } else {
      let rows = all.slice();
      if (C.status === 'open') rows = rows.filter((f) => !filingDone(f));
      if (C.status === 'overdue') rows = rows.filter(filingOverdue);
      if (C.status === 'Filed') rows = rows.filter((f) => f.status === 'Filed');
      if (C.client) rows = rows.filter((f) => f.clientId === C.client);
      if (C.cat) rows = rows.filter((f) => FIL[f.code]?.cat === C.cat);
      rows.sort((a, b) => a.due.localeCompare(b.due));
      body = `<div class="card-b"><div class="filters">
        <select class="input" id="f-comp-status" data-filter="comp.status" aria-label="Status">${[['open', 'Pending'], ['overdue', 'Overdue'], ['Filed', 'Filed'], ['', 'All']].map(([v, l]) => `<option value="${v}" ${C.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input" id="f-comp-client" data-filter="comp.client" aria-label="Client"><option value="">All clients</option>${clientOptions().map(([v, l]) => `<option value="${v}" ${C.client === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select class="input" id="f-comp-cat" data-filter="comp.cat" aria-label="Type"><option value="">All types</option>${['ROC / MCA', 'Income tax', 'TDS', 'GST'].map((c) => `<option ${C.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
        ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Due</th><th>Filing</th><th>Client</th><th>Status</th><th class="n">Fee</th><th class="n">Late fee so far</th><th>Billing</th></tr></thead><tbody>
        ${rows.map((f) => { const j = f.jobId ? job(f.jobId) : null; return `<tr class="click" data-act="filing" data-id="${f.id}"><td>${fmtDs(f.due)}</td><td><b style="font-weight:500">${esc(FIL[f.code]?.name || f.code)}</b><small>${esc(f.period)}${f.srn ? ' · SRN ' + esc(f.srn) : ''}</small></td><td>${esc(client(f.clientId).name)}</td><td>${filingChip(f)}</td><td class="n">${inr(num(f.fee))}</td><td class="n ${lateFee(f) ? 't-bad' : 't-muted'}">${lateFee(f) ? inr(lateFee(f)) : '·'}</td><td>${j ? billChip(j) : '<span class="t-muted">No job yet</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>` : empty('Nothing here', 'No filings match these filters.')}`;
    }
    return kpis + `<div class="card"><div class="card-h"><h2>${fyStr(y1)} filings</h2><span class="hint">Filings whose due date falls between 1 Apr ${y1} and 31 Mar ${y1 + 1}. Click any filing to update it.</span>${yearNav}</div>${tabs}${body}
      <div class="card-b t-muted" style="font-size:12.5px">Due dates are the standard statutory dates (AGM by 30 Sep). Check the MCA, income-tax and GST portals for extensions. Late fees are estimates of what the client is running up: ₹100 a day per ROC form, ₹200 a day for TDS (section 234E) and GSTR-9, flat ₹5,000 for DIR-3 KYC and belated ITR.</div></div>`;
  };

  PAGES.growth = () => {
    const fy = fyOf(), t = todayISO();
    const target = num(S.settings.fyTarget);
    setHead('Growth', `Revenue plan for FY ${fy.label}`, `<button class="btn" data-act="setTarget">Set FY target</button>`);
    const billed = sum(S.invoices.filter((i) => inRange(i.date, fy)), (i) => i.fee);
    const ready = sum(S.jobs.filter(readyToBill), (j) => j.fee);
    const wip = sum(S.jobs.filter((j) => !isDone(j) && j.billing === 'Not billed'), (j) => j.fee);
    const y1 = +fy.start.slice(0, 4);
    const compPipe = sum(S.filings.filter((f) => inRange(f.due, { start: `${y1}-04-01`, end: `${y1 + 1}-03-31` }) && f.status !== 'Not applicable' && !f.jobId), (f) => f.fee);
    // Recurring jobs still to come this FY (monthly/quarterly not yet opened)
    const recurring = S.jobs.filter((j) => j.recurring && j.recurring !== 'none' && !j.nextId);
    const monthsLeft = Math.max(0, Math.round((parseD(fy.end) - parseD(t)) / (864e5 * 30.4)));
    const recurFuture = sum(recurring, (j) => num(j.fee) * (j.recurring === 'monthly' ? monthsLeft : j.recurring === 'quarterly' ? Math.floor(monthsLeft / 3) : 0));
    const projected = billed + ready + wip + compPipe + recurFuture;
    const gap = Math.max(0, target - projected);
    const needPerMonth = monthsLeft ? Math.max(0, target - billed) / monthsLeft : 0;
    const prog = target ? Math.min(1, billed / target) : 0;
    const parts = [
      { label: 'Billed so far', value: billed, color: 'var(--chart-1)' },
      { label: 'Finished, not invoiced', value: ready, color: 'var(--warn)' },
      { label: 'Open jobs not yet billed', value: wip, color: 'var(--chart-2)' },
      { label: 'Compliance filings not yet opened as jobs', value: compPipe, color: 'var(--chart-3)' },
      { label: 'Recurring work still to come this FY', value: recurFuture, color: 'var(--info)' },
    ];
    const head = `<section class="kpis">
      <div class="kpi"><span class="l">FY ${fy.label} target</span><span class="v">${inrC(target)}</span><span class="s">fees excl. GST</span></div>
      <div class="kpi good"><span class="l">Billed so far</span><span class="v">${inrC(billed)}</span><span class="s">${pct(prog)} of target</span></div>
      <div class="kpi"><span class="l">Projected for the year</span><span class="v">${inrC(projected)}</span><span class="s">if the pipeline below is billed</span></div>
      <div class="kpi ${gap ? 'alert' : 'good'}"><span class="l">${gap ? 'Gap to target' : 'Target covered'}</span><span class="v">${inrC(gap)}</span><span class="s">${inr(needPerMonth)} a month needed for ${monthsLeft} months</span></div>
    </section>`;
    const bar = `<div class="card"><div class="card-h"><h2>Where this year’s revenue comes from</h2><span class="hint">Fees excluding GST and reimbursements</span></div><div class="card-b">
      <div class="stack">${parts.map((p) => `<i style="width:${target || projected ? (p.value / Math.max(target, projected)) * 100 : 0}%;background:${p.color}" title="${esc(p.label)}: ${esc(inr(p.value))}"></i>`).join('')}${target > projected ? `<i class="gap" style="width:${((target - projected) / target) * 100}%" title="Gap"></i>` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:14px">${parts.map((p) => `<div class="sumline" style="padding:2px 0"><span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};margin-right:6px"></i>${esc(p.label)}</span><b class="num" style="font-weight:500">${inr(p.value)}</b></div>`).join('')}</div></div></div>`;

    // Opportunities
    const ops = [];
    const readyJobs = S.jobs.filter(readyToBill);
    if (readyJobs.length) ops.push({ kind: 'Bill now', value: ready, text: `${readyJobs.length} finished jobs have no invoice. Raise them this week.`, link: '#jobs', act: 'jobsReady' });
    const toRec = S.expenses.filter(expToRecover);
    if (toRec.length) ops.push({ kind: 'Recover expenses', value: sum(toRec, (e) => e.amount), text: `${toRec.length} expenses you paid for clients are not on any invoice yet. This is your own cash: add them to the next invoices.`, link: '#expenses' });
    const owed = S.invoices.map((i) => ({ i, st: invStats(i) })).filter((x) => x.st.balance > 0 && x.st.daysOver > 30);
    if (owed.length) ops.push({ kind: 'Collect', value: sum(owed, (x) => x.st.balance), text: `${owed.length} invoice${owed.length === 1 ? ' is' : 's are'} more than 30 days late: ${[...new Set(owed.map((x) => client(x.i.clientId).name.split(' (')[0]))].slice(0, 3).join(', ')}.`, link: '#invoices' });
    const roc = ['AOC4', 'MGT7', 'ADT1', 'DIR3', 'AGM'];
    S.clients.filter((c) => c.type === 'Company').forEach((c) => {
      const miss = roc.filter((code) => !(c.filingCodes || []).includes(code));
      if (miss.length >= 3) ops.push({ kind: 'Offer ROC retainer', value: sum(miss, (code) => FIL[code].fee), text: `${c.name}: you don’t handle ${miss.map((m) => FIL[m].short).join(', ')}. Offer the full annual company compliance package.`, link: '#client/' + c.id });
    });
    S.clients.filter((c) => c.type === 'LLP').forEach((c) => {
      const miss = ['F8', 'F11', 'DIR3', 'ITRLLP'].filter((code) => !(c.filingCodes || []).includes(code));
      if (miss.length >= 2) ops.push({ kind: 'Offer LLP package', value: sum(miss, (code) => FIL[code].fee), text: `${c.name}: add ${miss.map((m) => FIL[m].short).join(', ')} to your yearly work.`, link: '#client/' + c.id });
    });
    const gstClients = [...new Set(S.jobs.filter((j) => /GST return/i.test(j.service || '') || /GST return/i.test(j.title)).map((j) => j.clientId))];
    gstClients.forEach((cid) => { const c = byId(S.clients, cid); if (c && !(c.filingCodes || []).includes('GSTR9') && !S.jobs.some((j) => j.clientId === cid && /GSTR-9/i.test(j.title + j.service))) ops.push({ kind: 'Add GSTR-9', value: FIL.GSTR9.fee, text: `${c.name} files monthly GST with you but has no GSTR-9 job. Due 31 Dec.`, link: '#client/' + cid }); });
    const svc = Object.create(null);
    S.jobs.filter((j) => isDone(j) && num(j.fee) > 0).forEach((j) => { const s = jobStats(j); const k = j.service || 'Other'; const o = svc[k] || (svc[k] = { fee: 0, cost: 0, n: 0 }); o.fee += s.fee; o.cost += s.cost; o.n++; });
    Object.entries(svc).filter(([, o]) => o.fee && (o.fee - o.cost) / o.fee < 0.3 && o.n >= 1).forEach(([k, o]) => ops.push({ kind: 'Reprice', value: Math.round(o.cost / 0.7 - o.fee), text: `${k}: margin is ${pct((o.fee - o.cost) / o.fee)} on ${o.n} job${o.n > 1 ? 's' : ''}. Raising fees to a 30% margin adds about this much on the same work.`, link: '#reports' }));
    const noRecur = S.clients.filter((c) => S.jobs.some((j) => j.clientId === c.id) && !S.jobs.some((j) => j.clientId === c.id && j.recurring && j.recurring !== 'none') && !(c.filingCodes || []).length);
    if (noRecur.length) ops.push({ kind: 'Convert to retainer', value: noRecur.length * 12 * 1500, text: `${noRecur.length} clients only give you one-off work (${noRecur.slice(0, 4).map((c) => c.name.split(' (')[0]).join(', ')}${noRecur.length > 4 ? '…' : ''}). A monthly GST or bookkeeping retainer at ₹1,500 is worth ₹18,000 a year each.`, link: '#clients' });
    ops.sort((a, b) => b.value - a.value);
    const opsCard = `<div class="card"><div class="card-h"><h2>Ways to earn more this year</h2><span class="hint">Worked out from your jobs, invoices and compliance list</span></div>
      ${ops.length ? `<ul class="att">${ops.map((o) => `<li><span class="chip acc plain" style="min-width:130px;justify-content:center">${esc(o.kind)}</span><div class="what">${esc(o.text)}</div><span class="amt"><b style="font-weight:600">${inr(o.value)}</b></span><a class="btn sm" href="${o.link}" ${o.act ? `data-act="${o.act}"` : ''}>Open</a></li>`).join('')}</ul>` : empty('No suggestions yet', 'Add jobs, invoices and compliance profiles to see opportunities.')}</div>`;

    // Retainer value per client
    const ret = S.clients.map((c) => {
      const comp = sum((c.filingCodes || []).map((code) => FIL[code]), (f) => f ? f.fee * (f.kind === 'tdsq' ? 4 : 1) : 0);
      const rec = sum(S.jobs.filter((j) => j.clientId === c.id && j.recurring && j.recurring !== 'none' && !j.nextId), (j) => num(j.fee) * (j.recurring === 'monthly' ? 12 : j.recurring === 'quarterly' ? 4 : 1));
      const billedFY = sum(S.invoices.filter((i) => i.clientId === c.id && inRange(i.date, fy)), (i) => i.fee);
      return { c, comp, rec, total: comp + rec, billedFY };
    }).filter((r) => r.total || r.billedFY).sort((a, b) => b.billedFY + b.total - a.billedFY - a.total).slice(0, 15);
    const retCard = `<div class="card"><div class="card-h"><h2>Client value</h2><span class="hint">Billed this FY, and the yearly value of their compliance and recurring work: the basis for an annual retainer quote</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Client</th><th class="n">Billed FY ${fy.label}</th><th class="n">Compliance a year</th><th class="n">Recurring a year</th><th class="n">Retainer value</th></tr></thead><tbody>
      ${ret.map((r) => `<tr class="click" data-href="#client/${r.c.id}"><td>${esc(r.c.name)}<small>${esc(r.c.type || '')}</small></td><td class="n">${inr(r.billedFY)}</td><td class="n">${r.comp ? inr(r.comp) : '·'}</td><td class="n">${r.rec ? inr(r.rec) : '·'}</td><td class="n"><b style="font-weight:500">${r.total ? inr(r.total) : '·'}</b>${r.total ? `<small>${inr(r.total / 12)} / month</small>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return head + bar + opsCard + retCard;
  };

  function expCard(xs, preset) {
    const list = xs.slice().sort((a, b) => b.date.localeCompare(a.date));
    const open = sum(list.filter(expToRecover), (e) => e.amount);
    return `<div class="card"><div class="card-h"><h2>Expenses paid for the client</h2><span class="hint">${list.length ? `${inr(sum(list, (e) => e.amount))} spent · ${inr(open)} still to recover` : 'Govt fees, challans, DSC, stamp paper, travel…'}</span><span class="right"><button class="btn sm" data-act="newExpense" data-client="${preset.client || ''}" data-job="${preset.job || ''}">Add expense</button></span></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${list.map((e) => `<tr class="click" data-act="editExpense" data-id="${e.id}"><td style="width:110px">${fmtDs(e.date)}</td><td>${esc(e.description || e.category)}<small>${esc(e.category)}${e.ref ? ' · ' + esc(e.ref) : ''}</small></td><td class="n">${inr(num(e.amount))}</td><td>${expChip(e)}</td></tr>`).join('')}</tbody></table></div>` : empty('No expenses recorded', 'Record every amount you pay on the client’s behalf so it is billed back.')}</div>`;
  }

  PAGES.expenses = () => {
    const f = UI.exp, fy = fyOf();
    setHead('Expenses', 'Money paid on behalf of clients, and whether it has been billed back', `<button class="btn primary" data-act="newExpense">Add expense</button>`);
    const all = S.expenses;
    const toRec = all.filter(expToRecover);
    const recFY = all.filter((e) => expStatus(e) === 'Billed' && inRange(e.date, fy));
    const absFY = all.filter((e) => expStatus(e) === 'Absorbed' && inRange(e.date, fy));
    const oldest = toRec.reduce((m, e) => (!m || e.date < m ? e.date : m), null);
    const kpis = `<section class="kpis">
      <div class="kpi ${toRec.length ? 'alert' : ''}"><span class="l">Still to recover</span><span class="v">${inrC(sum(toRec, (e) => e.amount))}</span><span class="s">${toRec.length} expenses${oldest ? ' · oldest ' + fmtDs(oldest) : ''}</span></div>
      <div class="kpi good"><span class="l">Billed back, FY ${fy.label}</span><span class="v">${inrC(sum(recFY, (e) => e.amount))}</span><span class="s">${recFY.length} expenses on invoices</span></div>
      <div class="kpi"><span class="l">Firm’s own cost, FY ${fy.label}</span><span class="v">${inrC(sum(absFY, (e) => e.amount))}</span><span class="s">absorbed, counted in job cost</span></div>
      <div class="kpi"><span class="l">Clients owing expenses</span><span class="v">${new Set(toRec.map((e) => e.clientId)).size}</span><span class="s">raise an invoice to recover</span></div>
    </section>`;
    const q = f.q.trim().toLowerCase();
    let rows = all.filter((e) => (!f.status || expStatus(e) === f.status) && (!f.client || e.clientId === f.client) && (!f.cat || e.category === f.cat) && (!q || (client(e.clientId).name + ' ' + (e.description || '') + ' ' + (e.ref || '') + ' ' + e.category).toLowerCase().includes(q)));
    rows = sortRows(rows, 'exp', { date: (e) => e.date, client: (e) => client(e.clientId).name, amount: (e) => num(e.amount), cat: (e) => e.category });
    const byClient = Object.create(null);
    toRec.forEach((e) => { const o = byClient[e.clientId] || (byClient[e.clientId] = { n: 0, amt: 0 }); o.n++; o.amt += num(e.amount); });
    const recCard = Object.keys(byClient).length ? `<div class="card"><div class="card-h"><h2>To recover, by client</h2><span class="hint">Add these to the next invoice: they are your own cash</span></div><ul class="att">${Object.entries(byClient).sort((a, b) => b[1].amt - a[1].amt).map(([cid, o]) => `<li><div class="what"><a href="#client/${cid}"><b>${esc(client(cid).name)}</b></a><small>${o.n} expense${o.n === 1 ? '' : 's'}</small></div><span class="amt">${inr(o.amt)}</span><button class="btn sm" data-act="newInvoice" data-client="${cid}">Raise invoice</button></li>`).join('')}</ul></div>` : '';
    const table = `<div class="card"><div class="card-b"><div class="filters">
        <input class="input search" id="f-exp-q" type="search" placeholder="Search client, description, challan / SRN…" value="${esc(f.q)}" data-filter="exp.q" aria-label="Search expenses">
        <select class="input" id="f-exp-status" data-filter="exp.status" aria-label="Status">${[['To recover', 'To recover'], ['Billed', 'Billed back'], ['Absorbed', 'Firm’s own cost'], ['', 'All expenses']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input" id="f-exp-client" data-filter="exp.client" aria-label="Client"><option value="">All clients</option>${clientOptions().map(([v, l]) => `<option value="${v}" ${f.client === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select class="input" id="f-exp-cat" data-filter="exp.cat" aria-label="Type"><option value="">All types</option>${EXP_CATS.map((c) => `<option ${f.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th('date', 'Date', 'exp')}${th('client', 'Client and job', 'exp')}${th('cat', 'What was paid', 'exp')}<th>Paid from</th>${th('amount', 'Amount', 'exp', 'n')}<th>Status</th></tr></thead><tbody>
      ${rows.map((e) => { const j = e.jobId ? job(e.jobId) : null; return `<tr class="click" data-act="editExpense" data-id="${e.id}"><td>${fmtDs(e.date)}</td><td>${esc(client(e.clientId).name)}${j ? `<small>${esc(j.title)}</small>` : ''}</td><td>${esc(e.description || e.category)}<small>${esc(e.category)}${e.ref ? ' · ' + esc(e.ref) : ''}</small></td><td>${esc(e.paidBy || '')}</td><td class="n">${inr(num(e.amount))}</td><td>${expChip(e)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4">${rows.length} expenses</td><td class="n">${inr(sum(rows, (e) => e.amount))}</td><td></td></tr></tfoot></table></div>`
        : empty(all.length ? 'No expenses match' : 'No expenses yet', all.length ? 'Change the filters to see more.' : 'Record every government fee, challan, DSC, stamp paper or travel cost you pay for a client.', all.length ? '' : '<button class="btn primary" data-act="newExpense">Add expense</button>')}</div>`;
    return kpis + recCard + table;
  };

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
          ${f('fyTarget', 'Fee target for this FY (₹)', 'number', 'min="0"')}${f('invoicePrefix', 'Invoice number prefix')}${f('jobPrefix', 'Job code prefix')}
          <div class="field"><label for="set-fyStartMonth">Financial year starts in</label><select class="input" id="set-fyStartMonth" name="fyStartMonth">${MONTHS.map((m, i) => `<option value="${i + 1}" ${num(s.fyStartMonth) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div class="field"><label for="set-theme">Appearance</label><select class="input" id="set-theme" data-change="theme">${[['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div><div class="modal-f"><button class="btn primary" type="submit">Save settings</button></div></form>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${CL ? `<div class="card"><div class="card-h"><h2>Online database</h2><span class="hint">${SY.state === 'saved' && !SY.dirty ? '<span class="chip ok">Saved online</span>' : SY.state === 'offline' ? '<span class="chip warn">Offline</span>' : SY.state === 'auth' ? '<span class="chip bad">Signed out</span>' : '<span class="chip">Saving…</span>'}</span></div><div class="card-b">
          <p style="margin:0 0 6px">Signed in as <b>${esc(CL.user?.email || '')}</b>.${SY.lastAt ? ' Last saved online ' + esc(SY.lastAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })) + '.' : ''}</p>
          <p class="t-muted" style="margin:0 0 12px">Every change is saved online within a few seconds, and a copy of each day’s data is kept online. Keep the Excel backup on as a second copy.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="cloudSyncNow">Check for changes</button><button class="btn" data-act="cloudSignOut">Sign out</button></div></div></div>` : ''}
        <div class="card"><div class="card-h"><h2>Automatic Excel backup</h2><span class="hint">${AB.state === 'on' ? '<span class="chip ok">On</span>' : AB.state === 'paused' ? '<span class="chip warn">Paused</span>' : AB.state === 'unsupported' ? '<span class="chip">Not available in this browser</span>' : '<span class="chip">Off</span>'}</span></div><div class="card-b">
          ${AB.state === 'unsupported' ? '<p class="t-muted" style="margin:0">Automatic backup to a folder works in Google Chrome or Microsoft Edge on a computer. Here, use the Download Excel backup button below.</p>'
          : AB.state === 'on' ? `<p style="margin:0 0 6px">Saving to folder <b>${esc(AB.dir?.name || '')}</b> about 3 seconds after every change.${AB.lastAt ? ' Last saved ' + esc(AB.lastAt) + '.' : ''}</p><p class="t-muted" style="margin:0 0 12px">Files: <span class="mono">Cloudbook-Desk-latest.xlsx</span> (always current) and one dated copy per day, e.g. <span class="mono">${xlsxName(true)}</span>. Pick a Google Drive or OneDrive folder and the backups also go to the cloud.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="backupNow">Save backup now</button><button class="btn" data-act="chooseBackupDir">Change folder</button><button class="btn danger" data-act="stopBackup">Turn off</button></div>`
          : AB.state === 'paused' ? `<p style="margin:0 0 12px">Folder <b>${esc(AB.dir?.name || '')}</b> is chosen, but the browser needs your permission again for this visit.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="resumeBackup">Resume Excel backup</button><button class="btn" data-act="chooseBackupDir">Change folder</button><button class="btn danger" data-act="stopBackup">Turn off</button></div>`
          : `<p class="t-muted" style="margin:0 0 12px">Choose a folder once, ideally inside Google Drive or OneDrive on this computer. After that, an Excel copy of all your data is saved there automatically every time you change something, plus one dated copy per day.</p><button class="btn primary" data-act="chooseBackupDir">Choose backup folder</button>`}
        </div></div>
        <div class="card"><div class="card-h"><h2>Download a backup</h2><span class="hint">${s.lastBackup ? 'Last backup ' + fmtD(s.lastBackup) : 'No backup taken yet'}</span></div><div class="card-b">
          <p class="t-muted" style="margin:0 0 12px">The Excel file has one sheet each for clients, jobs, timesheet, invoices, payments, expenses, filings, team and services, and it can be imported back to restore everything.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="backupXlsx">Download Excel backup</button><button class="btn" data-act="backup">Download JSON backup</button><button class="btn" data-act="copyBackup">Copy backup as text</button></div></div></div>
        <div class="card"><div class="card-h"><h2>Restore or import</h2></div><div class="card-b">
          <p class="t-muted" style="margin:0 0 12px">Choose an Excel (.xlsx) or JSON backup made by this app. You can add only new records or replace everything.</p>
          <input type="file" id="import-file" accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-change="importFile">
          <details style="margin-top:12px"><summary class="t-muted">Or paste backup text</summary><textarea class="input" id="import-text" style="margin-top:8px;min-height:120px" placeholder='{"version":1, …}'></textarea><button class="btn" style="margin-top:8px" data-act="importText">Import pasted text</button></details></div></div>
        <div class="card"><div class="card-h"><h2>Start again</h2></div><div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap">
          ${CL ? '' : '<button class="btn" data-act="demo">Load sample data</button>'}<button class="btn danger" data-act="wipe">Delete all data</button></div></div>
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
      const pickedX = new Set($$('#inv-exp input:checked').map((x) => x.value));
      const xpool = S.expenses.filter((e) => e.clientId === cid && e.recover && (expToRecover(e) || (inv && e.invoiceId === inv.id))).sort((a, b) => a.date.localeCompare(b.date));
      if (!$('#inv-exp').dataset.init) { xpool.forEach((e) => { if (!inv || e.invoiceId === inv.id) pickedX.add(e.id); }); $('#inv-exp').dataset.init = 1; } else if ($('#inv-exp').dataset.client !== cid) { xpool.forEach((e) => pickedX.add(e.id)); }
      $('#inv-exp').dataset.client = cid;
      $('#inv-exp').innerHTML = xpool.length ? xpool.map((e) => `<label><input type="checkbox" value="${e.id}" ${pickedX.has(e.id) ? 'checked' : ''}><span>${esc(e.description || e.category)}<br><small class="t-muted">${fmtD(e.date)} · ${esc(e.category)}${e.ref ? ' · ' + esc(e.ref) : ''}</small></span><b class="num">${inr(num(e.amount))}</b></label>`).join('') : '<div class="empty" style="padding:14px">No unbilled expenses for this client. Record them under Expenses.</div>';
      recalc(true);
    };
    const recalc = (fromJobs) => {
      const sel = $$('#inv-jobs input:checked').map((x) => job(x.value)).filter(Boolean);
      const selX = $$('#inv-exp input:checked').map((x) => byId(S.expenses, x.value)).filter(Boolean);
      if (fromJobs) { if (sel.length) $('#inv-fee').value = sum(sel, (j) => j.fee); $('#inv-reimb').value = sum(selX, (e) => e.amount) + sum(sel, (j) => j.govtFees); }
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
      <div class="field full"><label>Expenses to recover (billed at cost, no GST)</label><div class="pick" id="inv-exp"></div></div>
      <div class="field"><label for="inv-fee">Professional fee (₹)</label><input class="input" id="inv-fee" type="number" min="0" value="${esc(inv ? inv.fee : 0)}"></div>
      <div class="field"><label for="inv-reimb">Reimbursements (₹)</label><input class="input" id="inv-reimb" type="number" min="0" value="${esc(inv ? inv.reimb : 0)}"><span class="help">Govt fees and challans paid for the client</span></div>
      <div class="field full" id="inv-sum"></div>
      <div class="field full"><label for="inv-notes">Notes</label><textarea class="input" id="inv-notes">${esc(v.notes || '')}</textarea></div></div>`;
    modal(isNew ? 'New invoice' : 'Edit invoice', body, `<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="saveInvoice">${isNew ? 'Create invoice' : 'Save invoice'}</button>`, { wide: true });
    $('#inv-client').addEventListener('change', () => { $('#inv-jobs').dataset.init = 1; draw(); });
    $('#inv-jobs').addEventListener('change', () => recalc(true));
    $('#inv-exp').addEventListener('change', () => recalc(true));
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
      const expIds = $$('#inv-exp input:checked').map((x) => x.value);
      const data = { clientId, number, date: $('#inv-date').value || todayISO(), dueDate: $('#inv-due').value || null, fee, gst, reimb, total: Math.round(fee + gst + reimb), jobIds, notes: $('#inv-notes').value.trim() };
      let target = inv;
      if (inv) {
        inv.jobIds.filter((id) => !jobIds.includes(id)).forEach((id) => { const j = job(id); if (j) { j.billing = 'Not billed'; j.invoiceId = null; } });
        Object.assign(inv, data);
      } else { target = { id: uid('i'), payments: [], ...data }; S.invoices.push(target); S.started = true; }
      jobIds.forEach((id) => { const j = job(id); if (j) { j.billing = 'Billed'; j.invoiceId = target.id; } });
      S.expenses.forEach((e) => { if (e.invoiceId === target.id && !expIds.includes(e.id)) e.invoiceId = null; });
      expIds.forEach((id) => { const e = byId(S.expenses, id); if (e) e.invoiceId = target.id; });
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

  function expenseForm(e, preset = {}) {
    if (!S.clients.length) { toast('Add a client first'); return; }
    const isNew = !e;
    const v = e ? { ...e } : { date: todayISO(), category: 'Government / statutory fee', recover: true, paidBy: 'Firm bank account', clientId: preset.client || '', jobId: preset.job || '', filingId: preset.filing || null };
    const billedInv = e && e.invoiceId ? byId(S.invoices, e.invoiceId) : null;
    const jobOpts = (cid) => [['', 'Not linked to a job'], ...S.jobs.filter((j) => j.clientId === cid).sort((a, b) => (b.start || '').localeCompare(a.start || '')).map((j) => [j.id, j.title + (j.period ? ' · ' + j.period : '')])];
    form({
      title: isNew ? 'Add expense' : 'Edit expense', wide: true,
      intro: billedInv ? `Already billed on <a href="#invoice/${billedInv.id}">${esc(billedInv.number)}</a>. If you change the amount, edit that invoice too.` : 'Record anything you paid for the client. Recoverable expenses appear on the client’s next invoice as reimbursements at cost (no GST). Expenses the firm absorbs are added to the job’s cost.',
      values: v,
      fields: [
        { name: 'clientId', label: 'Client', type: 'select', options: clientOptions, required: true, placeholder: 'Choose a client' },
        { name: 'jobId', label: 'Job', type: 'select', options: () => jobOpts(v.clientId) },
        { name: 'date', label: 'Date paid', type: 'date', required: true },
        { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0, step: '0.01' },
        { name: 'category', label: 'Type', type: 'select', options: EXP_CATS },
        { name: 'paidBy', label: 'Paid from', type: 'select', options: PAID_BY },
        { name: 'description', label: 'Description', full: true, required: true, placeholder: 'e.g. GSTR-3B late fee Jul 2026, MCA fee AOC-4, DSC for director' },
        { name: 'ref', label: 'Challan / CPIN / SRN / receipt no.', placeholder: 'For proof when billing' },
        { name: 'recover', label: 'Billing', type: 'checkbox', text: 'Recover from client (bill at cost on the next invoice)' },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      submit: isNew ? 'Add expense' : 'Save expense',
      onSave: (d) => {
        if (num(d.amount) <= 0) { toast('Enter the amount paid'); return false; }
        if (d.jobId && job(d.jobId)?.clientId !== d.clientId) d.jobId = '';
        d.jobId = d.jobId || null;
        if (!d.recover && e && e.invoiceId) { toast('This expense is on an invoice. Remove it from the invoice first.'); return false; }
        if (isNew) { S.expenses.push({ id: uid('x'), invoiceId: null, filingId: v.filingId || null, ...d }); S.started = true; } else Object.assign(e, d);
        toast(d.recover ? 'Expense saved — will go on the next invoice' : 'Expense saved as the firm’s cost');
        return true;
      },
      onDelete: e ? () => { if (e.invoiceId && byId(S.invoices, e.invoiceId)) { toast('Billed expenses can’t be deleted. Remove it from the invoice first.'); return; } S.expenses = S.expenses.filter((x) => x.id !== e.id); toast('Expense deleted'); } : null,
    });
    const cs = $('#fld-clientId'), js = $('#fld-jobId');
    if (cs && js) cs.addEventListener('change', () => { js.innerHTML = jobOpts(cs.value).map(([id, l]) => `<option value="${esc(id)}">${esc(l)}</option>`).join(''); });
  }

  function filingForm(f) {
    const def = FIL[f.code] || { name: f.code, short: f.code };
    const j = f.jobId ? job(f.jobId) : null;
    const lf = lateFee(f);
    form({
      title: `${def.short} · ${client(f.clientId).name}`,
      intro: `${esc(def.name)} for <b>${esc(f.period)}</b>, due ${fmtD(f.due)}.${lf ? ` <span class="t-bad">Overdue: client late fee so far about ${inr(lf)}.</span>` : ''}${j ? ` Billing job: <a href="#job/${j.id}">${esc(j.code)}</a> (${esc(j.billing)}).` : ''} Paid a late fee or MCA fee for this filing? <a href="#" data-act="newExpense" data-client="${f.clientId}" data-job="${f.jobId || ''}" data-filing="${f.id}">Record the expense</a>.`,
      values: { ...f, makeJob: false },
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: FILING_STATUS },
        { name: 'filedOn', label: 'Filed on', type: 'date' },
        { name: 'srn', label: 'SRN / acknowledgement no.', placeholder: 'e.g. AB1234567' },
        { name: 'due', label: 'Due date', type: 'date', required: true },
        { name: 'fee', label: 'Your fee (₹, excl. GST)', type: 'number', min: 0 },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
        ...(j ? [] : [{ name: 'makeJob', label: 'Billing', type: 'checkbox', text: 'Open a job for this filing now (it is created automatically when you mark it filed)', full: true }]),
      ],
      submit: 'Save filing',
      onSave: (d) => {
        const mk = d.makeJob; delete d.makeJob;
        if (d.status === 'Filed' && !d.filedOn) d.filedOn = todayISO();
        if (d.status !== 'Filed') d.filedOn = d.filedOn || null;
        Object.assign(f, d);
        if (mk || (d.status === 'Filed' && num(f.fee) > 0) || (f.jobId && job(f.jobId))) jobForFiling(f);
        toast(d.status === 'Filed' ? (num(f.fee) ? 'Filed — added to Ready to bill' : 'Marked filed') : 'Filing saved');
        return true;
      },
      onDelete: () => { S.filings = S.filings.filter((x) => x.id !== f.id); toast('Filing removed'); },
    });
  }

  function profileForm(clientId) {
    const cands = S.clients.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!cands.length) { toast('Add a client first'); return; }
    const y1 = UI.comp.y1 || +fyOf().start.slice(0, 4);
    const cats = ['ROC / MCA', 'Income tax', 'TDS', 'GST'];
    const body = `<div class="modal-b">
      <div class="field full"><label for="pf-client">Client</label><select class="input" id="pf-client">${cands.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name)} (${esc(c.type || '—')})</option>`).join('')}</select></div>
      <div class="field full"><label>Filings you handle for this client every year</label><div id="pf-codes" class="pick"></div><span class="help">Filings that usually apply to the client’s type are marked. Fees are your standard rates and can be changed on each filing.</span></div></div>`;
    modal('Compliance set-up', body, `<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="saveProfile">Save and generate ${fyStr(y1)} filings</button>`, { wide: true });
    const draw = () => {
      const c = byId(S.clients, $('#pf-client').value);
      $('#pf-codes').innerHTML = cats.map((cat) => `<div style="padding:8px 12px 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)">${cat}</div>` + FILINGS.filter((f) => f.cat === cat).map((f) => {
        const fits = f.applies.includes('Any') || f.applies.includes(c.type);
        return `<label><input type="checkbox" value="${f.code}" ${(c.filingCodes || []).includes(f.code) ? 'checked' : ''}><span>${esc(f.name)}${fits ? ' <span class="chip acc plain" style="font-size:10.5px">usual for ' + esc(c.type || 'this client') + '</span>' : ''}<br><small class="t-muted">${f.kind === 'tdsq' ? '4 quarterly returns a year' : 'Due ' + fmtDs(`${y1}-${f.md}`)}</small></span><b class="num">${inr(f.fee)}${f.kind === 'tdsq' ? '/qtr' : ''}</b></label>`;
      }).join('')).join('');
    };
    $('#pf-client').addEventListener('change', draw); draw();
    ACT.saveProfile = () => {
      const c = byId(S.clients, $('#pf-client').value);
      c.filingCodes = $$('#pf-codes input:checked').map((x) => x.value);
      const n = generateFilings(y1, c.id);
      closeModal(); toast(`${c.name}: ${c.filingCodes.length} filing types, ${n} new filings for ${fyStr(y1)}`); S.started = true;
      if (!location.hash.startsWith('#compliance')) location.hash = '#compliance'; commit();
    };
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
      S.filings.forEach((f) => { if (f.jobId === id) f.jobId = null; });
      S.jobs.forEach((x) => { if (x.nextId === id) x.nextId = null; });
      S.expenses.forEach((e) => { if (e.jobId === id) e.jobId = null; });
      S.invoices.forEach((i) => { i.jobIds = i.jobIds.filter((x) => x !== id); });
      location.hash = '#jobs'; toast('Job deleted');
    });
  }
  function deleteClient(id) {
    const c = byId(S.clients, id); if (!c) return;
    const nj = S.jobs.filter((j) => j.clientId === id).length + S.filings.filter((f) => f.clientId === id).length + S.expenses.filter((e) => e.clientId === id).length, ni = S.invoices.filter((i) => i.clientId === id).length;
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
      const blob = text instanceof Blob ? new Blob([text], { type }) : new Blob([text], { type });
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
    const bad = unsafeIds(d);
    if (bad.length) { toast(`Import stopped: the file has ${bad.length} invalid record id${bad.length === 1 ? '' : 's'} (e.g. ${bad[0]}). It may be damaged or tampered with.`); return; }
    if (JSON.stringify(d).length > 20e6) { toast('Import stopped: the file is too large to be a Cloudbook Desk backup'); return; }
    const hasData = S.jobs.length || S.clients.length || S.invoices.length;
    const counts = `${d.clients.length} clients, ${d.jobs.length} jobs, ${(d.invoices || []).length} invoices, ${(d.filings || []).length} filings, ${(d.expenses || []).length} expenses and ${(d.time || []).length} time entries`;
    modal('Import data', `<div class="modal-b"><div class="field full"><p style="margin:0">The file has ${counts}.</p>
      ${hasData ? '<p class="t-muted" style="margin:10px 0 0"><b>Add new items</b> keeps everything you already have and adds only records that are not in this browser yet. <b>Replace</b> wipes this browser and loads the file exactly.</p>' : ''}</div></div>`,
      `<button class="btn" data-act="close">Cancel</button>${hasData ? '<button class="btn danger" data-act="importReplace">Replace everything</button><button class="btn primary" data-act="importMerge">Add new items</button>' : '<button class="btn primary" data-act="importReplace">Import</button>'}`);
    ACT.importReplace = async () => { await snapshotBackup('before-replace'); S = migrate(d); S.started = true; delete S.exportedAt; delete S.app; closeModal(); location.hash = '#dashboard'; toast('Data imported'); commit(); };
    ACT.importMerge = () => {
      const m = migrate(JSON.parse(JSON.stringify(d))); let added = 0;
      ['clients', 'services', 'team', 'jobs', 'time', 'invoices', 'filings', 'expenses'].forEach((k) => {
        const have = new Set(S[k].map((x) => x.id));
        const keys = k === 'filings' ? new Set(S.filings.map((x) => x.key)) : null;
        m[k].forEach((x) => { if (!have.has(x.id) && !(keys && keys.has(x.key))) { S[k].push(x); added++; } });
      });
      m.clients.forEach((c) => { const mine = byId(S.clients, c.id); if (mine) mine.filingCodes = [...new Set([...(mine.filingCodes || []), ...(c.filingCodes || [])])]; });
      // Keep links consistent after merging: drop duplicate invoice numbers, re-mark billed jobs, clear dangling links.
      const seen = new Map(); let dup = 0;
      S.invoices = S.invoices.filter((i) => { const k = String(i.number).trim().toUpperCase(); if (seen.has(k) && seen.get(k) !== i.id) { dup++; return false; } seen.set(k, i.id); return true; });
      S.invoices.forEach((i) => i.jobIds.forEach((jid) => { const j = job(jid); if (j) { j.billing = 'Billed'; j.invoiceId = i.id; } }));
      S.expenses.forEach((e) => { if (e.invoiceId && !byId(S.invoices, e.invoiceId)) e.invoiceId = null; if (e.jobId && !job(e.jobId)) e.jobId = null; if (e.filingId && !byId(S.filings, e.filingId)) e.filingId = null; });
      S.jobs.forEach((j) => { if (j.filingId && !byId(S.filings, j.filingId)) j.filingId = null; if (j.invoiceId && !byId(S.invoices, j.invoiceId)) { j.invoiceId = null; j.billing = 'Not billed'; } });
      if (dup) added -= dup;
      Object.keys(m.settings).forEach((k) => { if (S.settings[k] == null || S.settings[k] === '') S.settings[k] = m.settings[k]; });
      S.seq.job = Math.max(S.seq.job || 0, m.seq.job || 0); S.started = true;
      closeModal(); toast(`${added} new records added${dup ? ` · ${dup} invoice${dup === 1 ? '' : 's'} skipped (number already exists)` : ''}`); location.hash = '#dashboard'; commit();
    };
  }
  function toCSV(cols, rows) {
    const q = (v) => { let s = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
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
    cloudSyncNow: () => { if (SY.dirty) { SY.state = 'saving'; footStatus(); cloudPush(); } else cloudRefresh(false); },
    cloudRelogin: () => showLogin('Sign in again to keep saving online. Your changes are kept in this browser.'),
    cloudSignOut: () => {
      const go = async () => { await CL.signOut(); try { localStorage.removeItem(KEY); localStorage.removeItem(META); } catch (e) { /* storage blocked */ } location.hash = ''; location.reload(); };
      if (SY.dirty || SY.busy) confirmBox('Sign out now?', 'Some changes are not saved online yet. Signing out now will discard them.', 'Sign out anyway', go); else go();
    },
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
    delPayment: (d) => { const i = byId(S.invoices, d.inv); const pm = i && i.payments.find((p) => p.id === d.id); if (!pm) return; confirmBox('Remove this payment?', `${inr(num(pm.amount) + num(pm.tds))} received on ${fmtD(pm.date)} will be removed from ${esc(i.number)}.`, 'Remove payment', () => { i.payments = i.payments.filter((p) => p.id !== d.id); toast('Payment removed'); }); },
    deleteInvoice: (d) => {
      const i = byId(S.invoices, d.id);
      confirmBox('Delete this invoice?', `${esc(i.number)} and its ${i.payments.length} payment record(s) will be removed. Its jobs go back to “Not billed”.`, 'Delete invoice', () => {
        i.jobIds.forEach((id) => { const j = job(id); if (j) { j.billing = 'Not billed'; j.invoiceId = null; } });
        S.expenses.forEach((e) => { if (e.invoiceId === i.id) e.invoiceId = null; });
        S.invoices = S.invoices.filter((x) => x.id !== i.id); location.hash = '#invoices'; toast('Invoice deleted');
      });
    },
    sort: (d) => { const st = UI[d.tbl]; if (st.sort === d.key) st.dir = -st.dir; else { st.sort = d.key; st.dir = 1; } render(); },
    att: (d) => { UI.att = d.k; render(); },
    jobsReady: (d, el, e) => { e.preventDefault(); UI.jobs.status = 'ready'; location.hash = '#jobs'; },
    rtab: (d) => { UI.reports.tab = d.k; render(); },
    filing: (d) => { const f = byId(S.filings, d.id); if (f) filingForm(f); },
    newExpense: (d, el, e) => { if (e) e.preventDefault(); expenseForm(null, { client: d.client, job: d.job, filing: d.filing }); },
    editExpense: (d) => { const x = byId(S.expenses, d.id); if (x) expenseForm(x); },
    compProfile: (d, el, e) => { if (e) e.preventDefault(); profileForm(d.id); },
    compYear: (d) => { UI.comp.y1 += num(d.d); render(); },
    compView: (d) => { UI.comp.view = d.k; render(); },
    genFilings: () => {
      const y1 = UI.comp.y1 || +fyOf().start.slice(0, 4);
      if (!S.clients.some((c) => (c.filingCodes || []).length)) { profileForm(); return; }
      const n = generateFilings(y1); toast(n ? `${n} filings added for ${fyStr(y1)}` : 'All filings for this year already exist'); commit();
    },
    setTarget: () => form({ title: 'Revenue target', values: { fyTarget: S.settings.fyTarget }, fields: [{ name: 'fyTarget', label: `Fee target for FY ${fyOf().label} (₹, excl. GST)`, type: 'number', min: 0, required: true, full: true }], onSave: (d) => { S.settings.fyTarget = num(d.fyTarget); toast('Target saved'); return true; } }),
    exportReport: () => { const t = reportTable(); const csv = toCSV(t.cols, t.total ? [...t.rows, t.total] : t.rows); const name = `cloudbook-${UI.reports.tab}-${todayISO()}.csv`; download(name, csv, 'text/csv'); toast('CSV exported'); },
    backup: () => { const txt = backupText(); download(`cloudbook-desk-backup-${todayISO()}.json`, txt, 'application/json'); S.settings.lastBackup = todayISO(); save(); toast('Backup downloaded'); render(); },
    backupXlsx: () => {
      try { download(xlsxName(true), new Blob([xlsxBytes()]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); S.settings.lastBackup = todayISO(); save(); toast('Excel backup downloaded'); render(); }
      catch (e) { toast(e.message); }
    },
    chooseBackupDir: async () => {
      if (!canAutoBackup()) { toast('Open the app in Chrome or Edge on a computer to use automatic backup'); return; }
      try {
        const h = await window.showDirectoryPicker({ id: 'cloudbook-backup', mode: 'readwrite' });
        await idb('readwrite', (st) => st.put(h, 'backupDir'));
        AB.dir = h; AB.state = 'on'; await writeAutoBackup(); toast(`Excel backup on: saving to “${h.name}”`); render();
      } catch (e) { if (e.name !== 'AbortError') toast('Could not use that folder: ' + e.message); }
    },
    resumeBackup: async () => {
      if (!AB.dir) return ACT.chooseBackupDir();
      try { const p = await AB.dir.requestPermission({ mode: 'readwrite' }); AB.state = p === 'granted' ? 'on' : 'paused'; if (AB.state === 'on') { await writeAutoBackup(); toast('Excel backup resumed'); } render(); } catch (e) { toast(e.message); }
    },
    backupNow: async () => { await writeAutoBackup(); toast('Excel backup saved'); render(); },
    stopBackup: async () => { try { await idb('readwrite', (st) => st.delete('backupDir')); } catch (e) { /* ignore */ } AB.dir = null; AB.state = canAutoBackup() ? 'off' : 'unsupported'; toast('Automatic backup turned off'); render(); },
    copyBackup: () => { const txt = backupText(); S.settings.lastBackup = todayISO(); save(); showText('Backup text', txt); },
    copyOut: () => { const ta = $('#out-text'); const done = () => toast('Copied'); if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('Press Ctrl+C to copy'); }); else { ta.select(); toast('Press Ctrl+C to copy'); } },
    importText: () => doImport($('#import-text').value),
    goImport: () => { location.hash = '#settings'; },
    start: () => { S.started = true; location.hash = '#settings'; commit(); toast('Check your firm details, then add clients'); },
    demo: () => {
      const go = () => { S = migrate(window.CB_DEMO ? window.CB_DEMO(blank, uid) : blank()); S.started = true;
        const y1 = +fyOf().start.slice(0, 4); generateFilings(y1); let k = 0;
        S.filings.forEach((f) => { if (daysFrom(f.due) < -20 && (k++ % 4 !== 0)) { f.status = 'Filed'; f.filedOn = addDays(f.due, -3); f.srn = 'AB' + (4000000 + k * 137); } else if (daysFrom(f.due) < 25 && daysFrom(f.due) >= -20) f.status = 'In progress'; }); location.hash = '#dashboard'; commit(); toast('Sample data loaded'); };
      if (S.jobs.length || S.clients.length) { confirmBox('Replace your data with sample data?', 'Everything in this browser will be replaced with a sample firm. Download a backup first if you need it.', 'Load sample data', go); } else go();
    },
    wipe: () => confirmBox('Delete all data?', (CL ? 'Every client, job, time entry and invoice will be deleted, online and in this browser, for everyone who signs in. Restore from a backup or the daily online copy if needed.' : 'Every client, job, time entry and invoice in this browser will be deleted. This cannot be undone unless you have a backup.'), 'Delete everything', async () => { await snapshotBackup('before-delete'); S = blank(); location.hash = '#dashboard'; toast('All data deleted'); commit(); }, 'DELETE'),
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
    if (c.dataset.change === 'jobStatus') { const j = job(c.dataset.id); j.status = c.value; j.doneOn = j.status === DONE ? (j.doneOn || todayISO()) : null;
      const fl = j.filingId ? byId(S.filings, j.filingId) : null; if (fl && j.status === DONE && fl.status !== 'Filed') { fl.status = 'Filed'; fl.filedOn = j.doneOn; } toast(j.status === DONE && j.billing === 'Not billed' && num(j.fee) ? 'Marked done — ready to bill' : 'Status updated'); commit(); }
    if (c.dataset.change === 'theme') { try { localStorage.setItem(THEME_KEY, c.value); } catch (err) { /* storage blocked */ } applyTheme(); }
    if (c.dataset.change === 'importFile') {
      const file = c.files[0]; if (!file) return; const r = new FileReader();
      if (/\.xlsx$/i.test(file.name)) { r.onload = async () => { try { doImport(await readExcelBackup(new Uint8Array(r.result))); } catch (err) { toast(err.message); } }; r.readAsArrayBuffer(file); }
      else { r.onload = () => doImport(String(r.result)); r.readAsText(file); }
      c.value = '';
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.dataset.submit === 'settings') {
      e.preventDefault();
      const fd = new FormData(e.target);
      fd.forEach((v, k) => { S.settings[k] = ['gstRate', 'invoiceDueDays', 'defaultCostRate', 'capacityHours', 'fyStartMonth', 'fyTarget'].includes(k) ? num(v) : String(v).trim(); });
      S.started = true; toast('Settings saved'); commit();
    }
    if (e.target.id === 'modal-form') { e.preventDefault(); ACT.formSave(); }
    if (e.target.id === 'login-form') { e.preventDefault(); doLogin(e.target); }
  });
  $('#menu-btn').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
  function applyTheme() {
    let t = 'system'; try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { /* storage blocked */ }
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });

  load(); applyTheme();
  if (CL) { $('#app').hidden = true; if (CL.signedIn()) cloudStart(); else showLogin(); }
  else { render(); initAutoBackup(); }
  window.CloudbookDesk = { get state() { return S; }, render, _ab: AB, _write: () => writeAutoBackup() };
})();
