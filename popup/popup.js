// popup/popup.js — Popup UI logic
import {
  getTodayTime,
  getTrackingPaused,
  setTrackingPaused,
  formatTime,
  getProjects,
  saveProjects,
  generateId,
  getTabSwitchCount,
} from "../utils/storage.js";

// ─── DOM References ──────────────────────────────────────────────

const activeProjectName = document.getElementById("active-project-name");
const todayTotal = document.getElementById("today-total");
const tabSwitchCountEl = document.getElementById("tab-switch-count");
const todayBars = document.getElementById("today-bars");
const tabGroupsContainer = document.getElementById("tab-groups");
const pauseBtn = document.getElementById("pause-btn");
const organizeBtn = document.getElementById("organize-btn");
const clearGroupsBtn = document.getElementById("clear-groups-btn");
const resetTimeBtn = document.getElementById("reset-time-btn");
const settingsBtn = document.getElementById("settings-btn");

// Project management elements
const newProjectName = document.getElementById("new-project-name");
const newProjectColor = document.getElementById("new-project-color");
const addProjectBtn = document.getElementById("add-project-btn");
const projectList = document.getElementById("project-list");

// ─── Active Project ──────────────────────────────────────────────

async function refreshActiveProject() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getActiveProject" });
    activeProjectName.textContent = response?.project || "—";
  } catch {
    activeProjectName.textContent = "—";
  }
}

// ─── Today's Time ────────────────────────────────────────────────

async function refreshTodayTime() {
  const todayData = await getTodayTime();
  const projects = await getProjects();
  const switchCount = await getTabSwitchCount();

  // Update tab switch count
  tabSwitchCountEl.textContent = switchCount.toLocaleString();

  // Build a color map from project settings
  const colorMap = {};
  for (const p of projects) {
    colorMap[p.name] = p.color || "grey";
  }

  const entries = Object.entries(todayData).filter(([, secs]) => secs > 0);
  const totalSeconds = entries.reduce((sum, [, secs]) => sum + secs, 0);

  todayTotal.textContent = totalSeconds > 0 ? formatTime(totalSeconds) : "0s";

  // Sort by time descending
  entries.sort((a, b) => b[1] - a[1]);

  todayBars.innerHTML = "";

  for (const [name, secs] of entries) {
    const pct = totalSeconds > 0 ? (secs / totalSeconds) * 100 : 0;
    const color = colorMap[name] || "grey";

    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = name;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = `bar-fill bar-${color}`;
    fill.style.width = `${Math.max(pct, 2)}%`;

    const time = document.createElement("span");
    time.className = "bar-time";
    time.textContent = formatTime(secs);

    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(time);
    todayBars.appendChild(row);
  }
}

// ─── Tab Groups ──────────────────────────────────────────────────

async function refreshTabGroups() {
  tabGroupsContainer.innerHTML = "";

  try {
    const groups = await chrome.tabGroups.query({});
    const tabs = await chrome.tabs.query({});

    if (groups.length === 0) {
      tabGroupsContainer.innerHTML = '<div class="empty-state">No tab groups yet</div>';
      return;
    }

    // Count tabs per group
    const tabCounts = {};
    for (const tab of tabs) {
      if (tab.groupId !== -1) {
        tabCounts[tab.groupId] = (tabCounts[tab.groupId] || 0) + 1;
      }
    }

    for (const group of groups) {
      const card = document.createElement("div");
      card.className = "group-card";

      const dot = document.createElement("span");
      dot.className = `group-dot color-${group.color || "grey"}`;

      const title = document.createElement("span");
      title.className = "group-title";
      title.textContent = group.title || "Untitled";

      const count = document.createElement("span");
      count.className = "group-count";
      count.textContent = `${tabCounts[group.id] || 0} tab${(tabCounts[group.id] || 0) !== 1 ? "s" : ""}`;

      card.appendChild(dot);
      card.appendChild(title);
      card.appendChild(count);
      tabGroupsContainer.appendChild(card);
    }
  } catch {
    tabGroupsContainer.innerHTML = '<div class="empty-state">Unable to read tab groups</div>';
  }
}

// ─── Pause / Resume Toggle ───────────────────────────────────────

async function initPauseButton() {
  const paused = await getTrackingPaused();
  updatePauseIcon(paused);
}

function updatePauseIcon(paused) {
  if (paused) {
    pauseBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  } else {
    pauseBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  }
  pauseBtn.title = paused ? "Resume tracking" : "Pause tracking";
}

pauseBtn.addEventListener("click", async () => {
  const wasPaused = await getTrackingPaused();
  const nowPaused = !wasPaused;

  if (nowPaused) {
    // Flush accumulated time before pausing
    try {
      await chrome.runtime.sendMessage({ action: "flushTime" });
    } catch {
      // background may not be ready
    }
  }

  await setTrackingPaused(nowPaused);
  updatePauseIcon(nowPaused);
});

// ─── Organize All Tabs ───────────────────────────────────────────

organizeBtn.addEventListener("click", async () => {
  organizeBtn.disabled = true;
  organizeBtn.textContent = "Organizing…";

  try {
    await chrome.runtime.sendMessage({ action: "organizeAllTabs" });
  } catch {
    // ignore
  }

  organizeBtn.textContent = "Done!";
  await refreshTabGroups();
  setTimeout(() => {
    organizeBtn.disabled = false;
    organizeBtn.textContent = "Organize Tabs";
  }, 1200);
});

// ─── Clear All Groups ────────────────────────────────────────────

