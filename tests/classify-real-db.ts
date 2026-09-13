/**
 * DB-level verification: run the REAL centralized filter logic
 * (src/lib/format.ts -> qualifiesForStatus / hasLRReceived / hasLRSubmitted)
 * against the REAL memos table, mapping columns exactly as dataStore.rowToMemo()
 * does. Read-only — never writes.
 *
 * Run with: node --experimental-strip-types tests/classify-real-db.ts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { qualifiesForStatus, hasLRReceived, hasLRSubmitted } from "../src/lib/format.ts";

const envText = fs.readFileSync("C:/Users/manoh/sahils-dispatch-desk/.env", "utf8");
const getEnv = (name: string) => {
  const m = envText.match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const sb = createClient(getEnv("VITE_SUPABASE_URL"), getEnv("VITE_SUPABASE_ANON_KEY"));

// Mirrors rowToMemo's field mapping for the workflow-relevant subset.
interface MemoRow {
  memo_number: string;
  status: string | null;
  dispatch_date: string | null;
  unloading_date: string | null;
  lr_received_date: string | null;
  lr_submitted_date: string | null;
  final_payment_date: string | null;
  paid_at: string | null;
  is_deleted: boolean | null;
}
interface WorkflowFields {
  status: string;
  lrReceivedDate: string | undefined;
  lrSubmittedDate: string | undefined;
}
function toWorkflowFields(r: MemoRow): WorkflowFields {
  return {
    status: String(r.status ?? ""),
    lrReceivedDate: r.lr_received_date ?? undefined,
    lrSubmittedDate: r.lr_submitted_date ?? undefined,
  };
}

const iso = (v: string | null) => (v ? String(v).slice(0, 10) : "—");

const { data, error } = await sb
  .from("memos")
  .select("memo_number, status, dispatch_date, unloading_date, lr_received_date, lr_submitted_date, final_payment_date, paid_at, is_deleted")
  .not("is_deleted", "is", true)
  .order("dispatch_date", { ascending: false });
if (error) throw error;

console.log("Memo | Stored Status | LR Received | LR Submitted | In LR Received filter | In LR Submitted filter | In Dispatched | In Completed");
for (const m of data ?? []) {
  const f = toWorkflowFields(m);
  console.log(
    `${m.memo_number.padEnd(14)} | ${(f.status).padEnd(14)} | ${iso(m.lr_received_date).padEnd(12)} | ` +
    `${iso(m.lr_submitted_date).padEnd(13)} | ${String(hasLRReceived(f)).padEnd(21)} | ${String(hasLRSubmitted(f)).padEnd(20)} | ` +
    `${String(qualifiesForStatus(f, "Dispatched")).padEnd(14)} | ${String(qualifiesForStatus(f, "Completed"))}`
  );
}

const members = (p: (f: WorkflowFields) => boolean) =>
  (data ?? []).filter((m) => p(toWorkflowFields(m as MemoRow))).map((m) => m.memo_number);

console.log("\n=== FILTER RESULTS WITH REAL DATA ===");
for (const status of ["Dispatched", "Delivered", "Payment Pending", "LR Received", "LR Submitted", "Completed"]) {
  const ms = members((f) => qualifiesForStatus(f, status));
  console.log(`${status}\t=> ${ms.length} rows\t${ms.join(", ")}`);
}

const lrR = members(hasLRReceived);
const lrS = members(hasLRSubmitted);
const both = lrR.filter((n) => lrS.includes(n));
console.log(`\nMEMOS WITH BOTH DATES (must appear in BOTH LR filters): ${both.length} => ${both.join(", ")}`);