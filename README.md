# Campus Blood Match

A local-first blood donor matching portfolio project. Donors and recipients enter their own account and request information; the app does not load seeded users, requests, or demo fixtures. Blood groups and workflow statuses are fixed domain choices, not pre-filled user data. Test fixtures are created only in disposable test databases.

## Run locally

1. Install Node.js 18 or later.
2. Run `npm start` from this folder, or double-click [`Start BloodMatch.bat`](./Start%20BloodMatch.bat).
3. Open [http://127.0.0.1:5502](http://127.0.0.1:5502).

The app stores its local data in the ignored `local-data.json` file. For a new database, the server prints a one-time admin setup code in the terminal. The current machine’s existing database is not changed by running the automated tests.

## Features

- A mission-control interface with data-driven overview cards and a per-request timeline from opening through donor offers and closure.
- Donor and recipient registration, sign-in, editable profiles, and donor availability.
- Separate administrator sign-in page with server-enforced admin-only authentication.
- Recipient blood requests, compatible donor matching, donor offers, and recipient accept/decline decisions.
- Requesters can mark requests fulfilled or cancelled; administrators can cancel active requests.
- Public homepage campus broadcasts that can link to an active request; eligible signed-in donors can volunteer directly from the notice.
- Live in-browser updates, optional browser reminders, and donor QR cards.
- Admin analytics for account counts, request status, donor responses, fulfillment, and requests by blood group.
- Admin-entered demo requests are labeled `DEMO` and can be cleared separately. No demo records are generated automatically.

## Verify

Run `npm ci` and `npx playwright install chromium` once, then `npm test` for syntax checks, unit tests, API security/integration tests, accessibility audits, and browser end-to-end tests. All test accounts and requests are generated at test runtime in temporary data files that are removed afterward; the app's `local-data.json` is not used. `npm run test:unit` and `npm run test:e2e` can also be run separately. Run `npm audit --audit-level=high` to check installed dependencies.

GitHub Actions runs the same test suite and a high-severity dependency audit on pushes and pull requests. Axe accessibility audits run across the home, account, donor, request, QR, and admin screens. Browser tests also cover fresh setup, role registration and sign-in, recipient request creation, donor offers, request fulfillment, donor QR generation/privacy, admin notices, mobile navigation, keyboard access, and HTML injection escaping.

Keyboard users can skip directly to the main content, use the labeled mobile navigation control, and see focus indicators on interactive elements. The donor QR card is generated from a separately tested vCard builder; phone details remain excluded unless the donor explicitly opts in.

## Project structure

- `server.js` — local HTTP API, authentication, persistence, authorization, matching, and live events.
- `js/store.js` — browser API client.
- `js/qr-card.js` — vCard payload builder used by donor QR cards.
- `js/app.js` — navigation, role dashboards, request lifecycle, and admin tools.
- `css/` — application theme and animations.
- `tests/qr-card.test.js` — unit tests for QR content, phone privacy, and vCard escaping.
- `tests/server.test.js` — isolated Node.js API integration test.
- `tests/e2e/app.spec.js` — Playwright browser journeys using a temporary server/database.
- `@axe-core/playwright` — automated accessibility checks in browser tests.
- `playwright.config.js` — headless Chromium test configuration.
- `.github/workflows/ci.yml` — automated test workflow.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data flow, boundaries, and design notes.
- [`PORTFOLIO_GUIDE.md`](./PORTFOLIO_GUIDE.md) — safe walkthrough and interview-ready project summary.

## Scope and safety

This is a local portfolio prototype, not a medical service. It binds to `127.0.0.1`, has no public hosting or account recovery, and does not verify blood group or donor eligibility. Do not expose it directly to the internet or enter real patient/medical information. Confirm all medical decisions with qualified professionals.
