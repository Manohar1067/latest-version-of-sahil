/**
 * AuthContext — PIN-based login backed by Supabase Auth.
 *
 * Under the hood this uses Supabase's standard email/password auth with one
 * fixed internal email — the person only ever sees a PIN field, never the email.
 *
 * To add a second office-staff PIN later: create another Supabase Auth user
 * with a different internal email, and extend ADMIN_EMAIL below into a small
 * lookup (PIN -> email) instead of a single constant. Structured this way now
 * so that extension doesn't require touching the login screen itself.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

const ADMIN_EMAIL = "admin@sahilroadlines.local";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
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

  async function loginWithPin(pin: string): Promise<{ error: string | null }> {
    if (!/^\d{6}$/.test(pin)) {
      return { error: "PIN must be exactly 6 digits." };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: pin,
    });
    if (error) {
      return { error: "Incorrect PIN. Please try again." };
    }
    return { error: null };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}