"use client";

import { useState } from "react";
import { Link2, Check, Send, AlertCircle } from "lucide-react";

interface SendBookingLinkButtonProps {
  token: string;
  customerName: string;
  chatChannel: "whatsapp" | "messenger" | null;
  chatConversationId: string | null;
}

/**
 * Lets the operator share the public self-scheduling link with the customer —
 * either by sending it straight into the WhatsApp/Messenger chat, or copying it.
 */
export function SendBookingLinkButton({
  token,
  customerName,
  chatChannel,
  chatConversationId,
}: SendBookingLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const link = () => `${window.location.origin}/book/${token}`;
  const canSend = Boolean(chatChannel && chatConversationId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function send() {
    if (!canSend) return;
    setSent("sending");
    setErr(null);
    const msg = `Hi ${customerName.split(" ")[0]}, please pick your installation time here:\n${link()}`;
    try {
      const res = await fetch(`/api/v1/${chatChannel}/conversations/${chatConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msg }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSent("error");
        setErr(json.error?.message ?? "Failed to send");
        return;
      }
      setSent("sent");
      setTimeout(() => setSent("idle"), 3000);
    } catch {
      setSent("error");
      setErr("Network error");
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      {sent === "error" && (
        <span className="inline-flex items-center gap-1 text-xs text-error" title={err ?? ""}>
          <AlertCircle size={12} strokeWidth={1.8} />
        </span>
      )}
      {canSend && (
        <button
          type="button"
          onClick={send}
          disabled={sent === "sending"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-surface text-foreground text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {sent === "sent" ? <Check size={14} strokeWidth={1.8} /> : <Send size={14} strokeWidth={1.8} />}
          {sent === "sent" ? "Link sent" : "Send booking link"}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-surface text-text-muted hover:text-foreground text-xs font-semibold transition-colors"
        title="Copy booking link"
      >
        {copied ? <Check size={14} strokeWidth={1.8} /> : <Link2 size={14} strokeWidth={1.8} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
