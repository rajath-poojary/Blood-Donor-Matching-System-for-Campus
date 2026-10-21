const loginApp = {
    userType: 'donor',
    authMode: 'login',
    hasSelectedMode: false,

    toggleUserType(type) {
        this.userType = type;
        if (type === 'recipient') {
            const bloodGroup = document.getElementById('auth-blood-group');
            if (bloodGroup) bloodGroup.value = '';
        }
        for (const role of ['donor', 'recipient']) {
            const tab = document.getElementById(`tab-${role}`);
            if (!tab) continue;
            const active = type === role;
            tab.style.borderBottom = active ? '2px solid var(--primary)' : 'none';
            tab.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)';
        }
        this.updateRoleUI();
    },

    updateRoleUI() {
        const registerFields = document.getElementById('register-fields');
        const roleSection = document.getElementById('role-section');
        const bloodGroupField = document.getElementById('blood-group-field');
        const sharePhoneRow = document.getElementById('auth-share-row');
        const button = document.getElementById('auth-submit-btn');
        const registering = this.authMode === 'register';
        const passwordInput = document.getElementById('auth-password');
        if (passwordInput) passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
        if (roleSection) roleSection.style.display = registering ? 'block' : 'none';
        if (bloodGroupField) bloodGroupField.style.display = this.userType === 'donor' ? 'block' : 'none';
        if (sharePhoneRow) sharePhoneRow.style.display = this.userType === 'donor' ? 'flex' : 'none';
        if (registerFields) {
            registerFields.style.display = registering ? 'block' : 'none';
            registerFields.querySelectorAll('input, select').forEach(input => { input.disabled = !registering; });
        }
        if (button) {
            button.textContent = this.authMode === 'register'
                ? `Create my ${this.userType} account`
                : 'Log in';
        }
    },

    async handleAdminAuth(event) {
        event.preventDefault();
        const email = document.getElementById('admin-auth-email').value.trim();
        const password = document.getElementById('admin-auth-password').value;
        try {
            await Store.adminLogin(email, password);
            app.toast('Welcome back, administrator.', 'success');
            await app.navigate('dashboard');
        } catch (error) {
            app.toast(error.message || 'Could not sign in as administrator.', 'error');
        }
    },

    toggleAuthMode(mode) {
        this.authMode = mode;
        this.hasSelectedMode = true;
        for (const name of ['login', 'register']) {
            const tab = document.getElementById(`tab-${name}`);
            if (!tab) continue;
            const active = name === mode;
            tab.style.borderBottom = active ? '2px solid var(--primary)' : 'none';
            tab.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)';
        }
        this.updateRoleUI();
    },

    selectBloodGroup(group) {
        document.querySelectorAll('.blood-group-option').forEach(item => item.classList.remove('selected'));
        const id = `bg-${group.replace('+', 'plus').replace('-', 'minus')}`;
        document.getElementById(id)?.classList.add('selected');
        const input = document.getElementById('auth-blood-group');
        if (input) input.value = group;
    },

    async handleAuth(event) {
        event.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        try {
            if (this.authMode === 'login') {
                const user = await Store.login(email, password);
                app.toast('Welcome back!', 'success');
                await app.navigate('dashboard');
                return;
            }

            const name = document.getElementById('auth-name').value.trim();
            const phone = document.getElementById('auth-phone').value.trim();
            const location = document.getElementById('auth-location').value.trim();
            const bloodGroup = document.getElementById('auth-blood-group').value;
            if (!name || !phone || !location) throw new Error('Complete all profile fields.');
            if (this.userType === 'donor' && !bloodGroup) throw new Error('Select your blood group.');

            const result = await Store.register({
                email, password, name, phone, location, bloodGroup, userType: this.userType,
                sharePhone: this.userType === 'donor' && document.getElementById('auth-share-phone').checked,
                adminSetupCode: document.getElementById('auth-admin-code').value.trim()
            });
            if (result.needsEmailConfirmation) {
                app.toast('Check your email to confirm your account, then log in.', 'success');
                this.toggleAuthMode('login');
                return;
            }
            app.toast('You’re in! Welcome to the campus community.', 'success');
            await app.navigate('dashboard');
        } catch (error) {
            app.toast(error.message || 'Authentication failed.', 'error');
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    loginApp.updateRoleUI();
    loginApp.toggleUserType('donor');
});
