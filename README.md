# Today Todo

## Description

**Core Concept:**
A minimal, phone-optimized todo app that enforces daily focus by resetting each day at a customizable time (default 4 AM).

**Key Features:**

**📝 Task Management:**
- Add tasks using the prominent + button (opens modal dialog)
- Check off completed tasks
- Edit tasks by tapping on them
- Delete tasks by swiping left (native app-like gesture, 50% threshold)
- Undo accidental deletes with a 5-second toast notification
- Clear all tasks via Settings (with confirmation)

**⏰ Duration Tracking:**
- Automatically detects time estimates in task names (1h, 30min, 2h30m, etc.)
- Shows total remaining time for unfinished tasks in the header
- **Duration Pills**: Quick-select buttons (0, 5m, 15m, 30m, 1h, 2h, 3h) for fast task creation
- **Auto-submit**: Selecting a duration pill with existing text immediately creates the task
- **Round Duration**: Optional setting to round total time up to the nearest 30-minute increment

**⏱️ Countdown Timer:**
- Tap the duration badge on any task to open a full-screen countdown timer
- Auto-starts immediately when opened
- Visual clock face (SVG pie sector) that drains clockwise as time elapses
- Multi-clock layout for tasks longer than 1 hour: big clock = current draining hour, small clocks = future hours still waiting
- For tasks > 4 hours: shows 2 small clocks + a red-bordered "+n" overflow label
- Shows task name above the clock (3-line clamp with ellipsis)
- Displays projected finish time (e.g. "→ 14:30")
- On close, automatically subtracts elapsed time from the task duration (rounded down to nearest 5 minutes)
- Timer state is persisted to localStorage — survives app restarts and background/foreground cycles

**🔢 Sort Modes:**
- Cycle through three modes using the sort button (bottom-left) or the Sort by setting:
  - **Creation** (default): tasks in the order they were added, stable across reorders
  - **Duration**: longest-first, no-duration and completed tasks at the bottom
  - **Manual**: drag-and-drop reordering with a grip handle on each task; order is persisted and survives switching to other sort modes and back

**🔄 Daily Reset Philosophy:**
- Automatic reset at a customizable time (default 4 AM, configurable in settings)
- Modal automatically appears when reset time is reached (checks every minute, and on app foreground)
- Shows yesterday's unfinished tasks in a non-dismissible modal
- Only option is "Clear & start today" — modal cannot be dismissed by tapping outside
- No carrying over old tasks — forces you to consciously re-add what's truly important
- Custom 24-hour time picker works across all devices and platforms
- Reset countdown shown as a subtitle under the "Day resets at" setting

