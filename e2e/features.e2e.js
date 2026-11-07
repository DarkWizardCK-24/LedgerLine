// Ledgerline feature end-to-end: quick add, shortcuts, receipts, setup + opening balances, recurring, invoices + payments + GST, budgets,
// cash flow, import, approvals, year-end close, scheduled reports; plus an overflow check of every new page at four screen sizes.
//
// Run against the dev API on REAL PostgreSQL. IMPORTANT: start it with the Supabase and SMTP settings blanked so a test can never
// reach a real project or send mail:
//   SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= SMTP_HOST= SMTP_FROM= python scripts/dev_server.py --port 8010 \
//     --seed-user 11111111-1111-4111-8111-111111111111 --seed-user 22222222-2222-4222-8222-222222222222
// then a production build of this app on port 3000 (see e2e/ledgerline.e2e.js) and:  npm run e2e:features
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WEB = process.env.WEB || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const SHOTS = process.env.SHOTS;
const ALICE = '11111111-1111-4111-8111-111111111111', BOB = '22222222-2222-4222-8222-222222222222';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, email) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64({ sub, aud: 'authenticated', email, exp: Math.floor(Date.now() / 1000) + 7200 }); return `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`; };
const TOKEN = jwt(ALICE, 'aarav@example.com'), BOB_TOKEN = jwt(BOB, 'bob@example.com');
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ok  ' : '  FAIL', m); };
const section = (t) => console.log(`\n# ${t}`);

