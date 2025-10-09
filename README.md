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
- Automatic reset at customizable time (default 4 AM, configurable in settings)
- Modal automatically appears when reset time is reached (checks every minute)
- Shows yesterday's unfinished tasks in a non-dismissible modal
- Only option is "Clear & start today" - modal cannot be dismissed by clicking outside
- No carrying over old tasks - forces you to consciously re-add what's truly important
- Custom 24-hour time picker works across all devices and platforms
- Perfect for night owls who want their "new day" to start at a different time

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
When you make changes to the code, you **must** update the version number in 3 places:

1. **Update `sw.js`**: Change the `VERSION` constant (e.g., `'1.0.13'` → `'1.0.13'`)
2. **Update `manifest.json`**: Change the `version` field to match
3. **Update `index.html`**: Change version in `?v=` query parameters on CSS and JS file links
4. **Commit and Push**: Deploy to your hosting

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
- **Simulate Next Day**: Long press the Settings button (gear icon) for 1 second to trigger the daily reset modal. Normal tap opens Settings, long press triggers the reset simulation

### Settings & Time Picker
- **Custom Time Picker**: 24-hour grid interface for setting daily reset time, works across all devices

### Development Best Practices

#### Mobile Event Handlers
**CRITICAL**: Whenever adding click event listeners for desktop interactions, you MUST also add corresponding touch event listeners for mobile devices.

**Pattern to follow:**
```javascript
// Desktop
element.addEventListener('click', (e) => {
    e.stopPropagation();
    handleAction();
});

// Mobile
element.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent click event from also firing
    e.stopPropagation();
    handleAction();
}, { passive: false });
```

**Why this matters:**
- Click events work on desktop but are unreliable on mobile browsers
- Touch events (`touchend`) are required for reliable mobile interaction
- Without `preventDefault()`, both touch and click events may fire (double-trigger)
- Must use `{ passive: false }` to allow `preventDefault()`

**Examples in codebase:**
- Duration pill selection (`.duration-pill`)
- Submit button in add task overlay (`#addTaskSubmit`)
- Any interactive UI element that requires immediate response

### Custom CSS Implementations
- **Dashed Borders**: Uses `repeating-linear-gradient` backgrounds for precise control over dash/gap spacing (2px dash + 5px gap)
- **Dynamic Viewport Height**: Uses `100dvh` instead of `100vh` for proper mobile browser support
  - **Why**: Chrome's URL bar causes `100vh` to include hidden space, creating unnecessary scrolling
  - **Solution**: `100dvh` dynamically adjusts based on URL bar visibility
  - **Result**: Task list only scrolls when content truly overflows, not because of viewport miscalculation

### Toast Notifications
- **User Feedback**: Small notifications appear above bottom navigation for task actions and sort mode changes

## Known Issues

### Mobile Browser Compatibility

#### Chrome Android - Keyboard Issues
- **Software Keyboard Covers Input**: ~~On Chrome Android, when the add/edit task overlay appears, the software keyboard covers the input field instead of positioning above it.~~
  - **Status**: ✅ **Resolved** using Visual Viewport API (input now stays visible)
  - **Solution**: 
    - Uses `window.visualViewport` to detect keyboard height changes
    - Delays focus by 2 animation frames to avoid race condition with keyboard transition
    - Listens to viewport `resize`/`scroll` events to keep input centered when keyboard opens
    - Calls `focus({ preventScroll: true })` then manually scrolls input into view
  - **Why it works**: Chrome's keyboard opening is async; waiting for transition frames prevents focusing with stale geometry. Visual Viewport API provides real-time keyboard height, allowing proper repositioning.
  - **Impact**: Input stays visible, but see note below about overlay behavior

- **Overlay Scrolls Page Content (Chrome Android)**: When the keyboard appears, Chrome Android pushes the page content upwards instead of treating the overlay as a true fixed overlay. Works correctly in Kiwi Browser (content stays in place behind overlay).
  - **Status**: Open for investigation
  - **Current Behavior**: Visual Viewport API ensures input stays visible, but page content beneath the overlay shifts when keyboard opens
  - **Ideal Behavior**: Overlay should remain truly fixed with page content stationary behind it
  - **Impact**: Non-breaking - input is functional, but visual behavior differs from other browsers

- **Keyboard Autocomplete Bar**: Chrome Android shows a QuickType/autofill bar above the keyboard with irrelevant suggestions (passwords, addresses, credit cards) even though the input is `type="text"` for task names.
  - **Status**: ❌ **Unresolved** - Chrome completely ignores all mitigation attempts
  - **Attempted Fixes** (all ineffective):
    - `autocomplete="off"` - ignored
    - `aria-autocomplete="none"` - ignored
    - `inputmode="text"` - ignored
    - `autocapitalize="sentences"` - ignored
    - `name="taskNameField"` (generic, non-PII) - ignored
  - **Chrome Behavior**: Completely disregards developer preferences and HTML standards; uses its own "smart" heuristics to force autofill suggestions regardless of explicit opt-out attributes
  - **Root Cause**: Chrome/Android IME has final control over autofill bar display; no HTML/CSS/JS solution exists without breaking accessibility
  - **Impact**: Moderate UX issue - wastes screen space with irrelevant password/credit card suggestions on a task name field; cannot be suppressed without contenteditable workarounds that would break accessibility
