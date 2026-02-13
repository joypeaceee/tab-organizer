# Chrome Tab Organizer Extension — Generation Prompt

Use this prompt to generate a Chrome extension with the exact same functionality and UI.

---

## Overview

Build a **Chrome Extension (Manifest V3)** called "Tab Organizer & Project Time Tracker" that:
1. Groups browser tabs into Chrome Tab Groups based on user-defined project rules
2. Tracks time spent on each project
3. Counts tab switches since last reset
4. Provides a dark-themed popup UI for quick access
5. Provides a settings page for advanced project management and data export

---

## Tech Stack

- **Vanilla JavaScript** (ES Modules)
- **Chrome Extension Manifest V3**
- **Chrome APIs**: `tabs`, `tabGroups`, `storage`, `idle`, `alarms`, `runtime`
- **No frameworks or build tools** — pure HTML/CSS/JS

---

## File Structure

```
tab-organizer/
├── manifest.json
├── background.js              # Service worker
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
└── utils/
    └── storage.js             # Shared storage helpers
```

---

## Feature Specifications

### 1. Tab Grouping (Manual Trigger Only)

- **NO automatic grouping** on tab create/update/startup
- Tabs are ONLY grouped when user clicks "Organize All Tabs" button
- Match tabs to projects using a **3-pass priority system**:
  1. **Primary name** (extracted from title, e.g., "Document Name" from "Document Name - Google Docs")
  2. **Full tab title**
  3. **URL**
- Pattern matching uses **wildcards** (`*` = any characters, case-insensitive)
- Each project has: `id`, `name`, `color` (Chrome tab group color), `patterns[]`

### 2. Time Tracking

- Track active tab time per project per day
- Pause tracking when:
  - User is idle (2 minutes)
  - Browser window loses focus
  - User manually pauses
- Flush accumulated time every 30 seconds via alarm
- Store time data in `chrome.storage.local` keyed by date (`YYYY-MM-DD`)
- Prune data older than 90 days (daily alarm)
- Reset all time data via button (with confirmation)

### 3. Tab Switch Counter

- Increment counter on every `chrome.tabs.onActivated` event
- Display count in popup
- Reset counter when time tracker is reset

### 4. Default "Productivity" Project

On install/startup, ensure a "Productivity" project exists with these patterns:
```
*mail*, *outlook*, *gmail*, *calendar*,
chat.google.com/*, *google chat*, *hangouts*, *slack*, *workplace*, *teams*,
*metamate*, *analytics agent*, *manus*, *chatgpt*, *claude*, *copilot*, *bard*, *gemini*,
*notion*, *asana*, *trello*
```

---

## UI Specifications

### Popup (360px wide, dark theme)

**Header:**
- Title: "📊 Tab Organizer"
- Pause/Resume button (⏸/▶)
- Settings button (⚙️)

**Active Project Badge:**
- Shows "Currently tracking: [Project Name]"

**Today Section:**
- Header with "TODAY" label and 🔄 reset button (top-right)
- Two stats side by side:
  - Total time (e.g., "1h 23m")
  - Tab switches count (e.g., "47")
- Horizontal bar chart showing time per project:
  - Bar width proportional to percentage of total
  - Color-coded by project color
  - Shows project name and formatted time

**Tab Groups Section:**
- Lists all Chrome tab groups with:
  - Color dot
  - Group title
  - Tab count

**Projects Section:**
- Quick-add form: text input + color dropdown + "+" button
- Auto-generates pattern as `*projectname*`
- List of existing projects with edit (✏️) and delete (🗑) buttons
- Inline editing with save/cancel

**Action Buttons:**
- "🗂 Organize All Tabs" (primary)
- "🗑 Clear All Groups" (danger outline)

### Settings Page (Options)

**Project Rules Section:**
- List of project cards showing name, color dot, patterns
- Edit/Delete buttons per project
- "+ Add Project" button opens modal

