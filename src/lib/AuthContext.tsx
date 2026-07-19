/**
 * AuthContext — scalable login backed by Supabase Auth + a `profiles` table.
 *
 * No accounts are hardcoded here. The person logs in with their internal
 * email + PIN; Supabase Auth verifies the credential, then this context
 * loads their profile row (name, role, active status) from the database.
 *
 * Adding a user is done entirely through the User Management page — no
 * code changes are ever required.
 *
 * TEMPORARY: console.log lines below are for debugging the login-bounce
 * issue — remove them once login is confirmed working end-to-end.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";

export type UserRole = "Super Admin" | "Admin" | "Office Staff" | "Viewer";

export interface Profile {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();
    console.log("loadProfile query — userId:", userId, "data:", data, "error:", error);
    if (error || !data) {
      setProfile(null);
      return null;
    }
    const p = rowToProfile(data);
    setProfile(p);
    return p;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
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

    console.log("Auth succeeded, user id:", data.user.id, "email:", data.user.email);
    const p = await loadProfile(data.user.id);
    console.log("Profile lookup result:", p);
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
    <AuthContext.Provider value={{ session, profile, loading, login, logout, changeOwnPin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}