"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { A360_ACCENT, A360_ACCENT_ON } from "@/types/a360";

const PERIODS = [
  { value: "all", label: "All Time" },
  { value: "1d", label: "Last 1 Day" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
] as const;

/**
 * Drives ?period (+ ?from/?to for a custom range) on the current page,
 * same URL-param-driven pattern as TableFilters.
 */
export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("period") ?? "all";

  function setPeriod(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value === "all") next.delete("period");
    else next.set("period", value);
    next.delete("from");
    next.delete("to");
    router.push(`${pathname}?${next.toString()}`);
  }

  function setCustomRange(from: string, to: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("period", "custom");
    if (from) next.set("from", from);
    else next.delete("from");
    if (to) next.set("to", to);
    else next.delete("to");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => setPeriod(p.value)}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors",
            active !== p.value && "bg-surface text-text-muted hover:text-foreground"
          )}
          style={active === p.value ? { backgroundColor: A360_ACCENT, color: A360_ACCENT_ON } : undefined}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="From date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => setCustomRange(e.target.value, params.get("to") ?? "")}
          className="px-2.5 py-1.5 rounded-full text-xs bg-surface border border-border text-foreground"
        />
        <span className="text-text-muted text-xs">–</span>
        <input
          type="date"
          aria-label="To date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => setCustomRange(params.get("from") ?? "", e.target.value)}
          className="px-2.5 py-1.5 rounded-full text-xs bg-surface border border-border text-foreground"
        />
      </div>
    </div>
  );
}
