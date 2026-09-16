import { supabase, FALLBACK_PROBLEM_STATEMENTS } from "../lib/supabase";

/**
 * Fetches all problem statements.
 * Temporary data layer using Supabase client directly.
 * Can be swapped cleanly to `fetch('/api/problem-statements')` when the backend is ready.
 *
 * @returns {Promise<Array<{code: string, title: string, description: string, domain: string}>>}
 */
export async function getProblemStatements() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("problem_statements")
        .select("id, code, title, description, domain")
        .order("code", { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {
      // Return fallback catalog on connection failure
    }
  }

  return FALLBACK_PROBLEM_STATEMENTS;
}
