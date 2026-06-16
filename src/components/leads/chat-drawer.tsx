"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Send, Bot, MessageCircle, Loader2, AlertCircle } from "lucide-react";

export interface ActiveChat {
  channel: "whatsapp" | "messenger";
  conversationId: string;
  name: string;
}

interface ChatMessage {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  ai_generated: boolean;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface ChatDrawerProps {
  chat: ActiveChat;
  onClose: () => void;
}

/**
 * Slide-over panel that loads a WhatsApp/Messenger conversation and lets the
 * operator reply inline from the Leads list. Polls every 5s while open.
 */
export function ChatDrawer({ chat, onClose }: ChatDrawerProps) {
  const baseUrl = `/api/v1/${chat.channel}/conversations/${chat.conversationId}/messages`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(baseUrl);
      const json = await res.json();
      if (res.ok && json.success) {
        setMessages(json.data.messages ?? []);
        setContact(json.data.contact ?? null);
      }
    } catch {
      // transient — keep showing what we have
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  // Initial load + 5s poll.
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to send");
        return;
      }
      setReply("");
      if (json.data.message) setMessages((prev) => [...prev, json.data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[440px] bg-surface-elevated border-l border-border z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} strokeWidth={1.8} className="text-text-muted shrink-0" />
              <h2 className="text-sm font-semibold text-foreground truncate">{chat.name}</h2>
            </div>
            <p className="text-[11px] text-text-muted capitalize">
              {chat.channel}
              {contact ? ` · ${chat.channel === "whatsapp" ? contact : `id …${contact.slice(-6)}`}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-foreground transition-colors"
            aria-label="Close chat"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-text-muted">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-10">No messages yet.</p>
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} />)
          )}
        </div>

        {/* Reply */}
        <div className="border-t border-border p-3 shrink-0">
          {error && (
            <div className="flex items-start gap-1.5 text-xs text-error mb-2">
              <AlertCircle size={13} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              placeholder="Type a reply…  (Enter to send)"
              className="flex-1 resize-none px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button onClick={handleSend} loading={sending} disabled={!reply.trim()} className="!px-3">
              <Send size={15} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isOutbound = message.direction === "outbound";
  const timestamp = message.sent_at || message.created_at;
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 ${
            isOutbound
              ? "bg-primary text-white rounded-br-sm"
              : "bg-surface border border-border text-foreground rounded-bl-sm"
          }`}
        >
          {message.body ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
          ) : (
            <p className="text-sm italic opacity-70">({message.message_type})</p>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] text-text-muted px-1 ${isOutbound ? "flex-row-reverse" : ""}`}>
          <span>{formatTime(timestamp)}</span>
          {message.ai_generated && (
            <Badge variant="processing" className="!px-1.5 !py-0 !text-[9px]">
              <Bot size={9} strokeWidth={2} />
              AI
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
