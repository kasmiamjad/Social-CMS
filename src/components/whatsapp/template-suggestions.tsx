"use client";

import type { ReplyTemplate } from "@/lib/reply-templates";

interface TemplateSuggestionsProps {
  matches: ReplyTemplate[];
  activeIndex: number;
  onSelect: (template: ReplyTemplate) => void;
}

/** "/" quick-reply autocomplete dropdown, positioned by the parent (relative wrapper). */
export function TemplateSuggestions({ matches, activeIndex, onSelect }: TemplateSuggestionsProps) {
  if (matches.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1.5 w-full max-w-sm rounded-lg border border-border bg-surface-elevated shadow-lg overflow-hidden z-10">
      {matches.map((t, i) => (
        <button
          key={t.id}
          type="button"
          // onMouseDown (not onClick) so this fires before the textarea's blur.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(t);
          }}
          className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${
            i === activeIndex ? "bg-primary/10" : "hover:bg-surface"
          }`}
        >
          <span className="text-xs font-semibold text-primary">/{t.shortcut}</span>
          <span className="text-xs text-text-muted truncate">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
