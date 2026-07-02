"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** Noun for the count label, e.g. "lead", "booking", "customer". */
  noun?: string;
}

/**
 * Prev/Next pagination for a server-paginated table. Preserves the current
 * search/filter params and only changes ?page. Hidden when nothing to show.
 */
export function TablePagination({ page, totalPages, total, noun = "result" }: TablePaginationProps) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefFor(p: number): string {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }

  if (total === 0) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <span className="text-xs text-text-muted">
        Page {Math.min(page, totalPages)} of {totalPages} · {total} {noun}
        {total === 1 ? "" : "s"}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <PageButton href={hrefFor(page - 1)} disabled={!hasPrev} label="Previous">
            <ChevronLeft size={15} strokeWidth={1.8} />
            Prev
          </PageButton>
          <PageButton href={hrefFor(page + 1)} disabled={!hasNext} label="Next">
            Next
            <ChevronRight size={15} strokeWidth={1.8} />
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium transition-colors";
  if (disabled) {
    return (
      <span className={`${cls} text-text-muted/50 cursor-not-allowed`} aria-disabled>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${cls} text-foreground hover:bg-surface`}>
      {children}
    </Link>
  );
}
