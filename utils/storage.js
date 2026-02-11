// utils/storage.js — Shared storage helpers for the Tab Organizer extension

const DEFAULT_PROJECTS = [
  {
    id: "default-uncategorized",
    name: "Uncategorized",
    color: "grey",
    patterns: [],
  },
];

const CHROME_GROUP_COLORS = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
];

// ─── Project Rules ───────────────────────────────────────────────

export async function getProjects() {
  const { projects } = await chrome.storage.sync.get({ projects: DEFAULT_PROJECTS });
  return projects;
}

export async function saveProjects(projects) {
  await chrome.storage.sync.set({ projects });
}

export async function addProject(project) {
  const projects = await getProjects();
  projects.push(project);
  await saveProjects(projects);
  return projects;
}

export async function updateProject(id, updates) {
  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) {
    projects[idx] = { ...projects[idx], ...updates };
    await saveProjects(projects);
  }
  return projects;
}

export async function deleteProject(id) {
  let projects = await getProjects();
  projects = projects.filter((p) => p.id !== id);
  await saveProjects(projects);
  return projects;
}

// ─── Time Tracking Data ──────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function getTimeData() {
  const { timeData } = await chrome.storage.local.get({ timeData: {} });
  return timeData;
}

export async function addTime(projectName, seconds) {
  const timeData = await getTimeData();
  const day = todayKey();
  if (!timeData[day]) timeData[day] = {};
  timeData[day][projectName] = (timeData[day][projectName] || 0) + seconds;
  await chrome.storage.local.set({ timeData });
}

export async function getTodayTime() {
  const timeData = await getTimeData();
  return timeData[todayKey()] || {};
}

export async function pruneOldData(keepDays = 90) {
  const timeData = await getTimeData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const dateKey of Object.keys(timeData)) {
    if (dateKey < cutoffStr) delete timeData[dateKey];
  }
  await chrome.storage.local.set({ timeData });
}

export async function clearTimeData() {
  await chrome.storage.local.set({ timeData: {} });
}

// ─── Tab Switch Counter ──────────────────────────────────────────

export async function getTabSwitchCount() {
  const { tabSwitchCount } = await chrome.storage.local.get({ tabSwitchCount: 0 });
  return tabSwitchCount;
}

export async function incrementTabSwitchCount() {
  const count = await getTabSwitchCount();
  await chrome.storage.local.set({ tabSwitchCount: count + 1 });
  return count + 1;
}

export async function resetTabSwitchCount() {
  await chrome.storage.local.set({ tabSwitchCount: 0 });
}

// ─── Tracking State ──────────────────────────────────────────────

export async function getTrackingPaused() {
  const { trackingPaused } = await chrome.storage.local.get({ trackingPaused: false });
  return trackingPaused;
}

export async function setTrackingPaused(paused) {
  await chrome.storage.local.set({ trackingPaused: paused });
}

// ─── URL / Title Matching ────────────────────────────────────────

export function textMatchesPattern(text, pattern) {
  // Convert simple wildcard pattern to regex
  // e.g. "github.com/myorg/*" → /github\.com\/myorg\/.*/i
  // e.g. "*EMG*" → /.*EMG.*/i
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(escaped, "i");
  return regex.test(text);
}

/**
 * Extract the primary name from a tab title.
 * For Google Drive/Docs/Sheets: "Folder Name - Google Drive" → "Folder Name"
 * For other tabs: strips common suffixes like " - Service Name"
 */
export function extractPrimaryName(title) {
  if (!title) return "";

  // Common suffixes to strip (Google services, browsers, etc.)
  const suffixes = [
    / - Google Drive$/i,
    / - Google Docs$/i,
    / - Google Sheets$/i,
    / - Google Slides$/i,
    / - Google Forms$/i,
    / – Google Drive$/i,  // en-dash variant
    / – Google Docs$/i,
    / — Google Drive$/i,  // em-dash variant
    / — Google Docs$/i,
  ];

  let primaryName = title;
  for (const suffix of suffixes) {
    primaryName = primaryName.replace(suffix, "");
  }

  return primaryName.trim();
}

export function matchTabToProject(url, title, projects) {
  // Extract the primary name (immediate folder/document name) for priority matching
  const primaryName = extractPrimaryName(title);

  // PASS 1: Match primary name only (highest priority - closest parent directory)
  for (const project of projects) {
    if (project.patterns && project.patterns.length > 0) {
      for (const pattern of project.patterns) {
        if (primaryName && textMatchesPattern(primaryName, pattern)) {
          return project;
        }
      }
    }
  }

  // PASS 2: Match against full title (may include breadcrumb path)
  for (const project of projects) {
    if (project.patterns && project.patterns.length > 0) {
      for (const pattern of project.patterns) {
        if (title && title !== primaryName && textMatchesPattern(title, pattern)) {
          return project;
        }
      }
    }
  }

  // PASS 3: Match against URL
  for (const project of projects) {
    if (project.patterns && project.patterns.length > 0) {
      for (const pattern of project.patterns) {
        if (textMatchesPattern(url, pattern)) {
          return project;
        }
      }
    }
  }

  return null; // No match → uncategorized
}

// Legacy alias for backward compatibility
export function matchUrlToProject(url, projects) {
  return matchTabToProject(url, "", projects);
}

// ─── Utilities ───────────────────────────────────────────────────

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export { CHROME_GROUP_COLORS, DEFAULT_PROJECTS };
