class TestManager {
    constructor() {
        this.questions = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.testType = null;
        this.testMode = null; // 'practice', 'full', 'category'
        this.selectedCategory = null;
        this.timer = null;
        this.startTime = null;
        this.timeRemaining = 0;
        this.isReviewMode = false;
        this.immediateFeedback = false;
        this.currentTestId = null;
        this.loadQuestions();
    }

    async loadQuestions() {
        try {
            const response = await fetch('data/questions.json');
            const data = await response.json();
            this.questions = data.questions;
        } catch (error) {
            console.error('Error loading questions:', error);
        }
    }

    showTestSelection() {
        // Check readiness before showing test options
        this.checkReadiness();
        
        const container = document.getElementById('test-selection');
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h3 class="mb-4">Select Test Type</h3>
                    
                    <div id="readiness-warning" class="mb-4"></div>
                    
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <div class="test-option-card" onclick="testManager.selectTestMode('practice')">
                                <div class="card h-100">
                                    <div class="card-body text-center">
                                        <i class="fas fa-dumbbell fa-3x mb-3 text-primary"></i>
                                        <h5>Practice Test</h5>
                                        <p class="text-muted">10 random questions</p>
                                        <small class="text-success">Immediate feedback available</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="test-option-card" onclick="testManager.selectTestMode('full')">
                                <div class="card h-100">
                                    <div class="card-body text-center">
                                        <i class="fas fa-clipboard-list fa-3x mb-3 text-success"></i>
                                        <h5>Full Test</h5>
                                        <p class="text-muted">25 questions from all categories</p>
                                        <small class="text-info">Simulates real exam</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="test-option-card" onclick="testManager.selectTestMode('category')">
                                <div class="card h-100">
                                    <div class="card-body text-center">
                                        <i class="fas fa-folder-open fa-3x mb-3 text-info"></i>
                                        <h5>Category Practice</h5>
                                        <p class="text-muted">Focus on specific topics</p>
                                        <small class="text-warning">Target weak areas</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.style.display = 'block';
        document.getElementById('test-container').style.display = 'none';
        document.getElementById('test-results').style.display = 'none';
    }

