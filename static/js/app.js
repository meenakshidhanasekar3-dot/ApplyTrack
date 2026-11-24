/**
 * Main client controller for ApplyTrack.
 */
(() => {
  const VIEW_META = {
    dashboard: { title: "Dashboard", subtitle: "Your job search pipeline at a glance" },
    applications: { title: "Applications", subtitle: "Search, filter, and manage all job applications" },
    kanban: { title: "Kanban Board", subtitle: "Track and move applications across hiring stages" },
    interviews: { title: "Interview Tracker", subtitle: "Prepare for upcoming interviews and review past rounds" },
    analytics: { title: "Analytics", subtitle: "Conversion rates, status mix, and monthly momentum" },
  };

  const state = {
    currentView: "dashboard",
    allApplications: [],
    filteredApplications: [],
    interviews: [],
    filters: { search: "", status: "All", job_type: "All" },
    demoCount: 0,
    confirmCallback: null,
    draggedAppId: null,
  };

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /* ------------------------------------------------------------------------
     Navigation & Mobile Sidebar
     ------------------------------------------------------------------------ */
  function switchView(viewName) {
    if (!VIEW_META[viewName]) return;
    state.currentView = viewName;

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });

    document.getElementById("pageTitle").textContent = VIEW_META[viewName].title;
    document.getElementById("pageSubtitle").textContent = VIEW_META[viewName].subtitle;

    closeMobileSidebar();

    if (viewName === "dashboard") loadDashboard();
    if (viewName === "applications") loadFilteredApplications();
    if (viewName === "kanban") renderKanban();
    if (viewName === "interviews") loadInterviews();
    if (viewName === "analytics") loadAnalytics();
  }

  function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
  }

  /* ------------------------------------------------------------------------
     Demo Data Banner & Sidebar Controls
     ------------------------------------------------------------------------ */
  function updateDemoUI(demoCount) {
    state.demoCount = demoCount;
    const banner = document.getElementById("demoBanner");
    const sidebarBox = document.getElementById("demoSidebarControl");

    if (demoCount > 0) {
      banner.classList.remove("hidden");
      sidebarBox.innerHTML = `
        <p><strong>Demo Mode Active</strong> (${demoCount} sample records)</p>
        <button id="clearDemoSidebarBtn" class="btn btn-sm btn-soft-danger btn-block" type="button">Clear Demo Data</button>
      `;
      document.getElementById("clearDemoSidebarBtn").addEventListener("click", confirmClearDemo);
    } else {
      banner.classList.add("hidden");
      sidebarBox.innerHTML = `
        <p>Want to explore with sample records? Load clearly-labelled demo data anytime.</p>
        <button id="loadDemoSidebarBtn" class="btn btn-sm btn-soft btn-block" type="button">Load Demo Data</button>
      `;
      document.getElementById("loadDemoSidebarBtn").addEventListener("click", handleLoadDemo);
    }
  }

  async function handleLoadDemo() {
    try {
      const res = await Api.loadDemoData();
      if (res.loaded) {
        Components.showToast("Sample demo data loaded.", "success");
      } else {
        Components.showToast("Demo data is already active.", "info");
      }
      await refreshAllData();
    } catch (err) {
      Components.showToast(err.message, "error");
    }
  }

  function confirmClearDemo() {
    openConfirmModal({
      title: "Clear Demo Data",
      message: "This will remove only the clearly-labelled [DEMO] sample applications and interviews. Your personal records will remain untouched.",
      confirmText: "Clear Demo Data",
      onConfirm: async () => {
        try {
          await Api.clearDemoData();
          Components.showToast("Demo data cleared.", "success");
          await refreshAllData();
        } catch (err) {
          Components.showToast(err.message, "error");
        }
      },
    });
  }

  /* ------------------------------------------------------------------------
     Dashboard View
     ------------------------------------------------------------------------ */
  async function loadDashboard() {
    try {
      const data = await Api.getDashboard();
      const s = data.summary;

      document.getElementById("kpiTotalApps").textContent = s.total_applications;
      document.getElementById("kpiInterviews").textContent = s.interviews_scheduled;
      document.getElementById("kpiInterviewsMeta").textContent =
        `${s.applications_in_interview} app${s.applications_in_interview === 1 ? "" : "s"} in Interview stage`;
      document.getElementById("kpiOffers").textContent = s.offers_received;
      document.getElementById("kpiRejections").textContent = s.rejections;

      document.getElementById("navAppsCount").textContent = s.total_applications;
      document.getElementById("navInterviewsCount").textContent = s.interviews_scheduled;
      updateDemoUI(s.demo_count);

      // Status Chart
      const chartWrap = document.getElementById("dashboardChartWrap");
      const chartEmpty = document.getElementById("dashboardChartEmpty");
      if (s.total_applications === 0) {
        chartWrap.classList.add("hidden");
        chartEmpty.classList.remove("hidden");
        Charts.destroyChart("dashboardStatusChart");
        chartEmpty.innerHTML = Components.emptyState({
          title: "No application data yet",
          description: "Add your first job application or load demo data to see your pipeline chart.",
          actionHtml: `<button class="btn btn-primary btn-sm js-open-add-app" type="button">+ Add Application</button>`,
        });
      } else {
        chartWrap.classList.remove("hidden");
        chartEmpty.classList.add("hidden");
        Charts.renderStatusDoughnut("dashboardStatusChart", data.status_counts);
      }

      // Upcoming Interviews & Follow-Ups
      renderUpcomingFeed(data.upcoming_interviews, data.upcoming_follow_ups);

      // Recent Applications
      const recentEl = document.getElementById("recentApplicationsContainer");
      if (data.recent_applications.length === 0) {
        recentEl.innerHTML = Components.emptyState({
          title: "Start tracking your job search",
          description: "Keep every application, interview, and follow-up organized in one place.",
          actionHtml: `
            <button class="btn btn-primary btn-sm js-open-add-app" type="button">+ Add Application</button>
            <button class="btn btn-soft btn-sm js-load-demo-inline" type="button">Load Sample Demo Data</button>
          `,
        });
      } else {
        recentEl.innerHTML = Components.applicationTable(data.recent_applications, { showActions: true });
      }
    } catch (err) {
      Components.showToast(err.message, "error");
    }
  }

  function renderUpcomingFeed(interviews, followUps) {
    const container = document.getElementById("upcomingFeed");
    const items = [];

    interviews.forEach((iv) => {
      const isToday = iv.interview_date === todayIso();
      items.push(`
        <div class="feed-item ${isToday ? "feed-item-highlight" : ""}">
          <div>
            <div class="feed-item-title">
              ${Components.escapeHtml(iv.company)} ${Components.demoBadge(iv.is_demo)}
            </div>
            <div class="feed-item-sub">
              Interview${iv.job_role ? ` · ${Components.escapeHtml(iv.job_role)}` : ""} · ${Components.formatDate(iv.interview_date)} at ${Components.formatTime(iv.interview_time)}
            </div>
          </div>
          <span class="feed-tag ${isToday ? "feed-tag-today" : "feed-tag-interview"}">
            ${isToday ? "Today" : "Interview"}
          </span>
        </div>
      `);
    });

    followUps.forEach((app) => {
      items.push(`
        <div class="feed-item">
          <div>
            <div class="feed-item-title">
              ${Components.escapeHtml(app.company)} ${Components.demoBadge(app.is_demo)}
            </div>
            <div class="feed-item-sub">
              Follow up on ${Components.escapeHtml(app.job_role)} · ${Components.formatDate(app.follow_up_date)}
            </div>
          </div>
          <span class="feed-tag feed-tag-followup">Follow-Up</span>
        </div>
      `);
    });

    if (items.length === 0) {
      container.innerHTML = Components.emptyState({
        title: "No upcoming interviews or follow-ups",
        description: "Schedule an interview or add a follow-up date on an application to see reminders here.",
      });
      return;
    }

    container.innerHTML = items.join("");
  }

  /* ------------------------------------------------------------------------
     Applications View (Search & Filters)
     ------------------------------------------------------------------------ */
  async function loadAllApplications() {
    const res = await Api.getApplications();
    state.allApplications = res.applications;
    populateInterviewApplicationSelect();
  }

  async function loadFilteredApplications() {
    try {
      const res = await Api.getApplications(state.filters);
      state.filteredApplications = res.applications;
      renderApplicationsTable();
    } catch (err) {
      Components.showToast(err.message, "error");
    }
  }

  function renderApplicationsTable() {
    const container = document.getElementById("applicationsTableContainer");
    const countLabel = document.getElementById("applicationsCountLabel");
    const apps = state.filteredApplications;

    countLabel.textContent = `${apps.length} application${apps.length === 1 ? "" : "s"}`;

    if (apps.length === 0) {
      const hasActiveFilters =
        state.filters.search || state.filters.status !== "All" || state.filters.job_type !== "All";
      container.innerHTML = hasActiveFilters
        ? Components.emptyState({
            title: "No matching applications",
            description: "Try adjusting your search keywords or status/job type filters.",
            actionHtml: `<button id="resetFiltersInlineBtn" class="btn btn-secondary btn-sm" type="button">Reset Filters</button>`,
          })
        : Components.emptyState({
            title: "No applications recorded yet",
            description: "Add your first job application or load demo data to explore ApplyTrack.",
            actionHtml: `
              <button class="btn btn-primary btn-sm js-open-add-app" type="button">+ Add Application</button>
              <button class="btn btn-soft btn-sm js-load-demo-inline" type="button">Load Sample Demo Data</button>
            `,
          });
      const resetBtn = document.getElementById("resetFiltersInlineBtn");
      if (resetBtn) resetBtn.addEventListener("click", resetFilters);
      return;
    }

    container.innerHTML = Components.applicationTable(apps, { showActions: true });
  }

  function resetFilters() {
    state.filters = { search: "", status: "All", job_type: "All" };
    document.getElementById("searchInput").value = "";
    document.getElementById("filterStatus").value = "All";
    document.getElementById("filterJobType").value = "All";
    loadFilteredApplications();
  }

  /* ------------------------------------------------------------------------
     Kanban View
     ------------------------------------------------------------------------ */
  function renderKanban() {
    const board = document.getElementById("kanbanBoard");
    const apps = state.allApplications;

    board.innerHTML = Components.STATUSES.map((status) => {
      const colApps = apps.filter((a) => a.status === status);
      const cardsHtml = colApps.length
        ? colApps.map(Components.kanbanCard).join("")
        : `<div class="empty-state" style="padding:1.25rem 0.5rem;"><p style="margin:0;font-size:0.8rem;">Drop cards here</p></div>`;

      return `
        <div class="kanban-column" data-status="${status}">
          <div class="kanban-col-header">
            ${Components.statusBadge(status)}
            <span class="kanban-col-count">${colApps.length}</span>
          </div>
          <div class="kanban-cards">${cardsHtml}</div>
        </div>
      `;
    }).join("");

    attachKanbanEvents();
  }

  function attachKanbanEvents() {
    document.querySelectorAll(".kanban-card").forEach((card) => {
      card.addEventListener("dragstart", () => {
        state.draggedAppId = Number(card.dataset.appId);
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        state.draggedAppId = null;
      });
    });

    document.querySelectorAll(".kanban-column").forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("drag-over");
      });
      col.addEventListener("dragleave", () => {
        col.classList.remove("drag-over");
      });
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const targetStatus = col.dataset.status;
        if (!state.draggedAppId || !targetStatus) return;
        await changeApplicationStatus(state.draggedAppId, targetStatus);
      });
    });

    document.querySelectorAll(".js-kanban-status").forEach((select) => {
      select.addEventListener("change", async (e) => {
        const appId = Number(select.dataset.id);
        await changeApplicationStatus(appId, e.target.value);
      });
    });
  }

  async function changeApplicationStatus(appId, newStatus) {
    const existing = state.allApplications.find((a) => a.id === appId);
    if (!existing || existing.status === newStatus) return;

    try {
      await Api.patchApplicationStatus(appId, newStatus);
      Components.showToast(`Moved ${existing.company} to ${newStatus}`, "success");
      await refreshAllData();
    } catch (err) {
      Components.showToast(err.message, "error");
      renderKanban();
    }
  }

  /* ------------------------------------------------------------------------
     Interviews View
     ------------------------------------------------------------------------ */
  async function loadInterviews() {
    try {
      const res = await Api.getInterviews();
      state.interviews = res.interviews;
      renderInterviews();
    } catch (err) {
      Components.showToast(err.message, "error");
    }
  }

  function renderInterviews() {
    const container = document.getElementById("interviewsContainer");
    const upcoming = state.interviews.filter((iv) => iv.is_upcoming);
    const past = state.interviews.filter((iv) => !iv.is_upcoming);

    document.getElementById("upcomingInterviewsPill").textContent = `${upcoming.length} Upcoming`;
    document.getElementById("pastInterviewsPill").textContent = `${past.length} Past`;
    document.getElementById("navInterviewsCount").textContent = upcoming.length;

    if (state.interviews.length === 0) {
      container.innerHTML = `
        <article class="card">
          ${Components.emptyState({
            title: "No interviews scheduled yet",
            description: "Log upcoming interviews with date, time, company, and prep notes.",
            actionHtml: `<button id="scheduleFirstInterviewBtn" class="btn btn-primary btn-sm" type="button">+ Schedule Interview</button>`,
          })}
        </article>
      `;
      document
        .getElementById("scheduleFirstInterviewBtn")
        .addEventListener("click", () => openInterviewModal());
      return;
    }

    let html = "";
    if (upcoming.length > 0) {
      html += `<h3 class="interview-section-title">Upcoming Interviews</h3>`;
      html += `<div class="interview-grid">${upcoming.map(Components.interviewCard).join("")}</div>`;
    }
    if (past.length > 0) {
      html += `<h3 class="interview-section-title">Past / Completed Interviews</h3>`;
      html += `<div class="interview-grid">${past.map(Components.interviewCard).join("")}</div>`;
    }
    container.innerHTML = html;
  }

  function populateInterviewApplicationSelect() {
    const select = document.getElementById("interviewAppSelect");
    const current = select.value;
    const options = state.allApplications
      .map(
        (app) =>
          `<option value="${app.id}" data-company="${Components.escapeHtml(app.company)}">${Components.escapeHtml(app.company)} — ${Components.escapeHtml(app.job_role)}</option>`
      )
      .join("");
    select.innerHTML = `<option value="">-- Standalone / Not linked --</option>${options}`;
    if (current) select.value = current;
  }

  /* ------------------------------------------------------------------------
     Analytics View
     ------------------------------------------------------------------------ */
  async function loadAnalytics() {
    try {
      const data = await Api.getAnalytics();
      const conv = data.conversion;
      const total = data.total_applications;

      document.getElementById("metricInterviewRate").textContent = `${conv.interview_rate.toFixed(1)}%`;
      document.getElementById("metricInterviewDetail").textContent =
        `${conv.interview_reached_count} of ${total} application${total === 1 ? "" : "s"} reached interview`;

      document.getElementById("metricOfferRate").textContent = `${conv.offer_rate.toFixed(1)}%`;
      document.getElementById("metricOfferDetail").textContent =
        `${conv.offer_count} offer${conv.offer_count === 1 ? "" : "s"} from ${total} application${total === 1 ? "" : "s"}`;

      document.getElementById("metricInterviewToOfferRate").textContent =
        `${conv.interview_to_offer_rate.toFixed(1)}%`;
      document.getElementById("metricInterviewToOfferDetail").textContent =
        `${conv.offer_count} offer${conv.offer_count === 1 ? "" : "s"} from ${conv.interview_reached_count} interviewed`;

      const statusWrap = document.getElementById("analyticsStatusWrap");
      const statusEmpty = document.getElementById("analyticsStatusEmpty");
      const trendWrap = document.getElementById("analyticsTrendWrap");
      const trendEmpty = document.getElementById("analyticsTrendEmpty");

      if (total === 0) {
        statusWrap.classList.add("hidden");
        trendWrap.classList.add("hidden");
        statusEmpty.classList.remove("hidden");
        trendEmpty.classList.remove("hidden");
        Charts.destroyChart("analyticsStatusChart");
        Charts.destroyChart("analyticsTrendChart");
        const emptyMarkup = Components.emptyState({
          title: "No analytics data yet",
          description: "Add applications to unlock status distribution and monthly trend charts.",
        });
        statusEmpty.innerHTML = emptyMarkup;
        trendEmpty.innerHTML = emptyMarkup;
      } else {
        statusWrap.classList.remove("hidden");
        trendWrap.classList.remove("hidden");
        statusEmpty.classList.add("hidden");
        trendEmpty.classList.add("hidden");
        Charts.renderStatusBar("analyticsStatusChart", data.status_distribution);
        Charts.renderMonthlyTrend("analyticsTrendChart", data.monthly_trend);
      }
    } catch (err) {
      Components.showToast(err.message, "error");
    }
  }

  /* ------------------------------------------------------------------------
     Modals & Form Validation
     ------------------------------------------------------------------------ */
  function clearFormErrors(form) {
    form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  }

  function applyFieldErrors(form, details) {
    Object.entries(details || {}).forEach(([field, msg]) => {
      const errSpan = form.querySelector(`[data-error-for="${field}"]`);
      const input = form.querySelector(`[name="${field}"]`);
      if (errSpan) errSpan.textContent = msg;
      if (input) input.classList.add("invalid");
    });
  }

  function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
  }

  function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
  }

  function openApplicationModal(app = null) {
    const form = document.getElementById("applicationForm");
    clearFormErrors(form);
    form.reset();

    if (app) {
      document.getElementById("appModalTitle").textContent = "Edit Application";
      document.getElementById("appIdInput").value = app.id;
      document.getElementById("appCompany").value = app.company || "";
      document.getElementById("appRole").value = app.job_role || "";
      document.getElementById("appLocation").value = app.location || "";
      document.getElementById("appJobType").value = app.job_type || "Full-time";
      document.getElementById("appSalary").value = app.salary || "";
      document.getElementById("appDate").value = app.application_date || todayIso();
      document.getElementById("appStatus").value = app.status || "Applied";
      document.getElementById("appFollowUp").value = app.follow_up_date || "";
      document.getElementById("appLink").value = app.job_link || "";
      document.getElementById("appNotes").value = app.notes || "";
    } else {
      document.getElementById("appModalTitle").textContent = "Add Application";
      document.getElementById("appIdInput").value = "";
      document.getElementById("appDate").value = todayIso();
      document.getElementById("appStatus").value = "Applied";
      document.getElementById("appJobType").value = "Full-time";
    }
    openModal("applicationModal");
  }

  async function handleApplicationSubmit(e) {
    e.preventDefault();
    const form = e.target;
    clearFormErrors(form);

    const payload = {
      company: document.getElementById("appCompany").value.trim(),
      job_role: document.getElementById("appRole").value.trim(),
      location: document.getElementById("appLocation").value.trim(),
      job_type: document.getElementById("appJobType").value,
      salary: document.getElementById("appSalary").value.trim(),
      application_date: document.getElementById("appDate").value,
      status: document.getElementById("appStatus").value,
      follow_up_date: document.getElementById("appFollowUp").value,
      job_link: document.getElementById("appLink").value.trim(),
      notes: document.getElementById("appNotes").value.trim(),
    };

    // Client-side validation for immediate feedback
    const clientErrors = {};
    if (!payload.company) clientErrors.company = "Company name is required.";
    if (!payload.job_role) clientErrors.job_role = "Job role is required.";
    if (!payload.application_date) clientErrors.application_date = "Application date is required.";
    if (payload.job_link && !/^https?:\/\/.+/i.test(payload.job_link)) {
      clientErrors.job_link = "Job link must start with http:// or https://.";
    }
    if (Object.keys(clientErrors).length > 0) {
      applyFieldErrors(form, clientErrors);
      return;
    }

    const appId = document.getElementById("appIdInput").value;
    const saveBtn = document.getElementById("saveAppBtn");
    saveBtn.disabled = true;

    try {
      if (appId) {
        await Api.updateApplication(appId, payload);
        Components.showToast("Application updated.", "success");
      } else {
        await Api.createApplication(payload);
        Components.showToast("Application added.", "success");
      }
      closeModal("applicationModal");
      await refreshAllData();
    } catch (err) {
      if (err.details && err.details._error) {
        Components.showToast(err.details._error, "error");
      } else if (err.details && Object.keys(err.details).length > 0) {
        applyFieldErrors(form, err.details);
      } else {
        Components.showToast(err.message, "error");
      }
    } finally {
      saveBtn.disabled = false;
    }
  }

  function openInterviewModal(iv = null) {
    const form = document.getElementById("interviewForm");
    clearFormErrors(form);
    form.reset();
    populateInterviewApplicationSelect();

    if (iv) {
      document.getElementById("interviewModalTitle").textContent = "Edit Interview";
      document.getElementById("interviewIdInput").value = iv.id;
      document.getElementById("interviewAppSelect").value = iv.application_id || "";
      document.getElementById("interviewCompany").value = iv.company || "";
      document.getElementById("interviewDate").value = iv.interview_date || todayIso();
      document.getElementById("interviewTime").value = iv.interview_time || "10:00";
      document.getElementById("interviewNotes").value = iv.notes || "";
    } else {
      document.getElementById("interviewModalTitle").textContent = "Schedule Interview";
      document.getElementById("interviewIdInput").value = "";
      document.getElementById("interviewDate").value = todayIso();
      document.getElementById("interviewTime").value = "10:00";
    }
    openModal("interviewModal");
  }

  async function handleInterviewSubmit(e) {
    e.preventDefault();
    const form = e.target;
    clearFormErrors(form);

    const appSelectVal = document.getElementById("interviewAppSelect").value;
    const payload = {
      application_id: appSelectVal ? Number(appSelectVal) : null,
      company: document.getElementById("interviewCompany").value.trim(),
      interview_date: document.getElementById("interviewDate").value,
      interview_time: document.getElementById("interviewTime").value,
      notes: document.getElementById("interviewNotes").value.trim(),
    };

    const clientErrors = {};
    if (!payload.company) clientErrors.company = "Company name is required.";
    if (!payload.interview_date) clientErrors.interview_date = "Interview date is required.";
    if (!payload.interview_time) clientErrors.interview_time = "Interview time is required.";
    if (Object.keys(clientErrors).length > 0) {
      applyFieldErrors(form, clientErrors);
      return;
    }

    const ivId = document.getElementById("interviewIdInput").value;
    const saveBtn = document.getElementById("saveInterviewBtn");
    saveBtn.disabled = true;

    try {
      if (ivId) {
        await Api.updateInterview(ivId, payload);
        Components.showToast("Interview updated.", "success");
      } else {
        await Api.createInterview(payload);
        Components.showToast("Interview scheduled.", "success");
      }
      closeModal("interviewModal");
      await refreshAllData();
    } catch (err) {
      if (err.details && err.details._error) {
        Components.showToast(err.details._error, "error");
      } else if (err.details && Object.keys(err.details).length > 0) {
        applyFieldErrors(form, err.details);
      } else {
        Components.showToast(err.message, "error");
      }
    } finally {
      saveBtn.disabled = false;
    }
  }

  function openConfirmModal({ title, message, confirmText = "Delete", onConfirm }) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    document.getElementById("confirmActionBtn").textContent = confirmText;
    state.confirmCallback = onConfirm;
    openModal("confirmModal");
  }

  /* ------------------------------------------------------------------------
     Refresh Orchestration & Event Wiring
     ------------------------------------------------------------------------ */
  async function refreshAllData() {
    await loadAllApplications();
    if (state.currentView === "dashboard") await loadDashboard();
    if (state.currentView === "applications") await loadFilteredApplications();
    if (state.currentView === "kanban") renderKanban();
    if (state.currentView === "interviews") await loadInterviews();
    if (state.currentView === "analytics") await loadAnalytics();
    if (state.currentView !== "dashboard") {
      // Keep sidebar badges & demo state in sync
      const dash = await Api.getDashboard();
      document.getElementById("navAppsCount").textContent = dash.summary.total_applications;
      document.getElementById("navInterviewsCount").textContent = dash.summary.interviews_scheduled;
      updateDemoUI(dash.summary.demo_count);
    }
  }

  function wireEvents() {
    // Sidebar view switches
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    // Quick navigation links
    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.goto));
    });

    // Mobile drawer
    document.getElementById("mobileMenuBtn").addEventListener("click", () => {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("sidebarOverlay").classList.add("open");
    });
    document.getElementById("sidebarOverlay").addEventListener("click", closeMobileSidebar);

    // Topbar actions & CSV exports
    document.getElementById("addApplicationTopBtn").addEventListener("click", () => openApplicationModal());
    document.getElementById("addInterviewTopBtn").addEventListener("click", () => openInterviewModal());
    document.getElementById("addInterviewViewBtn").addEventListener("click", () => openInterviewModal());
    document.getElementById("clearDemoBannerBtn").addEventListener("click", confirmClearDemo);

    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      window.location.href = Api.getExportCsvUrl();
    });
    document.getElementById("exportFilteredCsvBtn").addEventListener("click", () => {
      window.location.href = Api.getExportCsvUrl(state.filters);
    });

    // Search & Filters (debounced search)
    let searchTimer = null;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = e.target.value.trim();
        loadFilteredApplications();
      }, 180);
    });
    document.getElementById("filterStatus").addEventListener("change", (e) => {
      state.filters.status = e.target.value;
      loadFilteredApplications();
    });
    document.getElementById("filterJobType").addEventListener("change", (e) => {
      state.filters.job_type = e.target.value;
      loadFilteredApplications();
    });
    document.getElementById("clearFiltersBtn").addEventListener("click", resetFilters);

    // Auto-fill company when linking an application in Interview modal
    document.getElementById("interviewAppSelect").addEventListener("change", (e) => {
      const selected = e.target.options[e.target.selectedIndex];
      const company = selected && selected.dataset.company;
      if (company) {
        document.getElementById("interviewCompany").value = company;
      }
    });

    // Forms & Modals
    document.getElementById("applicationForm").addEventListener("submit", handleApplicationSubmit);
    document.getElementById("interviewForm").addEventListener("submit", handleInterviewSubmit);

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.add("hidden");
      });
    });

    // Close active modal on Escape key for keyboard accessibility
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach((m) => {
          m.classList.add("hidden");
        });
      }
    });

    document.getElementById("confirmActionBtn").addEventListener("click", async () => {
      const cb = state.confirmCallback;
      closeModal("confirmModal");
      state.confirmCallback = null;
      if (cb) await cb();
    });

    // Delegated clicks for dynamic tables, cards & empty states
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".js-open-add-app");
      if (addBtn) return openApplicationModal();

      const demoBtn = e.target.closest(".js-load-demo-inline");
      if (demoBtn) return handleLoadDemo();

      const editAppBtn = e.target.closest(".js-edit-app");
      if (editAppBtn) {
        const id = Number(editAppBtn.dataset.id);
        const app = state.allApplications.find((a) => a.id === id);
        if (app) openApplicationModal(app);
        return;
      }

      const deleteAppBtn = e.target.closest(".js-delete-app");
      if (deleteAppBtn) {
        const id = Number(deleteAppBtn.dataset.id);
        const app = state.allApplications.find((a) => a.id === id);
        openConfirmModal({
          title: "Delete Application",
          message: `Are you sure you want to delete ${app ? app.company + " – " + app.job_role : "this application"}?`,
          confirmText: "Delete",
          onConfirm: async () => {
            try {
              await Api.deleteApplication(id);
              Components.showToast("Application deleted.", "success");
              await refreshAllData();
            } catch (err) {
              Components.showToast(err.message, "error");
            }
          },
        });
        return;
      }

      const editIvBtn = e.target.closest(".js-edit-interview");
      if (editIvBtn) {
        const id = Number(editIvBtn.dataset.id);
        const iv = state.interviews.find((i) => i.id === id);
        if (iv) openInterviewModal(iv);
        return;
      }

      const deleteIvBtn = e.target.closest(".js-delete-interview");
      if (deleteIvBtn) {
        const id = Number(deleteIvBtn.dataset.id);
        const iv = state.interviews.find((i) => i.id === id);
        openConfirmModal({
          title: "Delete Interview",
          message: `Remove scheduled interview with ${iv ? iv.company : "this company"}?`,
          confirmText: "Delete",
          onConfirm: async () => {
            try {
              await Api.deleteInterview(id);
              Components.showToast("Interview deleted.", "success");
              await refreshAllData();
            } catch (err) {
              Components.showToast(err.message, "error");
            }
          },
        });
      }
    });
  }

  async function init() {
    wireEvents();
    await refreshAllData();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
