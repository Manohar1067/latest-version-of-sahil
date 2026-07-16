import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import {
  getMemos, getTrucks, getConsignees, deleteMemo, updateMemo,
  ALL_MEMO_STATUSES, type Memo, type FleetTruck, type Consignee, type MemoStatus,
} from "@/lib/dataStore";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Pencil, Printer, Trash2, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColumnFilter } from "@/components/ColumnFilter";
import { exportRows } from "@/lib/exportData";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Search = { f?: string };
export const Route = createFileRoute("/register")({
  component: RegisterPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

type ColKey = "truck" | "transport" | "destination" | "status";

function RegisterPage() {
  const { f } = Route.useSearch();
  const nav = useNavigate();
  const { data: memos } = useStoreData<Memo[]>(() => getMemos(), []);
  const { data: trucks } = useStoreData<FleetTruck[]>(() => getTrucks(), []);
  const { data: consignees } = useStoreData<Consignee[]>(() => getConsignees(), []);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [truckId, setTruckId] = useState<string>("all");
  const [consigneeId, setConsigneeId] = useState<string>("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<string>(f ?? "month");
  const [confirmDel, setConfirmDel] = useState<Memo | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [colFilters, setColFilters] = useState<Record<ColKey, Set<string> | null>>({
    truck: null, transport: null, destination: null, status: null,
  });

  const truckById = (id: string) => trucks?.find((t) => t.id === id);
  const consigneeById = (id: string) => consignees?.find((c) => c.id === id);

  const rowsPre = useMemo(() => {
    let rows = memos ?? [];
    const now = new Date();
    if (scope === "today") rows = rows.filter((x) => new Date(x.dispatchDate).toDateString() === now.toDateString());
    else if (scope === "month") rows = rows.filter((x) => new Date(x.dispatchDate) >= startOfMonth(now));
    else if (scope === "running") rows = rows.filter((x) => x.status === "Running" || x.status === "Dispatched");
    else if (scope === "completed") rows = rows.filter((x) => x.status === "Completed");
    else if (scope === "pending") rows = rows.filter((x) => x.status === "Dispatched" || x.status === "Running");
    else if (scope === "payment_pending") rows = rows.filter((x) => x.status === "Payment Pending");
    else if (scope === "collection_due") rows = rows.filter((x) => x.status !== "Completed" && x.status !== "Cancelled" && x.balance > 0);

    if (status !== "all") rows = rows.filter((r) => r.status === status);
    if (truckId !== "all") rows = rows.filter((r) => r.truckId === truckId);
    if (consigneeId !== "all") rows = rows.filter((r) => r.consigneeId === consigneeId);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => {
        const tr = truckById(r.truckId);
        const co = consigneeById(r.consigneeId);
        return [r.memoNumber, tr?.truckNumber, r.driverName, r.transportName, co?.companyName, r.toLocation, r.materialName, r.status, r.remarks]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      });
    }
    return rows;
  }, [memos, trucks, consignees, query, status, truckId, consigneeId, scope]);

  const filtered = useMemo(() => {
    let rows = rowsPre;
    if (colFilters.truck) rows = rows.filter((r) => colFilters.truck!.has(truckById(r.truckId)?.truckNumber || "—"));
    if (colFilters.transport) rows = rows.filter((r) => colFilters.transport!.has(r.transportName || "—"));
    if (colFilters.destination) rows = rows.filter((r) => colFilters.destination!.has(r.toLocation || "—"));
    if (colFilters.status) rows = rows.filter((r) => colFilters.status!.has(r.status));
    return rows.sort((a, b) => +new Date(b.dispatchDate) - +new Date(a.dispatchDate));
  }, [rowsPre, colFilters, trucks]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const resetFilters = () => {
    setQuery(""); setStatus("all"); setTruckId("all"); setConsigneeId("all"); setScope("all"); setPage(1);
    setColFilters({ truck: null, transport: null, destination: null, status: null });
  };

  const toggleAll = () => {
    if (selected.size === pageRows.length) setSelected(new Set());
    else setSelected(new Set(pageRows.map((r) => r.id)));
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) await deleteMemo(id);
    toast.success(`${ids.length} memo(s) moved to trash`);
    setSelected(new Set());
    setConfirmBulk(false);
  };

  const bulkStatus = async (s: MemoStatus) => {
    const ids = Array.from(selected);
    for (const id of ids) await updateMemo(id, { status: s });
    toast.success(`Updated ${ids.length} memo(s) to ${s}`);
    setSelected(new Set());
  };

  const toExportRows = (rows: Memo[]) => rows.map((r) => {
    const tr = truckById(r.truckId);
    const co = consigneeById(r.consigneeId);
    return {
      "Memo #": r.memoNumber,
      "Dispatch": formatDate(r.dispatchDate),
      "Truck": tr?.truckNumber ?? "",
      "Transport": r.transportName,
      "Destination": r.toLocation,
      "Consignee": co?.companyName ?? "",
      "Driver": r.driverName,
      "Material": r.materialName,
      "Rate/Ton": r.ratePerTon,
      "Weight": r.weightTons,
      "Net Freight": r.netFreight,
      "Advance": r.advance,
      "Balance": r.balance,
      "Unloading": formatDate(r.unloadingDate),
      "LR Received": formatDate(r.lrReceivedDate),
      "LR Submitted": formatDate(r.lrSubmittedDate),
      "Final Payable": r.finalPayable,
      "Final Payment Date": formatDate(r.finalPaymentDate),
      "Status": r.status,
      "Remarks": r.remarks ?? "",
    };
  });

  const doExport = (fmt: "xlsx" | "csv", onlySelected: boolean) => {
    const rows = onlySelected ? filtered.filter((r) => selected.has(r.id)) : filtered;
    if (rows.length === 0) { toast.error("No rows to export"); return; }
    exportRows(toExportRows(rows), `register-${new Date().toISOString().slice(0, 10)}`, fmt);
    toast.success(`Exported ${rows.length} row(s)`);
  };

  return (
    <AppShell
      title="Register List"
      breadcrumb="Home / Register List"
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="mr-1 h-4 w-4" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doExport("xlsx", false)}>Excel (.xlsx) — all filtered</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("csv", false)}>CSV — all filtered</DropdownMenuItem>
              {selected.size > 0 && (
                <>
                  <DropdownMenuItem onClick={() => doExport("xlsx", true)}>Excel — {selected.size} selected</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport("csv", true)}>CSV — {selected.size} selected</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => nav({ to: "/new-memo" })}>+ New Memo</Button>
        </>
      }
    >
      <div className="card-surface p-5">
        {/* Global search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search memo # / truck / driver / transport / consignee / destination / material / status / remarks…"
            className="h-12 pl-10 text-base"
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="section-title mb-1 block">Scope</label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-11 min-w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="month">Current Month</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending Deliveries</SelectItem>
                <SelectItem value="payment_pending">Payment Pending</SelectItem>
                <SelectItem value="collection_due">Collection Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="section-title mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11 min-w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_MEMO_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="section-title mb-1 block">Truck</label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger className="h-11 min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trucks</SelectItem>
                {trucks?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.truckNumber}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="section-title mb-1 block">Consignee</label>
            <Select value={consigneeId} onValueChange={setConsigneeId}>
              <SelectTrigger className="h-11 min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All consignees</SelectItem>
                {consignees?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
          {selected.size > 0 && (
            <>
              <Select onValueChange={(v) => bulkStatus(v as MemoStatus)}>
                <SelectTrigger className="h-11 min-w-[200px]"><SelectValue placeholder={`Set status for ${selected.size}…`} /></SelectTrigger>
                <SelectContent>
                  {ALL_MEMO_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="destructive" onClick={() => setConfirmBulk(true)}>Delete {selected.size} selected</Button>
            </>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1600px] text-left">
            <thead className="border-b bg-muted/40">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-8 px-3 py-3"><Checkbox checked={pageRows.length > 0 && selected.size === pageRows.length} onCheckedChange={toggleAll} /></th>
                <th className="px-3 py-3">Memo #</th>
                <th className="px-3 py-3">Dispatch</th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center">Truck
                    <ColumnFilter
                      values={rowsPre.map((r) => truckById(r.truckId)?.truckNumber || "—")}
                      selected={colFilters.truck}
                      onApply={(n) => setColFilters((f) => ({ ...f, truck: n }))}
                    />
                  </span>
                </th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center">Transport
                    <ColumnFilter
                      values={rowsPre.map((r) => r.transportName || "—")}
                      selected={colFilters.transport}
                      onApply={(n) => setColFilters((f) => ({ ...f, transport: n }))}
                    />
                  </span>
                </th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center">Destination
                    <ColumnFilter
                      values={rowsPre.map((r) => r.toLocation || "—")}
                      selected={colFilters.destination}
                      onApply={(n) => setColFilters((f) => ({ ...f, destination: n }))}
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">Rate/Ton</th>
                <th className="px-3 py-3 text-right">Weight</th>
                <th className="px-3 py-3 text-right">Net Freight</th>
                <th className="px-3 py-3 text-right">Advance</th>
                <th className="px-3 py-3 text-right">Balance</th>
                <th className="px-3 py-3">Unloading</th>
                <th className="px-3 py-3">LR Rec.</th>
                <th className="px-3 py-3">LR Sub.</th>
                <th className="px-3 py-3 text-right">Final Payable</th>
                <th className="px-3 py-3">Final Pay Date</th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center">Status
                    <ColumnFilter
                      values={rowsPre.map((r) => r.status)}
                      selected={colFilters.status}
                      onApply={(n) => setColFilters((f) => ({ ...f, status: n }))}
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={18} className="py-16 text-center text-muted-foreground">
                  <div>No records found</div>
                  <Button variant="link" onClick={resetFilters}>Reset filters</Button>
                </td></tr>
              )}
              {pageRows.map((r) => {
                const tr = truckById(r.truckId);
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-3"><Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => {
                      const next = new Set(selected); if (v) next.add(r.id); else next.delete(r.id); setSelected(next);
                    }} /></td>
                    <td className="px-3 py-3"><Link to="/memo/$id" params={{ id: r.id }} className="font-semibold text-blue-600 hover:underline">{r.memoNumber}</Link></td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.dispatchDate)}</td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">{tr?.truckNumber ?? "—"}</td>
                    <td className="px-3 py-3">{r.transportName}</td>
                    <td className="px-3 py-3 font-semibold">{r.toLocation}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(r.ratePerTon)}</td>
                    <td className="px-3 py-3 text-right">{r.weightTons}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(r.netFreight)}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(r.advance)}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(r.balance)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.unloadingDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.lrReceivedDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.lrSubmittedDate)}</td>
                    <td className="px-3 py-3 text-right">{formatMoney(r.finalPayable)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.finalPaymentDate)}</td>
                    <td className="px-3 py-3"><StatusBadge status={r.status as MemoStatus} /></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to="/memo/$id" params={{ id: r.id }}><Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                        <Link to="/new-memo" search={{ edit: r.id } as never}><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
                        <Link to="/memo/$id" params={{ id: r.id }} search={{ print: 1 } as never}><Button size="icon" variant="ghost"><Printer className="h-4 w-4" /></Button></Link>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(r)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing {pageRows.length} of {total}
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (<SelectItem key={n} value={String(n)}>{n} / page</SelectItem>))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <div className="text-sm">Page {page} of {pages}</div>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move memo to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Memo <b>{confirmDel?.memoNumber}</b> will be moved to Trash. You can restore it any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (confirmDel) { await deleteMemo(confirmDel.id); toast.success("Moved to trash"); setConfirmDel(null); }
            }}>Move to trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selected.size} memo(s) to trash?</AlertDialogTitle>
            <AlertDialogDescription>All selected memos will be soft-deleted. Restore from Trash any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>Move to trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
