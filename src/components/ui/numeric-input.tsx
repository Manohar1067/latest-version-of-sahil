import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A text-backed numeric input that fixes the "05000" bug.
 *
 * `<input type="number">` cannot reliably select its content on focus across
 * browsers, so when a field is initialized to 0 and the user types "5000", the
 * caret sits after the 0 and the browser produces "05000". This component
 * renders a `type="text"` input (with a numeric/mobile-friendly keyboard) whose
 * entire current value is selected on focus — so typing immediately replaces
 * the existing "0" and yields "5000", not "05000".
 */
export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Render the empty/zero state as empty instead of "0" (non-payment fields). */
  allowEmpty?: boolean;
}

function formatValue(v: number | null | undefined, allowEmpty: boolean): string {
  if (v === null || v === undefined || (v === 0 && allowEmpty)) return "";
  return String(v);
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onValueChange, allowEmpty = false, inputMode = "decimal", ...props }, ref) => {
    const [text, setText] = React.useState<string>(() => formatValue(value, allowEmpty));

    // Keep the text in sync when the value changes externally (load/edit/clear).
    React.useEffect(() => {
      setText(formatValue(value, allowEmpty));
    }, [value, allowEmpty]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode={inputMode}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow only a valid number (empty, leading minus, digits, one dot).
          if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
          setText(raw);
          if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
            onValueChange(0);
            return;
          }
          const n = Number(raw);
          onValueChange(Number.isFinite(n) ? n : 0);
        }}
        {...props}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
