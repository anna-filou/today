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

**The Philosophy:**
If something was truly important, you'll remember to add it again today. This prevents task list bloat and keeps you focused on what really matters each day.

## Tech stack

Only HTML, CSS and JS. PWA. Saves tasks in local storage.
