const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Fetches all problem statements from the FastAPI backend.
 *
 * @param {string} [domain] - Optional domain filter
 * @returns {Promise<Array<{code: string, title: string, description: string, domain: string, id?: string}>>}
 */
export async function getProblemStatements(domain) {
  try {
    const url = domain
      ? `${API_BASE_URL}/api/problem-statements/?domain=${encodeURIComponent(domain)}`
      : `${API_BASE_URL}/api/problem-statements/`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch problem statements: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching problem statements from backend:", error);
    return [];
  }
}
