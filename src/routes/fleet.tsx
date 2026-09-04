import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getTrucks, createTruck, updateTruck, deleteTruck, type FleetTruck } from "@/lib/dataStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { useState } from "react";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth, isSuperAdmin } from "@/lib/AuthContext";

export const Route = createFileRoute("/fleet")({ component: FleetPage });

const empty: Omit<FleetTruck, "id"> = {
  truckNumber: "", ownerName: "", ownerPhone: "", driverName: "", driverPhone: "",
  insuranceExpiry: "", remarks: "",
};

function FleetPage() {
  const { profile } = useAuth();
  const admin = isSuperAdmin(profile);
  const { data: trucks } = useStoreData<FleetTruck[]>(() => getTrucks(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FleetTruck | null>(null);

  const filtered = (trucks ?? []).filter((t) =>
    [t.truckNumber, t.ownerName, t.driverName, t.driverPhone].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (t: FleetTruck) => { const { id, ...rest } = t; void id; setForm(rest); setEditId(t.id); setOpen(true); };
  const save = async () => {
    try {
      if (!form.truckNumber) return toast.error("Truck number required");
      if (editId) { await updateTruck(editId, form); toast.success(`Truck ${form.truckNumber} updated`); }
      else { await createTruck(form); toast.success(`Truck ${form.truckNumber} added`); }
      setOpen(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const n = pendingDelete.truckNumber;
    await deleteTruck(pendingDelete.id);
    setPendingDelete(null);
    toast.success(`Truck ${n} deleted`);
  };

  return (
    <AppShell title="Fleet Management" breadcrumb="Home / Fleet Management" actions={admin ? <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" />Add Truck</Button> : undefined}>
      <Tabs defaultValue="trucks">
        <TabsList>
          <TabsTrigger value="trucks">Trucks & Drivers</TabsTrigger>
        </TabsList>
        <TabsContent value="trucks">
          <div className="card-surface p-5">
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trucks or drivers…" className="h-11 pl-9" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Truck #</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Owner Phone</th>
                    <th className="px-3 py-3">Driver</th><th className="px-3 py-3">Driver Phone</th>
                    <th className="px-3 py-3">Insurance Expiry</th><th className="px-3 py-3">Remarks</th>
                    {admin && <th className="px-3 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (<tr><td colSpan={admin ? 8 : 7} className="py-16 text-center text-muted-foreground">No records found</td></tr>)}
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-3 font-semibold">{t.truckNumber}</td>
                      <td className="px-3 py-3">{t.ownerName}</td>
                      <td className="px-3 py-3">{t.ownerPhone}</td>
                      <td className="px-3 py-3 font-medium">{t.driverName}</td>
                      <td className="px-3 py-3">{t.driverPhone}</td>
                      <td className="px-3 py-3">{formatDate(t.insuranceExpiry)}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{t.remarks || "—"}</td>
                      {admin && (
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setPendingDelete(t)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Edit Truck" : "Add Truck"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["truckNumber", "Truck Number *"],
                ["ownerName", "Owner Name"],
                ["ownerPhone", "Owner Phone"],
                ["driverName", "Driver Name"],
                ["driverPhone", "Driver Phone"],
                ["insuranceExpiry", "Insurance Expiry", "date"],
              ] as Array<[keyof typeof form, string, string?]>
            ).map(([k, label, type]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <Label>{label}</Label>
                <Input type={type ?? "text"} className="h-11" value={(form[k] as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Remarks</Label>
              <Input className="h-11" value={form.remarks ?? ""} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete truck {pendingDelete?.truckNumber}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
