import { useState } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Per-column date filter using a real calendar picker (react-day-picker).
 * The filter state is a single YYYY-MM-DD key derived via toDateKey(), so the
 * comparison is always against the stored date exactly as the column displays
 * it. Selecting a date only changes the local filter — it never touches the
 * memo/entry data. Clearing restores the full set.
 */
export function DateColumnFilter({
  label,
  value,
  onApply,
}: {
  label: string;
  value: string | null;
  onApply: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  const apply = (dk: string | null) => {
    onApply(dk);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter by ${label}`}
          title={`Filter by ${label}`}
          className={cn("ml-1 rounded p-0.5 hover:bg-muted", value && "text-blue-600")}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-semibold text-muted-foreground">Match date</span>
          <span className="text-xs font-bold text-blue-600">{value ? formatDate(value + "T00:00:00") : "Any"}</span>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => apply(d ? toDateKey(d) : null)}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => apply(null)}>Clear</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}