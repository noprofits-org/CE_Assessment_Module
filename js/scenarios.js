class ScenarioManager {
    constructor() {
        this.scenarios = [];
        this.currentScenarioIndex = 0;
        this.scenarioHistory = [];
        this.isShowingFeedback = false;
        this.loadScenarios();
    }

    async loadScenarios() {
        try {
            const response = await fetch('data/scenarios.json');
            const data = await response.json();
            this.scenarios = data.scenarios;
            this.shuffleScenarios();
            this.restoreProgress();
        } catch (error) {
            console.error('Error loading scenarios:', error);
        }
    }

    shuffleScenarios() {
        // Fisher-Yates shuffle
        for (let i = this.scenarios.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.scenarios[i], this.scenarios[j]] = [this.scenarios[j], this.scenarios[i]];
        }
    }

    restoreProgress() {
        const savedIndex = storage.getValue('scenarios.currentIndex');
        const savedHistory = storage.getValue('scenarios.history') || [];
        
        if (savedIndex !== null) {
            this.currentScenarioIndex = savedIndex;
        }
        this.scenarioHistory = savedHistory;
    }

    initialize() {
        const scenarioSection = document.getElementById('scenarios');
        if (!scenarioSection || !scenarioSection.classList.contains('active')) return;

        this.displayCurrentScenario();
        this.updateProgress();
        this.setupKeyboardNavigation();
    }

    displayCurrentScenario() {
        if (this.currentScenarioIndex >= this.scenarios.length) {
            this.showCompletionScreen();
            return;
        }

        const scenario = this.scenarios[this.currentScenarioIndex];
        const container = document.getElementById('scenario-container');
        
        container.innerHTML = `
            <div class="scenario-card ${this.isShowingFeedback ? 'showing-feedback' : ''}">
                <div class="scenario-header">
                    <span class="scenario-number">Scenario ${this.currentScenarioIndex + 1} of ${this.scenarios.length}</span>
                    <span class="scenario-difficulty badge bg-${
                        scenario.difficulty === 'hard' ? 'danger' : 
                        scenario.difficulty === 'medium' ? 'warning' : 'success'
                    }">${scenario.difficulty}</span>
                </div>
                
                <h3 class="scenario-title">${scenario.title}</h3>
                
                <div class="scenario-story">
                    <p class="lead">${scenario.description}</p>
                </div>
                
                <div class="scenario-question">
                    <h5>${scenario.question}</h5>
                </div>
                
                <div class="scenario-options" id="scenario-options">
                    ${Object.entries(scenario.options).map(([key, text]) => `
                        <button class="option-button" data-option="${key}" ${this.isShowingFeedback ? 'disabled' : ''}>
                            <span class="option-key">${key}</span>
                            <span class="option-text">${text}</span>
                        </button>
                    `).join('')}
                </div>
                
                <div id="scenario-feedback" class="scenario-feedback" style="display: none;"></div>
                
                <div class="scenario-navigation">
                    <button class="btn btn-secondary" id="prev-scenario" 
                            onclick="scenarioManager.previousScenario()" 
                            ${this.currentScenarioIndex === 0 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-left"></i> Previous
                    </button>
                    <button class="btn btn-primary" id="next-scenario" 
                            onclick="scenarioManager.nextScenario()" 
                            style="display: ${this.isShowingFeedback ? 'inline-block' : 'none'};">
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;

        // Add click handlers for options
        if (!this.isShowingFeedback) {
            document.querySelectorAll('.option-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const option = e.currentTarget.dataset.option;
                    this.selectAnswer(option);
                });
            });
        }
    }

    selectAnswer(selectedOption) {
        if (this.isShowingFeedback) return;

        const scenario = this.scenarios[this.currentScenarioIndex];
        const isCorrect = selectedOption === scenario.correct;
        
        // Mark selected button
        document.querySelectorAll('.option-button').forEach(button => {
            button.disabled = true;
            if (button.dataset.option === selectedOption) {
                button.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            if (button.dataset.option === scenario.correct) {
                button.classList.add('correct-answer');
            }
        });

        // Show feedback
        this.showFeedback(isCorrect, scenario);
        
        // Record attempt
        this.recordAttempt(scenario.id, selectedOption, isCorrect);
        
        // Update progress
        this.isShowingFeedback = true;
        document.getElementById('next-scenario').style.display = 'inline-block';
    }

    showFeedback(isCorrect, scenario) {
        const feedbackDiv = document.getElementById('scenario-feedback');
        
        feedbackDiv.innerHTML = `
            <div class="alert ${isCorrect ? 'alert-success' : 'alert-danger'}">
                <h6>
                    <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${isCorrect ? 'Correct!' : 'Incorrect'}
                </h6>
                <p>${scenario.explanation}</p>
                
                ${scenario.relatedConcepts && scenario.relatedConcepts.length > 0 ? `
                    <div class="related-concepts">
                        <strong>Related concepts:</strong>
                        ${scenario.relatedConcepts.map(concept => `
                            <button class="btn btn-sm btn-outline-primary ms-2" 
                                    onclick="scenarioManager.viewRelatedConcept('${concept}')">
                                <i class="fas fa-link"></i> ${concept}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        feedbackDiv.style.display = 'block';
        feedbackDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    viewRelatedConcept(concept) {
        // Navigate to flashcards and filter by this concept
        const event = new CustomEvent('navigateToFlashcard', { 
            detail: { searchTerm: concept } 
        });
        document.dispatchEvent(event);
    }

    recordAttempt(scenarioId, selectedOption, isCorrect) {
        const attempt = {
            scenarioId,
            selectedOption,
            isCorrect,
            timestamp: new Date().toISOString()
        };
        
        // Add to history
        this.scenarioHistory.push(attempt);
        storage.updateData('scenarios.history', this.scenarioHistory);
        
        // Track completion
        const completed = storage.getValue('scenarios.completed') || [];
        const isNewCompletion = !completed.includes(scenarioId);
        if (isNewCompletion) {
            completed.push(scenarioId);
            storage.updateData('scenarios.completed', completed);
        }
        
        // Track daily activity
        storage.trackDailyActivity();
        const today = new Date().toISOString().split('T')[0];
        const dailyStudy = storage.getValue('dailyStudy') || {};
        if (dailyStudy[today]) {
            dailyStudy[today].scenariosCompleted = (dailyStudy[today].scenariosCompleted || 0) + 1;
            dailyStudy[today].activityScore += 3;
            storage.updateData('dailyStudy', dailyStudy);
        }
        
        // Gamification: Award points for completing scenarios
        if (window.gamificationManager) {
            // Points for answering
            if (isCorrect) {
                gamificationManager.addPoints(5, 'Correct scenario answer');
            } else {
                gamificationManager.addPoints(2, 'Scenario attempt');
            }
            
            // Bonus for first-time completion
            if (isNewCompletion) {
                gamificationManager.addPoints(5, 'New scenario completed');
            }
            
            // Update daily stats for challenges
            const stats = {
                scenariosCompleted: completed.length
            };
            
            const completedChallenge = gamificationManager.updateDailyStats(stats);
            if (completedChallenge) {
                showChallengeCompleteNotification(completedChallenge);
            }
            
            // Check for achievements
            const newAchievements = gamificationManager.checkAchievements();
            newAchievements.forEach(achievement => {
                showAchievementNotification(achievement);
            });
        }
    }

    nextScenario() {
        this.currentScenarioIndex++;
        this.isShowingFeedback = false;
        storage.updateData('scenarios.currentIndex', this.currentScenarioIndex);
        this.displayCurrentScenario();
        this.updateProgress();
    }

    previousScenario() {
        if (this.currentScenarioIndex > 0) {
            this.currentScenarioIndex--;
            this.isShowingFeedback = false;
            storage.updateData('scenarios.currentIndex', this.currentScenarioIndex);
            this.displayCurrentScenario();
            this.updateProgress();
        }
    }

    updateProgress() {
        const progressBar = document.getElementById('scenario-progress');
        const progressText = document.getElementById('scenario-progress-text');
        
        if (progressBar && progressText) {
            const progress = ((this.currentScenarioIndex + 1) / this.scenarios.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${this.currentScenarioIndex + 1} / ${this.scenarios.length}`;
        }
        
        this.updateStats();
    }

    updateStats() {
        const stats = this.calculateStats();
        const statsContainer = document.getElementById('scenario-stats');
        
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="row text-center mb-4">
                    <div class="col-md-3 col-6">
                        <div class="stat-box">
                            <h5>${stats.completed}</h5>
                            <small>Completed</small>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="stat-box">
                            <h5>${stats.accuracy}%</h5>
                            <small>Accuracy</small>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="stat-box">
                            <h5>${stats.streak}</h5>
                            <small>Current Streak</small>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="stat-box">
                            <h5>${stats.remaining}</h5>
                            <small>Remaining</small>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    calculateStats() {
        const completed = (storage.getValue('scenarios.completed') || []).length;
        const correctAttempts = this.scenarioHistory.filter(h => h.isCorrect).length;
        const totalAttempts = this.scenarioHistory.length;
        const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
        
        // Calculate current streak
        let streak = 0;
        for (let i = this.scenarioHistory.length - 1; i >= 0; i--) {
            if (this.scenarioHistory[i].isCorrect) {
                streak++;
            } else {
                break;
            }
        }
        
        return {
            completed,
            accuracy,
            streak,
            remaining: this.scenarios.length - completed
        };
    }

    showCompletionScreen() {
        const stats = this.calculateStats();
        const container = document.getElementById('scenario-container');
        
        container.innerHTML = `
            <div class="text-center completion-screen">
                <i class="fas fa-trophy fa-5x text-warning mb-4"></i>
                <h2>Congratulations!</h2>
                <p class="lead">You've completed all available scenarios!</p>
                
                <div class="row mt-5 justify-content-center">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-body">
                                <h4>Your Performance</h4>
                                <div class="row mt-3">
                                    <div class="col-4">
                                        <h3 class="text-primary">${stats.completed}</h3>
                                        <p>Scenarios Completed</p>
                                    </div>
                                    <div class="col-4">
                                        <h3 class="text-success">${stats.accuracy}%</h3>
                                        <p>Overall Accuracy</p>
                                    </div>
                                    <div class="col-4">
                                        <h3 class="text-info">${stats.streak}</h3>
                                        <p>Best Streak</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <button class="btn btn-primary btn-lg" onclick="scenarioManager.resetScenarios()">
                        <i class="fas fa-redo"></i> Practice Again
                    </button>
                    <button class="btn btn-success btn-lg ms-2" onclick="navigateToSection('tests')">
                        <i class="fas fa-clipboard-check"></i> Take a Test
                    </button>
                </div>
            </div>
        `;
    }

    resetScenarios() {
        this.currentScenarioIndex = 0;
        this.isShowingFeedback = false;
        storage.updateData('scenarios.currentIndex', 0);
        this.shuffleScenarios();
        this.displayCurrentScenario();
        this.updateProgress();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('scenarios').classList.contains('active')) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    if (this.currentScenarioIndex > 0) {
                        this.previousScenario();
                    }
                    break;
                case 'ArrowRight':
                    if (this.isShowingFeedback) {
                        this.nextScenario();
                    }
                    break;
                case '1':
                case 'a':
                case 'A':
                    if (!this.isShowingFeedback) this.selectAnswer('A');
                    break;
                case '2':
                case 'b':
                case 'B':
                    if (!this.isShowingFeedback) this.selectAnswer('B');
                    break;
                case '3':
                case 'c':
                case 'C':
                    if (!this.isShowingFeedback) this.selectAnswer('C');
                    break;
                case '4':
                case 'd':
                case 'D':
                    if (!this.isShowingFeedback) this.selectAnswer('D');
                    break;
            }
        });
    }
}

// Create global instance
const scenarioManager = new ScenarioManager();

// Initialize when scenarios section is shown
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const scenariosSection = document.getElementById('scenarios');
                if (scenariosSection && scenariosSection.classList.contains('active')) {
                    scenarioManager.initialize();
                }
            }
        });
    });

    const scenariosSection = document.getElementById('scenarios');
    if (scenariosSection) {
        observer.observe(scenariosSection, { attributes: true });
    }
    
    // Listen for navigation from flashcards
    document.addEventListener('navigateToFlashcard', (e) => {
        navigateToSection('flashcards');
        // The flashcard manager will handle the search
        setTimeout(() => {
            const event = new CustomEvent('searchFlashcards', { 
                detail: { searchTerm: e.detail.searchTerm } 
            });
            document.dispatchEvent(event);
        }, 100);
    });
});