class GamificationManager {
    constructor() {
        this.storageKey = 'ce_housing_gamification';
        this.achievements = {
            first_steps: {
                id: 'first_steps',
                name: 'First Steps',
                description: 'Complete first flashcard review',
                icon: 'fa-shoe-prints',
                points: 10,
                condition: () => this.getStats().flashcardsReviewed >= 1
            },
            dedicated_learner: {
                id: 'dedicated_learner',
                name: 'Dedicated Learner',
                description: '7-day study streak',
                icon: 'fa-fire',
                points: 50,
                condition: () => this.getStudyStreak() >= 7
            },
            category_master: {
                id: 'category_master',
                name: 'Category Master',
                description: '90%+ average in any category',
                icon: 'fa-crown',
                points: 100,
                condition: () => this.hasCategoryMastery()
            },
            perfect_score: {
                id: 'perfect_score',
                name: 'Perfect Score',
                description: '100% on any test',
                icon: 'fa-star',
                points: 75,
                condition: () => this.hasPerfectScore()
            },
            night_owl: {
                id: 'night_owl',
                name: 'Night Owl',
                description: 'Study after 10 PM',
                icon: 'fa-moon',
                points: 25,
                condition: () => this.hasStudiedAtNight()
            },
            early_bird: {
                id: 'early_bird',
                name: 'Early Bird',
                description: 'Study before 7 AM',
                icon: 'fa-sun',
                points: 25,
                condition: () => this.hasStudiedEarly()
            }
        };

        this.dailyChallenges = [
            {
                id: 'review_20',
                name: 'Review 20 flashcards',
                description: 'Review at least 20 flashcards today',
                points: 15,
                icon: 'fa-layer-group',
                check: (daily) => daily.flashcardsReviewed >= 20
            },
            {
                id: 'score_80',
                name: 'Score 80% on a practice test',
                description: 'Score 80% or higher on any practice test',
                points: 20,
                icon: 'fa-bullseye',
                check: (daily) => daily.bestTestScore >= 80
            },
            {
                id: 'eligibility_study',
                name: 'Study all Eligibility terms',
                description: 'Review all flashcards in the Eligibility category',
                points: 25,
                icon: 'fa-check-circle',
                check: (daily) => daily.categoriesStudied?.includes('Eligibility')
            },
            {
                id: 'complete_3_scenarios',
                name: 'Complete 3 scenario practices',
                description: 'Complete at least 3 scenario practices',
                points: 20,
                icon: 'fa-clipboard-check',
                check: (daily) => daily.scenariosCompleted >= 3
            },
            {
                id: 'study_30_min',
                name: 'Study for 30 minutes',
                description: 'Study for at least 30 minutes today',
                points: 15,
                icon: 'fa-clock',
                check: (daily) => daily.studyTime >= 1800
            },
            {
                id: 'perfect_category_test',
                name: 'Perfect category test',
                description: 'Score 100% on any category test',
                points: 30,
                icon: 'fa-trophy',
                check: (daily) => daily.perfectCategoryTest
            },
            {
                id: 'review_all_types',
                name: 'Review all housing types',
                description: 'Review all flashcards in Housing Types category',
                points: 25,
                icon: 'fa-home',
                check: (daily) => daily.categoriesStudied?.includes('Housing Types')
            }
        ];

        this.levelThresholds = [
            { level: 1, points: 0, name: 'Novice' },
            { level: 2, points: 100, name: 'Apprentice' },
            { level: 3, points: 250, name: 'Student' },
            { level: 4, points: 500, name: 'Scholar' },
            { level: 5, points: 1000, name: 'Expert' },
            { level: 6, points: 2000, name: 'Master' },
            { level: 7, points: 3500, name: 'Specialist' },
            { level: 8, points: 5000, name: 'Authority' },
            { level: 9, points: 7500, name: 'Champion' },
            { level: 10, points: 10000, name: 'Legend' }
        ];

        this.initializeData();
    }

    initializeData() {
        const data = this.getData();
        if (!data.achievements) data.achievements = {};
        if (!data.points) data.points = 0;
        if (!data.level) data.level = 1;
        if (!data.dailyChallenges) data.dailyChallenges = {};
        if (!data.dailyStats) data.dailyStats = {};
        if (!data.studyTimes) data.studyTimes = [];
        this.saveData(data);
    }

    getData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {};
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    getMainData() {
        const mainData = localStorage.getItem('ce_housing_assessor');
        return mainData ? JSON.parse(mainData) : {};
    }

