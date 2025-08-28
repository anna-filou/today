# Today Todo

## Description

**Core Concept:**
A minimal, phone-optimized todo app that enforces daily focus by resetting each day at a customizable time (default 4 AM).

**Key Features:**

**📝 Task Management:**
- Add tasks by typing and pressing Enter
- Check off completed tasks
- Edit tasks by clicking on them
- Delete tasks with × button

**⏰ Duration Tracking:**
- Automatically detects time estimates in task names (1h, 30min, 2h30m, etc.)
- Shows total remaining time for unfinished tasks in the header
- Duration text appears in darker color within task names

**🔄 Daily Reset Philosophy:**
- When you open the app on a new day, it shows yesterday's unfinished tasks in a modal
- Only option is "Clear & start today" - no carrying over old tasks
- Forces you to consciously re-add what's truly important today
- Customizable reset time in settings (perfect for night owls)

**📱 Design:**
- Clean black interface optimized for phones
- Minimal header showing date and remaining time
- Focus stays on input for rapid task entry
- OLED-friendly dark theme

**🔄 PWA Updates:**
- Automatic update detection when new versions are available
- Visual notification banner when updates are ready
- One-click update process
- Automatic page refresh after update installation
- Network-first caching strategy for always-fresh content

**The Philosophy:**
If something was truly important, you'll remember to add it again today. This prevents task list bloat and keeps you focused on what really matters each day.

## Tech stack

Only HTML, CSS and JS. PWA. Saves tasks in local storage.

## Deployment & Updates

### Automatic Updates
The PWA automatically checks for updates when:
- The page loads
- Every 5 minutes while the app is open
- When the user refreshes the page

### Manual Version Updates
When you make changes to the code, update the version to force a refresh:

```bash
node update-version.js 1.0.1
```

This will:
1. Update version numbers in all relevant files
2. Force the service worker to detect changes
3. Trigger update notifications for users
4. Automatically refresh the app with new content

### How Updates Work
1. **Detection**: Service worker checks for file changes using version parameters
2. **Notification**: Users see a blue banner when updates are available
3. **Installation**: One-click update process
4. **Activation**: Page automatically refreshes with new version
5. **Cache Management**: Old caches are automatically cleaned up
