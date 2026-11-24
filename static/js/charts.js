/**
 * Chart.js renderers for Dashboard and Analytics views.
 */
const Charts = (() => {
  const instances = {};

  const STATUS_COLORS = {
    Applied: "#4f46e5",
    Assessment: "#9333ea",
    Interview: "#f59e0b",
    Offer: "#10b981",
    Rejected: "#f43f5e",
  };

  function destroyChart(key) {
    if (instances[key]) {
      instances[key].destroy();
      delete instances[key];
    }
  }

  function renderStatusDoughnut(canvasId, statusCounts) {
    if (typeof Chart === "undefined") return;
    destroyChart(canvasId);

    const labels = Object.keys(statusCounts);
    const values = Object.values(statusCounts);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    instances[canvasId] = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((l) => STATUS_COLORS[l] || "#6366f1"),
            borderColor: "#ffffff",
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              padding: 14,
              color: "#1e1b4b",
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" },
            },
          },
        },
      },
    });
  }

  function renderStatusBar(canvasId, statusCounts) {
    if (typeof Chart === "undefined") return;
    destroyChart(canvasId);

    const labels = Object.keys(statusCounts);
    const values = Object.values(statusCounts);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    instances[canvasId] = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Applications",
            data: values,
            backgroundColor: labels.map((l) => STATUS_COLORS[l] || "#4f46e5"),
            borderRadius: 8,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#5b617a" },
            grid: { color: "#f1eeff" },
          },
          x: {
            ticks: { color: "#1e1b4b", font: { weight: "600" } },
            grid: { display: false },
          },
        },
      },
    });
  }

  function renderMonthlyTrend(canvasId, monthlyTrend) {
    if (typeof Chart === "undefined") return;
    destroyChart(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = monthlyTrend.map((item) => item.label);
    const values = monthlyTrend.map((item) => item.count);

    instances[canvasId] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Applications Submitted",
            data: values,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(124, 58, 237, 0.14)",
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#7c3aed",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#5b617a" },
            grid: { color: "#f1eeff" },
          },
          x: {
            ticks: { color: "#1e1b4b", font: { weight: "600" } },
            grid: { display: false },
          },
        },
      },
    });
  }

  return {
    destroyChart,
    renderStatusDoughnut,
    renderStatusBar,
    renderMonthlyTrend,
  };
})();
