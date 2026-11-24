/**
 * Lightweight API client for ApplyTrack backend endpoints.
 */
const Api = (() => {
  async function request(url, options = {}) {
    const config = {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    };

    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      const err = new Error((data && data.error) || `Request failed (${response.status})`);
      err.status = response.status;
      err.details = (data && data.details) || {};
      throw err;
    }
    return data;
  }

  function buildQuery(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== "All") {
        searchParams.set(key, value);
      }
    });
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }

  return {
    getDashboard: () => request("/api/dashboard"),
    getApplications: (filters = {}) => request(`/api/applications${buildQuery(filters)}`),
    createApplication: (payload) =>
      request("/api/applications", { method: "POST", body: JSON.stringify(payload) }),
    updateApplication: (id, payload) =>
      request(`/api/applications/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    patchApplicationStatus: (id, status) =>
      request(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    deleteApplication: (id) =>
      request(`/api/applications/${id}`, { method: "DELETE" }),

    getInterviews: () => request("/api/interviews"),
    createInterview: (payload) =>
      request("/api/interviews", { method: "POST", body: JSON.stringify(payload) }),
    updateInterview: (id, payload) =>
      request(`/api/interviews/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteInterview: (id) =>
      request(`/api/interviews/${id}`, { method: "DELETE" }),

    getAnalytics: () => request("/api/analytics"),
    loadDemoData: () => request("/api/demo/load", { method: "POST" }),
    clearDemoData: () => request("/api/demo/clear", { method: "DELETE" }),
    getExportCsvUrl: (filters = {}) => `/api/export/csv${buildQuery(filters)}`,
  };
})();