clearGroupsBtn.addEventListener("click", async () => {
  clearGroupsBtn.disabled = true;
  clearGroupsBtn.textContent = "Clearing…";

  try {
    await chrome.runtime.sendMessage({ action: "clearAllGroups" });
  } catch {
    // ignore
  }

  clearGroupsBtn.textContent = "Cleared!";
  await refreshTabGroups();
  setTimeout(() => {
    clearGroupsBtn.disabled = false;
    clearGroupsBtn.textContent = "Clear Groups";
  }, 1200);
});

// ─── Reset Time Tracker ──────────────────────────────────────────

resetTimeBtn.addEventListener("click", async () => {
  if (!confirm("Reset all time tracking data? This cannot be undone.")) {
    return;
  }

  resetTimeBtn.disabled = true;
  resetTimeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/></svg>';

  try {
    await chrome.runtime.sendMessage({ action: "resetTimeData" });
  } catch {
    // ignore
  }

  resetTimeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  await refreshTodayTime();
  setTimeout(() => {
    resetTimeBtn.disabled = false;
    resetTimeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  }, 1200);
});

// ─── Settings Button ─────────────────────────────────────────────

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// ─── Project Management ──────────────────────────────────────────

async function renderProjects() {
  const projects = await getProjects();
  projectList.innerHTML = "";

  for (const proj of projects) {
    const item = document.createElement("div");
    item.className = "project-item";
    item.dataset.id = proj.id;

    const dot = document.createElement("span");
    dot.className = `project-dot color-${proj.color || "grey"}`;

    const nameSpan = document.createElement("span");
    nameSpan.className = "project-name";
    nameSpan.textContent = proj.name;

    const editBtn = document.createElement("button");
    editBtn.className = "project-action-btn edit";
    editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => startEditProject(proj.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "project-action-btn delete";
    deleteBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", () => deleteProject(proj.id));

    item.appendChild(dot);
    item.appendChild(nameSpan);
    item.appendChild(editBtn);
    item.appendChild(deleteBtn);
    projectList.appendChild(item);
  }
}

async function addProject() {
  const name = newProjectName.value.trim();
  if (!name) return;

  const color = newProjectColor.value;
  const projects = await getProjects();

  // Auto-generate pattern as *name*
  const pattern = `*${name}*`;

  projects.push({
    id: generateId(),
    name,
    color,
    patterns: [pattern],
  });

  await saveProjects(projects);
  newProjectName.value = "";
  await renderProjects();

  // Re-organize tabs with new project
  try {
    await chrome.runtime.sendMessage({ action: "organizeAllTabs" });
    await refreshTabGroups();
  } catch {
    // ignore
  }
}

async function deleteProject(id) {
  const projects = await getProjects();
  const filtered = projects.filter((p) => p.id !== id);
  await saveProjects(filtered);
  await renderProjects();

  // Re-organize tabs
  try {
    await chrome.runtime.sendMessage({ action: "organizeAllTabs" });
    await refreshTabGroups();
  } catch {
    // ignore
  }
}

async function startEditProject(id) {
  const projects = await getProjects();
  const proj = projects.find((p) => p.id === id);
  if (!proj) return;

  const item = projectList.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  // Replace content with edit form
  item.innerHTML = "";
  item.className = "project-item editing";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = proj.name;

  const colorSelect = document.createElement("select");
  colorSelect.className = "edit-color";
  const colors = ["blue", "green", "purple", "red", "yellow", "pink", "cyan", "orange", "grey"];
  const colorEmojis = { blue: "🔵", green: "🟢", purple: "🟣", red: "🔴", yellow: "🟡", pink: "🩷", cyan: "🩵", orange: "🟠", grey: "⚪" };
  for (const c of colors) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = colorEmojis[c];
    if (c === proj.color) opt.selected = true;
    colorSelect.appendChild(opt);
  }

  const saveBtn = document.createElement("button");
  saveBtn.className = "project-action-btn save";
  saveBtn.textContent = "✓";
  saveBtn.title = "Save";
  saveBtn.addEventListener("click", () => saveEditProject(id, input.value, colorSelect.value));

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "project-action-btn cancel";
  cancelBtn.textContent = "✕";
  cancelBtn.title = "Cancel";
  cancelBtn.addEventListener("click", () => renderProjects());

  item.appendChild(input);
  item.appendChild(colorSelect);
  item.appendChild(saveBtn);
  item.appendChild(cancelBtn);

  input.focus();
  input.select();
}

async function saveEditProject(id, newName, newColor) {
  const name = newName.trim();
  if (!name) return;

  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;

  // Update name, color, and regenerate pattern
  projects[idx].name = name;
  projects[idx].color = newColor;
  projects[idx].patterns = [`*${name}*`];

  await saveProjects(projects);
  await renderProjects();

  // Re-organize tabs
  try {
    await chrome.runtime.sendMessage({ action: "organizeAllTabs" });
    await refreshTabGroups();
  } catch {
    // ignore
  }
}

addProjectBtn.addEventListener("click", addProject);

newProjectName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addProject();
});

// ─── Refresh All ─────────────────────────────────────────────────

async function refreshAll() {
  await Promise.all([refreshActiveProject(), refreshTodayTime(), refreshTabGroups()]);
}

// ─── Init ────────────────────────────────────────────────────────

refreshAll();
initPauseButton();
renderProjects();

// Auto-refresh every 5 seconds while popup is open
setInterval(refreshAll, 5000);
