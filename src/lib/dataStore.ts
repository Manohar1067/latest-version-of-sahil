/**
 * ============================================================================
 *  DATA STORE — Sahil Road Lines ERP
 * ----------------------------------------------------------------------------
 *  This module is the ONLY place that touches persistence.
 *  All UI reads/writes go through the async functions exported below.
 *
 *  Current implementation: in-memory state + localStorage (survives refresh).
 *
 *  ⚠️ To swap to Supabase later:
 *    - Replace the body of each exported function (getMemos, createMemo, ...)
 *      with a Supabase query.
 *    - Keep the same function signatures and Types.
 *    - Remove `persist()` calls; Supabase becomes source of truth.
 *    - Replace the `subscribe/emit` bus with Supabase realtime channels
 *      (or leave it for optimistic UI).
 * ============================================================================
 */

// -----------------------------  TYPES  --------------------------------------

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
  dispatchDate: string; // ISO
  fromLocation: string;
  toLocation: string;
  transportName: string;
  consigneeId: string;
  truckId: string;
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
  paidBy: string; // "SRL" | "KAREEM" | custom
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

interface DBShape {
  trucks: FleetTruck[];
  consignees: Consignee[];
  memos: Memo[];
  history: MemoStatusHistory[];
  audit: AuditLogEntry[];
  settings: Settings;
  memoCounters: Record<string, number>; // year -> counter
}

// ---------------------------- CONSTANTS -------------------------------------

const STORAGE_KEY = "srl_erp_v1";
const ACTOR = "Admin";

const DEFAULT_SETTINGS: Settings = {
  companyName: "SAHIL ROAD LINES",
  address:
    "D.No. 12-3-45, Old Gajuwaka, Visakhapatnam - 530026, Andhra Pradesh",
  phone: "+91 98765 43210",
  email: "office@sahilroadlines.in",
  website: "www.sahilroadlines.in",
  logoUrl: "",
  gst: "37ABCDE1234F1Z5",
  jurisdictionText: "Subject to Visakhapatnam Jurisdiction",
  terms:
    "1. Goods once dispatched are at owner's risk.\n2. Company is not responsible for leakage, breakage or shortage.\n3. All disputes subject to Visakhapatnam jurisdiction only.\n4. Freight to be paid within 15 days of delivery.\n5. Detention charges applicable after 24 hours of unloading.",
  darkMode: false,
};

// ------------------------------- DB -----------------------------------------

let db: DBShape = emptyDb();

function emptyDb(): DBShape {
  return {
    trucks: [],
    consignees: [],
    memos: [],
    history: [],
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
    memoCounters: {},
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

function load() {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = { ...emptyDb(), ...(JSON.parse(raw) as DBShape) };
      db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
      // Migration: retire legacy statuses
      db.memos.forEach((m) => {
        const s = m.status as string;
        if (s === "Running") m.status = "Dispatched";
        else if (s === "Cancelled") m.status = "Payment Pending";
      });
      return;
    }
  } catch {
    /* corrupt store — reseed */
  }
  db = emptyDb();
  seed();
  persist();
}

function persist() {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  emit();
}

// -------------------------- SUBSCRIBE BUS -----------------------------------

const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => l());
}

// -------------------------- HELPERS -----------------------------------------

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const nowIso = () => new Date().toISOString();

function audit(
  action: string,
  entityType: AuditLogEntry["entityType"],
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  db.audit.unshift({
    id: uid(),
    actor: ACTOR,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    createdAt: nowIso(),
  });
}

function nextMemoNumber(): string {
  const year = new Date().getFullYear();
  const c = (db.memoCounters[year] ?? 0) + 1;
  db.memoCounters[year] = c;
  return `SRL-${year}-${String(c).padStart(6, "0")}`;
}

// -------------------------- SEED --------------------------------------------

