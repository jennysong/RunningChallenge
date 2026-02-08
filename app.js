// Data Structure
let runners = [];
let weeks = [];
let currentWeek = null;
let isAdminMode = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    initializeEventListeners();
    renderDashboard();
});

// Load data from localStorage
function loadData() {
    const savedRunners = localStorage.getItem('runners');
    const savedWeeks = localStorage.getItem('weeks');
    
    if (savedRunners) {
        runners = JSON.parse(savedRunners);
    }
    
    if (savedWeeks) {
        weeks = JSON.parse(savedWeeks);
        if (weeks.length > 0) {
            currentWeek = weeks[weeks.length - 1].id;
        }
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('runners', JSON.stringify(runners));
    localStorage.setItem('weeks', JSON.stringify(weeks));
}

// Initialize event listeners
function initializeEventListeners() {
    document.getElementById('adminToggle').addEventListener('click', toggleAdminMode);
    document.getElementById('addRunner').addEventListener('click', addRunner);
    document.getElementById('addWeek').addEventListener('click', addWeek);
    document.getElementById('weekSelect').addEventListener('change', onWeekSelectChange);
    document.getElementById('dashboardWeekSelect').addEventListener('change', onDashboardWeekChange);
    
    // Enter key support for runner name input
    document.getElementById('runnerName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addRunner();
        }
    });
}

// Toggle between admin and dashboard view
function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    const adminPanel = document.getElementById('adminPanel');
    const dashboardView = document.getElementById('dashboardView');
    const toggleBtn = document.getElementById('adminToggle');
    
    if (isAdminMode) {
        adminPanel.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        toggleBtn.textContent = 'Dashboard View';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
        renderAdminPanel();
    } else {
        adminPanel.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        toggleBtn.textContent = 'Admin Mode';
        toggleBtn.classList.remove('btn-secondary');
        toggleBtn.classList.add('btn-primary');
        renderDashboard();
    }
}

// Add a new runner
function addRunner() {
    const nameInput = document.getElementById('runnerName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a runner name');
        return;
    }
    
    // Check for duplicate names
    if (runners.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        alert('A runner with this name already exists');
        return;
    }
    
    const runner = {
        id: Date.now().toString(),
        name: name
    };
    
    runners.push(runner);
    saveData();
    nameInput.value = '';
    renderRunnersList();
    renderWeeklyData();
}

// Remove a runner
function removeRunner(runnerId) {
    if (!confirm('Are you sure you want to remove this runner?')) {
        return;
    }
    
    runners = runners.filter(r => r.id !== runnerId);
    
    // Remove runner from all weeks
    weeks.forEach(week => {
        delete week.data[runnerId];
    });
    
    saveData();
    renderRunnersList();
    renderWeeklyData();
}

// Add a new week
function addWeek() {
    const weekName = prompt('Enter week name (e.g., Week 1, Jan 1-7):', `Week ${weeks.length + 1}`);
    
    if (!weekName) {
        return;
    }
    
    const week = {
        id: Date.now().toString(),
        name: weekName,
        data: {}
    };
    
    // Initialize data for all runners
    runners.forEach(runner => {
        week.data[runner.id] = {
            goal: 0,
            achieved: 0
        };
    });
    
    weeks.push(week);
    currentWeek = week.id;
    saveData();
    renderWeekSelects();
    renderWeeklyData();
}

// Render runners list in admin panel
function renderRunnersList() {
    const container = document.getElementById('runnersList');
    
    if (runners.length === 0) {
        container.innerHTML = '<p style="color: #999;">No runners added yet. Add your first runner above.</p>';
        return;
    }
    
    container.innerHTML = runners.map(runner => `
        <div class="runner-item">
            <span>${runner.name}</span>
            <button class="btn btn-danger" onclick="removeRunner('${runner.id}')">Remove</button>
        </div>
    `).join('');
}

// Render week select dropdowns
function renderWeekSelects() {
    const adminSelect = document.getElementById('weekSelect');
    const dashboardSelect = document.getElementById('dashboardWeekSelect');
    
    const options = weeks.map(week => 
        `<option value="${week.id}" ${week.id === currentWeek ? 'selected' : ''}>${week.name}</option>`
    ).join('');
    
    adminSelect.innerHTML = options || '<option>No weeks available</option>';
    dashboardSelect.innerHTML = options || '<option>No weeks available</option>';
}

// Handle week selection change in admin
function onWeekSelectChange(e) {
    currentWeek = e.target.value;
    renderWeeklyData();
}

// Handle week selection change in dashboard
function onDashboardWeekChange(e) {
    currentWeek = e.target.value;
    renderDashboard();
}

