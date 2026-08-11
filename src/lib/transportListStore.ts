/**
 * ============================================================================
 *  TRANSPORT LIST STORE — Sahil Road Lines ERP
 * ----------------------------------------------------------------------------
 *  Completely independent from dataStore.ts / the memos table.
 *  Backed only by the `transport_list` Supabase table.
 * ============================================================================
 */

import { supabase } from "./supabaseClient";

export type TransportStatus =
  | "Dispatched"
  | "Delivered"
  | "Payment Pending"
  | "LR Received"
  | "LR Submitted"
  | "Completed";

export const ALL_TRANSPORT_STATUSES: TransportStatus[] = [
  "Dispatched",
  "Delivered",
  "Payment Pending",
  "LR Received",
  "LR Submitted",
  "Completed",
];

export interface TransportEntry {
  id: string;
  entryNumber: string;
  dispatchDate: string;
  fromLocation: string;
  toLocation: string;
  transportName: string;
  truckNumber: string;
  driverName: string;
  ownerName: string;
  ownerPhone: string;
  consigneeName: string;
  materialName: string;
  weightTons: number;
  ratePerTon: number;
  netFreight: number;
  advance: number;
  balance: number;
  unloadingDate?: string;
  haltingDate?: string;
  haltingCharge: number;
  lrReceivedDate?: string;
  lrSubmittedDate?: string;
  description?: string;
  commission: number;
  loadingCharges: number;
  tds: number;
  goodsMamuli: number;
  totalExpenses: number;
  paidBy: string;
  paymentMethod: string;
  finalPayable: number;
  finalPaymentDate?: string;
  status: TransportStatus;
  remarks?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransportEntryInput = Omit<
  TransportEntry,
  "id" | "entryNumber" | "isDeleted" | "deletedAt" | "createdAt" | "updatedAt"
>;

const FIELD_MAP: Record<string, string> = {
  dispatchDate: "dispatch_date",
  fromLocation: "from_location",
  toLocation: "to_location",
  transportName: "transport_name",
  truckNumber: "truck_number",
  driverName: "driver_name",
  ownerName: "owner_name",
  ownerPhone: "owner_phone",
  consigneeName: "consignee_name",
  materialName: "material_name",
  weightTons: "weight_tons",
  ratePerTon: "rate_per_ton",
  netFreight: "net_freight",
  advance: "advance",
  balance: "balance",
  unloadingDate: "unloading_date",
  haltingDate: "halting_date",
  haltingCharge: "halting_charge",
  lrReceivedDate: "lr_received_date",
  lrSubmittedDate: "lr_submitted_date",
  description: "description",
  commission: "commission",
  loadingCharges: "loading_charges",
  tds: "tds",
  goodsMamuli: "goods_mamuli",
  totalExpenses: "total_expenses",
  paidBy: "paid_by",
  paymentMethod: "payment_method",
  finalPayable: "final_payable",
  finalPaymentDate: "final_payment_date",
  status: "status",
  remarks: "remarks",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToEntry(r: any): TransportEntry {
  return {
    id: r.id,
    entryNumber: r.entry_number,
    dispatchDate: r.dispatch_date,
    fromLocation: r.from_location ?? "",
    toLocation: r.to_location ?? "",
    transportName: r.transport_name ?? "",
    truckNumber: r.truck_number ?? "",
    driverName: r.driver_name ?? "",
    ownerName: r.owner_name ?? "",
    ownerPhone: r.owner_phone ?? "",
    consigneeName: r.consignee_name ?? "",
    materialName: r.material_name ?? "",
    weightTons: Number(r.weight_tons ?? 0),
    ratePerTon: Number(r.rate_per_ton ?? 0),
    netFreight: Number(r.net_freight ?? 0),
    advance: Number(r.advance ?? 0),
    balance: Number(r.balance ?? 0),
    unloadingDate: r.unloading_date ?? undefined,
    haltingDate: r.halting_date ?? undefined,
    haltingCharge: Number(r.halting_charge ?? 0),
    lrReceivedDate: r.lr_received_date ?? undefined,
    lrSubmittedDate: r.lr_submitted_date ?? undefined,
    description: r.description ?? undefined,
    commission: Number(r.commission ?? 0),
    loadingCharges: Number(r.loading_charges ?? 0),
    tds: Number(r.tds ?? 0),
    goodsMamuli: Number(r.goods_mamuli ?? 0),
    totalExpenses: Number(r.total_expenses ?? 0),
    paidBy: r.paid_by ?? "",
    paymentMethod: r.payment_method ?? "",
    finalPayable: Number(r.final_payable ?? 0),
    finalPaymentDate: r.final_payment_date ?? undefined,
    status: (r.status ?? "Dispatched") as TransportStatus,
    remarks: r.remarks ?? undefined,
    isDeleted: !!r.is_deleted,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function entryToRow(e: Partial<TransportEntryInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    const val = (e as Record<string, unknown>)[key];
    if (val !== undefined) {
      row[col] = val === "" && col.endsWith("_date") ? null : val;
    }
  }
  return row;
}

// -------------------------- REALTIME BUS -------------------------------------

const listeners = new Set<() => void>();
export function subscribeTransport(fn: () => void) {
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
  supabase
    .channel("realtime-transport_list")
    .on("postgres_changes", { event: "*", schema: "public", table: "transport_list" }, () => emit())
    .subscribe();
}
initRealtime();

// -------------------------- QUERIES ------------------------------------------

export async function getTransportEntries(opts?: { includeDeleted?: boolean }): Promise<TransportEntry[]> {
  let q = supabase
    .from("transport_list")
    .select("*")
    .order("dispatch_date", { ascending: false, nullsFirst: false });
  // Rows inserted outside the app may have is_deleted = NULL; `.eq(false)` would
  // silently hide them, so treat NULL as "not deleted".
  if (!opts?.includeDeleted) q = q.or("is_deleted.is.null,is_deleted.eq.false");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export async function getTransportEntry(id: string): Promise<TransportEntry | undefined> {
  const { data, error } = await supabase.from("transport_list").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToEntry(data) : undefined;
}

export async function peekNextTransportEntryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from("transport_list")
    .select("id", { count: "exact", head: true })
    .like("entry_number", `TRP-${year}-%`);
  if (error) return `TRP-${year}-000001`;
  return `TRP-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function createTransportEntry(input: TransportEntryInput): Promise<TransportEntry> {
  const { data: entryNumber, error: numErr } = await supabase.rpc("next_transport_entry_number");
  if (numErr) throw numErr;
  const row = { ...entryToRow(input), entry_number: entryNumber, is_deleted: false };
  const { data, error } = await supabase.from("transport_list").insert(row).select().single();
  if (error) throw error;
  emit();
  return rowToEntry(data);
}

export async function updateTransportEntry(
  id: string,
  patch: Partial<TransportEntryInput>,
): Promise<TransportEntry> {
  const { data, error } = await supabase
    .from("transport_list")
    .update(entryToRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  emit();
  return rowToEntry(data);
}

export async function deleteTransportEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("transport_list")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  emit();
}

export async function restoreTransportEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("transport_list")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", id);
  if (error) throw error;
  emit();
}
