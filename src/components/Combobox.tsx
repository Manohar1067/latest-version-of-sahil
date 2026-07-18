import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string;
}

/**
 * Searchable combobox with optional inline "create new" support.
 *
 * - `allowCustom`: when true, typing a value not in the list surfaces a
 *   "Use X" entry that emits the raw typed string via onChange.
 * - `onCreate`: when provided, typing a value not in the list surfaces
 *   "Use X" that awaits the callback (which should persist the record
 *   and return the new option's value/id) then calls onChange with it.
 */
export function Combobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  emptyText = "No results",
  className,
  allowCustom = false,
  createLabel = "Use",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  onCreate?: (typed: string) => Promise<string> | string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowCustom?: boolean;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const current = options.find((o) => o.value === value);
  const display = current?.label ?? (allowCustom ? value : "");
  const canCreate = !!onCreate || allowCustom;
  const typedMatchesExisting = options.some(
    (o) => o.label.trim().toLowerCase() === query.trim().toLowerCase(),
  );

  const handleCreate = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      if (onCreate) {
        const newVal = await onCreate(q);
        onChange(newVal);
      } else {
        onChange(q);
      }
      setOpen(false);
      setQuery("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-11 w-full justify-between font-normal", !display && "text-muted-foreground", className)}
        >
          <span className="truncate">{display || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(v, search) => {
            const opt = options.find((o) => o.value === v);
            const hay = `${opt?.label ?? ""} ${opt?.keywords ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Type to search or add new…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {canCreate && query.trim() ? (
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                  onClick={handleCreate}
                >
                  <Plus className="h-4 w-4" />
                  <span>Use "<span className="font-semibold">{query}</span>"</span>
                </button>
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(v) => {
                    onChange(v);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
              {canCreate && query.trim() && !typedMatchesExisting && (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={handleCreate}
                  disabled={busy}
                  className="text-blue-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{query}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}