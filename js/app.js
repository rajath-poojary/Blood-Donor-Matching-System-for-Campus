const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const canDonateTo = (donorBlood, recipientBlood) => {
    const compatibleRecipients = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+']
    };
    return compatibleRecipients[donorBlood]?.includes(recipientBlood) || false;
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const formatDate = value => value ? new Date(value).toLocaleDateString() : 'Not set';
const formatDateTime = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const groupOptions = selected => BLOOD_GROUPS.map(group =>
    `<option value="${group}" ${group === selected ? 'selected' : ''}>${group}</option>`
).join('');

const Views = {
    home: async () => {
        const user = Store.getCurrentUser();
        let overview = '';
        if (user) {
            const [requests, users] = await Promise.all([Store.getRequests(), Store.getUsers()]);
            overview = `<div class="home-pulse-grid">
                <article class="pulse-tile"><span>Active missions</span><strong>${requests.filter(item => item.status === 'active').length}</strong><small>currently open</small></article>
                <article class="pulse-tile"><span>Available donors</span><strong>${users.filter(item => item.userType === 'donor' && item.isAvailable).length}</strong><small>based on current profiles</small></article>
                <article class="pulse-tile"><span>Fulfilled</span><strong>${requests.filter(item => item.status === 'fulfilled').length}</strong><small>confirmed by requesters</small></article>
            </div>`;
        }
        return `
            <section class="view mission-home">
                <div class="home-hero mission-panel">
                    <div class="home-copy">
                        <p class="eyebrow"><span class="live-dot"></span> LOCAL NETWORK <span class="eyebrow-divider"></span> REAL-TIME COORDINATION</p>
                        <h1>When every minute<br>matters, <span class="gradient-text">move together.</span></h1>
                        <p class="hero-copy">A live coordination space connecting people who need blood with available donors in their community.</p>
                    ${user ? `
                        <div class="home-actions"><button class="btn btn-primary btn-large" onclick="app.navigate('dashboard')">Open mission control <i data-lucide="arrow-up-right"></i></button>
                            ${user.userType === 'recipient' ? "<button class=\"btn btn-secondary btn-large\" onclick=\"app.navigate('request')\">Start a request</button>" : ''}</div>
                        <p class="login-hint">Signed in as ${escapeHtml(user.name)} · ${escapeHtml(user.userType)}</p>
                    ` : `
                        <div class="join-actions">
                            <button class="join-card join-recipient" onclick="app.joinAs('recipient')">
                                <span class="join-icon"><i data-lucide="heart-pulse"></i></span>
                                <span><strong>Open a request</strong><small>Connect with compatible available donors</small></span>
                                <i data-lucide="arrow-up-right" class="join-arrow"></i>
                            </button>
                            <button class="join-card join-donor" onclick="app.joinAs('donor')">
                                <span class="join-icon"><i data-lucide="heart-handshake"></i></span>
                                <span><strong>Join as a donor</strong><small>Make yourself available to help</small></span>
                                <i data-lucide="arrow-up-right" class="join-arrow"></i>
                            </button>
                        </div>
                        <p class="login-hint">Already part of the network? <button class="text-button" onclick="app.navigate('login')">Sign in</button></p>
                    `}
                    </div>
                    <div class="home-visual" aria-hidden="true">
                        <div class="visual-orbit orbit-a"></div><div class="visual-orbit orbit-b"></div>
                        <div class="visual-core"><i data-lucide="droplet"></i><span>ONE<br>NETWORK</span></div>
                        <span class="visual-spark spark-a"></span><span class="visual-spark spark-b"></span><span class="visual-spark spark-c"></span>
                        <div class="visual-caption"><span class="live-dot"></span> LIVE LOCAL NETWORK</div>
                    </div>
                </div>
                ${overview}
                <div class="home-lower">
                    <div class="section-heading"><div><p class="eyebrow">A CLEAR PATH, TOGETHER</p><h2>From urgent need to coordinated care</h2></div>
                        <p>Every step reflects activity entered by the people using this local demo.</p></div>
                    <div class="journey-grid">
                        <article class="journey-card"><span class="journey-index">01</span><i data-lucide="siren"></i><div><h3>Start a mission</h3><p>A recipient enters the request, urgency and meeting details.</p></div></article>
                        <article class="journey-card"><span class="journey-index">02</span><i data-lucide="radio-tower"></i><div><h3>Match and respond</h3><p>Available compatible donors review the request and send an offer.</p></div></article>
                        <article class="journey-card"><span class="journey-index">03</span><i data-lucide="handshake"></i><div><h3>Coordinate closure</h3><p>The recipient reviews offers and records the outcome.</p></div></article>
                    </div>
                    <div id="home-updates" class="mt-3"></div>
                    <p class="notice mt-3"><strong>Important:</strong> This community tool does not verify blood type or donor eligibility. For emergencies, contact emergency services or a blood bank.</p>
                </div>
            </section>`;
    },

    setup: () => {
        return `
            <section class="view narrow">
                <div class="card glass">
                    <p class="eyebrow">Connection issue</p>
                    <h2>We can’t reach the app server</h2>
                    <p class="mt-2">Check that the app server is running, then try again. Your account and saved information have not been changed.</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">Try again</button>
                </div>
            </section>`;
    },

    login: () => `
        <section class="view narrow">
            <div class="card glass">
                <p class="eyebrow">ACCOUNT ACCESS</p><h1 class="auth-heading">Sign in or create account</h1>
                <div class="auth-tabs flex justify-between mb-3">
                    <button class="btn btn-secondary w-full" onclick="loginApp.toggleAuthMode('login')" id="tab-login">Log in</button>
                    <button class="btn btn-secondary w-full" onclick="loginApp.toggleAuthMode('register')" id="tab-register">Register</button>
                </div>
                <form id="auth-form" onsubmit="loginApp.handleAuth(event)">
                    <div id="role-section">
                        <label class="form-label">Account type</label>
                        <div class="auth-tabs flex">
                            <button class="btn btn-secondary w-full" type="button" onclick="loginApp.toggleUserType('donor')" id="tab-donor">Donor</button>
                            <button class="btn btn-secondary w-full" type="button" onclick="loginApp.toggleUserType('recipient')" id="tab-recipient">Recipient</button>
                        </div>
                    </div>
                    <div id="register-fields">
                        <div class="form-group"><label class="form-label" for="auth-name">Full name</label><input id="auth-name" class="form-input" required maxlength="100"></div>
                        <div class="form-group"><label class="form-label" for="auth-phone">Phone number</label><input id="auth-phone" class="form-input" type="tel" required maxlength="30"></div>
                        <div class="form-group"><label class="form-label" for="auth-location">Campus location / dorm</label><input id="auth-location" class="form-input" required maxlength="120" placeholder="Enter a general campus location"></div>
                        <div class="form-group" id="blood-group-field"><label class="form-label" for="auth-blood-group">Your blood group</label>
                            <select id="auth-blood-group" class="form-select"><option value="">Select group</option>${groupOptions('')}</select></div>
                        <label class="check-row" id="auth-share-row"><input type="checkbox" id="auth-share-phone"> Let signed-in campus users see my phone in the donor directory</label>
                    </div>
                    <div class="form-group mt-2"><label class="form-label" for="auth-email">Email</label><input id="auth-email" class="form-input" type="email" required autocomplete="email"></div>
                    <div class="form-group"><label class="form-label" for="auth-password">Password</label><input id="auth-password" class="form-input" type="password" minlength="8" required autocomplete="current-password"></div>
                    <button type="submit" class="btn btn-primary w-full" id="auth-submit-btn">Log in</button>
                </form>
                <p class="text-sm mt-2 admin-login-link">Campus administrator? <button class="text-button" onclick="app.navigate('admin-login')">Admin sign in</button></p>
                <p class="text-sm mt-2">Your password is securely stored. Contact the campus administrator if you need help with your account.</p>
            </div>
        </section>`,

    'admin-login': async () => {
        const { adminSetupRequired } = await Store.getServerStatus();
        const setupMessage = adminSetupRequired
            ? '<p class="notice admin-setup-message"><strong>First admin not configured.</strong> The server owner must set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the private server environment, then restart the server.</p>'
            : '';
        return `
            <section class="view narrow admin-login-view">
                <div class="card glass admin-login-card">
                    <p class="eyebrow">ADMINISTRATOR ACCESS</p>
                    <h1 class="auth-heading">Admin sign in</h1>
                    ${setupMessage}
                    <p class="text-sm mb-3">Use the administrator email and password created for this server.</p>
                    <form id="admin-auth-form" onsubmit="loginApp.handleAdminAuth(event)">
                        <div class="form-group">
                            <label class="form-label" for="admin-auth-email">Admin email</label>
                            <input id="admin-auth-email" class="form-input" type="email" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="admin-auth-password">Password</label>
                            <input id="admin-auth-password" class="form-input" type="password" required autocomplete="current-password">
                        </div>
                        <button type="submit" class="btn btn-primary w-full" id="admin-auth-submit">Sign in as admin</button>
                    </form>
                    <button class="btn btn-secondary w-full mt-2" type="button" onclick="app.navigate('login')">Back to account sign in</button>
                </div>
            </section>`;
    },

    dashboard: async () => {
        const user = Store.getCurrentUser();
        if (!user) return `<section class="view narrow card glass"><p>Sign in to view the live campus dashboard.</p><button class="btn btn-primary mt-2" onclick="app.navigate('login')">Log in</button></section>`;
        const [requests, users] = await Promise.all([Store.getRequests(), Store.getUsers()]);
        const openRequests = requests.filter(request => request.status === 'active');
        const fulfilled = requests.filter(request => request.status === 'fulfilled').length;
        const compatible = user.userType === 'donor'
            ? openRequests.filter(request => request.requesterId !== user.id && canDonateTo(user.bloodGroup, request.bloodGroup))
            : [];
        const locationKey = (user.location || '').trim().toLocaleLowerCase();
        compatible.sort((a, b) => {
            const aSamePlace = (a.hospital || '').trim().toLocaleLowerCase() === locationKey ? 1 : 0;
            const bSamePlace = (b.hospital || '').trim().toLocaleLowerCase() === locationKey ? 1 : 0;
            return Number(b.urgency === 'High') - Number(a.urgency === 'High')
                || bSamePlace - aSamePlace
                || new Date(b.createdAt) - new Date(a.createdAt);
        });
        const myRequests = requests.filter(request => request.requesterId === user.id);
        const donors = users.filter(profile => profile.userType === 'donor' && profile.isAvailable && profile.id !== user.id);
        const updates = await Store.getCampusUpdates();
        const availableDonors = users.filter(profile => profile.userType === 'donor' && profile.isAvailable).length;
        const metrics = `<div class="mission-metrics">
            <article class="metric-tile"><span class="metric-icon"><i data-lucide="users-round"></i></span><div><strong>${availableDonors}</strong><small>available donors</small></div><span class="metric-foot">LIVE PROFILES</span></article>
            <article class="metric-tile"><span class="metric-icon"><i data-lucide="radio-tower"></i></span><div><strong>${openRequests.length}</strong><small>active missions</small></div><span class="metric-foot">OPEN NOW</span></article>
            <article class="metric-tile"><span class="metric-icon"><i data-lucide="badge-check"></i></span><div><strong>${fulfilled}</strong><small>fulfilled missions</small></div><span class="metric-foot">REQUESTER CONFIRMED</span></article>
        </div>`;
        let workspace;
        if (user.userType === 'admin') {
            workspace = `<div class="workspace-heading"><div><p class="eyebrow">NETWORK OPERATIONS</p><h3>Live mission board</h3></div><button class="btn btn-secondary" onclick="app.navigate('admin')"><i data-lucide="sliders-horizontal"></i> Admin control room</button></div>
                ${app.renderRequests(requests, true)}
                <div class="workspace-heading mt-3"><div><p class="eyebrow">BROADCASTS</p><h3>Campus updates</h3></div></div>${app.renderUpdates(updates, requests, user)}`;
        } else if (user.userType === 'donor') {
            workspace = `<div class="availability-panel ${user.isAvailable ? 'is-available' : ''}">
                    <div class="availability-pulse"><span></span></div><div class="availability-copy"><p class="eyebrow">YOUR DONOR STATUS</p><h3>${user.isAvailable ? 'You’re visible for matching' : 'You’re paused from matching'}</h3><p class="text-sm mt-1">${user.isAvailable ? 'Compatible active requests can find your profile.' : 'Turn availability on whenever you are ready.'}</p></div>
                    <button class="btn ${user.isAvailable ? 'btn-secondary' : 'btn-primary'}" onclick="app.toggleDonorAvailability()">${user.isAvailable ? 'Pause availability' : 'Become available'}</button>
                </div>
                <div class="workspace-heading"><div><p class="eyebrow">MATCHES FOR ${escapeHtml(user.bloodGroup || 'YOUR GROUP')}</p><h3>Requests you can help with</h3></div><span class="board-count">${compatible.length} MATCH${compatible.length === 1 ? '' : 'ES'}</span></div>
                <p class="text-sm mb-2">Prioritized by urgency and entered location. Compatibility is informational and must be confirmed by medical staff.</p>
                ${app.renderRequests(compatible, false, user)}
                <div class="side-action-card mt-3"><span class="metric-icon"><i data-lucide="bell-ring"></i></span><div><h3>Stay in the loop</h3><p class="text-sm mt-1">Browser reminders use the date you chose with your clinician or blood bank.</p></div><button class="btn btn-secondary mt-2" onclick="app.enableNotifications()">Enable reminders</button></div>`;
        } else {
            workspace = `<div class="workspace-heading"><div><p class="eyebrow">DONOR DIRECTORY</p><h3>Available in your community</h3><p class="text-sm mt-1">Donors control whether their phone number is shared.</p></div><span class="board-count">${donors.length} AVAILABLE</span></div>
                <div class="donor-directory">
                ${donors.length ? `<div class="grid-2 mt-2">${donors.map(donor => `
                    <article class="donor-profile"><span class="donor-avatar">${escapeHtml((donor.name || '?').trim().charAt(0).toUpperCase())}</span><div class="donor-profile-main"><div class="flex justify-between"><strong>${escapeHtml(donor.name)}</strong><span class="blood-chip">${escapeHtml(donor.bloodGroup || 'Not shared')}</span></div>
                    <p class="text-sm mt-1"><i data-lucide="map-pin"></i> ${escapeHtml(donor.location || 'Campus location not set')}</p>
                    ${donor.sharePhone ? `<a class="donor-contact mt-2" href="tel:${escapeHtml(donor.phone)}"><i data-lucide="phone"></i> Call opted-in donor</a>` : '<p class="private-note mt-2">Contact details private</p>'}</div></article>`).join('')}</div>`
                    : '<div class="empty-state"><i data-lucide="users-round"></i><h4>No available donors yet</h4><p>Available profiles appear here when people join and choose to be visible.</p></div>'}</div>
                <div class="workspace-heading mt-3"><div><p class="eyebrow">YOUR CASES</p><h3>My requests</h3></div><button class="btn btn-primary" onclick="app.navigate('request')"><i data-lucide="plus"></i> New mission</button></div>
                ${app.renderRequests(myRequests, false, user)}`;
        }
        return `<section class="view dashboard-view">
            <header class="dashboard-hero"><div class="dashboard-greeting"><p class="eyebrow"><span class="live-dot"></span> MISSION CONTROL <span class="eyebrow-divider"></span> ${escapeHtml(user.userType).toUpperCase()}</p><h1>Welcome back,<br><span class="gradient-text">${escapeHtml(user.name.split(' ')[0])}.</span></h1><p class="hero-copy">${escapeHtml(user.location)}${user.bloodGroup ? ` <span class="inline-separator">·</span> ${escapeHtml(user.bloodGroup)}` : ''}</p></div>
                <div class="dashboard-hero-actions"><button class="icon-action" aria-label="My settings" title="My settings" onclick="app.navigate('settings')"><i data-lucide="settings-2"></i></button>
                ${user.userType === 'donor' ? "<button class=\"btn btn-secondary\" onclick=\"app.navigate('donor-card')\"><i data-lucide=\"qr-code\"></i> Donor card</button>" : ''}
                ${user.userType === 'recipient' ? "<button class=\"btn btn-primary\" onclick=\"app.navigate('request')\"><i data-lucide=\"plus\"></i> Start a mission</button>" : ''}</div>
            </header>
            ${metrics}
            <div class="mission-board-heading"><div><p class="eyebrow">LIVE NETWORK</p><h2>${user.userType === 'donor' ? 'Your matching feed' : user.userType === 'admin' ? 'Network activity' : 'Your coordination desk'}</h2></div><span class="live-status"><span class="live-dot"></span> UPDATING LIVE</span></div>
            <div class="dashboard-workspace">${workspace}</div>
            ${user.userType !== 'admin' ? `<section class="mt-3"><h3>Campus notices</h3>${app.renderUpdates(updates, requests, user)}</section>` : ''}
            <p class="notice mt-3"><strong>Safety note</strong> Matching is informational only. Blood group and donor eligibility must be confirmed by qualified medical staff.</p>
        </section>`;
    },

    request: () => {
        const user = Store.getCurrentUser();
        if (!user || user.userType !== 'recipient') return `<section class="view narrow card glass"><p>Only signed-in recipient accounts can post requests.</p><button class="btn btn-primary mt-2" onclick="app.navigate('login')">Continue</button></section>`;
        return `<section class="view narrow request-view"><div class="card glass mission-form">
            <p class="eyebrow">Urgent request</p><h1 class="page-heading">Post an SOS</h1>
            <p class="text-sm mb-3">Information you enter is visible to signed-in campus users so potential donors can respond.</p>
            <form onsubmit="app.submitRequest(event)">
                <div class="form-group"><label class="form-label" for="req-patient">Patient name or initials</label><input id="req-patient" class="form-input" required maxlength="100"></div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label" for="req-bg">Blood group needed</label><select id="req-bg" class="form-select" required><option value="">Select group</option>${groupOptions('')}</select></div>
                    <div class="form-group"><label class="form-label" for="req-urgency">Urgency</label><select id="req-urgency" class="form-select"><option value="High">Urgent</option><option value="Normal">Within 24–48 hours</option></select></div>
                </div>
                <div class="form-group"><label class="form-label" for="req-location">Hospital / meeting location</label><input id="req-location" class="form-input" required maxlength="160"></div>
                <div class="form-group"><label class="form-label" for="req-contact">Contact number</label><input id="req-contact" class="form-input" type="tel" value="${escapeHtml(user.phone || '')}" required maxlength="30"></div>
                <label class="check-row"><input id="req-consent" type="checkbox" required> I agree to share these request details with signed-in campus users</label>
                <button class="btn btn-primary w-full mt-2" type="submit">Broadcast SOS</button>
            </form>
        </div></section>`;
    },

    settings: () => {
        const user = Store.getCurrentUser();
        if (!user) return `<section class="view narrow card glass"><p>Please log in to edit account settings.</p></section>`;
        return `<section class="view narrow"><div class="card glass"><h1 class="page-heading">My settings</h1>
            <form class="mt-3" onsubmit="app.saveSettings(event)">
                <div class="form-group"><label class="form-label" for="profile-name">Full name</label><input id="profile-name" class="form-input" required maxlength="100" value="${escapeHtml(user.name)}"></div>
                <div class="form-group"><label class="form-label" for="profile-phone">Phone</label><input id="profile-phone" class="form-input" type="tel" required maxlength="30" value="${escapeHtml(user.phone)}"></div>
                <div class="form-group"><label class="form-label" for="profile-location">Campus location / dorm</label><input id="profile-location" class="form-input" required maxlength="120" value="${escapeHtml(user.location)}"></div>
                ${user.userType === 'donor' ? `
                <label class="check-row"><input id="profile-available" type="checkbox" ${user.isAvailable ? 'checked' : ''}> Show me as available to compatible requests</label>
                <div class="form-group mt-2"><label class="form-label" for="profile-last-donation">Last donation date (optional)</label><input id="profile-last-donation" class="form-input" type="date" value="${escapeHtml(user.lastDonationDate || '')}"></div>
                <div class="form-group"><label class="form-label" for="profile-reminder">Reminder date you chose with your clinician/blood bank</label><input id="profile-reminder" class="form-input" type="date" value="${escapeHtml(user.reminderDate || '')}"></div>
                <label class="check-row"><input id="profile-share-phone" type="checkbox" ${user.sharePhone ? 'checked' : ''}> Share my phone with signed-in users in the donor directory</label>
                <label class="check-row mt-2"><input id="profile-qr-phone" type="checkbox" ${user.qrSharePhone ? 'checked' : ''}> Include my phone in my QR card when I generate it</label>
                ` : ''}
                <button class="btn btn-primary w-full mt-3" type="submit">Save my details</button>
            </form>
            <p class="notice mt-3">Donation reminders are user-selected convenience alerts, not a medical eligibility decision. Follow qualified medical advice.</p>
        </div></section>`;
    },

    'donor-card': () => {
        const user = Store.getCurrentUser();
        if (!user || user.userType !== 'donor') return `<section class="view narrow card glass"><p>Donor cards are available to donor accounts.</p></section>`;
        return `<section class="view narrow"><div class="card glass text-center">
            <div class="flex justify-between gap-2"><button class="btn btn-secondary" onclick="app.navigate('dashboard')"><i data-lucide="arrow-left"></i> Back to dashboard</button><button class="btn btn-secondary" onclick="app.navigate('home')"><i data-lucide="house"></i> Home</button></div>
            <p class="eyebrow">Your information, generated on this device</p><h1 class="page-heading">Donor QR card</h1>
            <div class="qr-profile mt-3"><h2>${escapeHtml(user.name)}</h2><p class="blood-type">${escapeHtml(user.bloodGroup || 'Blood group not set')}</p><p>${escapeHtml(user.location || '')}</p>
                ${user.qrSharePhone ? `<p>${escapeHtml(user.phone || '')}</p>` : '<p class="text-sm">Phone excluded by your privacy setting</p>'}</div>
            <button class="btn btn-primary mt-3" onclick="app.generateQr()">Generate QR card</button>
            <div id="qr-output" class="qr-output mt-3" role="img" aria-live="polite" aria-label="Generated donor contact QR code"></div>
            <p id="qr-help" class="text-sm mt-2" role="status">Generate the code, then scan it with your phone camera or a QR scanner to read or save the contact.</p>
            <p class="notice mt-3">The QR creates a contact card from the details shown above. Anyone who scans it can read those details. Blood type is user-entered and must be independently verified.</p>
        </div></section>`;
    },

    admin: async () => {
        const user = Store.getCurrentUser();
        if (!user || user.userType !== 'admin') return `<section class="view narrow card glass"><h2>Admin tools</h2><p class="mt-2">This area is only available to the campus administrator.</p></section>`;
        const [requests, updates, analytics] = await Promise.all([
            Store.getRequests(), Store.getCampusUpdates(), Store.getAdminAnalytics()
        ]);
        const groups = Object.entries(analytics.requests.byBloodGroup);
        const maxGroupCount = Math.max(1, ...groups.map(([, count]) => count));
        const analyticsSection = `<div class="grid-3 stats">
                <div class="card glass"><strong>${analytics.accounts.total}</strong><span>accounts · ${analytics.accounts.availableDonors} available donors</span></div>
                <div class="card glass"><strong>${analytics.requests.active}</strong><span>open requests · ${analytics.requests.fulfilled} fulfilled · ${analytics.requests.cancelled} cancelled</span></div>
                <div class="card glass"><strong>${analytics.requests.responseRate}%</strong><span>requests with a donor response · ${analytics.requests.responseCount} total offers</span></div>
            </div>
            <div class="card glass analytics-card mt-2"><div class="flex justify-between align-center"><div><h2>Request insights</h2><p class="text-sm mt-1">${analytics.requests.fulfillmentRate}% fulfillment rate across ${analytics.requests.total} requests</p></div></div>
                ${groups.length ? `<div class="analytics-bars mt-2" aria-label="Requests by blood group">${groups.map(([group, count]) => `<div class="analytics-row"><span>${escapeHtml(group)}</span><span class="analytics-track"><span style="width:${Math.round(count / maxGroupCount * 100)}%"></span></span><strong>${count}</strong></div>`).join('')}</div>` : '<p class="text-sm mt-2">Blood-group insights will appear when requests are entered.</p>'}
            </div>`;
        const demoSection = `<section class="card glass mt-3"><div class="flex justify-between align-center"><div><h2>Demo requests</h2><p class="text-sm mt-1">Create your own clearly labeled demo entries for a portfolio walkthrough. No sample data is preloaded.</p></div>
                <button class="btn btn-secondary" type="button" onclick="app.clearDemoRequests()" ${analytics.demoRequests ? '' : 'disabled'}>Clear ${analytics.demoRequests} demo request(s)</button></div>
                <form onsubmit="app.createDemoRequest(event)" class="mt-2 demo-request-form">
                    <div class="grid-2"><div class="form-group"><label class="form-label" for="demo-patient">Demo patient name or initials</label><input id="demo-patient" class="form-input" required maxlength="100"></div>
                    <div class="form-group"><label class="form-label" for="demo-bg">Blood group needed</label><select id="demo-bg" class="form-select" required><option value="">Select group</option>${groupOptions('')}</select></div>
                    <div class="form-group"><label class="form-label" for="demo-location">Demo hospital / location</label><input id="demo-location" class="form-input" required maxlength="160"></div>
                    <div class="form-group"><label class="form-label" for="demo-contact">Demo contact number</label><input id="demo-contact" class="form-input" type="tel" required maxlength="30"></div></div>
                    <div class="form-group"><label class="form-label" for="demo-urgency">Urgency</label><select id="demo-urgency" class="form-select"><option value="High">Urgent</option><option value="Normal">Within 24–48 hours</option></select></div>
                    <button class="btn btn-primary" type="submit">Add demo request</button>
                </form></section>`;
        return `<section class="view dashboard-view admin-control"><div class="workspace-heading"><div><p class="eyebrow">ADMIN CONTROL ROOM</p><h1 class="page-heading">Network overview</h1></div><button class="btn btn-secondary" onclick="app.navigate('dashboard')"><i data-lucide="arrow-left"></i> Mission control</button></div>
            ${analyticsSection}
            ${demoSection}
            <div class="card glass mt-3"><h2>Post a campus notice</h2><p class="text-sm mt-1">Link an active request to let available, compatible donors volunteer directly from the broadcast.</p><form onsubmit="app.createNotice(event)" class="mt-2"><div class="form-group"><label class="form-label" for="notice-title">Title</label><input id="notice-title" class="form-input" required maxlength="120"></div><div class="form-group"><label class="form-label" for="notice-body">Details</label><textarea id="notice-body" class="form-input" rows="4" required maxlength="2000"></textarea></div><div class="form-group"><label class="form-label" for="notice-request">Link to active request (optional)</label><select id="notice-request" class="form-select"><option value="">Announcement only</option>${requests.filter(item => item.status === 'active').map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.patientName)} · ${escapeHtml(item.bloodGroup)} · ${escapeHtml(item.hospital)}</option>`).join('')}</select></div><button class="btn btn-primary" type="submit">Publish notice</button></form></div>
            <h2 class="mt-3">Moderate requests</h2>${app.renderRequests(requests, true)}
            <h2 class="mt-3">Existing notices</h2>${app.renderUpdates(updates, requests, user)}</section>`;
    }
};

const app = {
    currentRoute: 'home',
    refreshTimer: null,

    async init() {
        try {
            await Store.init();
            await this.navigate(Store.isConfigured() ? 'home' : 'setup');
            this.checkReminder();
            if (Store.getCurrentUser()) this.startRealtime();
        } catch (error) {
            this.toast(error.message || 'Unable to start the app.', 'error');
            await this.navigate('setup');
        }
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
            navigator.serviceWorker.register('./service-worker.js').catch(error => console.error('Offline shell setup failed:', error));
        }
    },

    async navigate(route, event, ...args) {
        if (event) event.preventDefault();
        if (!Views[route]) return;
        this.closeNavMenu();
        this.currentRoute = route;
        const root = document.getElementById('app');
        root.innerHTML = '<section class="view narrow card glass"><p>Loading…</p></section>';
        this.updateNav();
        try {
            root.innerHTML = await Views[route](...args);
        } catch (error) {
            root.innerHTML = `<section class="view narrow card glass"><h2>Could not load this page</h2><p class="mt-2">${escapeHtml(error.message)}</p><button class="btn btn-secondary mt-3" onclick="app.navigate('dashboard')">Retry</button></section>`;
            console.error(error);
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (route === 'login') {
            loginApp.toggleAuthMode('login');
            loginApp.updateRoleUI();
        }
        if (route === 'home' && Store.isConfigured()) this.loadHomeUpdates();
        this.updateNav();
        window.scrollTo(0, 0);
    },

    updateNav() {
        const nav = document.getElementById('nav-links');
        if (!nav) return;
        const user = Store.getCurrentUser();
        const routeLink = (route, label) => `<a class="nav-link${this.currentRoute === route ? ' active' : ''}" href="#${route}" ${this.currentRoute === route ? 'aria-current="page"' : ''} onclick="app.navigate('${route}', event)">${label}</a>`;
        nav.innerHTML = `${routeLink('home', 'Home')}
            ${user ? `${routeLink('dashboard', 'Dashboard')}
                ${user.userType === 'recipient' ? routeLink('request', 'Request blood') : ''}
                ${user.userType === 'admin' ? routeLink('admin', 'Admin') : ''}
                ${routeLink('settings', escapeHtml((user.name || 'Account').split(' ')[0]))}
                <button class="btn btn-secondary nav-action" onclick="app.logout()">Log out</button>`
                : `<button class="btn btn-secondary nav-action" onclick="app.navigate('login')">Log in</button>`}`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    toggleNavMenu() {
        const nav = document.getElementById('nav-links');
        const button = document.querySelector('.mobile-menu-btn');
        if (!nav || !button) return;
        const expanded = nav.classList.toggle('active');
        button.setAttribute('aria-expanded', String(expanded));
    },

    closeNavMenu() {
        const nav = document.getElementById('nav-links');
        const button = document.querySelector('.mobile-menu-btn');
        nav?.classList.remove('active');
        button?.setAttribute('aria-expanded', 'false');
    },

    async joinAs(role) {
        loginApp.userType = role;
        await this.navigate('login');
        loginApp.toggleAuthMode('register');
    },

    renderRequests(requests, admin = false, user = Store.getCurrentUser()) {
        if (!requests.length) return `<div class="card glass text-center"><p>No requests to show yet. Requests entered by recipients appear here.</p></div>`;
        return requests.map(request => {
            const userResponse = request.responses.find(response => response.donorId === user?.id);
            const responded = Boolean(userResponse);
            const statusBadge = request.status === 'active' ? 'badge-danger' : request.status === 'fulfilled' ? 'badge-success' : 'badge-cancelled';
            const canReviewResponses = admin || user?.id === request.requesterId;
            return `<article class="mission-card ${request.urgency === 'High' && request.status === 'active' ? 'mission-urgent' : ''}">
                <div class="mission-card-top"><div class="mission-case-id"><i data-lucide="activity"></i> CASE ${escapeHtml(request.id.slice(0, 8).toUpperCase())}${request.isDemo ? ' <span class="badge badge-demo">DEMO</span>' : ''}</div>
                    <span class="badge ${statusBadge}">${escapeHtml(request.status)}${request.urgency === 'High' && request.status === 'active' ? ' · URGENT' : ''}</span></div>
                <div class="mission-card-title"><div><h3>${escapeHtml(request.patientName)}</h3><p class="text-sm mt-1">Posted by ${escapeHtml(request.requesterName)} · ${formatDateTime(request.createdAt)}</p></div><span class="blood-chip blood-chip-large">${escapeHtml(request.bloodGroup)}</span></div>
                <div class="mission-meta"><span><i data-lucide="map-pin"></i>${escapeHtml(request.hospital)}</span><span><i data-lucide="users-round"></i>${request.responses.length} donor offer${request.responses.length === 1 ? '' : 's'}</span><span><i data-lucide="clock-3"></i>${escapeHtml(request.urgency === 'High' ? 'Urgent' : 'Within 24–48 hours')}</span></div>
                ${app.renderMissionTimeline(request)}
                ${user?.userType === 'donor' && request.status === 'active' ? `<p class="text-sm mt-1"><strong>Requester contact:</strong> ${escapeHtml(request.contact)}</p>
                    ${responded ? `<p class="text-sm mt-1">Your offer: ${escapeHtml(userResponse.status)}</p>` : ''}
                    <button class="btn ${responded ? 'btn-secondary' : 'btn-primary'} mt-2" ${responded ? 'disabled' : ''} onclick="app.respondToRequest('${escapeHtml(request.id)}')"><i data-lucide="${responded ? 'check' : 'heart-handshake'}"></i> ${responded ? 'Offer sent' : 'Send donor offer'}</button>` : ''}
                ${request.responses.length && canReviewResponses ? `<div class="response-list mt-2"><h4>Donor offers</h4>${request.responses.map(response => `<div class="response-row"><p>${escapeHtml(response.donorName)} · ${escapeHtml(response.donorBlood)} · ${escapeHtml(response.status)}${response.donorPhone ? ` · <a href="tel:${escapeHtml(response.donorPhone)}">${escapeHtml(response.donorPhone)}</a>` : ''}</p>
                    ${user?.id === request.requesterId && request.status === 'active' && response.status === 'offered' ? `<div class="flex gap-2 mt-1"><button class="btn btn-primary" onclick="app.reviewResponse('${escapeHtml(request.id)}','${escapeHtml(response.id)}','accepted')">Accept offer</button><button class="btn btn-secondary" onclick="app.reviewResponse('${escapeHtml(request.id)}','${escapeHtml(response.id)}','declined')">Decline</button></div>` : ''}</div>`).join('')}</div>` : ''}
                ${request.responses.length && !canReviewResponses ? '<p class="text-sm mt-1">Donor offers are visible to the person who posted this request.</p>' : ''}
                ${(user?.id === request.requesterId || admin) && request.status === 'active' ? `<div class="mission-actions">${user?.id === request.requesterId ? `<button class="btn btn-secondary mt-2" onclick="app.resolveRequest('${escapeHtml(request.id)}','fulfilled')"><i data-lucide="badge-check"></i> Mark fulfilled</button>` : ''}<button class="btn btn-secondary mt-2" onclick="app.resolveRequest('${escapeHtml(request.id)}','cancelled')">${admin ? 'Close mission' : 'Cancel request'}</button></div>` : ''}
            </article>`;
        }).join('');
    },

    renderMissionTimeline(request) {
        const offersReceived = request.responses.length > 0;
        const accepted = request.responses.some(response => response.status === 'accepted');
        const closed = request.status !== 'active';
        const steps = [
            { label: 'Mission opened', done: true, detail: formatDateTime(request.createdAt) },
            { label: 'Donor offers', done: offersReceived, detail: offersReceived ? `${request.responses.length} received` : 'Waiting for offers' },
            { label: 'Donor confirmed', done: accepted, detail: accepted ? 'Offer accepted' : offersReceived ? 'Awaiting review' : 'After an offer' },
            { label: 'Mission closed', done: closed, detail: closed ? `${request.status} · ${formatDateTime(request.closedAt)}` : 'In progress' }
        ];
        const currentIndex = closed ? -1 : steps.findIndex((step, index) => !step.done && index > 0);
        return `<ol class="mission-timeline" aria-label="Mission progress">${steps.map((step, index) => `<li class="${step.done ? 'is-done' : index === currentIndex ? 'is-current' : ''}">
            <span class="timeline-node">${step.done ? '<i data-lucide="check"></i>' : `<span>${index + 1}</span>`}</span><span class="timeline-label">${step.label}</span><small>${escapeHtml(step.detail)}</small></li>`).join('')}</ol>`;
    },

    renderUpdates(updates, requests = [], user = Store.getCurrentUser()) {
        if (!updates.length) return `<div class="card glass"><p>No notices have been posted by an administrator.</p></div>`;
        return `<div class="grid-2">${updates.map(item => {
            const request = requests.find(entry => entry.id === item.requestId);
            const userResponse = request?.responses.find(response => response.donorId === user?.id);
            let action = '';
            if (request) {
                if (request.status !== 'active') {
                    action = '<p class="text-sm mt-2">This linked request is no longer active.</p>';
                } else if (!user) {
                    action = `<button class="btn btn-primary mt-2" onclick="app.joinAs('donor')">Join as a donor to volunteer</button>`;
                } else if (user.userType === 'donor' && userResponse) {
                    action = `<p class="text-sm mt-2">Your offer: ${escapeHtml(userResponse.status)}</p>`;
                } else if (user.userType === 'donor' && !user.isAvailable) {
                    action = '<p class="text-sm mt-2">Turn on donor availability from Mission Control to volunteer.</p>';
                } else if (user.userType === 'donor' && !canDonateTo(user.bloodGroup, request.bloodGroup)) {
                    action = `<p class="text-sm mt-2">This request needs ${escapeHtml(request.bloodGroup)} blood; it is not a match for your profile.</p>`;
                } else if (user.userType === 'donor') {
                    action = `<button class="btn btn-primary mt-2" onclick="app.respondToRequest('${escapeHtml(request.id)}')">Volunteer to donate</button>`;
                }
            }
            const requestSummary = request
                ? `<p class="notice-link-summary mt-2"><strong>${escapeHtml(request.patientName)}</strong> · ${escapeHtml(request.bloodGroup)} · ${escapeHtml(request.hospital)} · ${escapeHtml(request.urgency === 'High' ? 'Urgent' : 'Within 24–48 hours')}</p>`
                : '';
            return `<article class="card glass campus-notice"><h3>${escapeHtml(item.title)}</h3><p class="mt-1">${escapeHtml(item.body)}</p>${requestSummary}<p class="text-sm mt-1">${formatDate(item.createdAt)}</p>${action}</article>`;
        }).join('')}</div>`;
    },

    async loadHomeUpdates() {
        const node = document.getElementById('home-updates');
        if (!node) return;
        try {
            const [updates, requests] = await Promise.all([
                Store.getCampusUpdates(),
                Store.getCurrentUser() ? Store.getRequests() : Promise.resolve([])
            ]);
            node.innerHTML = `<h3>Campus notices</h3>${this.renderUpdates(updates, requests)}`;
        } catch (error) {
            console.error('Unable to load notices:', error);
        }
    },

    async submitRequest(event) {
        event.preventDefault();
        const user = Store.getCurrentUser();
        try {
            await Store.createRequest({
                requesterId: user.id, requesterName: user.name,
                patientName: document.getElementById('req-patient').value.trim(),
                bloodGroup: document.getElementById('req-bg').value,
                hospital: document.getElementById('req-location').value.trim(),
                contact: document.getElementById('req-contact').value.trim(),
                urgency: document.getElementById('req-urgency').value
            });
            this.toast('SOS posted to the live campus board.', 'success');
            await this.navigate('dashboard');
        } catch (error) {
            this.toast(error.message || 'Could not post the request.', 'error');
        }
    },

    async respondToRequest(requestId) {
        try {
            await Store.addResponseToRequest(requestId, Store.getCurrentUser().id);
            this.toast('Your offer was sent to the requester.', 'success');
            await this.navigate(this.currentRoute === 'home' ? 'home' : 'dashboard');
        } catch (error) {
            this.toast(error.message || 'Could not send your offer.', 'error');
        }
    },

    async resolveRequest(requestId, status) {
        if (status === 'cancelled' && !window.confirm('Close this request as cancelled? This cannot be undone.')) return;
        try {
            await Store.resolveRequest(requestId, status);
            this.toast(`Request ${status}.`, 'success');
            await this.navigate(this.currentRoute);
        } catch (error) {
            this.toast(error.message || 'Could not update request status.', 'error');
        }
    },

    async reviewResponse(requestId, responseId, status) {
        try {
            await Store.reviewResponse(requestId, responseId, status);
            this.toast(`Donor offer ${status}.`, 'success');
            await this.navigate(this.currentRoute);
        } catch (error) {
            this.toast(error.message || 'Could not review the donor offer.', 'error');
        }
    },

    async createDemoRequest(event) {
        event.preventDefault();
        try {
            await Store.createDemoRequest({
                patientName: document.getElementById('demo-patient').value.trim(),
                bloodGroup: document.getElementById('demo-bg').value,
                hospital: document.getElementById('demo-location').value.trim(),
                contact: document.getElementById('demo-contact').value.trim(),
                urgency: document.getElementById('demo-urgency').value
            });
            this.toast('Your demo request was added and labeled.', 'success');
            await this.navigate('admin');
        } catch (error) {
            this.toast(error.message || 'Could not add the demo request.', 'error');
        }
    },

    async clearDemoRequests() {
        if (!window.confirm('Remove only requests labeled DEMO? Regular requests and accounts will stay untouched.')) return;
        try {
            const result = await Store.clearDemoRequests();
            this.toast(`${result.removed} demo request(s) and ${result.removedNotices} linked notice(s) cleared.`, 'success');
            await this.navigate('admin');
        } catch (error) {
            this.toast(error.message || 'Could not clear demo requests.', 'error');
        }
    },

    async toggleDonorAvailability() {
        try {
            const updated = await Store.updateUser({ ...Store.getCurrentUser(), isAvailable: !Store.getCurrentUser().isAvailable });
            this.toast(updated.isAvailable ? 'You are available for matches.' : 'You are hidden from new matches.', 'success');
            await this.navigate('dashboard');
        } catch (error) {
            this.toast(error.message || 'Could not update availability.', 'error');
        }
    },

    async saveSettings(event) {
        event.preventDefault();
        const user = Store.getCurrentUser();
        const changes = {
            ...user,
            name: document.getElementById('profile-name').value.trim(),
            phone: document.getElementById('profile-phone').value.trim(),
            location: document.getElementById('profile-location').value.trim()
        };
        if (user.userType === 'donor') {
            changes.isAvailable = document.getElementById('profile-available').checked;
            changes.lastDonationDate = document.getElementById('profile-last-donation').value || null;
            changes.reminderDate = document.getElementById('profile-reminder').value || null;
            changes.sharePhone = document.getElementById('profile-share-phone').checked;
            changes.qrSharePhone = document.getElementById('profile-qr-phone').checked;
        }
        try {
            await Store.updateUser(changes);
            this.toast('Your profile was updated.', 'success');
            await this.navigate('dashboard');
            this.checkReminder();
        } catch (error) {
            this.toast(error.message || 'Could not save your settings.', 'error');
        }
    },

    async createNotice(event) {
        event.preventDefault();
        try {
            await Store.createCampusUpdate(
                document.getElementById('notice-title').value.trim(),
                document.getElementById('notice-body').value.trim(),
                document.getElementById('notice-request').value
            );
            this.toast('Campus notice published.', 'success');
            await this.navigate('admin');
        } catch (error) {
            this.toast(error.message || 'Could not publish notice.', 'error');
        }
    },

    async enableNotifications() {
        if (!('Notification' in window)) {
            this.toast('This browser does not support notifications.', 'error');
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            this.toast('Notifications were not enabled. You can still check the live dashboard.', 'info');
            return;
        }
        localStorage.setItem('bloodmatch.notifications', 'enabled');
        this.toast('Browser reminders enabled while the app is open.', 'success');
        this.checkReminder();
    },

    checkReminder() {
        const user = Store.getCurrentUser();
        if (!user?.reminderDate || localStorage.getItem('bloodmatch.notifications') !== 'enabled' || !('Notification' in window) || Notification.permission !== 'granted') return;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const notifiedKey = `bloodmatch.reminded.${user.id}.${user.reminderDate}`;
        if (user.reminderDate <= today && !localStorage.getItem(notifiedKey)) {
            new Notification('BloodMatch reminder', { body: 'Your reminder date has arrived. Follow your blood bank or clinician’s advice.' });
            localStorage.setItem(notifiedKey, 'true');
        }
    },

    generateQr() {
        const output = document.getElementById('qr-output');
        const user = Store.getCurrentUser();
        const help = document.getElementById('qr-help');
        if (!output || !user || user.userType !== 'donor') {
            this.toast('Could not find your donor card. Return to your dashboard and try again.', 'error');
            return;
        }
        if (!window.QRCode) {
            help.textContent = 'The QR generator did not load. Check your internet connection, refresh the page, and try again.';
            this.toast('The QR generator is unavailable. Check your connection and retry.', 'error');
            return;
        }
        try {
            output.replaceChildren();
            new QRCode(output, { text: buildDonorVCard(user), width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
            help.textContent = 'Contact card ready. Scan with your phone camera or QR scanner to read or save the donor contact.';
        } catch (error) {
            help.textContent = 'The QR code could not be generated. Please try again.';
            console.error('Could not generate donor QR code:', error);
            this.toast('Could not generate the QR code. Please try again.', 'error');
        }
    },

    startRealtime() {
        if (!Store.isConfigured() || !Store.getCurrentUser()) return;
        Store.subscribeRealtime(payload => {
            const currentUser = Store.getCurrentUser();
            if (payload.table === 'blood_requests' && payload.eventType === 'INSERT'
                && payload.new.urgency === 'High' && currentUser?.userType === 'donor'
                && localStorage.getItem('bloodmatch.notifications') === 'enabled'
                && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('Urgent blood request', { body: `A new ${payload.new.blood_group} request was posted.` });
            }
            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => {
                if (['dashboard', 'admin', 'home'].includes(this.currentRoute)) this.navigate(this.currentRoute);
            }, 350);
        });
    },

    async logout() {
        try {
            await Store.logout();
            this.toast('Logged out.', 'info');
            await this.navigate('home');
        } catch (error) {
            this.toast(error.message || 'Could not log out.', 'error');
        }
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
