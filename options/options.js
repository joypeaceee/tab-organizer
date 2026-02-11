// options/options.js — Project rule CRUD + history/export
import {
  getProjects,
  saveProjects,
  deleteProject,
  getTimeData,
  generateId,
  formatTime,
  CHROME_GROUP_COLORS,
} from "../utils/storage.js";

// ─── DOM References ──────────────────────────────────────────────

const projectList = document.getElementById("project-list");
const addProjectBtn = document.getElementById("add-project-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalName = document.getElementById("modal-name");
const modalColor = document.getElementById("modal-color");
const modalPatterns = document.getElementById("modal-patterns");
const modalCancel = document.getElementById("modal-cancel");
const modalSave = document.getElementById("modal-save");
const historyRange = document.getElementById("history-range");
const historyTbody = document.getElementById("history-tbody");
const exportCsvBtn = document.getElementById("export-csv-btn");
const exportJsonBtn = document.getElementById("export-json-btn");

let editingProjectId = null;

// ─── Render Projects ─────────────────────────────────────────────

async function renderProjects() {
  const projects = await getProjects();
  projectList.innerHTML = "";

  for (const proj of projects) {
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <div class="project-color-dot color-${proj.color}"></div>
      <div class="project-info">
        <div class="project-name">${escapeHtml(proj.name)}</div>
        <div class="project-patterns">${proj.patterns.map(escapeHtml).join(", ") || "<em>No patterns</em>"}</div>
      </div>
      <div class="project-actions">
        <button class="btn btn-sm edit-btn" data-id="${proj.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${proj.id}">Delete</button>
      </div>
    `;
    projectList.appendChild(card);
  }

  // Attach event listeners
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.id));
  });
}

// ─── Modal ───────────────────────────────────────────────────────

function openAddModal() {
  editingProjectId = null;
  modalTitle.textContent = "Add Project";
  modalName.value = "";
  modalColor.value = "blue";
  modalPatterns.value = "";
  modalOverlay.classList.remove("hidden");
}

async function openEditModal(id) {
  const projects = await getProjects();
  const proj = projects.find((p) => p.id === id);
  if (!proj) return;

  editingProjectId = id;
  modalTitle.textContent = "Edit Project";
  modalName.value = proj.name;
  modalColor.value = proj.color;
  modalPatterns.value = (proj.patterns || []).join("\n");
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  editingProjectId = null;
}

async function handleSave() {
  const name = modalName.value.trim();
  if (!name) {
    modalName.focus();
    return;
  }

  const color = modalColor.value;
  const patterns = modalPatterns.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const projects = await getProjects();

  if (editingProjectId) {
    const idx = projects.findIndex((p) => p.id === editingProjectId);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], name, color, patterns };
    }
  } else {
    projects.push({ id: generateId(), name, color, patterns });
  }

  await saveProjects(projects);
  closeModal();
  renderProjects();
  // Tell background to re-organize tabs
  chrome.runtime.sendMessage({ action: "organizeAllTabs" });
}

async function handleDelete(id) {
  if (!confirm("Delete this project rule?")) return;
  await deleteProject(id);
  renderProjects();
  chrome.runtime.sendMessage({ action: "organizeAllTabs" });
}

// ─── History ─────────────────────────────────────────────────────

async function renderHistory() {
  const days = parseInt(historyRange.value, 10);
  const timeData = await getTimeData();

  const rows = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayData = timeData[key];
    if (!dayData) continue;
    for (const [project, seconds] of Object.entries(dayData)) {
      rows.push({ date: key, project, seconds });
    }
  }

  historyTbody.innerHTML = "";
  if (rows.length === 0) {
    historyTbody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted);text-align:center;">No data yet</td></tr>`;
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.date}</td><td>${escapeHtml(row.project)}</td><td>${formatTime(row.seconds)}</td>`;
    historyTbody.appendChild(tr);
  }
}

// ─── Export ──────────────────────────────────────────────────────

async function exportCSV() {
  const timeData = await getTimeData();
  let csv = "Date,Project,Seconds,Formatted\n";
  for (const [date, projects] of Object.entries(timeData).sort()) {
    for (const [project, seconds] of Object.entries(projects)) {
      csv += `${date},"${project}",${Math.round(seconds)},"${formatTime(seconds)}"\n`;
    }
  }
  downloadFile(csv, "tab-organizer-export.csv", "text/csv");
}

async function exportJSON() {
  const timeData = await getTimeData();
  const json = JSON.stringify(timeData, null, 2);
  downloadFile(json, "tab-organizer-export.json", "application/json");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Utilities ───────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ────────────────────────────────────────────────────────

addProjectBtn.addEventListener("click", openAddModal);
modalCancel.addEventListener("click", closeModal);
modalSave.addEventListener("click", handleSave);
historyRange.addEventListener("change", renderHistory);
exportCsvBtn.addEventListener("click", exportCSV);
exportJsonBtn.addEventListener("click", exportJSON);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

renderProjects();
renderHistory();
