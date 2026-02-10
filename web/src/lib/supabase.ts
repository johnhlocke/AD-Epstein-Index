import { createClient } from "@supabase/supabase-js";

/**
 * Server-side only Supabase client.
 * Uses the service role key — NEVER expose to the client.
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
  }

  return createClient(url, key);
}

export { getSupabase };
