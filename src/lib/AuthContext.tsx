/**
 * AuthContext — PIN-based login backed by Supabase Auth.
 *
 * Supports TWO admin PINs. Each admin has their own internal identifier
 * behind the scenes — these are NOT real email addresses and nothing is ever
 * sent to them. They exist only because Supabase Auth's password system
 * requires an "email" field as the account identifier.
 *
 * ⚠️ IMPORTANT: the two emails below MUST exactly match, character-for-
 * character, the two users you create in Supabase Authentication -> Users.
 * If they don't match exactly, every login attempt will fail with
 * "Incorrect PIN" even when the PIN itself is correct.
 *
 * Temporary console logging is included below so you can see the REAL
 * reason a login failed (open browser DevTools -> Console). Remove the
 * console.log lines once everything is confirmed working.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface AdminAccount {
  name: string;
  email: string; // internal identifier only — never a real email, never contacted
}

// ⚠️ These two emails must exactly match what you create in Supabase.
const ADMIN_ACCOUNTS: AdminAccount[] = [
  { name: "Admin 1", email: "adminshail@gmail.com" },
  { name: "Admin 2", email: "sahil111tms@gmail.com" },
];

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  displayName: string;
  loginWithPin: (pin: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const displayName =
    ADMIN_ACCOUNTS.find((a) => a.email === session?.user?.email)?.name ?? "Admin";

  async function loginWithPin(pin: string): Promise<{ error: string | null }> {
    if (!/^\d{6}$/.test(pin)) {
      return { error: "PIN must be exactly 6 digits." };
    }
    for (const account of ADMIN_ACCOUNTS) {
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: pin,
      });
      if (!error) {
        console.log(`✅ Login succeeded for ${account.email}`);
        return { error: null };
      }
      // TEMPORARY — remove once login is confirmed working.
      console.log(`❌ Login attempt failed for ${account.email}:`, error.message);
    }
    return { error: "Incorrect PIN. Please try again." };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, displayName, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}