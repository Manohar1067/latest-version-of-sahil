import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getTrucks, getConsignees, type FleetTruck, type Consignee } from "@/lib/dataStore";
import {
  updateTransportEntry, getTransportEntry,
  ALL_TRANSPORT_STATUSES, type TransportStatus, type TransportEntryInput,
} from "@/lib/transportListStore";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/Combobox";
import { toInputDate, fromInputDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/transport-edit/$id")({
  component: TransportEditPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-6">
      <div className="section-title mb-2">{title}</div>
      <div className="mb-5 border-b" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label} {required && <span className="text-red-500">*</span>}</Label>
      {children}
    </div>
  );
}

function TransportEditPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { data: trucks } = useStoreData<FleetTruck[]>(() => getTrucks(), []);
  const { data: consignees } = useStoreData<Consignee[]>(() => getConsignees(), []);
  const [memoNumber, setMemoNumber] = useState("");
  const [form, setForm] = useState<TransportEntryInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTransportEntry(id)
      .then((m) => {
        if (!m) { toast.error("Transport entry not found"); return; }
        const { id: _i, entryNumber, isDeleted: _d, createdAt: _c, updatedAt: _u, deletedAt: _x, ...rest } = m;
        void _i; void _d; void _c; void _u; void _x;
        // Stored values are loaded as-is — NO recalculation on load.
        setForm(rest);
        setMemoNumber(entryNumber);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load entry"));
  }, [id]);

  const set = <K extends keyof TransportEntryInput>(k: K, v: TransportEntryInput[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setDirty(true);
  };

  /** Only triggered when the user actively edits an amount field — never on load. */
  type NumKey = "weightTons" | "ratePerTon" | "advance" | "commission" | "loadingCharges" | "tds" | "goodsMamuli" | "haltingCharge";
  const setAndRecalc = (k: NumKey, v: number) => {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [k]: v };
      const netFreight = Math.round((next.weightTons || 0) * (next.ratePerTon || 0));
      const balance = netFreight - (next.advance || 0);
      // Halting charge is part of a transport entry's expenses.
      const totalExpenses =
        (next.commission || 0) + (next.loadingCharges || 0) + (next.tds || 0) +
        (next.goodsMamuli || 0) + (next.haltingCharge || 0);
      const finalPayable = balance - totalExpenses;
      return { ...next, netFreight, balance, totalExpenses, finalPayable };
    });
    setDirty(true);
  };

  const submit = async () => {
    if (!form) return;
    if (!form.truckNumber) return toast.error("Truck is required");
    if (!form.materialName) return toast.error("Material is required");
    if (!form.dispatchDate) return toast.error("Dispatch date is required");
    setSaving(true);
    try {
      // Writes ONLY to transport_list — the originating memo is never touched.
      await updateTransportEntry(id, form);
      toast.success("Transport entry updated");
      setDirty(false);
      nav({ to: "/transport-list" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <AppShell title="Edit Transport Entry"><div className="card-surface p-8 text-center">Loading…</div></AppShell>;
  }

  return (
    <AppShell
      title={`Edit Transport Entry ${memoNumber}`}
      breadcrumb="Home / Transport List / Edit Entry"
    >
      <div className="space-y-5 pb-24">
        <Section title="Entry Information">
          <Field label="Memo Number"><Input value={memoNumber} readOnly className="h-11 bg-muted font-mono" /></Field>
          <Field label="Dispatch Date" required>
            <Input type="date" className="h-11" value={toInputDate(form.dispatchDate)} onChange={(e) => set("dispatchDate", fromInputDate(e.target.value))} />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onValueChange={(v) => set("status", v as TransportStatus)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{ALL_TRANSPORT_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
            </Select>
          </Field>
          <Field label="Remarks"><Input className="h-11" value={form.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} /></Field>
        </Section>

        <Section title="Transport Information">
          <Field label="From"><Input className="h-11" value={form.fromLocation} onChange={(e) => set("fromLocation", e.target.value)} /></Field>
          <Field label="To"><Input className="h-11" value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} /></Field>
          <Field label="Transport Name">
            <Combobox
              options={Array.from(new Set(["SRL Direct", "Kareem Transports", form.transportName].filter(Boolean))).map((n) => ({ value: n, label: n }))}
              value={form.transportName}
              onChange={(v) => set("transportName", v)}
              placeholder="Search or type transport…"
              allowCustom
              createLabel="Use"
            />
          </Field>
          <Field label="Consignee">
            <Combobox
              options={(consignees ?? []).map((c) => ({ value: c.companyName, label: c.companyName, keywords: `${c.city} ${c.contactPerson}` }))}
              value={form.consigneeName}
              onChange={(v) => set("consigneeName", v)}
              placeholder="Search or type consignee…"
              allowCustom
              createLabel="Use"
            />
          </Field>
        </Section>

        <Section title="Vehicle Information">
          <Field label="Truck Number" required>
            <Combobox
              options={(trucks ?? []).map((t) => ({ value: t.truckNumber, label: t.truckNumber, keywords: `${t.driverName} ${t.ownerName}` }))}
              value={form.truckNumber}
              onChange={(v) => set("truckNumber", v)}
              placeholder="Search or type truck number…"
              allowCustom
              createLabel="Use"
            />
          </Field>
          <Field label="Driver Name"><Input className="h-11" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} /></Field>
          <Field label="Owner Name"><Input className="h-11" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
          <Field label="Owner Phone"><Input className="h-11" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} /></Field>
        </Section>

        <Section title="Goods Information">
          <Field label="Material" required><Input className="h-11" value={form.materialName} onChange={(e) => set("materialName", e.target.value)} /></Field>
          <Field label="Weight (tons)" required>
            <Input className="h-11" type="number" step="0.01" value={form.weightTons ?? 0} onChange={(e) => setAndRecalc("weightTons", Number(e.target.value))} />
          </Field>
          <Field label="Rate/Ton (Transport) (₹)" required>
            <Input className="h-11" type="number" value={form.ratePerTon ?? 0} onChange={(e) => setAndRecalc("ratePerTon", Number(e.target.value))} />
          </Field>
          <Field label="Unloading Date"><Input className="h-11" type="date" value={toInputDate(form.unloadingDate)} onChange={(e) => set("unloadingDate", fromInputDate(e.target.value))} /></Field>
          <Field label="Halting Charge (₹)"><Input className="h-11" type="number" value={form.haltingCharge ?? 0} onChange={(e) => setAndRecalc("haltingCharge", Number(e.target.value))} /></Field>
          <Field label="LR Received Date"><Input className="h-11" type="date" value={toInputDate(form.lrReceivedDate)} onChange={(e) => set("lrReceivedDate", fromInputDate(e.target.value))} /></Field>
          <Field label="LR Submitted Date"><Input className="h-11" type="date" value={toInputDate(form.lrSubmittedDate)} onChange={(e) => set("lrSubmittedDate", fromInputDate(e.target.value))} /></Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Description"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Payment Information">
          <Field label="Net Freight (₹)"><Input className="h-11" type="number" value={form.netFreight ?? 0} onChange={(e) => set("netFreight", Number(e.target.value))} /></Field>
          <Field label="Advance (₹)"><Input className="h-11" type="number" value={form.advance ?? 0} onChange={(e) => setAndRecalc("advance", Number(e.target.value))} /></Field>
          <Field label="Balance (₹)"><Input className="h-11" type="number" value={form.balance ?? 0} onChange={(e) => set("balance", Number(e.target.value))} /></Field>
          <Field label="Commission (₹)"><Input className="h-11" type="number" value={form.commission ?? 0} onChange={(e) => setAndRecalc("commission", Number(e.target.value))} /></Field>
          <Field label="Loading Charges (₹)"><Input className="h-11" type="number" value={form.loadingCharges ?? 0} onChange={(e) => setAndRecalc("loadingCharges", Number(e.target.value))} /></Field>
          <Field label="TDS (₹)"><Input className="h-11" type="number" value={form.tds ?? 0} onChange={(e) => setAndRecalc("tds", Number(e.target.value))} /></Field>
          <Field label="Goods Mamuli (₹)"><Input className="h-11" type="number" value={form.goodsMamuli ?? 0} onChange={(e) => setAndRecalc("goodsMamuli", Number(e.target.value))} /></Field>
          <Field label="Total Expenses (₹)"><Input className="h-11" type="number" value={form.totalExpenses ?? 0} onChange={(e) => set("totalExpenses", Number(e.target.value))} /></Field>
          <Field label="Paid By">
            <Select value={form.paidBy} onValueChange={(v) => set("paidBy", v)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SRL">Sahil</SelectItem>
                <SelectItem value="KAREEM">Kareem</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment Method">
            <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="PhonePe">PhonePe</SelectItem>
                <SelectItem value="GPay">GPay</SelectItem>
                <SelectItem value="Paytm">Paytm</SelectItem>
                <SelectItem value="Axis Bank – Current">Axis Bank – Current</SelectItem>
                <SelectItem value="Axis Bank – Savings">Axis Bank – Savings</SelectItem>
                <SelectItem value="HDFC Bank – Current">HDFC Bank – Current</SelectItem>
                <SelectItem value="HDFC Bank – Savings">HDFC Bank – Savings</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Internal Financial Details (Admin Only)">
          <Field label="Final Payable (₹)"><Input className="h-11" type="number" value={form.finalPayable ?? 0} onChange={(e) => set("finalPayable", Number(e.target.value))} /></Field>
          <Field label="Final Payment Date"><Input className="h-11" type="date" value={toInputDate(form.finalPaymentDate)} onChange={(e) => set("finalPaymentDate", fromInputDate(e.target.value))} /></Field>
        </Section>
      </div>

      <div className="fixed bottom-0 left-60 right-0 z-10 flex justify-end gap-2 border-t bg-background/95 px-8 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) nav({ to: "/transport-list" }); }}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </AppShell>
  );
}
