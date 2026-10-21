const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('node:net');

const projectRoot = path.resolve(__dirname, '../..');
const runId = randomUUID();
const adminSetupCode = randomUUID();
let temporaryDirectory;
let serverProcess;
let baseUrl;

async function allocatePort() {
    const probe = createServer();
    await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
    const { port } = probe.address();
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    return port;
}

async function waitForServer() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        if (serverProcess.exitCode !== null) throw new Error('The isolated E2E server exited before it became ready.');
        try {
            const response = await fetch(`${baseUrl}/api/status`);
            if (response.ok) return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw new Error('The isolated E2E server did not start.');
}

test.beforeAll(async () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloodmatch-e2e-'));
    const port = await allocatePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
        cwd: projectRoot,
        env: {
            ...process.env,
            PORT: String(port),
            BLOODMATCH_DATA_FILE: path.join(temporaryDirectory, 'local-data.json'),
            ADMIN_SETUP_CODE: adminSetupCode
        },
        stdio: 'ignore'
    });
    await waitForServer();
});

test.afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
        serverProcess.kill();
        await new Promise(resolve => serverProcess.once('exit', resolve));
    }
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function registerFromHome(page, account) {
    if (account.userType === 'admin') {
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.getByRole('button', { name: 'Register' }).click();
        await page.getByRole('button', { name: 'Donor', exact: true }).click();
    } else {
        const action = account.userType === 'donor' ? /Join as a donor/ : /Open a request/;
        await page.getByRole('button', { name: action }).click();
    }

    await page.getByLabel('Full name').fill(account.name);
    await page.getByLabel('Phone number').fill(account.phone);
    await page.getByLabel('Campus location / dorm').fill(account.location);
    if (account.userType !== 'recipient') await page.getByLabel('Your blood group').selectOption(account.bloodGroup);
    if (account.userType === 'admin') {
        await page.getByLabel('First-time admin setup code').fill(adminSetupCode);
    }
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.locator('#auth-submit-btn').click();
    await expect(page.getByRole('heading', { name: new RegExp(`Welcome back,\\s*${account.name.split(' ')[0]}`, 'i') })).toBeVisible();
}

async function loginFromHome(page, account) {
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.locator('#auth-submit-btn').click();
    await expect(page.getByRole('heading', { name: new RegExp(`Welcome back,\\s*${account.name.split(' ')[0]}`, 'i') })).toBeVisible();
}

async function logoutToHome(page) {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

async function expectAccessible(page) {
    await page.waitForFunction(() =>
        [...document.querySelectorAll('#toast-container .toast')]
            .every(toast => toast.getAnimations().every(animation => animation.playState !== 'running'))
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test('home and account entry pages have no automatically detectable accessibility violations', async ({ page }) => {
    await page.goto(baseUrl);
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expectAccessible(page);
});

test('empty setup, donor/recipient workflow, QR privacy, and admin notice work in the browser', async ({ page }) => {
    const admin = {
        userType: 'admin',
        name: `Administrator ${runId}`,
        email: `admin-${runId}@example.test`,
        password: randomUUID(),
        phone: `admin-${runId}`,
        location: `Test campus ${runId}`,
        bloodGroup: 'O+'
    };
    const donor = {
        userType: 'donor',
        name: `Donor ${runId}`,
        email: `donor-${runId}@example.test`,
        password: randomUUID(),
        phone: `donor-${runId}`,
        location: `North campus ${runId}`,
        bloodGroup: 'O-'
    };
    const recipient = {
        userType: 'recipient',
        name: `Recipient ${runId}`,
        email: `recipient-${runId}@example.test`,
        password: randomUUID(),
        phone: `recipient-${runId}`,
        location: `South campus ${runId}`
    };

    await page.goto(baseUrl);
    const initialStatus = await page.request.get(`${baseUrl}/api/status`);
    await expect(initialStatus).toBeOK();
    expect(await initialStatus.json()).toEqual({ adminSetupRequired: true });

    await registerFromHome(page, admin);
    await expectAccessible(page);
    await logoutToHome(page);
    await registerFromHome(page, recipient);
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Start a mission' }).click();
    await expectAccessible(page);
    const patientName = `Temporary E2E ${runId} <img src=x onerror=alert(1)>`;
    await page.getByLabel('Patient name or initials').fill(patientName);
    await page.getByLabel('Blood group needed').selectOption('O+');
    await page.getByLabel('Urgency').selectOption('High');
    await page.getByLabel('Hospital / meeting location').fill(`Temporary Test Clinic ${runId}`);
    await page.getByLabel('Contact number').fill(recipient.phone);
    await page.getByLabel(/I agree to share these request details/).check();
    await page.getByRole('button', { name: 'Broadcast SOS' }).click();
    await expect(page.getByRole('heading', { name: patientName })).toBeVisible();

    await logoutToHome(page);
    await loginFromHome(page, admin);
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    const noticeTitle = `Temporary E2E Notice ${runId}`;
    await page.getByLabel('Title').fill(noticeTitle);
    await page.getByLabel('Details').fill('This notice exists only in the isolated test database.');
    const linkedRequestId = await page.locator('#notice-request option').nth(1).getAttribute('value');
    expect(linkedRequestId).toBeTruthy();
    await page.locator('#notice-request').selectOption(linkedRequestId);
    await page.getByRole('button', { name: 'Publish notice' }).click();
    await expect(page.getByText(noticeTitle)).toBeVisible();

    await logoutToHome(page);
    await expect(page.getByText(noticeTitle)).toBeVisible();
    await registerFromHome(page, donor);
    await expectAccessible(page);
    await expect(page.getByRole('heading', { name: patientName })).toBeVisible();
    await expect(page.locator('#app img')).toHaveCount(0);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page.getByText(noticeTitle)).toBeVisible();
    await page.getByRole('button', { name: 'Volunteer to donate' }).click();
    await expect(page.getByText('Your offer: offered').first()).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
    await page.getByRole('button', { name: 'My settings' }).click();
    await expectAccessible(page);
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText('Your offer: offered').first()).toBeVisible();

    await page.getByRole('button', { name: 'Donor card' }).click();
    await expect(page.getByRole('heading', { name: 'Donor QR card' })).toBeVisible();
    await expectAccessible(page);
    await expect(page.getByText('Phone excluded by your privacy setting')).toBeVisible();
    await page.getByRole('button', { name: 'Generate QR card' }).click();
    await expect(page.locator('#qr-output img')).toBeVisible();
    await expect.poll(() => page.locator('#qr-output img').evaluate(image => image.naturalWidth)).toBe(240);
    await page.getByRole('button', { name: 'Back to dashboard' }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

    await logoutToHome(page);
    await loginFromHome(page, recipient);
    await page.getByRole('button', { name: 'Accept offer' }).click();
    await expect(page.getByText('Donor confirmed')).toBeVisible();
    await page.getByRole('button', { name: 'Mark fulfilled' }).click();
    await expect(page.getByText('fulfilled', { exact: true })).toBeVisible();

    await logoutToHome(page);
    await loginFromHome(page, admin);
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expectAccessible(page);
});

test('mobile navigation is keyboard accessible and does not overflow the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible();

    const menu = page.getByRole('button', { name: 'Toggle navigation' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
