/**
 * Reusable frontend UI components & formatting utilities.
 */
const Components = (() => {
  const STATUSES = ["Applied", "Assessment", "Interview", "Offer", "Rejected"];

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(isoDate) {
    if (!isoDate) return "—";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return escapeHtml(isoDate);
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    const [hStr, mStr] = hhmm.split(":");
    const hour = Number(hStr);
    const minute = Number(mStr);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return escapeHtml(hhmm);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
  }

  function statusBadge(status) {
    const safe = escapeHtml(status);
    return `<span class="status-badge status-${safe}">${safe}</span>`;
  }

  function demoBadge(isDemo) {
    return isDemo ? `<span class="demo-pill" title="Sample demo record">DEMO</span>` : "";
  }

  function emptyState({ title, description, actionHtml = "" }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="9" x2="17" y2="9" />
            <line x1="7" y1="13" x2="13" y2="13" />
          </svg>
        </div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        ${actionHtml ? `<div class="empty-state-actions">${actionHtml}</div>` : ""}
      </div>
    `;
  }

  function applicationTable(applications, { showActions = true } = {}) {
    const rowsHtml = applications
      .map((app) => {
        const linkHtml = app.job_link
          ? `<a class="job-ext-link" href="${escapeHtml(app.job_link)}" target="_blank" rel="noopener noreferrer">View Post ↗</a>`
          : "";
        const followUpHtml = app.follow_up_date
          ? `<div class="cell-sub">Follow-up: ${formatDate(app.follow_up_date)}</div>`
          : "";

        return `
          <tr data-app-id="${app.id}">
            <td>
              <div class="cell-company">
                <span>${escapeHtml(app.company)}</span>
                ${demoBadge(app.is_demo)}
              </div>
              <div class="cell-sub">${escapeHtml(app.job_role)} ${linkHtml ? `· ${linkHtml}` : ""}</div>
            </td>
            <td>
              <div>${escapeHtml(app.job_type)}</div>
              <div class="cell-sub">${escapeHtml(app.location || "Location not specified")}</div>
            </td>
            <td>${escapeHtml(app.salary || "—")}</td>
            <td>
              <div>${formatDate(app.application_date)}</div>
              ${followUpHtml}
            </td>
            <td>${statusBadge(app.status)}</td>
            ${
              showActions
                ? `<td>
                    <div class="row-actions">
                      <button class="icon-btn js-edit-app" data-id="${app.id}" type="button" title="Edit application" aria-label="Edit ${escapeHtml(app.company)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button class="icon-btn icon-btn-danger js-delete-app" data-id="${app.id}" type="button" title="Delete application" aria-label="Delete ${escapeHtml(app.company)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>`
                : ""
            }
          </tr>
        `;
      })
      .join("");

    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company &amp; Role</th>
              <th>Type &amp; Location</th>
              <th>Salary</th>
              <th>Applied</th>
              <th>Status</th>
              ${showActions ? "<th>Actions</th>" : ""}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function kanbanCard(app) {
    const statusOptions = STATUSES.map(
      (st) => `<option value="${st}" ${app.status === st ? "selected" : ""}>Move to ${st}</option>`
    ).join("");

    return `
      <div class="kanban-card" draggable="true" data-app-id="${app.id}">
        <div class="kanban-card-top">
          <div>
            <div class="kanban-company">${escapeHtml(app.company)} ${demoBadge(app.is_demo)}</div>
            <div class="kanban-role">${escapeHtml(app.job_role)}</div>
          </div>
          <button class="icon-btn js-edit-app" data-id="${app.id}" type="button" title="Edit application" aria-label="Edit ${escapeHtml(app.company)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>

        <div class="kanban-meta">
          <span class="kanban-chip">${escapeHtml(app.job_type)}</span>
          ${app.salary ? `<span class="kanban-chip">${escapeHtml(app.salary)}</span>` : ""}
          <span class="kanban-chip">${formatDate(app.application_date)}</span>
        </div>

        <select class="kanban-status-select js-kanban-status" data-id="${app.id}" aria-label="Change status for ${escapeHtml(app.company)}">
          ${statusOptions}
        </select>
      </div>
    `;
  }

  function interviewCard(iv) {
    const dayTag = iv.is_today
      ? `<span class="feed-tag feed-tag-today">Today</span>`
      : iv.is_upcoming
      ? `<span class="feed-tag feed-tag-interview">${iv.days_until === 1 ? "Tomorrow" : `In ${iv.days_until} days`}</span>`
      : `<span class="summary-pill summary-pill-past">Completed</span>`;

    return `
      <article class="interview-card ${iv.is_upcoming ? "upcoming" : "past"}">
        <div class="interview-card-top">
          ${dayTag}
          <div class="row-actions">
            <button class="icon-btn js-edit-interview" data-id="${iv.id}" type="button" title="Edit interview" aria-label="Edit interview with ${escapeHtml(iv.company)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn-danger js-delete-interview" data-id="${iv.id}" type="button" title="Delete interview" aria-label="Delete interview with ${escapeHtml(iv.company)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
        <div class="interview-datetime">${formatDate(iv.interview_date)} · ${formatTime(iv.interview_time)}</div>
        <div class="cell-company">
          <span>${escapeHtml(iv.company)}</span>
          ${demoBadge(iv.is_demo)}
        </div>
        ${iv.job_role ? `<div class="cell-sub">Role: ${escapeHtml(iv.job_role)}</div>` : ""}
        ${iv.notes ? `<p class="interview-notes">${escapeHtml(iv.notes)}</p>` : ""}
      </article>
    `;
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  return {
    STATUSES,
    escapeHtml,
    formatDate,
    formatTime,
    statusBadge,
    demoBadge,
    emptyState,
    applicationTable,
    kanbanCard,
    interviewCard,
    showToast,
  };
})();