// Render weekly data table in admin panel
function renderWeeklyData() {
    const container = document.getElementById('weeklyData');
    
    if (weeks.length === 0) {
        container.innerHTML = '<p style="color: #999;">No weeks added yet. Click "Add New Week" to create one.</p>';
        return;
    }
    
    if (runners.length === 0) {
        container.innerHTML = '<p style="color: #999;">No runners added yet. Add runners first to enter weekly data.</p>';
        return;
    }
    
    const week = weeks.find(w => w.id === currentWeek);
    if (!week) {
        return;
    }
    
    // Ensure all current runners have data entries
    runners.forEach(runner => {
        if (!week.data[runner.id]) {
            week.data[runner.id] = { goal: 0, achieved: 0 };
        }
    });
    
    container.innerHTML = `
        <table class="weekly-table">
            <thead>
                <tr>
                    <th>Runner</th>
                    <th>Goal (km)</th>
                    <th>Achieved (km)</th>
                    <th>Missed (km)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${runners.map(runner => {
                    const data = week.data[runner.id] || { goal: 0, achieved: 0 };
                    const missed = Math.max(0, data.goal - data.achieved);
                    const status = data.achieved >= data.goal ? '✓ Goal Met' : '✗ Goal Missed';
                    const statusClass = data.achieved >= data.goal ? 'achieved' : 'missed';
                    
                    return `
                        <tr>
                            <td><strong>${runner.name}</strong></td>
                            <td>
                                <input type="number" 
                                       min="0" 
                                       step="0.1" 
                                       value="${data.goal}" 
                                       onchange="updateGoal('${runner.id}', this.value)" />
                            </td>
                            <td>
                                <input type="number" 
                                       min="0" 
                                       step="0.1" 
                                       value="${data.achieved}" 
                                       onchange="updateAchieved('${runner.id}', this.value)" />
                            </td>
                            <td class="missed">${missed.toFixed(1)}</td>
                            <td class="${statusClass}">${status}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Update goal for a runner
function updateGoal(runnerId, value) {
    const week = weeks.find(w => w.id === currentWeek);
    if (week) {
        if (!week.data[runnerId]) {
            week.data[runnerId] = { goal: 0, achieved: 0 };
        }
        week.data[runnerId].goal = parseFloat(value) || 0;
        saveData();
        renderWeeklyData();
    }
}

// Update achieved distance for a runner
function updateAchieved(runnerId, value) {
    const week = weeks.find(w => w.id === currentWeek);
    if (week) {
        if (!week.data[runnerId]) {
            week.data[runnerId] = { goal: 0, achieved: 0 };
        }
        week.data[runnerId].achieved = parseFloat(value) || 0;
        saveData();
        renderWeeklyData();
    }
}

// Render dashboard view
function renderDashboard() {
    updateWeekDisplay();
    renderWeekSelects();
    renderDashboardTable();
    renderSummary();
}

// Update week display in header
function updateWeekDisplay() {
    const display = document.getElementById('weekDisplay');
    if (weeks.length > 0 && currentWeek) {
        const week = weeks.find(w => w.id === currentWeek);
        display.textContent = week ? week.name : '';
    } else {
        display.textContent = 'No data available';
    }
}

// Render dashboard table
function renderDashboardTable() {
    const container = document.getElementById('dashboardTable');
    
    if (weeks.length === 0 || runners.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Data Available</h3>
                <p>Switch to Admin Mode to add runners and weekly data.</p>
            </div>
        `;
        return;
    }
    
    const week = weeks.find(w => w.id === currentWeek);
    if (!week) {
        return;
    }
    
    // Calculate rankings
    const runnerStats = runners.map(runner => {
        const data = week.data[runner.id] || { goal: 0, achieved: 0 };
        const missed = Math.max(0, data.goal - data.achieved);
        const percentage = data.goal > 0 ? (data.achieved / data.goal * 100) : 0;
        
        return {
            ...runner,
            goal: data.goal,
            achieved: data.achieved,
            missed: missed,
            percentage: percentage
        };
    }).sort((a, b) => b.achieved - a.achieved);
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Runner</th>
                    <th>Goal (km)</th>
                    <th>Achieved (km)</th>
                    <th>Missed (km)</th>
                    <th>% Complete</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${runnerStats.map((runner, index) => {
                    const status = runner.achieved >= runner.goal ? '✓ Goal Met' : '✗ Missed';
                    const statusClass = runner.achieved >= runner.goal ? 'status-achieved' : 'status-missed';
                    
                    return `
                        <tr>
                            <td class="rank">#${index + 1}</td>
                            <td><strong>${runner.name}</strong></td>
                            <td>${runner.goal.toFixed(1)}</td>
                            <td>${runner.achieved.toFixed(1)}</td>
                            <td>${runner.missed.toFixed(1)}</td>
                            <td>${runner.percentage.toFixed(0)}%</td>
                            <td class="${statusClass}">${status}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Render summary statistics
function renderSummary() {
    const container = document.getElementById('summary');
    
    if (weeks.length === 0 || runners.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const week = weeks.find(w => w.id === currentWeek);
    if (!week) {
        return;
    }
    
    let totalGoal = 0;
    let totalAchieved = 0;
    let goalsMet = 0;
    
    runners.forEach(runner => {
        const data = week.data[runner.id] || { goal: 0, achieved: 0 };
        totalGoal += data.goal;
        totalAchieved += data.achieved;
        if (data.achieved >= data.goal) {
            goalsMet++;
        }
    });
    
    const totalMissed = Math.max(0, totalGoal - totalAchieved);
    const avgPercentage = totalGoal > 0 ? (totalAchieved / totalGoal * 100) : 0;
    
    container.innerHTML = `
        <div class="summary-card">
            <h3>Total Runners</h3>
            <div class="value">${runners.length}</div>
        </div>
        <div class="summary-card">
            <h3>Total Goal</h3>
            <div class="value">${totalGoal.toFixed(1)} km</div>
        </div>
        <div class="summary-card">
            <h3>Total Achieved</h3>
            <div class="value">${totalAchieved.toFixed(1)} km</div>
        </div>
        <div class="summary-card">
            <h3>Total Missed</h3>
            <div class="value">${totalMissed.toFixed(1)} km</div>
        </div>
        <div class="summary-card">
            <h3>Goals Met</h3>
            <div class="value">${goalsMet} / ${runners.length}</div>
        </div>
        <div class="summary-card">
            <h3>Overall Progress</h3>
            <div class="value">${avgPercentage.toFixed(0)}%</div>
        </div>
    `;
}

// Render admin panel
function renderAdminPanel() {
    renderRunnersList();
    renderWeekSelects();
    renderWeeklyData();
}
