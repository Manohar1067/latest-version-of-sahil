import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getTrashedMemos, restoreMemo, permanentlyDeleteMemo, type Memo } from "@/lib/dataStore";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/trash")({ component: TrashPage });

function TrashPage() {
  const { data } = useStoreData<Memo[]>(() => getTrashedMemos(), []);
  const rows = data ?? [];
  const [pending, setPending] = useState<Memo | null>(null);

  const doRestore = async (r: Memo) => {
    await restoreMemo(r.id);
    toast.success(`Memo ${r.memoNumber} restored to Register List`);
  };

  const doPermanentDelete = async () => {
    if (!pending) return;
    const n = pending.memoNumber;
    await permanentlyDeleteMemo(pending.id);
    setPending(null);
    toast.success(`Memo ${n} permanently deleted`);
  };

  return (
    <AppShell title="Trash" breadcrumb="Home / Trash">
      <div className="card-surface p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-3">Memo #</th><th className="px-3 py-3">Deleted At</th><th className="px-3 py-3">Dispatch</th><th className="px-3 py-3">Destination</th><th className="px-3 py-3 text-right">Net Freight</th><th className="px-3 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={6} className="py-16 text-center text-muted-foreground">Trash is empty</td></tr>)}
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-3 font-semibold">{r.memoNumber}</td>
                  <td className="px-3 py-3">{formatDate(r.deletedAt)}</td>
                  <td className="px-3 py-3">{formatDate(r.dispatchDate)}</td>
                  <td className="px-3 py-3">{r.toLocation}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(r.netFreight)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => doRestore(r)}>
                        <RotateCcw className="mr-1 h-4 w-4" />Restore
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setPending(r)}>
                        <Trash2 className="mr-1 h-4 w-4" />Delete forever
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete memo {pending?.memoNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This memo will be permanently removed from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doPermanentDelete}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
