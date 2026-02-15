
// Configuration
const AVAILABLE_WEEKS = ['week1.json', 'week2.json', 'week3.json', 'week4.json', 'week5.json', 'week6.json'];

// State
let weeksData = [];
let goalsData = {}; // Map of athlete_id -> [goal_week1, goal_week2, ...]
let runnerProfiles = {}; // Map of athlete_id -> { name, picture }
let currentWeekId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async function () {
    await Promise.all([loadWeeksData(), loadGoalsData()]);
    initializeEventListeners();
    renderDashboard();
});

// Load all week data files
// Load all week data files
async function loadWeeksData() {
    weeksData = [];

    for (const filename of AVAILABLE_WEEKS) {
        try {
            const response = await fetch("strava/" + filename);
            if (!response.ok) {
                console.warn(`Could not load ${filename}`);
                continue;
            }

            const json = await response.json();
            const weekId = filename.replace('.json', '');
            // Format name: "week4" -> "Week 4"
            const weekName = weekId.replace(/(\D+)(\d+)/, '$1 $2').replace(/^\w/, c => c.toUpperCase());
            // Extract week number for goal lookup (1-based index)
            const weekNum = parseInt(weekId.match(/\d+/)[0]);

            const data = json.data || [];

            // Collect runner profiles
            data.forEach(runner => {
                if (!runnerProfiles[runner.athlete_id]) {
                    runnerProfiles[runner.athlete_id] = {
                        firstname: runner.athlete_firstname,
                        lastname: runner.athlete_lastname,
                        picture: runner.athlete_picture_url
                    };
                } else {
                    // Update picture if it was missing (or just update to latest)
                    if (runner.athlete_picture_url) {
                        runnerProfiles[runner.athlete_id].picture = runner.athlete_picture_url;
                    }
                }
            });

            weeksData.push({
                id: weekId,
                name: weekName,
                weekNum: weekNum,
                data: data
            });
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
        }
    }

    // Set default to latest week
    if (weeksData.length > 0) {
        currentWeekId = weeksData[weeksData.length - 1].id;
    }
}

// Load goals.csv
// Load goals.csv
async function loadGoalsData() {
    try {
        const response = await fetch('goals.csv');
        if (!response.ok) throw new Error('Failed to load goals.csv');

        const text = await response.text();
        const rows = text.split('\n').map(row => row.split(','));

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 4) continue;

            const athleteId = row[2]; // 3rd column is athlete_id
            if (!athleteId) continue;

            const name = row[1]; // Strava Name from CSV

            // If we haven't seen this runner in the JSON files, add them from CSV
            if (!runnerProfiles[athleteId]) {
                const nameParts = name.trim().split(' ');
                runnerProfiles[athleteId] = {
                    firstname: nameParts[0] || name,
                    lastname: nameParts.slice(1).join(' ') || '',
                    picture: null // No picture from CSV
                };
            }

            // Goals start from 4th column (index 3)
            // Store as array where index 0 = Week 1, index 1 = Week 2, etc.
            const goals = row.slice(3).map(val => {
                const num = parseFloat(val);
                return isNaN(num) ? 0 : num;
            });

            goalsData[athleteId] = goals;
        }
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

// Initialize event listeners
function initializeEventListeners() {
    const weekSelect = document.getElementById('dashboardWeekSelect');
    if (weekSelect) {
        weekSelect.addEventListener('change', (e) => {
            currentWeekId = e.target.value;
            renderDashboard();
        });
    }
}

// Main render function
function renderDashboard() {
    renderWeekSelect();
    renderWeekDisplay();
    renderTable();
    renderSummary();
}

// Render the week selector dropdown
function renderWeekSelect() {
    const select = document.getElementById('dashboardWeekSelect');
    if (!select) return;

    select.innerHTML = weeksData.map(week =>
        `<option value="${week.id}" ${week.id === currentWeekId ? 'selected' : ''}>
            ${week.name}
        </option>`
    ).join('');
}

// Update the header display text
function renderWeekDisplay() {
    const display = document.getElementById('weekDisplay');
    if (!display) return;

    const currentWeek = weeksData.find(w => w.id === currentWeekId);
    if (currentWeek) {
        display.textContent = currentWeek.name;
    } else {
        display.textContent = '';
    }
}

