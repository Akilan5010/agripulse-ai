// AgriPulse AI - Authentication Forms and Sessions Actions Manager

function setupAuthListeners() {
    // 1. Tab Swappers (Login / Register)
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            formLogin.classList.add('active');
            formRegister.classList.remove('active');
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            formRegister.classList.add('active');
            formLogin.classList.remove('active');
        });
    }

    // 2. Login submit handler
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                if (response.ok) {
                    window.appState.currentUser = data.user;
                    window.updateUIState();
                    window.showToast('Logged in successfully!', 'success');
                    window.location.hash = '#dashboard';
                    loginForm.reset();
                } else {
                    window.showToast(data.error || 'Login failed', 'error');
                }
            } catch (err) {
                console.error(err);
                window.showToast('Network error during login.', 'error');
            }
        });
    }

    // 3. Register submit handler
    const registerForm = document.getElementById('form-register');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const full_name = document.getElementById('reg-fullname').value.trim();
            const contact = document.getElementById('reg-contact').value.trim();
            const location = document.getElementById('reg-location').value.trim();
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, full_name, contact, location, password })
                });

                const data = await response.json();
                if (response.ok) {
                    window.showToast('Registration successful! Please login.', 'success');
                    // Switch to login tab
                    tabLogin.click();
                    registerForm.reset();
                } else {
                    window.showToast(data.error || 'Registration failed.', 'error');
                }
            } catch (err) {
                console.error(err);
                window.showToast('Network error during registration.', 'error');
            }
        });
    }

    // 4. Logout handler
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.appState.currentUser = null;
                    window.updateUIState();
                    window.showToast('Logged out successfully.', 'success');
                    window.location.hash = '#auth';
                    
                    // Reset chart objects
                    if (window.appState.charts.nutrients) {
                        window.appState.charts.nutrients.destroy();
                        window.appState.charts.nutrients = null;
                    }
                    if (window.appState.charts.cropShare) {
                        window.appState.charts.cropShare.destroy();
                        window.appState.charts.cropShare = null;
                    }
                }
            } catch (err) {
                console.error(err);
                window.showToast('Logout failed.', 'error');
            }
        });
    }

    // 5. Profile Update Form
    const profileForm = document.getElementById('form-profile');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('prof-fullname').value.trim();
            const contact = document.getElementById('prof-contact').value.trim();
            const location = document.getElementById('prof-location').value.trim();
            const password = document.getElementById('prof-password').value;

            const payload = { full_name, contact, location };
            if (password) payload.password = password;

            try {
                const response = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (response.ok) {
                    window.appState.currentUser = data.user;
                    window.updateUIState();
                    window.showToast('Profile updated successfully!', 'success');
                    document.getElementById('prof-password').value = '';
                } else {
                    window.showToast(data.error || 'Update failed.', 'error');
                }
            } catch (err) {
                console.error(err);
                window.showToast('Network error updating profile.', 'error');
            }
        });
    }
}

// Populate Profile fields in Settings Tab
function loadProfileForm() {
    const user = window.appState.currentUser;
    if (user) {
        document.getElementById('prof-username').value = user.username;
        document.getElementById('prof-fullname').value = user.full_name || '';
        document.getElementById('prof-contact').value = user.contact || '';
        document.getElementById('prof-location').value = user.location || '';
        document.getElementById('prof-password').value = '';
    }
}

window.setupAuthListeners = setupAuthListeners;
window.loadProfileForm = loadProfileForm;
