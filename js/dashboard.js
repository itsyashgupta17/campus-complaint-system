const table = document.getElementById("complaintTable");
const searchInput = document.getElementById("searchInput");

let dashboardComplaints = [];

async function loadDashboardData() {
  if (typeof apiGetComplaints === "function") {
    dashboardComplaints = await apiGetComplaints();
  } else if (typeof getComplaints === "function") {
    dashboardComplaints = getComplaints();
  }
  return dashboardComplaints;
}

function renderComplaints(searchTerm = "") {
  if (!table) return;
  const term = searchTerm.trim().toLowerCase();
  const data = dashboardComplaints;
  
  const filtered = data.filter(c =>
    [c.date, c.complainant || c.name || c.title, c.category, c.status].join(" ").toLowerCase().includes(term)
  );

  table.innerHTML = "";
  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#7b8798;">No complaints recorded yet. New complaints will appear here in real time.</td></tr>';
    return;
  }

  // Show the latest 5 items as recent complaints
  filtered.slice(0, 5).forEach(c => {
    const row = document.createElement("tr");

    // Date
    const tdDate = document.createElement("td");
    tdDate.textContent = c.date;
    row.appendChild(tdDate);

    // Complainant / Title
    const tdName = document.createElement("td");
    tdName.textContent = c.complainant || c.title || c.name || "Student";
    row.appendChild(tdName);

    // Category
    const tdCategory = document.createElement("td");
    tdCategory.textContent = c.category;
    row.appendChild(tdCategory);

    // Status Badge
    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    const statusClass = { "Open": "open", "In Progress": "progress", "Closed": "closed" }[c.status] || "open";
    badge.className = `status ${statusClass}`;
    badge.textContent = c.status;
    tdStatus.appendChild(badge);
    row.appendChild(tdStatus);

    table.appendChild(row);
  });
}

function updateStatistics() {
  const data = dashboardComplaints;
  const pendingEl = document.getElementById("pendingCount");
  const progressEl = document.getElementById("progressCount");
  const resolvedEl = document.getElementById("resolvedCount");
  const serviceLevelEl = document.getElementById("serviceLevelValue");

  const pending = data.filter(c => c.status === "Open").length;
  const progress = data.filter(c => c.status === "In Progress").length;
  const resolved = data.filter(c => c.status === "Closed").length;
  const total = data.length;

  if (pendingEl) pendingEl.textContent = pending;
  if (progressEl) progressEl.textContent = progress;
  if (resolvedEl) resolvedEl.textContent = resolved;

  if (serviceLevelEl) {
    if (total === 0) {
      serviceLevelEl.textContent = "100%";
    } else {
      const rate = ((resolved / total) * 100).toFixed(1);
      serviceLevelEl.textContent = `${rate}%`;
    }
  }
}

function renderCategories() {
  const el = document.getElementById("categoryList");
  if (!el) return;

  const data = dashboardComplaints;
  const categories = [
    { name: "Electricity", color: "#e58a2b" },
    { name: "Wi-Fi", color: "#3478df" },
    { name: "Water Supply", color: "#f39a2d" },
    { name: "Cleanliness", color: "#19b77b" },
    { name: "Classroom Maintenance", color: "#8b6de9" }
  ];

  const categoryData = categories.map(cat => {
    return { ...cat, count: data.filter(c => c.category === cat.name).length };
  });

  const totalComplaints = data.length;
  const max = Math.max(1, ...categoryData.map(c => c.count));
  el.innerHTML = "";

  if (totalComplaints === 0) {
    el.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#94a3b8;font-size:13px;">No complaints registered yet across categories.</div>';
    return;
  }

  categoryData.forEach(c => {
    const item = document.createElement("div");
    item.className = "category-item";
    const label = c.count === 1 ? "complaint" : "complaints";
    item.innerHTML = `
      <div class="category-top">
        <span>${c.name}</span>
        <span>${c.count} ${label}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(c.count / max) * 100}%;background:${c.color}"></div>
      </div>
    `;
    el.appendChild(item);
  });
}

async function refreshDashboard() {
  await loadDashboardData();
  renderComplaints(searchInput ? searchInput.value : "");
  updateStatistics();
  renderCategories();
}

async function initDashboard() {
  if (searchInput) {
    searchInput.addEventListener("input", e => renderComplaints(e.target.value));
  }
  await refreshDashboard();
}

window.addEventListener("storage", event => {
  if (event.key === "parul_campus_complaints") refreshDashboard();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}