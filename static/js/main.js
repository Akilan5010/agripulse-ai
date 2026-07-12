// AgriPulse AI - Core Client Application Manager

// Global State
window.appState = {
    currentUser: null,
    historyLoaded: false,
    cropGuideLoaded: false,
    charts: {
        nutrients: null,
        cropShare: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// App Entry Point
async function initApp() {
    setupRouting();
    setupMobileNav();
    setupAuthListeners();
    
    // Check if session exists
    await checkSession();
}

// Router Manager (Single Page App)
function setupRouting() {
    const handleRoute = () => {
        let hash = window.location.hash || '#auth';
        
        // If not logged in, force auth screen
        if (!window.appState.currentUser && hash !== '#auth') {
            window.location.hash = '#auth';
            return;
        }
        
        // If logged in, don't allow auth screen
        if (window.appState.currentUser && hash === '#auth') {
            window.location.hash = '#dashboard';
            return;
        }

        // Parse screen name
        const screenId = 'screen-' + hash.replace('#', '');
        const targetScreen = document.getElementById(screenId);
        
        if (targetScreen) {
            // Hide all screens
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            // Show target screen
            targetScreen.classList.add('active');
            
            // Sync Navigation Links
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.getAttribute('href') === hash) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
            
            // Trigger screen specific initialization logic
            triggerScreenInit(hash);
        } else {
            // Fallback
            window.location.hash = window.appState.currentUser ? '#dashboard' : '#auth';
        }
        
        // Close mobile nav on transition
        document.getElementById('nav-list').classList.remove('active');
    };

    window.addEventListener('hashchange', handleRoute);
    // Trigger initial route
    setTimeout(handleRoute, 50);
}

// Route Specific Loaders
function triggerScreenInit(hash) {
    if (hash === '#dashboard') {
        loadDashboardSummary();
        loadHistoryTable();
    } else if (hash === '#crops') {
        loadCropsGuide();
    } else if (hash === '#admin') {
        initAdminPanel();
    } else if (hash === '#profile') {
        loadProfileForm();
    }
}

// Mobile Menu toggles
function setupMobileNav() {
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    const navList = document.getElementById('nav-list');
    
    toggleBtn.addEventListener('click', () => {
        navList.classList.toggle('active');
    });
}

// Auth State Class Updater
function updateUIState() {
    const body = document.body;
    body.className = ''; // Reset classes
    
    if (window.appState.currentUser) {
        body.classList.add('state-logged-in');
        if (window.appState.currentUser.role === 'admin') {
            body.classList.add('state-logged-in-admin');
        } else {
            body.classList.add('state-logged-in-farmer');
        }
        
        // Populate farmer tags across views
        const usernameTags = document.querySelectorAll('#dash-user-name, #report-farmer-name');
        usernameTags.forEach(tag => {
            tag.textContent = window.appState.currentUser.full_name || window.appState.currentUser.username;
        });
    } else {
        body.classList.add('state-logged-out');
    }
}

// Session Checker
async function checkSession() {
    try {
        const response = await fetch('/api/auth/profile');
        if (response.ok) {
            const data = await response.json();
            window.appState.currentUser = data.user;
            updateUIState();
            
            // If on auth page, redirect to dashboard
            if (window.location.hash === '' || window.location.hash === '#auth') {
                window.location.hash = '#dashboard';
            }
        } else {
            // Unauthenticated
            window.appState.currentUser = null;
            updateUIState();
            window.location.hash = '#auth';
        }
    } catch (err) {
        console.error('Session check failed:', err);
        window.appState.currentUser = null;
        updateUIState();
        window.location.hash = '#auth';
    }
}

// Global Toast Alerts
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-triangle-exclamation"></i>';
        
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    // Animate removal
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.35s reverse ease-in forwards';
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, 4000);
}

// Export functions to global scope
window.showToast = showToast;
window.updateUIState = updateUIState;
window.checkSession = checkSession;
