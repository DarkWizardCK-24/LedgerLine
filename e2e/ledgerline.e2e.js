// Ledgerline end-to-end: REAL backend on REAL Postgres + the production build. Only Supabase sign-in is mocked
// (a signed test token is placed in localStorage), exactly as the Lensly suite does.
//
//   # terminal 1 (backend/): two seeded users; the web origin must be allowed by CORS (3000 is allowed by default)
//   python scripts/dev_server.py --port 8010 --seed-user 11111111-1111-4111-8111-111111111111 --seed-user 22222222-2222-4222-8222-222222222222
//   # terminal 2 (apps/ledgerline_web/):
//   NEXT_PUBLIC_API_BASE_URL=http://localhost:8010 NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock npm run build && npm start
//   # terminal 3:  npm run e2e        (set SHOTS=<dir> to keep screenshots)
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WEB = process.env.WEB || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const SHOTS = process.env.SHOTS;
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB_EMAIL = '22222222@example.com'; // dev_server.py creates seeded users as <first 8 chars>@example.com

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const head = b64({ alg: 'HS256', typ: 'JWT' });
const body = b64({ sub: ALICE, aud: 'authenticated', email: 'aarav@example.com', exp: Math.floor(Date.now() / 1000) + 7200 });
const TOKEN = `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ok  ' : '  FAIL', m); };
const section = (t) => console.log(`\n# ${t}`);

