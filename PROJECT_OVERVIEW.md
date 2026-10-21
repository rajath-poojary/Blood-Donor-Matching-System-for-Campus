# Campus Blood Match — Project Overview

## What the project does

Campus Blood Match is a web application prototype for coordinating blood requests between people who need donors and available campus donors. Recipients can post a request, compatible donors can volunteer, and the requester can review offers and record the outcome. Administrators can manage notices and review network activity.

This is a coordination tool, not a medical service. Blood groups and donor eligibility are entered by users and are not medically verified.

## User roles

### Recipient

- Register and sign in with an email and password.
- Create a blood request with patient name or initials, required blood group, urgency, location, and contact number.
- See donor offers on their requests.
- Accept or decline an offer.
- Mark an active request fulfilled or cancel it.

### Donor

- Register with a blood group and choose whether their profile is available for matching.
- View active requests considered compatible with their entered blood group.
- Volunteer for a request. The offer is attached to the signed-in donor account.
- Pause or resume availability in profile settings.
- Choose whether to share their phone number in the donor directory and on their QR contact card.

Compatibility is only an informational filter. Donors and recipients must confirm blood type and eligibility with qualified medical staff.

### Administrator

- Sign in through the separate **Admin sign in** page.
- Review network analytics, requests, and donor offers.
- Close active requests as cancelled.
- Publish campus notices, optionally linked to an active request.
- Create clearly labeled demo requests and clear those demo requests later.

There is no public first-admin signup form or setup code. The first administrator must be provisioned on the server using private environment variables, described below.

## Main workflows

### Request and donor offer

1. A recipient creates an active request.
2. The request appears on the mission board for signed-in users.
3. Compatible donors who are available can submit an offer.
4. The requester reviews offers and can accept or decline them.
5. The requester records whether the request was fulfilled or cancelled.

An offer means a donor volunteered; it does not confirm that a donation took place.

### Campus broadcast

1. An administrator publishes a notice and may link it to an active request.
2. The notice appears in the homepage campus notices, including for visitors who are not signed in.
3. A donor signs in and can volunteer from the linked notice if their profile is available and compatible with the request.
4. The offer is recorded against that donor account and is reviewable by the requester.

Announcement-only notices can be published without linking a request.

## Technology and structure

- **Frontend:** HTML, CSS, and browser JavaScript; responsive layout and keyboard-accessible navigation.
- **Backend:** Node.js built-in HTTP server in `server.js`.
- **Storage:** JSON data file, normally `local-data.json`. Local user-entered data is not tracked in Git.
- **Authentication:** server-side password hashing and HTTP-only session cookies; role checks are enforced by the API.
- **Live updates:** Server-Sent Events prompt open dashboards to refresh.
- **QR cards:** donor contact card data is assembled by `js/qr-card.js`; phone details are omitted unless the donor opts in.
- **Automated tests:** Node.js tests and Playwright browser tests, with accessibility checks.

Important files:

- `index.html` — application shell and asset loading.
- `js/app.js` — pages, navigation, dashboards, requests, notices, and admin UI.
- `js/login.js` — user and administrator sign-in actions.
- `js/store.js` — browser API client.
- `server.js` — HTTP API, authorization, persistence, and server startup.
- `css/` — application styling.
- `tests/` — unit, API integration, and browser workflow tests.

## Run locally

Requirements: Node.js 18 or later.

1. Open a terminal in the project directory.
2. Run `npm start`, or double-click `Start BloodMatch.bat`.
3. Open [http://127.0.0.1:5502](http://127.0.0.1:5502).

The server stores data in `local-data.json`. For privacy, do not put real patient details or real medical information into this prototype.

## First administrator setup

The server does not print a setup code and does not allow public admin registration. To create an initial administrator on a new database, set these **private server environment variables** before starting the server:

- `BOOTSTRAP_ADMIN_EMAIL` — administrator's sign-in email.
- `BOOTSTRAP_ADMIN_PASSWORD` — administrator's password (at least 8 characters).
- `BOOTSTRAP_ADMIN_NAME` — optional display name.

The server creates the administrator only when the data file does not already contain an admin. The password is stored as a salted hash. Never place these values in frontend code, commit them to GitHub, or share them in a public repository.

After setup, use **Admin sign in** and the configured email and password. If the server loses its data file, the admin may be recreated from these environment variables, but other users, requests, and notices will not be recovered.

## Hosting notes

GitHub stores the project source code; **GitHub Pages only serves static files** and cannot run this project's Node.js API or its JSON database. The full app requires a host that can run `npm start` and persist the configured data file.

For a hosted server such as Render:

1. Connect the repository to a Node.js web service and set the start command to `npm start`.
2. Add the admin bootstrap values as private service environment variables.
3. Configure persistent storage for the data file if accounts and requests must survive restarts or redeploys.
4. Keep credentials out of the repository and logs.

The server binds to `0.0.0.0` for platform hosting. This prototype has not been designed or security-reviewed for real patient data or production medical use.

## Tests

Install development dependencies and browser runtime if needed:

```text
npm ci
npx playwright install chromium
```

Run all checks with:

```text
npm test
```

The test suite checks QR privacy and formatting, API authentication and authorization, admin bootstrap, request and offer workflows, the campus broadcast flow, and browser accessibility. Tests use temporary data files and do not alter the normal local database.

## Important limitations

- This is a portfolio and coordination prototype, not an emergency service or clinical decision system.
- Blood type, availability, and donor eligibility are user-entered and unverified.
- There is no password recovery, backup system, or guarantee of persistent storage unless the host is configured for it.
- Do not expose real patient or sensitive medical information.
- In emergencies, contact emergency services or a blood bank.

## Further reading

- [README.md](./README.md) — concise project entry point.
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — local run and setup details.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime, data flows, and security boundaries.
- [PORTFOLIO_GUIDE.md](./PORTFOLIO_GUIDE.md) — presentation walkthrough.
