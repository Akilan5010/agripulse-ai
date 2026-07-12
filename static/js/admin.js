// AgriPulse AI - Administrative Control Actions and Manager

function initAdminPanel() {
    setupAdminTabs();
    loadAdminStats();
    loadAdminUsers();
    loadAdminCrops();
    loadAdminModelInfo();
    setupDatasetAdmin();
}

// 1. Admin Sidebar Sub-Tab Navigation
function setupAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const panels = document.querySelectorAll('.admin-panel');
    
    tabs.forEach(tab => {
        // Clone and replace tab to remove duplicate click events
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            newTab.classList.add('active');
            
            const panelId = newTab.id.replace('tab-adm', 'admin-panel');
            panels.forEach(p => {
                if (p.id === panelId) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });
        });
    });
}

// 2. Load Stats Panel Dashboard
async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/system-report');
        if (!response.ok) return;
        
        const data = await response.json();
        
        document.getElementById('adm-stat-farmers').textContent = data.users.farmers;
        document.getElementById('adm-stat-predictions').textContent = data.data_counts.recommendations;
        document.getElementById('adm-stat-soils').textContent = data.data_counts.soil_records;
        
        // Audit Logs history rows
        const tbody = document.getElementById('admin-audit-rows');
        tbody.innerHTML = '';
        
        if (data.recent_audits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No recent recommendations logged.</td></tr>';
            return;
        }
        
        data.recent_audits.forEach(a => {
            const dateStr = new Date(a.date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${a.id}</td>
                <td><strong>${a.username}</strong></td>
                <td><span class="badge-crop">${a.crop}</span></td>
                <td>${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error('Error fetching admin report:', err);
    }
}

// 3. Load User Management Rows
async function loadAdminUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) return;
        
        const users = await response.json();
        const tbody = document.getElementById('admin-user-rows');
        tbody.innerHTML = '';
        
        users.forEach(u => {
            const tr = document.createElement('tr');
            const roleSelect = `
                <select class="role-select" data-user-id="${u.id}" ${u.id === window.appState.currentUser.id ? 'disabled' : ''}>
                    <option value="farmer" ${u.role === 'farmer' ? 'selected' : ''}>Farmer</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            `;
            tr.innerHTML = `
                <td>#${u.id}</td>
                <td><strong>${u.username}</strong></td>
                <td>${u.full_name || 'N/A'}</td>
                <td>${u.contact || 'N/A'}</td>
                <td>${u.location || 'N/A'}</td>
                <td>${roleSelect}</td>
                <td>
                    <button class="btn btn-outline btn-sm btn-update-role" data-user-id="${u.id}" ${u.id === window.appState.currentUser.id ? 'disabled' : ''}>Update Role</button>
                    <button class="btn btn-outline btn-sm btn-delete-user text-danger" style="margin-left: 0.25rem;" data-user-id="${u.id}" ${u.id === window.appState.currentUser.id ? 'disabled' : ''}><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Listeners for updates
        tbody.querySelectorAll('.btn-update-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                const selectEl = tbody.querySelector(`select[data-user-id="${userId}"]`);
                const selectedRole = selectEl.value;
                
                try {
                    const response = await fetch(`/api/admin/users/${userId}/role`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: selectedRole })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        window.showToast(data.message, 'success');
                        loadAdminStats(); // Refresh stats in case counts change
                    } else {
                        window.showToast(data.error || 'Failed to update role.', 'error');
                    }
                } catch (e) {
                    window.showToast('Network error updating user role.', 'error');
                }
            });
        });

        // Listeners for deletion
        tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                if (confirm('Are you sure you want to permanently delete this user account and all their records?')) {
                    try {
                        const response = await fetch(`/api/admin/users/${userId}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
                        if (response.ok) {
                            window.showToast(data.message, 'success');
                            loadAdminUsers(); // Reload table
                            loadAdminStats(); // Refresh stats
                        } else {
                            window.showToast(data.error || 'Failed to delete user.', 'error');
                        }
                    } catch (e) {
                        window.showToast('Network error deleting user.', 'error');
                    }
                }
            });
        });
        
    } catch (err) {
        console.error('Error fetching users:', err);
    }
}

