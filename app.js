class TodayTodo {
    constructor() {
        this.tasks = [];
        this.settings = {
            resetTime: '04:00',
            roundDuration: false,
            sortMode: 'creation',
            locationAccess: false,
            autoAddEmojis: true,
            showAwakeTime: false
        };
        this.userLocation = null; // Will store {lat, lng} coordinates
        this.lastResetTime = new Date();
        this.sortMode = 'creation'; // 'creation' or 'duration'
        this.currentEditingTaskId = null;
        this.longPressTriggered = false; // Track if settings button long press triggered
        this.selectedDuration = null; // Track selected duration from pills (in minutes)
        this.deletedTask = null; // Store deleted task for undo
        this.undoTimeout = null; // Timer for clearing deleted task
        this.draggedTaskId = null; // Task being dragged in manual sort mode

        // Timer state
        this.timerTaskId = null;
        this.timerRemainingSeconds = 0;
        this.timerOriginalSeconds = 0;
        this.timerClockMaxSeconds = 3600;
        this.timerInterval = null;
        this.timerIsPlaying = false;
        this.timerPlayStartAt = null;
        this.timerRemainingAtPlayStart = 0;

        this.init();
    }
    
    init() {
        this.loadData();
        this.checkDailyReset();
        this.setupEventListeners();
        this.updateUI();
        this.restoreTimerFromStorage();
        this.checkOnboarding();
        this.registerServiceWorker();

        // Re-show the modal if user closed the app before dismissing it last time.
        if (this.previousDayTasks && this.previousDayTasks.length > 0) {
            this.showResetModal();
        }

        // Fix PWA viewport height issues
        this.fixPWAViewport();

        // Check for daily reset and update progress every minute
        setInterval(() => {
            this.checkDailyReset();
            this.updateDayProgress();
            this.updateResetCountdown();
        }, 60000); // 60000ms = 1 minute

        // setInterval is throttled or paused while a PWA is backgrounded on
        // mobile, so re-check the reset whenever the page becomes visible.
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkDailyReset();
                this.updateDayProgress();
                this.updateResetCountdown();
            }
        });

        // Initial countdown update
        this.updateResetCountdown();

        // Initial sunrise/sunset positions
        this.getUserLocation();
    }
    
    fixPWAViewport() {
        // Fix viewport height issues in PWA standalone mode
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        // Set initial viewport height
        setViewportHeight();
        
        // Recalculate on resize (handles orientation changes)
        window.addEventListener('resize', setViewportHeight);
        
        // Recalculate on focus (handles PWA refresh issues)
        window.addEventListener('focus', setViewportHeight);
        
        // Force recalculation after a short delay (handles PWA refresh)
        setTimeout(setViewportHeight, 100);
        setTimeout(setViewportHeight, 500);
    }
    
    loadData() {
        // Load tasks
        const savedTasks = localStorage.getItem('todayTodo_tasks');
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }

        // Load settings
        const savedSettings = localStorage.getItem('todayTodo_settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }

        // Load sort mode from settings
        this.sortMode = this.settings.sortMode || 'creation';

        // Load last reset time
        const savedLastReset = localStorage.getItem('todayTodo_lastReset');
        if (savedLastReset) {
            const parsed = new Date(savedLastReset);
            if (!isNaN(parsed.getTime())) {
                this.lastResetTime = parsed;
            }
        }

        // Persisted so the reset modal can be re-shown if the user closes
        // the app before dismissing it.
        const savedPrevious = localStorage.getItem('todayTodo_previousDayTasks');
        if (savedPrevious) {
            try {
                this.previousDayTasks = JSON.parse(savedPrevious) || [];
            } catch (e) {
                this.previousDayTasks = [];
            }
        } else {
            this.previousDayTasks = [];
        }
        
        // Load cached location only if location access is enabled
        if (this.settings.locationAccess) {
            const cachedLocation = localStorage.getItem('todayTodo_userLocation');
            if (cachedLocation) {
                this.userLocation = JSON.parse(cachedLocation);
            }
        }
    }
    
    saveData() {
        localStorage.setItem('todayTodo_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('todayTodo_settings', JSON.stringify(this.settings));
        localStorage.setItem('todayTodo_lastReset', this.lastResetTime.toISOString());
        if (this.previousDayTasks && this.previousDayTasks.length > 0) {
            localStorage.setItem('todayTodo_previousDayTasks', JSON.stringify(this.previousDayTasks));
        } else {
            localStorage.removeItem('todayTodo_previousDayTasks');
        }
    }
    
    checkDailyReset() {
        const now = new Date();

        // Parse reset time from settings
        const resetTime = this.settings.resetTime.split(':');
        const resetHour = parseInt(resetTime[0]);
        const resetMinute = parseInt(resetTime[1]);

        // Calculate the last reset time that should have occurred based on current time
        let lastExpectedReset = new Date(now);
        lastExpectedReset.setHours(resetHour, resetMinute, 0, 0);

        // If the reset time hasn't occurred yet today, the last reset was yesterday
        if (now < lastExpectedReset) {
            lastExpectedReset.setDate(lastExpectedReset.getDate() - 1);
        }

        // Guard against an invalid stored lastResetTime (treat as "needs reset")
        const lastReset = (this.lastResetTime instanceof Date && !isNaN(this.lastResetTime.getTime()))
            ? this.lastResetTime
            : new Date(0);

        // Check if we've crossed a reset boundary since last actual reset
        if (lastReset < lastExpectedReset) {
            const unfinishedTasks = this.tasks.filter(task => !task.completed);
            if (unfinishedTasks.length > 0) {
                this.previousDayTasks = unfinishedTasks;
            }

            // Clearing tasks and advancing lastResetTime must happen together:
            // if lastResetTime moved forward without clearing, force-quitting
            // the app while the modal is open would leave stale tasks AND a
            // future-dated marker, suppressing the next reset.
            this.tasks = [];
            this.lastResetTime = now;
            this.saveData();
            this.updateUI();

            this.showResetModal();
        }
    }

    showResetModal() {
        const tasks = this.previousDayTasks || [];
        if (tasks.length === 0) return;

        const unfinishedTasksList = document.getElementById('unfinishedTasks');
        unfinishedTasksList.innerHTML = '';

        tasks.forEach(task => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'unfinished-task';

            const taskName = document.createElement('div');
            taskName.className = 'unfinished-task-name';
            taskName.textContent = task.text;

            taskDiv.appendChild(taskName);

            if (task.duration) {
                const taskDuration = document.createElement('div');
                taskDuration.className = 'unfinished-task-duration';
                taskDuration.textContent = this.formatDuration(task.duration);
                taskDiv.appendChild(taskDuration);
            }

            unfinishedTasksList.appendChild(taskDiv);
        });

        document.getElementById('newDayModal').classList.add('show');
    }

    simulateNextDay() {
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        if (unfinishedTasks.length > 0) {
            this.previousDayTasks = unfinishedTasks;
        }
        this.tasks = [];
        this.lastResetTime = new Date();
        this.saveData();
        this.updateUI();
        this.showResetModal();
    }

    clearAndStartToday() {
        // Tasks are already cleared by checkDailyReset; this just dismisses
        // the modal and discards the snapshot.
        this.previousDayTasks = [];
        this.saveData();
        document.getElementById('newDayModal').classList.remove('show');
        this.updateUI();
    }
    
    setupEventListeners() {
        // Task input
        const taskInput = document.getElementById('taskInput');
        
        // Prevent soft keyboard from appearing on focus until user starts typing
        let hasUserInteracted = false;
        
        taskInput.addEventListener('focus', (e) => {
            // Only show keyboard if user has already interacted
            if ('ontouchstart' in window && !hasUserInteracted) {
                e.target.blur();
            }
        });
        
        taskInput.addEventListener('touchstart', () => {
            hasUserInteracted = true;
        });
        
        taskInput.addEventListener('input', () => {
            hasUserInteracted = true;
        });
        
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && taskInput.value.trim()) {
                this.addTask(taskInput.value.trim());
                taskInput.value = '';
            }
        });
        
        // New day modal
        document.getElementById('clearTodayBtn').addEventListener('click', () => {
            this.clearAndStartToday();
        });
        
        // Bottom navigation settings (replacing header settings)
        document.getElementById('settingsBtn').addEventListener('click', (e) => {
            // Don't open settings if long press was triggered
            if (this.longPressTriggered) {
                this.longPressTriggered = false;
                return;
            }
            document.getElementById('settingsModal').classList.add('show');
        });
        
        // Add button
        document.getElementById('addBtn').addEventListener('click', () => {
            this.showAddTaskModal();
        });
        
        // Add task overlay events
        const addTaskInput = document.getElementById('addTaskInput');
        const addTaskSubmit = document.getElementById('addTaskSubmit');
        const addTaskOverlay = document.getElementById('addTaskOverlay');
        
        // Submit button click (desktop)
        addTaskSubmit.addEventListener('click', () => {
            this.handleTaskSubmit();
        });
        
        // Submit button touch (mobile)
        addTaskSubmit.addEventListener('touchend', (e) => {
            e.preventDefault(); // Prevent click event from also firing
            this.handleTaskSubmit();
        }, { passive: false });
        
        // Enter key press
        addTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleTaskSubmit();
            }
        });
        
        // Safari iOS compatibility - ensure input can be focused manually
        addTaskInput.addEventListener('click', () => {
            addTaskInput.focus();
        });
        
        // Prevent Safari iOS autocomplete by setting additional attributes
        addTaskInput.setAttribute('autocomplete', 'new-password');
        addTaskInput.setAttribute('data-lpignore', 'true');
        addTaskInput.setAttribute('data-form-type', 'other');
        
        // Duration pills
        const durationPills = document.querySelectorAll('.duration-pill');
        durationPills.forEach(pill => {
            let touchStartX = 0;
            let touchStartY = 0;
            let hasMoved = false;
            
            // Click event for desktop
            pill.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing overlay
                this.selectDurationPill(parseInt(pill.dataset.minutes));
            });
            
            // Touch start - track initial position
            pill.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                hasMoved = false;
            }, { passive: true });
            
            // Touch move - detect if user is dragging
            pill.addEventListener('touchmove', (e) => {
                const currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;
                const deltaX = Math.abs(currentX - touchStartX);
                const deltaY = Math.abs(currentY - touchStartY);
                
                // If moved more than 10 pixels, consider it a drag/scroll
                if (deltaX > 10 || deltaY > 10) {
                    hasMoved = true;
                }
            }, { passive: true });
            
            // Touch end - only select if it wasn't a drag
            pill.addEventListener('touchend', (e) => {
                if (!hasMoved) {
                    e.preventDefault(); // Prevent click event from also firing
                    e.stopPropagation(); // Prevent closing overlay
                    this.selectDurationPill(parseInt(pill.dataset.minutes));
                }
            }, { passive: false });
        });
        
        // Click/touch outside input area to close
        addTaskOverlay.addEventListener('click', (e) => {
            // Don't close if clicking duration pills or their container
            if (e.target.closest('.duration-pills-container') || e.target.closest('.duration-pill')) {
                return;
            }
            // Close if clicking on overlay background or outside the container
            if (e.target === addTaskOverlay || !e.target.closest('.add-task-container')) {
                this.hideAddTaskModal();
            }
        });
        
        // Touch events for mobile browsers
        addTaskOverlay.addEventListener('touchstart', (e) => {
            // Don't interfere with input field touch handling
            if (e.target.closest('input')) {
                return;
            }
            // Don't close if touching duration pills or their container
            if (e.target.closest('.duration-pills-container') || e.target.closest('.duration-pill')) {
                return;
            }
            // Close if touching overlay background or outside the container
            if (e.target === addTaskOverlay || !e.target.closest('.add-task-container')) {
                e.preventDefault();
                this.hideAddTaskModal();
            }
        }, { passive: false });
        
        // Allow normal scrolling within the overlay
        // Chrome-specific fixes are handled by CSS overscroll-behavior
        
        // Allow normal touch interactions in overlay
        
        // Sort button - toggle between creation and duration sorting
        document.getElementById('sortBtn').addEventListener('click', () => {
            this.toggleSortMode();
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
        });
        
        // About button in settings
        document.getElementById('aboutBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
            this.showOnboarding();
        });
        
        // Email Feedback link in settings
        document.getElementById('emailFeedbackLink').addEventListener('click', () => {
            const version = '1.3.1';
            const subject = `Feedback for Today v${version}`;
            const mailtoLink = `mailto:today@annafilou.com?subject=${encodeURIComponent(subject)}`;
            window.location.href = mailtoLink;
        });
        
        // Onboarding close button
        document.getElementById('onboardingClose').addEventListener('click', () => {
            this.closeOnboarding();
        });
        
        // Onboarding "Watch video" button
        document.getElementById('onboardingGotIt').addEventListener('click', () => {
            this.closeOnboarding();
            this.showVideoModal();
        });
        
        // Video modal close button
        document.getElementById('videoClose').addEventListener('click', () => {
            this.closeVideoModal();
        });
        
        // Round duration toggle
        document.getElementById('roundDurationToggle').addEventListener('click', () => {
            this.toggleRoundDuration();
        });
        
        // Location access toggle
        document.getElementById('locationAccessToggle').addEventListener('click', () => {
            this.toggleLocationAccess();
        });
        
        // Sort mode toggle
        document.getElementById('sortModeToggle').addEventListener('click', () => {
            this.toggleSortMode();
        });
        
        // Auto-add emojis toggle
        document.getElementById('autoAddEmojisToggle').addEventListener('click', () => {
            this.toggleAutoAddEmojis();
        });

        // Show awake time toggle
        document.getElementById('showAwakeTimeToggle').addEventListener('click', () => {
            this.toggleShowAwakeTime();
        });
        
        // Toggle rounding by tapping the remaining time in header
        const remainingTimeElement = document.getElementById('remainingTime');
        
        // Click event for desktop
        remainingTimeElement.addEventListener('click', () => {
            this.toggleRoundDuration();
        });
        
        // Touch event for mobile
        remainingTimeElement.addEventListener('touchend', (e) => {
            e.preventDefault(); // Prevent click event from also firing
            this.toggleRoundDuration();
        }, { passive: false });
        
        // Clear all tasks button
        document.getElementById('clearAllTasks').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all tasks? This cannot be undone.')) {
                this.clearAllTasks();
            }
        });
        
        // Long press settings button to simulate next day (for testing/debugging)
        const settingsBtn = document.getElementById('settingsBtn');
        let longPressTimer = null;
        
        settingsBtn.addEventListener('mousedown', () => {
            this.longPressTriggered = false;
            longPressTimer = setTimeout(() => {
                this.longPressTriggered = true;
            this.simulateNextDay();
                console.log('Next day simulated via long press on settings button');
            }, 1000); // 1 second long press
        });
        
        settingsBtn.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });
        
        settingsBtn.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });
        
        // Touch events for mobile
        settingsBtn.addEventListener('touchstart', (e) => {
            this.longPressTriggered = false;
            longPressTimer = setTimeout(() => {
                this.longPressTriggered = true;
            this.simulateNextDay();
                console.log('Next day simulated via long press on settings button');
            }, 1000); // 1 second long press
        });
        
        settingsBtn.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
        });
        
        // Settings input (hidden, kept for compatibility)
        document.getElementById('resetTime').addEventListener('change', (e) => {
            this.settings.resetTime = e.target.value;
            this.updateTimeDisplay();
            this.updateResetCountdown();
            this.saveData();
        });
        
        // Time display button - open custom time picker
        document.getElementById('resetTimeDisplay').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTimePicker();
        });
        
        // Close time picker
        document.getElementById('closeTimePicker').addEventListener('click', () => {
            document.getElementById('timePickerModal').classList.remove('show');
        });
        
        // Initialize time picker
        this.initializeTimePicker();
        
        // Close modals when clicking outside (except newDayModal - it's mandatory)
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                // Don't allow dismissing the new day modal - user must click the button
                if (modal.id === 'newDayModal') {
                    return;
                }
                
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        // Timer overlay
        document.getElementById('timerCloseBtn').addEventListener('click', () => this.closeTimer());
        document.getElementById('timerPlayBtn').addEventListener('click', () => this.toggleTimer());
        document.getElementById('timerPlayBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.toggleTimer();
        }, { passive: false });

        // Reconcile timer when tab becomes visible again (e.g. returning from another app)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.timerIsPlaying) {
                const elapsed = Math.round((Date.now() - this.timerPlayStartAt) / 1000);
                this.timerRemainingSeconds = Math.max(0, this.timerRemainingAtPlayStart - elapsed);
                this.updateTimerDisplay();
                if (this.timerRemainingSeconds <= 0) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                    this.timerIsPlaying = false;
                    this.clearSavedTimerState();
                    this.updateTimerPlayBtn();
                }
            }
        });

        // Set initial settings value
        document.getElementById('resetTime').value = this.settings.resetTime;
        this.updateTimeDisplay();
        this.updateRoundDurationDisplay();
        this.updateLocationAccessDisplay();
        this.updateSortModeDisplay();
        this.updateAutoAddEmojisDisplay();
        this.updateShowAwakeTimeDisplay();
    }
    
    addTask(text) {
        const duration = this.extractDuration(text);
        let cleanText = this.removeDurationFromText(text);
        
        // Apply emoji if setting enabled and module loaded
        if (this.settings.autoAddEmojis && typeof applyEmojiToTask === 'function') {
            cleanText = applyEmojiToTask(cleanText);
        }
        
        const task = {
            id: Date.now(),
            text: cleanText,
            duration: duration,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        this.tasks.push(task);
        this.saveData();
        this.updateUI();
        
        // Show toast notification
        this.showToast('Task added');
    }
    
    extractDuration(text) {
        // Match patterns like: "10min", "5 min", "2h", "1 hour", "1h 30m", "1 hour 30 minutes", etc.
        const durationRegex = /\b(\d+)\s*(h|hour|hours|hr|hrs|m|min|minute|minutes)\b(?:\s*(\d+)\s*(m|min|minute|minutes)\b)?/gi;
        let totalMinutes = 0;
        let match;
        
        while ((match = durationRegex.exec(text)) !== null) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            
            if (unit.startsWith('h')) {
                totalMinutes += value * 60;
            } else if (unit.startsWith('m')) {
                totalMinutes += value;
            }
            
            // Handle additional minutes (e.g., "1h 30m")
            if (match[3] && match[4]) {
                const additionalMinutes = parseInt(match[3]);
                totalMinutes += additionalMinutes;
            }
        }
        
        return totalMinutes > 0 ? totalMinutes : null;
    }
    
    removeDurationFromText(text) {
        // Remove duration patterns from text, keeping the same regex as extractDuration
        return text.replace(/\b(\d+)\s*(h|hour|hours|hr|hrs|m|min|minute|minutes)\b(?:\s*(\d+)\s*(m|min|minute|minutes)\b)?/gi, '').trim();
    }
    
    formatDuration(minutes) {
        if (!minutes) return '';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}`;
        } else {
            return `0:${mins.toString().padStart(2, '0')}`;
        }
    }
    
    toggleSortMode() {
        if (this.sortMode === 'creation') {
            this.sortMode = 'duration';
        } else if (this.sortMode === 'duration') {
            this.sortMode = 'manual';
        } else {
            this.sortMode = 'creation';
        }

        this.settings.sortMode = this.sortMode;
        this.saveData();
        this.renderTasks();
        this.updateSortModeDisplay();

        const messages = { creation: 'Sorted by creation', duration: 'Sorted by duration', manual: 'Manual sort' };
        this.showToast(messages[this.sortMode]);
    }
    
    getSortedTasks() {
        if (this.sortMode === 'duration') {
            // Sort by duration: longest first, completed tasks and tasks without duration at the bottom
            return [...this.tasks].sort((a, b) => {
                // Treat completed tasks as having 0 duration
                const aDuration = a.completed ? 0 : (a.duration || 0);
                const bDuration = b.completed ? 0 : (b.duration || 0);

                // If both have no duration, prioritize incomplete tasks
                if (aDuration === 0 && bDuration === 0) {
                    // If one is completed and one isn't, put completed one after
                    if (a.completed && !b.completed) return 1;
                    if (!a.completed && b.completed) return -1;
                    // If both have same completion status, keep original order
                    return 0;
                }
                // If only a has no duration (or is completed), put it after b
                if (aDuration === 0) {
                    return 1;
                }
                // If only b has no duration (or is completed), put it after a
                if (bDuration === 0) {
                    return -1;
                }
                // Both have durations, sort by longest first
                return bDuration - aDuration;
            });
        }

        if (this.sortMode === 'manual') {
            return this.tasks;
        }

        // creation: sort by id (Date.now() at creation) so order stays stable after manual reordering
        return [...this.tasks].sort((a, b) => a.id - b.id);
    }
    
    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            const wasBeingCheckedOff = !task.completed;
            task.completed = !task.completed;
            
            this.saveData();
            this.updateUI();
            
            // Add animation class if task is being checked off (after UI update)
            if (wasBeingCheckedOff) {
                setTimeout(() => {
                    const taskElement = document.querySelector(`[data-task-id="${id}"]`);
                    if (taskElement) {
                        const checkbox = taskElement.querySelector('.task-checkbox');
                        if (checkbox) {
                            // Add animate class to both task item and checkbox
                            taskElement.classList.add('animate');
                            checkbox.classList.add('animate');
                            
                            // Remove animation classes after animation completes
                            setTimeout(() => {
                                taskElement.classList.remove('animate');
                                checkbox.classList.remove('animate');
                            }, 400);
                        }
                    }
                }, 0);
            }
        }
    }
    
    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.currentEditingTaskId = id;
            this.showEditTaskModal(task);
        }
    }
    
    showEditTaskModal(task) {
        const overlay = document.getElementById('addTaskOverlay');
        const input = document.getElementById('addTaskInput');
        
        // Pre-populate input with current task text
        input.value = task.text || '';
        
        // Set checkbox state based on task completion
        const checkbox = document.querySelector('.add-task-checkbox');
        if (task.completed) {
            checkbox.classList.add('checked');
        } else {
            checkbox.classList.remove('checked');
        }
        
        // Set selected duration based on task's current duration
        this.selectedDuration = (task.duration !== undefined && task.duration !== null) ? task.duration : null;
        
        // Update pill UI to match task's duration
        document.querySelectorAll('.duration-pill').forEach(pill => {
            const pillMinutes = parseInt(pill.dataset.minutes);
            if (task.duration !== undefined && task.duration !== null && pillMinutes === task.duration) {
                pill.classList.add('selected');
            } else {
                pill.classList.remove('selected');
            }
        });
        
        // Prevent body scroll when overlay is open - Chrome-specific fixes
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        overlay.classList.add('show');
        
        // Use Visual Viewport API to handle keyboard properly on mobile
        this.setupKeyboardAwareFocus(input);
        
        // Place cursor at the end after focusing
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                input.setSelectionRange(input.value.length, input.value.length);
            });
        });
    }
    
    
    deleteTask(id) {
        // Store deleted task for undo
        this.deletedTask = this.tasks.find(t => t.id === id);
        
        // Remove task
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData();
        this.updateUI();
        
        // Show undo toast
        this.showUndoToast();
        
        // Clear deleted task after 5 seconds (toast duration)
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
        }
        this.undoTimeout = setTimeout(() => {
            this.deletedTask = null;
        }, 5000);
    }
    
    undoDelete() {
        if (this.deletedTask) {
            // Restore task
            this.tasks.push(this.deletedTask);
            this.deletedTask = null;
            
            // Clear timeout
            if (this.undoTimeout) {
                clearTimeout(this.undoTimeout);
                this.undoTimeout = null;
            }
            
            this.saveData();
            this.updateUI();
        }
    }
    
    clearAllTasks() {
        this.tasks = [];
        this.saveData();
        this.updateUI();
        // Close settings modal after clearing
        document.getElementById('settingsModal').classList.remove('show');
    }
    
    updateUI() {
        this.updateDate();
        this.updateRemainingTime();
        this.updateDayProgress();
        this.renderTasks();
        this.updateEmptyState();
    }
    
    updateDate() {
        const dayElement = document.getElementById('currentDay');
        const dateElement = document.getElementById('currentDate');
        const yearElement = document.getElementById('currentYear');
        const today = new Date();
        
        // Update day (e.g., "WED")
        const dayOptions = { weekday: 'short' };
        dayElement.textContent = today.toLocaleDateString('en-US', dayOptions).toUpperCase();
        
        // Update date (e.g., "Oct 8")
        const monthOptions = { month: 'short' };
        const dayOptions2 = { day: 'numeric' };
        
        const month = today.toLocaleDateString('en-US', monthOptions);
        const day = today.toLocaleDateString('en-US', dayOptions2);
        
        dateElement.textContent = `${month} ${day}`;
        
        // Update year (e.g., "2025")
        const yearOptions = { year: 'numeric' };
        const year = today.toLocaleDateString('en-US', yearOptions);
        yearElement.textContent = year;
    }
    
    getAwakeWindow() {
        const [h, m] = this.settings.resetTime.split(':').map(Number);
        const sleepMin = h * 60 + m; // reset time = when they go to sleep
        const wakeMin = (sleepMin + 8 * 60) % (24 * 60); // +8h = wake time
        const awakeDuration = 16 * 60; // always 16 hours
        return { wakeMin, sleepMin, awakeDuration };
    }

    minutesSinceWake(nowMin, wakeMin) {
        // handles midnight crossing
        return nowMin >= wakeMin ? nowMin - wakeMin : (1440 - wakeMin) + nowMin;
    }

    updateDayProgress() {
        const progressFill = document.getElementById('dayProgressFill');
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        let percentage;
        if (this.settings.showAwakeTime) {
            const { wakeMin, awakeDuration } = this.getAwakeWindow();
            const elapsed = this.minutesSinceWake(nowMin, wakeMin);
            percentage = Math.min(Math.max((elapsed / awakeDuration) * 100, 0), 100);
        } else {
            percentage = (nowMin / (24 * 60)) * 100;
        }

        progressFill.style.width = `${percentage}%`;
        this.updateProgressBarColor(now);
        this.updateSunriseSunsetPositions();
    }
    
    updateProgressBarColor(now) {
        const progressFill = document.getElementById('dayProgressFill');
        const hasLocation = this.settings.locationAccess && this.userLocation && typeof SunCalc !== 'undefined';

        if (!hasLocation) {
            progressFill.classList.remove('with-location');
            progressFill.classList.add('no-location');
            progressFill.style.background = '';
            return;
        }

        progressFill.classList.remove('no-location');
        progressFill.classList.add('with-location');

        const times = SunCalc.getTimes(now, this.userLocation.lat, this.userLocation.lng);
        const sunriseMin = times.sunrise.getHours() * 60 + times.sunrise.getMinutes();
        const sunsetMin  = times.sunset.getHours()  * 60 + times.sunset.getMinutes();

        let currentProgressPercent, sunrisePercent, sunsetPercent;

        if (this.settings.showAwakeTime) {
            const { wakeMin, awakeDuration } = this.getAwakeWindow();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const elapsedNow = this.minutesSinceWake(nowMin, wakeMin);
            currentProgressPercent = Math.min(Math.max((elapsedNow / awakeDuration) * 100, 0), 100);

            // Sunrise/sunset as % of awake window
            sunrisePercent = (this.minutesSinceWake(sunriseMin, wakeMin) / awakeDuration) * 100;
            sunsetPercent  = (this.minutesSinceWake(sunsetMin,  wakeMin) / awakeDuration) * 100;
        } else {
            const nowMin = now.getHours() * 60 + now.getMinutes();
            currentProgressPercent = (nowMin / (24 * 60)) * 100;
            sunrisePercent = ((times.sunrise.getHours() + times.sunrise.getMinutes() / 60) / 24) * 100;
            sunsetPercent  = ((times.sunset.getHours()  + times.sunset.getMinutes()  / 60) / 24) * 100;
        }

        // Build gradient: positions are scaled to current bar width
        const scale = (p) => Math.min((p / currentProgressPercent) * 100, 100);
        let gradientStops;

        if (sunsetPercent > sunrisePercent) {
            gradientStops = [
                `#9d4edd 0%`,
                `#9d4edd ${scale(sunrisePercent)}%`,
                `#ffd700 ${scale(sunrisePercent)}%`,
                `#ffd700 ${scale(sunsetPercent)}%`,
                `#9d4edd ${scale(sunsetPercent)}%`,
                `#9d4edd 100%`
            ];
        } else {
            gradientStops = [
                `#ffd700 0%`,
                `#ffd700 ${scale(sunsetPercent)}%`,
                `#9d4edd ${scale(sunsetPercent)}%`,
                `#9d4edd ${scale(sunrisePercent)}%`,
                `#ffd700 ${scale(sunrisePercent)}%`,
                `#ffd700 100%`
            ];
        }

        progressFill.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
    }
    
    getUserLocation() {
        // Only request location if user has enabled location access
        if (!this.settings.locationAccess) {
            this.updateSunriseSunsetPositions();
            return;
        }
        
        // If we already have a location from loadData, use it
        if (this.userLocation) {
            this.updateSunriseSunsetPositions();
            return;
        }
        
        // Check if geolocation is supported
        if (!navigator.geolocation) {
            console.log('Geolocation not supported, using fallback times');
            this.updateSunriseSunsetPositions();
            return;
        }
        
        // Request current location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Cache the location for future use
                localStorage.setItem('todayTodo_userLocation', JSON.stringify(this.userLocation));
                
                // Update sunrise/sunset positions with real data
                this.updateSunriseSunsetPositions();
            },
            (error) => {
                console.log('Location access denied or failed:', error.message);
                this.updateSunriseSunsetPositions();
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 24 * 60 * 60 * 1000 // Cache for 24 hours
            }
        );
    }
    
    updateSunriseSunsetPositions() {
        const sunriseIndicator = document.querySelector('.sunrise-indicator');
        const sunsetIndicator = document.querySelector('.sunset-indicator');
        const shouldShowIndicators = this.settings.locationAccess && this.userLocation && typeof SunCalc !== 'undefined';

        if (shouldShowIndicators) {
            const now = new Date();
            const times = SunCalc.getTimes(now, this.userLocation.lat, this.userLocation.lng);
            const sunriseMin = times.sunrise.getHours() * 60 + times.sunrise.getMinutes();
            const sunsetMin  = times.sunset.getHours()  * 60 + times.sunset.getMinutes();

            let sunrisePosition, sunsetPosition;
            let showSunrise = true, showSunset = true;

            if (this.settings.showAwakeTime) {
                const { wakeMin, awakeDuration } = this.getAwakeWindow();
                const sunriseElapsed = this.minutesSinceWake(sunriseMin, wakeMin);
                const sunsetElapsed  = this.minutesSinceWake(sunsetMin,  wakeMin);

                // Hide if outside the 16-hour awake window
                showSunrise = sunriseElapsed >= 0 && sunriseElapsed <= awakeDuration;
                showSunset  = sunsetElapsed  >= 0 && sunsetElapsed  <= awakeDuration;
                sunrisePosition = (sunriseElapsed / awakeDuration) * 100;
                sunsetPosition  = (sunsetElapsed  / awakeDuration) * 100;
            } else {
                sunrisePosition = ((times.sunrise.getHours() + times.sunrise.getMinutes() / 60) / 24) * 100;
                sunsetPosition  = ((times.sunset.getHours()  + times.sunset.getMinutes()  / 60) / 24) * 100;
            }

            if (sunriseIndicator) {
                sunriseIndicator.style.display = showSunrise ? 'block' : 'none';
                if (showSunrise) sunriseIndicator.style.left = `${sunrisePosition}%`;
            }
            if (sunsetIndicator) {
                sunsetIndicator.style.display = showSunset ? 'block' : 'none';
                if (showSunset) sunsetIndicator.style.left = `${sunsetPosition}%`;
            }
        } else {
            if (sunriseIndicator) sunriseIndicator.style.display = 'none';
            if (sunsetIndicator)  sunsetIndicator.style.display  = 'none';
        }
    }
    
    updateResetCountdown() {
        const now = new Date();
        const resetTime = this.settings.resetTime.split(':');
        const resetHour = parseInt(resetTime[0]);
        const resetMinute = parseInt(resetTime[1]);
        
        // Calculate next reset time
        const nextReset = new Date(now);
        nextReset.setHours(resetHour, resetMinute, 0, 0);
        
        // If the reset time has already passed today, it's tomorrow
        if (now >= nextReset) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        // Calculate time difference
        const timeDiff = nextReset - now;
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        // Format as HH:MM
        const countdownText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        const countdownElement = document.getElementById('resetCountdown');
        if (countdownElement) {
            countdownElement.textContent = countdownText;
        }
    }
    
    updateRemainingTime() {
        const remainingTimeElement = document.getElementById('remainingTime');
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        
        let totalMinutes = unfinishedTasks.reduce((total, task) => {
            return total + (task.duration || 0);
        }, 0);
        
        // Round up to nearest 30 minutes if setting is enabled
        let isRounded = false;
        if (this.settings.roundDuration && totalMinutes > 0) {
            const remainder = totalMinutes % 30;
            if (remainder > 0) {
                totalMinutes = totalMinutes + (30 - remainder);
                isRounded = true;
            }
        }
        
        // Always show remaining time (even when 0:00)
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
        
        const prefix = isRounded ? '~ ' : '';
            
            if (hours > 0) {
            remainingTimeElement.textContent = `${prefix}${hours}:${minutes.toString().padStart(2, '0')}`;
            } else {
            remainingTimeElement.textContent = `${prefix}0:${minutes.toString().padStart(2, '0')}`;
            }
        
        // Gray out when zero
        if (totalMinutes === 0) {
            remainingTimeElement.classList.add('zero');
        } else {
            remainingTimeElement.classList.remove('zero');
        }
    }
    
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const taskList = document.getElementById('taskList');
        const addTaskPrompt = document.getElementById('addTaskPrompt');
        const headerContent = document.querySelector('.header-content');
        const headerRight = document.querySelector('.header-right');
        
        if (this.tasks.length === 0) {
            // No tasks - center header and show empty state
            emptyState.classList.add('show');
            taskList.style.display = 'none';
            addTaskPrompt.classList.add('show');
            headerContent.classList.add('centered');
            headerRight.style.display = 'none';
        } else {
            // Has tasks - always show header left-aligned with remaining time
            emptyState.classList.remove('show');
            taskList.style.display = 'block';
            addTaskPrompt.classList.remove('show');
            headerContent.classList.remove('centered');
            headerRight.style.display = 'flex';
        }
    }
    
    showAddTaskModal() {
        const overlay = document.getElementById('addTaskOverlay');
        const input = document.getElementById('addTaskInput');
        const emptyState = document.getElementById('emptyState');
        const addTaskPrompt = document.getElementById('addTaskPrompt');
        
        // Hide empty state content and add task prompt when modal opens
        if (emptyState.classList.contains('show')) {
            emptyState.style.visibility = 'hidden';
        }
        if (addTaskPrompt.classList.contains('show')) {
            addTaskPrompt.style.visibility = 'hidden';
        }
        
        // Reset selected duration
        this.selectedDuration = null;
        document.querySelectorAll('.duration-pill').forEach(pill => {
            pill.classList.remove('selected');
        });
        
        // Prevent body scroll when overlay is open - Chrome-specific fixes
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        overlay.classList.add('show');
        
        // Use Visual Viewport API to handle keyboard properly on mobile
        this.setupKeyboardAwareFocus(input);
    }
    
    selectDurationPill(minutes) {
        // Update selected duration
        this.selectedDuration = minutes;
        
        // Update UI
        document.querySelectorAll('.duration-pill').forEach(pill => {
            if (parseInt(pill.dataset.minutes) === minutes) {
                pill.classList.add('selected');
            } else {
                pill.classList.remove('selected');
            }
        });
        
        // If task name is not blank, auto-submit
        const input = document.getElementById('addTaskInput');
        if (input.value.trim()) {
            this.handleTaskSubmit();
        }
    }
    
    setupKeyboardAwareFocus(element) {
        const ensureIntoView = () => {
            const vv = window.visualViewport;
            if (!vv) return;
            
            const rect = element.getBoundingClientRect();
            const visibleTop = vv.offsetTop;
            const visibleBottom = vv.offsetTop + vv.height;
            
            // More aggressive positioning for Safari iOS
            if (rect.top < visibleTop || rect.bottom > visibleBottom) {
                // Scroll the input to be in the visible area above the keyboard
                const targetY = Math.max(visibleTop + 20, rect.top - 100);
                element.scrollIntoView({ 
                    block: 'center', 
                    behavior: 'instant',
                    inline: 'nearest'
                });
            }
        };
        
        const vv = window.visualViewport;
        if (vv) {
            // Listen for keyboard changes
            const onVvChange = () => {
                // Delay to allow keyboard to fully appear
                setTimeout(ensureIntoView, 100);
            };
            vv.addEventListener('resize', onVvChange);
            vv.addEventListener('scroll', onVvChange);
            
            // Clean up listeners when modal closes
            const cleanup = () => {
                vv.removeEventListener('resize', onVvChange);
                vv.removeEventListener('scroll', onVvChange);
            };
            
            // Store cleanup function for later
            this.keyboardCleanup = cleanup;
        }
        
        // Focus immediately for Safari iOS compatibility
        // Safari iOS requires immediate focus without delays
        try {
            // Let the browser naturally scroll the input into view
            element.focus();
            // Also ensure it's visible after keyboard appears
            setTimeout(ensureIntoView, 100);
            setTimeout(ensureIntoView, 300);
        } catch (e) {
            // Fallback for older browsers
            element.focus();
        }
    }
    
    hideAddTaskModal() {
        const overlay = document.getElementById('addTaskOverlay');
        const input = document.getElementById('addTaskInput');
        const emptyState = document.getElementById('emptyState');
        const addTaskPrompt = document.getElementById('addTaskPrompt');
        
        overlay.classList.remove('show');
        input.value = '';
        this.currentEditingTaskId = null;
        
        // Restore empty state content and add task prompt visibility
        if (emptyState.classList.contains('show')) {
            emptyState.style.visibility = 'visible';
        }
        if (addTaskPrompt.classList.contains('show')) {
            addTaskPrompt.style.visibility = 'visible';
        }
        
        // Clean up Visual Viewport listeners
        if (this.keyboardCleanup) {
            this.keyboardCleanup();
            this.keyboardCleanup = null;
        }
        
        // Restore body scroll - Chrome-specific fixes
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
    
    handleTaskSubmit() {
        const input = document.getElementById('addTaskInput');
        const taskText = input.value.trim();
        
        // Allow submission if either text or selected duration exists
        if (!taskText && !this.selectedDuration) return;
        
        if (this.currentEditingTaskId) {
            // Editing existing task
            const task = this.tasks.find(t => t.id === this.currentEditingTaskId);
            if (task) {
                const extractedDuration = this.extractDuration(taskText);
                const cleanText = this.removeDurationFromText(taskText);
                
                // Always update the text
                task.text = cleanText;
                
                // Update duration: prefer typed duration, then pill selection, then keep existing
                if (extractedDuration > 0) {
                    // User typed a duration - always use it
                    task.duration = extractedDuration;
                } else if (this.selectedDuration !== null) {
                    // No typed duration, but pill selected - use pill (including 0 to remove duration)
                    task.duration = this.selectedDuration;
                }
                // If no typed duration and no pill selected, keep existing task.duration unchanged
                
                this.saveData();
                this.updateUI();
                this.hideAddTaskModal();
            }
        } else {
            // Adding new task
            const extractedDuration = this.extractDuration(taskText);
            
            if (extractedDuration > 0) {
                // User typed a duration - use it as-is
                this.addTask(taskText);
            } else if (this.selectedDuration !== null) {
                // No typed duration, but pill selected - append pill duration (including 0)
                if (this.selectedDuration === 0) {
                    // 0 duration - just add the task without duration
                    this.addTask(taskText);
                } else {
                    // Non-zero duration - append duration suffix
                    const durationSuffix = this.selectedDuration >= 60 
                        ? ` ${this.selectedDuration / 60}h` 
                        : ` ${this.selectedDuration}m`;
                    this.addTask(taskText + durationSuffix);
                }
            } else {
                // No duration at all
                this.addTask(taskText);
            }
            this.hideAddTaskModal();
        }
    }
    
    updateTimeDisplay() {
        const timeDisplay = document.getElementById('resetTimeDisplay');
        const resetTime = this.settings.resetTime;
        
        // Display in 24-hour format
        timeDisplay.textContent = resetTime;
    }
    
    updateRoundDurationDisplay() {
        const toggleBtn = document.getElementById('roundDurationToggle');
        const toggleValue = toggleBtn.querySelector('.toggle-value');
        
        if (this.settings.roundDuration) {
            toggleValue.innerHTML = '<span class="toggle-checkmark">✓</span>Yes';
        } else {
            toggleValue.textContent = 'No';
        }
    }
    
    updateLocationAccessDisplay() {
        const toggleBtn = document.getElementById('locationAccessToggle');
        const toggleValue = toggleBtn.querySelector('.toggle-value');
        
        if (this.settings.locationAccess) {
            toggleValue.innerHTML = '<span class="toggle-checkmark">✓</span>Yes';
        } else {
            toggleValue.textContent = 'No';
        }
    }
    
    updateSortModeDisplay() {
        const toggleBtn = document.getElementById('sortModeToggle');
        const toggleValue = toggleBtn.querySelector('.toggle-value');
        const labels = { creation: 'Creation', duration: 'Duration', manual: 'Manual' };
        toggleValue.textContent = labels[this.sortMode] || 'Creation';
    }
    
    toggleRoundDuration() {
        this.settings.roundDuration = !this.settings.roundDuration;
        this.updateRoundDurationDisplay();
        this.saveData();
        this.updateUI();
    }
    
    toggleLocationAccess() {
        if (!this.settings.locationAccess) {
            // User wants to enable location access
            this.requestLocationPermission();
        } else {
            // User wants to disable location access
            this.settings.locationAccess = false;
            this.userLocation = null;
            localStorage.removeItem('todayTodo_userLocation');
            this.updateLocationAccessDisplay();
            this.updateSunriseSunsetPositions(); // Hide indicators
            this.updateProgressBarColor(new Date()); // Update progress bar color immediately
            this.saveData();
        }
    }
    
    toggleAutoAddEmojis() {
        this.settings.autoAddEmojis = !this.settings.autoAddEmojis;
        this.updateAutoAddEmojisDisplay();
        this.saveData();
    }
    
    updateAutoAddEmojisDisplay() {
        const toggleBtn = document.getElementById('autoAddEmojisToggle');
        const toggleValue = toggleBtn.querySelector('.toggle-value');
        
        if (this.settings.autoAddEmojis) {
            toggleValue.innerHTML = '<span class="toggle-checkmark">✓</span>Yes';
        } else {
            toggleValue.textContent = 'No';
        }
    }
    
    toggleShowAwakeTime() {
        this.settings.showAwakeTime = !this.settings.showAwakeTime;
        this.updateShowAwakeTimeDisplay();
        this.saveData();
        this.updateDayProgress();
    }

    updateShowAwakeTimeDisplay() {
        const toggleBtn = document.getElementById('showAwakeTimeToggle');
        const toggleValue = toggleBtn.querySelector('.toggle-value');
        if (this.settings.showAwakeTime) {
            toggleValue.innerHTML = '<span class="toggle-checkmark">✓</span>Yes';
        } else {
            toggleValue.textContent = 'No';
        }
    }

    requestLocationPermission() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.settings.locationAccess = true;
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Cache the location
                localStorage.setItem('todayTodo_userLocation', JSON.stringify(this.userLocation));
                
                this.updateLocationAccessDisplay();
                this.updateSunriseSunsetPositions();
                this.updateProgressBarColor(new Date()); // Update progress bar color immediately
                this.saveData();
            },
            (error) => {
                alert('Location access denied. Sunrise/sunset indicators will be hidden.');
                this.updateLocationAccessDisplay();
                this.updateSunriseSunsetPositions(); // Hide indicators
                this.updateProgressBarColor(new Date()); // Update progress bar color immediately
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 24 * 60 * 60 * 1000
            }
        );
    }
    
    initializeTimePicker() {
        const timePickerGrid = document.querySelector('.time-picker-grid');
        timePickerGrid.innerHTML = '';
        
        // Create 24 hour options (00:00 to 23:00)
        for (let hour = 0; hour < 24; hour++) {
            const button = document.createElement('button');
            button.className = 'time-option';
            button.textContent = `${hour.toString().padStart(2, '0')}:00`;
            button.dataset.hour = hour;
            
            button.addEventListener('click', () => {
                this.selectTime(hour);
            });
            
            timePickerGrid.appendChild(button);
        }
        
        this.updateTimePickerSelection();
    }
    
    showTimePicker() {
        this.updateTimePickerSelection();
        document.getElementById('timePickerModal').classList.add('show');
    }
    
    selectTime(hour) {
        this.settings.resetTime = `${hour.toString().padStart(2, '0')}:00`;
        this.updateTimeDisplay();
        this.updateTimePickerSelection();
        this.updateResetCountdown();
        this.saveData();
        
        // Close the time picker after selection
        setTimeout(() => {
            document.getElementById('timePickerModal').classList.remove('show');
        }, 200);
    }
    
    updateTimePickerSelection() {
        const currentHour = parseInt(this.settings.resetTime.split(':')[0]);
        const timeOptions = document.querySelectorAll('.time-option');
        
        timeOptions.forEach(option => {
            const optionHour = parseInt(option.dataset.hour);
            if (optionHour === currentHour) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
    
    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Hide toast after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
    
    showUndoToast() {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        // Set message with undo action
        toastMessage.innerHTML = 'Task deleted · <span class="undo-link">Undo</span>';
        toast.classList.add('show');
        
        // Add click listener to undo link
        const undoLink = toast.querySelector('.undo-link');
        const undoHandler = () => {
            this.undoDelete();
            toast.classList.remove('show');
            undoLink.removeEventListener('click', undoHandler);
            undoLink.removeEventListener('touchend', touchHandler);
        };
        
        const touchHandler = (e) => {
            e.preventDefault();
            this.undoDelete();
            toast.classList.remove('show');
            undoLink.removeEventListener('click', undoHandler);
            undoLink.removeEventListener('touchend', touchHandler);
        };
        
        undoLink.addEventListener('click', undoHandler);
        undoLink.addEventListener('touchend', touchHandler, { passive: false });
        
        // Hide toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            undoLink.removeEventListener('click', undoHandler);
            undoLink.removeEventListener('touchend', touchHandler);
        }, 5000);
    }
    
    addSwipeHandlers(element, taskId) {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        let hasMovedEnough = false; // Track if user has swiped enough to be considered a swipe
        let startY = 0; // Track Y position to detect vertical scrolling
        const swipeThreshold = window.innerWidth * 0.5; // 50vw to trigger delete
        const moveThreshold = 30; // Minimum movement to be considered a swipe (reduced from 50)
        const maxVerticalMovement = 50; // Maximum vertical movement allowed during horizontal swipe (increased from 30)
        const deleteBackground = element.querySelector('.delete-background');
        const taskContent = element.querySelector('.task-content');
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            isSwiping = true;
            hasMovedEnough = false;
        });
        
        element.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            
            currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - startX;
            const diffY = currentY - startY;
            
            // Check if this is primarily a horizontal swipe (not vertical scrolling)
            const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);
            const isMinimalVerticalMovement = Math.abs(diffY) < maxVerticalMovement;
            
            // Only trigger swipe-to-delete if:
            // 1. It's a left swipe (negative diffX)
            // 2. Horizontal movement is greater than vertical (not scrolling)
            // 3. Vertical movement is minimal
            // 4. Horizontal movement exceeds the threshold
            if (diffX < 0 && isHorizontalSwipe && isMinimalVerticalMovement && Math.abs(diffX) > moveThreshold) {
                hasMovedEnough = true;
                element.classList.add('swiping');
                
                taskContent.style.transform = `translateX(${diffX}px)`;
                
                // Change indicator when threshold is reached
                if (Math.abs(diffX) > swipeThreshold) {
                    element.classList.add('delete-threshold');
                } else {
                    element.classList.remove('delete-threshold');
                }
            } else if (Math.abs(diffY) > maxVerticalMovement && Math.abs(diffY) > Math.abs(diffX)) {
                // If this is clearly vertical scrolling, reset the swipe state
                isSwiping = false;
                hasMovedEnough = false;
                element.classList.remove('swiping');
                taskContent.style.transform = '';
            }
        });
        
        element.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            
            const diffX = currentX - startX;
            isSwiping = false;
            element.classList.remove('swiping');
            
            // Only delete if user actually swiped left (not just tapped)
            if (hasMovedEnough && diffX < 0 && Math.abs(diffX) > swipeThreshold) {
                // Keep red background during deletion animation
                // Animate off screen to the left
                taskContent.style.transform = `translateX(-${window.innerWidth}px)`;
                
                // Delete task after animation
                setTimeout(() => {
                    this.deleteTask(taskId);
                }, 300);
            } else {
                // Snap back to original position and remove red background
                taskContent.style.transform = 'translateX(0)';
                element.classList.remove('delete-threshold');
            }
            
            isSwiping = false;
            startX = 0;
            currentX = 0;
        });
        
        element.addEventListener('touchcancel', () => {
            element.classList.remove('swiping');
            element.classList.remove('delete-threshold');
            taskContent.style.transform = 'translateX(0)';
            isSwiping = false;
            startX = 0;
            currentX = 0;
        });
    }
    
    renderTasks() {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';
        
        // Get sorted tasks based on current sort mode
        const sortedTasks = this.getSortedTasks();
        
        sortedTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${!task.text && task.duration && task.duration > 0 ? 'no-name' : ''}`;
            li.dataset.taskId = task.id;
            
            // Add delete background layer
            const deleteBackground = document.createElement('div');
            deleteBackground.className = 'delete-background';
            deleteBackground.textContent = 'Delete';
            li.appendChild(deleteBackground);
            
            // Add task content layer
            const taskContent = document.createElement('div');
            taskContent.className = 'task-content';
            
            const checkbox = document.createElement('div');
            checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
            checkbox.addEventListener('click', () => this.toggleTask(task.id));
            
            const textSpan = document.createElement('span');
            textSpan.className = `task-text ${task.completed ? 'completed' : ''}`;
            textSpan.textContent = task.text || 'Add task name';
            
            let durationSpan = null;
            if (task.duration && task.duration > 0) {
                durationSpan = document.createElement('span');
                durationSpan.className = `task-duration ${task.completed ? 'completed' : ''}`;
            durationSpan.textContent = this.formatDuration(task.duration);
            }
            
            // Add elements to task content
            taskContent.appendChild(checkbox);
            taskContent.appendChild(textSpan);
            if (durationSpan) {
                const durationWrapper = document.createElement('div');
                durationWrapper.className = 'task-duration-tap-area';
                durationWrapper.appendChild(durationSpan);
                durationWrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTimer(task.id);
                });
                taskContent.appendChild(durationWrapper);
            }
            
            // Add drag handle in manual sort mode
            if (this.sortMode === 'manual') {
                const handle = document.createElement('div');
                handle.className = 'drag-handle';
                handle.setAttribute('aria-label', 'Drag to reorder');
                handle.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="2" cy="2" r="1.5"/>
                    <circle cx="8" cy="2" r="1.5"/>
                    <circle cx="2" cy="8" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="2" cy="14" r="1.5"/>
                    <circle cx="8" cy="14" r="1.5"/>
                </svg>`;
                taskContent.appendChild(handle);
            }

            // Add task content to the list item
            li.appendChild(taskContent);

            // Single click listener for task editing - works for all cases
            li.addEventListener('click', (e) => {
                // Don't trigger if clicking on checkbox or drag handle
                if (!e.target.classList.contains('task-checkbox') && !e.target.closest('.drag-handle')) {
                    this.editTask(task.id);
                }
            });
            
            // Only show pointer cursor if task is editable (has text or duration)
            if (task.text || (task.duration && task.duration > 0)) {
                li.style.cursor = 'pointer';
            }
            
            // Add swipe handlers (swipe-to-delete) and drag handlers (manual sort)
            this.addSwipeHandlers(li, task.id);
            if (this.sortMode === 'manual') {
                this.addDragHandlers(li, task.id);
            }
            
            taskList.appendChild(li);
        });
    }
    
    addDragHandlers(li, taskId) {
        const clearDropClasses = () => {
            document.querySelectorAll('.task-item.drag-over-top, .task-item.drag-over-bottom')
                .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
        };

        const getPosition = (targetEl, clientY) => {
            const rect = targetEl.getBoundingClientRect();
            return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        };

        // Desktop HTML5 drag API
        li.setAttribute('draggable', 'true');

        li.addEventListener('dragstart', (e) => {
            this.draggedTaskId = taskId;
            e.dataTransfer.effectAllowed = 'move';
            requestAnimationFrame(() => li.classList.add('dragging'));
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            clearDropClasses();
            this.draggedTaskId = null;
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this.draggedTaskId === taskId) return;
            clearDropClasses();
            const pos = getPosition(li, e.clientY);
            li.classList.add(pos === 'before' ? 'drag-over-top' : 'drag-over-bottom');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            const insertBefore = li.classList.contains('drag-over-top');
            clearDropClasses();
            if (this.draggedTaskId !== null && this.draggedTaskId !== taskId) {
                this.reorderTask(this.draggedTaskId, taskId, insertBefore ? 'before' : 'after');
            }
        });

        // Mobile touch drag via the grip handle
        const handle = li.querySelector('.drag-handle');
        if (!handle) return;

        handle.addEventListener('click', (e) => e.stopPropagation());

        let touchDragging = false;
        let lastDropTarget = null;
        let lastDropPosition = 'before';

        handle.addEventListener('touchstart', (e) => {
            e.stopPropagation(); // prevent swipe-to-delete from activating
            touchDragging = true;
            this.draggedTaskId = taskId;
            li.classList.add('dragging');
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!touchDragging) return;
            e.preventDefault();
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetLi = el ? el.closest('.task-item') : null;

            if (lastDropTarget) {
                lastDropTarget.classList.remove('drag-over-top', 'drag-over-bottom');
            }
            if (targetLi && targetLi !== li) {
                lastDropPosition = getPosition(targetLi, touch.clientY);
                targetLi.classList.add(lastDropPosition === 'before' ? 'drag-over-top' : 'drag-over-bottom');
                lastDropTarget = targetLi;
            } else {
                lastDropTarget = null;
            }
        }, { passive: false });

        const finishTouchDrag = () => {
            if (!touchDragging) return;
            touchDragging = false;
            li.classList.remove('dragging');

            if (lastDropTarget) {
                lastDropTarget.classList.remove('drag-over-top', 'drag-over-bottom');
                const targetId = parseInt(lastDropTarget.dataset.taskId);
                if (targetId && targetId !== taskId) {
                    this.reorderTask(taskId, targetId, lastDropPosition);
                }
            }

            clearDropClasses();
            this.draggedTaskId = null;
            lastDropTarget = null;
            lastDropPosition = 'before';
        };

        handle.addEventListener('touchend', finishTouchDrag);
        handle.addEventListener('touchcancel', finishTouchDrag);
    }

    reorderTask(fromId, toId, position = 'before') {
        const fromIndex = this.tasks.findIndex(t => t.id === fromId);
        const toIndex = this.tasks.findIndex(t => t.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [task] = this.tasks.splice(fromIndex, 1);
        // recalculate toIndex after splice since array shifted
        const newToIndex = this.tasks.findIndex(t => t.id === toId);
        this.tasks.splice(position === 'before' ? newToIndex : newToIndex + 1, 0, task);
        this.saveData();
        this.renderTasks();
    }

    openTimer(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || !task.duration || task.duration <= 0) return;

        this.timerTaskId = taskId;
        this.timerRemainingSeconds = task.duration * 60;
        this.timerOriginalSeconds = this.timerRemainingSeconds;
        this.timerClockMaxSeconds = 3600;
        this.timerIsPlaying = false;
        this.timerPlayStartAt = null;

        this.drawTimerTicks();
        this.updateTimerDisplay();
        this.updateTimerPlayBtn();
        document.getElementById('timerTaskName').textContent = task.text || '';

        document.getElementById('timerOverlay').classList.add('show');
        this.playTimer();
    }

    closeTimer() {
        if (this.timerIsPlaying) {
            // Sync remaining to wall clock before stopping
            const elapsed = Math.round((Date.now() - this.timerPlayStartAt) / 1000);
            this.timerRemainingSeconds = Math.max(0, this.timerRemainingAtPlayStart - elapsed);
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            this.timerIsPlaying = false;
        }
        this.clearSavedTimerState();

        const elapsedSeconds = this.timerOriginalSeconds - this.timerRemainingSeconds;
        if (elapsedSeconds > 0 && this.timerTaskId !== null) {
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const subtractMinutes = Math.floor(elapsedMinutes / 5) * 5;

            if (subtractMinutes > 0) {
                const task = this.tasks.find(t => t.id === this.timerTaskId);
                if (task) {
                    const newDuration = (task.duration || 0) - subtractMinutes;
                    task.duration = newDuration > 0 ? newDuration : null;
                    this.saveData();
                    this.updateUI();
                    this.showToast('Duration updated');
                }
            }
        }

        document.getElementById('timerOverlay').classList.remove('show');
        this.timerTaskId = null;
        this.timerPlayStartAt = null;
    }

    playTimer() {
        if (this.timerIsPlaying || this.timerRemainingSeconds <= 0) return;
        this.timerIsPlaying = true;
        this.timerPlayStartAt = Date.now();
        this.timerRemainingAtPlayStart = this.timerRemainingSeconds;
        this.saveTimerState();

        this.timerInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - this.timerPlayStartAt) / 1000);
            this.timerRemainingSeconds = Math.max(0, this.timerRemainingAtPlayStart - elapsed);
            this.updateTimerDisplay();
            if (this.timerRemainingSeconds <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.timerIsPlaying = false;
                this.clearSavedTimerState();
                this.updateTimerPlayBtn();
            }
        }, 500);
        this.updateTimerPlayBtn();
    }

    pauseTimer() {
        if (!this.timerIsPlaying) return;
        // Sync remaining to wall clock before pausing
        const elapsed = Math.round((Date.now() - this.timerPlayStartAt) / 1000);
        this.timerRemainingSeconds = Math.max(0, this.timerRemainingAtPlayStart - elapsed);
        this.timerIsPlaying = false;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.timerPlayStartAt = null;
        this.clearSavedTimerState();
        this.updateTimerPlayBtn();
        this.updateTimerDisplay();
    }

    toggleTimer() {
        if (this.timerIsPlaying) {
            this.pauseTimer();
        } else {
            this.playTimer();
        }
    }

    saveTimerState() {
        localStorage.setItem('todayTodo_runningTimer', JSON.stringify({
            taskId: this.timerTaskId,
            clockMaxSeconds: this.timerClockMaxSeconds,
            originalSeconds: this.timerOriginalSeconds,
            remainingAtStart: this.timerRemainingAtPlayStart,
            playStartAt: this.timerPlayStartAt
        }));
    }

    clearSavedTimerState() {
        localStorage.removeItem('todayTodo_runningTimer');
    }

    restoreTimerFromStorage() {
        const saved = localStorage.getItem('todayTodo_runningTimer');
        if (!saved) return;

        let state;
        try { state = JSON.parse(saved); } catch (e) {
            localStorage.removeItem('todayTodo_runningTimer');
            return;
        }

        const { taskId, clockMaxSeconds, originalSeconds, remainingAtStart, playStartAt } = state;
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            localStorage.removeItem('todayTodo_runningTimer');
            return;
        }

        const elapsedSincePlay = Math.round((Date.now() - playStartAt) / 1000);
        const newRemaining = Math.max(0, remainingAtStart - elapsedSincePlay);

        this.timerTaskId = taskId;
        this.timerClockMaxSeconds = clockMaxSeconds;
        this.timerOriginalSeconds = originalSeconds;
        this.timerRemainingSeconds = newRemaining;
        this.timerIsPlaying = false;
        this.timerPlayStartAt = null;
        localStorage.removeItem('todayTodo_runningTimer');

        if (newRemaining <= 0) {
            // Timer finished while browser was closed — apply full elapsed duration
            const elapsedMinutes = Math.floor(originalSeconds / 60);
            const subtractMinutes = Math.floor(elapsedMinutes / 5) * 5;
            if (subtractMinutes > 0 && task.duration) {
                const newDuration = task.duration - subtractMinutes;
                task.duration = newDuration > 0 ? newDuration : null;
                this.saveData();
                this.updateUI();
                this.showToast('Duration updated');
            }
            return;
        }

        // Show overlay and resume counting
        this.drawTimerTicks();
        this.updateTimerDisplay();
        this.updateTimerPlayBtn();
        document.getElementById('timerTaskName').textContent = task.text || '';
        document.getElementById('timerOverlay').classList.add('show');
        this.playTimer();
    }

    drawTimerTicks() {
        const group = document.getElementById('timerTicks');
        group.innerHTML = '';

        const cx = 150, cy = 150;
        const outerR = 132;
        const minorInnerR = 122;
        const majorInnerR = 110;
        const numTicks = 60;

        for (let i = 0; i < numTicks; i++) {
            const angle = (i / numTicks) * 2 * Math.PI;
            const isMajor = i % 5 === 0;
            const innerR = isMajor ? majorInnerR : minorInnerR;

            const x1 = (cx + innerR * Math.sin(angle)).toFixed(2);
            const y1 = (cy - innerR * Math.cos(angle)).toFixed(2);
            const x2 = (cx + outerR * Math.sin(angle)).toFixed(2);
            const y2 = (cy - outerR * Math.cos(angle)).toFixed(2);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', isMajor ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)');
            line.setAttribute('stroke-width', isMajor ? '3' : '1.5');
            line.setAttribute('stroke-linecap', 'round');

            group.appendChild(line);
        }
    }

    getTimerBuckets() {
        const total = this.timerOriginalSeconds;
        const remaining = this.timerRemainingSeconds;
        const elapsed = total - remaining;

        const totalFullHours = Math.floor(total / 3600);
        const totalPartial = total % 3600;

        // Are we past all full-hour buckets and into the partial bucket?
        const inPartial = elapsed >= totalFullHours * 3600;

        let bigFraction;
        const smallFractions = [];

        if (!inPartial) {
            const elapsedFullHours = Math.floor(elapsed / 3600);
            const elapsedInCurrentHour = elapsed - elapsedFullHours * 3600;
            bigFraction = (3600 - elapsedInCurrentHour) / 3600;

            // Full hours still waiting after this one
            const waitingFullHours = totalFullHours - elapsedFullHours - 1;
            for (let i = 0; i < waitingFullHours; i++) smallFractions.push(1.0);
            // Partial chunk waiting at the end (constant until its turn)
            if (totalPartial > 0) smallFractions.push(totalPartial / 3600);
        } else {
            // Draining the partial bucket
            const elapsedInPartial = elapsed - totalFullHours * 3600;
            bigFraction = totalPartial > 0 ? (totalPartial - elapsedInPartial) / 3600 : 0;
        }

        return { bigFraction, smallFractions };
    }

    updateTimerSector() {
        const sector = document.getElementById('timerSector');
        const cx = 150, cy = 150, r = 132;

        const { bigFraction: fraction } = this.getTimerBuckets();

        if (fraction <= 0) {
            sector.setAttribute('d', '');
            return;
        }

        if (fraction >= 1) {
            // Full circle: two semicircle arcs
            sector.setAttribute('d',
                `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
            );
            return;
        }

        const angle = fraction * 2 * Math.PI;
        const endX = (cx + r * Math.sin(angle)).toFixed(2);
        const endY = (cy - r * Math.cos(angle)).toFixed(2);
        const largeArcFlag = angle > Math.PI ? 1 : 0;

        sector.setAttribute('d',
            `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
        );
    }

    updateTimerDisplay() {
        this.updateTimerSector();
        this.updateSmallClocks();

        const total = this.timerRemainingSeconds;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        document.getElementById('timerRemaining').textContent = h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;

        const endEl = document.getElementById('timerEndTime');
        if (total > 0) {
            const end = new Date(Date.now() + total * 1000);
            endEl.textContent = `→ ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
        } else {
            endEl.textContent = '';
        }
    }

    updateSmallClocks() {
        const container = document.getElementById('timerSmallClocks');
        container.innerHTML = '';

        const { smallFractions } = this.getTimerBuckets();

        if (smallFractions.length > 3) {
            // Cap at 2 small clocks + "+n" overflow label
            container.appendChild(this.createSmallClock(smallFractions[0]));
            container.appendChild(this.createSmallClock(smallFractions[1]));
            const label = document.createElement('div');
            label.className = 'timer-overflow-label';
            label.textContent = `+${smallFractions.length - 2}`;
            container.appendChild(label);
        } else {
            for (const fraction of smallFractions) {
                container.appendChild(this.createSmallClock(fraction));
            }
        }
    }

    createSmallClock(fraction) {
        const wrapper = document.createElement('div');
        wrapper.className = 'timer-small-clock';

        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        const cx = 50, cy = 50, r = 44;

        // Sector
        const sector = document.createElementNS(ns, 'path');
        sector.setAttribute('fill', '#bc4040');
        if (fraction >= 1) {
            sector.setAttribute('d', `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`);
        } else if (fraction > 0) {
            const angle = fraction * 2 * Math.PI;
            const ex = (cx + r * Math.sin(angle)).toFixed(2);
            const ey = (cy - r * Math.cos(angle)).toFixed(2);
            sector.setAttribute('d', `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${ex} ${ey} Z`);
        }
        svg.appendChild(sector);

        // Tick marks
        const ticks = document.createElementNS(ns, 'g');
        for (let i = 0; i < 60; i++) {
            const angle = (i / 60) * 2 * Math.PI;
            const isMajor = i % 5 === 0;
            const innerR = isMajor ? 36 : 40;
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', (cx + innerR * Math.sin(angle)).toFixed(2));
            line.setAttribute('y1', (cy - innerR * Math.cos(angle)).toFixed(2));
            line.setAttribute('x2', (cx + r * Math.sin(angle)).toFixed(2));
            line.setAttribute('y2', (cy - r * Math.cos(angle)).toFixed(2));
            line.setAttribute('stroke', isMajor ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)');
            line.setAttribute('stroke-width', isMajor ? '1' : '0.5');
            line.setAttribute('stroke-linecap', 'round');
            ticks.appendChild(line);
        }
        svg.appendChild(ticks);

        // Center dot
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
        dot.setAttribute('r', '3'); dot.setAttribute('fill', '#666');
        svg.appendChild(dot);

        wrapper.appendChild(svg);
        return wrapper;
    }

    updateTimerPlayBtn() {
        const playIcon = document.getElementById('timerPlayIcon');
        const pauseIcon = document.getElementById('timerPauseIcon');
        if (this.timerIsPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                    
                    // Check for updates on page load
                    this.checkForUpdates(registration);
                    
                    // Listen for service worker updates
                    registration.addEventListener('updatefound', () => {
                        console.log('Service Worker update found');
                        const newWorker = registration.installing;
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateNotification();
                            }
                        });
                    });
                    
                    // Listen for controller change (when new service worker takes over)
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('New service worker activated');
                        // Reload the page to get the latest version
                        window.location.reload();
                    });
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }
    
    checkForUpdates(registration) {
        // Check for updates every time the page loads
        registration.update();
        
        // Also check periodically (every 5 minutes)
        setInterval(() => {
            registration.update();
        }, 5 * 60 * 1000);
    }
    
    showUpdateNotification() {
        // Create update notification
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <span>Update available!</span>
                <button id="updateBtn" class="update-btn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M13.8359 2.47699C14.0349 2.47699 14.2256 2.55601 14.3663 2.69666C14.5069 2.83732 14.5859 3.02808 14.5859 3.22699V6.40899C14.5859 6.60791 14.5069 6.79867 14.3663 6.93932C14.2256 7.07998 14.0349 7.15899 13.8359 7.15899H10.6539C10.455 7.15899 10.2643 7.07998 10.1236 6.93932C9.98296 6.79867 9.90395 6.60791 9.90395 6.40899C9.90395 6.21008 9.98296 6.01932 10.1236 5.87866C10.2643 5.73801 10.455 5.65899 10.6539 5.65899H12.0239L11.1839 4.81799C10.6959 4.32974 10.102 3.96034 9.44829 3.73836C8.79457 3.51639 8.09856 3.4478 7.41409 3.5379C6.72963 3.628 6.07507 3.87438 5.50108 4.25797C4.92708 4.64155 4.44904 5.15206 4.10395 5.74999C4.00449 5.92238 3.84062 6.04821 3.6484 6.09978C3.45618 6.15135 3.25134 6.12445 3.07895 6.02499C2.90655 5.92554 2.78073 5.76167 2.72916 5.56945C2.67759 5.37722 2.70449 5.17238 2.80395 4.99999C3.26413 4.2028 3.90156 3.52218 4.66692 3.01079C5.43227 2.49941 6.30503 2.17097 7.21764 2.0509C8.13026 1.93083 9.05826 2.02234 9.92985 2.31836C10.8014 2.61438 11.5932 3.10696 12.2439 3.75799L13.0859 4.59799V3.22699C13.0859 3.02808 13.165 2.83732 13.3056 2.69666C13.4463 2.55601 13.637 2.47699 13.8359 2.47699ZM12.9249 9.97699C13.0967 10.0765 13.222 10.2401 13.2734 10.4319C13.3247 10.6236 13.298 10.8279 13.1989 11C12.7387 11.7971 12.1012 12.4776 11.3358 12.9889C10.5704 13.5002 9.6976 13.8286 8.78499 13.9485C7.87238 14.0685 6.94441 13.9769 6.07287 13.6808C5.20133 13.3847 4.4096 12.8921 3.75895 12.241L2.91895 11.401V12.772C2.91895 12.9709 2.83993 13.1617 2.69928 13.3023C2.55862 13.443 2.36786 13.522 2.16895 13.522C1.97003 13.522 1.77927 13.443 1.63862 13.3023C1.49796 13.1617 1.41895 12.9709 1.41895 12.772V9.59099C1.41895 9.39208 1.49796 9.20132 1.63862 9.06066C1.77927 8.92001 1.97003 8.84099 2.16895 8.84099H5.34995C5.54886 8.84099 5.73962 8.92001 5.88028 9.06066C6.02093 9.20132 6.09995 9.39208 6.09995 9.59099C6.09995 9.78991 6.02093 9.98067 5.88028 10.1213C5.73962 10.262 5.54886 10.341 5.34995 10.341H3.97995L4.82095 11.182C5.30902 11.6702 5.9029 12.0397 6.55661 12.2616C7.21032 12.4836 7.90633 12.5522 8.5908 12.4621C9.27526 12.372 9.92982 12.1256 10.5038 11.742C11.0778 11.3584 11.5559 10.8479 11.9009 10.25C11.9503 10.1648 12.016 10.0901 12.0942 10.0302C12.1725 9.97039 12.2617 9.92654 12.3569 9.90119C12.4521 9.87584 12.5513 9.86948 12.649 9.88249C12.7466 9.8955 12.8397 9.92761 12.9249 9.97699Z" fill="white"/>
                    </svg>
                    REFRESH
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add click handler for update button
        document.getElementById('updateBtn').addEventListener('click', () => {
            // Send message to service worker to skip waiting
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            }
            notification.remove();
        });
        
        // Auto-remove notification after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }
    
    checkOnboarding() {
        const hasSeenOnboarding = localStorage.getItem('todayTodo_hasSeenOnboarding');
        if (!hasSeenOnboarding) {
            this.showOnboarding();
        }
    }
    
    showOnboarding() {
        document.getElementById('onboardingModal').classList.add('show');
    }
    
    closeOnboarding() {
        document.getElementById('onboardingModal').classList.remove('show');
        localStorage.setItem('todayTodo_hasSeenOnboarding', 'true');
    }
    
    showVideoModal() {
        document.getElementById('videoModal').classList.add('show');
    }
    
    closeVideoModal() {
        const modal = document.getElementById('videoModal');
        modal.classList.remove('show');
        
        // Stop video playback by removing and re-adding the iframe
        const videoContainer = modal.querySelector('.video-container');
        const iframeWrapper = videoContainer.querySelector('div[style*="position: relative"]');
        const iframe = iframeWrapper.querySelector('iframe');
        const iframeSrc = iframe.src;
        
        // Remove iframe
        iframe.remove();
        
        // Re-add iframe with same src (but it won't auto-play)
        const newIframe = document.createElement('iframe');
        newIframe.src = iframeSrc;
        newIframe.frameBorder = "0";
        newIframe.webkitallowfullscreen = true;
        newIframe.mozallowfullscreen = true;
        newIframe.allowFullscreen = true;
        newIframe.style.position = "absolute";
        newIframe.style.top = "0";
        newIframe.style.left = "0";
        newIframe.style.width = "100%";
        newIframe.style.height = "100%";
        iframeWrapper.appendChild(newIframe);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodayTodo();
});