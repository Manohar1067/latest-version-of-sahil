export function formatMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(Number(v))) return "₹0";
  return "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hh}:${mi}`;
}

/** Convert DD/MM/YYYY input to ISO. Returns "" if incomplete. */
export function ddmmyyyyToIso(s: string): string {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** ISO -> DD/MM/YYYY for form input value */
export function isoToDdmmyyyy(iso: string | undefined | null): string {
  if (!iso) return "";
  return formatDate(iso);
}

/**
 * Extract the trailing numeric sequence from a memo/entry number.
 * "SRL-2026-000014" => 14, "M-5" => 5. Non-conforming strings => NaN.
 */
export function memoNumberValue(v: string | null | undefined): number {
  const m = String(v ?? "").match(/(\d+)\s*$/);
  if (!m) return NaN;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Sort ANY list of memos/entries by Memo Number STRICT DESCENDING using the
 * numeric sequence portion (14, 13, 12, …), never alphabetical as plain text.
 *
 *  - Conforming numbers are ordered by suffix descending (000014 < 000002).
 *  - Rows whose number carries a numeric suffix rank ABOVE rows that cannot be
 *    parsed (numeric first, non-conforming at the bottom).
 *  - Exact ties (same numeric suffix across different prefixes) break on the
 *    full number string, also descending.
 */
export function compareMemoNumberDesc(a: string | null | undefined, b: string | null | undefined): number {
  const va = memoNumberValue(a);
  const vb = memoNumberValue(b);
  const aNum = Number.isFinite(va);
  const bNum = Number.isFinite(vb);
  if (aNum && bNum && va !== vb) return vb - va;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return String(b).localeCompare(String(a), "en", { numeric: true });
}

export function toInputDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function fromInputDate(v: string): string {
  if (!v) return "";
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Canonical calendar-date key (YYYY-MM-DD) in the *local* timezone, mirroring
 * exactly how formatDate() parses/renders a value. Filters compare date keys so
 * a date picked in a calendar always matches the date as displayed in a row,
 * independent of the raw ISO/DB representation (no off-by-one across timezones).
 */
export function toDateKey(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Normalize a truck/registration number to display form: trimmed, internal
 *  whitespace collapsed, and uppercased (e.g. "mh25ak 9980" -> "MH25AK 9980"). */
export function normalizeTruckNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toUpperCase();
}

/** Fields that participate in the LR-workflow status resolution. */
export interface WorkflowStatusFields {
  status: string;
  lrReceivedDate?: string | null;
  lrSubmittedDate?: string | null;
}

/**
 * Resolve the effective workflow status from ACTUAL stored fields, mirroring
 * the application's business rule:
 *  - "Payment Pending" and "Completed" are final/settled states — never overridden.
 *  - A set lr_submitted_date means the LR was submitted (supersedes received).
 *  - Otherwise a set lr_received_date means the LR was received.
 *  - Otherwise the stored status is returned unchanged.
 * This lets the Register List / Transport List status filters match records whose
 * LR state is represented by date fields (historical data) rather than a
 * maintained `status` column value.
 *
 * Date values are treated as "absent" when null/undefined, an empty string,
 * whitespace only, or a UI placeholder token ("—", "--", "-", "n/a", "null",
 * "undefined") — classification never depends on a formatted display string.
 * The stored status is trimmed so stray whitespace cannot break matching.
 */
const PLACEHOLDER_DATE = new Set(["", "—", "--", "-", "n/a", "N/A", "null", "undefined"]);
function dateFieldPresent(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0 && !PLACEHOLDER_DATE.has(s);
}

export function effectiveWorkflowStatus(r: WorkflowStatusFields): string {
  const s = (r.status ?? "").trim();
  if (s === "Completed" || s === "Payment Pending") return s;
  const sub = dateFieldPresent(r.lrSubmittedDate) ? String(r.lrSubmittedDate).trim() : "";
  const rcv = dateFieldPresent(r.lrReceivedDate) ? String(r.lrReceivedDate).trim() : "";
  if (sub) return "LR Submitted";
  if (rcv) return "LR Received";
  return s;
}

/**
 * Independent date-presence flags. A memo can hold BOTH TRUE at the same time:
 * LR Received and LR Submitted are OVERLAPPING filters, not exclusive statuses.
 * These are the ONLY source of truth for the "LR Received" / "LR Submitted"
 * status filters on the Register List and Transport List.
 */
export function hasLRReceived(r: WorkflowStatusFields): boolean {
  return dateFieldPresent(r.lrReceivedDate);
}
export function hasLRSubmitted(r: WorkflowStatusFields): boolean {
  return dateFieldPresent(r.lrSubmittedDate);
}

/**
 * SINGLE source of truth for the Register/Transport List top-level Status
 * filter. Every caller must use this; never re-implement the rule locally.
 *
 *  - "LR Received"  => include rows whose lr_received_date  exists, regardless
 *                      of lr_submitted_date.
 *  - "LR Submitted" => include rows whose lr_submitted_date exists, regardless
 *                      of lr_received_date.
 *    A memo with BOTH dates qualifies for BOTH filters (intentional overlap).
 *  - All other statuses (Dispatched, Delivered, Payment Pending, Completed)
 *    keep the exclusive effective-stage rule from effectiveWorkflowStatus:
 *    final states (Completed/Payment Pending) win, then LR Submitted supersedes
 *    LR Received for the single displayed badge, then the stored status.
 */
export function qualifiesForStatus(r: WorkflowStatusFields, status: string): boolean {
  switch (status) {
    case "LR Received": return hasLRReceived(r);
    case "LR Submitted": return hasLRSubmitted(r);
    default: return effectiveWorkflowStatus(r) === status;
  }
}
