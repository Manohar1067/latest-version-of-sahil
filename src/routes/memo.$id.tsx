import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getMemo, getTruck, getConsignee, getSettings, type Memo, type FleetTruck, type Consignee, type Settings } from "@/lib/dataStore";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Printer, Download, MessageCircle, Mail, ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

type S = { print?: number };
export const Route = createFileRoute("/memo/$id")({
  component: MemoView,
  validateSearch: (s: Record<string, unknown>): S => ({ print: s.print ? 1 : undefined }),
});

function Row({ label, value, bold = true }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dashed border-gray-300 py-1.5">
      <div className="w-40 shrink-0 text-[12px] text-gray-600">{label}</div>
      <div className={`flex-1 text-[13.5px] ${bold ? "font-bold text-black" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function MemoView() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const nav = useNavigate();
  const { data: memo } = useStoreData<Memo | undefined>(() => getMemo(id), [id]);
  const [truck, setTruck] = useState<FleetTruck | undefined>();
  const [consignee, setConsignee] = useState<Consignee | undefined>();
  const [settings, setSettings] = useState<Settings | undefined>();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (memo) {
      getTruck(memo.truckId).then(setTruck);
      getConsignee(memo.consigneeId).then(setConsignee);
    }
    getSettings().then(setSettings);
  }, [memo]);

  useEffect(() => {
    if (print && memo) setTimeout(() => window.print(), 400);
  }, [print, memo]);

  const download = async () => {
    if (!printRef.current) return;
    toast.info("Generating PDF…");
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
    pdf.save(`${memo?.memoNumber || "memo"}.pdf`);
  };

  if (!memo) return <AppShell title="Memo"><div className="card-surface p-8 text-center">Loading…</div></AppShell>;

  return (
    <AppShell
      title={`Memo ${memo.memoNumber}`}
      breadcrumb="Home / Register / Memo"
      actions={
        <>
          <Button variant="outline" onClick={() => nav({ to: "/register" })}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
          <Button variant="outline" onClick={() => nav({ to: "/new-memo", search: { edit: memo.id } as never })}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
          <Button variant="outline" onClick={() => toast.info("WhatsApp share requires backend — coming soon")}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
          <Button variant="outline" onClick={() => toast.info("Email share requires backend — coming soon")}><Mail className="mr-1 h-4 w-4" />Email</Button>
          <Button variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
        </>
      }
    >
      <div className="mx-auto max-w-[820px]">
        <div ref={printRef} className="print-area bg-white p-8 text-black shadow" style={{ minHeight: "1120px" }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
            <div className="flex items-center gap-3">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} className="h-16 w-16" alt="logo" />
              ) : (
                <div className="flex h-16 w-16 rotate-45 items-center justify-center bg-[#0b2a55]">
                  <div className="h-6 w-6 rotate-45 bg-white" />
                </div>
              )}
              <div>
                <div className="text-2xl font-extrabold tracking-tight">{settings?.companyName ?? "SAHIL ROAD LINES"}</div>
                <div className="text-[12px] italic text-gray-700">Transport Contractors & Commission Agents</div>
                <div className="mt-1 text-[11px] text-gray-800">{settings?.address}</div>
                <div className="text-[11px] text-gray-800">Ph: {settings?.phone} · GST: {settings?.gst}</div>
                <div className="text-[11px] font-semibold text-gray-900">{settings?.jurisdictionText}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="rounded border border-black px-3 py-1">
                <div className="text-[10px] uppercase tracking-wider text-gray-600">Memo No.</div>
                <div className="text-lg font-black">{memo.memoNumber}</div>
              </div>
              <div className="mt-2 text-[11px]"><span className="text-gray-600">Date: </span><span className="font-bold">{formatDate(memo.dispatchDate)}</span></div>
              <div className="mt-1"><StatusBadge status={memo.status} /></div>
            </div>
          </div>

          {/* Body */}
          <div className="mt-3 grid grid-cols-2 gap-x-6">
            <div>
              <Row label="From" value={memo.fromLocation} />
              <Row label="Destination" value={memo.toLocation} />
              <Row label="Material" value={memo.materialName} />
              <Row label="Lorry Owner Name" value={memo.ownerName} />
              <Row label="Driver Name" value={memo.driverName} />
              <Row label="Truck Number" value={truck?.truckNumber} />
              <Row label="Consignee" value={consignee?.companyName} />
              <Row label="Consignor" value={<span className="text-gray-400">__________________</span>} bold={false} />
              <Row label="Description" value={memo.description} />
              <Row label="Rate / Ton" value={formatMoney(memo.ratePerTon)} />
              <Row label="Weight (tons)" value={memo.weightTons} />
              <Row label="Net Freight" value={formatMoney(memo.netFreight)} />
              <Row label="Advance" value={formatMoney(memo.advance)} />
              <Row label="Balance" value={formatMoney(memo.balance)} />
            </div>
            <div>
              <Row label="Paid At" value={`${memo.paidBy} · ${memo.paymentMethod}`} />
              <Row label="Balance" value={formatMoney(memo.balance)} />
              <Row label="Commission" value={formatMoney(memo.commission)} />
              <Row label="Loading Charges" value={formatMoney(memo.loadingCharges)} />
              <Row label="Goods Mamuli" value={formatMoney(memo.goodsMamuli)} />
              <Row label="TDS" value={formatMoney(memo.tds)} />
              <Row label="Total Expenses" value={formatMoney(memo.totalExpenses)} />
              <Row label="Final Payable" value={formatMoney(memo.finalPayable)} />
              <Row label="Final Payment Date" value={formatDate(memo.finalPaymentDate)} />
              <Row label="Unloading Date" value={formatDate(memo.unloadingDate)} />
              <Row label="LR Received Date" value={formatDate(memo.lrReceivedDate)} />
              <Row label="LR Submitted Date" value={formatDate(memo.lrSubmittedDate)} />
              <Row label="Remarks" value={memo.remarks} />

              <div className="mt-4 rounded border-2 border-red-500 bg-red-50 p-2 text-center text-[12px] font-bold text-red-700">
                Goods Receipt should be arrived within 15 days.
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-6 border-t pt-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">Terms & Conditions</div>
            <pre className="whitespace-pre-wrap text-[10.5px] leading-snug text-gray-700 font-sans">{settings?.terms}</pre>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-3 gap-6 text-center text-[11px]">
            <div>
              <div className="h-12 border-b border-black" />
              <div className="mt-1 font-semibold">Driver Signature</div>
            </div>
            <div>
              <div className="h-12 border-b border-black" />
              <div className="mt-1 font-semibold">Office Signature</div>
            </div>
            <div>
              <div className="h-12 border-b border-black" />
              <div className="mt-1 font-semibold">Company Stamp</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; box-shadow: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
      <Link to="/register" className="hidden" />
    </AppShell>
  );
}
