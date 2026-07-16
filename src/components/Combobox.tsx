import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No results",
  className,
  allowCustom = false,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const display = current?.label ?? (allowCustom ? value : "");

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
          <CommandInput placeholder="Type to search…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {allowCustom && query ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Use "<span className="font-semibold">{query}</span>"
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
