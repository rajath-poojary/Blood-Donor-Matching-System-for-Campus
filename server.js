const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_FILE = process.env.BLOODMATCH_DATA_FILE || path.join(ROOT, 'local-data.json');
const PORT = Number(process.env.PORT || 5502);
const SESSION_COOKIE = 'bloodmatch_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const ADMIN_SETUP_CODE = process.env.ADMIN_SETUP_CODE || crypto.randomBytes(18).toString('base64url');
const sessions = new Map();
const eventClients = new Set();
const authAttempts = new Map();
const MAX_BODY_BYTES = 64 * 1024;
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};

const initialData = () => ({ users: [], requests: [], notices: [] });

function readData() {
    if (!fs.existsSync(DATA_FILE)) return initialData();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
        users: Array.isArray(data.users) ? data.users : [],
        requests: Array.isArray(data.requests) ? data.requests : [],
        notices: Array.isArray(data.notices) ? data.notices : []
    };
}

function writeData(data) {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tempFile, DATA_FILE);
}

function sendJson(response, status, data, headers = {}) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...SECURITY_HEADERS,
        ...headers
    });
    response.end(status === 204 || status === 304 ? '' : JSON.stringify(data));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';
        let size = 0;
        request.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
                request.destroy();
                return;
            }
            raw += chunk;
        });
        request.on('end', () => {
            if (!raw) return resolve({});
            try {
                const body = JSON.parse(raw);
                if (!body || typeof body !== 'object' || Array.isArray(body)) {
                    reject(Object.assign(new Error('Request body must be a JSON object.'), { status: 400 }));
                    return;
                }
                resolve(body);
            } catch {
                reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }));
            }
        });
        request.on('error', reject);
    });
}

function hashPassword(password, salt = crypto.randomBytes(PASSWORD_SALT_BYTES)) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, PASSWORD_KEY_BYTES, (error, key) => {
            if (error) return reject(error);
            resolve({ salt: salt.toString('hex'), hash: key.toString('hex') });
        });
    });
}

function cleanUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        bloodGroup: user.bloodGroup,
        userType: user.userType,
        isAvailable: user.isAvailable,
        sharePhone: user.sharePhone,
        qrSharePhone: user.qrSharePhone,
        lastDonationDate: user.lastDonationDate,
        reminderDate: user.reminderDate,
        createdAt: user.createdAt
    };
}

function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').map(item => item.trim().split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2));
}

function getSessionUser(request, data) {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
        sessions.delete(token);
        return null;
    }
    const user = data.users.find(item => item.id === session.userId);
    if (!user) {
        sessions.delete(token);
        return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return user;
}

function setSession(response, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}

function clearSession(request, response) {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function requireUser(user) {
    if (!user) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
    return user;
}

function requireRole(user, roles) {
    requireUser(user);
    if (!roles.includes(user.userType)) throw Object.assign(new Error('Your account does not have permission for this action.'), { status: 403 });
}

function requiredText(value, label, maxLength) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw Object.assign(new Error(`${label} is required (maximum ${maxLength} characters).`), { status: 400 });
    }
    return value.trim();
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function canDonateTo(donorBlood, recipientBlood) {
    const map = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+']
    };
    return map[donorBlood]?.includes(recipientBlood) || false;
}

function broadcast(table, eventType = 'UPDATE') {
    const event = `data: ${JSON.stringify({ table, eventType })}\n\n`;
    for (const response of eventClients) {
        if (!response.destroyed) response.write(event);
    }
}

function authRateLimit(request) {
    const now = Date.now();
    const key = request.socket.remoteAddress || 'local';
    const recent = (authAttempts.get(key) || []).filter(timestamp => now - timestamp < 15 * 60 * 1000);
    if (recent.length >= 20) throw Object.assign(new Error('Too many attempts. Wait 15 minutes before trying again.'), { status: 429 });
    recent.push(now);
    authAttempts.set(key, recent);
}

