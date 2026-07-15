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
