"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "whatsapp_ai", label: "WhatsApp" },
  { value: "facebook", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "manual", label: "Manual" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All open" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
];

const selectCls =
  "px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

/**
 * Search + source/status filters for the Leads list. Drives the server page via
 * URL params (?q, ?source, ?status); any change resets to page 1. Search is
 * debounced so it doesn't navigate on every keystroke.
 */
export function LeadsFilters() {
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

  const source = params.get("source") ?? "";
  const status = params.get("status") ?? "";

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
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

      <select value={source} onChange={(e) => setParam("source", e.target.value)} className={selectCls}>
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select value={status} onChange={(e) => setParam("status", e.target.value)} className={selectCls}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