async function handleApi(request, response, url) {
    let data = readData();
    const pathname = decodeURIComponent(url.pathname);
    const method = request.method;
    const origin = request.headers.origin;
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        let parsedOrigin;
        try {
            parsedOrigin = new URL(origin);
        } catch {
            throw Object.assign(new Error('Cross-origin requests are not allowed.'), { status: 403 });
        }
        const forwardedProtocol = request.headers['x-forwarded-proto']?.split(',')[0].trim().toLowerCase();
        const protocol = request.socket.encrypted || forwardedProtocol === 'https' ? 'https' : 'http';
        const expectedOrigin = new URL(`${protocol}://${request.headers.host || ''}`).origin;
        if (parsedOrigin.origin !== expectedOrigin) {
            throw Object.assign(new Error('Cross-origin requests are not allowed.'), { status: 403 });
        }
    }
    const currentUser = getSessionUser(request, data);

    if (method === 'GET' && pathname === '/api/session') {
        return sendJson(response, 200, currentUser ? cleanUser(currentUser) : null);
    }
    if (method === 'GET' && pathname === '/api/status') {
        return sendJson(response, 200, { adminSetupRequired: !data.users.some(user => user.userType === 'admin') });
    }
    if (method === 'POST' && pathname === '/api/register') {
        authRateLimit(request);
        const body = await readBody(request);
        const email = normalizeEmail(requiredText(body.email, 'Email', 254));
        const password = requiredText(body.password, 'Password', 256);
        const name = requiredText(body.name, 'Full name', 100);
        const phone = requiredText(body.phone, 'Phone number', 30);
        const location = requiredText(body.location, 'Campus location', 120);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
        if (password.length < 8) throw Object.assign(new Error('Password must contain at least 8 characters.'), { status: 400 });
        if (!['donor', 'recipient'].includes(body.userType)) throw Object.assign(new Error('Choose donor or recipient.'), { status: 400 });
        if (data.users.some(user => typeof user.email === 'string' && normalizeEmail(user.email) === email)) {
            throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
        }

        let userType = body.userType;
        if (body.adminSetupCode && !data.users.some(user => user.userType === 'admin')) {
            const providedCode = Buffer.from(String(body.adminSetupCode));
            const expectedCode = Buffer.from(ADMIN_SETUP_CODE);
            if (providedCode.length !== expectedCode.length || !crypto.timingSafeEqual(providedCode, expectedCode)) {
                throw Object.assign(new Error('The admin setup code is incorrect.'), { status: 403 });
            }
            userType = 'admin';
        }
        const bloodGroup = body.bloodGroup || null;
        if (userType === 'donor' && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
            throw Object.assign(new Error('Select a valid blood group.'), { status: 400 });
        }
        const passwordData = await hashPassword(password);
        const user = {
            id: crypto.randomUUID(),
            name,
            email,
            phone,
            location,
            bloodGroup: userType === 'donor' ? bloodGroup : null,
            userType,
            isAvailable: userType === 'donor',
            sharePhone: userType === 'donor' && Boolean(body.sharePhone),
            qrSharePhone: false,
            lastDonationDate: null,
            reminderDate: null,
            passwordSalt: passwordData.salt,
            passwordHash: passwordData.hash,
            createdAt: new Date().toISOString()
        };
        data.users.push(user);
        writeData(data);
        setSession(response, user);
        broadcast('profiles', 'INSERT');
        return sendJson(response, 201, { user: cleanUser(user) });
    }
    if (method === 'POST' && pathname === '/api/login') {
        authRateLimit(request);
        const body = await readBody(request);
        const email = normalizeEmail(requiredText(body.email, 'Email', 254));
        const password = requiredText(body.password, 'Password', 256);
        const user = data.users.find(item => typeof item.email === 'string' && normalizeEmail(item.email) === email);
        if (!user) {
            await hashPassword(password, Buffer.alloc(PASSWORD_SALT_BYTES));
            throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
        }
        const verified = await hashPassword(password, Buffer.from(user.passwordSalt, 'hex'));
        if (!crypto.timingSafeEqual(Buffer.from(verified.hash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) {
            throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
        }
        setSession(response, user);
        return sendJson(response, 200, { user: cleanUser(user) });
    }
    if (method === 'POST' && pathname === '/api/logout') {
        clearSession(request, response);
        return sendJson(response, 204, null);
    }
    if (method === 'GET' && pathname === '/api/events') {
        requireUser(currentUser);
        response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            ...SECURITY_HEADERS
        });
        response.write(': live connection established\n\n');
        eventClients.add(response);
        const heartbeat = setInterval(() => {
            if (!response.destroyed) response.write(': keep-alive\n\n');
        }, 20000);
        request.on('close', () => {
            clearInterval(heartbeat);
            eventClients.delete(response);
        });
        return;
    }

    requireUser(currentUser);
    if (method === 'GET' && pathname === '/api/users') {
        const users = currentUser.userType === 'admin'
            ? data.users
            : data.users.filter(user => user.userType === 'donor' && user.isAvailable);
        return sendJson(response, 200, users.map(user => ({
            ...cleanUser(user),
            phone: currentUser.userType === 'admin' || user.sharePhone ? user.phone : '',
            email: currentUser.userType === 'admin' ? user.email : undefined
        })));
    }
    if (method === 'PATCH' && pathname === '/api/profile') {
        const body = await readBody(request);
        const user = data.users.find(item => item.id === currentUser.id);
        user.name = requiredText(body.name, 'Full name', 100);
        user.phone = requiredText(body.phone, 'Phone number', 30);
        user.location = requiredText(body.location, 'Campus location', 120);
        if (user.userType === 'donor') {
            user.isAvailable = Boolean(body.isAvailable);
            user.sharePhone = Boolean(body.sharePhone);
            user.qrSharePhone = Boolean(body.qrSharePhone);
            for (const field of ['lastDonationDate', 'reminderDate']) {
                if (body[field] && !/^\d{4}-\d{2}-\d{2}$/.test(body[field])) {
                    throw Object.assign(new Error(`Enter a valid ${field === 'lastDonationDate' ? 'last donation' : 'reminder'} date.`), { status: 400 });
                }
                user[field] = body[field] || null;
            }
        }
        writeData(data);
        broadcast('profiles');
        return sendJson(response, 200, { user: cleanUser(user) });
    }
    if (method === 'GET' && pathname === '/api/requests') {
        return sendJson(response, 200, data.requests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    if (method === 'GET' && pathname === '/api/admin/analytics') {
        requireRole(currentUser, ['admin']);
        const requestsByBloodGroup = {};
        for (const requestEntry of data.requests) {
            requestsByBloodGroup[requestEntry.bloodGroup] = (requestsByBloodGroup[requestEntry.bloodGroup] || 0) + 1;
        }
        const fulfilled = data.requests.filter(item => item.status === 'fulfilled').length;
        const responded = data.requests.filter(item => item.responses.length > 0).length;
        return sendJson(response, 200, {
            accounts: {
                total: data.users.length,
                donors: data.users.filter(item => item.userType === 'donor').length,
                availableDonors: data.users.filter(item => item.userType === 'donor' && item.isAvailable).length,
                recipients: data.users.filter(item => item.userType === 'recipient').length
            },
            requests: {
                total: data.requests.length,
                active: data.requests.filter(item => item.status === 'active').length,
                fulfilled,
                cancelled: data.requests.filter(item => item.status === 'cancelled').length,
                responseCount: data.requests.reduce((count, item) => count + item.responses.length, 0),
                responseRate: data.requests.length ? Math.round(responded / data.requests.length * 100) : 0,
                fulfillmentRate: data.requests.length ? Math.round(fulfilled / data.requests.length * 100) : 0,
                byBloodGroup: requestsByBloodGroup
            },
            demoRequests: data.requests.filter(item => item.isDemo).length
        });
    }
    if (method === 'POST' && pathname === '/api/admin/demo-requests') {
        requireRole(currentUser, ['admin']);
        const body = await readBody(request);
        const requestEntry = {
            id: crypto.randomUUID(),
            requesterId: currentUser.id,
            requesterName: currentUser.name,
            patientName: requiredText(body.patientName, 'Patient name', 100),
            bloodGroup: body.bloodGroup,
            hospital: requiredText(body.hospital, 'Hospital or location', 160),
            contact: requiredText(body.contact, 'Contact number', 30),
            urgency: body.urgency,
            status: 'active',
            isDemo: true,
            createdAt: new Date().toISOString(),
            responses: []
        };
        if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(requestEntry.bloodGroup)) {
            throw Object.assign(new Error('Select a valid blood group.'), { status: 400 });
        }
        if (!['High', 'Normal'].includes(requestEntry.urgency)) throw Object.assign(new Error('Choose a valid urgency.'), { status: 400 });
        data.requests.push(requestEntry);
        writeData(data);
        broadcast('blood_requests', 'INSERT');
        return sendJson(response, 201, requestEntry);
    }
    if (method === 'DELETE' && pathname === '/api/admin/demo-requests') {
        requireRole(currentUser, ['admin']);
        const before = data.requests.length;
        data.requests = data.requests.filter(item => !item.isDemo);
        const removed = before - data.requests.length;
        if (removed) {
            writeData(data);
            broadcast('blood_requests', 'DELETE');
        }
        return sendJson(response, 200, { removed });
    }
    if (method === 'POST' && pathname === '/api/requests') {
        requireRole(currentUser, ['recipient']);
        const body = await readBody(request);
        const requestEntry = {
            id: crypto.randomUUID(),
            requesterId: currentUser.id,
            requesterName: currentUser.name,
            patientName: requiredText(body.patientName, 'Patient name', 100),
            bloodGroup: body.bloodGroup,
            hospital: requiredText(body.hospital, 'Hospital or location', 160),
            contact: requiredText(body.contact, 'Contact number', 30),
            urgency: body.urgency,
            status: 'active',
            createdAt: new Date().toISOString(),
            responses: []
        };
        if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(requestEntry.bloodGroup)) {
            throw Object.assign(new Error('Select a valid blood group.'), { status: 400 });
        }
        if (!['High', 'Normal'].includes(requestEntry.urgency)) throw Object.assign(new Error('Choose a valid urgency.'), { status: 400 });
        data.requests.push(requestEntry);
        writeData(data);
        broadcast('blood_requests', 'INSERT');
        return sendJson(response, 201, requestEntry);
    }

    const responseDecisionRoute = pathname.match(/^\/api\/requests\/([0-9a-f-]+)\/responses\/([0-9a-f-]+)$/i);
    if (responseDecisionRoute && method === 'PATCH') {
        requireRole(currentUser, ['recipient']);
        const target = data.requests.find(item => item.id === responseDecisionRoute[1]);
        if (!target) throw Object.assign(new Error('Request not found.'), { status: 404 });
        if (target.requesterId !== currentUser.id) throw Object.assign(new Error('Only the requester can review donor offers.'), { status: 403 });
        if (target.status !== 'active') throw Object.assign(new Error('This request is no longer active.'), { status: 409 });
        const responseEntry = target.responses.find(item => item.id === responseDecisionRoute[2]);
        if (!responseEntry) throw Object.assign(new Error('Donor offer not found.'), { status: 404 });
        if (responseEntry.status !== 'offered') throw Object.assign(new Error('This donor offer has already been reviewed.'), { status: 409 });
        const body = await readBody(request);
        if (!['accepted', 'declined'].includes(body.status)) {
            throw Object.assign(new Error('Choose whether to accept or decline this donor offer.'), { status: 400 });
        }
        if (body.status === 'accepted' && target.responses.some(item => item.status === 'accepted')) {
            throw Object.assign(new Error('A donor offer has already been accepted for this request.'), { status: 409 });
        }
        responseEntry.status = body.status;
        responseEntry.reviewedAt = new Date().toISOString();
        writeData(data);
        broadcast('request_responses', 'UPDATE');
        return sendJson(response, 200, responseEntry);
    }

    const requestRoute = pathname.match(/^\/api\/requests\/([0-9a-f-]+)(?:\/(respond))?$/i);
    if (requestRoute) {
        const target = data.requests.find(item => item.id === requestRoute[1]);
        if (!target) throw Object.assign(new Error('Request not found.'), { status: 404 });
        if (method === 'GET' && !requestRoute[2]) return sendJson(response, 200, target);
        if (method === 'POST' && requestRoute[2] === 'respond') {
            requireRole(currentUser, ['donor']);
            if (!currentUser.isAvailable) throw Object.assign(new Error('Set your donor status to available before responding.'), { status: 403 });
            if (target.status !== 'active') throw Object.assign(new Error('This request is no longer active.'), { status: 409 });
            if (!canDonateTo(currentUser.bloodGroup, target.bloodGroup)) throw Object.assign(new Error('Your blood group does not match this request.'), { status: 403 });
            if (target.responses.some(item => item.donorId === currentUser.id)) throw Object.assign(new Error('You have already responded to this request.'), { status: 409 });
            const donor = data.users.find(item => item.id === currentUser.id);
            const answer = {
                id: crypto.randomUUID(),
                donorId: donor.id,
                donorName: donor.name,
                donorPhone: donor.sharePhone ? donor.phone : '',
                donorBlood: donor.bloodGroup,
                status: 'offered',
                submittedAt: new Date().toISOString()
            };
            target.responses.push(answer);
            writeData(data);
            broadcast('request_responses', 'INSERT');
            return sendJson(response, 201, answer);
        }
        if (method === 'PATCH' && !requestRoute[2]) {
            if (target.requesterId !== currentUser.id && currentUser.userType !== 'admin') {
                throw Object.assign(new Error('Only the requester or an admin can change request status.'), { status: 403 });
            }
            if (target.status !== 'active') throw Object.assign(new Error('Only active requests can be closed.'), { status: 409 });
            const body = await readBody(request);
            const allowedStatuses = currentUser.userType === 'admin' ? ['cancelled'] : ['fulfilled', 'cancelled'];
            if (!allowedStatuses.includes(body.status)) {
                throw Object.assign(new Error('Choose a valid closing status.'), { status: 400 });
            }
            target.status = body.status;
            target.closedAt = new Date().toISOString();
            writeData(data);
            broadcast('blood_requests');
            return sendJson(response, 200, target);
        }
    }

    if (method === 'GET' && pathname === '/api/notices') {
        return sendJson(response, 200, data.notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    if (method === 'POST' && pathname === '/api/notices') {
        requireRole(currentUser, ['admin']);
        const body = await readBody(request);
        const notice = {
            id: crypto.randomUUID(),
            title: requiredText(body.title, 'Title', 120),
            body: requiredText(body.body, 'Details', 2000),
            createdBy: currentUser.id,
            createdAt: new Date().toISOString()
        };
        data.notices.push(notice);
        writeData(data);
        broadcast('campus_updates', 'INSERT');
        return sendJson(response, 201, notice);
    }
    sendJson(response, 404, { error: 'Not found.' });
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.sql': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function serveStatic(request, response, url) {
    const relativePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(ROOT, `.${relativePath}`);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
        return sendJson(response, 403, { error: 'Forbidden.' });
    }
    const relativeToRoot = path.relative(ROOT, filePath);
    if (relativeToRoot.split(path.sep).some(segment => segment.startsWith('.'))) {
        return sendJson(response, 404, { error: 'File not found.' });
    }
    let target = filePath;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return sendJson(response, 404, { error: 'File not found.' });
    if (path.basename(target).startsWith('.')
        || ['local-data.json', 'local-data.json.tmp', 'db.json', 'server.js'].includes(path.basename(target))) {
        return sendJson(response, 404, { error: 'File not found.' });
    }
    response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=300',
        ...SECURITY_HEADERS
    });
    fs.createReadStream(target).pipe(response);
}

const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        if (url.pathname.startsWith('/api/')) {
            await handleApi(request, response, url);
        } else if (request.method === 'GET' || request.method === 'HEAD') {
            serveStatic(request, response, url);
        } else {
            sendJson(response, 405, { error: 'Method not allowed.' });
        }
    } catch (error) {
        if (!response.headersSent) {
            sendJson(response, error.status || 500, { error: error.status ? error.message : 'The local server could not complete the request.' });
        } else if (!response.destroyed) {
            response.end();
        }
        if (!error.status) console.error(error);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Blood Match is running on port ${PORT}`);
    if (!readData().users.some(user => user.userType === 'admin')) {
        console.log(`One-time first-admin setup code: ${ADMIN_SETUP_CODE}`);
        console.log('Keep this code private. It can only create the first admin account.');
    }
    console.log(`Local data is stored in ${DATA_FILE}`);
    console.log('This local prototype is bound to this computer only; do not expose it to the internet.');
});

function shutDown() {
    for (const client of eventClients) client.end();
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
