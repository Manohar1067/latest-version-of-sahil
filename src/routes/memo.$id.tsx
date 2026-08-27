import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getMemo, getTruck, getConsignee, getSettings, type Memo, type FleetTruck, type Consignee, type Settings } from "@/lib/dataStore";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, Pencil, ChevronDown, AlertTriangle, FileText, Phone, Mail, MapPin, Share2, IndianRupee, Weight, Truck, Wallet, Coins, Percent, PackagePlus, Receipt, Banknote, Calculator, User, CreditCard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div
      className="px-3 py-[3px]"
      style={{ background: NAVY, color: "#fff", fontSize: "13px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase" }}
    >
      {children}
    </div>
  );
}

/** Label / value row: light grey label column, bold dynamic value. */
function Row({ label, value, money, last }: { label: string; value: ReactNode; money?: boolean; last?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="flex" style={{ borderBottom: last ? "none" : `1px solid ${LINE}` }}>
      <div
        className="w-[44%] shrink-0 px-3 py-[4px]"
        style={{ background: "#F5F6FA", borderRight: `1px solid ${LINE}`, fontSize: "12.5px", color: "#3A4356" }}
      >
        {label}
      </div>
      <div
        className="flex-1 px-3 py-[4px]"
        style={{ fontSize: money ? "14px" : "13.5px", fontWeight: 700, color: money ? NAVY : "#111" }}
      >
        {empty ? "—" : value}
      </div>
    </div>
  );
}

/** Indian-system number to words, display-only (does not alter any calculation). */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")).trim();
}
function amountInWords(value: number | null | undefined): string {
  let n = Math.round(Number(value ?? 0));
  if (!isFinite(n) || n <= 0) return "Zero";
  const parts: string[] = [];
  const units: Array<[number, string]> = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [100, "Hundred"]];
  for (const [div, name] of units) {
    const q = Math.floor(n / div);
    if (q > 0) {
      parts.push(`${div >= 1000 ? amountInWords(q) : twoDigits(q)} ${name}`);
      n %= div;
    }
  }
  if (n > 0) parts.push(twoDigits(n));
  return parts.join(" ").trim();
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

/**
 * The Goods Receipt document.
 *
 * Rendered ONLY so it can be lifted to a portal on <body> (see MemoView). Being
 * a direct child of <body> — outside #root and outside AppShell's flex/grid
 * layout tree — means no ancestor (ml-60 sidebar spacer, px-8 main padding,
 * max-w container, any transform/zoom/flex-shrink) can constrain or shrink it.
 * The single navy border IS the full 210mm x 297mm A4 canvas.
 */
const ReceiptPage = forwardRef<
  HTMLDivElement,
  {
    memo: Memo;
    settings: Settings;
    truck?: FleetTruck;
    consignee?: Consignee;
    terms: string[];
  }
