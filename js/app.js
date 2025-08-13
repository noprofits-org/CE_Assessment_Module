// Main application controller
class App {
    constructor() {
        this.currentSection = 'home';
        this.scenarioManager = null;
        this.initializeApp();
    }

    initializeApp() {
        // Start study session
        storage.startStudySession();
        
        // Initialize navigation
        this.setupNavigation();
        
        // Initialize dashboard
        this.updateDashboard();
        
        // Initialize managers
        this.initializeManagers();
        
        // Setup periodic updates
        this.startPeriodicUpdates();
        
        // Add beforeunload event to save study time
        window.addEventListener('beforeunload', () => {
            storage.endStudySession();
        });
    }

    setupNavigation() {
        // Handle navigation clicks
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.section) {
                this.showSection(e.state.section);
            } else {
                // If no state, try to parse from URL hash
                const hash = window.location.hash.slice(1) || 'home';
                this.showSection(hash);
            }
        });
        
        // Set initial state
        const hash = window.location.hash.slice(1) || 'home';
        // Use showSection directly for initial load to avoid duplicate history entry
        this.showSection(hash);
        // Replace the current state to ensure proper back button behavior
        history.replaceState({ section: hash }, '', `#${hash}`);
    }

    navigateToSection(section) {
        this.showSection(section);
        history.pushState({ section }, '', `#${section}`);
    }

    showSection(section) {
        // Cleanup previous section
        this.cleanupPreviousSection();
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(s => {
            s.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = section;
            
            // Update navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-section') === section) {
                    link.classList.add('active');
                }
            });
            
            // Initialize section-specific content
            this.initializeSectionContent(section);
        }
    }
    
    cleanupPreviousSection() {
        // Cleanup based on current section
        switch(this.currentSection) {
            case 'tests':
                // Stop test timer if running
                if (window.testManager && typeof testManager.cleanup === 'function') {
                    testManager.cleanup();
                }
                break;
            // Add other section cleanups as needed
        }
    }

    initializeSectionContent(section) {
        switch(section) {
            case 'flashcards':
                // Check if flashcard manager exists, initialize if not
                // This handles direct navigation to #flashcards
                if (!window.flashcardManager && section === 'flashcards') {
                    // Check if FlashcardManager class is available
                    if (typeof FlashcardManager !== 'undefined') {
                        window.flashcardManager = new FlashcardManager();
                    }
                }
                break;
            case 'tests':
                if (!window.testManager) {
                    window.testManager = new TestManager();
                }
                // Show test selection when navigating to tests section
                window.testManager.showTestSelection();
                break;
            case 'scenarios':
                // Scenarios are handled by scenarioManager in scenarios.js
                // Initialize if needed (for direct navigation)
                if (window.scenarioManager && typeof scenarioManager.initialize === 'function') {
                    scenarioManager.initialize();
                }
                break;
            case 'progress':
                this.updateProgressSection();
                break;
        }
    }

    initializeManagers() {
        // Managers will be initialized when their sections are first accessed
    }

    updateDashboard() {
        const stats = storage.getStatistics();
        
        // Update stat cards
        document.getElementById('study-streak').textContent = stats.studyStreak;
        document.getElementById('cards-reviewed').textContent = stats.cardsReviewed;
        document.getElementById('avg-score').textContent = `${stats.averageScore}%`;
        
        // Convert seconds to minutes for display
        const todayMinutes = Math.floor(stats.todayStudyTime / 60);
        document.getElementById('study-time').textContent = todayMinutes;
        
        // Calculate and display readiness score on dashboard
        this.updateDashboardReadiness();
        
        // Update gamification elements
        this.updateGamificationDisplay();
    }
    
    updateDashboardReadiness() {
        const readinessScore = storage.getValue('flashcards.readinessScore') || 0;
        const viewData = storage.getValue('flashcards.viewData') || {};
        const totalViewed = Object.keys(viewData).length;
        
        // Update any dashboard readiness indicators
        const dashboardReadiness = document.getElementById('dashboard-readiness');
        if (dashboardReadiness) {
            dashboardReadiness.innerHTML = `
                <div class="text-center">
                    <h6>Test Readiness</h6>
                    <div class="progress" style="height: 25px;">
                        <div class="progress-bar bg-${readinessScore >= 80 ? 'success' : readinessScore >= 60 ? 'warning' : 'danger'}" 
                             role="progressbar" 
                             style="width: ${readinessScore}%">
                            ${readinessScore}%
                        </div>
                    </div>
                    <small class="text-muted">${totalViewed} terms reviewed</small>
                </div>
            `;
        }
    }

    startPeriodicUpdates() {
        // Update dashboard every minute
        setInterval(() => {
            this.updateDashboard();
            storage.endStudySession();
            storage.startStudySession();
            
            // Update study time for gamification
            if (window.gamificationManager) {
                const today = new Date().toDateString();
                const dailyStats = gamificationManager.getData().dailyStats[today] || {};
                dailyStats.studyTime = (dailyStats.studyTime || 0) + 60;
                gamificationManager.updateDailyStats(dailyStats);
            }
        }, 60000);
    }


    updateProgressSection() {
        const stats = storage.getStatistics();
        const testHistory = storage.getValue('testHistory') || [];
        
        // Add null checks before setting textContent
        const totalSessionsEl = document.getElementById('total-sessions');
        if (totalSessionsEl) totalSessionsEl.textContent = stats.totalSessions;
        
        const cardsMasteredEl = document.getElementById('cards-mastered');
        if (cardsMasteredEl) cardsMasteredEl.textContent = stats.cardsMastered;
        
        const testsCompletedEl = document.getElementById('tests-completed');
        if (testsCompletedEl) testsCompletedEl.textContent = testHistory.length;
        
        // Convert total study time to hours and minutes
        const hours = Math.floor(stats.totalStudyTime / 3600);
        const minutes = Math.floor((stats.totalStudyTime % 3600) / 60);
        const totalTimeEl = document.getElementById('total-time');
        if (totalTimeEl) {
            totalTimeEl.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
        }
        
        // Update chart
        this.updateScoreChart();
        
        // Update calendar
        this.updateStudyCalendar();
        
        // Add test history table
        this.updateTestHistory();
    }
    
    updateTestHistory() {
        const testHistory = storage.getValue('testHistory') || [];
        const recentTests = testHistory.slice(-10).reverse(); // Last 10 tests, newest first
        
        const container = document.getElementById('test-history-container');
        if (container && recentTests.length > 0) {
            container.innerHTML = `
                <div class="card mt-4">
                    <div class="card-header">
                        <h4>Recent Test Results</h4>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Score</th>
                                        <th>Time</th>
                                        <th>Categories</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentTests.map(test => `
                                        <tr>
                                            <td>${new Date(test.date).toLocaleDateString()}</td>
                                            <td>
                                                <span class="badge bg-${
                                                    test.type === 'full' ? 'success' : 
                                                    test.type === 'practice' ? 'primary' : 
                                                    test.type === 'category' ? 'info' : 'warning'
                                                }">
                                                    ${test.type}${test.category ? `: ${test.category}` : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="${
                                                    test.percentage >= 80 ? 'text-success' : 
                                                    test.percentage >= 60 ? 'text-warning' : 'text-danger'
                                                }">
                                                    <strong>${test.percentage}%</strong>
                                                </span>
                                                <small class="text-muted">(${test.score}/${test.total})</small>
                                            </td>
                                            <td>${Math.floor(test.timeSeconds / 60)}:${(test.timeSeconds % 60).toString().padStart(2, '0')}</td>
                                            <td>
                                                ${Object.entries(test.categoryBreakdown || {})
                                                    .map(([cat, stats]) => 
                                                        `<small>${cat}: ${Math.round((stats.correct / stats.total) * 100)}%</small>`
                                                    ).join('<br>')}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    updateScoreChart() {
        const canvas = document.getElementById('score-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const scores = storage.getRecentTestScores();
        
        // If chart already exists, destroy it
        if (window.scoreChart) {
            window.scoreChart.destroy();
        }
        
        window.scoreChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: scores.map((_, index) => `Test ${index + 1}`),
                datasets: [{
                    label: 'Test Scores',
                    data: scores.map(score => score.percentage),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    updateStudyCalendar() {
        const calendarContainer = document.getElementById('study-calendar');
        if (!calendarContainer) return;
        
        calendarContainer.innerHTML = '';
        
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const studyDates = storage.getStatistics().studyDates;
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day';
            calendarContainer.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const dateString = new Date(currentYear, currentMonth, day).toDateString();
            
            if (studyDates.includes(dateString)) {
                dayElement.classList.add('studied');
            }
            
            if (day === today.getDate()) {
                dayElement.classList.add('today');
            }
            
            calendarContainer.appendChild(dayElement);
        }
    }
}

// Global functions for navigation
function navigateToSection(section) {
    if (window.app) {
        window.app.navigateToSection(section);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Ensure all critical dependencies are loaded
    const checkDependencies = () => {
        const dependencies = {
            'StorageManager': typeof StorageManager !== 'undefined',
            'GamificationManager': typeof GamificationManager !== 'undefined',
            'StorageMonitor': typeof StorageMonitor !== 'undefined'
        };
        
        const allLoaded = Object.values(dependencies).every(loaded => loaded);
        
        if (!allLoaded) {
            console.warn('Some dependencies not loaded yet:', dependencies);
            // Retry after a short delay
            setTimeout(checkDependencies, 100);
            return;
        }
        
        // All dependencies loaded, initialize app
        window.app = new App();
    };
    
    checkDependencies();
});

// Add gamification display update method
App.prototype.updateGamificationDisplay = function() {
    if (!window.gamificationManager) return;
    
    // Update level and points display with null checks
    const levelInfo = gamificationManager.getLevel();
    
    const currentLevelEl = document.getElementById('current-level');
    if (currentLevelEl) currentLevelEl.textContent = levelInfo.level;
    
    const levelNameEl = document.getElementById('level-name');
    if (levelNameEl) levelNameEl.textContent = levelInfo.levelName;
    
    const totalPointsEl = document.getElementById('total-points');
    if (totalPointsEl) totalPointsEl.textContent = levelInfo.points;
    
    const nextLevelPointsEl = document.getElementById('next-level-points');
    if (nextLevelPointsEl) nextLevelPointsEl.textContent = levelInfo.nextLevelPoints;
    
    const levelProgressBarEl = document.getElementById('level-progress-bar');
    if (levelProgressBarEl) levelProgressBarEl.style.width = `${levelInfo.progress}%`;
    
    // Update daily challenge
    const dailyChallenge = gamificationManager.getTodayChallenge();
    
    const challengeNameEl = document.getElementById('challenge-name');
    if (challengeNameEl) challengeNameEl.textContent = dailyChallenge.name;
    
    const challengeDescEl = document.getElementById('challenge-description');
    if (challengeDescEl) challengeDescEl.textContent = dailyChallenge.description;
    
    const challengeProgressBarEl = document.getElementById('challenge-progress-bar');
    if (challengeProgressBarEl) challengeProgressBarEl.style.width = `${dailyChallenge.progress}%`;
    
    const dailyChallengeEl = document.getElementById('daily-challenge');
    if (dailyChallengeEl && dailyChallenge.completed) {
        dailyChallengeEl.classList.add('completed');
    }
    
    // Update achievements grid
    const achievements = gamificationManager.getAllAchievements();
    const achievementsGrid = document.getElementById('achievements-grid');
    if (achievementsGrid) {
        achievementsGrid.innerHTML = achievements.map(achievement => `
            <div class="achievement-item ${achievement.unlocked ? 'unlocked' : ''}" 
                 title="${achievement.description}">
                <i class="fas ${achievement.icon} achievement-icon"></i>
                <div class="achievement-name">${achievement.name}</div>
                <small class="achievement-points">+${achievement.points} pts</small>
            </div>
        `).join('');
    }
};