class TodayTodo {
    constructor() {
        this.tasks = [];
        this.settings = {
            resetTime: '04:00',
            roundDuration: false,
            sortMode: 'creation'
        };
        this.lastResetTime = new Date();
        this.sortMode = 'creation'; // 'creation' or 'duration'
        this.currentEditingTaskId = null;
        this.longPressTriggered = false; // Track if settings button long press triggered
        this.selectedDuration = null; // Track selected duration from pills (in minutes)
        this.deletedTask = null; // Store deleted task for undo
        this.undoTimeout = null; // Timer for clearing deleted task
        
        this.init();
    }
    
    init() {
        this.loadData();
        this.checkDailyReset();
        this.setupEventListeners();
        this.updateUI();
        this.checkOnboarding();
        this.registerServiceWorker();
        
        // Check for daily reset and update progress every minute
        setInterval(() => {
            this.checkDailyReset();
            this.updateDayProgress();
        }, 60000); // 60000ms = 1 minute
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
            this.lastResetTime = new Date(savedLastReset);
        }
    }
    
    saveData() {
        localStorage.setItem('todayTodo_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('todayTodo_settings', JSON.stringify(this.settings));
        localStorage.setItem('todayTodo_lastReset', this.lastResetTime.toISOString());
    }
    
    checkDailyReset() {
        const now = new Date();
        
        // Parse reset time from settings
                const resetTime = this.settings.resetTime.split(':');
                const resetHour = parseInt(resetTime[0]);
                const resetMinute = parseInt(resetTime[1]);
                
        // Calculate the next reset time based on current time
        const nextReset = new Date(now);
        nextReset.setHours(resetHour, resetMinute, 0, 0);
        
        // If the reset time has already passed today, it's tomorrow's reset
        if (now >= nextReset) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        // Check if we've crossed a reset boundary since last reset
        if (now >= nextReset && this.lastResetTime < nextReset) {
            this.showResetModal();
            this.lastResetTime = now; // Update last reset time
            this.saveData();
        }
    }
    
    showResetModal() {
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        
        if (unfinishedTasks.length > 0) {
            const unfinishedTasksList = document.getElementById('unfinishedTasks');
            unfinishedTasksList.innerHTML = '';
            
            unfinishedTasks.forEach(task => {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'unfinished-task';
                
                const taskName = document.createElement('div');
                taskName.className = 'unfinished-task-name';
                taskName.textContent = task.text;
                
                taskDiv.appendChild(taskName);
                
                // Only add duration if it exists
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
    }
    
    simulateNextDay() {
        // Simulate the next day by showing the reset modal
        // This will display any unfinished tasks as if it's the next day
        this.showResetModal();
    }
    
    clearAndStartToday() {
        this.tasks = [];
        this.lastResetTime = new Date(); // Update last reset time
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
        
        // Duration pills
        const durationPills = document.querySelectorAll('.duration-pill');
        durationPills.forEach(pill => {
            // Click event for desktop
            pill.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing overlay
                this.selectDurationPill(parseInt(pill.dataset.minutes));
            });
            
            // Touch event for mobile
            pill.addEventListener('touchend', (e) => {
                e.preventDefault(); // Prevent click event from also firing
                e.stopPropagation(); // Prevent closing overlay
                this.selectDurationPill(parseInt(pill.dataset.minutes));
            }, { passive: false });
        });
        
        // Click/touch outside input area to close
        addTaskOverlay.addEventListener('click', (e) => {
            // Close if clicking on overlay background or outside the container
            if (e.target === addTaskOverlay || !e.target.closest('.add-task-container')) {
                this.hideAddTaskModal();
            }
        });
        
        // Touch events for mobile browsers
        addTaskOverlay.addEventListener('touchstart', (e) => {
            // Close if touching overlay background or outside the container
            if (e.target === addTaskOverlay || !e.target.closest('.add-task-container')) {
                e.preventDefault();
                this.hideAddTaskModal();
            }
        }, { passive: false });
        
        // Prevent scrolling within the overlay - Chrome-specific fixes
        // But allow scrolling within the duration pills container
        addTaskOverlay.addEventListener('touchmove', (e) => {
            // Allow scrolling if touching the pills container
            if (!e.target.closest('.duration-pills-container')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        addTaskOverlay.addEventListener('wheel', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        addTaskOverlay.addEventListener('scroll', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Prevent Chrome's pull-to-refresh and overscroll
        addTaskOverlay.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        addTaskOverlay.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });
        
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
        
        // Onboarding close button
        document.getElementById('onboardingClose').addEventListener('click', () => {
            this.closeOnboarding();
        });
        
        // Onboarding "Got it" button
        document.getElementById('onboardingGotIt').addEventListener('click', () => {
            this.closeOnboarding();
        });
        
        // Round duration toggle
        document.getElementById('roundDurationToggle').addEventListener('click', () => {
            this.toggleRoundDuration();
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
        
        // Set initial settings value
        document.getElementById('resetTime').value = this.settings.resetTime;
        this.updateTimeDisplay();
        this.updateRoundDurationDisplay();
    }
    
    addTask(text) {
        const duration = this.extractDuration(text);
        const cleanText = this.removeDurationFromText(text);
        
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
        this.sortMode = this.sortMode === 'creation' ? 'duration' : 'creation';
        this.settings.sortMode = this.sortMode;
        this.saveData();
        this.renderTasks();
        
        // Show toast notification
        const message = this.sortMode === 'duration' ? 'Sorted by duration' : 'Sorted by creation';
        this.showToast(message);
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
        
        // Default: creation order (as they appear in the array)
        return this.tasks;
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
    
    updateDayProgress() {
        const progressFill = document.getElementById('dayProgressFill');
        const now = new Date();
        
        // Calculate percentage of day passed
        const totalMinutesInDay = 24 * 60; // 1440 minutes
        const minutesPassed = now.getHours() * 60 + now.getMinutes();
        const percentage = (minutesPassed / totalMinutesInDay) * 100;
        
        // Update progress bar width
        progressFill.style.width = `${percentage}%`;
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
            
            if (rect.top < visibleTop || rect.bottom > visibleBottom) {
                element.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        };
        
        const vv = window.visualViewport;
        if (vv) {
            // Listen for keyboard changes
            const onVvChange = () => ensureIntoView();
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
        
        // Wait for one frame before focusing (faster than double-RAF)
        requestAnimationFrame(() => {
            element.focus({ preventScroll: true });
            ensureIntoView();
        });
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
        toggleValue.textContent = this.settings.roundDuration ? 'Yes' : 'No';
    }
    
    toggleRoundDuration() {
        this.settings.roundDuration = !this.settings.roundDuration;
        this.updateRoundDurationDisplay();
        this.saveData();
        this.updateUI();
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
        const swipeThreshold = 100; // pixels to trigger delete
        const moveThreshold = 15; // minimum movement to be considered a swipe (not a tap)
        const deleteBackground = element.querySelector('.delete-background');
        const taskContent = element.querySelector('.task-content');
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isSwiping = true;
            hasMovedEnough = false;
        });
        
        element.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            
            // Only consider it a swipe if moved more than threshold
            if (Math.abs(diffX) > moveThreshold) {
                hasMovedEnough = true;
                element.classList.add('swiping');
                e.preventDefault(); // Prevent scrolling when swiping
                taskContent.style.transform = `translateX(${diffX}px)`;
                
                // Change indicator when threshold is reached
                if (Math.abs(diffX) > swipeThreshold) {
                    element.classList.add('delete-threshold');
                } else {
                    element.classList.remove('delete-threshold');
                }
            }
        });
        
        element.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            
            const diffX = currentX - startX;
            isSwiping = false;
            element.classList.remove('swiping');
            element.classList.remove('delete-threshold');
            
            // Only delete if user actually swiped (not just tapped)
            if (hasMovedEnough && Math.abs(diffX) > swipeThreshold) {
                // Animate off screen
                const direction = diffX > 0 ? 1 : -1;
                taskContent.style.transform = `translateX(${direction * window.innerWidth}px)`;
                
                // Delete task after animation
                setTimeout(() => {
                    this.deleteTask(taskId);
                }, 300);
            } else {
                // Snap back to original position
                taskContent.style.transform = 'translateX(0)';
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
                taskContent.appendChild(durationSpan);
            }
            
            // Add task content to the list item
            li.appendChild(taskContent);
            
            // Single click listener for task editing - works for all cases
            li.addEventListener('click', (e) => {
                // Don't trigger if clicking on checkbox
                if (!e.target.classList.contains('task-checkbox')) {
                    this.editTask(task.id);
                }
            });
            
            // Only show pointer cursor if task is editable (has text or duration)
            if (task.text || (task.duration && task.duration > 0)) {
                li.style.cursor = 'pointer';
            }
            
            // Add swipe handlers
            this.addSwipeHandlers(li, task.id);
            
            taskList.appendChild(li);
        });
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
                <span>🔄 New version available!</span>
                <button id="updateBtn" class="update-btn">Update Now</button>
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodayTodo();
});