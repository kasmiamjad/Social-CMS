"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeadsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
}

/**
 * Prev/Next pagination for the Leads list. Preserves the current search/filter
 * params and only changes ?page. Hidden when everything fits on one page.
 */
export function LeadsPagination({ page, totalPages, total }: LeadsPaginationProps) {
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
        Page {Math.min(page, totalPages)} of {totalPages} · {total} lead{total === 1 ? "" : "s"}
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
