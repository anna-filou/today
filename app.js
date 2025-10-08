class TodayTodo {
    constructor() {
        this.tasks = [];
        this.settings = {
            resetTime: '04:00'
        };
        this.lastVisitDate = null;
        this.sortMode = 'creation'; // 'creation' or 'duration'
        
        this.init();
    }
    
    init() {
        this.loadData();
        this.checkDailyReset();
        this.setupEventListeners();
        this.updateUI();
        this.registerServiceWorker();
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
        
        // Load last visit date
        const savedLastVisit = localStorage.getItem('todayTodo_lastVisit');
        if (savedLastVisit) {
            this.lastVisitDate = new Date(savedLastVisit);
        }
    }
    
    saveData() {
        localStorage.setItem('todayTodo_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('todayTodo_settings', JSON.stringify(this.settings));
        localStorage.setItem('todayTodo_lastVisit', new Date().toISOString());
    }
    
    checkDailyReset() {
        const today = new Date();
        const todayString = today.toDateString();
        
        if (this.lastVisitDate) {
            const lastVisitString = this.lastVisitDate.toDateString();
            
            if (todayString !== lastVisitString) {
                // Check if we've passed the reset time
                const resetTime = this.settings.resetTime.split(':');
                const resetHour = parseInt(resetTime[0]);
                const resetMinute = parseInt(resetTime[1]);
                
                const resetTimeToday = new Date(today);
                resetTimeToday.setHours(resetHour, resetMinute, 0, 0);
                
                const lastVisitTime = new Date(this.lastVisitDate);
                lastVisitTime.setHours(resetHour, resetMinute, 0, 0);
                
                if (today > resetTimeToday && this.lastVisitDate < resetTimeToday) {
                    this.showResetModal();
                }
            }
        }
        
        this.lastVisitDate = today;
    }
    
    showResetModal() {
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        
        if (unfinishedTasks.length > 0) {
            const yesterdayTasksList = document.getElementById('yesterdayTasks');
            yesterdayTasksList.innerHTML = '';
            
            unfinishedTasks.forEach(task => {
                const li = document.createElement('li');
                li.textContent = task.text;
                yesterdayTasksList.appendChild(li);
            });
            
            document.getElementById('resetModal').classList.add('show');
        }
    }
    
    simulateNextDay() {
        // Simulate the next day by showing the reset modal
        // This will display any unfinished tasks as if it's the next day
        this.showResetModal();
    }
    
    clearAndStartToday() {
        this.tasks = [];
        this.saveData();
        document.getElementById('resetModal').classList.remove('show');
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
        
        // Reset modal
        document.getElementById('clearAndStart').addEventListener('click', () => {
            this.clearAndStartToday();
        });
        
        // Bottom navigation settings (replacing header settings)
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.add('show');
        });
        
        // Add button
        document.getElementById('addBtn').addEventListener('click', () => {
            this.showAddTaskModal();
        });
        
        // Sort button - toggle between creation and duration sorting
        document.getElementById('sortBtn').addEventListener('click', () => {
            this.toggleSortMode();
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
        });
        
        // Clear all tasks button
        document.getElementById('clearAllTasks').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all tasks? This cannot be undone.')) {
                this.clearAllTasks();
            }
        });
        
        // Next day simulation button
        const nextDayBtn = document.getElementById('nextDayBtn');
        nextDayBtn.addEventListener('click', () => {
            this.simulateNextDay();
        });
        
        // Long press to hide button (for demo purposes only - state not remembered)
        let longPressTimer = null;
        nextDayBtn.addEventListener('mousedown', () => {
            longPressTimer = setTimeout(() => {
                nextDayBtn.style.display = 'none';
                console.log('Next Day button hidden for demo - refresh page to show again');
            }, 1000); // 1 second long press
        });
        
        nextDayBtn.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });
        
        nextDayBtn.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });
        
        // Touch events for mobile
        nextDayBtn.addEventListener('touchstart', () => {
            longPressTimer = setTimeout(() => {
                nextDayBtn.style.display = 'none';
                console.log('Next Day button hidden for demo - refresh page to show again');
            }, 1000); // 1 second long press
        });
        
        nextDayBtn.addEventListener('touchend', () => {
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
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
        
        // Set initial settings value
        document.getElementById('resetTime').value = this.settings.resetTime;
        this.updateTimeDisplay();
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
        this.renderTasks();
        
        // Show toast notification
        const message = this.sortMode === 'duration' ? 'Sorted by duration' : 'Sorted by creation';
        this.showToast(message);
    }
    
    getSortedTasks() {
        if (this.sortMode === 'duration') {
            // Sort by duration: longest first, tasks without duration at the bottom
            return [...this.tasks].sort((a, b) => {
                const aDuration = a.duration || 0;
                const bDuration = b.duration || 0;
                
                // If both have no duration, keep original order
                if (aDuration === 0 && bDuration === 0) {
                    return 0;
                }
                // If only a has no duration, put it after b
                if (aDuration === 0) {
                    return 1;
                }
                // If only b has no duration, put it after a
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
            task.completed = !task.completed;
            this.saveData();
            this.updateUI();
        }
    }
    
    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            const newText = prompt('Edit task:', task.text);
            if (newText !== null && newText.trim()) {
                const duration = this.extractDuration(newText);
                task.text = this.removeDurationFromText(newText.trim());
                task.duration = duration;
                this.saveData();
                this.updateUI();
            }
        }
    }
    
    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData();
        this.updateUI();
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
    
    updateRemainingTime() {
        const remainingTimeElement = document.getElementById('remainingTime');
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        
        const totalMinutes = unfinishedTasks.reduce((total, task) => {
            return total + (task.duration || 0);
        }, 0);
        
        if (totalMinutes > 0) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            if (hours > 0) {
                remainingTimeElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
            } else {
                remainingTimeElement.textContent = `0:${minutes.toString().padStart(2, '0')}`;
            }
            remainingTimeElement.style.display = 'block';
        } else {
            remainingTimeElement.style.display = 'none';
        }
    }
    
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const taskList = document.getElementById('taskList');
        const addTaskPrompt = document.getElementById('addTaskPrompt');
        const headerContent = document.querySelector('.header-content');
        const headerRight = document.querySelector('.header-right');
        
        // Calculate total remaining time from unfinished tasks
        const unfinishedTasks = this.tasks.filter(task => !task.completed);
        const totalRemainingMinutes = unfinishedTasks.reduce((total, task) => {
            return total + (task.duration || 0);
        }, 0);
        
        // Check if there's any remaining time to display
        const hasRemainingTime = totalRemainingMinutes > 0;
        
        if (this.tasks.length === 0) {
            emptyState.classList.add('show');
            taskList.style.display = 'none';
            addTaskPrompt.classList.add('show');
            headerContent.classList.add('centered');
            headerRight.style.display = 'none';
        } else {
            emptyState.classList.remove('show');
            taskList.style.display = 'block';
            addTaskPrompt.classList.remove('show');
            
            // Only move header left if there's remaining time to display
            if (hasRemainingTime) {
                headerContent.classList.remove('centered');
                headerRight.style.display = 'flex';
            } else {
                headerContent.classList.add('centered');
                headerRight.style.display = 'none';
            }
        }
    }
    
    showAddTaskModal() {
        const taskText = prompt('Add a task:');
        if (taskText !== null && taskText.trim()) {
            this.addTask(taskText.trim());
        }
    }
    
    updateTimeDisplay() {
        const timeDisplay = document.getElementById('resetTimeDisplay');
        const resetTime = this.settings.resetTime;
        
        // Display in 24-hour format
        timeDisplay.textContent = resetTime;
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
    
    addSwipeHandlers(element, taskId) {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        const swipeThreshold = 100; // pixels to trigger delete
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
            element.classList.add('swiping');
        });
        
        element.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            
            // Only allow left or right swipes (not both directions)
            if (Math.abs(diffX) > 10) {
                e.preventDefault(); // Prevent scrolling when swiping
                element.style.transform = `translateX(${diffX}px)`;
            }
        });
        
        element.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            
            const diffX = currentX - startX;
            element.classList.remove('swiping');
            
            // Check if swipe exceeded threshold (either left or right)
            if (Math.abs(diffX) > swipeThreshold) {
                // Animate off screen
                const direction = diffX > 0 ? 1 : -1;
                element.style.transform = `translateX(${direction * window.innerWidth}px)`;
                
                // Delete task after animation
                setTimeout(() => {
                    this.deleteTask(taskId);
                }, 300);
            } else {
                // Snap back to original position
                element.style.transform = 'translateX(0)';
            }
            
            isSwiping = false;
            startX = 0;
            currentX = 0;
        });
        
        element.addEventListener('touchcancel', () => {
            element.classList.remove('swiping');
            element.style.transform = 'translateX(0)';
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
            li.className = 'task-item';
            li.dataset.taskId = task.id;
            
            // Add delete indicator
            const deleteIndicator = document.createElement('div');
            deleteIndicator.className = 'delete-indicator';
            deleteIndicator.textContent = 'Delete';
            li.appendChild(deleteIndicator);
            
            const checkbox = document.createElement('div');
            checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
            checkbox.addEventListener('click', () => this.toggleTask(task.id));
            
            const textSpan = document.createElement('span');
            textSpan.className = `task-text ${task.completed ? 'completed' : ''}`;
            textSpan.textContent = task.text;
            textSpan.addEventListener('click', () => this.editTask(task.id));
            
            let durationSpan = null;
            if (task.duration && task.duration > 0) {
                durationSpan = document.createElement('span');
                durationSpan.className = `task-duration ${task.completed ? 'completed' : ''}`;
                durationSpan.textContent = this.formatDuration(task.duration);
            }
            
            li.appendChild(checkbox);
            li.appendChild(textSpan);
            if (durationSpan) {
                li.appendChild(durationSpan);
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodayTodo();
});