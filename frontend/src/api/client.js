export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const TOKEN_STORAGE_KEY = "codeshield_token";

const RETRYABLE_STATUSES = [502, 503, 504];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let activeRequestsCount = 0;
let wakeTimer = null;
let isWakingState = false;

function startRequestTracking() {
  activeRequestsCount++;
  if (!wakeTimer && !isWakingState) {
    wakeTimer = setTimeout(() => {
      if (activeRequestsCount > 0) {
        isWakingState = true;
        window.dispatchEvent(
          new CustomEvent("codeshield-server-waking", { detail: { waking: true } })
        );
      }
    }, 4000);
  }
}

function endRequestTracking() {
  activeRequestsCount = Math.max(0, activeRequestsCount - 1);
  if (activeRequestsCount === 0) {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    if (isWakingState) {
      isWakingState = false;
      window.dispatchEvent(
        new CustomEvent("codeshield-server-waking", { detail: { waking: false } })
      );
    }
  }
}

/**
 * Fires an ultra-lightweight ping to the backend /health endpoint to awaken idle free-tier instances.
 * Silently catches and swallows any network or server errors.
 */
export async function wakeBackend() {
  try {
    const url = endpointUrl("/health");
    await fetch(url, { method: "GET", mode: "cors" });
  } catch {
    // Silently ignore errors during background wake-up ping
  }
}

function endpointUrl(endpoint) {
  if (endpoint.startsWith("http")) return endpoint;
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * Standardized API client with automatic JWT token attachment, 4s wake tracking, and error handling.
 */
export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const url = endpointUrl(endpoint);

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  const headers = {
    ...(!options.isFormData && !options.noContentType && { "Content-Type": "application/json" }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    method,
    headers,
  };

  if (config.body && typeof config.body === "object" && !options.isFormData) {
    config.body = JSON.stringify(config.body);
  }

  startRequestTracking();
  let response;
  try {
    try {
      response = await fetch(url, config);
    } catch (networkErr) {
      // 1 automatic retry (2s delay) for GET requests only on network failures
      if (isGet && !options._retryAttempted) {
        await sleep(2000);
        return await apiFetch(endpoint, { ...options, _retryAttempted: true });
      }
      throw networkErr;
    }

    // 1 automatic retry (2s delay) for GET requests on 502/503/504 gateway cold start errors
    if (isGet && !options._retryAttempted && RETRYABLE_STATUSES.includes(response.status)) {
      await sleep(2000);
      return await apiFetch(endpoint, { ...options, _retryAttempted: true });
    }

    // If token is invalid/expired (401), trigger auth error event
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent("codeshield-auth-expired"));
    }

    if (options.rawResponse) {
      return response;
    }

    // Parse JSON or return text
    const contentType = response.headers.get("content-type");
    let data = null;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else if (contentType && contentType.includes("text/")) {
      data = await response.text();
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}: ${response.statusText}`;
      if (data) {
        if (typeof data.detail === "string") {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail
            .map((err) => {
              const field = Array.isArray(err.loc) ? err.loc.slice(1).join(".") : "";
              return field ? `${field}: ${err.msg}` : err.msg || JSON.stringify(err);
            })
            .join("; ");
        } else if (data.message) {
          errorMessage = data.message;
        }
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    endRequestTracking();
  }
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "PUT", body }),
  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "PATCH", body }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: "DELETE" }),

  /**
   * Helper to download CSV or binary files securely with JWT headers
   */
  downloadFile: async (endpoint, defaultFilename) => {
    const response = await apiFetch(endpoint, {
      method: "GET",
      rawResponse: true,
      noContentType: true,
    });

    if (!response.ok) {
      let errText = "Download failed";
      try {
        const errJson = await response.json();
        errText = errJson.detail || errJson.message || errText;
      } catch {
        // ignore
      }
      throw new Error(errText);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  },
};

export default apiClient;
