import { cn } from "@/lib/utils";
import type { MemoStatus } from "@/lib/dataStore";

const map: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Delivered: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Running: "bg-blue-100 text-blue-800 ring-blue-200",
  Dispatched: "bg-blue-100 text-blue-800 ring-blue-200",
  "LR Received": "bg-indigo-100 text-indigo-800 ring-indigo-200",
  "LR Submitted": "bg-violet-100 text-violet-800 ring-violet-200",
  "Payment Pending": "bg-orange-100 text-orange-800 ring-orange-200",
  Pending: "bg-orange-100 text-orange-800 ring-orange-200",
  Cancelled: "bg-red-100 text-red-800 ring-red-200",
  Available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Maintenance: "bg-orange-100 text-orange-800 ring-orange-200",
  Inactive: "bg-gray-200 text-gray-700 ring-gray-300",
};

export function StatusBadge({ status }: { status: MemoStatus | string }) {
  const cls = map[status] ?? "bg-gray-100 text-gray-800 ring-gray-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        cls,
      )}
    >
      {status}
    </span>
  );
}
