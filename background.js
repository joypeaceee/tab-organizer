// background.js — Service worker for tab grouping & time tracking
import {
  getProjects,
  matchTabToProject,
  addTime,
  getTrackingPaused,
  pruneOldData,
  clearTimeData,
  incrementTabSwitchCount,
  resetTabSwitchCount,
} from "./utils/storage.js";

// ─── State ───────────────────────────────────────────────────────

let activeProjectName = null;
let activeTabStartTime = null;
let isUserIdle = false;

// Map project name → Chrome tab group ID (ephemeral, per session)
const groupIdMap = new Map();

// ─── Tab Grouping ────────────────────────────────────────────────

async function organizeTab(tabId, url, title = "") {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    return;
  }

  const projects = await getProjects();
  const matched = matchTabToProject(url, title, projects);

  if (!matched) return;

  const windowTab = await chrome.tabs.get(tabId);
  const windowId = windowTab.windowId;

  // Check if we already have a group for this project in this window
  let groupId = groupIdMap.get(`${matched.name}-${windowId}`);

  // Verify the group still exists
  if (groupId != null) {
    try {
      await chrome.tabGroups.get(groupId);
    } catch {
      groupIdMap.delete(`${matched.name}-${windowId}`);
      groupId = null;
    }
  }

  if (groupId != null) {
    await chrome.tabs.group({ tabIds: [tabId], groupId });
  } else {
    const newGroupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId } });
    await chrome.tabGroups.update(newGroupId, {
      title: matched.name,
      color: matched.color || "blue",
    });
    groupIdMap.set(`${matched.name}-${windowId}`, newGroupId);
  }
}

async function organizeAllTabs() {
  groupIdMap.clear();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url) {
      await organizeTab(tab.id, tab.url, tab.title || "");
    }
  }
}

// ─── Time Tracking ───────────────────────────────────────────────

async function startTrackingTab(tabId) {
  const paused = await getTrackingPaused();
  if (paused || isUserIdle) return;

  // Flush time for the previous project
  await flushActiveTime();

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith("chrome://")) {
      activeProjectName = "Uncategorized";
    } else {
      const projects = await getProjects();
      const matched = matchTabToProject(tab.url, tab.title || "", projects);
      activeProjectName = matched ? matched.name : "Uncategorized";
    }
  } catch {
    activeProjectName = "Uncategorized";
  }

  activeTabStartTime = Date.now();
}

async function flushActiveTime() {
  if (activeProjectName && activeTabStartTime) {
    const elapsed = (Date.now() - activeTabStartTime) / 1000;
    if (elapsed > 1) {
      await addTime(activeProjectName, elapsed);
    }
  }
  activeTabStartTime = Date.now();
}

// ─── Event Listeners ─────────────────────────────────────────────

// Tab URL changed — only update time tracking, no auto-grouping
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If this is the active tab and URL changed, update tracking
  if (changeInfo.url && tab.active) {
    startTrackingTab(tabId);
  }
});

// User switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  incrementTabSwitchCount();
  startTrackingTab(activeInfo.tabId);
});

// Window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus → flush
    await flushActiveTime();
    activeProjectName = null;
    activeTabStartTime = null;
  } else {
    // Find active tab in the focused window
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      startTrackingTab(tab.id);
    }
  }
});

// Idle detection
chrome.idle.setDetectionInterval(120); // 2 minutes

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "idle" || newState === "locked") {
    isUserIdle = true;
    await flushActiveTime();
    activeProjectName = null;
    activeTabStartTime = null;
  } else {
    isUserIdle = false;
    // Resume tracking the current active tab
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      startTrackingTab(tab.id);
    }
  }
});

// ─── Periodic Flush & Maintenance ────────────────────────────────

chrome.alarms.create("flush-time", { periodInMinutes: 0.5 }); // Every 30 seconds
chrome.alarms.create("daily-prune", { periodInMinutes: 1440 }); // Once a day

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "flush-time") {
    await flushActiveTime();
  }
  if (alarm.name === "daily-prune") {
    await pruneOldData(90);
  }
});

// ─── Clear All Tab Groups ────────────────────────────────────────

async function clearAllGroups() {
  groupIdMap.clear();
  const tabs = await chrome.tabs.query({});
  const groupedTabIds = tabs.filter((t) => t.groupId !== -1).map((t) => t.id);
  if (groupedTabIds.length > 0) {
    await chrome.tabs.ungroup(groupedTabIds);
  }
}

// ─── Message Handler (for popup / options communication) ─────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "organizeAllTabs") {
    organizeAllTabs().then(() => sendResponse({ success: true }));
    return true; // keep channel open for async response
  }
  if (message.action === "clearAllGroups") {
    clearAllGroups().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.action === "resetTimeData") {
    Promise.all([clearTimeData(), resetTabSwitchCount()]).then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.action === "getActiveProject") {
    sendResponse({ project: activeProjectName });
    return false;
  }
  if (message.action === "flushTime") {
    flushActiveTime().then(() => sendResponse({ success: true }));
    return true;
  }
});

// ─── Install / Startup ──────────────────────────────────────────

const DEFAULT_PRODUCTIVITY_PROJECT = {
  id: "default-productivity",
  name: "Productivity",
  color: "cyan",
  patterns: [
    // Email
    "*mail*",
    "*outlook*",
    "*gmail*",
    // Calendar
    "*calendar*",
    // Chat & Communication
    "chat.google.com/*",
    "*google chat*",
    "*hangouts*",
    "*slack*",
    "*workplace*",
    "*teams*",
    // AI assistants
    "*metamate*",
    "*analytics agent*",
    "*manus*",
    "*chatgpt*",
    "*claude*",
    "*copilot*",
    "*bard*",
    "*gemini*",
    // Other productivity
    "*notion*",
    "*asana*",
    "*trello*",
  ],
};

async function ensureProductivityProject() {
  const { projects } = await chrome.storage.sync.get({ projects: [] });
  const existingIdx = projects.findIndex((p) => p.id === "default-productivity" || p.name === "Productivity");

  if (existingIdx === -1) {
    // Add new Productivity project
    projects.push(DEFAULT_PRODUCTIVITY_PROJECT);
    await chrome.storage.sync.set({ projects });
  } else {
    // Update existing Productivity project with latest patterns
    projects[existingIdx] = {
      ...projects[existingIdx],
      patterns: DEFAULT_PRODUCTIVITY_PROJECT.patterns,
    };
    await chrome.storage.sync.set({ projects });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Ensure Productivity project exists (for both install and update)
  await ensureProductivityProject();
  // Do NOT auto-organize — user must click the button
});

chrome.runtime.onStartup.addListener(async () => {
  // Ensure Productivity project exists on browser startup
  await ensureProductivityProject();
  // Do NOT auto-organize — user must click the button
});
