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
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving data:', e);
        }
    }

    updateData(path, value) {
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
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
}

// Create global instance
const storage = new StorageManager();