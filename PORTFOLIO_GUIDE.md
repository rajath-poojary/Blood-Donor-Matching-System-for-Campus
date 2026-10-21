# Portfolio walkthrough

## Keep the demo safe and repeatable

- Use fictional contact details only. Never enter real patient information.
- Keep the app on its default loopback address; this project is not designed for public hosting.
- Start with a fresh, empty database when possible. The app does not create demo accounts, requests, or notices automatically.
- Create each donor, recipient, and administrator account through the registration form. On a new database, create the first administrator using the one-time code printed by the local server.
- Add any presentation records manually in the admin dashboard. Demo requests are labeled and can be removed separately.
- Delete any temporary walkthrough records from the UI after presenting.

## Five-minute walkthrough

1. Show the public home page and explain that counts and requests are based on current user-entered data.
2. Register a fictional recipient and create a request using fictional details and the required consent checkbox.
3. Register a fictional donor with a compatible blood group, show the available matching feed, and submit an offer.
4. Sign back in as the recipient, review the offer, then close the request and show its status timeline.
5. Open the donor QR card and explain that its vCard is generated from the donor profile; phone sharing is opt-in.
6. Sign in as the administrator to show analytics, notices, and manually managed demo requests.
7. Mention that the project has no seeded application data, runs locally, and is not a clinical eligibility or emergency service.

## Verification before presenting

From the project folder:

```powershell
npm ci
npx playwright install chromium
npm test
npm audit --audit-level=high
```

The automated browser suite creates its own random accounts and unique temporary database. It does not use the app's ignored `local-data.json`.

## Resume description

Adjust these bullets to match the role and your own contribution:

- Built a local-first donor coordination prototype with role-based workflows for recipient requests, compatible donor offers, request closure, and administrator operations.
- Added isolated Node.js API and Playwright end-to-end tests, including QR privacy, authorization, request lifecycle, mobile navigation, and automated accessibility checks.
- Implemented server-side validation, origin checks for writes, browser security headers, local-only file protections, and CI dependency auditing.

Be transparent in interviews: the project is a portfolio prototype, not production healthcare software. User-entered blood groups are unverified; do not handle real patient data or expose the local server publicly.