>(function ReceiptPage({ memo, settings, truck, consignee, terms }, ref) {
  return (
    <div
      ref={ref}
      className="print-area"
      style={{
        width: "794px",
        height: "1123px",
        boxSizing: "border-box",
        padding: "24px",
        background: "#ffffff",
        color: "#000",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* The visible receipt — the navy border lives HERE, inset ~6mm from the paper edge. */}
      <div
        className="print-receipt"
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#000",
          border: `2px solid ${NAVY}`,
          overflow: "visible",
        }}
      >
      {/* ---------------- HEADER (logo | identity | receipt meta) ---------------- */}
      <div className="avoid-break flex items-stretch" style={{ borderBottom: `2px solid ${NAVY}` }}>
        <div className="flex w-[120px] shrink-0 items-center justify-center px-2 py-[10px]">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} className="h-[76px] w-auto max-w-[104px] object-contain" alt="Company logo" />
          ) : (
            <div className="flex h-[56px] w-[56px] rotate-45 items-center justify-center" style={{ background: NAVY }}>
              <div className="h-5 w-5 rotate-45 bg-white" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-[10px] text-center">
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.3px", color: NAVY, lineHeight: 1.05 }}>
            {settings.companyName || "SAHIL ROAD LINES"}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 650, color: RED }}>
            Transport Contractor &amp; Commission Agents
          </div>
          <div style={{ fontSize: "12px", lineHeight: 1.25 }} className="text-neutral-800">
            {settings.address}
          </div>
          <div style={{ fontSize: "12px" }} className="text-neutral-800">
            Ph: {settings.phone || "—"}
            {settings.email ? `  ·  ${settings.email}` : ""}
          </div>
          {settings.gst && (
            <div style={{ fontSize: "12px" }} className="text-neutral-800">GST: {settings.gst}</div>
          )}
          <div style={{ fontSize: "11.5px", fontWeight: 700, color: NAVY }}>
            {settings.jurisdictionText || "Subject to Visakhapatnam Jurisdiction"}
          </div>
        </div>
        <div
          className="flex w-[190px] shrink-0 flex-col justify-center gap-[6px] px-3 py-[10px]"
          style={{ background: "#F2F5FA", borderLeft: `2px solid ${NAVY}` }}
        >
          <div
            className="rounded px-2 py-[5px] text-center"
            style={{ background: RED, color: "#fff", fontSize: "17px", fontWeight: 800, letterSpacing: "1px" }}
          >
            GOODS RECEIPT
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-neutral-600">Memo No.</span>
            <span className="font-extrabold" style={{ color: NAVY }}>{memo.memoNumber}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-neutral-600">Date</span>
            <span className="font-semibold">{formatDate(memo.dispatchDate)}</span>
          </div>
        </div>
      </div>

      {/* ---------------- CONSIGNOR / CONSIGNEE DETAILS ---------------- */}
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
                className="flex items-center gap-1.5 px-2.5 py-[4px]"
                style={{
                  borderRight: (i + 1) % 4 === 0 ? "none" : `1px solid ${LINE}`,
                  borderBottom: i < 8 ? `1px solid ${LINE}` : "none",
                }}
              >
                <Icon className="h-[13px] w-[13px] shrink-0" style={{ color: NAVY }} />
                <div className="min-w-0">
                  <div style={{ fontSize: "11px", color: "#5A637A", lineHeight: 1.15 }}>{c.label}</div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: c.strong ? RED : NAVY, lineHeight: 1.2 }}>
                    {c.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- FINAL PAYABLE ---------------- */}
      <div
        className="avoid-break px-4 py-[4px] text-center"
        style={{ background: "#FDECEE", borderBottom: `2px solid ${NAVY}` }}
      >
        <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "1.5px", color: NAVY }}>FINAL PAYABLE</div>
        <div style={{ fontSize: "28px", fontWeight: 900, color: RED, lineHeight: 1.05 }}>
          {formatMoney(memo.finalPayable)}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>
          (Rupees {amountInWords(memo.finalPayable)} Only)
        </div>
        <div className="mt-[1px] inline-flex items-center gap-1" style={{ fontSize: "11.5px", fontWeight: 700, color: RED }}>
          <AlertTriangle className="h-[13px] w-[13px] shrink-0" />
          Goods Receipt should be arrived within 15 days.
        </div>
      </div>

      {/* ---------------- TERMS & CONDITIONS (fills remaining vertical space) ---------------- */}
      <div className="avoid-break relative flex flex-1 flex-col px-4 pb-[6px] pt-[6px]" style={{ borderBottom: `2px solid ${NAVY}` }}>
        <div className="mb-[4px] flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: NAVY }} />
          <span style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "1px", color: NAVY }}>
            TERMS &amp; CONDITIONS
          </span>
        </div>
        <div style={{ height: "1px", background: NAVY }} className="mb-[5px]" />
        <ol className="list-decimal pl-6 pr-1" style={{ fontSize: "12.5px", lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "anywhere" }}>
          {terms.length > 0 ? (
            terms.map((t, i) => (
              <li key={i} className="mb-[2px] text-neutral-900">{t}</li>
            ))
          ) : (
            [
              "Goods are dispatched at owner's risk.",
              "Company is not responsible for leakage, breakage or shortage.",
              "All disputes subject to Visakhapatnam jurisdiction only.",
              "Freight to be paid within 15 days of delivery.",
              "Detention charges applicable after 24 hours of unloading.",
            ].map((t, i) => <li key={i} className="mb-[2px] text-neutral-900">{t}</li>)
          )}
        </ol>
      </div>

      {/* ---------------- SIGNATURES ---------------- */}
      <div className="avoid-break grid grid-cols-3 text-center">
        {["Driver Signature", "Office Signature", "Company Stamp"].map((s, i) => (
          <div key={s} className="px-4 pb-[7px] pt-[34px]" style={i < 2 ? { borderRight: `1px solid ${LINE}` } : undefined}>
            <div style={{ borderTop: `1px solid ${NAVY}`, fontSize: "13px", fontWeight: 700, color: NAVY }} className="pt-[6px]">
              {s}
            </div>
          </div>
        ))}
      </div>

      {/* ---------------- FOOTER (inside the outer border) ---------------- */}
      <div
        className="flex items-center justify-center gap-x-3 px-2 py-[7px] text-center"
        style={{ background: NAVY, color: "#fff", fontSize: "11.5px", lineHeight: 1.3, whiteSpace: "nowrap" }}
      >
        <span className="font-bold">{settings.companyName || "SAHIL ROAD LINES"}</span>
        {settings.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{settings.phone}</span>}
        {settings.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{settings.email}</span>}
        {settings.gst && <span>GST: {settings.gst}</span>}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />{settings.jurisdictionText || "Subject to Visakhapatnam Jurisdiction"}
        </span>
      </div>
      </div>
    </div>
  );
});

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

  /** Non-null settings so the shared document always receives a valid value. */
  const safeSettings: Settings = settings ?? {
    companyName: "SAHIL ROAD LINES",
    address: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    gst: "",
    jurisdictionText: "Subject to Visakhapatnam Jurisdiction",
    terms: "",
    darkMode: false,
  };



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
      {/*
        On-screen preview. This element is ALSO the html2canvas source for the
        PDF/PNG/WhatsApp downloads (always visible, so capture is reliable).
      */}
      <div className="print-preview mx-auto w-full max-w-[900px]">
        <div className="mx-auto my-8 overflow-x-auto" style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.18)" }}>
          <ReceiptPage
            ref={printRef}
            memo={memo}
            settings={safeSettings}
            truck={truck}
            consignee={consignee}
            terms={terms}
          />
        </div>
      </div>

      {/*
        Print portal. The SAME receipt, but mounted as a DIRECT child of <body>
        via createPortal — outside #root and outside AppShell's flex/grid layout
        tree. This guarantees no ancestor (ml-60 sidebar spacer, px-8 main
        padding, max-w container, any transform/zoom/flex-shrink) can shrink,
        offset, or clip it during printing, eliminating the blank RIGHT/BOTTOM
        white space. It is hidden on screen and becomes the only printed page.
      */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="print-only" aria-hidden="true">
            <ReceiptPage
              memo={memo}
              settings={safeSettings}
              truck={truck}
              consignee={consignee}
              terms={terms}
            />
          </div>,
          document.body,
        )}

      <style>{`
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }

        /* The print document is hidden on screen; it becomes the ONLY page on print. */
        .print-only { display: none !important; }

        @media print {
          @page { size: A4 portrait; margin: 0; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /*
            Remove the ENTIRE application from the print flow (not just hide it
            visually). display:none takes the app out of layout so the receipt is
            the only in-flow element on the page. This is the key: the app's
            sidebar/main/max-w wrappers can no longer participate in the print
            layout AT ALL.
          */
          body > *:not(.print-only) { display: none !important; }

          /* The portaled print document: a normal-flow block, exactly A4. */
          .print-only {
            display: block !important;
            width: 210mm !important;
            height: 297mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }

          .print-only .print-area {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* The bordered receipt sits inside the inset margin of the A4 page. */
          .print-only .print-receipt {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            overflow: visible !important;
            display: flex !important;
            flex-direction: column !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Keep footer + signatures pinned; only TERMS flexes to fill. */
          .print-only .print-receipt > * { flex-shrink: 0 !important; }
          .print-only .print-receipt > [class*="flex-1"] { flex-shrink: 1 !important; }
        }
      `}</style>
    </AppShell>
  );
}

