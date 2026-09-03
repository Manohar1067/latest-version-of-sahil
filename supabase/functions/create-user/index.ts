// supabase/functions/create-user/index.ts
//
// Handles TWO actions, both admin-only server-side operations:
//   - action: "create"  → creates a brand-new Auth user + profile
//   - action: "reset_pin" → resets an EXISTING user's PIN (Super Admin only)
//
// Deploy with: supabase functions deploy create-user

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Browsers send a CORS preflight (OPTIONS) before any POST carrying custom
// headers. Without these headers the request never reaches the function and
// the client reports "Failed to send a request to the Edge Function".
const ALLOWED_ORIGINS = [
  // Production
  "https://sahils-dispatch-desk.vercel.app",
  // Local development. The Lovable-compatible dev server uses an 808x port
  // (http://localhost:8080, falling back to 8081/… when the primary is taken),
  // so the CORS allow-list must include the ports the browser actually sends.
  "http://localhost:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
};

const json = (body: unknown, status = 200, req: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401, req);

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerUser, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser?.user) return json({ error: "Invalid session" }, 401, req);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("auth_user_id", callerUser.user.id)
      .single();

    if (callerProfile?.role !== "Super Admin") {
      return json({ error: "Only Super Admins can do this" }, 403, req);
    }

    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "reset_pin") {
      const { targetAuthUserId, newPin } = body;
      if (!targetAuthUserId || !/^\d{6}$/.test(newPin)) {
        return json({ error: "Missing target user or invalid PIN (must be 6 digits)" }, 400, req);
      }

      const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetAuthUserId, {
        password: newPin,
      });
      if (updateErr) return json({ error: updateErr.message }, 400, req);

      await adminClient.from("profiles").update({ pin: newPin }).eq("auth_user_id", targetAuthUserId);

      return json({ success: true }, 200, req);
    }

    if (action === "delete") {
      const { targetAuthUserId } = body;
      if (!targetAuthUserId) {
        return json({ error: "Missing target user" }, 400, req);
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetAuthUserId)) {
        return json({ error: "Invalid target user identifier" }, 400, req);
      }

      // A Super Admin must never delete their own account.
      if (targetAuthUserId === callerUser.user.id) {
        return json({ error: "You cannot delete your own account." }, 400, req);
      }

      // Verify the target Auth user actually exists before attempting deletion.
      const { data: existingUser, error: findErr } = await adminClient.auth.admin.getUserById(
        targetAuthUserId,
      );
      if (findErr || !existingUser?.user) {
        return json({ error: "User not found" }, 404, req);
      }

      // Delete the Auth user FIRST: this is the authoritative step that makes
      // the account unable to authenticate. Any profile delete after this can
      // never resurrect the account, so there is no failure mode where the
      // account still works but its profile is gone.
      const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(targetAuthUserId);
      if (deleteAuthErr) {
        return json({ error: "Unable to delete user. Please try again." }, 400, req);
      }

      // Clean up the application-level profile record. If profiles.auth_user_id
      // is declared with ON DELETE CASCADE, the row is already removed above and
      // this is a no-op; if it is not (orphaned row), this removes it. Failure
      // here must not surface auth-deletion details to the caller.
      try {
        await adminClient.from("profiles").delete().eq("auth_user_id", targetAuthUserId);
      } catch {
        // best-effort cleanup only; auth user is already deleted
      }

      return json({ success: true }, 200, req);
    }

    // action === "create"
    const { name, email, phone, role, pin } = body;

    if (!name || !email || !role || !/^\d{6}$/.test(pin)) {
      return json({ error: "Missing or invalid fields (PIN must be 6 digits)" }, 400, req);
    }

    const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
    });

    if (createErr || !newAuthUser?.user) {
      return json({ error: createErr?.message ?? "Failed to create auth user" }, 400, req);
    }

    const { data: newProfile, error: profileErr } = await adminClient
      .from("profiles")
      .insert({
        auth_user_id: newAuthUser.user.id,
        name,
        email,
        phone: phone ?? null,
        role,
        pin,
        active: true,
      })
      .select()
      .single();

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return json({ error: profileErr.message }, 400, req);
    }

    return json({ profile: newProfile }, 200, req);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, req);
  }
});
