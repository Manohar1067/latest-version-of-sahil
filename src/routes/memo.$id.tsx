import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getMemo, getTruck, getConsignee, getSettings, type Memo, type FleetTruck, type Consignee, type Settings } from "@/lib/dataStore";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, Pencil, ChevronDown, AlertTriangle, FileText, Phone, Mail, MapPin, Share2, IndianRupee, Weight, Truck, Wallet, Coins, Percent, PackagePlus, Receipt, Banknote, Calculator, User, CreditCard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

type S = { print?: number };
export const Route = createFileRoute("/memo/$id")({
  component: MemoView,
  validateSearch: (s: Record<string, unknown>): S => ({ print: s.print ? 1 : undefined }),
});

/* Fixed document colours — a printed business document must not follow the app theme. */
const NAVY = "#0B2A55";
const RED = "#C1121F";
const LINE = "#D6DAE3";

/** Section heading strip inside a details card. */
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-[6px]"
      style={{ background: NAVY, color: "#fff", fontSize: "15px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase" }}
    >
      {children}
    </div>
  );
}

/** Label / value row: light grey label column, bold dynamic value. */
function Row({ label, value, money, last }: { label: string; value: React.ReactNode; money?: boolean; last?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="flex" style={{ borderBottom: last ? "none" : `1px solid ${LINE}` }}>
      <div
        className="w-[44%] shrink-0 px-3 py-[7px]"
        style={{ background: "#F5F6FA", borderRight: `1px solid ${LINE}`, fontSize: "13.5px", color: "#3A4356" }}
      >
        {label}
      </div>
      <div
        className="flex-1 px-3 py-[7px]"
        style={{ fontSize: money ? "15px" : "14.5px", fontWeight: 700, color: money ? NAVY : "#111" }}
      >
        {empty ? "—" : value}
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

  /** Existing terms text, split into numbered points. Content is never altered. */
  const terms = (settings?.terms ?? "")
    .split(/\r?\n/)
    .map((t) => t.replace(/^\s*(\d+[.)]\s*|[-•*]\s*)/, "").trim())
    .filter(Boolean);



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

  const shareText = () =>
    `${settings?.companyName ?? "Sahil Road Lines"}\nMemo ${memo?.memoNumber}\nDate: ${formatDate(memo?.dispatchDate ?? "")}\nTruck: ${truck?.truckNumber ?? "—"}\nMaterial: ${memo?.materialName ?? "—"}\nFinal Payable: ${formatMoney(memo?.finalPayable ?? 0)}`;

  const shareWhatsApp = async () => {
    if (!memo) return;
    const blob = await withReceipt("Preparing receipt…", (el) => buildPdfBlob(el));
    if (!blob) return;
    const file = new File([blob], `${memo.memoNumber}.pdf`, { type: "application/pdf" });
    const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav2.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: memo.memoNumber, text: shareText() });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to wa.me */
      }
    }
    // Fallback: download the PDF and open WhatsApp with the summary text to attach.
    saveBlob(blob, `${memo.memoNumber}.pdf`);
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank");
    toast.success("PDF downloaded — attach it in WhatsApp");
  };

  const shareEmail = async () => {
    if (!memo) return;
    const blob = await withReceipt("Preparing receipt…", (el) => buildPdfBlob(el));
    if (!blob) return;
    saveBlob(blob, `${memo.memoNumber}.pdf`);
    const subject = `Goods Receipt ${memo.memoNumber}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText())}`;
    toast.success("PDF downloaded — attach it to the email");
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="mr-1 h-4 w-4" />Download<ChevronDown className="ml-1 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => download("pdf")}>PDF (.pdf)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("png")}>Image (.png)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Share2 className="mr-1 h-4 w-4" />Share<ChevronDown className="ml-1 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={shareWhatsApp}>WhatsApp</DropdownMenuItem>
              <DropdownMenuItem onClick={shareEmail}>Email</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[860px] overflow-x-auto">
        {/* A4 portrait canvas: 210mm x 297mm ≈ 794px x 1123px @96dpi */}
        <div
          ref={printRef}
          className="print-area mx-auto bg-white text-black shadow-lg"
          style={{
            width: "794px",
            height: "1123px",
            boxSizing: "border-box",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <div
            className="flex flex-1 flex-col overflow-hidden rounded-md"
            style={{ border: `2px solid ${NAVY}`, minHeight: 0 }}
          >
            {/* ---------------- HEADER ---------------- */}
            <div className="avoid-break flex items-stretch" style={{ borderBottom: `2px solid ${NAVY}` }}>
              <div className="flex w-[120px] shrink-0 items-center justify-center px-2 py-2">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-[92px] w-auto max-w-[110px] object-contain" alt="Company logo" />
                ) : (
                  <div className="flex h-[70px] w-[70px] rotate-45 items-center justify-center" style={{ background: NAVY }}>
                    <div className="h-6 w-6 rotate-45 bg-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-3 py-2 text-center">
                <div style={{ fontSize: "31px", fontWeight: 800, letterSpacing: "-0.3px", color: NAVY, lineHeight: 1.1 }}>
                  {settings?.companyName ?? "SAHIL ROAD LINES"}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: RED }}>
                  Transport Contractor &amp; Commission Agents
                </div>
                <div style={{ fontSize: "13.5px", lineHeight: 1.4 }} className="mt-[2px] text-neutral-800">
                  {settings?.address}
                </div>
                <div style={{ fontSize: "13.5px" }} className="text-neutral-800">
                  Ph: {settings?.phone ?? "—"}{settings?.email ? `  ·  ${settings.email}` : ""}
                </div>
                {settings?.gst && (
                  <div style={{ fontSize: "13.5px" }} className="text-neutral-800">GST: {settings.gst}</div>
                )}
                <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY }}>
                  {settings?.jurisdictionText ?? "Subject to Visakhapatnam Jurisdiction"}
                </div>
              </div>
              <div className="flex w-[200px] shrink-0 flex-col justify-center px-3 py-2" style={{ background: "#F3F5F9", borderLeft: `2px solid ${NAVY}` }}>
                <div
                  className="mb-2 rounded px-2 py-[6px] text-center"
                  style={{ background: RED, color: "#fff", fontSize: "18px", fontWeight: 800, letterSpacing: "1px" }}
                >
                  GOODS RECEIPT
                </div>
                <div className="flex justify-between" style={{ fontSize: "13px" }}>
                  <span className="text-neutral-600">Memo No.</span>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: NAVY }}>{memo.memoNumber}</span>
                </div>
                <div className="mt-1 flex justify-between" style={{ fontSize: "13px" }}>
                  <span className="text-neutral-600">Date</span>
                  <span style={{ fontSize: "13.5px", fontWeight: 700 }}>{formatDate(memo.dispatchDate)}</span>
                </div>
              </div>
            </div>

            {/* ---------------- DETAIL CARDS ---------------- */}
            <div className="avoid-break grid grid-cols-2" style={{ borderBottom: `2px solid ${NAVY}` }}>
              <div style={{ borderRight: `2px solid ${NAVY}` }}>
                <SectionHead>Consignor Details</SectionHead>
                <Row label="From" value={memo.fromLocation} />
                <Row label="Transport Name" value={memo.transportName} />
                <Row label="Material" value={memo.materialName} />
                <Row label="Description" value={memo.description} />
                <Row label="Rate / Ton" value={formatMoney(memo.ratePerTon)} money />
                <Row label="Weight (Tons)" value={memo.weightTons} />
                <Row label="Net Freight" value={formatMoney(memo.netFreight)} money />
                <Row label="Advance" value={formatMoney(memo.advance)} money />
                <Row label="Balance" value={formatMoney(memo.balance)} money />
                <Row label="Paid At" value={`${memo.paidBy}${memo.paymentMethod ? " · " + memo.paymentMethod : ""}`} last />
              </div>
              <div>
                <SectionHead>Consignee / Truck Details</SectionHead>
                <Row label="Truck Number" value={truck?.truckNumber} />
                <Row label="Lorry Owner Name" value={memo.ownerName} />
                <Row label="Driver Name" value={memo.driverName} />
                <Row label="Owner Name" value={memo.ownerName} />
                <Row label="Owner Phone" value={memo.ownerPhone} />
                <Row label="Consignee" value={consignee?.companyName} />
                <Row label="Consignor" value={memo.fromLocation} />
                <Row label="Balance" value={formatMoney(memo.balance)} money />
                <Row label="Commission" value={formatMoney(memo.commission)} money />
                <Row label="Loading Charges" value={formatMoney(memo.loadingCharges)} money />
                <Row label="Goods Mamuli" value={formatMoney(memo.goodsMamuli)} money />
                <Row label="TDS" value={formatMoney(memo.tds)} money />
                <Row label="Total Expenses" value={formatMoney(memo.totalExpenses)} money />
                <Row label="Remarks" value={memo.remarks} last />
              </div>
            </div>

            {/* ---------------- FINANCIAL / FREIGHT DETAILS ---------------- */}
            <div className="avoid-break" style={{ borderBottom: `2px solid ${NAVY}` }}>
              <SectionHead>Financial / Freight Details</SectionHead>
              <div className="grid grid-cols-4">
                {[
                  { icon: IndianRupee, label: "Rate / Ton", value: formatMoney(memo.ratePerTon), strong: true },
                  { icon: Weight, label: "Weight", value: `${memo.weightTons ?? 0} T` },
                  { icon: Truck, label: "Net Freight", value: formatMoney(memo.netFreight), strong: true },
                  { icon: Wallet, label: "Advance", value: formatMoney(memo.advance) },
                  { icon: Coins, label: "Balance", value: formatMoney(memo.balance), strong: true },
                  { icon: Percent, label: "Commission", value: formatMoney(memo.commission) },
                  { icon: PackagePlus, label: "Loading Charges", value: formatMoney(memo.loadingCharges) },
                  { icon: Receipt, label: "TDS", value: formatMoney(memo.tds) },
                  { icon: Banknote, label: "Goods Mamuli", value: formatMoney(memo.goodsMamuli) },
                  { icon: Calculator, label: "Total Expenses", value: formatMoney(memo.totalExpenses), strong: true },
                  { icon: User, label: "Paid By", value: memo.paidBy || "—" },
                  { icon: CreditCard, label: "Payment Mode", value: memo.paymentMethod || "—" },
                ].map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.label}
                      className="flex items-center gap-2 px-3 py-[7px]"
                      style={{
                        borderRight: (i + 1) % 4 === 0 ? "none" : `1px solid ${LINE}`,
                        borderBottom: i < 8 ? `1px solid ${LINE}` : "none",
                      }}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: NAVY }} />
                      <div className="min-w-0">
                        <div style={{ fontSize: "11.5px", color: "#5A637A", lineHeight: 1.2 }}>{c.label}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: c.strong ? RED : NAVY, lineHeight: 1.25 }} className="truncate">
                          {c.value}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ---------------- FINAL PAYABLE ---------------- */}
            <div className="avoid-break px-4 py-[9px] text-center" style={{ background: "#FDECEE", borderBottom: `2px solid ${NAVY}` }}>
              <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "1px", color: NAVY }}>FINAL PAYABLE</div>
              <div style={{ fontSize: "30px", fontWeight: 900, color: RED, lineHeight: 1.15 }}>{formatMoney(memo.finalPayable)}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
                (Rupees {amountInWords(memo.finalPayable)} Only)
              </div>
              <div className="mt-[3px] inline-flex items-center gap-1" style={{ fontSize: "12.5px", fontWeight: 700, color: RED }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Goods Receipt should be arrived within 15 days.
              </div>
            </div>

            {/* ---------------- TERMS ---------------- */}
            <div className="avoid-break flex flex-1 flex-col px-4 py-2" style={{ minHeight: 0 }}>
              <div className="mb-1 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: NAVY }} />
                <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.8px", color: NAVY }}>
                  TERMS &amp; CONDITIONS
                </span>
              </div>
              <div style={{ height: "1px", background: LINE }} className="mb-[5px]" />
              <ol className="list-decimal pl-5" style={{ fontSize: "12.5px", lineHeight: 1.45 }}>
                {terms.map((t, i) => (
                  <li key={i} className="mb-[1px] text-neutral-900">{t}</li>
                ))}
              </ol>
            </div>

            {/* ---------------- SIGNATURES ---------------- */}
            <div className="avoid-break grid grid-cols-3 text-center" style={{ borderTop: `2px solid ${NAVY}` }}>
              {["Driver Signature", "Office Signature", "Company Stamp"].map((s, i) => (
                <div key={s} className="px-3 pb-[6px] pt-[46px]" style={i < 2 ? { borderRight: `1px solid ${LINE}` } : undefined}>
                  <div style={{ borderTop: `1px solid ${NAVY}`, fontSize: "13px", fontWeight: 700, color: NAVY }} className="pt-1">
                    {s}
                  </div>
                </div>
              ))}
            </div>

            {/* ---------------- FOOTER ---------------- */}
            <div
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 py-[7px] text-center"
              style={{ background: NAVY, color: "#fff", fontSize: "12px" }}
            >
              <span className="font-bold">{settings?.companyName ?? "SAHIL ROAD LINES"}</span>
              {settings?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{settings.phone}</span>}
              {settings?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{settings.email}</span>}
              {settings?.gst && <span>GST: {settings.gst}</span>}
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />{settings?.jurisdictionText ?? "Subject to Visakhapatnam Jurisdiction"}
              </span>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute; inset: 0;
            box-shadow: none !important; margin: 0 !important;
            width: 194mm !important; height: 281mm !important;
            padding: 0 !important; border-radius: 0 !important;
            overflow: hidden;
          }
          .print-area .rounded-md { border-radius: 0 !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </AppShell>
  );
}

