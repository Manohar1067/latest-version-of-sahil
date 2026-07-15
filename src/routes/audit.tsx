import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getAuditLog, type AuditLogEntry } from "@/lib/dataStore";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/audit")({ component: AuditPage });

function AuditPage() {
  const { data } = useStoreData<AuditLogEntry[]>(() => getAuditLog(), []);
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data ?? []).filter((r) =>
    [r.actor, r.action, r.entityType, r.entityId].join(" ").toLowerCase().includes(q.toLowerCase())
  ), [data, q]);

  return (
    <AppShell title="Audit Log" breadcrumb="Home / Audit Log">
      <div className="card-surface p-5">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions…" className="h-11 pl-9" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Entity</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Old</th><th className="px-3 py-3">New</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No records found</td></tr>)}
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(r.createdAt).split(" ")[1]}</td>
                  <td className="px-3 py-3">{r.actor}</td>
                  <td className="px-3 py-3">{r.entityType}</td>
                  <td className="px-3 py-3 font-medium">{r.action}</td>
                  <td className="px-3 py-3 max-w-[240px] truncate text-xs text-muted-foreground">{r.oldValue ? JSON.stringify(r.oldValue).slice(0, 80) : "—"}</td>
                  <td className="px-3 py-3 max-w-[240px] truncate text-xs text-muted-foreground">{r.newValue ? JSON.stringify(r.newValue).slice(0, 80) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