function seed() {
  const trucks: FleetTruck[] = [
    {
      id: uid(),
      truckNumber: "AP 31 AB 1234",
      ownerName: "Sahil Khan",
      ownerPhone: "+91 90000 11111",
      driverName: "Ramesh Kumar",
      driverPhone: "+91 90000 22222",
      insuranceExpiry: "2026-11-20",
    },
    {
      id: uid(),
      truckNumber: "AP 31 CD 5678",
      ownerName: "Kareem Bhai",
      ownerPhone: "+91 90000 33333",
      driverName: "Suresh Reddy",
      driverPhone: "+91 90000 44444",
      insuranceExpiry: "2026-08-01",
    },
    {
      id: uid(),
      truckNumber: "TS 09 EF 9012",
      ownerName: "Sahil Khan",
      ownerPhone: "+91 90000 11111",
      driverName: "Mohan Rao",
      driverPhone: "+91 90000 55555",
      insuranceExpiry: "2026-09-30",
    },
    {
      id: uid(),
      truckNumber: "AP 05 GH 3456",
      ownerName: "Ravi Naidu",
      ownerPhone: "+91 90000 66666",
      driverName: "Anwar Ali",
      driverPhone: "+91 90000 77777",
      insuranceExpiry: "2026-10-10",
    },
  ];
  db.trucks = trucks;

  const consignees: Consignee[] = [
    {
      id: uid(),
      companyName: "Vizag Steel Traders",
      address: "Plot 24, Auto Nagar",
      contactPerson: "Mr. Raju",
      phone: "+91 90111 22222",
      city: "Visakhapatnam",
      state: "Andhra Pradesh",
    },
    {
      id: uid(),
      companyName: "Hyderabad Cement Depot",
      address: "Beside Ring Road, Kukatpally",
      contactPerson: "Mr. Naveen",
      phone: "+91 90222 33333",
      city: "Hyderabad",
      state: "Telangana",
    },
    {
      id: uid(),
      companyName: "Chennai Iron Works",
      address: "Ambattur Industrial Estate",
      contactPerson: "Mr. Selvam",
      phone: "+91 90333 44444",
      city: "Chennai",
      state: "Tamil Nadu",
    },
    {
      id: uid(),
      companyName: "Bengaluru Logistics Hub",
      address: "Peenya Phase 2",
      contactPerson: "Mr. Kumar",
      phone: "+91 90444 55555",
      city: "Bengaluru",
      state: "Karnataka",
    },
    {
      id: uid(),
      companyName: "Kolkata Fertilizers Ltd",
      address: "Salt Lake Sector V",
      contactPerson: "Mr. Bose",
      phone: "+91 90555 66666",
      city: "Kolkata",
      state: "West Bengal",
    },
  ];
  db.consignees = consignees;

  // Memos across the last 2 months
  const today = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  const materials = ["Cement", "Steel Rods", "Iron Scrap", "Rice Bags", "Fertilizer", "Coal", "Bricks"];
  const cities: Array<[string, string]> = [
    ["Visakhapatnam", "Hyderabad"],
    ["Visakhapatnam", "Chennai"],
    ["Visakhapatnam", "Bengaluru"],
    ["Visakhapatnam", "Kolkata"],
    ["Hyderabad", "Chennai"],
  ];
  const statuses: MemoStatus[] = [
    "Completed",
    "Dispatched",
    "Payment Pending",
    "Delivered",
    "LR Received",
    "LR Submitted",
    "Dispatched",
    "Completed",
    "Payment Pending",
    "Delivered",
  ];
  const dayOffsets = [0, 2, 5, 9, 14, 20, 27, 35, 45, 55];

  for (let i = 0; i < 10; i++) {
    const truck = trucks[i % trucks.length];
    const consignee = consignees[i % consignees.length];
    const [from, to] = cities[i % cities.length];
    const material = materials[i % materials.length];
    const weight = 10 + (i % 6) * 2.5;
    const rate = 800 + (i % 5) * 150;
    const netFreight = Math.round(weight * rate);
    const advance = Math.round(netFreight * 0.4);
    const commission = 1500 + i * 200;
    const loading = 800 + i * 100;
    const tds = Math.round(netFreight * 0.01);
    const mamuli = 300;
    const totalExpenses = commission + loading + tds + mamuli;
    const status = statuses[i];
    const dispatch = daysAgo(dayOffsets[i]);
    const memoNumber = nextMemoNumber();
    const memo: Memo = {
      id: uid(),
      memoNumber,
      dispatchDate: dispatch,
      fromLocation: from,
      toLocation: to,
      transportName: i % 2 === 0 ? "SRL Direct" : "Kareem Transports",
      consigneeId: consignee.id,
      truckId: truck.id,
      driverName: truck.driverName,
      ownerName: truck.ownerName,
      ownerPhone: truck.ownerPhone,
      materialName: material,
      weightTons: weight,
      ratePerTon: rate,
      netFreight,
      unloadingDate:
        status !== "Dispatched"
          ? daysAgo(Math.max(0, dayOffsets[i] - 2))
          : undefined,
      lrReceivedDate:
        status === "LR Received" ||
        status === "LR Submitted" ||
        status === "Completed"
          ? daysAgo(Math.max(0, dayOffsets[i] - 3))
          : undefined,
      lrSubmittedDate:
        status === "LR Submitted" || status === "Completed"
          ? daysAgo(Math.max(0, dayOffsets[i] - 4))
          : undefined,
      description: `${material} shipment from ${from} to ${to}`,
      advance,
      balance: netFreight - advance,
      commission,
      loadingCharges: loading,
      tds,
      goodsMamuli: mamuli,
      totalExpenses,
      paidBy: i % 3 === 0 ? "KAREEM" : "SRL",
      paymentMethod: i % 2 === 0 ? "Bank Transfer" : "PhonePe",
      finalPayable: netFreight - advance - totalExpenses,
      finalPaymentDate: status === "Completed" ? daysAgo(Math.max(0, dayOffsets[i] - 5)) : undefined,
      internalNotes: "",
      status,
      remarks: "",
      isDeleted: false,
      createdAt: dispatch,
      updatedAt: dispatch,
    };
    db.memos.push(memo);
    db.history.push({
      id: uid(),
      memoId: memo.id,
      oldStatus: null,
      newStatus: status,
      changedAt: dispatch,
    });
    audit("Created memo (seed)", "Memo", memo.id, null, memo);
  }
}

