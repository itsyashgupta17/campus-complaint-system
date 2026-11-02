// Settings Page Logic
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".settings-tab-btn");
  const panes = document.querySelectorAll(".settings-tab-pane");
  const profileForm = document.getElementById("profileSettingsForm");
  const toast = document.getElementById("settingsToast");
  const systemForm = document.getElementById("systemSettingsForm");
  const passwordForm = document.getElementById("passwordSettingsForm");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function readSettings(key) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error(`Could not read ${key} from this browser.`, error);
      return null;
    }
  }

  function saveSettings(key, value, label) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      showToast(`${label} saved in this browser.`);
      return true;
    } catch (error) {
      console.error(`Could not save ${key} in this browser.`, error);
      showToast(`Could not save ${label.toLowerCase()}. Check browser storage settings and try again.`);
      return false;
    }
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetPaneId = tab.getAttribute("data-pane");
      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = document.getElementById(targetPaneId);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Load saved profile
  const profile = readSettings("parul_user_profile");
  const authUser = typeof getAuthUser === "function" ? getAuthUser() : null;
  if (profile && typeof profile === "object") {
    document.getElementById("profileName").value = profile.name || authUser?.name || "Divya Prajapati";
    document.getElementById("profileEmail").value = profile.email || authUser?.email || "divya@paruluniversity.ac.in";
    document.getElementById("profileRole").value = profile.role || authUser?.role || "Admin";
  } else if (authUser) {
    document.getElementById("profileName").value = authUser.name || "Divya Prajapati";
    document.getElementById("profileEmail").value = authUser.email || "divya@paruluniversity.ac.in";
    document.getElementById("profileRole").value = authUser.role || "Admin";
  }

  const systemSettings = readSettings("parul_system_settings");
  const refreshInterval = document.getElementById("refreshInterval");
  if (systemSettings && refreshInterval) refreshInterval.value = systemSettings.refreshInterval || "1m";

  // Save profile
  if (profileForm) {
    profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("profileName").value.trim();
      const email = document.getElementById("profileEmail").value.trim();
      const role = document.getElementById("profileRole").value;

      const current = readSettings("parul_user_profile") || {};
      if (saveSettings("parul_user_profile", { ...current, name, email, role }, "Profile")) {
        if (typeof syncProfile === "function") syncProfile();
      }
    });
  }

  if (systemForm) {
    systemForm.addEventListener("submit", event => {
      event.preventDefault();
      saveSettings("parul_system_settings", { refreshInterval: refreshInterval.value }, "System preferences");
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener("submit", event => {
      event.preventDefault();
      showToast("Password changes require the authentication service and are unavailable in this frontend demo.");
    });
  }

  const changePhotoBtn = document.getElementById("changePhotoBtn");
  if (changePhotoBtn) {
    changePhotoBtn.addEventListener("click", () => {
      const current = readSettings("parul_user_profile") || {};
      const newLetter = prompt("Set the initial shown in your demo avatar:", current.initial || (current.name ? current.name.charAt(0) : "D"));
      if (newLetter && newLetter.trim()) {
        const initial = newLetter.trim().charAt(0).toUpperCase();
        if (saveSettings("parul_user_profile", { ...current, initial }, "Avatar initial")) {
          if (typeof syncProfile === "function") syncProfile();
        }
      }
    });
  }
});
