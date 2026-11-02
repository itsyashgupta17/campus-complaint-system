// Complaints management synced with MongoDB Atlas Backend API
document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("complaintsTableBody");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("complaintsSearch");

  // Modals
  const raiseModal = document.getElementById("raiseModalOverlay");
  const openRaiseModalBtn = document.getElementById("openRaiseModalBtn");
  const closeRaiseModalBtn = document.getElementById("closeRaiseModalBtn");
  const raiseForm = document.getElementById("raiseComplaintForm");

  const viewModal = document.getElementById("viewModalOverlay");
  const closeViewModalBtn = document.getElementById("closeViewModalBtn");
  const updateStatusBtn = document.getElementById("updateStatusBtn");
  const viewStatusSelect = document.getElementById("viewComplaintStatus");

  let activeViewingId = null;
  let liveComplaints = [];

  async function loadData() {
    if (typeof apiGetComplaints === "function") {
      liveComplaints = await apiGetComplaints();
    } else if (typeof getComplaints === "function") {
      liveComplaints = getComplaints();
    }
    return liveComplaints;
  }

  function renderTable() {
    if (!tableBody) return;
    const data = liveComplaints;
    const cat = categoryFilter ? categoryFilter.value : "All Categories";
    const stat = statusFilter ? statusFilter.value : "All Status";
    const term = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filtered = data.filter(c => {
      const matchCat = (cat === "All Categories" || c.category === cat);
      const matchStat = (stat === "All Status" || c.status === stat);
      const str = [c.id, c.date, c.complainant || c.title, c.category, c.status].join(" ").toLowerCase();
      const matchSearch = str.includes(term);
      return matchCat && matchStat && matchSearch;
    });

    tableBody.innerHTML = "";
    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8;">No complaints matching your criteria.</td></tr>`;
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement("tr");

      // ID
      const tdId = document.createElement("td");
      const idLabel = document.createElement("strong");
      idLabel.textContent = c.id;
      tdId.appendChild(idLabel);
      tr.appendChild(tdId);

      // Date
      const tdDate = document.createElement("td");
      tdDate.textContent = c.date;
      tr.appendChild(tdDate);

      // Complainant
      const tdComp = document.createElement("td");
      tdComp.textContent = c.complainant || c.title || "Student";
      tr.appendChild(tdComp);

      // Category
      const tdCat = document.createElement("td");
      tdCat.textContent = c.category;
      tr.appendChild(tdCat);

      // Status Badge
      const tdStat = document.createElement("td");
      const badge = document.createElement("span");
      const stClass = { "Open": "open", "In Progress": "progress", "Closed": "closed" }[c.status] || "open";
      badge.className = `status ${stClass}`;
      badge.textContent = c.status;
      tdStat.appendChild(badge);
      tr.appendChild(tdStat);

      // Action Button
      const tdAct = document.createElement("td");
      const viewBtn = document.createElement("button");
      viewBtn.className = "btn-action-view";
      viewBtn.textContent = "View";
      viewBtn.addEventListener("click", () => openViewModal(c.id));
      tdAct.appendChild(viewBtn);
      tr.appendChild(tdAct);

      tableBody.appendChild(tr);
    });
  }

  // Filter Event Listeners
  if (categoryFilter) categoryFilter.addEventListener("change", renderTable);
  if (statusFilter) statusFilter.addEventListener("change", renderTable);
  if (searchInput) searchInput.addEventListener("input", renderTable);

  // Modal Open / Close
  if (openRaiseModalBtn && raiseModal) {
    openRaiseModalBtn.addEventListener("click", () => {
      raiseForm.reset();
      raiseModal.classList.add("active");
    });
  }

  if (closeRaiseModalBtn && raiseModal) {
    closeRaiseModalBtn.addEventListener("click", () => {
      raiseModal.classList.remove("active");
    });
  }

  if (raiseForm) {
    raiseForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const complainant = document.getElementById("newComplainant").value.trim();
      const category = document.getElementById("newCategory").value;
      const title = document.getElementById("newTitle").value.trim();

      const submitBtn = raiseForm.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving to MongoDB...";
      }

      try {
        let created;
        if (typeof apiCreateComplaint === "function") {
          created = await apiCreateComplaint({ complainant, category, title });
        } else {
          throw new Error("API helper not loaded");
        }

        raiseModal.classList.remove("active");
        raiseForm.reset();

        if (created && created.isLive) {
          alert(`✅ Success! Complaint saved to MongoDB Atlas!\nID: ${created.id}\nComplainant: ${created.complainant}`);
        } else {
          alert(
            `⚠️ Notice: Render backend is unreachable or waking up.\n\n` +
            `The complaint was saved LOCALLY in your browser (ID: ${created.id}), but NOT in MongoDB Atlas yet.\n\n` +
            `Cause: ${created.error || "Connection failed / server sleeping"}\n\n` +
            `Tip: Open https://campus-complaint-backend-vi2w.onrender.com in a new tab to wake up Render.`
          );
        }
        await loadData();
        renderTable();
      } catch (err) {
        alert("Failed to submit complaint: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Complaint";
        }
      }
    });
  }

  function openViewModal(id) {
    activeViewingId = id;
    const item = liveComplaints.find(c => c.id === id);
    if (!item || !viewModal) return;

    document.getElementById("viewComplaintId").textContent = item.id;
    document.getElementById("viewComplainant").textContent = item.complainant || "N/A";
    document.getElementById("viewDate").textContent = item.date;
    document.getElementById("viewCategory").textContent = item.category;
    document.getElementById("viewDescription").textContent = item.title || "No description provided.";
    if (viewStatusSelect) viewStatusSelect.value = item.status;

    viewModal.classList.add("active");
  }

  if (closeViewModalBtn && viewModal) {
    closeViewModalBtn.addEventListener("click", () => {
      viewModal.classList.remove("active");
    });
  }

  if (updateStatusBtn && viewStatusSelect) {
    updateStatusBtn.addEventListener("click", async () => {
      const newStatus = viewStatusSelect.value;
      updateStatusBtn.disabled = true;
      updateStatusBtn.textContent = "Updating...";

      try {
        if (typeof apiUpdateComplaintStatus === "function") {
          await apiUpdateComplaintStatus(activeViewingId, newStatus);
        }
        await loadData();
        renderTable();
        viewModal.classList.remove("active");
      } catch (err) {
        alert("Failed to update status in MongoDB: " + err.message);
      } finally {
        updateStatusBtn.disabled = false;
        updateStatusBtn.textContent = "Save Status";
      }
    });
  }

  [raiseModal, viewModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.classList.remove("active");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (raiseModal) raiseModal.classList.remove("active");
      if (viewModal) viewModal.classList.remove("active");
    }
  });

  // Initial table render from live MongoDB API
  await loadData();
  renderTable();
});