// 4. Crop Database Admin controls (CRUD)
async function loadAdminCrops() {
    try {
        const response = await fetch('/api/crops');
        if (!response.ok) return;
        
        const crops = await response.json();
        const tbody = document.getElementById('admin-crop-rows');
        tbody.innerHTML = '';
        
        crops.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.name}</strong></td>
                <td>${c.growing_season}</td>
                <td>${c.water_requirement}</td>
                <td>${c.expected_yield}</td>
                <td>${c.harvest_duration}</td>
                <td>
                    <button class="btn btn-outline btn-sm btn-edit-crop" data-crop-id="${c.id}"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn btn-outline btn-sm btn-delete-crop text-danger" style="margin-left: 0.25rem;" data-crop-id="${c.id}"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Setup Form actions
        const addBtn = document.getElementById('btn-admin-add-crop');
        const cancelBtn = document.getElementById('btn-admin-cancel-crop');
        const formContainer = document.getElementById('admin-crop-form-container');
        const form = document.getElementById('admin-crop-form');
        
        addBtn.onclick = () => {
            form.reset();
            document.getElementById('adm-crop-id').value = '';
            document.getElementById('admin-crop-form-title').textContent = 'Add New Crop Profile';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        };
        
        cancelBtn.onclick = () => {
            formContainer.classList.add('hidden');
            form.reset();
        };
        
        // Handle Edit clicks
        tbody.querySelectorAll('.btn-edit-crop').forEach(btn => {
            btn.addEventListener('click', () => {
                const cropId = parseInt(btn.dataset.cropId);
                const cropObj = crops.find(item => item.id === cropId);
                
                if (cropObj) {
                    document.getElementById('adm-crop-id').value = cropObj.id;
                    document.getElementById('adm-crop-name').value = cropObj.name;
                    document.getElementById('adm-crop-season').value = cropObj.growing_season;
                    document.getElementById('adm-crop-water').value = cropObj.water_requirement;
                    document.getElementById('adm-crop-yield').value = cropObj.expected_yield;
                    document.getElementById('adm-crop-duration').value = cropObj.harvest_duration;
                    document.getElementById('adm-crop-desc').value = cropObj.description;
                    
                    // Name is unique, so disable editing of name on updates to avoid DB integrity errors
                    document.getElementById('adm-crop-name').disabled = true;
                    
                    document.getElementById('admin-crop-form-title').textContent = `Edit Crop: ${cropObj.name}`;
                    formContainer.classList.remove('hidden');
                    formContainer.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
        
        // Handle Delete clicks
        tbody.querySelectorAll('.btn-delete-crop').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cropId = btn.dataset.cropId;
                if (confirm('Are you sure you want to permanently delete this crop profile from the database?')) {
                    try {
                        const response = await fetch(`/api/crops/${cropId}`, { method: 'DELETE' });
                        const data = await response.json();
                        if (response.ok) {
                            window.showToast(data.message, 'success');
                            loadAdminCrops(); // reload table
                        } else {
                            window.showToast(data.error || 'Failed to delete crop.', 'error');
                        }
                    } catch (e) {
                        window.showToast('Network error deleting crop.', 'error');
                    }
                }
            });
        });
        
        // Handle Form Submit (Add/Edit)
        form.onsubmit = async (e) => {
            e.preventDefault();
            const cropId = document.getElementById('adm-crop-id').value;
            const payload = {
                name: document.getElementById('adm-crop-name').value.trim(),
                growing_season: document.getElementById('adm-crop-season').value.trim(),
                water_requirement: document.getElementById('adm-crop-water').value.trim(),
                expected_yield: document.getElementById('adm-crop-yield').value.trim(),
                harvest_duration: document.getElementById('adm-crop-duration').value.trim(),
                description: document.getElementById('adm-crop-desc').value.trim()
            };
            
            const method = cropId ? 'PUT' : 'POST';
            const url = cropId ? `/api/crops/${cropId}` : '/api/crops';
            
            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                if (response.ok) {
                    window.showToast(data.message || 'Crop profile saved!', 'success');
                    formContainer.classList.add('hidden');
                    form.reset();
                    document.getElementById('adm-crop-name').disabled = false;
                    loadAdminCrops(); // reload
                } else {
                    window.showToast(data.error || 'Failed to save crop.', 'error');
                }
            } catch (err) {
                window.showToast('Network error saving crop profile.', 'error');
            }
        };
        
    } catch (err) {
        console.error('Error fetching crops lists:', err);
    }
}

