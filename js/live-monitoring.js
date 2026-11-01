// Live Monitoring Logic
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("liveSearchInput");

  // Search filtering for Facility Cards and Recent Alerts
  if (search) {
    search.addEventListener("input", () => {
      const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const term = normalize(search.value.trim());
      document.querySelectorAll(".facility-card, .alert-item").forEach(item => {
        item.hidden = term !== "" && !normalize(item.textContent).includes(term);
      });
    });
  }
});
