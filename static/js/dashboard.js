// AgriPulse AI - Farmer Dashboard, Geolocation Sync, and Recommendation Form Actions Manager

// 1. Load summary stats for widgets and charts
async function loadDashboardSummary() {
    try {
        const response = await fetch('/api/dashboard/summary');
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Populate widgets
        document.getElementById('dash-total-predictions').textContent = data.total_predictions;
        document.getElementById('dash-top-crop').textContent = data.top_recommended_crop;
        
        const latestSoil = data.latest_soil;
        const latestWeather = data.latest_weather;
        
        document.getElementById('dash-latest-ph').textContent = latestSoil ? latestSoil.pH : 'N/A';
        document.getElementById('dash-latest-rain').textContent = latestWeather ? `${Math.round(latestWeather.rainfall)} mm` : 'N/A';
        
        // Render Charts
        renderNutrientChart(latestSoil);
        renderCropShareChart(data.crop_distribution);
        
    } catch (err) {
        console.error('Error fetching dashboard summary:', err);
    }
}

// 2. Render Soil Nutrients Bar Chart (Chart.js)
function renderNutrientChart(soil) {
    const ctx = document.getElementById('chart-soil-nutrients').getContext('2d');
    
    // Default values if no records exist
    const N = soil ? soil.N : 0;
    const P = soil ? soil.P : 0;
    const K = soil ? soil.K : 0;
    const moisture = soil ? soil.moisture : 0;
    
    if (window.appState.charts.nutrients) {
        window.appState.charts.nutrients.destroy();
    }
    
    window.appState.charts.nutrients = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Moisture (%)'],
            datasets: [{
                label: 'Measured Levels',
                data: [N, P, K, moisture],
                backgroundColor: [
                    'rgba(52, 211, 153, 0.65)',  // Emerald Green
                    'rgba(245, 158, 11, 0.65)',  // Gold Yellow
                    'rgba(14, 165, 233, 0.65)',  // Info Blue
                    'rgba(249, 115, 22, 0.65)'   // Orange
                ],
                borderColor: [
                    'rgb(52, 211, 153)',
                    'rgb(245, 158, 11)',
                    'rgb(14, 165, 233)',
                    'rgb(249, 115, 22)'
                ],
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8b9bb4' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b9bb4' }
                }
            }
        }
    });
}

// 3. Render Crop share distribution (Doughnut Chart)
function renderCropShareChart(distribution) {
    const ctx = document.getElementById('chart-crop-share').getContext('2d');
    
    const labels = Object.keys(distribution || {});
    const data = Object.values(distribution || {});
    
    if (window.appState.charts.cropShare) {
        window.appState.charts.cropShare.destroy();
    }
    
    if (labels.length === 0) {
        labels.push('No Data');
        data.push(1);
    }
    
    window.appState.charts.cropShare = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(52, 211, 153, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(14, 165, 233, 0.7)',
                    'rgba(139, 92, 246, 0.7)',
                    'rgba(244, 63, 94, 0.7)',
                    'rgba(6, 182, 212, 0.7)',
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#8b9bb4', boxWidth: 12, font: { family: 'Plus Jakarta Sans' } }
                },
                tooltip: {
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            cutout: '65%'
        }
    });
}

