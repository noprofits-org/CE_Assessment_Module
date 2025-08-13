class StorageManager {
    constructor() {
        this.storageKey = 'ce_housing_assessor';
        this.initializeStorage();
    }

    initializeStorage() {
        if (!localStorage.getItem(this.storageKey)) {
            const initialData = {
                user: {
                    studyStreak: 0,
                    lastStudyDate: null,
                    totalStudyTime: 0,
                    todayStudyTime: 0,
                    studyStartTime: null
                },
                flashcards: {
                    cardsReviewed: 0,
                    cardsMastered: [],
                    lastReviewed: {},
                    currentCardIndex: 0
                },
                tests: {
                    scores: [],
                    testsCompleted: 0,
                    averageScore: 0,
                    questionsAnswered: 0,
                    correctAnswers: 0
                },
                scenarios: {
                    completed: [],
                    currentScenarioIndex: 0
                },
                progress: {
                    totalSessions: 0,
                    studyDates: [],
                    achievements: []
                }
            };
            this.saveData(initialData);
        }
        this.updateStudyStreak();
    }

    getData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {};
        } catch (e) {
            console.error('Error loading data:', e);
            this.initializeStorage();
            return JSON.parse(localStorage.getItem(this.storageKey));
        }
    }

    saveData(data) {
        try {
            const jsonData = JSON.stringify(data);
            localStorage.setItem(this.storageKey, jsonData);
        } catch (e) {
            console.error('Error saving data:', e);
            
            // Handle quota exceeded error
            if (e.name === 'QuotaExceededError' || 
                e.code === 22 || 
                e.code === 1014 || 
                (e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                
                // Notify user about storage issue
                this.handleQuotaExceeded();
                
                // Try to clean up old data
                try {
                    this.cleanupOldData();
                    // Retry saving after cleanup
                    localStorage.setItem(this.storageKey, JSON.stringify(data));
                } catch (retryError) {
                    console.error('Failed to save even after cleanup:', retryError);
                    // Show critical storage error to user
                    this.showStorageError();
                }
            }
        }
    }

    updateData(path, value) {
        try {
            const data = this.getData();
            const keys = path.split('.');
            let current = data;
            
            // Ensure all parent objects exist
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            // Set the final value
            current[keys[keys.length - 1]] = value;
            
            // Save with error handling
            this.saveData(data);
        } catch (e) {
            console.error('Error updating data at path:', path, e);
            // Try to recover by reinitializing if data is corrupted
            if (e.message.includes('Cannot read') || e.message.includes('undefined')) {
                this.initializeStorage();
                // Retry once after reinitialization
                try {
                    const data = this.getData();
                    const keys = path.split('.');
                    let current = data;
                    
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (!current[keys[i]]) {
                            current[keys[i]] = {};
                        }
                        current = current[keys[i]];
                    }
                    
                    current[keys[keys.length - 1]] = value;
                    this.saveData(data);
                } catch (retryError) {
                    console.error('Failed to update data after reinitialization:', retryError);
                }
            }
        }
    }

    getValue(path) {
        const data = this.getData();
        const keys = path.split('.');
        let current = data;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return null;
            }
            current = current[key];
        }
        
        return current;
    }

    incrementValue(path) {
        const currentValue = this.getValue(path) || 0;
        this.updateData(path, currentValue + 1);
    }

    appendToArray(path, value) {
        const currentArray = this.getValue(path) || [];
        currentArray.push(value);
        this.updateData(path, currentArray);
    }

    updateStudyStreak() {
        const data = this.getData();
        const today = new Date().toDateString();
        const lastStudyDate = data.user.lastStudyDate;
        
        if (lastStudyDate) {
            const lastDate = new Date(lastStudyDate);
            const todayDate = new Date();
            const diffTime = todayDate - lastDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                data.user.studyStreak++;
            } else if (diffDays > 1) {
                data.user.studyStreak = 1;
            }
        } else {
            data.user.studyStreak = 1;
        }
        
        if (lastStudyDate !== today) {
            data.user.lastStudyDate = today;
            data.user.todayStudyTime = 0;
            if (!data.progress.studyDates.includes(today)) {
                data.progress.studyDates.push(today);
            }
        }
        
        this.saveData(data);
    }

    startStudySession() {
        const now = Date.now();
        this.updateData('user.studyStartTime', now);
        this.incrementValue('progress.totalSessions');
        
        // Update last active date
        const today = new Date();
        this.updateData('user.lastActive', today.toDateString());
        
        // Update study streak
        this.updateStudyStreak();
        
        // Track daily activity
        this.trackDailyActivity();
    }

    endStudySession() {
        const startTime = this.getValue('user.studyStartTime');
        if (startTime) {
            const sessionTime = Math.floor((Date.now() - startTime) / 1000); // in seconds
            const todayTime = this.getValue('user.todayStudyTime') || 0;
            const totalTime = this.getValue('user.totalStudyTime') || 0;
            
            this.updateData('user.todayStudyTime', todayTime + sessionTime);
            this.updateData('user.totalStudyTime', totalTime + sessionTime);
            this.updateData('user.studyStartTime', null);
        }
    }

    recordFlashcardReview(cardId) {
        this.incrementValue('flashcards.cardsReviewed');
        const lastReviewed = this.getValue('flashcards.lastReviewed') || {};
        lastReviewed[cardId] = Date.now();
        this.updateData('flashcards.lastReviewed', lastReviewed);
    }

    markCardAsMastered(cardId) {
        const mastered = this.getValue('flashcards.cardsMastered') || [];
        if (!mastered.includes(cardId)) {
            this.appendToArray('flashcards.cardsMastered', cardId);
        }
    }

    recordTestScore(score, totalQuestions, testType) {
        const testData = {
            score: score,
            totalQuestions: totalQuestions,
            percentage: Math.round((score / totalQuestions) * 100),
            date: new Date().toISOString(),
            type: testType
        };
        
        this.appendToArray('tests.scores', testData);
        this.incrementValue('tests.testsCompleted');
        
        const scores = this.getValue('tests.scores');
        const avgScore = scores.reduce((sum, test) => sum + test.percentage, 0) / scores.length;
        this.updateData('tests.averageScore', Math.round(avgScore));
        
        this.updateData('tests.questionsAnswered', 
            (this.getValue('tests.questionsAnswered') || 0) + totalQuestions);
        this.updateData('tests.correctAnswers', 
            (this.getValue('tests.correctAnswers') || 0) + score);
    }

    completeScenario(scenarioId) {
        const completed = this.getValue('scenarios.completed') || [];
        if (!completed.includes(scenarioId)) {
            this.appendToArray('scenarios.completed', scenarioId);
        }
    }

    getStatistics() {
        const data = this.getData();
        return {
            studyStreak: data.user.studyStreak || 0,
            cardsReviewed: data.flashcards.cardsReviewed || 0,
            cardsMastered: (data.flashcards.cardsMastered || []).length,
            averageScore: data.tests.averageScore || 0,
            testsCompleted: data.tests.testsCompleted || 0,
            totalStudyTime: data.user.totalStudyTime || 0,
            todayStudyTime: data.user.todayStudyTime || 0,
            totalSessions: data.progress.totalSessions || 0,
            studyDates: data.progress.studyDates || []
        };
    }

    getRecentTestScores(limit = 10) {
        const scores = this.getValue('tests.scores') || [];
        return scores.slice(-limit);
    }

    exportData() {
        const data = this.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ce_housing_assessor_backup_${new Date().toISOString().split('T')[0]}.json`;
        if (document.body) {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.saveData(data);
                location.reload();
            } catch (error) {
                alert('Error importing data. Please check the file format.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            localStorage.removeItem(this.storageKey);
            this.initializeStorage();
            location.reload();
        }
    }

    trackDailyActivity() {
        const today = new Date().toISOString().split('T')[0];
        const dailyStudy = this.getValue('dailyStudy') || {};
        
        if (!dailyStudy[today]) {
            dailyStudy[today] = {
                date: today,
                activityScore: 0,
                flashcardsViewed: 0,
                testsCompleted: 0,
                timeSpent: 0
            };
        }
        
        dailyStudy[today].activityScore++;
        this.updateData('dailyStudy', dailyStudy);
    }

    trackCardView(cardId) {
        const viewData = this.getValue('flashcards.viewData') || {};
        
        if (!viewData[cardId]) {
            viewData[cardId] = {
                firstViewed: new Date().toISOString(),
                lastViewed: new Date().toISOString(),
                timesViewed: 1
            };
        } else {
            viewData[cardId].lastViewed = new Date().toISOString();
            viewData[cardId].timesViewed++;
        }
        
        this.updateData('flashcards.viewData', viewData);
        
        // Update daily activity
        const today = new Date().toISOString().split('T')[0];
        const dailyStudy = this.getValue('dailyStudy') || {};
        if (dailyStudy[today]) {
            dailyStudy[today].flashcardsViewed++;
            dailyStudy[today].activityScore += 2;
            this.updateData('dailyStudy', dailyStudy);
        }
    }

    // Handle quota exceeded error
    handleQuotaExceeded() {
        // Check if storage monitor is available
        if (window.storageMonitor) {
            // Show storage warning
            const status = storageMonitor.checkStorageStatus();
            
            const notification = document.createElement('div');
            notification.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
            notification.style.zIndex = '9999';
            notification.innerHTML = `
                <strong>Storage Full!</strong> Your browser storage is full. 
                ${status.formattedSize} used of ${status.formattedMaxSize}.
                <button type="button" class="btn btn-sm btn-warning ms-2" onclick="storageMonitor.showStorageUI()">
                    Manage Storage
                </button>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            if (document.body) {
                document.body.appendChild(notification);
            }
            
            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                notification.remove();
            }, 10000);
        }
    }

    // Clean up old data automatically
    cleanupOldData() {
        const data = this.getData();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Clean old test scores
        if (data.tests && data.tests.scores) {
            data.tests.scores = data.tests.scores.filter(score => {
                return new Date(score.date) > thirtyDaysAgo;
            });
        }
        
        // Clean old daily study data
        if (data.dailyStudy) {
            const newDailyStudy = {};
            Object.keys(data.dailyStudy).forEach(date => {
                if (new Date(date) > thirtyDaysAgo) {
                    newDailyStudy[date] = data.dailyStudy[date];
                }
            });
            data.dailyStudy = newDailyStudy;
        }
        
        // Clean old study dates
        if (data.progress && data.progress.studyDates) {
            data.progress.studyDates = data.progress.studyDates.filter(date => {
                return new Date(date) > thirtyDaysAgo;
            });
        }
        
        // Save cleaned data (without recursive error handling)
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            // If still failing, we need more aggressive cleanup
            throw e;
        }
    }

    // Show critical storage error
    showStorageError() {
        const modal = document.createElement('div');
        modal.className = 'modal fade show d-block';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Critical Storage Error</h5>
                    </div>
                    <div class="modal-body">
                        <p>Unable to save your progress due to storage limitations.</p>
                        <p>Please take one of the following actions:</p>
                        <ul>
                            <li>Export your data to save it externally</li>
                            <li>Clear browser data for other sites</li>
                            <li>Use a different browser with more storage</li>
                        </ul>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="storage.exportAllData()">
                            Export Data
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        if (document.body) {
            document.body.appendChild(modal);
        }
    }

    // Export all data
    exportAllData() {
        const data = this.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ce-study-data-${new Date().toISOString().split('T')[0]}.json`;
        if (document.body) {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
    }
}

// Create global instance
const storage = new StorageManager();