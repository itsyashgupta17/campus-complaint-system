// Backend API Endpoints (Local server priority, live cloud Render failover)
const API_ENDPOINTS = [
  "http://localhost:5000/api",
  "https://campus-complaint-backend-vi2w.onrender.com/api"
];

// Active working API URL (persisted so subsequent calls hit the working backend immediately)
let activeApiBase = (function() {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "http://localhost:5000/api" : "https://campus-complaint-backend-vi2w.onrender.com/api";
})();

// Global reference for backward compatibility
var API_BASE = activeApiBase;

// Helper to execute API requests with automatic failover across local and cloud backends
async function requestWithFailover(path, options = {}, retries = 1) {
  const candidates = [
    activeApiBase,
    ...API_ENDPOINTS.filter(url => url !== activeApiBase)
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const baseUrl of candidates) {
      try {
        const url = `${baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for Render cold start
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          if (activeApiBase !== baseUrl) {
            activeApiBase = baseUrl;
            API_BASE = baseUrl;
          }
          return response;
        }

        // Return immediately if client error (validation, wrong format) rather than failing over
        if (response.status >= 400 && response.status < 500 && response.status !== 404) {
          return response;
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  throw lastError || new Error("Unable to connect to backend server.");
}

// Authentication & Session Helpers
function getAuthUser() {
  try {
    const raw = localStorage.getItem("parul_auth_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && (parsed.email || parsed.token) ? parsed : null;
  } catch (e) {
    console.error("Could not parse auth user session:", e);
    return null;
  }
}

function isLoginPage() {
  const path = (window.location.pathname || "").toLowerCase();
  const href = (window.location.href || "").toLowerCase();
  return path.includes("login.html") || href.includes("login.html") || path.endsWith("/login");
}

function enforceAuthGuard() {
  const user = getAuthUser();
  const onLoginPage = isLoginPage();

  // If user is NOT logged in and NOT currently on login page, redirect to login
  if (!onLoginPage && !user) {
    const isInsidePages =
      window.location.pathname.includes("/pages/") ||
      window.location.pathname.includes("\\pages\\") ||
      window.location.href.includes("/pages/");
    const loginUrl = isInsidePages ? "login.html" : "pages/login.html";
    window.location.replace(loginUrl);
    return false;
  }
  return true;
}

// Run auth guard check immediately
enforceAuthGuard();

// Shared Data & State
const DEFAULT_COMPLAINTS = [];

function getComplaints() {
  try {
    const saved = localStorage.getItem("parul_campus_complaints");
    if (saved !== null) {
      const complaints = JSON.parse(saved);
      if (Array.isArray(complaints)) {
        return complaints;
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
async function apiCheckHealth() {
  try {
    const res = await requestWithFailover("/health", { method: "GET" }, 0);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function apiGetComplaints() {
  try {
    const response = await requestWithFailover("/complaints", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const serverComplaints = await response.json();

    // Check for any locally pending (unsynced) complaints
    const local = getComplaints();
    const pending = local.filter(c => c && c.isPendingSync === true);

    // If there are pending complaints, upload them to MongoDB Atlas now!
    if (pending.length > 0) {
      console.log(`[Sync] Uploading ${pending.length} pending complaint(s) to MongoDB Atlas...`);
      for (const item of pending) {
        try {
          const syncRes = await requestWithFailover("/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              complainant: item.complainant,
              category: item.category,
              title: item.title,
              date: item.date,
              createdAt: item.createdAt
            })
          }, 0);
          if (syncRes.ok) {
            const syncedDoc = await syncRes.json();
            item.isPendingSync = false;
            item.id = syncedDoc.id;
            item._id = syncedDoc._id;
            item.isLive = true;
            console.log(`[Sync] Successfully saved complaint ${syncedDoc.id} to MongoDB Atlas.`);
          }
        } catch (syncErr) {
          console.warn("[Sync] Retrying complaint upload on next sync:", syncErr.message);
        }
      }
    }

    // Merge: server complaints + any remaining unsynced complaints (never delete unsynced items!)
    const stillPending = local.filter(c => c && c.isPendingSync === true);
    const serverIds = new Set(serverComplaints.map(c => c.id));
    const merged = [
      ...stillPending.filter(c => !serverIds.has(c.id)),
      ...serverComplaints
    ];

    saveComplaints(merged);
    complaints = merged;
    return merged;
  } catch (err) {
    console.warn("Backend API offline or unreachable, using local data fallback:", err.message);
    return getComplaints();
  }
}

async function apiCreateComplaint(payload) {
  try {
    // Attempt to permanently save to MongoDB Atlas via backend (with 1 retry for cold start)
    const response = await requestWithFailover("/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, 1);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed with status ${response.status}`);
    }

    const created = await response.json();
    const current = getComplaints().filter(c => c.id !== created.id);
    const updated = [created, ...current];
    saveComplaints(updated);
    complaints = updated;
    return { ...created, isLive: true };
  } catch (err) {
    console.warn("Backend API offline, queueing complaint for auto-sync to MongoDB Atlas:", err.message);
    const current = getComplaints();
    const highestId = current.reduce((highest, complaint) => {
      const match = /^#C(\d+)$/.exec(complaint.id);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 100);
    const newId = `#C${String(highestId + 1).padStart(3, "0")}`;
    const fallbackComplaint = {
      id: newId,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      createdAt: new Date().toISOString().slice(0, 10),
      complainant: payload.complainant,
      title: payload.title,
      category: payload.category,
      status: "Open",
      isLive: false,
      isPendingSync: true, // Marked for automatic background upload to MongoDB Atlas
      error: err.message
    };
    const updated = [fallbackComplaint, ...current];
    saveComplaints(updated);
    complaints = updated;
    return fallbackComplaint;
  }
}

async function apiUpdateComplaintStatus(id, newStatus) {
  try {
    const response = await requestWithFailover(`/complaints/${encodeURIComponent(id)}/status`, {
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
    console.warn("Backend API offline, saving status change locally:", err.message);
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
  const authUser = getAuthUser();
  let name = authUser?.name || "Divya Prajapati";
  let role = authUser?.role || "Admin";

  try {
    const saved = localStorage.getItem("parul_user_profile");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!authUser || (parsed.email && parsed.email.toLowerCase() === authUser.email?.toLowerCase())) {
        if (parsed.name) name = parsed.name;
        if (parsed.role) role = parsed.role;
      }
    }
  } catch (error) {
    console.error("Could not read the saved browser profile.", error);
  }

  const initial = name ? name.trim().charAt(0).toUpperCase() : "D";
  document.querySelectorAll(".profile strong").forEach(el => { el.textContent = name; });
  document.querySelectorAll(".profile small").forEach(el => { el.textContent = role; });
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
          <p class="logout-desc">You will need to enter your verified credentials again to access the portal.</p>
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
  const isInsidePages =
    window.location.pathname.includes("/pages/") ||
    window.location.pathname.includes("\\pages\\") ||
    window.location.href.includes("/pages/");
  const loginUrl = isInsidePages ? "login.html" : "pages/login.html";

  // Bind click on any logout button or link
  const logoutLinks = document.querySelectorAll(".sidebar-bottom a, .logout-link, #logoutBtn");
  logoutLinks.forEach(link => {
    link.addEventListener("click", (e) => {
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
      console.error("Could not clear auth session from browser storage.", error);
    }
    window.location.href = loginUrl;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupCommon);
} else {
  setupCommon();
}
