class FlashcardManager {
    constructor() {
        this.cards = [];
        this.filteredCards = [];
        this.currentIndex = 0;
        this.isFlipped = false;
        this.categories = [];
        this.mode = 'all'; // 'all', 'testPrep', 'category'
        this.isShuffled = false;
        this.selectedCategory = '';
        this.eventHandlers = {}; // Store event handler references
        this.keyboardHandler = null; // Store keyboard handler reference
        this.isInitialized = false;
        this.loadCards();
    }

    async loadCards() {
        try {
            const response = await fetch('data/terms.json');
            const data = await response.json();
            this.cards = data.terms;
            this.categories = data.categories || [];
            this.filteredCards = [...this.cards];
            
            // Load saved preferences
            const savedPrefs = storage.getValue('flashcards.preferences') || {};
            this.mode = savedPrefs.mode || 'all';
            this.isShuffled = savedPrefs.isShuffled || false;
            this.selectedCategory = savedPrefs.selectedCategory || '';
            
            this.applyFilters();
            this.currentIndex = storage.getValue('flashcards.currentCardIndex') || 0;
            this.displayCard();
            this.updateUI();
            
            // Initialize event listeners after cards are loaded
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                this.initializeEventListeners();
            }, 100);
        } catch (error) {
            console.error('Error loading flashcards:', error);
            this.displayError();
        }
    }

    initializeEventListeners() {
        
        // Remove any existing keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        // Create keyboard handler
        this.keyboardHandler = (event) => {
            const flashcardsSection = document.getElementById('flashcards');
            if (flashcardsSection && flashcardsSection.classList.contains('active')) {
                this.handleKeyPress(event);
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);

        // Attach static button handlers (these don't change)
        this.attachStaticHandlers();
        this.isInitialized = true;
    }
    
    // Method to ensure handlers are attached when section is shown
    ensureInitialized() {
        if (!this.isInitialized) {
            this.initializeEventListeners();
        }
    }

    attachStaticHandlers() {
        // Card navigation - these elements don't get recreated
        const flipBtn = document.getElementById('flip-card');
        const nextBtn = document.getElementById('next-card');
        const prevBtn = document.getElementById('prev-card');
        const flashcard = document.getElementById('flashcard');
        const masterBtn = document.getElementById('master-card');

        // Remove existing handlers if they exist
        if (this.eventHandlers.flip) {
            flipBtn?.removeEventListener('click', this.eventHandlers.flip);
            flashcard?.removeEventListener('click', this.eventHandlers.flip);
            flashcard?.removeEventListener('touchend', this.eventHandlers.flipTouch);
        }
        if (this.eventHandlers.next) {
            nextBtn?.removeEventListener('click', this.eventHandlers.next);
        }
        if (this.eventHandlers.prev) {
            prevBtn?.removeEventListener('click', this.eventHandlers.prev);
        }
        if (this.eventHandlers.master) {
            masterBtn?.removeEventListener('click', this.eventHandlers.master);
        }

        // Create and store new handlers
        this.eventHandlers.flip = this.flipCard.bind(this);
        this.eventHandlers.flipTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.flipCard();
        };
        this.eventHandlers.next = this.nextCard.bind(this);
        this.eventHandlers.prev = this.previousCard.bind(this);
        this.eventHandlers.master = this.markAsMastered.bind(this);

        // Attach new handlers with passive: true for better touch performance
        if (flipBtn) {
            flipBtn.addEventListener('click', this.eventHandlers.flip, { passive: true });
        }
        if (nextBtn) nextBtn.addEventListener('click', this.eventHandlers.next, { passive: true });
        if (prevBtn) prevBtn.addEventListener('click', this.eventHandlers.prev, { passive: true });
        if (flashcard) {
            // Add both click and touch events for flashcard
            flashcard.addEventListener('click', this.eventHandlers.flip, { passive: true });
            // Add touch support for mobile
            flashcard.addEventListener('touchend', this.eventHandlers.flipTouch, { passive: false });
        }
        if (masterBtn) masterBtn.addEventListener('click', this.eventHandlers.master, { passive: true });
    }

    attachDynamicHandlers() {
        // These handlers are for dynamically created elements
        // Mode selector
        const modeButtons = document.querySelectorAll('[data-mode]');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.target.dataset.mode);
            }, { passive: true });
        });

        // Shuffle toggle
        const shuffleBtn = document.getElementById('shuffle-toggle');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle(), { passive: true });
        }

        // Category filter
        const categorySelect = document.getElementById('category-select');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.filterByCategory(e.target.value);
            }, { passive: true });
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.savePreferences();
        this.applyFilters();
        this.currentIndex = 0;
        this.displayCard();
        this.updateUI();
    }

    applyFilters() {
        let filtered = [...this.cards];

        // Apply mode filter
        if (this.mode === 'testPrep') {
            filtered = this.getTestPrepCards();
        } else if (this.mode === 'category' && this.selectedCategory) {
            filtered = filtered.filter(card => card.category === this.selectedCategory);
        }

        // Apply shuffle if enabled
        if (this.isShuffled) {
            filtered = this.shuffleArray(filtered);
        }

        this.filteredCards = filtered;
    }

    getTestPrepCards() {
        return this.cards.filter(card => {
            // Check if marked as test relevant
            if (card.testRelevant) return true;

            // Check for numbers (days, hours, percentages)
            const hasNumbers = /\d+\s*(days?|hours?|minutes?|months?|years?|%|percent)/i.test(card.definition);
            
            // Check for important keywords
            const keywords = ['eligible', 'required', 'must', 'minimum', 'maximum', 'within', 'at least', 'no more than', 'under', 'over'];
            const hasKeywords = keywords.some(keyword => 
                card.definition.toLowerCase().includes(keyword) || 
                card.term.toLowerCase().includes(keyword)
            );

            return hasNumbers || hasKeywords;
        });
    }

    filterByCategory(category) {
        this.selectedCategory = category;
        this.mode = category ? 'category' : 'all';
        this.savePreferences();
        this.applyFilters();
        this.currentIndex = 0;
        this.displayCard();
        this.updateUI();
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        this.savePreferences();
        this.applyFilters();
        this.currentIndex = 0;
        this.displayCard();
        this.updateUI();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    displayCard() {
        if (this.filteredCards.length === 0) {
            this.displayNoCards();
            return;
        }

        // Ensure index is within bounds
        if (this.currentIndex >= this.filteredCards.length) {
            this.currentIndex = 0;
        }

        const card = this.filteredCards[this.currentIndex];
        const termElement = document.getElementById('flashcard-term');
        const definitionElement = document.getElementById('flashcard-definition');
        
        if (termElement && definitionElement && card) {
            termElement.textContent = card.term;
            definitionElement.innerHTML = this.formatDefinition(card.definition);
            
            // Reset flip state
            this.isFlipped = false;
            const flashcardElement = document.getElementById('flashcard');
            if (flashcardElement) {
                flashcardElement.classList.remove('flipped');
                
                // Re-attach handlers if needed (in case DOM was recreated)
                if (this.isInitialized) {
                    setTimeout(() => {
                        this.attachStaticHandlers();
                    }, 50);
                }
            }
            
            // Track view
            this.trackCardView(card.id);
            
            // Update mastered status
            this.updateMasteredStatus(card.id);
        }
        
        this.updateProgress();
        this.updateNavigationButtons();
        this.saveCurrentIndex();
    }

    formatDefinition(definition) {
        // Highlight important numbers and keywords
        let formatted = definition;
        
        // Highlight numbers with units
        formatted = formatted.replace(/(\d+)\s*(days?|hours?|minutes?|months?|years?|%|percent)/gi, 
            '<span class="badge bg-warning text-dark">$1 $2</span>');
        
        // Highlight key terms
        const keywords = ['must', 'required', 'eligible', 'minimum', 'maximum'];
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
            formatted = formatted.replace(regex, '<strong class="text-primary">$1</strong>');
        });
        
        // Format numbered lists
        formatted = formatted.replace(/(\d+)\.\s/g, '<br><strong>$1.</strong> ');
        
        return formatted;
    }

    trackCardView(cardId) {
        const viewData = storage.getValue('flashcards.viewData') || {};
        
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
        
        storage.updateData('flashcards.viewData', viewData);
        
        // Update daily study tracking
        this.updateDailyStudy();
        
        // Calculate and update readiness score
        this.updateReadinessScore();
        
        // Gamification: Track flashcard review
        if (window.gamificationManager) {
            gamificationManager.recordStudyTime();
            gamificationManager.addPoints(1, 'Reviewed flashcard');
            
            // Update daily stats for challenges
            const stats = {
                flashcardsReviewed: storage.getValue('flashcards.cardsReviewed')?.length || 0
            };
            
            // Check if studying a specific category
            const currentCard = this.filteredCards[this.currentIndex];
            if (currentCard && this.mode === 'category') {
                const dailyStats = gamificationManager.getData().dailyStats[new Date().toDateString()] || {};
                const categoriesStudied = dailyStats.categoriesStudied || [];
                if (!categoriesStudied.includes(currentCard.category)) {
                    categoriesStudied.push(currentCard.category);
                    stats.categoriesStudied = categoriesStudied;
                }
            }
            
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

    updateDailyStudy() {
        const today = new Date().toDateString();
        const dailyStudy = storage.getValue('dailyStudy') || {};
        
        if (!dailyStudy[today]) {
            dailyStudy[today] = {
                flashcardsViewed: 0,
                uniqueTermsViewed: new Set(),
                studyTime: 0
            };
        }
        
        dailyStudy[today].flashcardsViewed++;
        storage.updateData('dailyStudy', dailyStudy);
    }

    updateReadinessScore() {
        const viewData = storage.getValue('flashcards.viewData') || {};
        const totalCards = this.cards.length;
        const viewedCards = Object.keys(viewData).length;
        
        // Calculate average views per card
        let totalViews = 0;
        let recentlyViewed = 0;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        Object.values(viewData).forEach(data => {
            totalViews += data.timesViewed;
            if (new Date(data.lastViewed) > oneWeekAgo) {
                recentlyViewed++;
            }
        });
        
        const coverageScore = (viewedCards / totalCards) * 100;
        const repetitionScore = Math.min((totalViews / (totalCards * 3)) * 100, 100);
        const recencyScore = (recentlyViewed / totalCards) * 100;
        
        const readinessScore = Math.round((coverageScore * 0.4 + repetitionScore * 0.3 + recencyScore * 0.3));
        
        storage.updateData('flashcards.readinessScore', readinessScore);
        
        // Update UI if readiness element exists
        const readinessElement = document.getElementById('flashcard-readiness');
        if (readinessElement) {
            readinessElement.textContent = `${readinessScore}%`;
            readinessElement.className = `badge bg-${readinessScore >= 80 ? 'success' : readinessScore >= 60 ? 'warning' : 'danger'}`;
        }
    }

    flipCard() {
        const flashcardElement = document.getElementById('flashcard');
        if (flashcardElement) {
            this.isFlipped = !this.isFlipped;
            flashcardElement.classList.toggle('flipped');
        }
    }

    nextCard() {
        if (this.currentIndex < this.filteredCards.length - 1) {
            this.currentIndex++;
            this.displayCard();
        } else if (this.filteredCards.length > 0) {
            // Loop back to beginning
            this.currentIndex = 0;
            this.displayCard();
        }
    }

    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCard();
        } else if (this.filteredCards.length > 0) {
            // Loop to end
            this.currentIndex = this.filteredCards.length - 1;
            this.displayCard();
        }
    }

    markAsMastered() {
        if (this.filteredCards.length === 0) return;
        
        const card = this.filteredCards[this.currentIndex];
        storage.markCardAsMastered(card.id);
        
        // Visual feedback
        const flashcardElement = document.getElementById('flashcard');
        if (flashcardElement) {
            flashcardElement.classList.add('mastered');
            setTimeout(() => {
                flashcardElement.classList.remove('mastered');
                this.nextCard();
            }, 500);
        }
        
        // Gamification: Award points for mastering a card
        if (window.gamificationManager) {
            gamificationManager.addPoints(5, 'Mastered flashcard');
        }
        
        this.updateMasteredStatus(card.id);
    }

    updateMasteredStatus(cardId) {
        const mastered = storage.getValue('flashcards.cardsMastered') || [];
        const masterBtn = document.getElementById('master-card');
        
        if (masterBtn) {
            if (mastered.includes(cardId)) {
                masterBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mastered';
                masterBtn.classList.add('btn-success');
                masterBtn.classList.remove('btn-outline-success');
            } else {
                masterBtn.innerHTML = '<i class="fas fa-graduation-cap"></i> Mark as Mastered';
                masterBtn.classList.remove('btn-success');
                masterBtn.classList.add('btn-outline-success');
            }
        }
    }

    updateProgress() {
        const progressBar = document.getElementById('flashcard-progress');
        const currentCardSpan = document.getElementById('current-card');
        const totalCardsSpan = document.getElementById('total-cards');
        
        if (progressBar && this.filteredCards.length > 0) {
            const progress = ((this.currentIndex + 1) / this.filteredCards.length) * 100;
            progressBar.style.width = `${progress}%`;
        }
        
        if (currentCardSpan) {
            currentCardSpan.textContent = this.filteredCards.length > 0 ? this.currentIndex + 1 : 0;
        }
        
        if (totalCardsSpan) {
            totalCardsSpan.textContent = this.filteredCards.length;
        }
    }

    updateNavigationButtons() {
        const prevButton = document.getElementById('prev-card');
        const nextButton = document.getElementById('next-card');
        
        if (prevButton) {
            prevButton.disabled = this.filteredCards.length === 0;
        }
        
        if (nextButton) {
            nextButton.disabled = this.filteredCards.length === 0;
        }
    }

    updateUI() {
        // Update mode buttons
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.mode);
        });

        // Update shuffle button
        const shuffleBtn = document.getElementById('shuffle-toggle');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', this.isShuffled);
            shuffleBtn.innerHTML = this.isShuffled ? 
                '<i class="fas fa-random"></i> Shuffled' : 
                '<i class="fas fa-sort"></i> Ordered';
        }

        // Update category filter
        this.updateCategoryFilter();

        // Update stats
        this.updateStats();
    }

    updateCategoryFilter() {
        const filterContainer = document.getElementById('category-filter');
        if (filterContainer && this.categories.length > 0) {
            let html = `
                <div class="btn-group mb-3" role="group">
                    <button class="btn btn-sm ${this.mode === 'all' ? 'btn-primary' : 'btn-outline-primary'}" data-mode="all">
                        <i class="fas fa-list"></i> All Cards
                    </button>
                    <button class="btn btn-sm ${this.mode === 'testPrep' ? 'btn-primary' : 'btn-outline-primary'}" data-mode="testPrep">
                        <i class="fas fa-graduation-cap"></i> Test Prep Mode
                    </button>
                </div>
                <div class="d-inline-block ms-3">
                    <select class="form-select form-select-sm" id="category-select">
                        <option value="">Filter by Category</option>
            `;
            
            this.categories.forEach(cat => {
                html += `<option value="${cat}" ${this.selectedCategory === cat ? 'selected' : ''}>${cat}</option>`;
            });
            
            html += `
                    </select>
                </div>
                <button class="btn btn-sm ${this.isShuffled ? 'btn-warning' : 'btn-outline-warning'} ms-3" id="shuffle-toggle">
                    <i class="fas fa-random"></i> Shuffle
                </button>
            `;
            
            filterContainer.innerHTML = html;
            
            // Only attach dynamic handlers for newly created elements
            this.attachDynamicHandlers();
        }
    }

    updateStats() {
        const viewData = storage.getValue('flashcards.viewData') || {};
        const mastered = storage.getValue('flashcards.cardsMastered') || [];
        
        // Count unique viewed cards
        const viewedCount = Object.keys(viewData).length;
        const masteredCount = mastered.length;
        const totalCount = this.cards.length;
        
        // Update stats display
        const statsContainer = document.getElementById('flashcard-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="row text-center mb-3">
                    <div class="col-4">
                        <div class="stat-box">
                            <h5>${viewedCount}/${totalCount}</h5>
                            <small class="text-muted">Cards Viewed</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="stat-box">
                            <h5>${masteredCount}</h5>
                            <small class="text-muted">Mastered</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="stat-box">
                            <h5 id="flashcard-readiness">0%</h5>
                            <small class="text-muted">Readiness</small>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.updateReadinessScore();
    }

    savePreferences() {
        const prefs = {
            mode: this.mode,
            isShuffled: this.isShuffled,
            selectedCategory: this.selectedCategory
        };
        storage.updateData('flashcards.preferences', prefs);
    }

    saveCurrentIndex() {
        storage.updateData('flashcards.currentCardIndex', this.currentIndex);
    }

    displayNoCards() {
        const termElement = document.getElementById('flashcard-term');
        const definitionElement = document.getElementById('flashcard-definition');
        
        if (termElement) {
            termElement.textContent = 'No cards available';
        }
        if (definitionElement) {
            definitionElement.textContent = 'Try adjusting your filters or selecting a different mode.';
        }
    }

    displayError() {
        const termElement = document.getElementById('flashcard-term');
        const definitionElement = document.getElementById('flashcard-definition');
        
        if (termElement) {
            termElement.textContent = 'Error Loading Cards';
        }
        if (definitionElement) {
            definitionElement.textContent = 'Please check your internet connection and try again.';
        }
    }

    resetDeck() {
        this.currentIndex = 0;
        this.applyFilters();
        this.displayCard();
    }

    handleKeyPress(event) {
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousCard();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextCard();
                break;
            case ' ':
            case 'Enter':
                event.preventDefault();
                this.flipCard();
                break;
            case 'm':
            case 'M':
                event.preventDefault();
                this.markAsMastered();
                break;
            case 'r':
            case 'R':
                event.preventDefault();
                this.resetDeck();
                break;
            case 's':
            case 'S':
                event.preventDefault();
                this.toggleShuffle();
                break;
        }
    }

    searchAndDisplayTerm(searchTerm) {
        // Find the card with matching term or keywords
        const foundIndex = this.cards.findIndex(card => 
            card.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (card.keywords && card.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase())))
        );
        
        if (foundIndex !== -1) {
            // Reset filters to show all cards
            this.mode = 'all';
            this.selectedCategory = '';
            this.applyFilters();
            
            // Find the index in the filtered cards
            const filteredIndex = this.filteredCards.findIndex(card => card.id === this.cards[foundIndex].id);
            if (filteredIndex !== -1) {
                this.currentIndex = filteredIndex;
                this.displayCard();
                this.updateUI();
            }
        }
    }

    // Cleanup method to remove all event listeners
    cleanup() {
        // Remove keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }

        // Remove static handlers
        const flipBtn = document.getElementById('flip-card');
        const nextBtn = document.getElementById('next-card');
        const prevBtn = document.getElementById('prev-card');
        const flashcard = document.getElementById('flashcard');
        const masterBtn = document.getElementById('master-card');

        if (this.eventHandlers.flip) {
            flipBtn?.removeEventListener('click', this.eventHandlers.flip);
            flashcard?.removeEventListener('click', this.eventHandlers.flip);
            flashcard?.removeEventListener('touchend', this.eventHandlers.flipTouch);
        }
        if (this.eventHandlers.next) {
            nextBtn?.removeEventListener('click', this.eventHandlers.next);
        }
        if (this.eventHandlers.prev) {
            prevBtn?.removeEventListener('click', this.eventHandlers.prev);
        }
        if (this.eventHandlers.master) {
            masterBtn?.removeEventListener('click', this.eventHandlers.master);
        }

        // Clear handlers object
        this.eventHandlers = {};
    }
}

// Initialize flashcard manager when DOM is ready
let flashcardManager;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize when flashcards section becomes active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const flashcardsSection = document.getElementById('flashcards');
                if (flashcardsSection) {
                    if (flashcardsSection.classList.contains('active')) {
                        // Create manager if it doesn't exist
                        if (!flashcardManager) {
                            flashcardManager = new FlashcardManager();
                        }
                    } else {
                        // Cleanup when section becomes inactive
                        if (flashcardManager) {
                            flashcardManager.cleanup();
                            flashcardManager = null;
                        }
                    }
                }
            }
        });
    });

    const flashcardsSection = document.getElementById('flashcards');
    if (flashcardsSection) {
        observer.observe(flashcardsSection, { attributes: true });
    }
    
    // Listen for search events from scenarios
    document.addEventListener('searchFlashcards', (e) => {
        if (e.detail && e.detail.searchTerm && flashcardManager) {
            flashcardManager.searchAndDisplayTerm(e.detail.searchTerm);
        }
    });
});