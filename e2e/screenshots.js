// Captures the README gallery: phone (390x844 @2x) and desktop (1440x900) screens of a realistic, seeded book.
// Same setup as e2e/ledgerline.e2e.js (dev_server on 8010 + production build on 3000). Output: apps/ledgerline_web/docs/screenshots/ledgerline/
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WEB = process.env.WEB || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const OUT = process.env.OUT || path.join(__dirname, '..', 'docs', 'screenshots', 'ledgerline');
const ALICE = '11111111-1111-4111-8111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const head = b64({ alg: 'HS256', typ: 'JWT' });
const body = b64({ sub: ALICE, aud: 'authenticated', email: 'aarav@example.com', exp: Math.floor(Date.now() / 1000) + 7200 });
const TOKEN = `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;

async function api(method, p, org, data) {
  const r = await fetch(API + p, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(org ? { 'x-organization-id': org } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const j = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'mobile'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'desktop'), { recursive: true });
  const org = await api('POST', '/organizations', null, { name: 'Sharma Traders', legal_name: 'Sharma Traders Pvt Ltd', base_currency: 'INR' });
  const id = Object.fromEntries((await api('GET', '/accounts?page_size=200', org.id)).items.map((a) => [a.account_code, a.id]));
  const rec = async (date, desc, lines, ref = '') => {
    const d = await api('POST', '/journal-entries', org.id, { entry_date: date, description: desc, reference_number: ref, lines: lines.map(([c, dr, cr]) => ({ account_id: id[c], debit_amount: String(dr), credit_amount: String(cr) })) });
    return api('POST', `/journal-entries/${d.id}/post`, org.id);
  };
  await rec('2026-04-01', 'Owner capital invested', [['1100', 500000, 0], ['3000', 0, 500000]], 'CAP-001');
  await rec('2026-04-03', 'Shop rent for April', [['6100', 45000, 0], ['1100', 0, 45000]], 'CHQ-0771');
  await rec('2026-04-08', 'Cash sales, week 1', [['1000', 180000, 0], ['4000', 0, 180000]]);
  await rec('2026-04-12', 'Staff salaries', [['6000', 70000, 0], ['1100', 0, 70000]], 'NEFT-9921');
  await rec('2026-04-18', 'Consulting invoice 1042', [['1200', 95000, 0], ['4100', 0, 95000]], 'INV-1042');
  await rec('2026-04-22', 'Electricity bill', [['6200', 8200.5, 0], ['1100', 0, 8200.5]]);
  await rec('2026-04-25', 'Marketing campaign', [['6300', 22000, 0], ['1100', 0, 22000]]);
  await rec('2026-04-29', 'Laptops for the team', [['1520', 120000, 0], ['2000', 0, 120000]], 'BILL-5530');
  await rec('2026-04-30', 'Cash sales, week 4', [['1000', 240000, 0], ['4000', 0, 240000]]);
  await rec('2026-05-02', 'Depreciation, April', [['6400', 4000, 0], ['1590', 0, 4000]]);
  await api('POST', '/journal-entries', org.id, { entry_date: '2026-05-05', description: 'Vendor payment (draft)', lines: [{ account_id: id['6900'], debit_amount: '3000', credit_amount: '0' }, { account_id: id['1100'], debit_amount: '0', credit_amount: '3000' }] });
  // a reconciliation in progress, built from the REAL bank entries so the story is coherent:
  // the statement has every bank line except an outstanding cheque, plus a bank charge that is not in the books yet
  await rec('2026-04-28', 'Cheque to supplier (not yet cashed)', [['6500', 12000, 0], ['1100', 0, 12000]], 'CHQ-0788');
  const bankLines = (await api('GET', `/accounts/${id['1100']}/ledger?page_size=100`, org.id)).items.filter((r) => r.description !== 'Cheque to supplier (not yet cashed)');
  const fmt = (iso) => iso.split('-').reverse().join('/');
  const rows = bankLines.map((r) => [fmt(r.entry_date), r.description, r.reference_number, Number(r.credit) > 0 ? r.credit : '', Number(r.debit) > 0 ? r.debit : '']);
  rows.push(['30/04/2026', 'Bank charges', '', '150.00', '']);
  const closing = bankLines.reduce((t, r) => t + Number(r.debit) - Number(r.credit), 0) - 150;
  const csv = ['Date,Description,Ref No,Withdrawal,Deposit', ...rows.map((r) => r.map((c) => (String(c).includes(',') ? `"${c}"` : c)).join(','))].join('\n');
  const s = await api('POST', '/reconciliations', org.id, { account_id: id['1100'], statement_start_date: '2026-04-01', statement_end_date: '2026-04-30', closing_balance: closing.toFixed(2) });
  await api('POST', `/reconciliations/${s.id}/import`, org.id, { csv_text: csv });
  const sug = await api('GET', `/reconciliations/${s.id}/suggestions`, org.id);
  for (const g of sug.slice(0, sug.length - 1)) await api('POST', `/reconciliations/${s.id}/match`, org.id, { item_id: g.item_id, journal_entry_line_id: g.candidates[0].line_id });
  const firstEntry = (await api('GET', '/journal-entries?status=posted&page_size=1', org.id)).items[0];


  // ---- the second feature set: GST, customers, invoices and bills, recurring entries, budgets, templates, a pending approval
  const BOB = '22222222-2222-4222-8222-222222222222';
  const bobTok = (() => { const hh = b64({ alg: 'HS256', typ: 'JWT' }), bb = b64({ sub: BOB, aud: 'authenticated', email: 'bob@example.com', exp: Math.floor(Date.now() / 1000) + 7200 }); return `${hh}.${bb}.${crypto.createHmac('sha256', SECRET).update(`${hh}.${bb}`).digest('base64url')}`; })();
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  await api('POST', '/tax-codes/seed-gst', org.id);
  const tax = Object.fromEntries((await api('GET', '/tax-codes', org.id)).map((t) => [t.name, t.id]));
  const acme = await api('POST', '/contacts', org.id, { name: 'Acme Retail', kind: 'customer', email: 'accounts@acme.example', tax_id: '29ABCDE1234F1Z5' });
  const beta = await api('POST', '/contacts', org.id, { name: 'Beta Stores', kind: 'customer' });
  const paper = await api('POST', '/contacts', org.id, { name: 'Paper Co', kind: 'vendor' });
  const mkInv = async (contact, due, lines, pay) => {
    const inv = await api('POST', '/invoices', org.id, { contact_id: contact.id, issue_date: day(due - 30), due_date: day(due), reference: 'PO-' + Math.floor(Math.random() * 900 + 100), lines });
    await api('POST', `/invoices/${inv.id}/issue`, org.id);
    if (pay) await api('POST', `/invoices/${inv.id}/payments`, org.id, { payment_date: day(-1), amount: String(pay), account_id: id['1100'] });
    return inv;
  };
  const svc = (price, qty = 1, t = 'GST 18% (sales)') => [{ description: 'Consulting services', quantity: String(qty), unit_price: String(price), account_id: id['4100'], tax_code_id: tax[t] }];
  await mkInv(acme, -20, svc(24000, 1), 0);
  await mkInv(beta, 10, svc(15000, 2), 0);
  await mkInv(acme, -50, svc(9000, 1), 9000 * 1.18);
  const open = await mkInv(beta, -5, svc(5000, 3), 5000);
  await api('POST', '/invoices', org.id, { contact_id: acme.id, issue_date: day(0), due_date: day(30), lines: svc(12000, 1) });
  const bill = await api('POST', '/bills', org.id, { contact_id: paper.id, issue_date: day(-12), due_date: day(18), lines: [{ description: 'Office paper', quantity: '40', unit_price: '250', account_id: id['6500'], tax_code_id: tax['GST 18% (purchases)'] }] });
  await api('POST', `/bills/${bill.id}/issue`, org.id);
  const tmpl = (name, kind, desc, a, b, amt, extra = {}) => api('POST', '/templates', org.id, { name, kind, description: desc, lines: kind === 'money_in' ? [{ account_id: id[a], debit_amount: amt }, { account_id: id[b], credit_amount: amt }] : [{ account_id: id[b], debit_amount: amt }, { account_id: id[a], credit_amount: amt }], ...extra });
  await tmpl('Shop rent', 'money_out', 'Shop rent', '1100', '6100', '45000', { is_recurring: true, frequency: 'monthly', next_run_date: day(-3) });
  await tmpl('Staff salaries', 'money_out', 'Staff salaries', '1100', '6000', '70000', { is_recurring: true, frequency: 'monthly', next_run_date: day(12), auto_post: true });
  await tmpl('Internet bill', 'money_out', 'Internet', '1100', '6200', '1499', { is_recurring: true, frequency: 'monthly', next_run_date: day(20) });
  await tmpl('Weekly sales', 'money_in', 'Weekly cash sales', '1000', '4000', '60000');
  for (const [acct, amt] of [['4000', 600000], ['4100', 300000], ['6100', 45000], ['6000', 70000], ['6300', 30000], ['6200', 12000]]) {
    for (const m of ['2026-04', '2026-05', '2026-06']) void m;
    await api('PUT', '/account-budgets', org.id, { account_id: id[acct], start_month: '2026-04', end_month: '2027-03', amount: String(amt / 12 | 0) });
  }
  await api('POST', `/organizations/${org.id}/members`, null, { user_id: BOB, role: 'accountant' });
  await api('PATCH', '/accounting/settings', org.id, { approval_mode: 'different_user' });
  const prep = await api('POST', '/journal-entries', org.id, { entry_date: day(-2), description: 'Courier and packing charges', lines: [{ account_id: id['6900'], debit_amount: '3850', credit_amount: '0' }, { account_id: id['1100'], debit_amount: '0', credit_amount: '3850' }] }, bobTok);
  await api('POST', `/journal-entries/${prep.id}/submit`, org.id, null, bobTok);

  const browser = await chromium.launch();
  const session = { accessToken: TOKEN, refreshToken: 'x', expiresAt: Date.now() + 3.6e6, userId: ALICE, email: 'aarav@example.com', displayName: 'Aarav' };
  const ctxFor = async (opts, signedIn = true) => {
    const c = await browser.newContext(opts);
    if (signedIn) await c.addInitScript(([ss, o]) => { localStorage.setItem('fp_session', JSON.stringify(ss)); localStorage.setItem('ll_org', o); }, [session, org.id]);
    return c;
  };
  const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const DESK = { viewport: { width: 1440, height: 1650 }, deviceScaleFactor: 1 }; // tall: the sticky sidebar then fills full-page captures
  const snap = async (p, dir, name, full = false) => { await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, dir, name + '.png'), fullPage: full }); console.log('  ', dir + '/' + name); };
  const go = async (p, route, ready) => { await p.goto(WEB + route); await p.locator('main').locator(ready).first().waitFor({ timeout: 20000 }); };

  // ---------------------------------------------------------------- phone
  console.log('phone');
  { const c = await ctxFor(MOBILE, false); const p = await c.newPage(); await p.goto(WEB + '/login'); await p.waitForSelector('text=Welcome back'); await snap(p, 'mobile', '01-sign-in'); await c.close(); }
  const mc = await ctxFor(MOBILE); const m = await mc.newPage();
  await go(m, '/', 'text=Where the money goes'); await snap(m, 'mobile', '02-dashboard', true);
  await go(m, '/journal', 'text=Cash sales'); await snap(m, 'mobile', '03-journal');
  await go(m, '/journal/new', 'text=Line 1');
  await m.getByLabel('Description').fill('Office furniture bought for cash');
  await m.getByLabel('Account for line 1').selectOption({ label: '1510 · Furniture & Equipment' }); await m.getByLabel('Amount for line 1').fill('12500.75');
  await m.getByLabel('Account for line 2').selectOption({ label: '1000 · Cash on Hand' }); await m.getByRole('radio', { name: 'Cr' }).nth(1).click(); await m.getByLabel('Amount for line 2').fill('12500.75');
  await m.waitForSelector('text=Balanced, ready to post'); await snap(m, 'mobile', '04-journal-entry-balanced');
  await m.getByLabel('Amount for line 2').fill('12000'); await m.waitForSelector('text=more to balance'); await snap(m, 'mobile', '05-journal-entry-unbalanced');
  await go(m, `/journal/${firstEntry.id}`, 'text=Reverse entry'); await snap(m, 'mobile', '06-journal-entry-posted');
  await go(m, '/accounts', 'text=Bank Account'); await snap(m, 'mobile', '07-chart-of-accounts');
  await go(m, `/ledger?account=${id['1100']}`, 'text=transaction'); await snap(m, 'mobile', '08-general-ledger');
  await go(m, '/reports', 'text=Net profit'); await snap(m, 'mobile', '09-profit-and-loss');
  await m.getByRole('tab', { name: 'Balance sheet' }).click(); await m.waitForSelector('text=Assets equal liabilities plus equity'); await snap(m, 'mobile', '10-balance-sheet');
  await m.getByRole('tab', { name: 'Trial balance' }).click(); await m.waitForSelector('text=Debits equal credits'); await snap(m, 'mobile', '11-trial-balance');
  await go(m, '/reconciliation', 'text=In progress'); await snap(m, 'mobile', '12-reconciliation-list');
  await m.getByText('Bank Account').first().click(); await m.waitForSelector('text=Difference to explain'); await snap(m, 'mobile', '13-reconciliation-workspace');
  await m.getByText('Bank charges').first().click(); await m.waitForSelector('text=Statement line'); await snap(m, 'mobile', '14-reconciliation-match-sheet');
  await go(m, '/settings', 'text=Financial periods'); await snap(m, 'mobile', '15-settings', true);
  await go(m, '/', 'text=Where the money goes'); await m.getByRole('button', { name: 'More' }).click(); await m.waitForSelector('text=Sign out'); await snap(m, 'mobile', '16-more-menu');
  await m.keyboard.press('Escape'); await m.getByRole('button', { name: 'Search' }).click(); await m.getByLabel('Search accounts and entries').fill('rent'); await m.waitForSelector('text=Shop rent for April'); await snap(m, 'mobile', '17-search');
  await mc.close();

  // ---- new features (phone)
  console.log('phone: features');
  const mf = await ctxFor(MOBILE); const f = await mf.newPage();
  await go(f, '/', 'text=Where the money goes'); await f.getByRole('button', { name: 'Add a transaction' }).click(); await f.waitForSelector('text=Documents'); await snap(f, 'mobile', '18-add-menu');
  await f.getByText('Sales, customer payments, loans received').click(); await f.getByRole('button', { name: /Weekly sales/ }).first().click(); await snap(f, 'mobile', '19-quick-money-in');
  await f.keyboard.press('Escape');
  await go(f, '/setup/opening-balances', 'text=Opening balances'); await f.getByLabel('Opening balance for Bank Account').fill('250000'); await f.getByLabel('Opening balance for Loans Payable').fill('100000'); await f.getByRole('button', { name: 'Preview' }).click(); await f.waitForSelector('text=What will be recorded'); await snap(f, 'mobile', '20-opening-balances');
  await go(f, '/invoices', 'text=Customers owe you'); await snap(f, 'mobile', '21-invoices');
  const firstInv = (await api('GET', '/invoices?status=open&page_size=1', org.id)).items[0];
  await go(f, `/invoices/${firstInv.id}?type=invoice`, 'text=Record payment received'); await snap(f, 'mobile', '22-invoice-detail', true);
  await go(f, '/invoices?tab=aging', 'text=Customers owe you'); await f.waitForSelector('text=Acme Retail'); await snap(f, 'mobile', '23-aging');
  await go(f, '/recurring', 'text=due now'); await snap(f, 'mobile', '24-recurring');
  await go(f, '/reports', 'text=Net profit'); await f.getByRole('tab', { name: 'Cash flow' }).click(); await f.waitForSelector('text=Matches your bank and cash balances exactly.'); await snap(f, 'mobile', '25-cash-flow', true);
  await f.getByRole('tab', { name: 'Budget vs actual' }).click(); await f.waitForSelector('text=of plan'); await snap(f, 'mobile', '26-budget-vs-actual', true);
  await f.getByRole('tab', { name: 'GST' }).click(); await f.waitForSelector('text=GST to pay'); await snap(f, 'mobile', '27-gst');
  await go(f, '/import', 'text=Import'); await f.getByRole('tab', { name: 'Excel or CSV file' }).click(); await snap(f, 'mobile', '28-import');
  await go(f, '/approvals', 'text=Courier and packing charges'); await snap(f, 'mobile', '29-approvals');
  await go(f, '/journal/new', 'text=Line 1'); await f.getByRole('button', { name: 'What are debit and credit?' }).click(); await snap(f, 'mobile', '30-plain-language-hint');
  await mf.close();

  // ---------------------------------------------------------------- desktop
  console.log('desktop');
  const dc = await ctxFor(DESK); const d = await dc.newPage();
  await go(d, '/', 'text=Where the money goes'); await snap(d, 'desktop', '01-dashboard', true);
  await go(d, '/journal', 'text=Cash sales'); await snap(d, 'desktop', '02-journal');
  await go(d, '/journal/new', 'text=Line 1'); await snap(d, 'desktop', '03-journal-entry');
  await go(d, `/ledger?account=${id['1100']}`, 'table'); await snap(d, 'desktop', '04-general-ledger');
  await go(d, '/accounts', 'text=Bank Account'); await snap(d, 'desktop', '05-chart-of-accounts', true);
  await go(d, '/reports', 'text=Net profit'); await snap(d, 'desktop', '06-profit-and-loss', true);
  await d.getByRole('tab', { name: 'Balance sheet' }).click(); await d.waitForSelector('text=Assets equal liabilities plus equity'); await snap(d, 'desktop', '07-balance-sheet', true);
  await go(d, `/reconciliation/${s.id}`, 'text=Difference to explain'); await snap(d, 'desktop', '08-reconciliation', true);
  await go(d, '/settings', 'text=Financial periods'); await snap(d, 'desktop', '09-settings', true);
  await dc.close();

  // ---- new features (desktop)
  console.log('desktop: features');
  const df = await ctxFor(DESK); const g = await df.newPage();
  await go(g, '/', 'text=Where the money goes'); await snap(g, 'desktop', '12-dashboard-with-setup', true);
  await go(g, '/invoices', 'text=Customers owe you'); await snap(g, 'desktop', '13-invoices', true);
  const invOpen = (await api('GET', '/invoices?status=open&page_size=1', org.id)).items[0];
  await go(g, `/invoices/${invOpen.id}?type=invoice`, 'text=Record payment received'); await snap(g, 'desktop', '14-invoice-detail', true);
  await go(g, '/reports', 'text=Net profit'); await g.getByRole('tab', { name: 'Cash flow' }).click(); await g.waitForSelector('text=Matches your bank and cash balances exactly.'); await snap(g, 'desktop', '15-cash-flow', true);
  await g.getByRole('tab', { name: 'Budget vs actual' }).click(); await g.waitForSelector('text=of plan'); await snap(g, 'desktop', '16-budget-vs-actual', true);
  await go(g, '/recurring', 'text=due now'); await snap(g, 'desktop', '17-recurring', true);
  await go(g, '/invoices/new?type=invoice', 'text=New invoice'); await snap(g, 'desktop', '18-new-invoice', true);
  await go(g, '/settings', 'text=Reports by e-mail'); await snap(g, 'desktop', '19-settings-team-and-controls', true);
  await df.close();
  const kc = await ctxFor({ ...DESK, colorScheme: 'dark' }); const k = await kc.newPage();
  await go(k, '/', 'text=Where the money goes'); await snap(k, 'desktop', '10-dashboard-dark', true);
  await kc.close();
  const tc = await ctxFor({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); const t = await tc.newPage();
  await go(t, '/', 'text=Where the money goes'); await snap(t, 'desktop', '11-tablet-dashboard');
  await tc.close();

  await browser.close();
  console.log('done ->', OUT);
})().catch((e) => { console.error('SCREENSHOT CRASH', e); process.exit(2); });