// Render the main data table
// Render the main data table
function renderTable() {
    const container = document.getElementById('dashboardTable');
    if (!container) return;

    const currentWeek = weeksData.find(w => w.id === currentWeekId);

    if (!currentWeek) {
        container.innerHTML = '<div class="empty-state">No data available for this week.</div>';
        return;
    }

    // Start with the actual runners from the JSON
    let allRunners = [...currentWeek.data];

    // Add missing runners who have a goal for this week
    const weekIndex = currentWeek.weekNum - 1;
    const existingIds = new Set(allRunners.map(r => r.athlete_id.toString())); // Ensure string comparison

    for (const [athleteId, goals] of Object.entries(goalsData)) {
        // Check if they have a goal > 0 for this week
        const goalKm = goals[weekIndex] || 0;

        if (goalKm > 0 && !existingIds.has(athleteId.toString())) {
            // Get profile info
            const profile = runnerProfiles[athleteId] || { firstname: 'Unknown', lastname: '', picture: null };

            allRunners.push({
                rank: 999, // Temporary rank, will resort
                athlete_id: athleteId,
                athlete_firstname: profile.firstname,
                athlete_lastname: profile.lastname,
                athlete_picture_url: profile.picture,
                distance: 0
            });
        }
    }

    // Sort by distance descending
    allRunners.sort((a, b) => b.distance - a.distance);

    // Re-assign ranks
    allRunners.forEach((runner, index) => {
        runner.rank = index + 1;
    });

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Athlete</th>
                    <th>Goal (km)</th>
                    <th>Distance (km)</th>
                    <th>Missed (km)</th>
                </tr>
            </thead>
            <tbody>
                ${allRunners.map(runner => {
        const distanceKm = (runner.distance / 1000);
        const fullName = `${runner.athlete_firstname} ${runner.athlete_lastname}`;
        const avatarUrl = runner.athlete_picture_url || 'https://via.placeholder.com/40';

        // Get goal for this week
        const athleteGoals = goalsData[runner.athlete_id] || [];
        const goalKm = athleteGoals[weekIndex] || 0;

        const missedKm = Math.max(0, goalKm - distanceKm);
        const isGoalMet = distanceKm >= goalKm;

        // Rank styling
        let rankClass = 'rank';
        if (runner.rank === 1) rankClass += ' rank-1';
        if (runner.rank === 2) rankClass += ' rank-2';
        if (runner.rank === 3) rankClass += ' rank-3';

        // Status styling
        const missedClass = isGoalMet ? 'status-achieved' : 'status-missed';
        const missedText = isGoalMet ? '✓' : missedKm.toFixed(2);

        return `
                        <tr>
                            <td class="${rankClass}">#${runner.rank}</td>
                            <td>
                                <div class="runner-info">
                                    <img src="${avatarUrl}" alt="${fullName}" class="athlete-avatar" onerror="this.src='https://via.placeholder.com/40'">
                                    <span><strong>${fullName}</strong></span>
                                </div>
                            </td>
                            <td>${goalKm > 0 ? goalKm.toFixed(1) : '-'}</td>
                            <td><strong>${distanceKm.toFixed(2)}</strong></td>
                            <td class="${missedClass}">${missedText}</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Render simple summary stats
// Render simple summary stats
function renderSummary() {
    const container = document.getElementById('summary');
    if (!container) return;

    const currentWeek = weeksData.find(w => w.id === currentWeekId);
    if (!currentWeek) {
        container.innerHTML = '';
        return;
    }

    // We need to calculate stats based on the FULL list (including 0km runners)
    // Re-generating the list logic here is duplicative but safest without refactoring renderTable into a data provider
    let allRunners = [...currentWeek.data];
    const weekIndex = currentWeek.weekNum - 1;
    const existingIds = new Set(allRunners.map(r => r.athlete_id.toString()));

    for (const [athleteId, goals] of Object.entries(goalsData)) {
        const goalKm = goals[weekIndex] || 0;
        if (goalKm > 0 && !existingIds.has(athleteId.toString())) {
            allRunners.push({ distance: 0, athlete_id: athleteId });
        }
    }

    const totalDistance = allRunners.reduce((sum, r) => sum + r.distance, 0);
    const totalRunners = allRunners.length;

    // Calculate total goal
    let totalGoal = 0;
    let goalsMet = 0;

    allRunners.forEach(runner => {
        const athleteGoals = goalsData[runner.athlete_id] || [];
        const goalKm = athleteGoals[weekIndex] || 0;
        const distanceKm = runner.distance / 1000;

        totalGoal += goalKm;
        if (distanceKm >= goalKm && goalKm > 0) {
            goalsMet++;
        }
    });

    container.innerHTML = `
        <div class="summary-card">
            <h3>Total Runners</h3>
            <div class="value">${totalRunners}</div>
        </div>
        <div class="summary-card">
            <h3>Total Distance</h3>
            <div class="value">${(totalDistance / 1000).toFixed(1)} km</div>
        </div>
        <div class="summary-card">
            <h3>Total Goal</h3>
            <div class="value">${totalGoal.toFixed(1)} km</div>
        </div>
        <div class="summary-card">
            <h3>Goals Met</h3>
            <div class="value">${goalsMet} / ${totalRunners}</div>
        </div>
    `;
}
