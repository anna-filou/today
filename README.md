# Today Todo

## Description

**Core Concept:**
A minimal, phone-optimized todo app that enforces daily focus by resetting each day at a customizable time (default 4 AM).

**Key Features:**

**📝 Task Management:**
- Add tasks using the prominent + button (opens modal dialog)
- Check off completed tasks
- Edit tasks by clicking on them
- Delete tasks by swiping left or right (native app-like gesture)
- Sort tasks: toggle between creation order (default) and duration order (longest first, no duration at bottom)
- Clear all tasks via Settings (with confirmation)

**⏰ Duration Tracking:**
- Automatically detects time estimates in task names (1h, 30min, 2h30m, etc.)
- Shows total remaining time for unfinished tasks in the header
- Duration text appears in darker color within task names

**🔄 Daily Reset Philosophy:**
- When you open the app on a new day, it shows yesterday's unfinished tasks in a modal
- Only option is "Clear & start today" - no carrying over old tasks
- Forces you to consciously re-add what's truly important today
- Customizable reset time in settings (perfect for night owls)
- Custom 24-hour time picker works across all devices and platforms

**📱 Design:**
- Clean black interface optimized for phones
- Fixed header showing day, date, and remaining time
- Prominent empty state with philosophical messaging
- Bottom navigation with pill-shaped buttons
- OLED-friendly dark theme
- App-like interface with proper mobile navigation

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

### Version Update Process
When you make changes to the code, you **must** update the version number:

1. **Update `sw.js`**: Change the `VERSION` constant (e.g., `'1.0.11'` → `'1.0.12'`)
2. **Update `manifest.json`**: Change the `version` field to match
3. **Commit and Push**: Deploy to your hosting

### Why Version Updates Matter
- **Service Worker Detection**: Changing the `VERSION` in `sw.js` creates a new cache name
- **Forces Refresh**: Service worker detects the change and installs new version
- **Cache Busting**: Old caches are automatically cleaned up
- **User Updates**: Users get notified of the new version

### How Updates Work
1. **Detection**: Service worker detects new `sw.js` file with different version
2. **Notification**: Users see update banner when new version is available
3. **Installation**: One-click update process
4. **Activation**: Page automatically refreshes with new version
5. **Cache Cleanup**: Old caches are deleted, new version is cached

## Development Notes

### Testing/Debugging Features
- **Next Day Button**: Floating button for testing daily reset functionality
  - **Long Press to Hide**: Long press (1 second) the Next Day button to hide it for demo purposes
  - **State Not Remembered**: Button reappears on page refresh - this is intentional for demo purposes
  - **Purpose**: Allows showing the app to others without the debug button visible

### Settings & Time Picker
- **Custom Time Picker**: 24-hour grid interface for setting daily reset time, works across all devices

### Custom CSS Implementations
- **Dashed Borders**: Uses `repeating-linear-gradient` backgrounds for precise control over dash/gap spacing (2px dash + 5px gap)

### Toast Notifications
- **User Feedback**: Small notifications appear above bottom navigation for task actions and sort mode changes
