"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";

interface ConvertToLeadButtonProps {
  conversationId: string;
}

/**
 * Button on the WhatsApp thread page. Pre-fills a new lead from the
 * conversation (phone, name, last message preview) and redirects to the
 * lead edit form so the operator can fill in product, location, etc.
 */
export function ConvertToLeadButton({ conversationId }: ConvertToLeadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/leads/from-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create lead");
        setLoading(false);
        return;
      }
      router.push(`/leads/${json.data.lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border hover:bg-surface disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <UserPlus size={11} strokeWidth={2} />
        )}
        Convert to lead
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </div>
  );
}
