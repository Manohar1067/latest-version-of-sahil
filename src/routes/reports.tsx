import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getMemos, getTrucks, type Memo, type FleetTruck } from "@/lib/dataStore";
import { formatMoney, formatDate } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useMemo, useRef, useState } from "react";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { exportRows } from "@/lib/exportData";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type Range = "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "year" | "fy" | "all";

function rangeStart(r: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (r) {
    case "today": return d;
    case "yesterday": { const x = new Date(d); x.setDate(x.getDate() - 1); return x; }
    case "week": { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; }
    case "last_week": { const x = new Date(d); x.setDate(x.getDate() - x.getDay() - 7); return x; }
    case "month": return new Date(d.getFullYear(), d.getMonth(), 1);
    case "last_month": return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    case "year": return new Date(d.getFullYear(), 0, 1);
    case "fy": {
      const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return new Date(y, 3, 1);
    }
    case "all": return new Date(0);
  }
}
function rangeEnd(r: Range): Date {
  const d = new Date(); d.setHours(23, 59, 59, 999);
  if (r === "yesterday") { const x = new Date(d); x.setDate(x.getDate() - 1); return x; }
  if (r === "last_week") { const x = new Date(d); x.setDate(x.getDate() - x.getDay() - 1); return x; }
  if (r === "last_month") return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
  return d;
}

function ReportsPage() {
  const { data: memos } = useStoreData<Memo[]>(() => getMemos(), []);
  const { data: trucks } = useStoreData<FleetTruck[]>(() => getTrucks(), []);
  const [range, setRange] = useState<Range>("month");
  const [type, setType] = useState<string>("summary");
  const chartsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = rangeStart(range).getTime(); const e = rangeEnd(range).getTime();
    return (memos ?? []).filter((m) => { const t = +new Date(m.dispatchDate); return t >= s && t <= e; });
  }, [memos, range]);

  const revenue = filtered.reduce((s, x) => s + x.netFreight, 0);
  const expense = filtered.reduce((s, x) => s + x.totalExpenses, 0);
  const profit = revenue - expense;
  const pendingPay = filtered.filter((x) => x.status === "Payment Pending").reduce((s, x) => s + x.balance, 0);
  const lrPendingCount = filtered.filter((x) => !x.lrSubmittedDate).length;
  const completed = filtered.filter((x) => x.status === "Completed").length;
  const running = filtered.filter((x) => x.status === "Running" || x.status === "Dispatched").length;
  const cancelled = filtered.filter((x) => x.status === "Cancelled").length;

  const truckStats: Array<{ id: string; number: string; trips: number; revenue: number }> = [];
  const groupTruck: Record<string, { trips: number; revenue: number }> = {};
  filtered.forEach((m) => {
    if (!groupTruck[m.truckId]) groupTruck[m.truckId] = { trips: 0, revenue: 0 };
    groupTruck[m.truckId].trips++;
    groupTruck[m.truckId].revenue += m.netFreight;
  });
  Object.entries(groupTruck).forEach(([id, v]) => {
    const t = trucks?.find((x) => x.id === id);
    truckStats.push({ id, number: t?.truckNumber ?? "—", ...v });
  });
  truckStats.sort((a, b) => b.revenue - a.revenue);

  const driverStats: Record<string, number> = {};
  filtered.forEach((m) => { driverStats[m.driverName] = (driverStats[m.driverName] || 0) + 1; });
  const topDrivers = Object.entries(driverStats).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell title="Reports" breadcrumb="Home / Reports" actions={
      <>
        <Button variant="outline" onClick={() => toast.info("Excel export — coming soon")}><Download className="mr-1 h-4 w-4" />Excel</Button>
        <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
      </>
    }>
      <div className="card-surface mb-5 flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="section-title mb-1 block">Date Range</label>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="h-11 min-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="year">Current Year</SelectItem>
              <SelectItem value="fy">Financial Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="section-title mb-1 block">Report Type</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-11 min-w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Revenue / Expense / Profit</SelectItem>
              <SelectItem value="trucks">Top Trucks</SelectItem>
              <SelectItem value="drivers">Top Drivers</SelectItem>
              <SelectItem value="pending">Pending Payment</SelectItem>
              <SelectItem value="lr">LR Pending</SelectItem>
              <SelectItem value="trips">Trip List</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(revenue)} tone="text-emerald-600" />
        <StatCard label="Expenses" value={formatMoney(expense)} tone="text-red-600" />
        <StatCard label="Profit" value={formatMoney(profit)} tone={profit >= 0 ? "text-emerald-600" : "text-red-600"} />
        <StatCard label="Pending Payment" value={formatMoney(pendingPay)} tone="text-orange-600" />
        <StatCard label="Completed Trips" value={String(completed)} />
        <StatCard label="Running Trips" value={String(running)} />
        <StatCard label="Cancelled Trips" value={String(cancelled)} />
        <StatCard label="LR Pending" value={String(lrPendingCount)} />
      </div>

      {type === "trucks" && (
        <div className="card-surface p-5">
          <h3 className="mb-3">Top Trucks</h3>
          <table className="w-full text-left">
            <thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="py-2">Truck</th><th>Trips</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>{truckStats.map((t) => (<tr key={t.id} className="border-b"><td className="py-2 font-semibold">{t.number}</td><td>{t.trips}</td><td className="text-right">{formatMoney(t.revenue)}</td></tr>))}
            {truckStats.length === 0 && (<tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No data</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {type === "drivers" && (
        <div className="card-surface p-5">
          <h3 className="mb-3">Top Drivers</h3>
          <table className="w-full text-left">
            <thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="py-2">Driver</th><th className="text-right">Trips</th></tr></thead>
            <tbody>{topDrivers.map(([d, n]) => (<tr key={d} className="border-b"><td className="py-2 font-semibold">{d}</td><td className="text-right">{n}</td></tr>))}
            {topDrivers.length === 0 && (<tr><td colSpan={2} className="py-8 text-center text-muted-foreground">No data</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {(type === "summary" || type === "trips" || type === "pending" || type === "lr") && (
        <div className="card-surface p-5">
          <h3 className="mb-3">Trips ({filtered.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Memo #</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Truck</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2 text-right">Net Freight</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {(type === "pending" ? filtered.filter((x) => x.status === "Payment Pending")
                  : type === "lr" ? filtered.filter((x) => !x.lrSubmittedDate) : filtered).map((m) => {
                  const t = trucks?.find((x) => x.id === m.truckId);
                  return (
                    <tr key={m.id} className="border-b">
                      <td className="px-3 py-2 font-semibold text-blue-600">{m.memoNumber}</td>
                      <td className="px-3 py-2">{formatDate(m.dispatchDate)}</td>
                      <td className="px-3 py-2">{t?.truckNumber}</td>
                      <td className="px-3 py-2 font-semibold">{m.toLocation}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(m.netFreight)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(m.balance)}</td>
                      <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (<tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No records</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card-surface p-5">
      <div className="section-title">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
