"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, X, AlertCircle } from "lucide-react";

interface AddFollowupModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Quick "add a follow-up" popup, triggered from a row in the leads table. */
export function AddFollowupModal({ leadId, leadName, onClose }: AddFollowupModalProps) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
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
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to add follow-up");
        return;
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-elevated border border-border rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Add follow-up</h2>
              <p className="text-xs text-text-muted mt-0.5">{leadName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <Input
              id="modal_followup_date"
              label="Date"
              type="date"
              icon={Calendar}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Textarea
              id="modal_followup_note"
              label="Note"
              rows={3}
              placeholder="e.g. Asked for a quote by Thursday, will call back."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-error">
                <AlertCircle size={13} strokeWidth={1.8} />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={saving}>
              Save follow-up
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
