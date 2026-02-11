# Tab Organizer & Project Time Tracker

A Chrome extension that automatically organizes browser tabs into groups based on project rules and tracks time spent on each project.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow)

## Features

### 🗂 Tab Grouping
- Group tabs by project using wildcard pattern matching
- Match against **tab titles** (not just URLs) for content-based grouping
- 3-pass priority matching: primary name → full title → URL
- Manual trigger only — no automatic grouping

### ⏱ Time Tracking
- Track time spent on each project per day
- Automatic pause on idle (2 minutes) or window blur
- Pause/resume toggle
- Reset all time data with one click

### 📊 Tab Switch Counter
- Count how many times you switch tabs
- Helps identify context-switching patterns

### 🎨 Dark-Themed UI
- Modern popup interface (360px wide)
- Horizontal bar chart for time visualization
- Quick project management (add/edit/delete)
- Settings page for advanced configuration

## Screenshots

*Popup showing time tracking and tab groups*

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/petechu/tab-organizer.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **"Load unpacked"** and select the cloned folder

5. The extension icon will appear in your toolbar

## Usage

### Quick Start

1. Click the extension icon to open the popup
2. Add your projects using the quick-add form (e.g., "EMG", "Malibu3")
   - Patterns are auto-generated as `*projectname*`
3. Click **"🗂 Organize All Tabs"** to group your tabs

### Project Matching

Tabs are matched using wildcard patterns (`*` = any characters):

| Pattern | Matches |
|---------|---------|
| `*EMG*` | Any tab with "EMG" in title or URL |
| `github.com/*` | All GitHub pages |
| `*meeting notes*` | Google Docs titled "Meeting Notes" |

### Default "Productivity" Project

On first install, a "Productivity" project is created with patterns for:
- Email: `*mail*`, `*outlook*`, `*gmail*`
- Calendar: `*calendar*`
- Chat: `*slack*`, `*teams*`, `*google chat*`
- AI: `*chatgpt*`, `*claude*`, `*copilot*`
- Productivity: `*notion*`, `*asana*`, `*trello*`

## File Structure

```
tab-organizer/
├── manifest.json           # Extension manifest (V3)
├── background.js           # Service worker
├── icons/                  # Extension icons
├── popup/                  # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── utils/
    └── storage.js          # Shared storage helpers
```

## Permissions

| Permission | Reason |
|------------|--------|
| `tabs` | Read tab URLs and titles for matching |
| `tabGroups` | Create and manage Chrome tab groups |
| `storage` | Save projects and time data |
| `idle` | Pause tracking when user is idle |
| `alarms` | Periodic time flushing and data pruning |

## Development

### Tech Stack
- Vanilla JavaScript (ES Modules)
- Chrome Extension Manifest V3
- No frameworks or build tools

### Key Files
- `utils/storage.js` — All storage operations and pattern matching
- `background.js` — Service worker for tab grouping and time tracking
- `popup/popup.js` — Popup UI logic

## License

MIT License — feel free to use and modify.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Author

Built with ❤️ for better tab management and productivity tracking.
