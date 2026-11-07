/* Sample firm for exploring Cloudbook Desk. All names are fictional.
   Dates are generated relative to today so the dashboard always looks current. */
window.CB_DEMO = (blank, uid) => {
  const S = blank();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = (k) => { const d = new Date(today.getFullYear(), today.getMonth() + k, 1); return M[d.getMonth()] + ' ' + d.getFullYear(); };
  const dueOn = (k, dd) => iso(new Date(today.getFullYear(), today.getMonth() + k, dd));

  S.settings.firmName = 'Sample Associates LLP';
  S.settings.gstin = '32ABCDE1234F1Z5';
  S.settings.address = 'Sample address, Thiruvananthapuram, Kerala';
  S.team = [
    { id: 'm1', name: 'Partner (you)', role: 'Designated Partner', costRate: 600, billRate: 1500, capacity: 150, active: true },
    { id: 'm2', name: 'Neha R', role: 'Senior accountant', costRate: 280, billRate: 700, capacity: 160, active: true },
    { id: 'm3', name: 'Rahul K', role: 'Article assistant', costRate: 120, billRate: 400, capacity: 160, active: true },
  ];
  const C = (name, type, city, contact, extra = {}) => ({ id: uid('c'), name, type, city, contact, phone: '98470 00000', email: '', gstin: '', pan: '', notes: '', ...extra });
  const clients = [
    C('Malabar Spice Exports Pvt Ltd', 'Company', 'Kochi', 'Ravi Menon', { gstin: '32AAACM1234A1ZQ' }),
    C('Greenleaf Wellness LLP', 'LLP', 'Varkala', 'Anjali Nair', { gstin: '32AAKFG5678B1Z2' }),
    C('Kovalam Stays LLP', 'LLP', 'Kovalam', 'Thomas Varghese'),
    C('Dr. Meera Pillai', 'Proprietorship', 'Kollam', 'Dr. Meera Pillai', { pan: 'ABCPP1234K' }),
    C('Periyar Traders', 'Partnership firm', 'Thrissur', 'Joseph K'),
    C('Anand Krishnan', 'Individual', 'Thiruvananthapuram', 'Anand Krishnan', { pan: 'AKKPK4321L' }),
    C('Lakeview Tech Solutions Pvt Ltd', 'Company', 'Technopark', 'Priya S', { gstin: '32AADCL7788C1Z9' }),
  ];
  S.clients = clients;
  clients[0].filingCodes = ['AGM', 'AOC4', 'MGT7', 'ADT1', 'DIR3', 'ITRCO', 'GSTR9', 'TDS'];
  clients[1].filingCodes = ['F8', 'F11', 'DIR3', 'ITRLLP', 'GSTR9', 'TDS'];
  clients[2].filingCodes = ['F8', 'F11', 'DIR3'];
  clients[6].filingCodes = ['AGM', 'AOC4', 'MGT7', 'DIR3', 'DPT3', 'MSME1', 'ITRCO', 'TAR', 'TDS'];
  const [spice, green, stays, meera, periyar, anand, lake] = clients;
  let seq = 0;
  const jobs = [];
  const J = (c, title, service, o) => {
    seq += 1;
    const j = { id: uid('j'), code: 'J-' + pad(seq).padStart(4, '0'), clientId: c.id, title, service, period: '', ownerId: 'm2', start: day(-20), due: day(5), status: 'In progress', priority: 'Normal', fee: 0, budgetHours: 0, govtFees: 0, recurring: 'none', billing: 'Not billed', invoiceId: null, notes: '', doneOn: null, ...o };
    jobs.push(j); return j;
  };
  // Finished and billed
  const j1 = J(spice, `GST returns – ${monthName(-2)}`, 'GST return filing (GSTR-1 & 3B)', { period: monthName(-2), fee: 2500, budgetHours: 3, recurring: 'monthly', status: 'Filed / Done', doneOn: day(-38), due: dueOn(-1, 20), billing: 'Billed', nextId: 'x' });
  const j2 = J(lake, 'Financial statements FY 2025-26', 'Financial statements – company', { period: 'FY 2025-26', fee: 45000, budgetHours: 40, ownerId: 'm1', status: 'Filed / Done', doneOn: day(-30), due: day(-28), billing: 'Billed' });
  const j3 = J(green, 'TDS return Q2', 'TDS return', { period: 'Q2 FY 2026-27', fee: 4000, budgetHours: 4, recurring: 'quarterly', status: 'Filed / Done', doneOn: day(-12), due: day(-10), billing: 'Billed' });
  const j4 = J(anand, 'ITR AY 2026-27', 'Income tax return – individual', { period: 'FY 2025-26', fee: 2000, budgetHours: 2, ownerId: 'm3', status: 'Filed / Done', doneOn: day(-60), due: day(-58), billing: 'Billed' });
  // Finished, not billed
  const j5 = J(stays, 'LLP Form 8', 'LLP Form 8 (statement of accounts)', { period: 'FY 2025-26', fee: 1800, budgetHours: 3, govtFees: 400, status: 'Filed / Done', doneOn: day(-6), due: day(-7) });
  const j6 = J(meera, 'Books, financial statements and ITR', 'Financial statements – LLP / firm', { period: 'FY 2025-26', fee: 9000, budgetHours: 14, ownerId: 'm1', status: 'Filed / Done', doneOn: day(-3), due: day(-2) });
  const j7 = J(spice, `GST returns – ${monthName(-1)}`, 'GST return filing (GSTR-1 & 3B)', { period: monthName(-1), fee: 2500, budgetHours: 3, recurring: 'monthly', status: 'Filed / Done', doneOn: day(-15), due: dueOn(0, 20) > day(0) ? day(-14) : dueOn(0, 20), govtFees: 0 });
  // Open work
  const j8 = J(periyar, 'Firm reconstitution – retirement deed and new deed', 'Consultation / advisory', { fee: 12000, budgetHours: 14, ownerId: 'm1', status: 'Waiting on client', due: day(-4), priority: 'High' });
  const j9 = J(green, `GST returns – ${monthName(-1)}`, 'GST return filing (GSTR-1 & 3B)', { period: monthName(-1), fee: 1200, budgetHours: 2.5, recurring: 'monthly', status: 'Review', due: day(2) });
  const j10 = J(lake, 'TDS return Q2', 'TDS return', { period: 'Q2 FY 2026-27', fee: 4000, budgetHours: 4, recurring: 'quarterly', status: 'In progress', due: day(6), ownerId: 'm3' });
  const j11 = J(stays, 'GST registration', 'GST registration', { fee: 3000, budgetHours: 4, status: 'Not started', due: day(12), ownerId: 'm3' });
  const j12 = J(spice, 'GST annual return GSTR-9', 'GST annual return (GSTR-9)', { period: 'FY 2025-26', fee: 6000, budgetHours: 8, recurring: 'annual', status: 'Not started', due: day(40) });
  const j13 = J(lake, 'ROC annual filing AOC-4 & MGT-7', 'ROC annual filing (AOC-4 & MGT-7)', { period: 'FY 2025-26', fee: 8000, budgetHours: 8, govtFees: 1200, ownerId: 'm1', status: 'In progress', due: day(9) });
  const j14 = J(anand, 'Advance tax computation', 'Consultation / advisory', { fee: 1500, budgetHours: 1.5, ownerId: 'm1', status: 'Not started', due: day(22) });
  S.jobs = jobs;
  S.seq.job = seq;

  // Time entries
  const T = (j, m, d, h, note) => S.time.push({ id: uid('t'), jobId: j.id, memberId: m, date: day(d), hours: h, note, costRate: S.team.find((x) => x.id === m).costRate });
  T(j1, 'm2', -40, 2, 'GSTR-2B reconciliation'); T(j1, 'm3', -39, 1.5, 'Sales register check');
  T(j2, 'm1', -45, 10, 'Review of trial balance and notes'); T(j2, 'm2', -44, 18, 'Schedules and depreciation'); T(j2, 'm3', -42, 14, 'Ledger scrutiny'); T(j2, 'm1', -31, 6, 'Finalisation with client');
  T(j3, 'm2', -13, 3, 'Challan matching and 26Q');
  T(j4, 'm3', -61, 2.5, 'AIS / 26AS review and filing');
  T(j5, 'm2', -7, 2, 'Form 8 preparation and filing');
  T(j6, 'm2', -10, 9, 'Bookkeeping from bank statement'); T(j6, 'm1', -4, 6, 'Financials and ITR'); T(j6, 'm3', -9, 6, 'Vouching');
  T(j7, 'm2', -16, 2.5, 'Returns filed');
  T(j8, 'm1', -9, 6, 'Drafting retirement deed'); T(j8, 'm1', -5, 5, 'Client meeting and revisions'); T(j8, 'm2', -5, 3, 'Capital account workings');
  T(j9, 'm2', -1, 2, 'Reconciliation'); T(j10, 'm3', -2, 2, 'Data collection');
  T(j13, 'm1', -3, 3, 'Board report and AOC-4 draft'); T(j13, 'm2', -2, 2, 'MGT-7 draft');

  // Invoices and payments
  const I = (c, number, d, js, extra = {}) => {
    const fee = js.reduce((s, j) => s + j.fee, 0), reimb = js.reduce((s, j) => s + (j.govtFees || 0), 0), gst = Math.round(fee * 18) / 100;
    const inv = { id: uid('i'), clientId: c.id, number, date: day(d), dueDate: day(d + 15), fee, gst, reimb, total: Math.round(fee + gst + reimb), jobIds: js.map((j) => j.id), payments: [], notes: '', ...extra };
    js.forEach((j) => { j.billing = 'Billed'; j.invoiceId = inv.id; });
    S.invoices.push(inv); return inv;
  };
  const i1 = I(spice, 'INV-000101', -37, [j1]);
  const i2 = I(lake, 'INV-000102', -29, [j2]);
  const i3 = I(green, 'INV-000103', -11, [j3]);
  const i4 = I(anand, 'INV-000098', -58, [j4]);
  I(periyar, 'INV-000088', -130, [], { fee: 9000, gst: 1620, reimb: 0, total: 10620, notes: 'Partnership firm ITR and accounts FY 2024-25' });
  i1.payments.push({ id: uid('p'), date: day(-20), amount: 2700, tds: 250, mode: 'Bank transfer', ref: 'UTR 4471' });
  i2.payments.push({ id: uid('p'), date: day(-8), amount: 30000, tds: 4500, mode: 'Bank transfer', ref: 'Part payment' });
  i3.payments.push({ id: uid('p'), date: day(-1), amount: 4320, tds: 400, mode: 'Bank transfer', ref: 'UTR 9921' });
  i4.payments.push({ id: uid('p'), date: day(-50), amount: 2360, tds: 0, mode: 'UPI', ref: '' });
  // Earlier months for the trend chart
  for (let k = 5; k >= 2; k--) {
    const inv = { id: uid('i'), clientId: [spice, green, lake, stays][k % 4].id, number: 'INV-0000' + (60 + k), date: dueOn(-k, 8), dueDate: dueOn(-k, 23), fee: 14000 + k * 3500, gst: 0, reimb: 0, total: 0, jobIds: [], payments: [], notes: 'Earlier work' };
    inv.gst = Math.round(inv.fee * 18) / 100; inv.total = Math.round(inv.fee + inv.gst);
    inv.payments.push({ id: uid('p'), date: dueOn(-k + 1, 5), amount: inv.total - Math.round(inv.fee * 0.1), tds: Math.round(inv.fee * 0.1), mode: 'Bank transfer', ref: '' });
    S.invoices.push(inv);
  }
  S.expenses = [
    { id: uid('x'), date: day(-9), clientId: periyar.id, jobId: j8.id, category: 'Stamp paper / notary', description: 'Stamp paper and notary for retirement deed', amount: 1150, recover: true, paidBy: 'Cash', ref: 'Receipt 221', invoiceId: null, notes: '' },
    { id: uid('x'), date: day(-5), clientId: periyar.id, jobId: j8.id, category: 'Travel and conveyance', description: 'Two visits to client office, Thrissur', amount: 1800, recover: false, paidBy: 'Partner personally', ref: '', invoiceId: null, notes: '' },
    { id: uid('x'), date: day(-3), clientId: lake.id, jobId: j13.id, category: 'MCA / ROC filing fee', description: 'MCA fee AOC-4 and MGT-7', amount: 1200, recover: true, paidBy: 'Firm bank account', ref: 'SRN pending', invoiceId: null, notes: '' },
    { id: uid('x'), date: day(-40), clientId: green.id, jobId: null, category: 'DSC (digital signature)', description: 'Class 3 DSC for designated partner', amount: 1350, recover: true, paidBy: 'Firm card / UPI', ref: 'eMudhra order 5531', invoiceId: null, notes: '' },
  ];
  j13.govtFees = 0; j13.govtMigrated = true;
  void j11; void j12; void j14; void stays;
  return S;
};
