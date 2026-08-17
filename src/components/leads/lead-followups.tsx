"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_MEMBERS, getActingAs } from "@/lib/team";
import { Calendar, Plus, Trash2, Loader2, Check } from "lucide-react";

export interface Followup {
  id: string;
  follow_up_date: string;
  note: string | null;
  logged_by: string | null;
  created_at: string;
  completed_at: string | null;
}

interface LeadFollowupsProps {
  leadId: string;
  initialFollowups: Followup[];
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A running log of follow-up attempts for a lead — add new entries, see past ones. */
export function LeadFollowups({ leadId, initialFollowups }: LeadFollowupsProps) {
  const [followups, setFollowups] = useState<Followup[]>(initialFollowups);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [loggedBy, setLoggedBy] = useState(() => getActingAs() ?? "");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_up_date: date,
          note: note.trim() || null,
          logged_by: loggedBy || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to add follow-up");
        return;
      }
      setFollowups((prev) =>
        [json.data.followup as Followup, ...prev].sort((a, b) =>
          b.follow_up_date === a.follow_up_date
            ? b.created_at.localeCompare(a.created_at)
            : b.follow_up_date.localeCompare(a.follow_up_date)
        )
      );
      setNote("");
      setDate(todayIso());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/followups/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to delete follow-up");
        return;
      }
      setFollowups((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleDone(f: Followup) {
    setTogglingId(f.id);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/followups/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !f.completed_at }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update follow-up");
        return;
      }
      setFollowups((prev) =>
        prev.map((p) => (p.id === f.id ? (json.data.followup as Followup) : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-ups</CardTitle>
        <CardDescription>Log each time you follow up on this lead.</CardDescription>
      </CardHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input
            id="followup_date"
            label="Date"
            type="date"
            icon={Calendar}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Logged by</label>
            <select
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">(unspecified)</option>
              {TEAM_MEMBERS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={handleAdd} loading={saving} className="sm:justify-self-start">
            <Plus size={14} strokeWidth={2} />
            Add follow-up
          </Button>
        </div>
        <Textarea
          id="followup_note"
          label="Note"
          rows={2}
          placeholder="e.g. Asked for a quote by Thursday, will call back."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-xs text-error">{error}</p>}

        {followups.length === 0 ? (
          <p className="text-sm text-text-muted">No follow-ups logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {followups.map((f) => {
              const done = Boolean(f.completed_at);
              return (
                <li key={f.id} className="py-3 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(f)}
                    disabled={togglingId === f.id}
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    title={done ? "Mark as not done" : "Mark as done"}
                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      done
                        ? "bg-success border-success text-white"
                        : "border-border text-transparent hover:border-primary"
                    }`}
                  >
                    {togglingId === f.id ? (
                      <Loader2 size={12} className="animate-spin text-text-muted" />
                    ) : (
                      <Check size={12} strokeWidth={3} />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${done ? "text-text-muted line-through" : "text-foreground"}`}>
                      {DATE_FMT.format(new Date(f.follow_up_date))}
                      {f.logged_by && <span className="text-text-muted font-normal"> · {f.logged_by}</span>}
                    </div>
                    {f.note && (
                      <p className={`text-sm mt-0.5 ${done ? "text-text-muted/70 line-through" : "text-text-muted"}`}>
                        {f.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(f.id)}
                    disabled={deletingId === f.id}
                    className="text-text-muted hover:text-error transition-colors shrink-0"
                    aria-label="Delete follow-up"
                  >
                    {deletingId === f.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} strokeWidth={1.8} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
