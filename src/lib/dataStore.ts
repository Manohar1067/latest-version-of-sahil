/**
 * ============================================================================
 *  DATA STORE — Sahil Road Lines ERP (Supabase-backed)
 * ----------------------------------------------------------------------------
 *  Same exported functions/types as the original localStorage version —
 *  every UI component that imports from this file needs zero changes.
 *
 *  Audit log entries and status history are written automatically by database
 *  triggers (see supabase_migration_2.sql) — this file does not write to
 *  audit_log or memo_status_history directly, it just reads them back.
 * ============================================================================
 */

import { supabase } from "./supabaseClient";

// -----------------------------  TYPES  --------------------------------------
// (unchanged from the original file)

export type TruckStatus = "Available" | "Running" | "Maintenance" | "Inactive";
export interface FleetTruck {
  id: string;
  truckNumber: string;
  ownerName: string;
  ownerPhone: string;
  driverName: string;
  driverPhone: string;
  insuranceExpiry?: string;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Consignee {
  id: string;
  companyName: string;
  address: string;
  contactPerson: string;
  phone: string;
  city: string;
  state: string;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type MemoStatus =
  | "Dispatched"
  | "Delivered"
  | "Payment Pending"
  | "LR Received"
  | "LR Submitted"
  | "Completed";

export const ALL_MEMO_STATUSES: MemoStatus[] = [
  "Dispatched",
  "Delivered",
  "Payment Pending",
  "LR Received",
  "LR Submitted",
  "Completed",
];

export interface Memo {
  id: string;
  memoNumber: string;
  dispatchDate: string;
  fromLocation: string;
  toLocation: string;
  transportName: string;
  consigneeId: string;
  truckId: string;
  truckNumber: string;      // free text, like transportName — no link required
  consigneeName: string;    // free text, like transportName — no link required
  driverName: string;
  ownerName: string;
  ownerPhone: string;
  materialName: string;
  weightTons: number;
  ratePerTon: number;
  netFreight: number;
  unloadingDate?: string;
  lrReceivedDate?: string;
  lrSubmittedDate?: string;
  description?: string;
  advance: number;
  balance: number;
  commission: number;
  loadingCharges: number;
  tds: number;
  goodsMamuli: number;
  totalExpenses: number;
  paidBy: string;
  paymentMethod: string;
  finalPayable: number;
  finalPaymentDate?: string;
  internalNotes?: string;
  status: MemoStatus;
  remarks?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoStatusHistory {
  id: string;
  memoId: string;
  oldStatus: MemoStatus | null;
  newStatus: MemoStatus;
  changedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entityType: "Memo" | "Truck" | "Consignee" | "Settings";
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

export interface Settings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  gst: string;
  jurisdictionText: string;
  terms: string;
  darkMode: boolean;
}

export type MemoInput = Omit<
  Memo,
  "id" | "memoNumber" | "isDeleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

// -------------------------- ROW <-> APP TYPE MAPPING -------------------------
// Supabase columns are snake_case; app types are camelCase.

function rowToTruck(r: any): FleetTruck {
  return {
    id: r.id,
    truckNumber: r.truck_number,
    ownerName: r.owner_name ?? "",
    ownerPhone: r.owner_phone ?? "",
    driverName: r.driver_name ?? "",
    driverPhone: r.driver_phone ?? "",
    insuranceExpiry: r.insurance_expiry ?? undefined,
    remarks: r.remarks ?? undefined,
    isDeleted: r.is_deleted ?? false,
    deletedAt: r.deleted_at ?? undefined,
  };
}
function truckToRow(t: Partial<FleetTruck>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.truckNumber !== undefined) row.truck_number = t.truckNumber;
  if (t.ownerName !== undefined) row.owner_name = t.ownerName;
  if (t.ownerPhone !== undefined) row.owner_phone = t.ownerPhone;
  if (t.driverName !== undefined) row.driver_name = t.driverName;
  if (t.driverPhone !== undefined) row.driver_phone = t.driverPhone;
  if (t.insuranceExpiry !== undefined) row.insurance_expiry = t.insuranceExpiry || null;
  if (t.remarks !== undefined) row.remarks = t.remarks;
  if (t.isDeleted !== undefined) row.is_deleted = t.isDeleted;
  if (t.deletedAt !== undefined) row.deleted_at = t.deletedAt;
  return row;
}

function rowToConsignee(r: any): Consignee {
  return {
    id: r.id,
    companyName: r.company_name,
    address: r.address ?? "",
    contactPerson: r.contact_person ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    remarks: r.remarks ?? undefined,
    isDeleted: r.is_deleted ?? false,
    deletedAt: r.deleted_at ?? undefined,
  };
}
function consigneeToRow(c: Partial<Consignee>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.companyName !== undefined) row.company_name = c.companyName;
  if (c.address !== undefined) row.address = c.address;
  if (c.contactPerson !== undefined) row.contact_person = c.contactPerson;
  if (c.phone !== undefined) row.phone = c.phone;
  if (c.city !== undefined) row.city = c.city;
  if (c.state !== undefined) row.state = c.state;
  if (c.remarks !== undefined) row.remarks = c.remarks;
  if (c.isDeleted !== undefined) row.is_deleted = c.isDeleted;
  if (c.deletedAt !== undefined) row.deleted_at = c.deletedAt;
  return row;
}

const MEMO_FIELD_MAP: Record<string, string> = {
  memoNumber: "memo_number",
  dispatchDate: "dispatch_date",
  fromLocation: "from_location",
  toLocation: "to_location",
  transportName: "transport_name",
  consigneeId: "consignee_id",
  truckId: "truck_id",
  truckNumber: "truck_number",
  consigneeName: "consignee_name",
  driverName: "driver_name",
  ownerName: "owner_name",
  ownerPhone: "owner_phone",
  materialName: "material_name",
  weightTons: "weight_tons",
  ratePerTon: "rate_per_ton",
  netFreight: "net_freight",
  unloadingDate: "unloading_date",
  lrReceivedDate: "lr_received_date",
  lrSubmittedDate: "lr_submitted_date",
  description: "description",
  advance: "advance",
  balance: "balance",
  commission: "commission",
  loadingCharges: "loading_charges",
  tds: "tds",
  goodsMamuli: "goods_mamuli",
  totalExpenses: "total_expenses",
  paidBy: "paid_by",
  paymentMethod: "payment_method",
  finalPayable: "final_payable",
  finalPaymentDate: "final_payment_date",
  internalNotes: "internal_notes",
  status: "status",
  remarks: "remarks",
  isDeleted: "is_deleted",
  deletedAt: "deleted_at",
};

function rowToMemo(r: any): Memo {
  return {
    id: r.id,
    memoNumber: r.memo_number,
    dispatchDate: r.dispatch_date,
    fromLocation: r.from_location ?? "",
    toLocation: r.to_location ?? "",
    transportName: r.transport_name ?? "",
    consigneeId: r.consignee_id,
    truckId: r.truck_id,
    truckNumber: r.truck_number ?? "",
    consigneeName: r.consignee_name ?? "",
    driverName: r.driver_name ?? "",
    ownerName: r.owner_name ?? "",
    ownerPhone: r.owner_phone ?? "",
    materialName: r.material_name ?? "",
    weightTons: Number(r.weight_tons ?? 0),
    ratePerTon: Number(r.rate_per_ton ?? 0),
    netFreight: Number(r.net_freight ?? 0),
    unloadingDate: r.unloading_date ?? undefined,
    lrReceivedDate: r.lr_received_date ?? undefined,
    lrSubmittedDate: r.lr_submitted_date ?? undefined,
    description: r.description ?? undefined,
    advance: Number(r.advance ?? 0),
    balance: Number(r.balance ?? 0),
    commission: Number(r.commission ?? 0),
    loadingCharges: Number(r.loading_charges ?? 0),
    tds: Number(r.tds ?? 0),
    goodsMamuli: Number(r.goods_mamuli ?? 0),
    totalExpenses: Number(r.total_expenses ?? 0),
    paidBy: r.paid_by ?? "",
    paymentMethod: r.payment_method ?? "",
    finalPayable: Number(r.final_payable ?? 0),
    finalPaymentDate: r.final_payment_date ?? undefined,
    internalNotes: r.internal_notes ?? undefined,
    status: r.status as MemoStatus,
    remarks: r.remarks ?? undefined,
    isDeleted: r.is_deleted,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function memoToRow(m: Partial<MemoInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const [key, col] of Object.entries(MEMO_FIELD_MAP)) {
    const val = (m as Record<string, unknown>)[key];

    if (val !== undefined) {
      if (
        val === "" &&
        (col.endsWith("_date") ||
          col === "consignee_id" ||
          col === "truck_id")
      ) {
        row[col] = null;
      } else {
        row[col] = val;
      }
    }
  }

  return row;
}

function rowToSettings(r: any): Settings {
  return {
    companyName: r.company_name ?? "",
    address: r.address ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    logoUrl: r.logo_url ?? "",
    gst: r.gst ?? "",
    jurisdictionText: r.jurisdiction_text ?? "",
    terms: r.terms ?? "",
    darkMode: !!r.dark_mode,
  };
}
function settingsToRow(s: Partial<Settings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.companyName !== undefined) row.company_name = s.companyName;
  if (s.address !== undefined) row.address = s.address;
  if (s.phone !== undefined) row.phone = s.phone;
  if (s.email !== undefined) row.email = s.email;
  if (s.website !== undefined) row.website = s.website;
  if (s.logoUrl !== undefined) row.logo_url = s.logoUrl;
  if (s.gst !== undefined) row.gst = s.gst;
  if (s.jurisdictionText !== undefined) row.jurisdiction_text = s.jurisdictionText;
  if (s.terms !== undefined) row.terms = s.terms;
  if (s.darkMode !== undefined) row.dark_mode = s.darkMode;
  return row;
}

function rowToAudit(r: any): AuditLogEntry {
  return {
    id: r.id,
    actor: r.actor,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  };
}
function rowToHistory(r: any): MemoStatusHistory {
  return {
    id: r.id,
    memoId: r.memo_id,
    oldStatus: r.old_status,
    newStatus: r.new_status,
    changedAt: r.changed_at,
  };
}

// -------------------------- REALTIME SUBSCRIBE BUS ---------------------------
// Same subscribe() API as before — components don't need to change.
// Internally now backed by Supabase Realtime instead of a manual local emit.

const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => l());
}

