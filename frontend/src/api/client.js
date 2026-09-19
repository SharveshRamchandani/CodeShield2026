export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const TOKEN_STORAGE_KEY = "codeshield_token";

/**
 * Standardized API client with automatic JWT token attachment and error handling.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  const headers = {
    ...(!options.isFormData && !options.noContentType && { "Content-Type": "application/json" }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === "object" && !options.isFormData) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

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
    const errorMessage =
      (data && (data.detail || data.message)) ||
      `Request failed with status ${response.status}: ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: "POST", body }),
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
