"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { A360_STATUS_BADGE_CLASS, A360_STATUS_LABELS, A360_STATUS_VALUES, toA360Status } from "@/types/a360";
import type { A360LeadRow, A360Status } from "@/types/a360";

interface LeadListDetailProps {
  leads: A360LeadRow[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/** "Today", "Tomorrow", or a short date — matches the follow-up date convention elsewhere in the app. */
function formatFollowupDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return new Date(dateStr).toLocaleDateString();
}

export function LeadListDetail({ leads }: LeadListDetailProps) {
  const router = useRouter();
  const [rows, setRows] = useState(leads);
  const [selectedId, setSelectedId] = useState<string | null>(leads[0]?.id ?? null);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<A360Status>("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(leads);
    if (!leads.find((l) => l.id === selectedId)) setSelectedId(leads[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const selected = rows.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setNotesDraft(selected.internal_notes ?? selected.remarks ?? "");
    setStatusDraft(toA360Status(selected.call_status));
    setError(null);
  }, [selected]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_status: statusDraft === "pending" ? "read" : statusDraft,
          internal_notes: notesDraft,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update lead");
        return;
      }
      setRows((prev) =>
        prev.map((l) =>
          l.id === selected.id ? { ...l, call_status: json.data.lead.call_status, internal_notes: notesDraft } : l
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <Card padding={false} className="max-h-[520px] overflow-y-auto">
        {rows.length === 0 && <p className="text-sm text-text-muted p-6">No leads match these filters.</p>}
        {rows.map((lead) => {
          const status = toA360Status(lead.call_status);
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => setSelectedId(lead.id)}
              className={`w-full text-left px-4 py-3 border-b border-border last:border-0 flex items-center justify-between gap-2 transition-colors ${
                selectedId === lead.id ? "bg-surface" : "hover:bg-surface/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {initials(lead.client_name || "?")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.client_name || "Unnamed lead"}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {[lead.city, lead.assigned_to].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${A360_STATUS_BADGE_CLASS[status]}`}>
                {A360_STATUS_LABELS[status]}
              </span>
            </button>
          );
        })}
      </Card>

      <Card>
        {!selected ? (
          <p className="text-sm text-text-muted">Select a lead to view details.</p>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-text-muted">Lead details &amp; notes</p>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-lg font-bold tracking-[-0.8px] font-[family-name:var(--font-heading)] text-foreground">
                    {selected.client_name || "Unnamed lead"}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${A360_STATUS_BADGE_CLASS[toA360Status(selected.call_status)]}`}>
                    {A360_STATUS_LABELS[toA360Status(selected.call_status)]}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-text-muted">
                <p>
                  Sales Agent <span className="text-foreground font-medium">{selected.assigned_to || "Unassigned"}</span>
                </p>
                <p>
                  Follow-up{" "}
                  <span className="text-foreground font-medium">
                    {selected.next_followup_date ? formatFollowupDate(selected.next_followup_date) : "None scheduled"}
                  </span>
                </p>
                {selected.city && <p>{selected.city}</p>}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-success font-semibold mb-1.5">
                Internal Comments &amp; Agent Notes
              </p>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Add a note…"
              />
            </div>

            {error && <p className="text-xs text-error mt-2">{error}</p>}

            <div className="flex items-end justify-between gap-4 flex-wrap mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Date Logged</p>
                <p className="text-sm text-foreground">{new Date(selected.created_at).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as A360Status)}
                  className="px-3 py-2 rounded-lg border border-border bg-surface-elevated text-foreground text-sm"
                >
                  {A360_STATUS_VALUES.filter((s) => s !== "pending").map((s) => (
                    <option key={s} value={s}>
                      {A360_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <Button onClick={handleSave} loading={saving} variant="cta">
                  Update Lead Status
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