// 5. Load Model Settings and stats
async function loadAdminModelInfo() {
    try {
        const response = await fetch('/api/admin/model-stats');
        if (!response.ok) return;
        
        const metrics = await response.json();
        
        // Populate stats
        document.getElementById('adm-model-samples').textContent = metrics.sample_count;
        document.getElementById('adm-model-accuracy').textContent = `${(metrics.accuracy * 100).toFixed(1)}%`;
        
        // Feature importances progress bars
        const listContainer = document.getElementById('feature-importances-container');
        listContainer.innerHTML = '';
        
        // Map feature names to readable labels
        const featureLabels = {
            'N': 'Nitrogen (N)',
            'P': 'Phosphorus (P)',
            'K': 'Potassium (K)',
            'temp': 'Temperature',
            'humidity': 'Humidity',
            'pH': 'Soil pH',
            'rainfall': 'Rainfall'
        };
        
        // Sort features by importance weight
        const sortedFeatures = Object.entries(metrics.feature_importances)
            .sort((a, b) => b[1] - a[1]);
            
        sortedFeatures.forEach(([feature, weight]) => {
            const pct = (weight * 100).toFixed(1);
            const item = document.createElement('div');
            item.className = 'importance-item';
            item.innerHTML = `
                <div class="importance-info">
                    <strong>${featureLabels[feature] || feature}</strong>
                    <span>${pct}% weight</span>
                </div>
                <div class="importance-bar-wrapper">
                    <div class="importance-bar-fill" style="width: ${pct}%;"></div>
                </div>
            `;
            listContainer.appendChild(item);
        });
        
    } catch (err) {
        console.error('Error fetching model stats:', err);
    }
}

// Retrain model click listener
const retrainBtn = document.getElementById('btn-retrain-model');
if (retrainBtn) {
    retrainBtn.addEventListener('click', async () => {
        const logWindow = document.getElementById('retrain-log-output');
        
        retrainBtn.disabled = true;
        retrainBtn.innerHTML = '<i class="fa-solid fa-rotate animate-spin"></i> Processing Retraining Pipeline...';
        logWindow.textContent = 'Contacting server training pipeline...\nReading datasets...\n';
        
        try {
            const response = await fetch('/api/admin/retrain', { method: 'POST' });
            const data = await response.json();
            
            if (response.ok) {
                logWindow.textContent += `Success!\nModel trained on ${data.metrics.sample_count} sample points.\nNew model overall accuracy: ${(data.metrics.accuracy * 100).toFixed(2)}%\nSaved binary: ml/model.pkl.`;
                window.showToast('Model successfully retrained!', 'success');
                // Refresh views
                loadAdminModelInfo();
                loadAdminStats();
            } else {
                logWindow.textContent += `Error:\n${data.error}`;
                window.showToast('Model retraining failed.', 'error');
            }
        } catch (err) {
            logWindow.textContent += `Connection Error:\n${err.message}`;
            window.showToast('Network error during retraining.', 'error');
        } finally {
            retrainBtn.disabled = false;
            retrainBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Trigger Model Retraining';
        }
    });
}

function setupDatasetAdmin() {
    const uploadForm = document.getElementById('form-dataset-upload');
    const addRowForm = document.getElementById('form-dataset-add-row');
    
    if (uploadForm) {
        uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('dataset-file-input');
            if (fileInput.files.length === 0) return;
            
            const submitBtn = document.getElementById('btn-upload-dataset');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Uploading...';
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            try {
                const response = await fetch('/api/admin/dataset/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (response.ok) {
                    window.showToast(data.message, 'success');
                    uploadForm.reset();
                    loadAdminModelInfo();
                    loadAdminStats();
                } else {
                    window.showToast(data.error || 'Failed to upload dataset.', 'error');
                }
            } catch (err) {
                window.showToast('Network error uploading dataset.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload CSV';
            }
        };
    }
    
    if (addRowForm) {
        addRowForm.onsubmit = async (e) => {
            e.preventDefault();
            const payload = {
                N: parseFloat(document.getElementById('ds-n').value),
                P: parseFloat(document.getElementById('ds-p').value),
                K: parseFloat(document.getElementById('ds-k').value),
                temp: parseFloat(document.getElementById('ds-temp').value),
                humidity: parseFloat(document.getElementById('ds-hum').value),
                pH: parseFloat(document.getElementById('ds-ph').value),
                rainfall: parseFloat(document.getElementById('ds-rain').value),
                label: document.getElementById('ds-label').value.trim()
            };
            
            try {
                const response = await fetch('/api/admin/dataset/add-row', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                if (response.ok) {
                    window.showToast(data.message, 'success');
                    addRowForm.reset();
                    loadAdminModelInfo();
                    loadAdminStats();
                } else {
                    window.showToast(data.error || 'Failed to append row.', 'error');
                }
            } catch (err) {
                window.showToast('Network error appending row.', 'error');
            }
        };
    }
}

window.initAdminPanel = initAdminPanel;
