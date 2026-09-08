/**
 * AuthContext — scalable login backed by Supabase Auth + a `profiles` table.
 *
 * No accounts are hardcoded here. The person logs in with their internal
 * email + PIN; Supabase Auth verifies the credential, then this context
 * loads their profile row (name, role, active status) from the database.
 *
 * Adding a user is done entirely through the User Management page — no
 * code changes are ever required.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, capturedHash } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export type UserRole = "Super Admin" | "Viewer";

/** Type guard — true only for the Super Admin role. */
export function isSuperAdmin(profile: { role: UserRole } | null | undefined): boolean {
  return profile?.role === "Super Admin";
}

/** Type guard — true only for the Viewer (read-only) role. */
export function isViewer(profile: { role: UserRole } | null | undefined): boolean {
  return profile?.role === "Viewer";
}

export interface Profile {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
}

/** Error surfaced by Supabase when a recovery link is invalid/expired. */
export interface RecoveryError {
  code?: string;
  description?: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** True while the app holds a Supabase PASSWORD_RECOVERY session.
   *  A recovery session is a temporary auth state that must route to
   *  /reset-pin and take priority over normal Dashboard routing. */
  isRecovery: boolean;
  /** Set when the URL carries an invalid/expired recovery error. */
  recoveryError: RecoveryError | null;
  login: (email: string, pin: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  changeOwnPin: (newPin: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function rowToProfile(r: any): Profile {
  return {
    id: r.id,
    authUserId: r.auth_user_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    active: r.active,
  };
}

/**
 * Detect recovery state from the URL hash snapshot captured BEFORE the
 * Supabase client initialised.
 *
 * Two categories:
 *   1. **Error** — the hash carries `error` / `error_code` / `error_description`.
 *      This means the link is invalid or expired.
 *   2. **Recovery tokens** — the hash carries `type=recovery`, `access_token`
 *      (implicit flow) or `code` (PKCE flow).  This means Supabase is about
 *      to grant (or has already granted) a recovery session.
 *
 * IMPORTANT: Do NOT call this with `window.location.hash` — by the time React
 * mounts the Supabase client may have already cleared the hash.  Use the
 * `capturedHash` snapshot from supabaseClient instead.
 */
function detectRecoveryFromHash(
  hash: string,
): { isRecoveryHash: boolean; error: RecoveryError | null } {
  const raw = hash.replace(/^#/, "");
  if (!raw) return { isRecoveryHash: false, error: null };

  const params = new URLSearchParams(raw);

  // --- error indicators (expired / invalid link) ---
  const errorCode = params.get("error_code") ?? params.get("error") ?? undefined;
  const errorDesc = params.get("error_description") ?? undefined;
  if (errorCode || errorDesc) {
    return {
      isRecoveryHash: false,
      error: { code: errorCode, description: errorDesc },
    };
  }

  // --- success indicators (recovery tokens present) ---
  const type = params.get("type");
  const accessToken = params.get("access_token");
  const code = params.get("code");
  if (type === "recovery" || accessToken || code) {
    return { isRecoveryHash: true, error: null };
  }

  return { isRecoveryHash: false, error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<RecoveryError | null>(null);

  // Kept in sync so async callbacks (getSession) read the latest recovery
  // value without relying on a stale closure of the state variable.
  const isRecoveryRef = useRef(false);
  const setRecoveryFlag = (v: boolean) => {
    isRecoveryRef.current = v;
    setIsRecovery(v);
  };
  const isRecoveryRefSafe = () => isRecoveryRef.current;

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, name, email, phone, role, active, updated_at")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
      return null;
    }
    const p = rowToProfile(data);
    setProfile(p);
    return p;
  }

  useEffect(() => {
    // ── 1. Synchronous hash-based detection ──────────────────────────────
    // Prefer the snapshot captured BEFORE createClient cleared the hash, and
    // fall back to the live hash in case Supabase hasn't cleared it yet by the
    // time this effect runs (belt-and-suspenders; both are read-only).
    const hash = capturedHash || (typeof window !== "undefined" ? window.location.hash : "");
    const { isRecoveryHash, error: hashError } = detectRecoveryFromHash(hash);

    if (hashError) {
      setRecoveryError(hashError);
    }
    if (isRecoveryHash) {
      setRecoveryFlag(true);
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[auth] init — hash:", hash ? "present" : "empty",
        "isRecoveryHash:", isRecoveryHash,
        "hashError:", hashError?.code ?? hashError?.description ?? null);
    }

    // ── 2. Register auth listener BEFORE getSession so we don't miss events ──
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[auth] event:", event, "session:", newSession ? "present" : "none");
        }
        if (event === "PASSWORD_RECOVERY") {
          setRecoveryFlag(true);
        }
        if (event === "SIGNED_OUT") {
          setRecoveryFlag(false);
          setRecoveryError(null);
        }
        // Use functional update so a later getSession resolution cannot
        // overwrite a session that was already set by PASSWORD_RECOVERY.
        setSession((prev) => {
          if (event === "SIGNED_OUT") return newSession;
          // Keep existing session if the event didn't produce one (avoids
          // a stale getSession null overwriting a real session).
          return newSession ?? prev;
        });
        if (newSession?.user?.id) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    // ── 3. Resolve the current session ───────────────────────────────────
    supabase.auth.getSession().then(async ({ data }) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[auth] getSession — session:", data.session ? "present" : "none",
          "isRecovery:", isRecoveryRefSafe());
      }
      // Use functional update: only set session if we don't already have one
      // from a PASSWORD_RECOVERY / SIGNED_IN event that raced ahead.
      setSession((prev) => prev ?? data.session);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email: string, pin: string): Promise<{ error: string | null }> {
    if (!/^\d{6}$/.test(pin)) {
      return { error: "PIN must be exactly 6 digits." };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (error || !data.user) {
      return { error: "Incorrect email or PIN." };
    }

    const p = await loadProfile(data.user.id);
    if (!p) {
      await supabase.auth.signOut();
      return { error: "No profile found for this account. Contact a Super Admin." };
    }
    if (!p.active) {
      await supabase.auth.signOut();
      return { error: "This account has been disabled. Contact a Super Admin." };
    }
    return { error: null };
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function changeOwnPin(newPin: string): Promise<{ error: string | null }> {
    if (!/^\d{6}$/.test(newPin)) {
      return { error: "PIN must be exactly 6 digits." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPin });
    if (error) return { error: error.message };
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, isRecovery, recoveryError, login, logout, changeOwnPin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
