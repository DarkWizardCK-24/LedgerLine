<div align="center">

<img src="docs/branding/logo-wordmark.png" width="440" alt="Ledgerline" />

**Every entry balanced. Every report live.**

Ledgerline is a double-entry accounting app for small businesses. Record transactions as balanced journal entries, and get the ledger, trial balance, profit & loss and balance sheet instantly, calculated from your books and never typed in by hand.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Installable](https://img.shields.io/badge/Installable-PWA-0E8A5B)

</div>

---

Part of the **Finance Platform**, alongside **Ledgerly** (multi-ledger CashBook) and **Lensly** (statement analyzer). One account signs in to all three.

## Screenshots

### On your phone

Built mobile-first: a bottom tab bar with a raised "new entry" button, bottom sheets instead of pop-ups, and cards instead of wide tables.

| Sign in | Overview | Journal | New entry, balanced | New entry, out of balance | Posted entry |
|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/ledgerline/mobile/01-sign-in.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/02-dashboard.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/03-journal.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/04-journal-entry-balanced.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/05-journal-entry-unbalanced.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/06-journal-entry-posted.png" width="130" /> |

| Chart of accounts | General ledger | Profit & loss | Balance sheet | Trial balance | Search |
|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/ledgerline/mobile/07-chart-of-accounts.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/08-general-ledger.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/09-profit-and-loss.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/10-balance-sheet.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/11-trial-balance.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/17-search.png" width="130" /> |

| Reconciliations | Reconciliation workspace | Match a statement line | Settings | More menu |
|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/ledgerline/mobile/12-reconciliation-list.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/13-reconciliation-workspace.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/14-reconciliation-match-sheet.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/15-settings.png" width="130" /> | <img src="docs/screenshots/ledgerline/mobile/16-more-menu.png" width="130" /> |

### On desktop

A sidebar with dense tables and keyboard search (`Ctrl/⌘ K`), in light and dark mode.

| Overview | Overview, dark mode |
|:--:|:--:|
| <img src="docs/screenshots/ledgerline/desktop/01-dashboard.png" width="440" /> | <img src="docs/screenshots/ledgerline/desktop/10-dashboard-dark.png" width="440" /> |
| **Journal** | **New journal entry** |
| <img src="docs/screenshots/ledgerline/desktop/02-journal.png" width="440" /> | <img src="docs/screenshots/ledgerline/desktop/03-journal-entry.png" width="440" /> |
| **General ledger** | **Chart of accounts** |
| <img src="docs/screenshots/ledgerline/desktop/04-general-ledger.png" width="440" /> | <img src="docs/screenshots/ledgerline/desktop/05-chart-of-accounts.png" width="440" /> |
| **Profit & loss** | **Balance sheet** |
| <img src="docs/screenshots/ledgerline/desktop/06-profit-and-loss.png" width="440" /> | <img src="docs/screenshots/ledgerline/desktop/07-balance-sheet.png" width="440" /> |
| **Bank reconciliation** | **Settings: team, periods, exports** |
| <img src="docs/screenshots/ledgerline/desktop/08-reconciliation.png" width="440" /> | <img src="docs/screenshots/ledgerline/desktop/09-settings.png" width="440" /> |

**Tablet**

<img src="docs/screenshots/ledgerline/desktop/11-tablet-dashboard.png" width="360" />

## Logo & icons

The mark is an **L** (the ledger's spine and base line) with two equal lines beside it: debit equals credit. It sits on an emerald-to-gold gradient.

| Logo | Wordmark | App icon (192) | App icon (512) | Maskable | iOS |
|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/branding/logo.png" width="96" /> | <img src="docs/branding/logo-wordmark.png" width="190" /> | <img src="docs/branding/pwa-icon-192.png" width="96" /> | <img src="docs/branding/pwa-icon-512.png" width="96" /> | <img src="docs/branding/pwa-icon-maskable-512.png" width="96" /> | <img src="docs/branding/apple-touch-icon.png" width="96" /> |

Vector originals: [`logo.svg`](docs/branding/logo.svg) and [`logo-wordmark.svg`](docs/branding/logo-wordmark.svg).

## Design

- **Palette, Emerald & Gold:** deep emerald `#0E8A5B`, fresh green `#12A06A`, warm gold `#F2C14E`, coral `#D2493B` for money going out, on warm paper `#F4F3EC`. No blue or violet anywhere.
- **Fonts:** Fraunces for headings, Inter for the interface, with tabular numerals so amounts line up digit for digit.
- **Light and dark** themes follow your device setting.
- **Adaptive layout:** bottom tab bar on phones, sidebar on tablets and desktop, nothing ever scrolls sideways.
- **Installable:** add it to your home screen on Android or iOS and it opens like a native app.

## Features

### Journal
- Record entries with any number of lines, each a debit or a credit, with live totals and a clear *balanced / out by …* indicator
- Save drafts, edit them, discard them, then post when ready
- Entries get gapless numbers (JE-000001, JE-000002 …) when posted
- Posted entries can never be edited or deleted; corrections are a linked **reversal** entry, so the history stays intact
- Search and filter by status, date, description, reference or account

### Chart of accounts
- A ready-made chart for a new organization, fully editable
- Five account types with subtypes (cash, bank, receivables, inventory, loans, owner's capital, sales, rent …)
- Parent and child accounts, automatic account codes, activate / deactivate
- System accounts are protected; accounts with transactions can't be deleted

### Ledger and reports
- **General ledger** per account with opening balance, period totals, a running balance and drill-down to the original entry
- **Trial balance**, **profit & loss** (compare with the previous period, month-by-month) and **balance sheet** (compare dates)
- The balance sheet includes current-year profit and rolls earlier years into retained earnings; it never forces a balance, so a problem is shown, not hidden
- Export any report as **PDF** (with your organization's name) or **CSV**

### Bank reconciliation
- Import your bank or card statement from a **CSV file**, or add lines by hand
- Match each statement line to a ledger entry; clear suggestions are offered, and you decide what gets matched
- Money that is on the statement but missing from your books becomes a **draft entry** for you to review, never posted automatically
- Finish only when the difference is exactly zero; completed reconciliations are kept as read-only history
- Cheques not yet cashed carry forward to the next statement; duplicate rows are flagged

### Control and teamwork
- **Roles:** viewer, accountant, admin and owner, each with clear permissions
- Add team members by email and change their role at any time
- **Financial periods:** close a period to lock its dates, reopen it when needed
- **Audit history** of every important action, with before and after values
- Several organizations in one account, with a quick switcher

### Everyday convenience
- Live **overview** with profit, assets, liabilities, equity, income vs expenses, where the money goes, and a "needs attention" list (stale drafts, unusual balances, overdue reconciliations)
- **Global search** across accounts and entries
- One base currency per organization, with configurable decimal places
- Exact decimal arithmetic everywhere, so totals are never off by a paisa

## Good to know

- Amounts are stored and calculated exactly, never as floating-point numbers.
- Everything on screen is calculated from posted entries only; drafts never change a report.
- Each organization's data is private to its members.
- The same sign-in works across Ledgerly, Lensly and Ledgerline, and all three share one backend.