    getStats() {
        const mainData = this.getMainData();
        return {
            flashcardsReviewed: mainData.flashcards?.cardsReviewed?.length || 0,
            testScores: mainData.tests?.scores || [],
            studyStreak: mainData.userData?.studyStreak || 0,
            categoriesData: this.getCategoriesData()
        };
    }

    getCategoriesData() {
        const mainData = this.getMainData();
        const categories = {};
        
        if (mainData.tests?.scores) {
            mainData.tests.scores.forEach(score => {
                if (score.category && score.category !== 'all') {
                    if (!categories[score.category]) {
                        categories[score.category] = { scores: [], average: 0 };
                    }
                    categories[score.category].scores.push(score.score);
                }
            });
        }

        Object.keys(categories).forEach(cat => {
            const scores = categories[cat].scores;
            categories[cat].average = scores.reduce((a, b) => a + b, 0) / scores.length;
        });

        return categories;
    }

    getStudyStreak() {
        const mainData = this.getMainData();
        return mainData.userData?.studyStreak || 0;
    }

    hasCategoryMastery() {
        const categories = this.getCategoriesData();
        return Object.values(categories).some(cat => cat.average >= 90);
    }

    hasPerfectScore() {
        const stats = this.getStats();
        return stats.testScores.some(score => score.score === 100);
    }

    hasStudiedAtNight() {
        const data = this.getData();
        return data.studyTimes?.some(time => {
            const hour = new Date(time).getHours();
            return hour >= 22;
        });
    }

    hasStudiedEarly() {
        const data = this.getData();
        return data.studyTimes?.some(time => {
            const hour = new Date(time).getHours();
            return hour < 7;
        });
    }

    recordStudyTime() {
        const data = this.getData();
        if (!data.studyTimes) data.studyTimes = [];
        data.studyTimes.push(new Date().toISOString());
        
        if (data.studyTimes.length > 100) {
            data.studyTimes = data.studyTimes.slice(-100);
        }
        
        this.saveData(data);
    }

    checkAchievements() {
        const data = this.getData();
        const newAchievements = [];

        Object.values(this.achievements).forEach(achievement => {
            if (!data.achievements[achievement.id] && achievement.condition()) {
                data.achievements[achievement.id] = {
                    unlockedAt: new Date().toISOString(),
                    points: achievement.points
                };
                data.points = (data.points || 0) + achievement.points;
                newAchievements.push(achievement);
            }
        });

        if (newAchievements.length > 0) {
            this.updateLevel(data);
            this.saveData(data);
        }

        return newAchievements;
    }

    updateLevel(data) {
        const points = data.points || 0;
        let newLevel = 1;
        
        for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
            if (points >= this.levelThresholds[i].points) {
                newLevel = this.levelThresholds[i].level;
                break;
            }
        }

