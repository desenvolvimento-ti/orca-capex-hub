import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Money input with Brazilian formatting: typing digits formats live as
 * thousands-separated with two decimals, prefixed by "R$".
 * The `value`/`onChange` string stays in the "1.234,56" shape that parseBRL reads.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
    if (!digits) {
      onChange("");
      return;
    }
    const formatted = (Number(digits) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    onChange(formatted);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        inputMode="numeric"
        className={cn("pl-9 text-right tabular-nums", className)}
        value={value}
        onChange={handle}
        placeholder="0,00"
        {...props}
      />
    </div>
  );
}
