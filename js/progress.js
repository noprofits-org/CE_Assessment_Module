class ProgressDashboard {
    constructor() {
        this.charts = {};
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;
        
        this.updateMetrics();
        this.updateStreak();
        this.updateCharts();
        this.generateRecommendations();
        this.createCalendarHeatmap();
        this.setupEventListeners();
        
        this.initialized = true;
    }

    updateMetrics() {
        const stats = storage.getStatistics();
        const testHistory = storage.getValue('testHistory') || [];
        const viewData = storage.getValue('flashcards.viewData') || {};
        
        // Calculate total questions answered
        const totalQuestions = testHistory.reduce((sum, test) => sum + test.total, 0);
        
        // Calculate average score by test type
        const testTypeStats = {};
        testHistory.forEach(test => {
            if (!testTypeStats[test.type]) {
                testTypeStats[test.type] = { total: 0, score: 0, count: 0 };
            }
            testTypeStats[test.type].total += test.total;
            testTypeStats[test.type].score += test.score;
            testTypeStats[test.type].count++;
        });
        
        // Display metrics
        document.getElementById('metric-streak').textContent = `${stats.studyStreak} 🔥`;
        document.getElementById('metric-questions').textContent = totalQuestions;
        document.getElementById('metric-avg-score').textContent = this.calculateOverallAverage(testHistory) + '%';
        document.getElementById('metric-cards-mastered').textContent = stats.cardsMastered;
        
        // Display average scores by test type
        this.displayTestTypeAverages(testTypeStats);
    }

    updateStreak() {
        const streak = storage.getValue('user.studyStreak') || 0;
        const streakElement = document.getElementById('streak-display');
        const messageElement = document.getElementById('streak-message');
        
        if (!streakElement || !messageElement) return;
        
        streakElement.innerHTML = `<span class="display-4">${streak}</span> <span class="h2">🔥</span>`;
        
        let message = '';
        let alertClass = 'alert-info';
        
        if (streak >= 30) {
            message = "Incredible dedication! 30 day streak!";
            alertClass = 'alert-success';
        } else if (streak >= 14) {
            message = "Two weeks! You're a CE study champion!";
            alertClass = 'alert-primary';
        } else if (streak >= 7) {
            message = "One week streak! You're building a habit!";
            alertClass = 'alert-warning';
        } else if (streak >= 3) {
            message = "Great start! Keep it up!";
            alertClass = 'alert-info';
        } else if (streak > 0) {
            message = "Every journey starts with a single step!";
            alertClass = 'alert-secondary';
        } else {
            message = "Start your streak today!";
            alertClass = 'alert-light';
        }
        
        messageElement.className = `alert ${alertClass} text-center`;
        messageElement.textContent = message;
    }

    calculateOverallAverage(testHistory) {
        if (testHistory.length === 0) return 0;
        const avg = testHistory.reduce((sum, test) => sum + test.percentage, 0) / testHistory.length;
        return Math.round(avg);
    }

    displayTestTypeAverages(stats) {
        const container = document.getElementById('test-type-averages');
        if (!container) return;
        
        container.innerHTML = '';
        Object.entries(stats).forEach(([type, data]) => {
            const avg = data.count > 0 ? Math.round((data.score / data.total) * 100) : 0;
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-3';
            card.innerHTML = `
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="text-muted">${type.charAt(0).toUpperCase() + type.slice(1)} Tests</h6>
                        <h3 class="${avg >= 80 ? 'text-success' : avg >= 60 ? 'text-warning' : 'text-danger'}">${avg}%</h3>
                        <small class="text-muted">${data.count} tests taken</small>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    updateCharts() {
        this.createScoreTrendChart();
        this.createCategoryRadarChart();
    }

    createScoreTrendChart() {
        const canvas = document.getElementById('score-trend-chart');
        if (!canvas) return;

        const testHistory = storage.getValue('testHistory') || [];
        const recentTests = testHistory.slice(-20); // Last 20 tests
        
        const labels = recentTests.map((test, index) => {
            const date = new Date(test.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        const scores = recentTests.map(test => test.percentage);

        if (this.charts.scoreTrend) {
            this.charts.scoreTrend.destroy();
        }

        this.charts.scoreTrend = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Test Scores',
                    data: scores,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Score Trends Over Time'
                    }
                },
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

    createCategoryRadarChart() {
        const canvas = document.getElementById('category-radar-chart');
        if (!canvas) return;

        const testHistory = storage.getValue('testHistory') || [];
        const categoryStats = {};

        // Aggregate scores by category
        testHistory.forEach(test => {
            if (test.categoryBreakdown) {
                Object.entries(test.categoryBreakdown).forEach(([category, stats]) => {
                    if (!categoryStats[category]) {
                        categoryStats[category] = { total: 0, correct: 0 };
                    }
                    categoryStats[category].total += stats.total;
                    categoryStats[category].correct += stats.correct;
                });
            }
        });

        const categories = Object.keys(categoryStats);
        const scores = categories.map(cat => {
            const stats = categoryStats[cat];
            return stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        });

        if (this.charts.categoryRadar) {
            this.charts.categoryRadar.destroy();
        }

        this.charts.categoryRadar = new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Performance by Category',
                    data: scores,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgb(255, 99, 132)',
                    pointBackgroundColor: 'rgb(255, 99, 132)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(255, 99, 132)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Category Performance'
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            display: false
                        },
                        suggestedMin: 0,
                        suggestedMax: 100,
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

    generateRecommendations() {
        const container = document.getElementById('study-recommendations');
        if (!container) return;

        const recommendations = [];
        const testHistory = storage.getValue('testHistory') || [];
        const viewData = storage.getValue('flashcards.viewData') || {};
        
        // 1. Find categories with lowest scores
        const categoryScores = this.getCategoryScores();
        const weakCategories = Object.entries(categoryScores)
            .filter(([cat, score]) => score < 70)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3);

        if (weakCategories.length > 0) {
            recommendations.push({
                type: 'category',
                title: 'Focus on these categories:',
                items: weakCategories.map(([cat, score]) => 
                    `${cat} (Current: ${score}%)`
                )
            });
        }

        // 2. Find terms not reviewed in 7+ days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const staleTerms = [];
        Object.entries(viewData).forEach(([termId, data]) => {
            if (new Date(data.lastViewed) < sevenDaysAgo) {
                staleTerms.push(termId);
            }
        });

        if (staleTerms.length > 0) {
            recommendations.push({
                type: 'review',
                title: 'Review these terms:',
                items: [`${staleTerms.length} terms haven't been reviewed in 7+ days`]
            });
        }

        // 3. Find frequently missed questions
        const missedQuestions = {};
        testHistory.forEach(test => {
            test.missedQuestions?.forEach(qId => {
                missedQuestions[qId] = (missedQuestions[qId] || 0) + 1;
            });
        });

        const frequentlyMissed = Object.entries(missedQuestions)
            .filter(([qId, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (frequentlyMissed.length > 0) {
            recommendations.push({
                type: 'practice',
                title: 'Practice these questions:',
                items: [`${frequentlyMissed.length} questions missed multiple times`]
            });
        }

        // Display recommendations
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-card mb-3">
                <h6>${rec.title}</h6>
                <ul class="mb-0">
                    ${rec.items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        `).join('') || '<p class="text-muted">Great job! No specific recommendations at this time.</p>';
    }

    getCategoryScores() {
        const testHistory = storage.getValue('testHistory') || [];
        const categoryStats = {};

        testHistory.forEach(test => {
            if (test.categoryBreakdown) {
                Object.entries(test.categoryBreakdown).forEach(([category, stats]) => {
                    if (!categoryStats[category]) {
                        categoryStats[category] = { total: 0, correct: 0 };
                    }
                    categoryStats[category].total += stats.total;
                    categoryStats[category].correct += stats.correct;
                });
            }
        });

        const scores = {};
        Object.entries(categoryStats).forEach(([cat, stats]) => {
            scores[cat] = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        });

        return scores;
    }

    createCalendarHeatmap() {
        const container = document.getElementById('calendar-heatmap');
        if (!container) return;

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90); // Show last 90 days

        const dailyStudy = storage.getValue('dailyStudy') || {};
        const maxActivity = Math.max(...Object.values(dailyStudy).map(d => d.activityScore || 0), 1);

        let html = '<div class="calendar-heatmap">';
        
        // Add day labels
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        html += '<div class="calendar-labels">';
        dayLabels.forEach(day => {
            html += `<div class="calendar-label">${day}</div>`;
        });
        html += '</div>';

        // Add calendar grid
        html += '<div class="calendar-grid">';
        
        // Add empty cells to align the first day
        const firstDayOfWeek = startDate.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += '<div class="calendar-cell empty"></div>';
        }

        // Add cells for each day
        const currentDate = new Date(startDate);
        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = dailyStudy[dateStr];
            const intensity = dayData ? Math.ceil((dayData.activityScore / maxActivity) * 4) : 0;
            
            html += `<div class="calendar-cell" 
                          data-date="${dateStr}" 
                          data-intensity="${intensity}"
                          title="${dateStr}: ${dayData?.activityScore || 0} activities">
                     </div>`;
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        html += '</div>';
        html += '<div class="calendar-legend">';
        html += '<span>Less</span>';
        for (let i = 0; i <= 4; i++) {
            html += `<div class="calendar-cell" data-intensity="${i}"></div>`;
        }
        html += '<span>More</span>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        // Add CSS for calendar heatmap if not already present
        if (!document.getElementById('calendar-heatmap-styles')) {
            const style = document.createElement('style');
            style.id = 'calendar-heatmap-styles';
            style.textContent = `
                .calendar-heatmap {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .calendar-labels {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 3px;
                    margin-left: 20px;
                }
                .calendar-label {
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 3px;
                    margin-left: 20px;
                }
                .calendar-cell {
                    aspect-ratio: 1;
                    border-radius: 2px;
                    background-color: #ebedf0;
                    cursor: pointer;
                }
                .calendar-cell.empty {
                    background-color: transparent;
                }
                .calendar-cell[data-intensity="1"] { background-color: #c6e48b; }
                .calendar-cell[data-intensity="2"] { background-color: #7bc96f; }
                .calendar-cell[data-intensity="3"] { background-color: #239a3b; }
                .calendar-cell[data-intensity="4"] { background-color: #196127; }
                .calendar-legend {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    color: #666;
                    margin-left: 20px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            user: storage.getValue('user') || {},
            flashcards: {
                viewData: storage.getValue('flashcards.viewData') || {},
                cardsMastered: storage.getValue('flashcards.cardsMastered') || [],
                preferences: storage.getValue('flashcards.preferences') || {}
            },
            tests: {
                history: storage.getValue('testHistory') || [],
                scores: storage.getValue('tests.scores') || []
            },
            progress: storage.getValue('progress') || {},
            scenarios: storage.getValue('scenarios') || {},
            dailyStudy: storage.getValue('dailyStudy') || {}
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ce_study_progress_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get data
        const stats = storage.getStatistics();
        const testHistory = storage.getValue('testHistory') || [];
        const categoryScores = this.getCategoryScores();
        
        // Title
        doc.setFontSize(20);
        doc.text('CE Housing Assessor Study Report', 20, 20);
        
        // Date
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
        
        // Study Stats
        doc.setFontSize(16);
        doc.text('Study Statistics', 20, 45);
        doc.setFontSize(12);
        doc.text(`Study Streak: ${stats.studyStreak} days`, 20, 55);
        doc.text(`Total Study Time: ${Math.floor(stats.totalStudyTime / 3600)} hours`, 20, 65);
        doc.text(`Cards Reviewed: ${stats.cardsReviewed}`, 20, 75);
        doc.text(`Cards Mastered: ${stats.cardsMastered}`, 20, 85);
        
        // Test Performance
        doc.setFontSize(16);
        doc.text('Test Performance', 20, 105);
        doc.setFontSize(12);
        doc.text(`Tests Completed: ${testHistory.length}`, 20, 115);
        doc.text(`Average Score: ${this.calculateOverallAverage(testHistory)}%`, 20, 125);
        
        // Category Performance
        doc.setFontSize(14);
        doc.text('Performance by Category:', 20, 145);
        doc.setFontSize(12);
        let yPos = 155;
        Object.entries(categoryScores).forEach(([cat, score]) => {
            doc.text(`${cat}: ${score}%`, 30, yPos);
            yPos += 10;
        });
        
        // Recent Tests
        if (testHistory.length > 0) {
            doc.addPage();
            doc.setFontSize(16);
            doc.text('Recent Test Results', 20, 20);
            doc.setFontSize(10);
            
            const recentTests = testHistory.slice(-10).reverse();
            yPos = 35;
            recentTests.forEach(test => {
                const date = new Date(test.date).toLocaleDateString();
                doc.text(`${date} - ${test.type} - ${test.percentage}% (${test.score}/${test.total})`, 20, yPos);
                yPos += 8;
            });
        }
        
        // Recommendations
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Study Recommendations', 20, 20);
        doc.setFontSize(12);
        
        const weakCategories = Object.entries(categoryScores)
            .filter(([cat, score]) => score < 70)
            .sort((a, b) => a[1] - b[1]);
        
        if (weakCategories.length > 0) {
            doc.text('Focus on these categories:', 20, 35);
            yPos = 45;
            weakCategories.forEach(([cat, score]) => {
                doc.text(`- ${cat} (${score}%)`, 30, yPos);
                yPos += 10;
            });
        } else {
            doc.text('Great job! All categories above 70%', 20, 35);
        }
        
        // Save PDF
        doc.save(`ce_study_report_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    confirmClearData() {
        if (confirm('Are you sure you want to clear all your study data? This cannot be undone.')) {
            if (confirm('This will delete ALL your progress, test scores, and study history. Are you REALLY sure?')) {
                localStorage.removeItem('ce_housing_assessor');
                alert('All data has been cleared. The page will now reload.');
                location.reload();
            }
        }
    }

    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        this.importData(data);
                    } catch (error) {
                        alert('Error importing data. Please check the file format.');
                        console.error('Import error:', error);
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }

    importData(data) {
        if (confirm('This will replace all existing data. Are you sure?')) {
            // Import each data category
            if (data.user) storage.updateData('user', data.user);
            if (data.flashcards) {
                if (data.flashcards.viewData) 
                    storage.updateData('flashcards.viewData', data.flashcards.viewData);
                if (data.flashcards.cardsMastered) 
                    storage.updateData('flashcards.cardsMastered', data.flashcards.cardsMastered);
                if (data.flashcards.preferences) 
                    storage.updateData('flashcards.preferences', data.flashcards.preferences);
            }
            if (data.tests?.history) 
                storage.updateData('testHistory', data.tests.history);
            if (data.progress) 
                storage.updateData('progress', data.progress);
            if (data.scenarios) 
                storage.updateData('scenarios', data.scenarios);
            if (data.dailyStudy) 
                storage.updateData('dailyStudy', data.dailyStudy);
            
            alert('Data imported successfully!');
            location.reload();
        }
    }

    setupEventListeners() {
        // Export button
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Generate PDF button
        const pdfBtn = document.getElementById('generate-pdf-btn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.generatePDF());
        }

        // Clear data button
        const clearBtn = document.getElementById('clear-data-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearData());
        }

        // Import data button
        const importBtn = document.getElementById('import-data-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showImportDialog());
        }
    }
}

// Create global instance
const progressDashboard = new ProgressDashboard();

// Initialize when progress section is shown
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const progressSection = document.getElementById('progress');
                if (progressSection && progressSection.classList.contains('active')) {
                    progressDashboard.initialize();
                }
            }
        });
    });

    const progressSection = document.getElementById('progress');
    if (progressSection) {
        observer.observe(progressSection, { attributes: true });
    }
});