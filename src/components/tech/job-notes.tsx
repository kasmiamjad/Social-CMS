"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

interface JobNotesProps {
  bookingId: string;
  initialNotes: string | null;
}

/**
 * Editable working-notes field for the technician on the job detail screen.
 * Saves to the booking's `tech_notes` via the tech-scoped PATCH (allowed even on
 * completed/cancelled jobs). The Save button enables only when the text changed.
 */
export function JobNotes({ bookingId, initialNotes }: JobNotesProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = notes.trim() !== (initialNotes ?? "").trim();

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tech/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tech_notes: notes.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "Could not save notes.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={4}
        maxLength={4000}
        placeholder="Describe the job, site conditions, what you did, parts used…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {error && <div className="rounded-lg bg-error/10 text-error text-xs px-3 py-2">{error}</div>}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={save}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-black text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {saving ? (
          <Loader2 size={15} className="animate-spin" />
        ) : saved ? (
          <Check size={15} strokeWidth={1.8} />
        ) : null}
        {saved ? "Saved" : "Save notes"}
      </button>
    </div>
  );
}