// 4. Load History Logs into Table
async function loadHistoryTable() {
    try {
        const response = await fetch('/api/dashboard/history');
        if (!response.ok) return;
        
        const recs = await response.json();
        const tbody = document.getElementById('history-rows');
        tbody.innerHTML = '';
        
        if (recs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">No prediction records found. Get a crop recommendation to start.</td>
                </tr>`;
            return;
        }
        
        recs.forEach(r => {
            const dateStr = new Date(r.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const tr = document.createElement('tr');
            
            // Format metrics details
            const soil = r.soil_record;
            const weather = r.weather_record;
            
            const soilInfo = `<strong>N:</strong>${soil.N} <strong>P:</strong>${soil.P} <strong>K:</strong>${soil.K}<br><span class="text-muted">pH: ${soil.pH} | ${soil.soil_type}</span>`;
            const weatherInfo = `${Math.round(weather.temperature)}°C | ${Math.round(weather.humidity)}% hum<br><span class="text-muted">${Math.round(weather.rainfall)}mm rain</span>`;
            
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${soilInfo}</td>
                <td>${weatherInfo}</td>
                <td><span class="badge-crop">${r.recommended_crop}</span></td>
                <td><strong>${r.fertilizer_name}</strong><br><span class="text-muted font-sm">${r.fertilizer_qty}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm btn-view-report" data-rec-id="${r.id}"><i class="fa-solid fa-file-invoice"></i> View Report</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Attach click listeners to view reports
        tbody.querySelectorAll('.btn-view-report').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recId = parseInt(btn.dataset.recId);
                const recObj = recs.find(item => item.id === recId);
                if (recObj) {
                    displayRecommendationResult(recObj);
                }
            });
        });
        
    } catch (err) {
        console.error('Error loading history:', err);
    }
}

// 5. Geolocation Live Weather Sync using Open-Meteo
document.getElementById('btn-fetch-weather').addEventListener('click', () => {
    const syncStatus = document.getElementById('weather-sync-status');
    const syncBtn = document.getElementById('btn-fetch-weather');
    
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Syncing Node...';
    
    if (!navigator.geolocation) {
        window.showToast('Geolocation is not supported by your browser.', 'error');
        resetSyncBtn();
        return;
    }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        try {
            // Hit open-meteo API (Free nodes, no auth keys) with daily forecast parameters
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
            if (response.ok) {
                const data = await response.json();
                const curr = data.current;
                
                // Populate form inputs
                document.getElementById('weather-temp').value = Math.round(curr.temperature_2m * 10) / 10;
                document.getElementById('weather-humidity').value = Math.round(curr.relative_humidity_2m);
                
                // Estimate seasonal rainfall based on humidity and precipitation
                let estimatedRainfall = 80;
                if (curr.rain > 0) {
                    estimatedRainfall = 180 + (curr.rain * 40);
                } else if (curr.relative_humidity_2m > 80) {
                    estimatedRainfall = 130;
                } else if (curr.relative_humidity_2m < 40) {
                    estimatedRainfall = 35;
                }
                document.getElementById('weather-rainfall').value = Math.round(estimatedRainfall);
                
                // Show status and render forecast cards
                syncStatus.classList.remove('hidden');
                renderWeatherForecast(data.daily);
                window.showToast('Live weather & 3-day forecast synced successfully!', 'success');
            } else {
                window.showToast('Failed to contact weather api nodes.', 'error');
            }
        } catch (err) {
            console.error(err);
            window.showToast('Network error syncing weather.', 'error');
        } finally {
            resetSyncBtn();
        }
        
    }, (err) => {
        console.error(err);
        window.showToast('Geolocation access denied. Syncing with default agricultural region (South Asia coordinates)...', 'info');
        // Fallback default coordinates
        fetchDefaultWeather(12.9716, 77.5946);
    });
    
    async function fetchDefaultWeather(lat, lon) {
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('weather-temp').value = Math.round(data.current.temperature_2m * 10) / 10;
                document.getElementById('weather-humidity').value = Math.round(data.current.relative_humidity_2m);
                document.getElementById('weather-rainfall').value = data.current.relative_humidity_2m > 70 ? 150 : 65;
                syncStatus.classList.remove('hidden');
                renderWeatherForecast(data.daily);
            }
        } catch (e) {
            console.error(e);
        } finally {
            resetSyncBtn();
        }
    }
    
    function resetSyncBtn() {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Sync Live Weather';
    }
});

// Sync pH slider visual tag
const phSlider = document.getElementById('soil-ph');
if (phSlider) {
    phSlider.addEventListener('input', (e) => {
        document.getElementById('ph-val-display').textContent = `(${e.target.value})`;
    });
}

// 6. Recommendation Form submit handler
const predictForm = document.getElementById('form-predict');
if (predictForm) {
    predictForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('btn-predict-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'AI Computing Model... <i class="fa-solid fa-spinner animate-spin"></i>';
        
        const payload = {
            soil_type: document.getElementById('soil-type').value,
            pH: parseFloat(document.getElementById('soil-ph').value),
            N: parseFloat(document.getElementById('soil-n').value),
            P: parseFloat(document.getElementById('soil-p').value),
            K: parseFloat(document.getElementById('soil-k').value),
            moisture: parseFloat(document.getElementById('soil-moisture').value),
            temperature: parseFloat(document.getElementById('weather-temp').value),
            humidity: parseFloat(document.getElementById('weather-humidity').value),
            rainfall: parseFloat(document.getElementById('weather-rainfall').value)
        };
        
        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            if (response.ok) {
                window.showToast('Crop matched successfully!', 'success');
                displayRecommendationResult({
                    created_at: new Date().toISOString(),
                    recommended_crop: data.crop,
                    fertilizer_name: data.fertilizer.name,
                    fertilizer_qty: data.fertilizer.quantity,
                    fertilizer_schedule: data.fertilizer.schedule,
                    crop_details: data.crop_details,
                    soil_record: payload,
                    weather_record: payload
                });
                predictForm.reset();
                document.getElementById('ph-val-display').textContent = '(6.5)';
                document.getElementById('weather-sync-status').classList.add('hidden');
            } else {
                window.showToast(data.error || 'Prediction calculation failed.', 'error');
            }
        } catch (err) {
            console.error(err);
            window.showToast('Network error during prediction.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Analyze & Predict Crop <i class="fa-solid fa-microchip"></i>';
        }
    });
}

// 7. Render recommendation results report
function displayRecommendationResult(rec) {
    const resultCard = document.getElementById('predict-result');
    resultCard.classList.remove('hidden');
    
    // Scroll to results
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Metadata
    const date = new Date(rec.created_at).toLocaleString();
    document.getElementById('report-timestamp').textContent = date;
    
    const user = window.appState.currentUser;
    document.getElementById('report-farmer-name').textContent = user ? (user.full_name || user.username) : 'Farmer';
    document.getElementById('report-farmer-location').textContent = user ? (user.location || 'Headquarters') : 'N/A';
    
    // Hero
    document.getElementById('result-crop-name').textContent = rec.recommended_crop;
    
    const confidence = rec.confidence ? `${Math.round(rec.confidence * 100)}%` : '95%';
    document.getElementById('result-confidence').textContent = confidence;
    document.getElementById('result-confidence-bar').style.width = confidence;
    
    // Soil & weather inputs
    const soil = rec.soil_record;
    const weather = rec.weather_record;
    document.getElementById('rep-soil-type').textContent = soil.soil_type;
    document.getElementById('rep-soil-ph').textContent = soil.pH;
    document.getElementById('rep-soil-npk').textContent = `${soil.N} - ${soil.P} - ${soil.K}`;
    document.getElementById('rep-soil-moist').textContent = `${soil.moisture}%`;
    document.getElementById('rep-temp').textContent = `${Math.round(weather.temperature)}°C`;
    document.getElementById('rep-humidity').textContent = `${Math.round(weather.humidity)}%`;
    document.getElementById('rep-rain').textContent = `${Math.round(weather.rainfall)} mm`;
    
    // Fertilizer
    document.getElementById('result-fert-name').textContent = rec.fertilizer_name;
    document.getElementById('result-fert-qty').textContent = rec.fertilizer_qty;
    document.getElementById('result-fert-schedule').textContent = rec.fertilizer_schedule;
    
    // Crop details
    const crop = rec.crop_details || {};
    document.getElementById('result-season').textContent = crop.growing_season || 'N/A';
    document.getElementById('result-water').textContent = crop.water_requirement || 'N/A';
    document.getElementById('result-yield').textContent = crop.expected_yield || 'N/A';
    document.getElementById('result-duration').textContent = crop.harvest_duration || 'N/A';
    document.getElementById('result-crop-desc').textContent = crop.description || 'N/A';
}

// Result Card actions
document.getElementById('btn-close-report').addEventListener('click', () => {
    document.getElementById('predict-result').classList.add('hidden');
});

document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
});

// Dashboard refresh trigger
document.getElementById('btn-refresh-history').addEventListener('click', () => {
    loadDashboardSummary();
    loadHistoryTable();
    window.showToast('History list updated.', 'success');
});

// 8. Crop Guide search and listing
async function loadCropsGuide() {
    try {
        const response = await fetch('/api/crops');
        if (!response.ok) return;
        
        const crops = await response.json();
        const grid = document.getElementById('crops-grid');
        grid.innerHTML = '';
        
        const renderCrops = (list) => {
            grid.innerHTML = '';
            if (list.length === 0) {
                grid.innerHTML = '<div class="table-empty" style="grid-column: 1/-1;">No crops matching search query.</div>';
                return;
            }
            list.forEach(c => {
                const card = document.createElement('div');
                card.className = 'crop-card glass';
                card.innerHTML = `
                    <div class="crop-card-header">
                        <h2>${c.name}</h2>
                        <span class="crop-badge">${c.growing_season}</span>
                    </div>
                    <p class="crop-desc">${c.description}</p>
                    <div class="crop-info-grid">
                        <div class="info-item">
                            <span class="info-label">Water Requirement</span>
                            <span class="info-val">${c.water_requirement}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Harvest Duration</span>
                            <span class="info-val">${c.harvest_duration}</span>
                        </div>
                        <div class="info-item" style="grid-column: span 2; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color);">
                            <span class="info-label">Expected Yield</span>
                            <span class="info-val" style="color: var(--color-accent);">${c.expected_yield}</span>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        };
        
        renderCrops(crops);
        
        // Search filter input
        const searchInput = document.getElementById('crop-search');
        // Remove existing listener to avoid stacking
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        
        newSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = crops.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.growing_season.toLowerCase().includes(query) || 
                c.description.toLowerCase().includes(query)
            );
            renderCrops(filtered);
        });
        
    } catch (err) {
        console.error('Error loading crop guides:', err);
    }
}

