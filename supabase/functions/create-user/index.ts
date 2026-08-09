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
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerUser, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser?.user) return json({ error: "Invalid session" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("auth_user_id", callerUser.user.id)
      .single();

    if (callerProfile?.role !== "Super Admin") {
      return json({ error: "Only Super Admins can do this" }, 403);
    }

    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "reset_pin") {
      const { targetAuthUserId, newPin } = body;
      if (!targetAuthUserId || !/^\d{6}$/.test(newPin)) {
        return json({ error: "Missing target user or invalid PIN (must be 6 digits)" }, 400);
      }

      const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetAuthUserId, {
        password: newPin,
      });
      if (updateErr) return json({ error: updateErr.message }, 400);

      await adminClient.from("profiles").update({ pin: newPin }).eq("auth_user_id", targetAuthUserId);

      return json({ success: true });
    }

    // action === "create"
    const { name, email, phone, role, pin } = body;

    if (!name || !email || !role || !/^\d{6}$/.test(pin)) {
      return json({ error: "Missing or invalid fields (PIN must be 6 digits)" }, 400);
    }

    const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
    });

    if (createErr || !newAuthUser?.user) {
      return json({ error: createErr?.message ?? "Failed to create auth user" }, 400);
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
      return json({ error: profileErr.message }, 400);
    }

    return json({ profile: newProfile });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
