import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import {
  getTrucks, getConsignees, createMemo, updateMemo, getMemo, peekNextMemoNumber,
  ALL_MEMO_STATUSES,
  type FleetTruck, type Consignee, type MemoStatus, type MemoInput,
} from "@/lib/dataStore";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/Combobox";
import { toInputDate, fromInputDate } from "@/lib/format";
import { toast } from "sonner";

const CREATE_STATUSES: MemoStatus[] = ["Dispatched", "Delivered", "Payment Pending", "LR Received", "LR Submitted", "Completed"];

type Search = { edit?: string };
export const Route = createFileRoute("/new-memo")({
  component: NewMemo,
  validateSearch: (s: Record<string, unknown>): Search => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
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

const emptyForm = (): MemoInput => ({
  dispatchDate: new Date().toISOString(),
  fromLocation: "",
  toLocation: "",
  transportName: "",
  consigneeId: "",
  truckId: "",
  driverName: "",
  ownerName: "",
  ownerPhone: "",
  materialName: "",
  weightTons: 0,
  ratePerTon: 0,
  netFreight: 0,
  advance: 0,
  balance: 0,
  commission: 0,
  loadingCharges: 0,
  tds: 0,
  goodsMamuli: 0,
  totalExpenses: 0,
  paidBy: "SRL",
  paymentMethod: "Cash",
  finalPayable: 0,
  status: "Dispatched",
  remarks: "",
  description: "",
  internalNotes: "",
});

function NewMemo() {
  const { edit } = Route.useSearch();
  const nav = useNavigate();
  const { data: trucks } = useStoreData<FleetTruck[]>(() => getTrucks(), []);
  const { data: consignees } = useStoreData<Consignee[]>(() => getConsignees(), []);
  const [nextNum, setNextNum] = useState("");
  const [form, setForm] = useState<MemoInput>(emptyForm());
  const [dirty, setDirty] = useState(false);
  const [freightOverride, setFreightOverride] = useState(false);

  useEffect(() => {
    peekNextMemoNumber().then(setNextNum);
    if (edit) {
      getMemo(edit).then((m) => {
        if (m) {
          const { id, memoNumber, isDeleted, createdAt, updatedAt, deletedAt, ...rest } = m;
          void id; void memoNumber; void isDeleted; void createdAt; void updatedAt; void deletedAt;
          setForm(rest);
          setNextNum(memoNumber);
        }
      });
    }
  }, [edit]);

  // auto-calc
  useEffect(() => {
    setForm((f) => {
      const netFreight = freightOverride ? f.netFreight : Math.round((f.weightTons || 0) * (f.ratePerTon || 0));
      const balance = netFreight - (f.advance || 0);
      const totalExpenses = (f.commission || 0) + (f.loadingCharges || 0) + (f.goodsMamuli || 0) + (f.tds || 0);
      const finalPayable = balance - totalExpenses;
      return { ...f, netFreight, balance, totalExpenses, finalPayable };
    });
  }, [form.weightTons, form.ratePerTon, form.advance, form.commission, form.loadingCharges, form.goodsMamuli, form.tds, freightOverride]);

  // warn on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof MemoInput>(k: K, v: MemoInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  // Auto-fill from truck
  const onTruck = (id: string) => {
    const t = trucks?.find((x) => x.id === id);
    if (t) setForm((f) => ({ ...f, truckId: id, driverName: t.driverName, ownerName: t.ownerName, ownerPhone: t.ownerPhone }));
    else set("truckId", id);
    setDirty(true);
  };

  const paidByOptions = useMemo(() => ["SRL", "KAREEM"], []);

  const submit = async (draft = false) => {
    // basic validation
    if (!form.truckId) return toast.error("Truck is required");
    if (!form.consigneeId) return toast.error("Consignee is required");
    if (!form.materialName) return toast.error("Material is required");
    if (!form.weightTons) return toast.error("Weight is required");
    if (!form.ratePerTon) return toast.error("Rate/Ton is required");
    if (!form.dispatchDate) return toast.error("Dispatch date is required");
    try {
      const payload = { ...form, status: draft ? ("Dispatched" as MemoStatus) : form.status };
      if (edit) {
        await updateMemo(edit, payload);
        toast.success("Memo updated");
        setDirty(false);
        nav({ to: "/memo/$id", params: { id: edit } });
      } else {
        const created = await createMemo(payload);
        toast.success(`Memo ${created.memoNumber} created`);
        setDirty(false);
        nav({ to: "/memo/$id", params: { id: created.id } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title={edit ? "Edit Memo" : "New Memo"} breadcrumb={`Home / ${edit ? "Edit Memo" : "New Memo"}`}>
      <div className="space-y-5 pb-24">
        <Section title="Memo Information">
          <Field label="Memo Number"><Input value={nextNum} readOnly className="h-11 bg-muted font-mono" /></Field>
          <Field label="Dispatch Date" required>
            <Input type="date" className="h-11" value={toInputDate(form.dispatchDate)} onChange={(e) => set("dispatchDate", fromInputDate(e.target.value))} />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onValueChange={(v) => set("status", v as MemoStatus)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{(edit ? ALL_MEMO_STATUSES : CREATE_STATUSES).map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
            </Select>
          </Field>
          <Field label="Remarks"><Input className="h-11" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} /></Field>
        </Section>

        <Section title="Transport Information">
          <Field label="From"><Input className="h-11" value={form.fromLocation} onChange={(e) => set("fromLocation", e.target.value)} /></Field>
          <Field label="To"><Input className="h-11" value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} /></Field>
          <Field label="Transport Name"><Input className="h-11" value={form.transportName} onChange={(e) => set("transportName", e.target.value)} placeholder="Type or select" list="transports" />
            <datalist id="transports"><option value="SRL Direct" /><option value="Kareem Transports" /></datalist>
          </Field>
          <Field label="Consignee" required>
            <Select value={form.consigneeId} onValueChange={(v) => set("consigneeId", v)}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select consignee" /></SelectTrigger>
              <SelectContent>{consignees?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>))}</SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Vehicle Information">
          <Field label="Truck Number" required>
            <Select value={form.truckId} onValueChange={onTruck}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select truck" /></SelectTrigger>
              <SelectContent>{trucks?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.truckNumber}</SelectItem>))}</SelectContent>
            </Select>
          </Field>
          <Field label="Driver Name"><Input className="h-11" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} /></Field>
          <Field label="Owner Name"><Input className="h-11" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
          <Field label="Owner Phone"><Input className="h-11" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} /></Field>
        </Section>

        <Section title="Goods Information">
          <Field label="Material" required><Input className="h-11" value={form.materialName} onChange={(e) => set("materialName", e.target.value)} /></Field>
          <Field label="Weight (tons)" required><Input className="h-11" type="number" step="0.01" value={form.weightTons || ""} onChange={(e) => set("weightTons", Number(e.target.value))} /></Field>
          <Field label="Rate / Ton (₹)" required><Input className="h-11" type="number" value={form.ratePerTon || ""} onChange={(e) => set("ratePerTon", Number(e.target.value))} /></Field>
          <Field label="Unloading Date"><Input className="h-11" type="date" value={toInputDate(form.unloadingDate)} onChange={(e) => set("unloadingDate", fromInputDate(e.target.value))} /></Field>
          <Field label="LR Received Date"><Input className="h-11" type="date" value={toInputDate(form.lrReceivedDate)} onChange={(e) => set("lrReceivedDate", fromInputDate(e.target.value))} /></Field>
          <Field label="LR Submitted Date"><Input className="h-11" type="date" value={toInputDate(form.lrSubmittedDate)} onChange={(e) => set("lrSubmittedDate", fromInputDate(e.target.value))} /></Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Payment Information">
          <Field label="Net Freight (₹)">
            <div className="flex gap-2">
              <Input className="h-11" type="number" value={form.netFreight || 0} onChange={(e) => { setFreightOverride(true); set("netFreight", Number(e.target.value)); }} />
              {freightOverride && <Button variant="outline" onClick={() => setFreightOverride(false)}>Auto</Button>}
            </div>
          </Field>
          <Field label="Advance (₹)"><Input className="h-11" type="number" value={form.advance || 0} onChange={(e) => set("advance", Number(e.target.value))} /></Field>
          <Field label="Balance (₹)"><Input className="h-11" value={form.balance} readOnly /></Field>
          <Field label="Commission (₹)"><Input className="h-11" type="number" value={form.commission || 0} onChange={(e) => set("commission", Number(e.target.value))} /></Field>
          <Field label="Loading Charges (₹)"><Input className="h-11" type="number" value={form.loadingCharges || 0} onChange={(e) => set("loadingCharges", Number(e.target.value))} /></Field>
          <Field label="TDS (₹)"><Input className="h-11" type="number" value={form.tds || 0} onChange={(e) => set("tds", Number(e.target.value))} /></Field>
          <Field label="Goods Mamuli (₹)"><Input className="h-11" type="number" value={form.goodsMamuli || 0} onChange={(e) => set("goodsMamuli", Number(e.target.value))} /></Field>
          <Field label="Total Expenses (₹)"><Input className="h-11" value={form.totalExpenses} readOnly /></Field>
          <Field label="Paid By">
            <Select value={form.paidBy} onValueChange={(v) => set("paidBy", v)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{paidByOptions.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
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
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Internal Financial Details (Admin Only)">
          <Field label="Final Payable (₹)"><Input className="h-11" type="number" value={form.finalPayable || 0} onChange={(e) => set("finalPayable", Number(e.target.value))} /></Field>
          <Field label="Final Payment Date"><Input className="h-11" type="date" value={toInputDate(form.finalPaymentDate)} onChange={(e) => set("finalPaymentDate", fromInputDate(e.target.value))} /></Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Internal Notes (never printed)"><Textarea rows={2} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} /></Field>
          </div>
        </Section>
      </div>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-60 right-0 z-10 flex justify-end gap-2 border-t bg-background/95 px-8 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) nav({ to: "/register" }); }}>Cancel</Button>
        <Button variant="outline" onClick={() => submit(true)}>Save Draft</Button>
        <Button onClick={() => submit(false)}>Save Memo</Button>
      </div>
    </AppShell>
  );
}
