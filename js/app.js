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
            }
        });
        
        // Set initial state
        const hash = window.location.hash.slice(1) || 'home';
        this.navigateToSection(hash);
    }

    navigateToSection(section) {
        this.showSection(section);
        history.pushState({ section }, '', `#${section}`);
    }

    showSection(section) {
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

    initializeSectionContent(section) {
        switch(section) {
            case 'flashcards':
                // Flashcard manager is initialized via MutationObserver in flashcards.js
                // This ensures it's properly initialized when the section becomes active
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
        }, 60000);
    }


    updateProgressSection() {
        const stats = storage.getStatistics();
        const testHistory = storage.getValue('testHistory') || [];
        
        // Update statistics
        document.getElementById('total-sessions').textContent = stats.totalSessions;
        document.getElementById('cards-mastered').textContent = stats.cardsMastered;
        document.getElementById('tests-completed').textContent = testHistory.length;
        
        // Convert total study time to hours and minutes
        const hours = Math.floor(stats.totalStudyTime / 3600);
        const minutes = Math.floor((stats.totalStudyTime % 3600) / 60);
        document.getElementById('total-time').textContent = 
            hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
        
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
    window.app = new App();
});