**📱 Design:**
- Clean black interface optimized for phones
- Fixed header showing day, date, and remaining time
- **Day Progress Bar**: Thin bar below the header showing how much of the day has elapsed
- **Sunrise/Sunset Indicators**: Shows actual sunrise/sunset times using [SunCalc](https://github.com/mourner/suncalc) (requires location permission); hidden when outside the current awake window
- **Only Show Awake Time**: Optional setting that makes the progress bar represent your 16-hour awake window (wake time = reset time + 8h) instead of the full 24-hour day
- Bottom navigation: sort button (left), add button (center), settings button (right)
- OLED-friendly dark theme
- Prominent empty state with philosophical messaging

**🔄 PWA Updates:**
- Automatic update detection when new versions are available
- Visual notification banner when updates are ready
- One-click update process
- Automatic page refresh after update installation
- Network-first caching strategy for always-fresh content

**The Philosophy:**
If something was truly important, you'll remember to add it again today. This prevents task list bloat and keeps you focused on what really matters each day.

## Tech stack

Only HTML, CSS and JS. PWA. Saves tasks in localStorage. No build step, no dependencies beyond SunCalc (CDN) and Inter (Google Fonts).

## Deployment & Updates

### Version Update Process
When you make changes to the code, you **must** update the version number in 4 places:

1. **`sw.js`**: Change the `VERSION` constant — creates a new cache name and triggers the update flow
2. **`manifest.json`**: Change the `version` field to match
3. **`index.html`**: Change the `?v=` query parameters on the CSS and JS `<link>`/`<script>` tags
4. **`app.js`**: Change the version string in the `emailFeedbackLink` click handler (subject line)

Then commit and push.

### Why Version Updates Matter
- **Service Worker Detection**: Changing `VERSION` in `sw.js` creates a new cache name
- **Forces Refresh**: Service worker detects the change and installs the new version
- **Cache Busting**: Old caches are automatically cleaned up
- **User Updates**: Users see a banner and can refresh with one tap

### How Updates Work
1. **Detection**: Service worker detects a new `sw.js` file with a different version
2. **Notification**: Users see an update banner when the new version is ready
3. **Installation**: One-click update process
4. **Activation**: Page automatically refreshes with the new version
5. **Cache Cleanup**: Old caches are deleted, new version is cached

## Development Notes

### Testing/Debugging Features
- **Simulate Next Day**: Long press the Settings button (gear icon) for 1 second to trigger the daily reset modal. Normal tap opens Settings, long press triggers the reset simulation.

### Settings Reference
| Setting | Default | Description |
|---|---|---|
| Day resets at | 04:00 | Custom 24-hour time picker. Subtitle shows countdown to next reset. |
| Sort by | Creation | Cycles: Creation → Duration → Manual |
| Round total duration up | No | Rounds header total to nearest 30 min |
| Location Access | No | Enables sunrise/sunset indicators (SunCalc) |
| Only show awake time | No | Progress bar = awake window (reset+8h → reset); hides out-of-window sun indicators |
| Auto-add emojis | Yes | Prepends a relevant emoji to task names on creation |

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
- **Dynamic Viewport Height**: Uses `100svh` (small viewport height) for proper mobile PWA support — avoids URL bar causing unnecessary scrollbars
- **Swipe-to-Delete**: Custom touch implementation with two-stage feedback (gray "Delete" label → red background when 50vw threshold is crossed). Left swipe only; right swipe and vertical scroll are ignored.
- **Drag-to-Reorder**: HTML5 Drag API (desktop) + `elementFromPoint` touch tracking (mobile). Position determined by cursor/touch top/bottom half of target. Sticky edges: dragging past the first or last item snaps the indicator to first/before or last/after.

### Timer Architecture
- `timerOriginalSeconds` + `timerRemainingSeconds` → `getTimerBuckets()` computes which hour bucket is currently draining and which are still waiting
- Big clock = current draining bucket, small clocks = future buckets (static until their turn)
- `timerPlayStartAt` + `timerRemainingAtPlayStart` store the wall-clock anchor so elapsed time is always computed from real time, not tick accumulation — survives tab switching and backgrounding
- On close: `elapsedSeconds` → rounded down to 5-min increments → subtracted from `task.duration`

### Toast Notifications
- **User Feedback**: Small notifications appear above bottom navigation for task actions and sort mode changes
- **Undo Functionality**: Swipe-to-delete includes a 5-second undo toast with an "Undo" link

### Task Animations
- **Check Animation**: When marking tasks complete, checkbox bounces and fades from white to gray
- **Bouncy Easing**: Uses `cubic-bezier(0.68, -0.55, 0.265, 1.55)` for natural bounce effect
- **Color Transitions**: Smooth fade from white to gray for both checkbox and text

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

- **Overlay Scrolls Page Content (Chrome Android)**: When the keyboard appears, Chrome Android pushes the page content upwards instead of treating the overlay as a true fixed overlay. Works correctly in Kiwi Browser (content stays in place behind overlay).
  - **Status**: Open for investigation
  - **Current Behavior**: Visual Viewport API ensures input stays visible, but page content beneath the overlay shifts when keyboard opens
  - **Ideal Behavior**: Overlay should remain truly fixed with page content stationary behind it
  - **Impact**: Non-breaking — input is functional, but visual behavior differs from other browsers

- **Keyboard Autocomplete Bar**: Chrome Android shows a QuickType/autofill bar above the keyboard with irrelevant suggestions (passwords, addresses, credit cards) even though the input is `type="text"` for task names.
  - **Status**: ✅ **User-Resolvable** — can be resolved by changing autofill provider
  - **Developer Fixes Attempted** (all ineffective): `autocomplete="off"`, `aria-autocomplete="none"`, `inputmode="text"`, `autocapitalize="sentences"`, `name="taskNameField"`
  - **Chrome Behavior**: Completely disregards developer preferences; uses its own heuristics to force autofill regardless of explicit opt-out attributes
  - **User Solution**: Change autofill provider from Chrome to a password manager (e.g., Bitwarden, 1Password)
  - **Impact**: Minor UX issue