        if (newLevel > (data.level || 1)) {
            data.level = newLevel;
            return true;
        }
        return false;
    }

    addPoints(points, reason) {
        const data = this.getData();
        data.points = (data.points || 0) + points;
        
        if (!data.pointsHistory) data.pointsHistory = [];
        data.pointsHistory.push({
            points,
            reason,
            timestamp: new Date().toISOString()
        });

        if (data.pointsHistory.length > 100) {
            data.pointsHistory = data.pointsHistory.slice(-100);
        }

        const leveledUp = this.updateLevel(data);
        this.saveData(data);

        return { leveledUp, newLevel: data.level };
    }

    getDailyChallenge() {
        const today = new Date().toDateString();
        const dayIndex = new Date().getDay();
        const challengeIndex = dayIndex % this.dailyChallenges.length;
        return this.dailyChallenges[challengeIndex];
    }

    updateDailyStats(stats) {
        const data = this.getData();
        const today = new Date().toDateString();
        
        if (!data.dailyStats[today]) {
            data.dailyStats[today] = {
                flashcardsReviewed: 0,
                bestTestScore: 0,
                categoriesStudied: [],
                scenariosCompleted: 0,
                studyTime: 0,
                perfectCategoryTest: false
            };
        }

        Object.assign(data.dailyStats[today], stats);
        this.saveData(data);

        const challenge = this.getDailyChallenge();
        if (!data.dailyChallenges[today] && challenge.check(data.dailyStats[today])) {
            data.dailyChallenges[today] = {
                completed: true,
                challengeId: challenge.id,
                completedAt: new Date().toISOString()
            };
            this.addPoints(challenge.points, `Daily Challenge: ${challenge.name}`);
            return challenge;
        }

        return null;
    }

    getLevel() {
        const data = this.getData();
        const points = data.points || 0;
        const currentLevel = this.levelThresholds.find(l => l.level === (data.level || 1));
        const nextLevel = this.levelThresholds.find(l => l.level === (data.level || 1) + 1);

        return {
            level: data.level || 1,
            points,
            levelName: currentLevel?.name || 'Novice',
            nextLevelPoints: nextLevel?.points || points,
            progress: nextLevel ? ((points - currentLevel.points) / (nextLevel.points - currentLevel.points)) * 100 : 100
        };
    }

    getUnlockedAchievements() {
        const data = this.getData();
        return Object.keys(data.achievements || {}).map(id => ({
            ...this.achievements[id],
            unlockedAt: data.achievements[id].unlockedAt
        }));
    }

    getAllAchievements() {
        const data = this.getData();
        return Object.values(this.achievements).map(achievement => ({
            ...achievement,
            unlocked: !!data.achievements[achievement.id],
            unlockedAt: data.achievements[achievement.id]?.unlockedAt
        }));
    }

    getTodayChallenge() {
        const challenge = this.getDailyChallenge();
        const data = this.getData();
        const today = new Date().toDateString();
        const completed = !!data.dailyChallenges[today];

        return {
            ...challenge,
            completed,
            progress: this.getDailyChallengeProgress(challenge)
        };
    }

    getDailyChallengeProgress(challenge) {
        const data = this.getData();
        const today = new Date().toDateString();
        const dailyStats = data.dailyStats[today] || {};

        switch (challenge.id) {
            case 'review_20':
                return Math.min((dailyStats.flashcardsReviewed || 0) / 20 * 100, 100);
            case 'score_80':
                return dailyStats.bestTestScore >= 80 ? 100 : (dailyStats.bestTestScore || 0) / 80 * 100;
            case 'eligibility_study':
                return dailyStats.categoriesStudied?.includes('Eligibility') ? 100 : 0;
            case 'complete_3_scenarios':
                return Math.min((dailyStats.scenariosCompleted || 0) / 3 * 100, 100);
            case 'study_30_min':
                return Math.min((dailyStats.studyTime || 0) / 1800 * 100, 100);
            case 'perfect_category_test':
                return dailyStats.perfectCategoryTest ? 100 : 0;
            case 'review_all_types':
                return dailyStats.categoriesStudied?.includes('Housing Types') ? 100 : 0;
            default:
                return 0;
        }
    }

    reset() {
        if (confirm('This will reset all gamification data including achievements, points, and challenges. Continue?')) {
            localStorage.removeItem(this.storageKey);
            this.initializeData();
            return true;
        }
        return false;
    }
}

const gamificationManager = new GamificationManager();

function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-content">
            <i class="fas ${achievement.icon} achievement-icon"></i>
            <div>
                <h5>Achievement Unlocked!</h5>
                <p>${achievement.name}</p>
                <small>+${achievement.points} points</small>
            </div>
        </div>
    `;
    
    if (document.body) {
        document.body.appendChild(notification);
    }
    
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLevelUpNotification(level, levelName) {
    const notification = document.createElement('div');
    notification.className = 'levelup-notification';
    notification.innerHTML = `
        <div class="levelup-content">
            <i class="fas fa-level-up-alt levelup-icon"></i>
            <div>
                <h4>Level Up!</h4>
                <p>You've reached Level ${level}</p>
                <strong>${levelName}</strong>
            </div>
        </div>
    `;
    
    if (document.body) {
        document.body.appendChild(notification);
    }
    
    confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FF6347']
    });
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showChallengeCompleteNotification(challenge) {
    const notification = document.createElement('div');
    notification.className = 'challenge-notification';
    notification.innerHTML = `
        <div class="challenge-content">
            <i class="fas ${challenge.icon} challenge-icon"></i>
            <div>
                <h5>Daily Challenge Complete!</h5>
                <p>${challenge.name}</p>
                <small>+${challenge.points} points</small>
            </div>
        </div>
    `;
    
    if (document.body) {
        document.body.appendChild(notification);
    }
    
    confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.7 }
    });
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

window.GamificationManager = GamificationManager;
window.gamificationManager = gamificationManager;
window.showAchievementNotification = showAchievementNotification;
window.showLevelUpNotification = showLevelUpNotification;
window.showChallengeCompleteNotification = showChallengeCompleteNotification;