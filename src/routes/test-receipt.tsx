import { createFileRoute } from "@tanstack/react-router";
import { ReceiptPage } from "./memo.$id";
import type { Memo, Settings } from "@/lib/dataStore";

export const Route = createFileRoute("/test-receipt")({
  component: TestReceipt,
});

const mockMemo: Memo = {
  id: "mock-1",
  memoNumber: "0001",
  dispatchDate: "2026-08-28",
  fromLocation: "kerala",
  toLocation: "karnataka",
  transportName: "Kareem Transports",
  consigneeId: "mock-c",
  truckId: "mock-t",
  truckNumber: "ap12we2345",
  consigneeName: "Kareem Transports",
  driverName: "werty",
  ownerName: "mnbvc",
  ownerPhone: "",
  materialName: "bags",
  weightTons: 12,
  ratePerTon: 5000,
  netFreight: 60000,
  description: "General goods",
  advance: 4000,
  balance: 10000,
  commission: 2000,
  loadingCharges: 3000,
  tds: 1000,
  goodsMamuli: 1000,
  totalExpenses: 20000,
  gcNo: "GC-0099",
  totalHire: 46000,
  paidAt: "28 Aug 2026",
  localDriverGuide: 1000,
  paidBy: "Sahil",
  paymentMethod: "Cash",
  finalPayable: 46000,
  finalPaymentDate: "2026-09-05",
  status: "Dispatched",
  isDraft: false,
  isDeleted: false,
  createdAt: "2026-08-28",
  updatedAt: "2026-08-28",
};

const mockSettings: Settings = {
  companyName: "SAHIL ROAD LINES",
  address: "D.No. 5-2-3, Main Road, Visakhapatnam - 530001",
  phone: "9988776655",
  email: "sahil111tms@gmail.com",
  website: "www.sahiiroadlines.in",
  logoUrl: "",
  gst: "gstascwerghjytrdsa",
  jurisdictionText: "Subject to Visakhapatnam Jurisdiction",
  terms: "",
  darkMode: false,
};

function TestReceipt() {
  const ref = { current: null as HTMLDivElement | null };
  return (
    <div className="mx-auto p-4" style={{ background: "#e5e5e5" }}>
      <ReceiptPage
        ref={ref}
        memo={mockMemo}
        settings={mockSettings}
        truck={{ id: "mock-t", truckNumber: "ap12we2345", ownerName: "mnbvc", ownerPhone: "", driverName: "werty", driverPhone: "" }}
        consignee={{ id: "mock-c", companyName: "Kareem Transports", address: "", contactPerson: "", phone: "", city: "", state: "" }}
        terms={[
          "The material is received in good condition.",
          "The driver is responsible for safe delivery.",
        ]}
      />
    </div>
  );
}