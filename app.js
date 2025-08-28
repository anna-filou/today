class TodayTodo {
    constructor() {
        this.tasks = [];
        this.settings = {
            resetTime: '04:00'
        };
        this.lastVisitDate = null;
        
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
    
    clearAndStartToday() {
        this.tasks = [];
        this.saveData();
        document.getElementById('resetModal').classList.remove('show');
        this.updateUI();
    }
    
    setupEventListeners() {
        // Task input
        const taskInput = document.getElementById('taskInput');
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
        
        // Header settings
        document.getElementById('headerSettingsButton').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.add('show');
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
        });
        
        // Settings input
        document.getElementById('resetTime').addEventListener('change', (e) => {
            this.settings.resetTime = e.target.value;
            this.saveData();
        });
        
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
        
        if (hours > 0 && mins > 0) {
            return `${hours}h${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
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
    
    updateUI() {
        this.updateDate();
        this.updateRemainingTime();
        this.renderTasks();
    }
    
    updateDate() {
        const dateElement = document.getElementById('currentDate');
        const today = new Date();
        const options = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric'
        };
        dateElement.textContent = today.toLocaleDateString('en-US', options);
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
                remainingTimeElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')} left`;
            } else {
                remainingTimeElement.textContent = `${minutes} left`;
            }
        } else {
            remainingTimeElement.textContent = 'No time estimates';
        }
    }
    
    renderTasks() {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';
        
        this.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            
            const checkbox = document.createElement('div');
            checkbox.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
            checkbox.addEventListener('click', () => this.toggleTask(task.id));
            
            const textSpan = document.createElement('span');
            textSpan.className = `task-text ${task.completed ? 'completed' : ''}`;
            textSpan.textContent = task.text;
            textSpan.addEventListener('click', () => this.editTask(task.id));
            
            const durationSpan = document.createElement('span');
            durationSpan.className = 'task-duration';
            durationSpan.textContent = this.formatDuration(task.duration);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => this.deleteTask(task.id));
            
            li.appendChild(checkbox);
            li.appendChild(textSpan);
            li.appendChild(durationSpan);
            li.appendChild(deleteBtn);
            
            taskList.appendChild(li);
        });
    }
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodayTodo();
});