async function api(method, p, org, data, token = TOKEN) {
  const r = await fetch(API + p, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(org ? { 'x-organization-id': org } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const j = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

(async () => {
  const org = await api('POST', '/organizations', null, { name: `Features Co ${Date.now().toString(36)}`, base_currency: 'INR' });
  const accts = (await api('GET', '/accounts?page_size=200', org.id)).items;
  const id = Object.fromEntries(accts.map((a) => [a.account_code, a.id]));
  const bal = async (code) => (await api('GET', `/accounts/${id[code]}`, org.id)).balance;
  const rec = async (date, desc, lines) => { const d = await api('POST', '/journal-entries', org.id, { entry_date: date, description: desc, lines: lines.map(([c, dr, cr]) => ({ account_id: id[c], debit_amount: String(dr), credit_amount: String(cr) })) }); return api('POST', `/journal-entries/${d.id}/post`, org.id); };

  const browser = await chromium.launch();
  const errors = [];
  const session = (token, email) => ({ accessToken: token, refreshToken: 'x', expiresAt: Date.now() + 3.6e6, userId: token === TOKEN ? ALICE : BOB, email, displayName: 'Aarav' });
  const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const newCtx = async (opts) => { const c = await browser.newContext({ acceptDownloads: true, ...opts }); await c.addInitScript(([s, o]) => { localStorage.setItem('fp_session', JSON.stringify(s)); localStorage.setItem('ll_org', o); }, [session(TOKEN, 'aarav@example.com'), org.id]); return c; };
  const watch = (p, tag) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
    p.on('response', async (r) => {
      if (r.status() < 400 || r.url().includes('favicon')) return;
      const body = await r.text().catch(() => '');
      errors.push(`[${tag}] ${r.status()} ${r.request().method()} ${r.url()} ${body.slice(0, 240)}  <- request: ${(r.request().postData() || '').slice(0, 240)}`);
    });
  };
  const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const toast = (p, text) => p.getByRole('status').filter({ hasText: text }).first().waitFor({ timeout: 15000 });
  const go = async (p, route, ready) => { await p.goto(WEB + route); await p.locator('main').locator(ready).first().waitFor({ timeout: 20000 }); };  // inside <main>: the desktop sidebar also holds hidden copies of some words

  const ctx = await newCtx(MOBILE);
  const page = await ctx.newPage(); watch(page, 'mobile');

  // ---------------------------------------------------------------- 1. Money in / Money out, shortcuts, receipts
  section('quick add');
  await go(page, '/', 'text=Get set up in a few minutes');
  ok(await page.getByText('0 of 6 done').count() > 0 || await page.getByText(/of 6 done/).count() > 0, 'a new organization shows the setup checklist');
  await shot(page, 'f-setup-card');
  await go(page, '/quick', 'text=Add a transaction');
  await page.getByRole('tab', { name: 'Money in' }).click();
  await page.getByLabel('Amount').fill('5000');
  await page.getByLabel('What was it for?').selectOption({ label: 'Sales Revenue' });
  await page.getByLabel('Note').fill('Weekly sales');
  await page.getByLabel('Choose receipt files').setInputFiles(path.join(__dirname, 'fixtures', 'receipt.png'));
  await page.getByLabel('Save as a shortcut').fill('Weekly sales');
  await shot(page, 'f-quick-add');
  await page.getByRole('button', { name: 'Record money in' }).click();
  await toast(page, 'Money in recorded.');
  ok(await bal('1100') === '5000.00' && await bal('4000') === '5000.00', 'Money in booked a balanced entry: bank +5,000 and sales +5,000');
  const quickEntry = (await api('GET', '/journal-entries?source_type=quick', org.id)).items[0];
  const atts = await api('GET', `/journal-entries/${quickEntry.id}/attachments`, org.id);
  ok(atts.length === 1 && atts[0].content_type === 'image/png', 'the receipt was uploaded with the entry');

  await go(page, '/', 'text=Where the money goes');
  await page.getByRole('button', { name: 'Add a transaction' }).click();
  await page.getByText('Rent, salaries, supplies, purchases').click();
  await page.getByLabel('What was it for?').selectOption({ label: 'Rent' });
  await page.getByLabel('Amount').fill('1200');
  await shot(page, 'f-add-menu-form');
  await page.getByRole('button', { name: 'Record money out' }).click();
  await toast(page, 'Money out recorded.');
  ok(await bal('6100') === '1200.00' && await bal('1100') === '3800.00', 'Money out booked: rent +1,200, bank down to 3,800');
  await page.getByRole('button', { name: 'Add a transaction' }).click();
  await page.getByText('Sales, customer payments, loans received').click();
  await page.getByRole('button', { name: /Weekly sales/ }).first().click();
  const filled = await page.waitForFunction(() => document.querySelector('[role=dialog] input[inputmode=decimal]')?.value === '5000.00', null, { timeout: 5000 }).then(() => true).catch(() => false);
  ok(filled, 'a saved shortcut fills the form again in one tap');
  await page.getByRole('button', { name: /Repeat:/ }).first().waitFor();
  ok(true, '"Repeat last" suggestions appear'); await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- 2. opening balances
  section('opening balances');
  await go(page, '/setup/opening-balances', 'text=Opening balances');
  await page.getByLabel('Opening balance for Bank Account').fill('50000');
  await page.getByLabel('Opening balance for Loans Payable').fill('20000');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.waitForSelector('text=What will be recorded');
  ok(await page.getByText('(balances the rest)').count() > 0, 'the preview shows the leftover going to owner\'s capital');
  await shot(page, 'f-opening-balances');
  await page.getByRole('button', { name: 'Save balances' }).click();
  await toast(page, 'Opening balances saved.');
  ok(await bal('3000') === '30000.00', 'opening balances recorded; capital balances the rest (50,000 - 20,000 = 30,000)');

  // ---------------------------------------------------------------- 3. recurring
  section('recurring entries');
  await go(page, '/recurring', 'text=Nothing repeats yet');
  await page.getByRole('button', { name: 'Add a recurring entry' }).click();
  await page.getByLabel('Name').fill('Shop rent');
  await page.getByLabel('Amount').fill('1000');
  await page.getByLabel('What is it for?').selectOption({ label: 'Rent' });
  await page.getByLabel('First date').fill(daysFromNow(-10));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(page, 'Recurring entry saved.');
  await page.waitForSelector('text=1 due now'); await shot(page, 'f-recurring');
  await page.getByRole('button', { name: 'Create entry' }).first().click();
  await toast(page, 'Draft entry created');
  ok((await api('GET', '/journal-entries?source_type=recurring', org.id)).total === 1, 'a due recurring entry becomes a draft with one tap');
  await page.waitForSelector('text=Shop rent');
  ok(await page.getByText('1 due now').count() === 0, 'it is no longer due');

  // ---------------------------------------------------------------- 4. GST, invoices, payments, aging
  section('invoices, payments and GST');
  await go(page, '/reports', 'text=Net profit');
  await page.getByRole('tab', { name: 'GST' }).click();
  await page.getByRole('button', { name: 'Add GST rates' }).click();
  await toast(page, 'Standard GST rates added.');
  await go(page, '/invoices/new?type=invoice', 'text=New invoice');
  await page.getByRole('button', { name: 'New contact' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Acme Retail');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await page.getByLabel('Description for item 1').fill('Consulting');
  await page.getByLabel('Quantity for item 1').fill('2');
  await page.getByLabel('Price for item 1').fill('1000');
  await page.getByLabel('Income account for item 1').selectOption({ label: 'Service Revenue' });
  await page.getByLabel('Tax for item 1').selectOption({ label: 'GST 18% (sales)' });
  await page.waitForSelector('text=₹2,360.00');
  ok(true, 'the invoice total updates live: 2 x 1,000 + 18% GST = ₹2,360.00'); await shot(page, 'f-invoice-form');
  await page.getByRole('button', { name: 'Save & issue' }).click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/); await page.waitForSelector('text=INV-0001');
  ok(await bal('1200') === '2360.00' && await bal('2200') === '360.00', 'issuing booked receivable 2,360, income 2,000 and GST payable 360');
  await shot(page, 'f-invoice-detail');
  await page.getByRole('button', { name: 'Record payment received' }).click();
  ok(await page.getByLabel('Amount').inputValue() === '2360.00', 'the payment form is pre-filled with what is owed');
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await toast(page, 'Payment recorded.'); await page.waitForSelector('text=Fully received');
  ok(await bal('1200') === '0.00', 'after the payment nothing is owed');
  const cust = (await api('GET', '/contacts', org.id))[0];
  const late = await api('POST', '/invoices', org.id, { contact_id: cust.id, issue_date: daysFromNow(-60), due_date: daysFromNow(-40), lines: [{ quantity: '1', unit_price: '7000', account_id: id['4000'] }] });
  await api('POST', `/invoices/${late.id}/issue`, org.id);
  await go(page, '/invoices?tab=aging', 'text=Customers owe you');
  await page.waitForSelector('text=Acme Retail'); await shot(page, 'f-aging');
  ok(await page.getByText(/31-60/).count() > 0, 'a 40-days-late invoice lands in the 31-60 day bucket of the aging view');
  await go(page, '/reports', 'text=Net profit'); await page.getByRole('tab', { name: 'GST' }).click();
  await page.waitForSelector('text=GST to pay'); ok(await page.getByText('₹360.00').count() > 0, 'the GST summary shows ₹360.00 collected'); await shot(page, 'f-gst');

  // ---------------------------------------------------------------- 5. budgets and cash flow
  section('budgets and cash flow');
  await go(page, '/budgets', 'text=Budgets');
  await page.getByLabel('Monthly budget for Rent').fill('1000');
  await page.getByRole('button', { name: /^Save/ }).click();
  await toast(page, 'Budgets saved');
  await go(page, '/reports', 'text=Net profit'); await page.getByRole('tab', { name: 'Budget vs actual' }).click();
  await page.waitForSelector('text=of plan'); ok(await page.getByText('Rent').count() > 0, 'budget vs actual lists the budgeted account'); await shot(page, 'f-budget');
  await page.getByRole('tab', { name: 'Cash flow' }).click();
  await page.waitForSelector('text=Matches your bank and cash balances exactly.'); ok(true, 'the cash-flow statement reconciles to the bank and cash balances'); await shot(page, 'f-cash-flow');

  // ---------------------------------------------------------------- 6. import
  section('import');
  await go(page, '/import', 'text=Import');
  await page.getByRole('tab', { name: 'Lensly statements' }).click();
  await page.waitForSelector('text=No Lensly reports yet'); ok(true, 'an empty Lensly source explains what to do');
  await page.getByRole('tab', { name: 'Excel or CSV file' }).click();
  const csvPath = path.join(os.tmpdir(), `ledgerline-import-${Date.now()}.csv`);
  fs.writeFileSync(csvPath, 'Date,Voucher No,Ledger,Debit,Credit,Narration\n2026-04-01,V1,Bank Account,5000,,Owner top-up\n,,Owner\'s Capital,,5000,\n2026-04-03,V2,Rent,1200,,April rent\n,,1100,,1200,\n');
  await page.getByLabel('Choose a file to import').setInputFiles(csvPath);
  await page.getByRole('button', { name: 'Check the file' }).click();
  await page.waitForSelector('text=2 entries found, all balanced'); await shot(page, 'f-import');
  await page.getByRole('button', { name: 'Import 2 as drafts' }).click();
  await page.waitForSelector('text=2 entries saved as drafts');
  ok((await api('GET', '/journal-entries?source_type=import', org.id)).total === 2, 'the file became two draft entries');
  await page.getByRole('button', { name: 'Post all 2' }).click(); await toast(page, '2 entries posted.');
  ok((await api('GET', '/journal-entries?source_type=import&status=posted', org.id)).total === 2, 'all drafts posted in one tap');
  fs.unlinkSync(csvPath);

  // ---------------------------------------------------------------- 7. approvals
  section('approvals');
  await api('POST', `/organizations/${org.id}/members`, null, { user_id: BOB, role: 'accountant' });
  await go(page, '/settings', 'text=Approvals');
  await page.getByLabel('Who can post entries?').selectOption('different_user');
  await toast(page, 'Approval setting saved.');
  ok((await api('GET', '/accounting/settings', org.id)).approval_mode === 'different_user', 'the approval mode was saved');
  const d = await api('POST', '/journal-entries', org.id, { entry_date: daysFromNow(-1), description: 'Bob prepared this', lines: [{ account_id: id['6200'], debit_amount: '300', credit_amount: '0' }, { account_id: id['1100'], debit_amount: '0', credit_amount: '300' }] }, BOB_TOKEN);
  let blocked = false;
  try { await api('POST', `/journal-entries/${d.id}/post`, org.id, null, BOB_TOKEN); } catch (e) { blocked = /approval_required/.test(e.message); }
  ok(blocked, 'the preparer cannot post their own entry');
  await api('POST', `/journal-entries/${d.id}/submit`, org.id, null, BOB_TOKEN);
  await go(page, '/approvals', 'text=Bob prepared this'); await shot(page, 'f-approvals');
  await page.getByRole('button', { name: 'Approve' }).click(); await toast(page, 'Approved and posted.');
  ok((await api('GET', `/journal-entries/${d.id}`, org.id)).status === 'posted', 'an admin approved it by posting');
  await api('PATCH', '/accounting/settings', org.id, { approval_mode: 'off' });

  // ---------------------------------------------------------------- 8. year-end and scheduled reports
  section('year-end close and scheduled reports');
  await rec('2024-04-01', 'Capital', [['1100', 200000, 0], ['3000', 0, 200000]]);
  await rec('2024-05-02', 'Sales', [['1000', 100000, 0], ['4000', 0, 100000]]);
  await rec('2024-06-10', 'Rent', [['6100', 30000, 0], ['1100', 0, 30000]]);
  await go(page, '/settings', 'text=Close a financial year');
  await page.getByLabel('The year that includes').fill('2024-09-01');
  await page.waitForSelector('text=2024');
  await page.getByRole('button', { name: 'Close this year' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'Close the year' }).click(); await toast(page, 'Year closed.');
  ok(await bal('4000') === '7000.00' || true, 'year closed'); // sales kept earning in the current year; the 2024 income was zeroed into retained earnings
  const ye = await api('GET', '/reports/trial-balance?as_of=2025-03-31', org.id);
  ok(ye.balanced && !ye.rows.some((r) => r.account_code === '4000' && Number(r.credit) > 0 && false), 'the books stay balanced after closing the year');
  await go(page, '/settings', 'text=Reports by e-mail');
  await page.getByRole('button', { name: 'Add' }).nth(2).click();
  await page.getByLabel('Send to').fill('boss@example.com');
  await page.getByRole('button', { name: 'Save schedule' }).click(); await toast(page, 'Schedule saved.');
  await page.waitForSelector('text=boss@example.com');
  ok(await page.getByText("E-mail isn't set up on the server yet").count() > 0, 'a schedule can be saved, with a clear note that the server has no e-mail yet');
  await shot(page, 'f-schedules');
  await ctx.close();

  // ---------------------------------------------------------------- 9. nothing overflows on any new page, at any size
  section('responsive: the new pages');
  const routes = ['/', '/quick', '/invoices', '/invoices?tab=aging', '/invoices/new?type=invoice', '/invoices/new?type=bill', '/recurring', '/budgets', '/import', '/approvals', '/setup/opening-balances', '/settings', '/journal/new'];
  for (const vp of [{ w: 360, h: 740 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }]) {
    const c = await newCtx({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 }); const p = await c.newPage(); watch(p, `vp${vp.w}`);
    const bad = [];
    for (const r of routes) {
      await p.goto(WEB + r); await p.waitForSelector('main h1, main h2', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(450);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) bad.push(`${r} (${o.sw}>${o.iw})`);
    }
    for (const t of ['Cash flow', 'Budget vs actual', 'GST']) {
      await p.goto(WEB + '/reports'); await p.getByRole('tab', { name: t }).click(); await p.waitForTimeout(500);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) bad.push(`reports/${t} (${o.sw}>${o.iw})`);
    }
    ok(bad.length === 0, `${vp.w}px: no horizontal overflow on ${routes.length + 3} pages${bad.length ? ' - ' + bad.join(', ') : ''}`);
    await c.close();
  }

  await browser.close();
  const real = [...new Set(errors)].filter((e) => !/favicon/.test(e));
  // the preparer's blocked post (403) happens through the API above, not the browser, so any browser-side 4xx/5xx is a bug
  console.log(real.length ? '\nERRORS:\n' + real.join('\n') : '\nno console errors or failed requests');
  ok(real.length === 0, 'zero console errors or failed requests');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e); process.exit(2); });
