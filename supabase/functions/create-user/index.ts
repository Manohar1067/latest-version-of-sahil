// supabase/functions/create-user/index.ts
//
// This function runs on Supabase's server, never in the browser. It's the
// ONLY place allowed to use the Secret key, because creating a real Auth
// account requires admin privileges that must never reach client code.
//
// The client calls this function (via supabase.functions.invoke) instead of
// ever creating auth users directly. This function:
//   1. Verifies the CALLER is a logged-in Super Admin (checks their own JWT).
//   2. Creates the new Supabase Auth user (email + PIN as password).
//   3. Creates the matching profiles row.
//   4. Returns the new profile, or an error.
//
// Deploy with: supabase functions deploy create-user
// (requires the Supabase CLI installed locally — see deployment notes below)

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
    }

    // Client authenticated as the caller, using their own token — used only
    // to verify who is making this request.
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerUser, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    // Admin client — full privileges, used only for the actual creation steps below.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("auth_user_id", callerUser.user.id)
      .single();

    if (callerProfile?.role !== "Super Admin") {
      return new Response(JSON.stringify({ error: "Only Super Admins can create users" }), { status: 403 });
    }

    const { name, email, phone, role, pin } = await req.json();

    if (!name || !email || !role || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "Missing or invalid fields (PIN must be 6 digits)" }), { status: 400 });
    }

    const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true, // skip email verification — internal fake addresses
    });

    if (createErr || !newAuthUser?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create auth user" }), { status: 400 });
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
      // Roll back the auth user if the profile insert failed, to avoid orphaned accounts
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ profile: newProfile }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});