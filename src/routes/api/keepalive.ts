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

const NO_CACHE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const url = process.env.VITE_SUPABASE_URL;
          const key = process.env.VITE_SUPABASE_ANON_KEY;
          if (!url || !key) {
            return new Response(
              JSON.stringify({ ok: false, error: "Missing Supabase env vars" }),
              { status: 500, headers: NO_CACHE_HEADERS },
            );
          }

          const supabase = createClient(url, key);
          const { error } = await supabase.from("settings").select("id").limit(1);
          if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 500,
              headers: NO_CACHE_HEADERS,
            });
          }
          return new Response(
            JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
            { status: 200, headers: NO_CACHE_HEADERS },
          );
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 500,
            headers: NO_CACHE_HEADERS,
          });
        }
      },
    },
  },
});