    checkReadiness() {
        const viewData = storage.getValue('flashcards.viewData') || {};
        const readinessScore = storage.getValue('flashcards.readinessScore') || 0;
        
        // Get all test-relevant terms
        const termsResponse = fetch('data/terms.json')
            .then(res => res.json())
            .then(data => {
                const testRelevantTerms = data.terms.filter(term => term.testRelevant);
                const viewedTestTerms = testRelevantTerms.filter(term => viewData[term.id]);
                const percentage = Math.round((viewedTestTerms.length / testRelevantTerms.length) * 100);
                
                const warningDiv = document.getElementById('readiness-warning');
                if (percentage < 70 || readinessScore < 60) {
                    // Calculate which categories need more study
                    const categoryStats = this.calculateCategoryReadiness(data.terms, viewData);
                    const weakCategories = Object.entries(categoryStats)
                        .filter(([cat, stats]) => stats.percentage < 70)
                        .sort((a, b) => a[1].percentage - b[1].percentage)
                        .slice(0, 3);
                    
                    warningDiv.innerHTML = `
                        <div class="alert alert-warning">
                            <h5><i class="fas fa-exclamation-triangle"></i> Low Test Readiness</h5>
                            <p>You've only reviewed <strong>${percentage}%</strong> of test-relevant terms. 
                               Your overall readiness score is <strong>${readinessScore}%</strong>.</p>
                            <p><strong>Recommendation:</strong> Review more flashcards before taking a test.</p>
                            ${weakCategories.length > 0 ? `
                                <p class="mb-2"><strong>Focus on these categories:</strong></p>
                                <ul class="mb-0">
                                    ${weakCategories.map(([cat, stats]) => 
                                        `<li>${cat} (${stats.percentage}% reviewed)</li>`
                                    ).join('')}
                                </ul>
                            ` : ''}
                            <div class="mt-3">
                                <button class="btn btn-warning btn-sm" onclick="navigateToSection('flashcards')">
                                    <i class="fas fa-cards"></i> Review Flashcards
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    warningDiv.innerHTML = `
                        <div class="alert alert-success">
                            <h5><i class="fas fa-check-circle"></i> Good Test Readiness</h5>
                            <p>You've reviewed <strong>${percentage}%</strong> of test-relevant terms. 
                               Your readiness score is <strong>${readinessScore}%</strong>. You're ready to test!</p>
                        </div>
                    `;
                }
            });
    }

    calculateCategoryReadiness(terms, viewData) {
        const categoryStats = {};
        
        terms.forEach(term => {
            if (!term.testRelevant) return;
            
            if (!categoryStats[term.category]) {
                categoryStats[term.category] = { viewed: 0, total: 0 };
            }
            
            categoryStats[term.category].total++;
            if (viewData[term.id]) {
                categoryStats[term.category].viewed++;
            }
        });
        
        Object.keys(categoryStats).forEach(cat => {
            categoryStats[cat].percentage = Math.round(
                (categoryStats[cat].viewed / categoryStats[cat].total) * 100
            );
        });
        
        return categoryStats;
    }

    selectTestMode(mode) {
        this.testMode = mode;
        
        if (mode === 'category') {
            this.showCategorySelection();
        } else if (mode === 'practice') {
            this.showPracticeOptions();
        } else {
            this.startTest(mode);
        }
    }

    showCategorySelection() {
        const categories = [...new Set(this.questions.map(q => q.category))];
        const container = document.getElementById('test-selection');
        
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h3 class="mb-4">Select Category</h3>
                    <div class="row">
                        ${categories.map(cat => `
                            <div class="col-md-4 mb-3">
                                <button class="btn btn-outline-primary w-100" 
                                        onclick="testManager.startCategoryTest('${cat}')">
                                    <i class="fas fa-folder"></i> ${cat}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-secondary mt-3" onclick="testManager.showTestSelection()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
            </div>
        `;
    }

    showPracticeOptions() {
        const container = document.getElementById('test-selection');
        
        container.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h3 class="mb-4">Practice Test Options</h3>
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="immediate-feedback" checked>
                        <label class="form-check-label" for="immediate-feedback">
                            Show immediate feedback after each answer
                        </label>
                    </div>
                    <button class="btn btn-primary" onclick="testManager.startPracticeTest()">
                        <i class="fas fa-play"></i> Start Practice Test
                    </button>
                    <button class="btn btn-secondary ms-2" onclick="testManager.showTestSelection()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
            </div>
        `;
    }

    startPracticeTest() {
        this.immediateFeedback = document.getElementById('immediate-feedback')?.checked || false;
        this.startTest('practice');
    }

    startCategoryTest(category) {
        this.selectedCategory = category;
        this.startTest('category');
    }

    startTest(type) {
        this.testType = type;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.isReviewMode = false;
        this.startTime = Date.now();
        this.currentTestId = Date.now().toString();
        
        // Select questions based on test type
        switch(type) {
            case 'practice':
                this.currentQuestions = this.selectRandomQuestions(10);
                break;
            case 'full':
                this.currentQuestions = this.selectRandomQuestions(25);
                this.startTimer(25 * 60); // 25 minutes for full test
                break;
            case 'category':
                const categoryQuestions = this.questions.filter(q => q.category === this.selectedCategory);
                this.currentQuestions = this.shuffleArray(categoryQuestions).slice(0, 15);
                break;
        }
        
        this.showTestContainer();
        this.displayQuestion();
    }

    selectRandomQuestions(count) {
        const shuffled = this.shuffleArray([...this.questions]);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    showTestContainer() {
        document.getElementById('test-selection').style.display = 'none';
        document.getElementById('test-container').style.display = 'block';
        document.getElementById('test-results').style.display = 'none';
        
        document.getElementById('total-questions').textContent = this.currentQuestions.length;
        
        // Show/hide timer based on test type
        const timerElement = document.getElementById('timer');
        if (this.testType === 'full') {
            timerElement.style.display = 'block';
        } else {
            timerElement.style.display = 'none';
        }
        
        // Update submit button text
        const submitBtn = document.getElementById('submit-test');
        if (submitBtn) {
            submitBtn.textContent = this.isReviewMode ? 'Back to Results' : 'Submit Test';
        }
    }

    displayQuestion() {
        if (this.currentQuestionIndex >= this.currentQuestions.length) {
            if (!this.isReviewMode) {
                this.submitTest();
            }
            return;
        }
        
        const question = this.currentQuestions[this.currentQuestionIndex];
        document.getElementById('question-number').textContent = this.currentQuestionIndex + 1;
        document.getElementById('question-text').textContent = question.text || question.question;
        
        const optionsContainer = document.getElementById('answer-options');
        optionsContainer.innerHTML = '';
        
        // Display question info
        const questionInfo = document.createElement('div');
        questionInfo.className = 'mb-3';
        questionInfo.innerHTML = `
            <small class="text-muted">
                Category: <strong>${question.category}</strong> | 
                Difficulty: <span class="badge bg-${
                    question.difficulty === 'Hard' ? 'danger' : 
                    question.difficulty === 'Medium' ? 'warning' : 'success'
                }">${question.difficulty}</span>
            </small>
        `;
        optionsContainer.appendChild(questionInfo);
        
        // Handle question options
        if (question.options && typeof question.options === 'object' && !Array.isArray(question.options)) {
            Object.keys(question.options).forEach((key) => {
                const button = document.createElement('button');
                button.className = 'answer-option';
                button.innerHTML = `<strong>${key}:</strong> ${question.options[key]}`;
                
                if (this.isReviewMode) {
                    button.disabled = true;
                    if (key === question.correct) {
                        button.classList.add('correct');
                    }
                    if (this.userAnswers[question.id] === key && key !== question.correct) {
                        button.classList.add('incorrect');
                    }
                    if (this.userAnswers[question.id] === key) {
                        button.innerHTML += ' <i class="fas fa-check-circle"></i>';
                    }
                } else {
                    button.onclick = () => this.selectAnswer(question.id, key);
                    if (this.userAnswers[question.id] === key) {
                        button.classList.add('selected');
                    }
                }
                
                optionsContainer.appendChild(button);
            });
        }
        
        // Show immediate feedback if enabled and answer was selected
        if (this.immediateFeedback && this.userAnswers[question.id] && !this.isReviewMode) {
            this.showImmediateFeedback(question);
        }
        
        // Show explanation in review mode
        if (this.isReviewMode && question.explanation) {
            const explanation = document.createElement('div');
            explanation.className = 'alert alert-info mt-3';
            explanation.innerHTML = `
                <h6><i class="fas fa-lightbulb"></i> Explanation</h6>
                <p class="mb-0">${question.explanation}</p>
            `;
            optionsContainer.appendChild(explanation);
        }
        
        this.updateProgress();
        this.updateNavigationButtons();
    }

    selectAnswer(questionId, answer) {
        if (this.isReviewMode) return;
        
        this.userAnswers[questionId] = answer;
        
        // Update UI
        const options = document.querySelectorAll('.answer-option');
        options.forEach((option) => {
            option.classList.remove('selected');
            if (option.innerHTML.includes(`<strong>${answer}:</strong>`)) {
                option.classList.add('selected');
            }
        });
        
        // Show immediate feedback if enabled
        if (this.immediateFeedback) {
            const question = this.currentQuestions[this.currentQuestionIndex];
            this.showImmediateFeedback(question);
        }
    }

    showImmediateFeedback(question) {
        const options = document.querySelectorAll('.answer-option');
        const userAnswer = this.userAnswers[question.id];
        
        options.forEach((option) => {
            // Disable all options after answer
            option.disabled = true;
            
            // Extract the option key from innerHTML
            const match = option.innerHTML.match(/<strong>([A-D]):<\/strong>/);
            if (match) {
                const optionKey = match[1];
                
                if (optionKey === question.correct) {
                    option.classList.add('correct');
                    option.innerHTML += ' <i class="fas fa-check text-success"></i>';
                } else if (optionKey === userAnswer && optionKey !== question.correct) {
                    option.classList.add('incorrect');
                    option.innerHTML += ' <i class="fas fa-times text-danger"></i>';
                }
            }
        });
        
        // Show explanation
        if (question.explanation) {
            const existingExplanation = document.querySelector('.immediate-feedback');
            if (!existingExplanation) {
                const explanation = document.createElement('div');
                explanation.className = 'alert mt-3 immediate-feedback';
                explanation.classList.add(userAnswer === question.correct ? 'alert-success' : 'alert-danger');
                explanation.innerHTML = `
                    <h6><i class="fas ${userAnswer === question.correct ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                        ${userAnswer === question.correct ? 'Correct!' : 'Incorrect'}
                    </h6>
                    <p class="mb-0">${question.explanation}</p>
                `;
                document.getElementById('answer-options').appendChild(explanation);
            }
        }
        
        // Re-enable navigation
        setTimeout(() => {
            const nextBtn = document.getElementById('next-question');
            if (nextBtn) nextBtn.focus();
        }, 100);
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuestions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
        }
    }

    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.currentQuestions.length) * 100;
        document.getElementById('test-progress').style.width = `${progress}%`;
    }

    updateNavigationButtons() {
        const prevButton = document.getElementById('prev-question');
        const nextButton = document.getElementById('next-question');
        const submitButton = document.getElementById('submit-test');
        
        prevButton.style.display = this.currentQuestionIndex === 0 ? 'none' : 'inline-block';
        
        if (this.currentQuestionIndex === this.currentQuestions.length - 1) {
            nextButton.style.display = 'none';
            submitButton.style.display = 'inline-block';
            submitButton.innerHTML = this.isReviewMode ? 
                '<i class="fas fa-chart-bar"></i> Back to Results' : 
                '<i class="fas fa-check"></i> Submit Test';
        } else {
            nextButton.style.display = 'inline-block';
            submitButton.style.display = 'none';
        }
    }

    startTimer(seconds) {
        this.timeRemaining = seconds;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.submitTest();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('time-remaining').textContent = display;
        
        const timerElement = document.getElementById('timer');
        if (this.timeRemaining < 60) {
            timerElement.classList.add('text-danger');
        }
    }

    submitTest() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        if (this.isReviewMode) {
            // Return to results
            this.showResults();
            return;
        }
        
        // Calculate results
        const results = this.calculateResults();
        
        // Save to history
        this.saveTestResults(results);
        
        // Show results
        this.showResults(results);
    }

