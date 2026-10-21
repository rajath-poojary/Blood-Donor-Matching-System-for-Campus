const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('node:net');
const { after, before, test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bloodmatch-test-'));
const dataFile = path.join(tempDirectory, 'local-data.json');
const runId = randomUUID();
const adminSetupCode = randomUUID();
const testPassword = randomUUID();
const runDigits = runId.replace(/-/g, '');
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
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/api/status`);
            if (response.ok) return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw new Error('The test server did not start.');
}

async function api(route, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${baseUrl}/api${route}`, {
        method,
        headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const payload = response.status === 204 ? null : await response.json();
    return { response, payload };
}

async function register(user) {
    const { response, payload } = await api('/register', { method: 'POST', body: user });
    assert.equal(response.status, 201, payload.error);
    return {
        user: payload.user,
        cookie: response.headers.get('set-cookie').split(';', 1)[0]
    };
}

before(async () => {
    const port = await allocatePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
        cwd: projectRoot,
        env: { ...process.env, PORT: String(port), BLOODMATCH_DATA_FILE: dataFile, ADMIN_SETUP_CODE: adminSetupCode },
        stdio: 'ignore'
    });
    await waitForServer();
});

after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
        serverProcess.kill();
        await new Promise(resolve => serverProcess.once('exit', resolve));
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('fresh server has no seeded data, protects local files, and rejects cross-origin writes', async () => {
    const status = await api('/status');
    assert.deepEqual(status.payload, { adminSetupRequired: true });
    assert.equal((await api('/session')).payload, null);
    assert.equal((await api('/requests')).response.status, 401);

    const staticResponse = await fetch(baseUrl);
    assert.equal(staticResponse.status, 200);
    assert.equal(staticResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(staticResponse.headers.get('x-frame-options'), 'DENY');
    assert.equal(staticResponse.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(staticResponse.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    for (const file of ['/server.js', '/local-data.json', '/local-data.json.tmp', '/db.json', '/.gitignore', '/.github/workflows/ci.yml']) {
        assert.equal((await fetch(`${baseUrl}${file}`)).status, 404, `${file} must not be downloadable`);
    }

    const nullBody = await api('/register', { method: 'POST', body: null });
    assert.equal(nullBody.response.status, 400);
    assert.equal(nullBody.payload.error, 'Request body must be a JSON object.');
    const httpsOrigin = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: baseUrl.replace('http://', 'https://'),
            'X-Forwarded-Proto': 'https'
        },
        body: JSON.stringify(null)
    });
    assert.equal(httpsOrigin.status, 400);
    assert.equal((await httpsOrigin.json()).error, 'Request body must be a JSON object.');
    const crossOriginWrite = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
        body: JSON.stringify({
            name: `Untrusted ${runId}`, email: `untrusted-${runId}@example.test`, password: testPassword,
            phone: runDigits.slice(0, 10), location: `Test campus ${runId}`, userType: 'recipient'
        })
    });
    assert.equal(crossOriginWrite.status, 403);
    assert.equal((await api('/status')).payload.adminSetupRequired, true);
});

