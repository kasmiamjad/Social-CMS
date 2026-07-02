"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export interface FilterSelectConfig {
  /** URL param this select drives (e.g. "source", "status", "warranty"). */
  param: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
}

interface TableFiltersProps {
  searchPlaceholder?: string;
  selects?: FilterSelectConfig[];
}

const selectCls =
  "px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

/**
 * Generic search + dropdown filters for a server-paginated table. Drives the
 * page via URL params (?q + each select's param); any change resets ?page.
 * Search is debounced so it doesn't navigate on every keystroke.
 */
export function TableFilters({ searchPlaceholder = "Search…", selects = [] }: TableFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change goes back to page 1
    router.push(`${pathname}?${next.toString()}`);
  }

  // Debounced search — only navigates when the query actually changed.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParam("q", q.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {selects.map((sel) => (
        <select
          key={sel.param}
          aria-label={sel.ariaLabel}
          value={params.get(sel.param) ?? ""}
          onChange={(e) => setParam(sel.param, e.target.value)}
          className={selectCls}
        >
          {sel.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