// -------------------------- INIT --------------------------------------------

load();

// -------------------------- SETTINGS ----------------------------------------

export async function getSettings(): Promise<Settings> {
  return { ...db.settings };
}
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const old = { ...db.settings };
  db.settings = { ...db.settings, ...patch };
  audit("Updated settings", "Settings", "settings", old, db.settings);
  persist();
  return { ...db.settings };
}

// -------------------------- TRUCKS ------------------------------------------

export async function getTrucks(): Promise<FleetTruck[]> {
  return [...db.trucks];
}
export async function getTruck(id: string): Promise<FleetTruck | undefined> {
  return db.trucks.find((t) => t.id === id);
}
export async function createTruck(
  input: Omit<FleetTruck, "id">,
): Promise<FleetTruck> {
  if (
    db.trucks.some(
      (t) =>
        t.truckNumber.trim().toLowerCase() ===
        input.truckNumber.trim().toLowerCase(),
    )
  ) {
    throw new Error("Truck number already exists");
  }
  const t: FleetTruck = { ...input, id: uid() };
  db.trucks.push(t);
  audit("Created truck", "Truck", t.id, null, t);
  persist();
  return t;
}
export async function updateTruck(
  id: string,
  patch: Partial<FleetTruck>,
): Promise<FleetTruck> {
  const idx = db.trucks.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error("Truck not found");
  if (
    patch.truckNumber &&
    db.trucks.some(
      (t) =>
        t.id !== id &&
        t.truckNumber.trim().toLowerCase() ===
          patch.truckNumber!.trim().toLowerCase(),
    )
  ) {
    throw new Error("Truck number already exists");
  }
  const old = db.trucks[idx];
  db.trucks[idx] = { ...old, ...patch };
  audit("Updated truck", "Truck", id, old, db.trucks[idx]);
  persist();
  return db.trucks[idx];
}
export async function deleteTruck(id: string): Promise<void> {
  const old = db.trucks.find((t) => t.id === id);
  db.trucks = db.trucks.filter((t) => t.id !== id);
  audit("Deleted truck", "Truck", id, old, null);
  persist();
}

// -------------------------- CONSIGNEES --------------------------------------

export async function getConsignees(): Promise<Consignee[]> {
  return [...db.consignees];
}
export async function getConsignee(id: string): Promise<Consignee | undefined> {
  return db.consignees.find((c) => c.id === id);
}
export async function createConsignee(
  input: Omit<Consignee, "id">,
): Promise<Consignee> {
  if (
    db.consignees.some(
      (c) =>
        c.companyName.trim().toLowerCase() ===
        input.companyName.trim().toLowerCase(),
    )
  ) {
    throw new Error("Consignee company name already exists");
  }
  const c: Consignee = { ...input, id: uid() };
  db.consignees.push(c);
  audit("Created consignee", "Consignee", c.id, null, c);
  persist();
  return c;
}
export async function updateConsignee(
  id: string,
  patch: Partial<Consignee>,
): Promise<Consignee> {
  const idx = db.consignees.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Consignee not found");
  if (
    patch.companyName &&
    db.consignees.some(
      (c) =>
        c.id !== id &&
        c.companyName.trim().toLowerCase() ===
          patch.companyName!.trim().toLowerCase(),
    )
  ) {
    throw new Error("Consignee company name already exists");
  }
  const old = db.consignees[idx];
  db.consignees[idx] = { ...old, ...patch };
  audit("Updated consignee", "Consignee", id, old, db.consignees[idx]);
  persist();
  return db.consignees[idx];
}
export async function deleteConsignee(id: string): Promise<void> {
  const old = db.consignees.find((c) => c.id === id);
  db.consignees = db.consignees.filter((c) => c.id !== id);
  audit("Deleted consignee", "Consignee", id, old, null);
  persist();
}

