# Run Campus Blood Match locally

## Start it

1. Install Node.js 18 or later if it is not already installed.
2. Double-click [`Start BloodMatch.bat`](./Start%20BloodMatch.bat), or open a terminal in this folder and run `npm start`.
3. Open `http://127.0.0.1:5502` in your browser. The batch file opens it automatically.

Running the app requires no external accounts, API keys, or npm runtime packages. It starts with no sample users, requests, or seeded demo records; users and admins enter data through the app. Blood-group choices and status values are domain rules in code, not pre-filled account or request data. User-entered records are stored in the ignored `local-data.json` file.

## Portfolio demo and analytics

The admin page includes request and donor-response analytics. If you want records for a walkthrough, enter them in **Demo requests** on the admin page. They are labeled `DEMO`; nothing is seeded automatically. **Clear demo requests** removes only entries created through that form and leaves regular recipient requests and all accounts untouched.

Recipients can review donor offers as accepted or declined, then mark their request fulfilled or cancel it. Closed requests cannot be reopened.

## Tests and project overview

Install the locked development dependencies with `npm ci`, then install Chromium once with `npx playwright install chromium`. Run `npm test` for syntax checks, QR contact/privacy unit tests, API security/integration tests, accessibility audits, and browser workflow tests. Every test uses temporary records and an isolated database; the app's `local-data.json` is not touched. Run `npm audit --audit-level=high` to check dependencies. See [README.md](./README.md) for features, [ARCHITECTURE.md](./ARCHITECTURE.md) for structure, and [PORTFOLIO_GUIDE.md](./PORTFOLIO_GUIDE.md) for a safe walkthrough.

## First administrator

On a new database, the server prints a random one-time first-admin setup code in its terminal. Keep it private. The registration page shows the setup-code field only until the first administrator is created. Once used, the code cannot create another admin. Other users register as donors or recipients. The current local database already has an administrator.

## Live updates and storage

The server pushes updates to connected browser tabs using Server-Sent Events. The local database remains on this computer and is loaded when the app restarts. Stopping the server interrupts sign-in and live features; start it again with `npm start`.

This project binds to `127.0.0.1` and is intended only as a local prototype. Other devices cannot connect to this address, and the server has no HTTPS, production account recovery, backups, or background push-notification service. Do not expose the server to the internet or enter real patient or sensitive medical information. Use a properly hosted backend and security review before any real campus deployment.