async function api(method, p, org, data) {
  const r = await fetch(API + p, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(org ? { 'x-organization-id': org } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const j = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

(async () => {
  // ---------------------------------------------------------------- seed a realistic book (April-start financial year)
  const stamp = Date.now().toString(36);
  const org = await api('POST', '/organizations', null, { name: `Sharma Traders ${stamp}`, legal_name: 'Sharma Traders Pvt Ltd', base_currency: 'INR' });
  const id = Object.fromEntries((await api('GET', '/accounts?page_size=200', org.id)).items.map((a) => [a.account_code, a.id]));
  const rec = async (date, desc, lines) => {
    const d = await api('POST', '/journal-entries', org.id, { entry_date: date, description: desc, lines: lines.map(([c, dr, cr]) => ({ account_id: id[c], debit_amount: String(dr), credit_amount: String(cr) })) });
    return api('POST', `/journal-entries/${d.id}/post`, org.id);
  };
  await rec('2026-04-01', 'Owner capital invested', [['1100', 100000, 0], ['3000', 0, 100000]]);
  await rec('2026-04-10', 'Shop rent', [['6100', 10000, 0], ['1100', 0, 10000]]);
  await rec('2026-04-29', 'Electricity cheque', [['6200', 2500, 0], ['1100', 0, 2500]]);
  await rec('2026-04-30', 'Staff salaries', [['6000', 5000, 0], ['1100', 0, 5000]]);
  await rec('2026-05-03', 'Cash sales', [['1000', 240000, 0], ['4000', 0, 240000]]);
  await rec('2026-05-06', 'Consulting invoice', [['1200', 95000, 0], ['4100', 0, 95000]]);
  await api('POST', '/journal-entries', org.id, { entry_date: '2026-05-09', description: 'Pending vendor payment (draft)', lines: [{ account_id: id['6900'], debit_amount: '3000', credit_amount: '0' }, { account_id: id['1100'], debit_amount: '0', credit_amount: '3000' }] });

  const browser = await chromium.launch();
  const errors = [];
  const session = { accessToken: TOKEN, refreshToken: 'x', expiresAt: Date.now() + 3.6e6, userId: ALICE, email: 'aarav@example.com', displayName: 'Aarav' };
  const newCtx = async (opts, signedIn = true) => {
    const ctx = await browser.newContext({ acceptDownloads: true, ...opts });
    if (signedIn) await ctx.addInitScript(([s, o]) => { localStorage.setItem('fp_session', JSON.stringify(s)); localStorage.setItem('ll_org', o); }, [session, org.id]);
    return ctx;
  };
  const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const watch = (page, tag) => {
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[${tag}] ${r.status()} ${r.url()}`); });
  };
  const shot = async (page, name, full = false) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full }); } };
  const main = (page) => page.locator('main');

  // ---------------------------------------------------------------- 1. sign-in screen
  section('sign-in screen');
  {
    const ctx = await newCtx(MOBILE, false); const p = await ctx.newPage(); watch(p, 'login');
    await p.goto(WEB + '/login'); await p.waitForSelector('text=Welcome back'); await shot(p, 'login');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'login fits the phone width');
    await p.getByRole('button', { name: 'Create an account' }).click(); await p.waitForSelector('text=Create your account');
    ok(await p.getByLabel('Your name').isVisible(), 'sign-up mode shows the name field');
    await ctx.close();
    const c2 = await newCtx(MOBILE, false); const p2 = await c2.newPage();
    await p2.goto(WEB + '/journal'); await p2.waitForURL(/\/login$/); ok(true, 'a protected page redirects a signed-out visitor to /login');
    await c2.close();
  }

  // ---------------------------------------------------------------- 2. reconciliation through the real UI (phone)
  section('reconciliation (phone)');
  const ctx = await newCtx(MOBILE); const page = await ctx.newPage(); watch(page, 'mobile');
  await page.goto(WEB + '/reconciliation'); await page.waitForSelector('text=No reconciliations yet'); await shot(page, 'recon-empty');
  await page.getByRole('button', { name: 'Start a reconciliation' }).click();
  const bankValue = await page.locator('select option', { hasText: '1100 · Bank Account' }).first().getAttribute('value');
  await page.getByLabel('Account', { exact: true }).selectOption(bankValue);
  await page.getByLabel('Statement from').fill('2026-04-01'); await page.getByLabel('Statement to').fill('2026-04-30');
  await page.getByLabel('Closing balance on the statement').fill('84850');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForURL(/\/reconciliation\/[0-9a-f-]{36}$/); await page.waitForSelector('text=Difference to explain');
  ok(await page.getByText('₹84,850.00').count() > 0, 'a new reconciliation shows the whole statement balance as unexplained');
  await shot(page, 'recon-new');

  await page.getByRole('button', { name: 'Import CSV' }).click();
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixtures', 'april-statement.csv'));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForSelector('text=4 line(s) imported'); await shot(page, 'recon-imported');
  await page.getByRole('button', { name: 'Done' }).click();
  ok(await page.getByText('Bank charges').count() > 0, 'imported statement lines are listed');

  await page.getByRole('button', { name: /Match 3 sure/ }).click();
  await page.waitForSelector('text=3 line(s) matched.'); ok(true, 'the three unambiguous suggestions are applied only when the user asks');
  ok(await page.getByRole('button', { name: 'Complete' }).isDisabled(), 'Complete stays disabled while a statement line is unmatched');
  ok(await page.getByText('statement line(s) are not matched').count() > 0 || await page.getByText('not matched to a ledger entry').count() > 0, 'the blocker is explained');
  await shot(page, 'recon-partial');

  // the bank charge is not in the books: create a DRAFT, post it by hand, then match
  await page.getByText('Bank charges').first().click();
  await page.getByRole('tab', { name: 'Not in books' }).click();
  await page.getByLabel('Other side of the entry').selectOption({ label: '7000 · Interest & Bank Charges' });
  await shot(page, 'recon-adjust');
  await page.getByRole('button', { name: 'Create draft entry' }).click();
  await page.waitForURL(/\/journal\/[0-9a-f-]{36}$/); await page.waitForSelector('text=DRAFT');
  ok(await page.getByText('draft', { exact: true }).count() > 0, 'the adjustment is created as a DRAFT, not posted');
  await page.getByRole('button', { name: 'Post entry' }).click(); await page.getByRole('button', { name: 'Post entry' }).last().click();
  await page.waitForSelector('text=Posted entries can');
  await page.goto(WEB + '/reconciliation'); await page.getByText('Bank Account').first().click();
  await page.waitForSelector('text=Difference to explain');
  await page.getByText('Bank charges').first().click();
  await page.getByRole('button', { name: 'Match', exact: true }).first().click();
  await page.waitForSelector('text=Everything matches'); await shot(page, 'recon-ready');
  ok(await page.getByText('₹0.00').count() > 0, 'difference reaches exactly ₹0.00');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'reconciliation workspace fits the phone width');
  await page.getByRole('button', { name: 'Complete' }).first().click(); await page.getByRole('button', { name: 'Complete' }).last().click();
  await page.waitForSelector('text=Reconciliation completed.'); await page.waitForSelector('text=Reconciled');
  ok(true, 'reconciliation completed'); await shot(page, 'recon-done');
  ok(await page.getByRole('button', { name: 'Complete' }).count() === 0, 'a completed reconciliation offers no editing actions');
  await page.getByText('Electricity').count();
  await page.goto(WEB + '/reconciliation'); await page.waitForSelector('text=History'); ok(await page.getByText('Reconciled').count() > 0, 'history lists the completed reconciliation');

  // ---------------------------------------------------------------- 3. dashboard, search, reports/PDF, settings (phone)
  section('dashboard / search / reports (phone)');
  await page.goto(WEB + '/'); await page.waitForSelector('text=Books status'); await page.waitForSelector('text=Where the money goes'); await page.waitForTimeout(700);
  await shot(page, 'dashboard', true);
  ok(await page.getByText('Needs attention').isVisible(), 'dashboard shows the attention panel');
  await page.getByRole('button', { name: 'Search' }).click(); await page.getByLabel('Search accounts and entries').fill('rent');
  await page.waitForSelector('text=Shop rent'); ok(await page.getByText('Rent', { exact: true }).count() > 0, 'global search finds accounts and entries'); await shot(page, 'search');
  await page.keyboard.press('Escape');

  await page.goto(WEB + '/reports'); await page.waitForSelector('text=Net profit');
  const dl = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()]);
  const pdfPath = await dl[0].path(); const head4 = fs.readFileSync(pdfPath).subarray(0, 4).toString();
  ok(head4 === '%PDF' && dl[0].suggestedFilename() === 'profit-and-loss.pdf', `PDF export downloads a real PDF named by the server (${dl[0].suggestedFilename()})`);
  const dl2 = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  ok(dl2[0].suggestedFilename() === 'profit-and-loss.csv', `CSV export downloads (${dl2[0].suggestedFilename()})`);

  await page.goto(WEB + '/settings'); await page.waitForSelector('text=Financial periods');
  await page.getByRole('button', { name: 'Add' }).nth(1).click();
  await page.getByLabel('Name', { exact: true }).fill('April 2026'); await page.getByLabel('Starts').fill('2026-04-01'); await page.getByLabel('Ends').fill('2026-04-30');
  await page.getByRole('button', { name: 'Create period' }).click(); await page.waitForSelector('text=Period created.');
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Close period' }).click();
  await page.waitForSelector('text=Period closed.'); ok(await page.getByText('closed', { exact: true }).count() > 0, 'a financial period is created and closed from the UI');
  // posting into the closed period is refused with a clear message
  await page.goto(WEB + '/journal/new'); await page.waitForSelector('text=Line 1');
  await page.getByLabel('Date', { exact: true }).fill('2026-04-15'); await page.getByLabel('Account for line 1').selectOption({ label: '1000 · Cash on Hand' }); await page.getByLabel('Amount for line 1').fill('10');
  await page.getByLabel('Account for line 2').selectOption({ label: '3000 · Owner\'s Capital' }); await page.getByRole('radio', { name: 'Cr' }).nth(1).click(); await page.getByLabel('Amount for line 2').fill('10');
  await page.getByRole('button', { name: 'Post entry' }).click(); await page.waitForSelector('text=falls in the closed financial period');
  ok(true, 'posting into a closed period is refused with an explanation'); await shot(page, 'period-closed-error');

  await page.goto(WEB + '/settings'); await page.waitForSelector('text=Team');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await page.getByLabel('Email', { exact: true }).fill(BOB_EMAIL); await page.getByRole('button', { name: 'Add member' }).click();
  await page.waitForSelector('text=Member added.'); ok(await page.getByText(BOB_EMAIL).count() > 0, 'a member is added by email and shown in the team list');
  await page.getByLabel(`Role for ${BOB_EMAIL}`).selectOption('viewer'); await page.waitForSelector('text=Role updated.'); ok(true, 'a member role can be changed');
  await shot(page, 'settings', true);
  await page.getByRole('button', { name: 'Add' }).first().click(); await page.getByLabel('Email', { exact: true }).fill('nobody@example.com'); await page.getByRole('button', { name: 'Add member' }).click();
  await page.waitForSelector('text=No account uses that email'); ok(true, 'an unknown email gets a helpful error');
  await ctx.close();

  // ---------------------------------------------------------------- 4. responsive matrix: no sideways scrolling anywhere
  section('responsive matrix');
  const routes = ['/', '/journal', '/journal/new', '/accounts', '/ledger', '/reports', '/reconciliation', '/audit', '/settings'];
  for (const vp of [{ w: 360, h: 740 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }]) {
    const c = await newCtx({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 }); const p = await c.newPage(); watch(p, `vp${vp.w}`);
    const bad = [];
    for (const r of routes) {
      await p.goto(WEB + r); await p.waitForSelector('main h1, main h2', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) bad.push(`${r} (${o.sw}>${o.iw})`);
    }
    ok(bad.length === 0, `${vp.w}px: no horizontal overflow on ${routes.length} pages${bad.length ? ' — ' + bad.join(', ') : ''}`);
    if (vp.w === 360) await shot(p, 'm360-dashboard');
    if (vp.w === 768) await shot(p, 'tablet-settings');
    await c.close();
  }

  // ---------------------------------------------------------------- 5. dark mode + desktop
  section('dark mode and desktop');
  {
    const c = await newCtx({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); const p = await c.newPage(); watch(p, 'dark');
    await p.goto(WEB + '/'); await p.waitForSelector('text=Where the money goes'); await p.waitForTimeout(700);
    const lum = await p.evaluate(() => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; });
    ok(lum < 60, `dark mode uses a dark background (luminance ${Math.round(lum)})`); await shot(p, 'dark-dashboard', true);
    await p.keyboard.press('Control+k'); await p.waitForSelector('[aria-label="Search accounts and entries"]'); ok(true, 'Ctrl+K opens search on desktop');
    await p.keyboard.press('Escape');
    await p.goto(WEB + '/ledger'); await p.waitForSelector('table'); await shot(p, 'dark-ledger');
    await c.close();
  }
  {
    const c = await newCtx({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); watch(p, 'desktop');
    await p.goto(WEB + '/reconciliation'); await p.waitForSelector('text=History'); await shot(p, 'd-recon');
    await p.goto(WEB + '/reports'); await p.waitForSelector('text=Net profit'); await shot(p, 'd-reports');
    ok(await p.locator('aside').isVisible(), 'desktop shows the sidebar'); await c.close();
  }

  await browser.close();
  const real = [...new Set(errors)].filter((e) => !/favicon/.test(e));
  // the deliberate closed-period / unknown-email attempts above legitimately return 4xx; anything else is a bug
  const unexpected = real.filter((e) => !/\b(409|404) http:\/\/localhost:8010\/api\/v1\/(journal-entries\/[0-9a-f-]+\/post|organizations\/[0-9a-f-]+\/members)/.test(e) && !/Failed to load resource: the server responded with a status of (409|404)/.test(e));
  console.log(unexpected.length ? '\nUNEXPECTED ERRORS:\n' + unexpected.join('\n') : '\nno unexpected console errors or failed requests');
  ok(unexpected.length === 0, 'zero unexpected console errors or failed requests');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E CRASH', e); process.exit(2); });
