// src/routes/api/keepalive.ts
//
// Uses the SAME createFileRoute function already used throughout this
// codebase (new-memo.tsx, register.tsx, etc.) — just with a `server.handlers`
// option instead of `component`. This is a server-only route: no UI, just
// a GET handler that runs on Vercel's server and returns JSON.
//
// This avoids the separate createServerFileRoute API, which has a known
// stability issue in some versions causing "Crawling result not available".

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL as string,
            process.env.VITE_SUPABASE_ANON_KEY as string,
          );
          const { error } = await supabase.from("settings").select("id").limit(1);
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});