**Modal for Add/Edit:**
- Project name input
- Color dropdown (all Chrome tab group colors)
- Patterns textarea (one per line, e.g., `*ProjectName*`, `github.com/myorg/*`)

**History & Export Section:**
- Date range dropdown (7/14/30/90 days)
- Export CSV button
- Export JSON button
- Table showing date, project, time

---

## Color Palette (CSS Variables)

```css
:root {
  --bg: #1a1a2e;
  --surface: #16213e;
  --surface-hover: #1a2744;
  --border: #2a3a5c;
  --text: #e0e0e0;
  --text-muted: #8892a4;
  --primary: #4a9eff;
  --primary-hover: #3a8eef;
  --danger: #ff4a6a;
  --radius: 8px;
}
```

**Chrome Tab Group Colors:**
```
grey: #9aa0a6, blue: #4a9eff, red: #ff4a6a, yellow: #ffd54f,
green: #4caf50, pink: #f06292, purple: #b388ff, cyan: #4dd0e1, orange: #ff9800
```

---

## Key Implementation Details

### Pattern Matching Priority

```javascript
function matchTabToProject(url, title, projects) {
  const primaryName = extractPrimaryName(title); // Strip " - Google Docs" etc.

  // PASS 1: Match primary name (highest priority)
  for (const project of projects) {
    for (const pattern of project.patterns) {
      if (textMatchesPattern(primaryName, pattern)) return project;
    }
  }

  // PASS 2: Match full title
  for (const project of projects) {
    for (const pattern of project.patterns) {
      if (textMatchesPattern(title, pattern)) return project;
    }
  }

  // PASS 3: Match URL
  for (const project of projects) {
    for (const pattern of project.patterns) {
      if (textMatchesPattern(url, pattern)) return project;
    }
  }

  return null;
}
```

### Extract Primary Name

Strip common suffixes from tab titles:
- ` - Google Drive`, ` - Google Docs`, ` - Google Sheets`, ` - Google Slides`
- Handle en-dash (–) and em-dash (—) variants

### Wildcard Pattern Matching

```javascript
function textMatchesPattern(text, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped, "i").test(text);
}
```

### Time Formatting

```javascript
function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
```

### Message Actions (background ↔ popup)

| Action | Description |
|--------|-------------|
| `organizeAllTabs` | Group all tabs by project rules |
| `clearAllGroups` | Ungroup all tabs |
| `resetTimeData` | Clear all time data + tab switch count |
| `getActiveProject` | Get currently tracked project name |
| `flushTime` | Flush accumulated time to storage |

---

## Storage Schema

### `chrome.storage.sync` (synced across devices)
```javascript
{
  projects: [
    { id: "string", name: "string", color: "string", patterns: ["string"] }
  ]
}
```

### `chrome.storage.local` (local only)
```javascript
{
  timeData: {
    "2024-01-15": { "Project A": 3600, "Project B": 1800 }
  },
  tabSwitchCount: 47,
  trackingPaused: false
}
```

---

## Manifest.json

```json
{
  "manifest_version": 3,
  "name": "Tab Organizer & Project Time Tracker",
  "version": "1.0.0",
  "description": "Automatically organize tabs by project and track time spent per project each day.",
  "permissions": ["tabs", "tabGroups", "storage", "idle", "alarms"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "options_page": "options/options.html",
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
```

---

## Icons

Generate simple placeholder icons (16x16, 48x48, 128x128):
- Blue rounded square background (#4a9eff)
- White "tab" shape icon inside

---

## Testing Checklist

1. Load unpacked at `chrome://extensions`
2. Default "Productivity" project auto-created
3. Popup shows current tracking project + time + tab switches
4. "Organize All Tabs" groups tabs by matching rules
5. "Clear All Groups" ungroups all tabs
6. Add/Edit/Delete projects in popup (auto-generates `*name*` pattern)
7. Edit patterns manually in Settings page
8. Pause/Resume tracking works
9. Reset time clears all data (with confirmation)
10. Time persists across browser restarts
11. CSV/JSON export works in Settings
