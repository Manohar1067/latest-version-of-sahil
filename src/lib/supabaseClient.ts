import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check that .env.local exists and contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart your dev server.'
  );
}

/**
 * Snapshot the URL hash BEFORE the Supabase client processes it.
 *
 * `createClient` starts an async initialization that reads and clears auth
 * tokens from the URL hash (for PKCE code exchange, implicit token storage,
 * etc.).  By the time React mounts and registers `onAuthStateChange`, the
 * `PASSWORD_RECOVERY` event may have already fired and been lost.
 *
 * Capturing the hash here — before `createClient` runs — lets AuthContext
 * synchronously detect a recovery flow and prevent the Dashboard from
 * flashing during the brief window between session creation and event
 * delivery.
 */
export const capturedHash: string =
  typeof window !== "undefined" ? window.location.hash : "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);