// -------------------------- MEMOS -------------------------------------------

export async function getMemos(opts?: { includeDeleted?: boolean }): Promise<Memo[]> {
  return db.memos.filter((m) => opts?.includeDeleted || !m.isDeleted);
}
export async function getTrashedMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => m.isDeleted);
}
export async function getMemo(id: string): Promise<Memo | undefined> {
  return db.memos.find((m) => m.id === id);
}
export async function peekNextMemoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const c = (db.memoCounters[year] ?? 0) + 1;
  return `SRL-${year}-${String(c).padStart(6, "0")}`;
}

export type MemoInput = Omit<
  Memo,
  "id" | "memoNumber" | "isDeleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export async function createMemo(input: MemoInput): Promise<Memo> {
  const memoNumber = nextMemoNumber();
  const m: Memo = {
    ...input,
    id: uid(),
    memoNumber,
    isDeleted: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.memos.unshift(m);
  db.history.push({
    id: uid(),
    memoId: m.id,
    oldStatus: null,
    newStatus: m.status,
    changedAt: nowIso(),
  });
  audit("Created memo", "Memo", m.id, null, m);
  persist();
  return m;
}
export async function updateMemo(
  id: string,
  patch: Partial<MemoInput>,
): Promise<Memo> {
  const idx = db.memos.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error("Memo not found");
  const old = db.memos[idx];
  const updated: Memo = { ...old, ...patch, updatedAt: nowIso() };
  db.memos[idx] = updated;
  if (patch.status && patch.status !== old.status) {
    db.history.push({
      id: uid(),
      memoId: id,
      oldStatus: old.status,
      newStatus: patch.status,
      changedAt: nowIso(),
    });
    audit(`Status: ${old.status} → ${patch.status}`, "Memo", id, old.status, patch.status);
  }
  audit("Updated memo", "Memo", id, old, updated);
  persist();
  return updated;
}
export async function deleteMemo(id: string): Promise<void> {
  const idx = db.memos.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const old = db.memos[idx];
  db.memos[idx] = { ...old, isDeleted: true, deletedAt: nowIso() };
  audit("Moved to trash", "Memo", id, old, db.memos[idx]);
  persist();
}
export async function restoreMemo(id: string): Promise<void> {
  const idx = db.memos.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const old = db.memos[idx];
  db.memos[idx] = { ...old, isDeleted: false, deletedAt: undefined };
  audit("Restored from trash", "Memo", id, old, db.memos[idx]);
  persist();
}
export async function permanentlyDeleteMemo(id: string): Promise<void> {
  const old = db.memos.find((m) => m.id === id);
  db.memos = db.memos.filter((m) => m.id !== id);
  audit("Permanently deleted", "Memo", id, old, null);
  persist();
}

// -------------------------- LOGS --------------------------------------------

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  return [...db.audit];
}
export async function getMemoHistory(memoId: string): Promise<MemoStatusHistory[]> {
  return db.history.filter((h) => h.memoId === memoId);
}

// -------------------------- DEV UTIL ----------------------------------------

export function _resetStore() {
  if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
  db = emptyDb();
  seed();
  persist();
}

// -------------------------- BACKUP / RESTORE --------------------------------

export async function exportAllData(): Promise<string> {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: nowIso(),
      trucks: db.trucks,
      consignees: db.consignees,
      memos: db.memos,
      history: db.history,
      audit: db.audit,
      settings: db.settings,
      memoCounters: db.memoCounters,
    },
    null,
    2,
  );
}

export async function importAllData(json: string): Promise<{
  trucks: number; consignees: number; memos: number;
}> {
  const parsed = JSON.parse(json) as Partial<DBShape>;
  const next: DBShape = {
    trucks: parsed.trucks ?? [],
    consignees: parsed.consignees ?? [],
    memos: parsed.memos ?? [],
    history: parsed.history ?? [],
    audit: parsed.audit ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    memoCounters: parsed.memoCounters ?? {},
  };
  db = next;
  // Migration for imported data
  db.memos.forEach((m) => {
    const s = m.status as string;
    if (s === "Running") m.status = "Dispatched";
    else if (s === "Cancelled") m.status = "Payment Pending";
  });
  audit("Imported data", "Settings", "backup", null, {
    trucks: db.trucks.length, consignees: db.consignees.length, memos: db.memos.length,
  });
  persist();
  return { trucks: db.trucks.length, consignees: db.consignees.length, memos: db.memos.length };
}