function getWeatherDesc(code) {
    if (code === 0) return { desc: 'Clear sky', icon: 'fa-sun text-yellow' };
    if ([1, 2, 3].includes(code)) return { desc: 'Partly cloudy', icon: 'fa-cloud-sun text-blue' };
    if ([45, 48].includes(code)) return { desc: 'Foggy', icon: 'fa-smog text-muted' };
    if ([51, 53, 55].includes(code)) return { desc: 'Drizzle', icon: 'fa-cloud-rain text-info' };
    if ([61, 63, 65, 80, 81, 82].includes(code)) return { desc: 'Rain showers', icon: 'fa-cloud-showers-heavy text-info' };
    if ([71, 73, 75, 85, 86].includes(code)) return { desc: 'Snowfall', icon: 'fa-snowflake text-info' };
    if ([95, 96, 99].includes(code)) return { desc: 'Thunderstorm', icon: 'fa-cloud-bolt text-danger' };
    return { desc: 'Overcast', icon: 'fa-cloud text-muted' };
}

function renderWeatherForecast(daily) {
    const container = document.getElementById('weather-forecast-container');
    const cardsContainer = document.getElementById('forecast-cards');
    if (!container || !cardsContainer || !daily) return;
    
    cardsContainer.innerHTML = '';
    
    for (let i = 0; i < 3; i++) {
        const time = daily.time[i];
        const dateObj = new Date(time);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        const code = daily.weather_code[i];
        const weather = getWeatherDesc(code);
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);
        
        const card = document.createElement('div');
        card.className = 'forecast-card glass';
        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon"><i class="fa-solid ${weather.icon}"></i></div>
            <div class="forecast-temp">${tempMax}°C / ${tempMin}°C</div>
            <div class="forecast-desc">${weather.desc}</div>
        `;
        cardsContainer.appendChild(card);
    }
    
    container.classList.remove('hidden');
}

window.loadDashboardSummary = loadDashboardSummary;
window.loadHistoryTable = loadHistoryTable;
window.loadCropsGuide = loadCropsGuide;
window.displayRecommendationResult = displayRecommendationResult;
window.renderWeatherForecast = renderWeatherForecast;
