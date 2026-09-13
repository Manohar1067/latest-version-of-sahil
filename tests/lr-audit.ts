/**
 * READ-ONLY real-database regression test for the LR Received / LR Submitted
 * OVERLAPPING status filters.
 *
 * For EVERY active memo it:
 *   - reads the RAW stored lr_received_date / lr_submitted_date,
 *   - computes membership with the CENTRALIZED helper (qualifiesForStatus),
 *   - asserts the filter matches raw date presence, and
 *   - asserts the overlap rule: a memo with BOTH dates qualifies for BOTH.
 * Prints the internal diagnostic table. NEVER writes/deletes. Run:
 *   node --experimental-strip-types tests/lr-audit.ts
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { qualifiesForStatus, hasLRReceived, hasLRSubmitted } from "../src/lib/format.ts";

const envText = fs.readFileSync("C:/Users/manoh/sahils-dispatch-desk/.env", "utf8");
const getEnv = (name: string) => {
  const m = envText.match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const sb = createClient(getEnv("VITE_SUPABASE_URL"), getEnv("VITE_SUPABASE_ANON_KEY"));

const { data, error } = await sb
  .from("memos")
  .select("memo_number,status,dispatch_date,unloading_date,lr_received_date,lr_submitted_date,final_payment_date,paid_at,is_deleted,is_draft")
  .not("is_deleted", "is", true)
  .order("memo_number", { ascending: false });
if (error) throw error;

const PLACEHOLDER = new Set(["", "—", "--", "-", "n/a", "N/A", "null", "undefined"]);
const present = (v: unknown) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0 && !PLACEHOLDER.has(s);
};

const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
console.log(pad("Memo #", 18) + pad("status", 16) + pad("LR Received", 14) + pad("LR Submitted", 14) + pad("LR-Rcv?", 7) + pad("LR-Sub?", 7));
console.log("-".repeat(70));

const lrReceivedMatch: string[] = [];
const lrSubmittedMatch: string[] = [];
let both = 0, rcvOnly = 0, subOnly = 0, none = 0;

for (const r of (data ?? []) as any[]) {
  const row = {
    status: String(r.status ?? ""),
    lrReceivedDate: r.lr_received_date ?? undefined,
    lrSubmittedDate: r.lr_submitted_date ?? undefined,
  };
  const rawRcv = present(row.lrReceivedDate);
  const rawSub = present(row.lrSubmittedDate);

  // Centralized filter MUST equal raw date presence — no effective-status override.
  assert.equal(hasLRReceived(row), rawRcv, `${r.memo_number}: hasLRReceived matches raw lr_received_date`);
  assert.equal(hasLRSubmitted(row), rawSub, `${r.memo_number}: hasLRSubmitted matches raw lr_submitted_date`);
  assert.equal(qualifiesForStatus(row, "LR Received"), rawRcv, `${r.memo_number}: LR Received filter == raw date presence`);
  assert.equal(qualifiesForStatus(row, "LR Submitted"), rawSub, `${r.memo_number}: LR Submitted filter == raw date presence`);

  if (qualifiesForStatus(row, "LR Received")) lrReceivedMatch.push(String(r.memo_number));
  if (qualifiesForStatus(row, "LR Submitted")) lrSubmittedMatch.push(String(r.memo_number));

  if (rawRcv && rawSub) { both++; assert.equal(qualifiesForStatus(row, "LR Received") && qualifiesForStatus(row, "LR Submitted"), true, `${r.memo_number}: BOTH-dates memo must qualify for BOTH filters`); }
  else if (rawRcv) rcvOnly++;
  else if (rawSub) subOnly++;
  else none++;

  console.log(
    pad(String(r.memo_number), 18) +
    pad(String(r.status ?? ""), 16) +
    pad(rawRcv ? String(r.lr_received_date) : "—", 14) +
    pad(rawSub ? String(r.lr_submitted_date) : "—", 14) +
    pad(rawRcv ? "YES" : "NO", 7) + pad(rawSub ? "YES" : "NO", 7),
  );
}
console.log("-".repeat(70));
console.log(`Totals: active=${(data ?? []).length}  bothDates=${both}  rcvOnly=${rcvOnly}  subOnly=${subOnly}  neither=${none}`);
console.log(`LR Received filter = ${lrReceivedMatch.length} rows: ${lrReceivedMatch.join(", ")}`);
console.log(`LR Submitted filter = ${lrSubmittedMatch.length} rows: ${lrSubmittedMatch.join(", ")}`);

// Every memo that appears under LR Received also has a raw lr_received_date and vice-versa.
for (const n of lrReceivedMatch) {
  const r = (data ?? []).find((x: any) => String(x.memo_number) === n);
  assert.equal(present(r?.lr_received_date), true, `${n}: LR Received match has raw lr_received_date`);
}
for (const n of lrSubmittedMatch) {
  const r = (data ?? []).find((x: any) => String(x.memo_number) === n);
  assert.equal(present(r?.lr_submitted_date), true, `${n}: LR Submitted match has raw lr_submitted_date`);
}

console.log("lr-audit: all passed");