// Backend API Configuration
const API_BASE = "http://localhost:5000/api";

// Shared Data & State
const DEFAULT_COMPLAINTS = [];

function getComplaints() {
  try {
    const saved = localStorage.getItem("parul_campus_complaints");
    if (saved !== null) {
      const complaints = JSON.parse(saved);
      if (Array.isArray(complaints)) {
        // Exclude any legacy demo records
        return complaints.filter(c => !["#C001", "#C002", "#C003", "#C004", "#C005", "#C006"].includes(c.id));
      }
    }
  } catch (e) {
    console.error("Could not read locally saved complaints.", e);
  }
  return [];
}

function saveComplaints(data) {
  try {
    localStorage.setItem("parul_campus_complaints", JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Could not save complaints in this browser.", e);
    return false;
  }
}

// Global reference for backward compatibility
var complaints = getComplaints();

// Live MongoDB API Handlers
async function apiGetComplaints() {
  try {
    const response = await fetch(`${API_BASE}/complaints`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    saveComplaints(data);
    complaints = data;
    return data;
  } catch (err) {
    console.warn("Backend API offline or unreachable, using local data fallback:", err.message);
    return getComplaints();
  }
}

async function apiCreateComplaint(payload) {
  try {
    const response = await fetch(`${API_BASE}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed with status ${response.status}`);
    }
    const created = await response.json();
    const current = getComplaints();
    saveComplaints([created, ...current]);
    return created;
  } catch (err) {
    console.warn("Backend API offline, falling back to local creation:", err.message);
    const current = getComplaints();
    const highestId = current.reduce((highest, complaint) => {
      const match = /^#C(\d+)$/.exec(complaint.id);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const newId = `#C${String(highestId + 1).padStart(3, "0")}`;
    const fallbackComplaint = {
      id: newId,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      createdAt: new Date().toISOString().slice(0, 10),
      complainant: payload.complainant,
      title: payload.title,
      category: payload.category,
      status: "Open"
    };
    saveComplaints([fallbackComplaint, ...current]);
    return fallbackComplaint;
  }
}

async function apiUpdateComplaintStatus(id, newStatus) {
  try {
    const response = await fetch(`${API_BASE}/complaints/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed with status ${response.status}`);
    }
    const updated = await response.json();
    const current = getComplaints();
    const index = current.findIndex(c => c.id === id);
    if (index !== -1) {
      current[index].status = newStatus;
      saveComplaints(current);
    }
    return updated;
  } catch (err) {
    console.warn("Backend API offline, falling back to local update:", err.message);
    const current = getComplaints();
    const item = current.find(c => c.id === id);
    if (item) {
      item.status = newStatus;
      saveComplaints(current);
    }
    return item;
  }
}

function setupCommon() {
  // Mobile sidebar drawer
  const menu = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");

  if (menu && sidebar) {
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== menu) {
        sidebar.classList.remove("open");
      }
    });
  }

  // Update date badge if present
  const dateBadge = document.querySelector(".date-badge");
  if (dateBadge && !dateBadge.textContent.trim()) {
    const now = new Date();
    const options = { day: "numeric", month: "short", year: "numeric" };
    dateBadge.textContent = "Today: " + now.toLocaleDateString("en-US", options);
  }

  syncProfile();
  setupHeaderSearch();
  setupLogoutModal();
}

function syncProfile() {
  let profile = { name: "Divya Prajapati", role: "Admin", initial: "D" };
  try {
    const saved = localStorage.getItem("parul_user_profile");
    if (saved) profile = { ...profile, ...JSON.parse(saved) };
  } catch (error) {
    console.error("Could not read the saved browser profile.", error);
  }
  const initial = profile.initial || profile.name.trim().charAt(0).toUpperCase() || "D";
  document.querySelectorAll(".profile strong").forEach(el => { el.textContent = profile.name; });
  document.querySelectorAll(".profile small").forEach(el => { el.textContent = profile.role; });
  document.querySelectorAll(".avatar, .avatar-large").forEach(el => { el.textContent = initial; });
}

function showDemoNotice(message) {
  let notice = document.getElementById("demoNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "demoNotice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:1000;max-width:360px;padding:12px 16px;background:#1d2939;color:#fff;border-radius:8px;box-shadow:0 6px 24px #0003";
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(notice.timeoutId);
  notice.timeoutId = setTimeout(() => { notice.hidden = true; }, 3500);
}

function setupHeaderSearch() {
  const headerSearch = document.querySelector(".topbar .search");
  if (!headerSearch) return;

  const pageSearch = document.querySelector("#searchInput, #complaintsSearch, #liveSearchInput");
  if (pageSearch) {
    headerSearch.addEventListener("input", () => {
      pageSearch.value = headerSearch.value;
      pageSearch.dispatchEvent(new Event("input", { bubbles: true }));
    });
    pageSearch.addEventListener("input", () => {
      if (headerSearch.value !== pageSearch.value) headerSearch.value = pageSearch.value;
    });
    return;
  }

  headerSearch.addEventListener("input", () => {
    const term = headerSearch.value.trim().toLowerCase();
    const searchable = document.querySelectorAll(".content .stat-card, .content .facility-card, .content .alert-item, .content .settings-tab-pane");
    searchable.forEach(item => {
      item.hidden = term !== "" && !item.textContent.toLowerCase().includes(term);
    });
  });
}

function setupLogoutModal() {
  if (document.getElementById("logoutModalOverlay")) return;

  const modalHtml = `
    <div class="modal-overlay" id="logoutModalOverlay">
      <div class="modal-box">
        <div class="logout-modal-content">
          <div class="logout-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </div>
          <h3 class="logout-title">Are you sure you want to logout?</h3>
          <p class="logout-desc">You will need to login again to access the system.</p>
          <div class="logout-btn-group">
            <button class="btn-danger" id="confirmLogoutBtn">Logout</button>
            <button class="btn-secondary" id="cancelLogoutBtn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const overlay = document.getElementById("logoutModalOverlay");
  const confirmBtn = document.getElementById("confirmLogoutBtn");
  const cancelBtn = document.getElementById("cancelLogoutBtn");

  // Determine relative path to login.html
  const isInsidePages = window.location.pathname.includes("/pages/") || window.location.pathname.includes("\\pages\\") || window.location.href.includes("/pages/");
  const loginUrl = isInsidePages ? "login.html" : "pages/login.html";

  // Bind click on any logout button or link
  const logoutLinks = document.querySelectorAll(".sidebar-bottom a, .logout-link, #logoutBtn");
  logoutLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      // If we are already on login page, let it be
      if (window.location.pathname.endsWith("login.html")) return;
      e.preventDefault();
      overlay.classList.add("active");
    });
  });

  cancelBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("active");
  });

  confirmBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem("parul_auth_user");
    } catch (error) {
      console.error("Could not clear the demo login from this browser.", error);
    }
    window.location.href = loginUrl;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupCommon);
} else {
  setupCommon();
}
