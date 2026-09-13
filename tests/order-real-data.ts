/**
 * Real-data ordering verification (READ-ONLY).
 * Loads actual memos + transport_list rows, applies the SAME filter logic used
 * by the Register/Transport List pages, sorts with the SAME centralized
 * comparator (compareMemoNumberDesc), and asserts strict descending memo-number
 * order. Run: node --experimental-strip-types tests/order-real-data.ts
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { compareMemoNumberDesc, memoNumberValue, qualifiesForStatus } from "../src/lib/format.ts";

const envText = fs.readFileSync("C:/Users/manoh/sahils-dispatch-desk/.env", "utf8");
const getEnv = (name: string) => {
  const m = envText.match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const sb = createClient(getEnv("VITE_SUPABASE_URL"), getEnv("VITE_SUPABASE_ANON_KEY"));

const { data: memos, error } = await sb
  .from("memos")
  .select("memo_number,status,dispatch_date,truck_id,consignee_id,driver_name,truck_number,consignee_name,lr_received_date,lr_submitted_date,is_deleted")
  .not("is_deleted", "is", true);
if (error) throw error;

const rows = (memos ?? []).map((r: any) => ({
  memoNumber: String(r.memo_number),
  status: String(r.status ?? ""),
  truckId: r.truck_id ?? "",
  consigneeId: r.consignee_id ?? "",
  truckNumber: r.truck_number ?? "",
  consigneeName: r.consignee_name ?? "",
  driverName: r.driver_name ?? "",
  lrReceivedDate: r.lr_received_date ?? undefined,
  lrSubmittedDate: r.lr_submitted_date ?? undefined,
}));

function verify(label: string, list: { memoNumber: string }[]) {
  const nums = list.map((x) => memoNumberValue(x.memoNumber));
  for (let i = 1; i < nums.length; i++) {
    assert.ok(nums[i - 1] >= nums[i], `${label}: out of order at ${i} (${list[i - 1].memoNumber} -> ${list[i].memoNumber})`);
  }
  console.log(`${label}\t=> ${list.length} rows: ${list.map((x) => x.memoNumber).slice(0, 12).join(", ")}${list.length > 12 ? ", …" : ""}`);
}

// All Time: no filter, then sort.
verify("All Time", [...rows].sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));

// Status filters (same qualifiesForStatus semantics as the page).
for (const status of ["Dispatched", "Delivered", "Payment Pending", "LR Received", "LR Submitted", "Completed"]) {
  verify(`${status}`, rows.filter((r) => qualifiesForStatus(r, status)).sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));
}

// Search filter (term derived from real data, then sort).
const someTerm = rows[0]?.driverName || rows[0]?.truckNumber || "";
if (someTerm) {
  const q = someTerm.toLowerCase();
  verify("Search", rows.filter((r) => [r.memoNumber, r.driverName, r.truckNumber, r.consigneeName].some((v) => String(v).toLowerCase().includes(q))).sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));
}

// Truck filter (most common truckId among real rows, then sort).
const truckCount: Record<string, number> = {};
rows.forEach((r) => { if (r.truckId) truckCount[r.truckId] = (truckCount[r.truckId] || 0) + 1; });
const topTruck = Object.keys(truckCount).sort((a, b) => truckCount[b] - truckCount[a])[0];
if (topTruck) verify("Truck filter", rows.filter((r) => r.truckId === topTruck).sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));

// Consignee filter (most common consigneeId, then sort).
const consigneeCount: Record<string, number> = {};
rows.forEach((r) => { if (r.consigneeId) consigneeCount[r.consigneeId] = (consigneeCount[r.consigneeId] || 0) + 1; });
const topConsignee = Object.keys(consigneeCount).sort((a, b) => consigneeCount[b] - consigneeCount[a])[0];
if (topConsignee) verify("Consignee filter", rows.filter((r) => r.consigneeId === topConsignee).sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));

// Transport List (real transport_list rows, then sort by entry_number).
const { data: transport, error: terr } = await sb.from("transport_list").select("entry_number");
if (terr) {
  console.log("transport_list query error: " + JSON.stringify(terr.message));
} else {
  const tRows = (transport ?? []).map((r: any) => ({ memoNumber: String(r.entry_number) }));
  verify("Transport List", [...tRows].sort((a, b) => compareMemoNumberDesc(a.memoNumber, b.memoNumber)));
}

console.log("order-real-data: all passed");