let realtimeInitialized = false;
function initRealtime() {
  if (realtimeInitialized || typeof window === "undefined") return;
  realtimeInitialized = true;
  const tables = [
    "memos",
    "fleet_trucks",
    "consignees",
    "audit_log",
    "memo_status_history",
    "settings",
  ];
  tables.forEach((table) => {
    supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => emit())
      .subscribe();
  });
}
initRealtime();

// -------------------------- SETTINGS ----------------------------------------

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").limit(1).single();
  if (error) throw error;
  return rowToSettings(data);
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const { data: existing, error: selErr } = await supabase
    .from("settings")
    .select("id")
    .limit(1)
    .single();
  if (selErr) throw selErr;
  const { data, error } = await supabase
    .from("settings")
    .update(settingsToRow(patch))
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw error;
  return rowToSettings(data);
}

// -------------------------- TRUCKS ------------------------------------------

export async function getTrucks(): Promise<FleetTruck[]> {
  const { data, error } = await supabase
    .from("fleet_trucks")
    .select("*")
    .eq("is_deleted", false)
    .order("truck_number");
  if (error) throw error;
  return (data ?? []).map(rowToTruck);
}
export async function getTruck(id: string): Promise<FleetTruck | undefined> {
  const { data, error } = await supabase.from("fleet_trucks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToTruck(data) : undefined;
}
export async function createTruck(input: Omit<FleetTruck, "id">): Promise<FleetTruck> {
  const { data, error } = await supabase
    .from("fleet_trucks")
    .insert(truckToRow(input))
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Truck number already exists");
    throw error;
  }
  return rowToTruck(data);
}
export async function updateTruck(id: string, patch: Partial<FleetTruck>): Promise<FleetTruck> {
  const { data, error } = await supabase
    .from("fleet_trucks")
    .update(truckToRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Truck number already exists");
    throw error;
  }
  return rowToTruck(data);
}
export async function deleteTruck(id: string): Promise<void> {
  const { error } = await supabase
    .from("fleet_trucks")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function restoreTruck(id: string): Promise<void> {
  const { error } = await supabase
    .from("fleet_trucks")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}
export async function permanentlyDeleteTruck(id: string): Promise<void> {
  const { error } = await supabase.from("fleet_trucks").delete().eq("id", id);
  if (error) throw error;
}

// -------------------------- CONSIGNEES --------------------------------------

export async function getConsignees(): Promise<Consignee[]> {
  const { data, error } = await supabase
    .from("consignees")
    .select("*")
    .eq("is_deleted", false)
    .order("company_name");
  if (error) throw error;
  return (data ?? []).map(rowToConsignee);
}
export async function getConsignee(id: string): Promise<Consignee | undefined> {
  const { data, error } = await supabase.from("consignees").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToConsignee(data) : undefined;
}
export async function createConsignee(input: Omit<Consignee, "id">): Promise<Consignee> {
  const { data, error } = await supabase
    .from("consignees")
    .insert(consigneeToRow(input))
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Consignee company name already exists");
    throw error;
  }
  return rowToConsignee(data);
}
export async function updateConsignee(id: string, patch: Partial<Consignee>): Promise<Consignee> {
  const { data, error } = await supabase
    .from("consignees")
    .update(consigneeToRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Consignee company name already exists");
    throw error;
  }
  return rowToConsignee(data);
}
export async function deleteConsignee(id: string): Promise<void> {
  const { error } = await supabase
    .from("consignees")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function restoreConsignee(id: string): Promise<void> {
  const { error } = await supabase
    .from("consignees")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}
export async function permanentlyDeleteConsignee(id: string): Promise<void> {
  const { error } = await supabase.from("consignees").delete().eq("id", id);
  if (error) throw error;
}

// -------------------------- UNIFIED TRASH (memos + trucks + consignees) -----

export interface TrashItem {
  kind: "Memo" | "Truck" | "Consignee";
  id: string;
  label: string;       // display text — memo number / truck number / company name
  deletedAt?: string;
}

export async function getAllTrashItems(): Promise<TrashItem[]> {
  const [memos, trucks, consignees] = await Promise.all([
    getTrashedMemos(),
    supabase.from("fleet_trucks").select("*").eq("is_deleted", true),
    supabase.from("consignees").select("*").eq("is_deleted", true),
  ]);
  const truckItems: TrashItem[] = (trucks.data ?? []).map((r: any) => ({
    kind: "Truck",
    id: r.id,
    label: r.truck_number,
    deletedAt: r.deleted_at,
  }));
  const consigneeItems: TrashItem[] = (consignees.data ?? []).map((r: any) => ({
    kind: "Consignee",
    id: r.id,
    label: r.company_name,
    deletedAt: r.deleted_at,
  }));
  const memoItems: TrashItem[] = memos.map((m) => ({
    kind: "Memo",
    id: m.id,
    label: m.memoNumber,
    deletedAt: m.deletedAt,
  }));
  return [...memoItems, ...truckItems, ...consigneeItems].sort((a, b) =>
    (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
  );
}

export async function restoreTrashItem(item: TrashItem): Promise<void> {
  if (item.kind === "Memo") return restoreMemo(item.id);
  if (item.kind === "Truck") return restoreTruck(item.id);
  if (item.kind === "Consignee") return restoreConsignee(item.id);
}

export async function permanentlyDeleteTrashItem(item: TrashItem): Promise<void> {
  if (item.kind === "Memo") return permanentlyDeleteMemo(item.id);
  if (item.kind === "Truck") return permanentlyDeleteTruck(item.id);
  if (item.kind === "Consignee") return permanentlyDeleteConsignee(item.id);
}

// -------------------------- MEMOS -------------------------------------------

export async function getMemos(opts?: { includeDeleted?: boolean }): Promise<Memo[]> {
  let q = supabase.from("memos").select("*").order("dispatch_date", { ascending: false });
  if (!opts?.includeDeleted) q = q.eq("is_deleted", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToMemo);
}
export async function getTrashedMemos(): Promise<Memo[]> {
  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .eq("is_deleted", true)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToMemo);
}
export async function getMemo(id: string): Promise<Memo | undefined> {
  const { data, error } = await supabase.from("memos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToMemo(data) : undefined;
}
export async function peekNextMemoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from("memo_counters")
    .select("counter")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  const next = (data?.counter ?? 0) + 1;
  return `SRL-${year}-${String(next).padStart(6, "0")}`;
}

export async function createMemo(input: MemoInput): Promise<Memo> {
  const { data: memoNumber, error: numErr } = await supabase.rpc("next_memo_number");
  if (numErr) throw numErr;
  const row = { ...memoToRow(input), memo_number: memoNumber, is_deleted: false };
  const { data, error } = await supabase.from("memos").insert(row).select().single();
  if (error) throw error;
  return rowToMemo(data);
}
export async function updateMemo(id: string, patch: Partial<MemoInput>): Promise<Memo> {
  const { data, error } = await supabase
    .from("memos")
    .update(memoToRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToMemo(data);
}
export async function deleteMemo(id: string): Promise<void> {
  const { error } = await supabase
    .from("memos")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function restoreMemo(id: string): Promise<void> {
  const { error } = await supabase
    .from("memos")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}
export async function permanentlyDeleteMemo(id: string): Promise<void> {
  const { error } = await supabase.from("memos").delete().eq("id", id);
  if (error) throw error;
}

// -------------------------- LOGS --------------------------------------------
// Written automatically by database triggers — these functions only read.

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(rowToAudit);
}
export async function getMemoHistory(memoId: string): Promise<MemoStatusHistory[]> {
  const { data, error } = await supabase
    .from("memo_status_history")
    .select("*")
    .eq("memo_id", memoId)
    .order("changed_at");
  if (error) throw error;
  return (data ?? []).map(rowToHistory);
}

// -------------------------- DEV UTIL ----------------------------------------
// ⚠️ Destructive — clears all real data. Use with care, not wired to any UI button.

export async function _resetStore(): Promise<void> {
  console.warn("_resetStore: clearing all data from Supabase — this cannot be undone.");
  await supabase.from("memo_status_history").delete().not("id", "is", null);
  await supabase.from("audit_log").delete().not("id", "is", null);
  await supabase.from("memos").delete().not("id", "is", null);
  await supabase.from("consignees").delete().not("id", "is", null);
  await supabase.from("fleet_trucks").delete().not("id", "is", null);
  await supabase.from("memo_counters").delete().not("year", "is", null);
}

// -------------------------- BACKUP / RESTORE --------------------------------

export async function exportAllData(): Promise<string> {
  const [trucks, consignees, memos, settings, auditData, historyData] = await Promise.all([
    getTrucks(),
    getConsignees(),
    getMemos({ includeDeleted: true }),
    getSettings(),
    supabase.from("audit_log").select("*"),
    supabase.from("memo_status_history").select("*"),
  ]);
  const audit = (auditData.data ?? []).map(rowToAudit);
  const history = (historyData.data ?? []).map(rowToHistory);
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      trucks,
      consignees,
      memos,
      history,
      audit,
      settings,
    },
    null,
    2,
  );
}

export async function importAllData(
  json: string,
): Promise<{ trucks: number; consignees: number; memos: number }> {
  const parsed = JSON.parse(json);
  let tCount = 0,
    cCount = 0,
    mCount = 0;

  for (const t of parsed.trucks ?? []) {
    const { id, ...rest } = t;
    const { error } = await supabase.from("fleet_trucks").upsert({ id, ...truckToRow(rest) });
    if (!error) tCount++;
  }
  for (const c of parsed.consignees ?? []) {
    const { id, ...rest } = c;
    const { error } = await supabase.from("consignees").upsert({ id, ...consigneeToRow(rest) });
    if (!error) cCount++;
  }
  for (const m of parsed.memos ?? []) {
    const { id, memoNumber, ...rest } = m;
    const { error } = await supabase
      .from("memos")
      .upsert({ id, memo_number: memoNumber, ...memoToRow(rest) });
    if (!error) mCount++;
  }
  return { trucks: tCount, consignees: cCount, memos: mCount };
}