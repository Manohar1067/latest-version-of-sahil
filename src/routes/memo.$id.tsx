import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getMemo, getTruck, getConsignee, getSettings, type Memo, type FleetTruck, type Consignee, type Settings } from "@/lib/dataStore";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer, Download, MessageCircle, Mail, ArrowLeft, Pencil, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

type S = { print?: number };
export const Route = createFileRoute("/memo/$id")({
  component: MemoView,
  validateSearch: (s: Record<string, unknown>): S => ({ print: s.print ? 1 : undefined }),
});

/** Ledger-style cell: bold user values, regular labels. */
function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex border-b border-black last:border-b-0">
      <div className="w-[42%] shrink-0 border-r border-black bg-gray-50 px-2 py-[5px] text-[11.5px] text-black">{label}</div>
      <div className="flex-1 px-2 py-[5px] text-[12.5px] font-bold text-black">
        {value === undefined || value === null || value === "" ? "—" : value}
      </div>
    </div>
  );
}

async function renderCanvas(el: HTMLElement) {
  // html2canvas-pro supports modern CSS colors (oklch) used by Tailwind v4;
  // the legacy html2canvas throws/hangs on them.
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
}
async function buildPdfBlob(el: HTMLElement) {
  const canvas = await renderCanvas(el);
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
  return pdf.output("blob");
}
async function buildImageBlob(el: HTMLElement): Promise<Blob> {
  const canvas = await renderCanvas(el);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), "image/png", 1),
  );
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function MemoView() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const nav = useNavigate();
  const { data: memo } = useStoreData<Memo | undefined>(() => getMemo(id), [id]);
  const { data: settings } = useStoreData<Settings>(() => getSettings(), []);
  const [truck, setTruck] = useState<FleetTruck | undefined>();
  const [consignee, setConsignee] = useState<Consignee | undefined>();
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (memo) {
      getTruck(memo.truckId).then(setTruck);
      getConsignee(memo.consigneeId).then(setConsignee);
    }
  }, [memo]);

  useEffect(() => {
    if (print && memo) setTimeout(() => window.print(), 400);
  }, [print, memo]);

  /** Runs a receipt-generation task with a single toast that always resolves. */
  const withReceipt = async <T,>(
    label: string,
    fn: (el: HTMLElement) => Promise<T>,
  ): Promise<T | undefined> => {
    if (!printRef.current || !memo || busy) return;
    const tid = toast.loading(label);
    setBusy(true);
    try {
      const out = await fn(printRef.current);
      toast.dismiss(tid);
      return out;
    } catch (e) {
      console.error("[receipt]", e);
      toast.error("Could not generate the receipt", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const download = async (fmt: "pdf" | "png") => {
    if (!memo) return;
    const blob = await withReceipt(
      fmt === "pdf" ? "Generating PDF…" : "Generating image…",
      (el) => (fmt === "pdf" ? buildPdfBlob(el) : buildImageBlob(el)),
    );
    if (!blob) return;
    saveBlob(blob, `${memo.memoNumber}.${fmt}`);
    toast.success(fmt === "pdf" ? "PDF downloaded" : "Image downloaded");
  };

  const shareWhatsApp = async () => {
    if (!memo) return;
    const blob = await withReceipt("Preparing receipt…", buildPdfBlob);
    if (!blob) return;
    const file = new File([blob], `${memo.memoNumber}.pdf`, { type: "application/pdf" });
    const text = `Dispatch Memo #${memo.memoNumber} — ${settings?.companyName ?? "Sahil Road Lines"}`;
    const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof n.share === "function" && n.canShare?.({ files: [file] })) {
      try { await n.share({ files: [file], title: text, text }); toast.success("Shared"); return; }
      catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    }
    saveBlob(blob, `${memo.memoNumber}.pdf`);
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " (PDF attached — please select it from your Downloads folder)")}`, "_blank");
    toast.success("Receipt downloaded — attach it in the WhatsApp window that opened");
  };

  const shareEmail = async () => {
    if (!memo) return;
    const blob = await withReceipt("Preparing receipt…", buildPdfBlob);
    if (!blob) return;
    saveBlob(blob, `${memo.memoNumber}.pdf`);
    const subject = `Dispatch Memo #${memo.memoNumber}`;
    const body = `Dear Sir/Madam,\n\nPlease find attached dispatch memo #${memo.memoNumber} dated ${formatDate(memo.dispatchDate)}.\n\nDestination: ${memo.toLocation}\nMaterial: ${memo.materialName}\nNet Freight: ${formatMoney(memo.netFreight)}\n\nRegards,\n${settings?.companyName ?? "Sahil Road Lines"}\n${settings?.phone ?? ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success("Receipt downloaded — attach it to the email that opened");
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
          <Button variant="outline" onClick={shareWhatsApp}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
          <Button variant="outline" onClick={shareEmail}><Mail className="mr-1 h-4 w-4" />Email</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="mr-1 h-4 w-4" />Download<ChevronDown className="ml-1 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => download("pdf")}>PDF (.pdf)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("png")}>Image (.png)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
        </>
      }
    >
      <div className="mx-auto max-w-[820px]">
        {/* A4 portrait: 210mm x 297mm ≈ 794px x 1123px at 96dpi */}
        <div
          ref={printRef}
          className="print-area mx-auto bg-white text-black shadow"
          style={{ width: "794px", height: "1123px", boxSizing: "border-box", padding: "24px", display: "flex", flexDirection: "column" }}
        >
          <div className="flex flex-1 flex-col border-2 border-black" style={{ minHeight: 0 }}>
            {/* Header — CENTERED */}
            <div className="border-b-2 border-black px-4 py-3">
              <div className="flex items-center justify-center gap-4">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-32 w-32 object-contain" alt="logo" />
                ) : (
                  <div className="flex h-28 w-28 rotate-45 items-center justify-center bg-[#0b2a55]">
                    <div className="h-9 w-9 rotate-45 bg-white" />
                  </div>
                )}
                <div className="text-center">
                  <div className="text-[26px] font-extrabold leading-tight tracking-tight">{settings?.companyName ?? "SAHIL ROAD LINES"}</div>
                  <div className="text-[12px] italic text-gray-800">Transport Contractors &amp; Commission Agents</div>
                  <div className="mt-1 text-[11.5px]">{settings?.address}</div>
                  <div className="text-[11.5px]">Ph: {settings?.phone}{settings?.gst ? ` · GST: ${settings.gst}` : ""}</div>
                  <div className="text-[11.5px] font-semibold">{settings?.jurisdictionText}</div>
                </div>
              </div>
              <div className="mt-3 flex items-stretch justify-between border-t border-black pt-2">
                <div><span className="text-[11.5px]">Memo No.: </span><span className="text-[15px] font-black">{memo.memoNumber}</span></div>
                <div><span className="text-[11.5px]">Date: </span><span className="text-[13px] font-bold">{formatDate(memo.dispatchDate)}</span></div>
              </div>
            </div>

            {/* Trip Info block */}
            <div className="grid grid-cols-2 border-b-2 border-black">
              <div className="border-r-2 border-black">
                <Cell label="From" value={memo.fromLocation} />
                <Cell label="Destination" value={memo.toLocation} />
                <Cell label="Transport Name" value={memo.transportName} />
                <Cell label="Material" value={memo.materialName} />
                <Cell label="Description" value={memo.description} />
              </div>
              <div>
                <Cell label="Truck Number" value={truck?.truckNumber} />
                <Cell label="Lorry Owner Name" value={memo.ownerName} />
                <Cell label="Driver Name" value={memo.driverName} />
                <Cell label="Consignee" value={consignee?.companyName} />
                <Cell label="Consignor" value={<span className="font-normal text-gray-400">__________________</span>} />
              </div>
            </div>

            {/* Financial ledger */}
            <div className="grid grid-cols-2 border-b-2 border-black">
              <div className="border-r-2 border-black">
                <Cell label="Rate / Ton" value={formatMoney(memo.ratePerTon)} />
                <Cell label="Weight (tons)" value={memo.weightTons} />
                <Cell label="Net Freight" value={formatMoney(memo.netFreight)} />
                <Cell label="Advance" value={formatMoney(memo.advance)} />
                <Cell label="Balance" value={formatMoney(memo.balance)} />
                <Cell label="Paid At" value={`${memo.paidBy}${memo.paymentMethod ? " · " + memo.paymentMethod : ""}`} />
              </div>
              <div>
                <Cell label="Balance" value={formatMoney(memo.balance)} />
                <Cell label="Commission" value={formatMoney(memo.commission)} />
                <Cell label="Loading Charges" value={formatMoney(memo.loadingCharges)} />
                <Cell label="Goods Mamuli" value={formatMoney(memo.goodsMamuli)} />
                <Cell label="TDS" value={formatMoney(memo.tds)} />
                <Cell label="Total Expenses" value={formatMoney(memo.totalExpenses)} />
              </div>
            </div>

            {/* Final payable + Remarks */}
            <div className="grid grid-cols-2 border-b-2 border-black">
              <div className="border-r-2 border-black">
                <Cell label="Final Payable" value={<span className="text-[15px]">{formatMoney(memo.finalPayable)}</span>} />
              </div>
              <div>
                <Cell label="Remarks" value={memo.remarks} />
              </div>
            </div>

            {/* Notice */}
            <div className="border-b-2 border-black bg-red-50 px-3 py-2 text-center text-[13px] font-bold text-red-700">
              Goods Receipt should be arrived within 15 days.
            </div>

            {/* Terms — larger, fills remaining space */}
            <div className="flex-1 px-3 py-2" style={{ minHeight: 0 }}>
              <div className="mb-1 text-[13px] font-bold uppercase tracking-wider">Terms &amp; Conditions</div>
              <pre className="whitespace-pre-wrap font-sans text-[16px] leading-[1.45] text-black">{settings?.terms}</pre>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 border-t-2 border-black text-center text-[12px]">
              <div className="border-r-2 border-black px-2 pb-2 pt-8">
                <div className="mt-2 border-t border-black pt-1 font-semibold">Driver Signature</div>
              </div>
              <div className="border-r-2 border-black px-2 pb-2 pt-8">
                <div className="mt-2 border-t border-black pt-1 font-semibold">Office Signature</div>
              </div>
              <div className="px-2 pb-2 pt-8">
                <div className="mt-2 border-t border-black pt-1 font-semibold">Company Stamp</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; box-shadow: none !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </AppShell>
  );
}