test('auth, donor response review, request lifecycle, analytics, and isolated demo reset', async () => {
    const admin = await register({
        name: `Administrator ${runId}`, email: `admin-${runId}@example.test`, password: testPassword,
        phone: runDigits.slice(0, 10), location: `Test campus ${runId}`, userType: 'donor', bloodGroup: 'O-',
        adminSetupCode
    });
    assert.equal(admin.user.userType, 'admin');

    const donor = await register({
        name: `Donor ${runId}`, email: `donor-${runId}@example.test`, password: `${testPassword}-donor`,
        phone: runDigits.slice(10, 20), location: `North dorm ${runId}`, userType: 'donor', bloodGroup: 'O-'
    });
    const savedData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    savedData.users.find(item => item.id === donor.user.id).email = ` ${donor.user.email.toUpperCase()} `;
    fs.writeFileSync(dataFile, JSON.stringify(savedData, null, 2));
    const logout = await api('/logout', { method: 'POST', cookie: donor.cookie });
    assert.equal(logout.response.status, 204);
    const donorLogin = await api('/login', {
        method: 'POST',
        body: { email: donor.user.email.toUpperCase(), password: `${testPassword}-donor` }
    });
    assert.equal(donorLogin.response.status, 200, donorLogin.payload.error);
    assert.equal(donorLogin.payload.user.id, donor.user.id);
    donor.cookie = donorLogin.response.headers.get('set-cookie').split(';', 1)[0];
    assert.match(donorLogin.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(donorLogin.response.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal('passwordHash' in donorLogin.payload.user, false);

    const recipient = await register({
        name: `Recipient ${runId}`, email: `recipient-${runId}@example.test`, password: `${testPassword}-recipient`,
        phone: runDigits.slice(20, 30), location: `South dorm ${runId}`, userType: 'recipient'
    });

    const deniedAnalytics = await api('/admin/analytics', { cookie: recipient.cookie });
    assert.equal(deniedAnalytics.response.status, 403);

    const visibleUsers = await api('/users', { cookie: recipient.cookie });
    assert.equal(visibleUsers.response.status, 200);
    assert.equal(visibleUsers.payload.find(item => item.id === donor.user.id).phone, '');
    assert.equal('email' in visibleUsers.payload.find(item => item.id === donor.user.id), false);

    const invalidRequest = await api('/requests', {
        method: 'POST', cookie: recipient.cookie,
        body: { patientName: `Invalid ${runId}`, bloodGroup: 'unknown', hospital: `Test clinic ${runId}`, contact: recipient.user.phone, urgency: 'High' }
    });
    assert.equal(invalidRequest.response.status, 400);
    const invalidBodyShape = await api('/requests', { method: 'POST', cookie: recipient.cookie, body: [] });
    assert.equal(invalidBodyShape.response.status, 400);

    const posted = await api('/requests', {
        method: 'POST',
        cookie: recipient.cookie,
        body: { patientName: `Case One ${runId}`, bloodGroup: 'A+', hospital: `General Hospital ${runId}`, contact: recipient.user.phone, urgency: 'High' }
    });
    assert.equal(posted.response.status, 201, posted.payload.error);
    assert.equal(posted.payload.isDemo, undefined);
    const requestId = posted.payload.id;

    const deniedClose = await api(`/requests/${requestId}`, {
        method: 'PATCH', cookie: donor.cookie, body: { status: 'cancelled' }
    });
    assert.equal(deniedClose.response.status, 403);

    const offered = await api(`/requests/${requestId}/respond`, { method: 'POST', cookie: donor.cookie, body: {} });
    assert.equal(offered.response.status, 201, offered.payload.error);
    assert.equal(offered.payload.status, 'offered');
    const duplicateOffer = await api(`/requests/${requestId}/respond`, { method: 'POST', cookie: donor.cookie, body: {} });
    assert.equal(duplicateOffer.response.status, 409);

    const accepted = await api(`/requests/${requestId}/responses/${offered.payload.id}`, {
        method: 'PATCH', cookie: recipient.cookie, body: { status: 'accepted' }
    });
    assert.equal(accepted.response.status, 200, accepted.payload.error);
    assert.equal(accepted.payload.status, 'accepted');

    const fulfilled = await api(`/requests/${requestId}`, {
        method: 'PATCH', cookie: recipient.cookie, body: { status: 'fulfilled' }
    });
    assert.equal(fulfilled.response.status, 200, fulfilled.payload.error);
    assert.ok(fulfilled.payload.closedAt);
    const reopened = await api(`/requests/${requestId}`, {
        method: 'PATCH', cookie: recipient.cookie, body: { status: 'active' }
    });
    assert.equal(reopened.response.status, 409);

    const cancelledRequest = await api('/requests', {
        method: 'POST',
        cookie: recipient.cookie,
        body: { patientName: `Case Two ${runId}`, bloodGroup: 'O-', hospital: `Campus Clinic ${runId}`, contact: recipient.user.phone, urgency: 'Normal' }
    });
    const cancelled = await api(`/requests/${cancelledRequest.payload.id}`, {
        method: 'PATCH', cookie: recipient.cookie, body: { status: 'cancelled' }
    });
    assert.equal(cancelled.response.status, 200);

    const demo = await api('/admin/demo-requests', {
        method: 'POST',
        cookie: admin.cookie,
        body: { patientName: `Portfolio Demo ${runId}`, bloodGroup: 'AB+', hospital: `Demo Clinic ${runId}`, contact: runId.slice(0, 20), urgency: 'Normal' }
    });
    assert.equal(demo.response.status, 201, demo.payload.error);
    assert.equal(demo.payload.isDemo, true);

    const analytics = await api('/admin/analytics', { cookie: admin.cookie });
    assert.equal(analytics.response.status, 200);
    assert.deepEqual(analytics.payload.accounts, { total: 3, donors: 1, availableDonors: 1, recipients: 1 });
    assert.equal(analytics.payload.requests.total, 3);
    assert.equal(analytics.payload.requests.fulfilled, 1);
    assert.equal(analytics.payload.requests.cancelled, 1);
    assert.equal(analytics.payload.requests.responseCount, 1);
    assert.equal(analytics.payload.demoRequests, 1);
    assert.equal(analytics.payload.requests.byBloodGroup['AB+'], 1);

    const deniedReset = await api('/admin/demo-requests', { method: 'DELETE', cookie: donor.cookie });
    assert.equal(deniedReset.response.status, 403);
    const reset = await api('/admin/demo-requests', { method: 'DELETE', cookie: admin.cookie });
    assert.equal(reset.response.status, 200);
    assert.equal(reset.payload.removed, 1);

    const remaining = await api('/requests', { cookie: admin.cookie });
    assert.deepEqual(remaining.payload.map(item => item.id).sort(), [requestId, cancelledRequest.payload.id].sort());
    assert.ok(remaining.payload.every(item => !item.isDemo));
});
