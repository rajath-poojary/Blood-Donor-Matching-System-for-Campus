# Architecture and design notes

## Runtime shape

Campus Blood Match is a same-origin browser app backed by a small Node.js HTTP server. The server binds to `0.0.0.0` for local and hosted runtime compatibility; user-entered records are stored in the ignored `local-data.json` file unless `BLOODMATCH_DATA_FILE` is configured. The app does not seed accounts, requests, notices, or demo records. Domain options such as blood groups and request statuses are code-defined enums; they are not stored user records.

```text
Browser (index.html)
  ├─ js/app.js       Views, client navigation, role workflows, QR rendering
  ├─ js/store.js     HTTP API client and current-session access
  └─ js/qr-card.js   Pure donor vCard payload builder
          │ same-origin HTTP / Server-Sent Events
          ▼
Node.js (server.js)
  ├─ Authentication and role authorization
  ├─ Request, offer, profile, admin, and analytics operations
  └─ Local JSON persistence (local-data.json)
```

## Main data flows

- **Registration and sign-in:** `js/login.js` submits credentials through `js/store.js`; the server validates credentials and role permissions and keeps the session in an HTTP-only cookie. Administrator sign-in uses a separate page and server-enforced admin-only login route. The first administrator is provisioned only from private `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` server environment variables; public admin registration is disabled. Passwords are stored as salted hashes.
- **Requests and donor offers:** the recipient creates a request; the server determines compatible available donors for display; donors submit offers; only the requester can accept or decline an offer and close their request.
- **Admin operations:** admin-only API routes serve network analytics, notices, request moderation, and explicitly entered demo requests. Public homepage notices may link to active requests; donor volunteers are submitted as offers by the signed-in donor. Demo cleanup only removes records labeled as demo data and their linked notices.
- **Live updates:** the browser subscribes to server-sent events. Events trigger a dashboard refresh rather than replacing the server as the source of truth.
- **Donor QR:** `js/qr-card.js` builds a vCard from the signed-in donor profile. `js/app.js` renders it as a QR image. Phone numbers are included only when the donor enables QR phone sharing.
- **Security controls:** API mutations reject mismatched browser origins, JSON request bodies must be objects, and API/static responses include browser security headers. Private local data, server source, and dotfiles are not served. Automated dependency auditing runs in CI.

## Trust and safety boundaries

- User-entered blood group and profile information are not independently verified.
- The application is a portfolio prototype, not a clinical or emergency service.
- Local HTTP, local JSON storage, and the absence of recovery/backups are not suitable for deployment with real patient information.
- Keep the service bound to loopback. Do not expose it to a network or internet without redesigning and reviewing authentication, transport security, storage, backups, consent, and operational controls.

## Validation

`npm test` runs syntax checks, Node's built-in unit/API tests, and Playwright browser tests. `tests/qr-card.test.js` checks generated vCard fields, phone-sharing consent, and escaping. `tests/server.test.js` runs the API against a separate temporary data file and verifies authorization, security headers, private-file protection, and request workflows. `tests/e2e/app.spec.js` launches a separate temporary server/database and walks through first-admin setup, account registration, a request and donor response, QR generation, closure, and admin notice publication; axe audits accessibility on public and role-specific pages. All generated accounts and requests are unique per run, test-only, and removed afterward.

GitHub Actions runs the same checks on pushes and pull requests. CI is a verification workflow only; the app itself is not deployed.
