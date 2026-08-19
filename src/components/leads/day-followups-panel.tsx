"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Search, Plus, X } from "lucide-react";

export interface FollowupChip {
  id: string;
  lead_id: string;
  lead_name: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  completed_at: string | null;
}

interface LeadSearchResult {
  id: string;
  client_name: string;
  client_phone: string | null;
}

interface DayFollowupsPanelProps {
  date: string;
  entries: FollowupChip[];
}

/**
 * The actual "add a follow-up + list of this day's follow-ups" content —
 * used both inline (Day view) and inside the slide-over (Month/Week view's
 * DayFollowupsDrawer), so the interactive logic lives in exactly one place.
 */
export function DayFollowupsPanel({ date, entries }: DayFollowupsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState(entries);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-follow-up form
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<LeadSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const query = leadQuery.trim();
    if (!query) {
      setLeadResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/leads?q=${encodeURIComponent(query)}&limit=8`);
        const json = await res.json();
        if (res.ok && json.success) setLeadResults(json.data.leads as LeadSearchResult[]);
      } catch {
        // Best-effort — leave results as-is on a transient failure.
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [leadQuery]);

  async function handleToggle(entry: FollowupChip) {
    setTogglingId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${entry.lead_id}/followups/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !entry.completed_at }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update follow-up");
        return;
      }
      setItems((prev) =>
        prev.map((p) => (p.id === entry.id ? { ...p, completed_at: json.data.followup.completed_at } : p))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate() {
    if (!selectedLead) {
      setError("Pick a lead first.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${selectedLead.id}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_up_date: date,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to add follow-up");
        return;
      }
      const created = { ...(json.data.followup as FollowupChip), lead_name: selectedLead.client_name };
      setItems((prev) => [created, ...prev]);
      setSelectedLead(null);
      setLeadQuery("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add follow-up */}
      <div className="rounded-lg border border-border p-3 space-y-2.5">
        <p className="text-xs font-semibold text-foreground">Add follow-up for this day</p>
        {selectedLead ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface border border-border">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedLead.client_name}</p>
              {selectedLead.client_phone && (
                <p className="text-xs text-text-muted font-mono">{selectedLead.client_phone}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedLead(null)}
              className="text-text-muted hover:text-error transition-colors shrink-0"
              aria-label="Change lead"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
              placeholder="Search lead by name or phone…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {leadQuery.trim() && (
              <div className="mt-1.5 rounded-lg border border-border bg-surface-elevated overflow-hidden max-h-48 overflow-y-auto">
                {searching ? (
                  <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
                ) : leadResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-text-muted">No leads match.</div>
                ) : (
                  leadResults.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setSelectedLead(l);
                        setLeadQuery("");
                        setLeadResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-surface transition-colors"
                    >
                      <p className="text-sm text-foreground truncate">{l.client_name}</p>
                      {l.client_phone && <p className="text-xs text-text-muted font-mono">{l.client_phone}</p>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !selectedLead}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2} />}
            Add
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No follow-ups this day yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((e) => {
            const done = Boolean(e.completed_at);
            return (
              <li key={e.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/leads/${e.lead_id}`}
                    className={`text-sm font-semibold hover:text-primary-hover ${
                      done ? "text-text-muted line-through" : "text-primary"
                    }`}
                  >
                    {e.lead_name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleToggle(e)}
                    disabled={togglingId === e.id}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border shrink-0 transition-colors ${
                      done
                        ? "bg-success/10 border-success/40 text-success hover:bg-success/20"
                        : "border-border text-text-muted hover:border-primary hover:text-primary"
                    }`}
                  >
                    {togglingId === e.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} strokeWidth={3} />
                    )}
                    {done ? "Done" : "Mark done"}
                  </button>
                </div>
                {e.logged_by && <div className="text-xs text-text-muted mt-0.5">{e.logged_by}</div>}
                {e.note && (
                  <p className={`text-sm mt-1 ${done ? "text-text-muted/70" : "text-text-muted"}`}>{e.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