    calculateResults() {
        let correctAnswers = 0;
        const categoryBreakdown = {};
        const missedQuestions = [];
        
        this.currentQuestions.forEach((question) => {
            const category = question.category || 'General';
            
            if (!categoryBreakdown[category]) {
                categoryBreakdown[category] = { correct: 0, total: 0 };
            }
            categoryBreakdown[category].total++;
            
            if (this.userAnswers[question.id] === question.correct) {
                correctAnswers++;
                categoryBreakdown[category].correct++;
            } else {
                missedQuestions.push(question.id);
            }
        });
        
        const timeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        
        return {
            score: correctAnswers,
            total: this.currentQuestions.length,
            percentage: Math.round((correctAnswers / this.currentQuestions.length) * 100),
            categoryBreakdown,
            missedQuestions,
            timeSeconds
        };
    }

    saveTestResults(results) {
        const testHistory = storage.getValue('testHistory') || [];
        
        const testRecord = {
            id: this.currentTestId,
            date: new Date().toISOString(),
            type: this.testType,
            mode: this.testMode,
            category: this.selectedCategory,
            score: results.score,
            total: results.total,
            percentage: results.percentage,
            timeSeconds: results.timeSeconds,
            categoryBreakdown: results.categoryBreakdown,
            missedQuestions: results.missedQuestions
        };
        
        testHistory.push(testRecord);
        
        // Keep only last 50 tests
        if (testHistory.length > 50) {
            testHistory.shift();
        }
        
        storage.updateData('testHistory', testHistory);
        
        // Update test statistics
        storage.recordTestScore(results.score, results.total, this.testType);
    }

