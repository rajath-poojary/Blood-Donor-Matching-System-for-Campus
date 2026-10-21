const Store = {
    currentUser: null,
    eventSource: null,

    async request(path, options = {}) {
        const response = await fetch(`/api${path}`, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const payload = response.status === 204 ? null : await response.json();
        if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
        return payload;
    },

    async init() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('localDB');
        localStorage.removeItem('bloodmatch.supabase');
        this.currentUser = await this.request('/session');
        app.updateNav();
        if (this.currentUser) app.startRealtime();
        return this.currentUser;
    },

    isConfigured() {
        return true;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    async getServerStatus() {
        return this.request('/status');
    },

    async register(user) {
        const result = await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(user)
        });
        this.currentUser = result.user;
        if (this.currentUser) app.startRealtime();
        return result;
    },

    async login(email, password) {
        const result = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.currentUser = result.user;
        app.startRealtime();
        return this.currentUser;
    },

    async logout() {
        await this.request('/logout', { method: 'POST', body: '{}' });
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.currentUser = null;
    },

    async updateUser(changes) {
        const result = await this.request('/profile', {
            method: 'PATCH',
            body: JSON.stringify({
                name: changes.name,
                phone: changes.phone,
                location: changes.location,
                isAvailable: changes.isAvailable,
                sharePhone: changes.sharePhone,
                qrSharePhone: changes.qrSharePhone,
                lastDonationDate: changes.lastDonationDate,
                reminderDate: changes.reminderDate
            })
        });
        this.currentUser = result.user;
        return this.currentUser;
    },

    async getUsers() {
        return this.request('/users');
    },

    async getRequests() {
        return this.request('/requests');
    },

    async getRequestById(id) {
        return this.request(`/requests/${encodeURIComponent(id)}`);
    },

    async getMyRequests(userId) {
        const requests = await this.getRequests();
        return requests.filter(request => request.requesterId === userId);
    },

    async createRequest(request) {
        return this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    },

    async addResponseToRequest(requestId) {
        return this.request(`/requests/${encodeURIComponent(requestId)}/respond`, {
            method: 'POST',
            body: '{}'
        });
    },

    async resolveRequest(requestId, status = 'fulfilled') {
        return this.request(`/requests/${encodeURIComponent(requestId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async reviewResponse(requestId, responseId, status) {
        return this.request(`/requests/${encodeURIComponent(requestId)}/responses/${encodeURIComponent(responseId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async getAdminAnalytics() {
        return this.request('/admin/analytics');
    },

    async createDemoRequest(request) {
        return this.request('/admin/demo-requests', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    },

    async clearDemoRequests() {
        return this.request('/admin/demo-requests', { method: 'DELETE' });
    },

    async getCampusUpdates() {
        return this.request('/notices');
    },

    async createCampusUpdate(title, body) {
        return this.request('/notices', {
            method: 'POST',
            body: JSON.stringify({ title, body })
        });
    },

    subscribeRealtime(onChange) {
        if (this.eventSource) return this.eventSource;
        this.eventSource = new EventSource('/api/events', { withCredentials: true });
        this.eventSource.addEventListener('message', event => {
            try {
                onChange(JSON.parse(event.data));
            } catch (error) {
                console.error('Could not read a live update:', error);
            }
        });
        this.eventSource.addEventListener('error', () => {
            if (this.eventSource?.readyState === EventSource.CLOSED) {
                app.toast('Live connection lost. Reload the page after the server is available.', 'error');
            }
        });
        return this.eventSource;
    }
};
