/**
 * Rideau Canal Dashboard - Frontend JavaScript
 * Handles data fetching, UI updates, and chart rendering
 */

const API_BASE = '/api';
const REFRESH_INTERVAL = 30000; // 30 seconds

// Chart instances
let iceThicknessChart = null;
let temperatureChart = null;

// Location display names
const locationNames = {
    'dows-lake': "Dow's Lake",
    'fifth-avenue': 'Fifth Avenue',
    'nac': 'NAC',
};

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * Get safety badge class
 */
function getSafetyBadgeClass(status) {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'safe') return 'safe';
    if (statusLower === 'caution') return 'caution';
    return 'unsafe';
}

/**
 * Fetch latest data from API
 */
async function fetchData() {
    try {
        const response = await fetch(`${API_BASE}/data?t=${Date.now()}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to fetch data. Please check your connection.');
        return null;
    }
}

/**
 * Fetch system status
 */
async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/status?t=${Date.now()}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const status = await response.json();
        return status;
    } catch (error) {
        console.error('Error fetching status:', error);
        return null;
    }
}

/**
 * Fetch historical data for charts
 */
async function fetchHistoricalData(location) {
    try {
        const response = await fetch(`${API_BASE}/history/${location}?hours=1&t=${Date.now()}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching historical data for ${location}:`, error);
        return [];
    }
}

/**
 * Update system status display
 */
function updateSystemStatus(status) {
    if (!status) return;

    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.textContent = status.systemStatus || 'Unknown';
        statusBadge.className = `status-badge ${(status.systemStatus || 'unknown').toLowerCase()}`;
    }

    // Update stats
    const totalLocationsEl = document.getElementById('totalLocations');
    const safeLocationsEl = document.getElementById('safeLocations');
    const cautionLocationsEl = document.getElementById('cautionLocations');
    const unsafeLocationsEl = document.getElementById('unsafeLocations');
    
    if (totalLocationsEl) totalLocationsEl.textContent = status.totalLocations || 0;
    if (safeLocationsEl) safeLocationsEl.textContent = status.safeLocations || 0;
    if (cautionLocationsEl) cautionLocationsEl.textContent = status.cautionLocations || 0;
    if (unsafeLocationsEl) unsafeLocationsEl.textContent = status.unsafeLocations || 0;

    // Update last update time
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate && status.lastUpdate) {
        lastUpdate.textContent = `Last update: ${formatTimestamp(status.lastUpdate)}`;
    }
}

/**
 * Create or update location card
 */
function updateLocationCard(locationId, data) {
    const grid = document.getElementById('locationsGrid');
    if (!grid) return;
    
    let card = document.getElementById(`card-${locationId}`);

    if (!card) {
        // Create new card
        card = document.createElement('div');
        card.className = 'location-card';
        card.id = `card-${locationId}`;
        grid.appendChild(card);
    }

    if (!data) {
        card.innerHTML = `
            <div class="loading">No data available for ${locationNames[locationId] || locationId}</div>
        `;
        return;
    }

    const safetyClass = getSafetyBadgeClass(data.safetyStatus);

    card.innerHTML = `
        <div class="location-header">
            <div class="location-name">${locationNames[locationId] || locationId}</div>
            <div class="safety-badge ${safetyClass}">${data.safetyStatus || 'Unknown'}</div>
        </div>
        <div class="location-data">
            <div class="data-item">
                <div class="data-label">Ice Thickness</div>
                <div class="data-value ice">${data.avgIceThickness?.toFixed(1) || 'N/A'} cm</div>
            </div>
            <div class="data-item">
                <div class="data-label">Surface Temp</div>
                <div class="data-value temp">${data.avgSurfaceTemperature?.toFixed(1) || 'N/A'} °C</div>
            </div>
            <div class="data-item">
                <div class="data-label">Snow Accumulation</div>
                <div class="data-value snow">${data.maxSnowAccumulation?.toFixed(1) || 'N/A'} cm</div>
            </div>
            <div class="data-item">
                <div class="data-label">External Temp</div>
                <div class="data-value temp">${data.avgExternalTemperature?.toFixed(1) || 'N/A'} °C</div>
            </div>
        </div>
        <div class="location-timestamp">
            Updated: ${formatTimestamp(data.timestamp)}
        </div>
    `;
}

/**
 * Update all location cards
 */
function updateDashboard(data) {
    const locations = ['dows-lake', 'fifth-avenue', 'nac'];

    locations.forEach((locationId) => {
        const locationData = data[locationId];
        updateLocationCard(locationId, locationData);
    });

    // Update footer
    const footerUpdate = document.getElementById('footerUpdate');
    if (footerUpdate) {
        footerUpdate.textContent = formatTimestamp(new Date());
    }
}

/**
 * Initialize or update charts
 */
async function updateCharts() {
    const locations = ['dows-lake', 'fifth-avenue', 'nac'];
    const colors = ['#3b82f6', '#10b981', '#f59e0b'];

    // Fetch historical data for all locations
    const allHistoricalData = {};
    for (const location of locations) {
        allHistoricalData[location] = await fetchHistoricalData(location);
    }

    // Prepare ice thickness chart data
    const iceThicknessCtx = document.getElementById('iceThicknessChart');
    if (iceThicknessCtx) {
        const iceDatasets = locations.map((location, index) => {
            const data = allHistoricalData[location] || [];
            // Filter out null/undefined values and ensure valid data
            const validData = data
                .filter((item) => item && item.timestamp && item.avgIceThickness != null)
                .map((item) => ({
                    x: new Date(item.timestamp),
                    y: item.avgIceThickness,
                }));
            return {
                label: locationNames[location],
                data: validData,
                borderColor: colors[index],
                backgroundColor: colors[index] + '20',
                tension: 0.4,
            };
        });

        if (iceThicknessChart) {
            iceThicknessChart.data.datasets = iceDatasets;
            iceThicknessChart.update('none');
        } else {
            iceThicknessChart = new Chart(iceThicknessCtx, {
                type: 'line',
                data: { datasets: iceDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                            },
                            title: {
                                display: true,
                                text: 'Time',
                            },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Ice Thickness (cm)',
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                        },
                    },
                },
            });
        }
    }

    // Prepare temperature chart data
    const temperatureCtx = document.getElementById('temperatureChart');
    if (temperatureCtx) {
        const tempDatasets = locations.map((location, index) => {
            const data = allHistoricalData[location] || [];
            // Filter out null/undefined values and ensure valid data
            const validData = data
                .filter((item) => item && item.timestamp && item.avgSurfaceTemperature != null)
                .map((item) => ({
                    x: new Date(item.timestamp),
                    y: item.avgSurfaceTemperature,
                }));
            return {
                label: locationNames[location],
                data: validData,
                borderColor: colors[index],
                backgroundColor: colors[index] + '20',
                tension: 0.4,
            };
        });

        if (temperatureChart) {
            temperatureChart.data.datasets = tempDatasets;
            temperatureChart.update('none');
        } else {
            temperatureChart = new Chart(temperatureCtx, {
                type: 'line',
                data: { datasets: tempDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                            },
                            title: {
                                display: true,
                                text: 'Time',
                            },
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Temperature (°C)',
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                        },
                    },
                },
            });
        }
    }
}

/**
 * Show error message
 */
function showError(message) {
    const grid = document.getElementById('locationsGrid');
    if (!grid) {
        console.error('Dashboard error:', message);
        return;
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    grid.insertBefore(errorDiv, grid.firstChild);

    // Remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Main update function
 */
async function updateDashboardData() {
    console.log('Updating dashboard...');

    // Fetch data and status in parallel
    const [data, status] = await Promise.all([fetchData(), fetchStatus()]);

    if (data) {
        updateDashboard(data);
    }

    if (status) {
        updateSystemStatus(status);
    }

    // Update charts
    await updateCharts();
}

/**
 * Initialize dashboard
 */
async function init() {
    console.log('Initializing dashboard...');

    // Initial data load
    await updateDashboardData();

    // Set up auto-refresh
    setInterval(updateDashboardData, REFRESH_INTERVAL);

    console.log(`Dashboard initialized. Auto-refresh every ${REFRESH_INTERVAL / 1000} seconds.`);
}

// Start dashboard when page loads
document.addEventListener('DOMContentLoaded', init);