    showResults(results) {
        document.getElementById('test-container').style.display = 'none';
        document.getElementById('test-results').style.display = 'block';
        
        if (!results) {
            // Load from last saved results
            const testHistory = storage.getValue('testHistory') || [];
            const lastTest = testHistory.find(t => t.id === this.currentTestId);
            if (lastTest) {
                results = {
                    score: lastTest.score,
                    total: lastTest.total,
                    percentage: lastTest.percentage,
                    categoryBreakdown: lastTest.categoryBreakdown,
                    missedQuestions: lastTest.missedQuestions,
                    timeSeconds: lastTest.timeSeconds
                };
            }
        }
        
        const resultsContainer = document.getElementById('test-results');
        resultsContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h3>Test Complete!</h3>
                    <div class="my-4">
                        <h1 class="display-1 ${results.percentage >= 80 ? 'text-success' : results.percentage >= 60 ? 'text-warning' : 'text-danger'}">
                            ${results.percentage}%
                        </h1>
                        <p class="lead">You got ${results.score} out of ${results.total} correct</p>
                        <p class="text-muted">Time: ${this.formatTime(results.timeSeconds)}</p>
                    </div>
                    
                    <div class="row mt-4">
                        <div class="col-md-8 mx-auto">
                            <h5>Category Breakdown</h5>
                            <div class="category-results">
                                ${Object.entries(results.categoryBreakdown).map(([cat, stats]) => `
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span>${cat}</span>
                                        <div>
                                            <span class="badge bg-${stats.correct === stats.total ? 'success' : 'warning'}">
                                                ${stats.correct}/${stats.total}
                                            </span>
                                            <span class="text-muted ms-2">
                                                ${Math.round((stats.correct / stats.total) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <button class="btn btn-primary" onclick="testManager.reviewAnswers()">
                            <i class="fas fa-eye"></i> Review Answers
                        </button>
                        <button class="btn btn-success ms-2" onclick="testManager.startNewTest()">
                            <i class="fas fa-redo"></i> New Test
                        </button>
                        ${results.missedQuestions.length > 0 ? `
                            <button class="btn btn-warning ms-2" onclick="testManager.retakeMissedQuestions()">
                                <i class="fas fa-exclamation-circle"></i> Retake Missed (${results.missedQuestions.length})
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    reviewAnswers() {
        this.isReviewMode = true;
        this.currentQuestionIndex = 0;
        this.showTestContainer();
        this.displayQuestion();
    }

    retakeMissedQuestions() {
        const testHistory = storage.getValue('testHistory') || [];
        const lastTest = testHistory.find(t => t.id === this.currentTestId);
        
        if (lastTest && lastTest.missedQuestions.length > 0) {
            this.currentQuestions = this.questions.filter(q => 
                lastTest.missedQuestions.includes(q.id)
            );
            this.testType = 'retake';
            this.currentQuestionIndex = 0;
            this.userAnswers = {};
            this.isReviewMode = false;
            this.startTime = Date.now();
            this.currentTestId = Date.now().toString();
            
            this.showTestContainer();
            this.displayQuestion();
        }
    }

    startNewTest() {
        this.showTestSelection();
    }
}

// Global functions for onclick handlers
function startTest(type) {
    if (!window.testManager) {
        window.testManager = new TestManager();
    }
    window.testManager.showTestSelection();
}

function nextQuestion() {
    if (window.testManager) {
        window.testManager.nextQuestion();
    }
}

function previousQuestion() {
    if (window.testManager) {
        window.testManager.previousQuestion();
    }
}

function submitTest() {
    if (window.testManager) {
        if (window.testManager.isReviewMode) {
            window.testManager.submitTest();
        } else if (confirm('Are you sure you want to submit your test?')) {
            window.testManager.submitTest();
        }
    }
}

// Initialize test manager
document.addEventListener('DOMContentLoaded', () => {
    // Test manager will be initialized when tests section is accessed
});