"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Pause, Play, Loader2, AlertCircle } from "lucide-react";

interface AiPauseToggleProps {
  conversationId: string;
  initiallyPaused: boolean;
  /** Which channel's conversation this is. Defaults to whatsapp. */
  channel?: "whatsapp" | "messenger";
}

/**
 * Small toggle that pauses or resumes the AI auto-reply for a single
 * conversation. Calls PATCH /api/v1/{channel}/conversations/[id] then
 * refreshes server data so the new state is reflected everywhere.
 */
export function AiPauseToggle({ conversationId, initiallyPaused, channel = "whatsapp" }: AiPauseToggleProps) {
  const [paused, setPaused] = useState(initiallyPaused);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle() {
    const nextState = !paused;
    setSaving(true);
    setError(null);
    // Optimistic update for snappy feel.
    setPaused(nextState);

    try {
      const res = await fetch(`/api/v1/${channel}/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_paused: nextState }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        // Roll back on failure.
        setPaused(!nextState);
        setError(json.error?.message ?? "Failed to update");
        return;
      }

      // Re-fetch server-rendered data so other UI (badges, etc.) reflects the change.
      router.refresh();
    } catch (err) {
      setPaused(!nextState);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status pill */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
          paused ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
        }`}
      >
        <Bot size={11} strokeWidth={2} />
        {paused ? "AI paused" : "AI active"}
      </div>

      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border hover:bg-surface disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <Loader2 size={11} className="animate-spin" />
        ) : paused ? (
          <Play size={11} strokeWidth={2} />
        ) : (
          <Pause size={11} strokeWidth={2} />
        )}
        {paused ? "Resume AI" : "Pause AI"}
      </button>

      {error && (
        <span className="inline-flex items-center gap-1 text-[11px] text-error">
          <AlertCircle size={11} strokeWidth={2} />
          {error}
        </span>
      )}
    </div>
  );
}
