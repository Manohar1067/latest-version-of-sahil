/**
 * Unit tests for the centralized workflow/status filter logic.
 * Run with: node --experimental-strip-types tests/workflow-status.test.ts
 *
 * Business rule (Register List + Transport List Status filters):
 *  - LR Received  => date-presence filter on lr_received_date  (o() name)
 *  - LR Submitted => date-presence filter on lr_submitted_date
 *  - They OVERLAP: a memo with both dates qualifies for BOTH filters.
 *  - Dispatched / Delivered / Payment Pending / Completed keep the exclusive
 *    effective-stage rule (effectiveWorkflowStatus) used for the badge.
 */
import assert from "node:assert/strict";
import { effectiveWorkflowStatus, hasLRReceived, hasLRSubmitted, qualifiesForStatus } from "../src/lib/format.ts";

const row = (over: Record<string, unknown>) => ({
  status: "Dispatched",
  lrReceivedDate: undefined,
  lrSubmittedDate: undefined,
  ...over,
});

// --- Case 1: LR Received only ---------------------------------------------
const c1 = row({ lrReceivedDate: "2026-09-10" });
assert.equal(hasLRReceived(c1), true, "C1: hasLRReceived");
assert.equal(hasLRSubmitted(c1), false, "C1: hasLRSubmitted");
assert.equal(qualifiesForStatus(c1, "LR Received"), true, "C1: qualifies LR Received");
assert.equal(qualifiesForStatus(c1, "LR Submitted"), false, "C1: does NOT qualify LR Submitted");

// --- Case 2: LR Submitted only --------------------------------------------
const c2 = row({ lrSubmittedDate: "2026-09-11" });
assert.equal(hasLRReceived(c2), false, "C2: hasLRReceived");
assert.equal(hasLRSubmitted(c2), true, "C2: hasLRSubmitted");
assert.equal(qualifiesForStatus(c2, "LR Received"), false, "C2: does NOT qualify LR Received");
assert.equal(qualifiesForStatus(c2, "LR Submitted"), true, "C2: qualifies LR Submitted");

// --- Case 3: BOTH dates => in BOTH filters (the critical requirement) ------
const c3 = row({ lrReceivedDate: "2026-09-10", lrSubmittedDate: "2026-09-11" });
assert.equal(qualifiesForStatus(c3, "LR Received"), true, "C3: LR Received must match");
assert.equal(qualifiesForStatus(c3, "LR Submitted"), true, "C3: LR Submitted must match");
// Never remove from LR Received just because LR Submitted exists:
assert.equal(hasLRReceived(c3) && hasLRSubmitted(c3), true, "C3: independent flags both true");

// --- Case 4: neither date --------------------------------------------------
const c4 = row({});
assert.equal(qualifiesForStatus(c4, "LR Received"), false, "C4: no LR Received");
assert.equal(qualifiesForStatus(c4, "LR Submitted"), false, "C4: no LR Submitted");

// --- Case 5: LR Received date changed after editing ------------------------
// Presence is what matters; changing the date value to a new present date keeps
// membership, and clearing it drops membership.
assert.equal(qualifiesForStatus(row({ lrReceivedDate: "2026-09-10" }), "LR Received"), true);
assert.equal(qualifiesForStatus(row({ lrReceivedDate: "2026-09-18" }), "LR Received"), true, "C5: changed date still present");
assert.equal(qualifiesForStatus(row({ lrReceivedDate: null }), "LR Received"), false);

// --- Case 6: LR Submitted date changed after editing -----------------------
assert.equal(qualifiesForStatus(row({ lrSubmittedDate: "2026-09-14" }), "LR Submitted"), true);
assert.equal(qualifiesForStatus(row({ lrSubmittedDate: "2026-09-19" }), "LR Submitted"), true, "C6: changed date still present");
assert.equal(qualifiesForStatus(row({ lrSubmittedDate: undefined }), "LR Submitted"), false);

// --- Case 7: LR Received cleared while LR Submitted remains ----------------
const c7 = row({ lrReceivedDate: null, lrSubmittedDate: "2026-09-11" });
assert.equal(qualifiesForStatus(c7, "LR Received"), false, "C7: absent from LR Received");
assert.equal(qualifiesForStatus(c7, "LR Submitted"), true, "C7: still in LR Submitted");

// --- Other statuses keep their exclusive rule ------------------------------
assert.equal(qualifiesForStatus(row({}), "Dispatched"), true);
assert.equal(qualifiesForStatus(row({ status: "Delivered" }), "Delivered"), true);
assert.equal(qualifiesForStatus(row({ status: "Payment Pending" }), "Payment Pending"), true);
assert.equal(qualifiesForStatus(row({ status: "Completed" }), "Completed"), true);
// Completed is final and stays Completed even with LR dates:
assert.equal(qualifiesForStatus(row({ status: "Completed", lrReceivedDate: "2026-09-10", lrSubmittedDate: "2026-09-11" }), "Completed"), true);

// --- effectiveWorkflowStatus is display-only; LR stages are NOT exclusive ---
// Effective badge shows "LR Submitted" for a both-dates memo...
assert.equal(effectiveWorkflowStatus(c3), "LR Submitted");
// ...but the FILTER must still match it under LR Received (overlap):
assert.equal(qualifiesForStatus(c3, "LR Received"), true, "effective is display-only, filter overlaps");

// --- Date normalization: YYYY-MM-DD, DD/MM/YYYY, Date object, null/blank/em-dash
assert.equal(hasLRReceived(row({ lrReceivedDate: "10/09/2026" })), true, "DD/MM/YYYY present");
assert.equal(hasLRReceived(row({ lrReceivedDate: new Date("2026-09-10T00:00:00") })), true, "Date object present");
assert.equal(hasLRReceived(row({ lrReceivedDate: null })), false);
assert.equal(hasLRReceived(row({ lrReceivedDate: undefined })), false);
assert.equal(hasLRReceived(row({ lrReceivedDate: "" })), false);
assert.equal(hasLRReceived(row({ lrReceivedDate: "—" })), false);
assert.equal(hasLRReceived(row({ lrReceivedDate: "   " })), false);
assert.equal(hasLRSubmitted(row({ lrSubmittedDate: "" })), false);
assert.equal(hasLRSubmitted(row({ lrSubmittedDate: "—" })), false, "placeholder not a date");
assert.equal(hasLRReceived(row({ lrReceivedDate: "\u2014" })), false);

console.log("workflow-status tests: all passed");