import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ColumnFilter({
  values,
  selected,
  onApply,
}: {
  values: string[];
  selected: Set<string> | null; // null = all
  onApply: (next: Set<string> | null) => void;
}) {
  const unique = useMemo(() => Array.from(new Set(values.map((v) => v || "—"))).sort(), [values]);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set(selected ?? unique));
  const shown = unique.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
  const active = selected !== null && selected.size !== unique.length;

  return (
    <Popover onOpenChange={(o) => { if (o) setDraft(new Set(selected ?? unique)); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("ml-1 rounded p-0.5 hover:bg-muted", active && "text-blue-600")}>
          <Filter className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-9" />
        <div className="mb-2 flex gap-2 text-xs">
          <button className="text-blue-600 hover:underline" onClick={() => setDraft(new Set(unique))}>Select all</button>
          <button className="text-blue-600 hover:underline" onClick={() => setDraft(new Set())}>Clear</button>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {shown.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <Checkbox
                checked={draft.has(v)}
                onCheckedChange={(c) => {
                  const n = new Set(draft);
                  if (c) n.add(v); else n.delete(v);
                  setDraft(n);
                }}
              />
              <span className="truncate">{v}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onApply(null)}>Reset</Button>
          <Button size="sm" onClick={() => onApply(draft.size === unique.length ? null : draft)}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
